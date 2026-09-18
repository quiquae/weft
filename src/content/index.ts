import type { Grade, LexEntry, LexPack, MemoryCard, Settings } from '../core/types.ts';
import { selectSwaps } from '../core/selector.ts';
import { looksLikeJunk, tokenize, wordTokens } from '../core/tokenize.ts';
import { hashString } from '../core/rand.ts';
import { guessPos, sentenceOf } from '../core/pos-guess.ts';
import { applyLetterforms } from '../core/letterforms.ts';
import { getLanguage } from '../core/languages.ts';
import { send } from '../shared/rpc.ts';
import { api, contextAlive, resourceUrl } from '../shared/browser.ts';
import type { PageState } from '../shared/messages.ts';
import {
  collectTextNodes,
  detectFramework,
  documentLanguageMatches,
  hasSkippedAncestor,
  isCandidateText,
  DEFAULT_MIN_WORDS,
  type WalkerOptions,
} from './walker.ts';
import { computeWoven, pinKey, type Hit, type WovenRecord } from './weave.ts';
import { HighlightRenderer } from './render-highlight.ts';
import { WrappedRenderer, resolveRenderMode } from './render-wrapped.ts';
import type { Renderer } from './renderer.ts';
import { applyPageStyles, removePageStyles } from './styles.ts';
import { Tooltip } from './tooltip.ts';
import { AttentionTracker } from './attention.ts';
import { Announcer } from './announce.ts';

/**
 * Page orchestrator.
 *
 * Runs once per top-level document. Responsibilities, in the order they
 * matter: decide whether to act at all, weave, keep weaving as the page
 * mutates, raise difficulty as attention accumulates, and get out of the way
 * completely when asked.
 */

declare global {
  interface Window {
    __weftActive?: boolean;
  }
}

const SCAN_SLICE = 30;
const POINTER_THROTTLE_MS = 55;
const EXPOSURE_SWEEP_MS = 2000;
const EXPOSURE_FLUSH_MS = 6000;
const RATIO_EPSILON = 0.01;
/** Most unknown words to send for translation per page load. */
const PROVIDER_WORD_CAP = 60;

/** Packs are fetched from disk once per document and cached per language. */
const packCache = new Map<string, LexPack>();

async function loadPack(source: string, target: string): Promise<LexPack | null> {
  const key = `${source}-${target}`;
  const cached = packCache.get(key);
  if (cached) return cached;
  try {
    const response = await fetch(resourceUrl(`lexicon/${key}.json`));
    if (!response.ok) return null;
    const pack = (await response.json()) as LexPack;
    packCache.set(key, pack);
    return pack;
  } catch {
    // The pack is a packaged resource, so a failure here means the extension
    // is being updated or the resource list is wrong. Either way, no weave.
    return null;
  }
}

/**
 * Bake the user's letterform choices into the display forms once, at load.
 *
 * `tgtLemma` is deliberately left canonical. It is the identity used for the
 * memory card, and rewriting it would orphan a learner's entire vocabulary
 * the moment they toggled macrons off.
 */
function applyLetterformsToPack(pack: LexPack, settings: Settings): LexPack {
  const meta = getLanguage(pack.meta.target);
  if (!meta.historical || !meta.letterforms?.length) return pack;
  const keep = settings.weave.letterforms;
  const entries: Record<string, LexEntry[]> = Object.create(null);
  for (const [surface, list] of Object.entries(pack.entries)) {
    entries[surface] = list.map((entry) => ({
      ...entry,
      tgt: applyLetterforms(entry.tgt, pack.meta.target, keep),
    }));
  }
  return { meta: pack.meta, entries };
}

class WeftPage {
  private state: PageState;
  private pack: LexPack;
  private renderer: Renderer;
  private tooltip: Tooltip;
  private attention: AttentionTracker;
  private announcer: Announcer;
  private observer: MutationObserver | null = null;
  private records = new Map<Text, WovenRecord>();
  private walkerOptions: WalkerOptions;
  private cards = new Map<string, MemoryCard>();
  private introducedToday = new Set<string>();
  private pageLemmaCounts = new Map<string, number>();
  private ratio: number;

  private pendingNodes: Text[] = [];
  private scanHandle: number | null = null;
  private pointerAt = { x: 0, y: 0 };
  private lastPointerCheck = 0;
  private hoverTimer: number | null = null;
  private hideTimer: number | null = null;
  private currentHit: Hit | null = null;
  private exposedLemmas = new Set<string>();
  private exposureBatch = new Set<string>();
  private exposureTimer: number | null = null;
  private flushTimer: number | null = null;
  private cursor = -1;
  private destroyed = false;
  private unmatched = new Map<string, { pos: string; num?: 'sg' | 'pl'; context: string; hits: number }>();
  private providerRunDone = false;

  /**
   * Nodes this page object created or detached itself.
   *
   * The wrapped renderer replaces a text node with a fragment, which the
   * MutationObserver then reports as a removal of that text node and an
   * addition of several others. Without this set the observer reads its own
   * work as the page changing underneath it: it looks the removed node up,
   * finds the record, and reverts the weave it had just applied — while
   * re-queueing the text nodes it inserted, so every paragraph was woven
   * twice and then immediately undone.
   */
  private owned = new WeakSet<Node>();

  constructor(state: PageState, pack: LexPack, renderer: Renderer) {
    this.state = state;
    this.pack = pack;
    this.renderer = renderer;
    this.ratio = state.ratio;

    for (const [id, card] of Object.entries(state.cards)) this.cards.set(id, card);
    for (const lemma of state.introducedToday) this.introducedToday.add(lemma);

    this.walkerOptions = {
      sourceLang: state.settings.learning.sourceLang,
      minWords: DEFAULT_MIN_WORDS,
      excludeSelectors: [],
    };

    this.tooltip = new Tooltip(state.settings, {
      onGrade: (lemma, grade) => this.grade(lemma, grade),
      onSpeak: (text, lang) => speak(text, lang),
    });

    this.attention = new AttentionTracker({
      idleThresholdSec: state.settings.attention.idleThresholdSec,
      reportEverySec: 5,
      onReport: (seconds) => this.reportAttention(seconds),
    });

    this.announcer = new Announcer(state.settings.a11y.announceSwaps);
  }

  start(): void {
    applyPageStyles(this.state.settings);
    this.tooltip.attach();

    const nodes = collectTextNodes(document.body, this.walkerOptions);
    this.enqueue(nodes);

    this.observer = new MutationObserver((records) => this.onMutations(records));
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    window.addEventListener('pointermove', this.onPointerMove, { passive: true, capture: true });
    window.addEventListener('pointerdown', this.onPointerDown, { capture: true });
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
    window.addEventListener('scroll', this.onScroll, { passive: true, capture: true });
    window.addEventListener('pagehide', this.onPageHide);
    document.addEventListener('focusin', this.onFocusIn, { capture: true });

    this.attention.start();
    // Created empty and up front: a live region inserted at the same moment
    // its text appears is announced unreliably.
    this.announcer.start();
    this.exposureTimer = window.setInterval(() => this.sweepExposures(), EXPOSURE_SWEEP_MS);
    this.flushTimer = window.setInterval(() => this.flushExposures(), EXPOSURE_FLUSH_MS);
  }

  /* ------------------------------------------------------------- weaving */

  private lookup = (surface: string): LexEntry[] | undefined => {
    const list = this.pack.entries[surface];
    return list && list.length ? list : undefined;
  };

  private enqueue(nodes: Text[]): void {
    if (!nodes.length) return;
    for (const node of nodes) {
      if (!this.records.has(node)) this.pendingNodes.push(node);
    }
    this.scheduleScan();
  }

  private scheduleScan(): void {
    if (this.scanHandle !== null || this.destroyed) return;
    this.scanHandle = schedule(() => {
      this.scanHandle = null;
      this.processSlice();
      if (this.pendingNodes.length) {
        this.scheduleScan();
      } else {
        this.renderer.flush();
        // Once the page has settled, not per word: forty announcements is a
        // denial of service, and the reader is about to read the page
        // anyway. The count is the part worth hearing.
        this.announcer.summarise(this.wovenCount(), getLanguage(this.state.decision.target).name);
        void this.extendVocabulary();
      }
    });
  }

  /** How many words are currently in the target language. */
  private wovenCount(): number {
    let n = 0;
    for (const record of this.records.values()) n += record.swaps.length;
    return n;
  }

  private processSlice(): void {
    const slice = this.pendingNodes.splice(0, SCAN_SLICE);
    for (const node of slice) {
      if (this.destroyed) return;
      this.weaveNode(node);
    }
  }

  private weaveNode(node: Text, pinned?: Set<string>): void {
    if (!node.isConnected) return;
    const text = node.nodeValue;
    if (!text) return;
    if (!isCandidateText(node, this.walkerOptions)) return;
    if (hasSkippedAncestor(node.parentElement, this.walkerOptions)) return;

    const tokens = tokenize(text);
    const result = selectSwaps({
      tokens,
      lookup: this.lookup,
      cards: this.cards,
      now: Date.now(),
      target: this.state.decision.target,
      ratio: this.ratio,
      settings: this.state.settings,
      effectiveLevel: this.state.effectiveLevel,
      introducedToday: this.introducedToday,
      pageLemmaCounts: this.pageLemmaCounts,
      // Seeded from the text itself, so the same paragraph always weaves the
      // same way no matter how many times a framework re-renders it.
      seed: hashString(text),
      explain: this.state.settings.reveal.showWhy,
      ...(pinned?.size ? { pinned } : {}),
    });

    if (this.state.settings.providers.enabled && !this.providerRunDone) {
      this.collectUnmatched(tokens);
    }

    if (!result.swaps.length) return;

    for (const lemma of result.newLemmas) this.introducedToday.add(lemma);
    for (const swap of result.swaps) {
      const lemma = swap.entry.tgtLemma;
      this.pageLemmaCounts.set(lemma, (this.pageLemmaCounts.get(lemma) ?? 0) + 1);
    }

    const { woven, applied } = computeWoven(text, result.swaps);
    const record: WovenRecord = {
      node,
      original: text,
      woven,
      swaps: applied,
      // Kept in source-text coordinates so a later re-weave can pin exactly
      // the words that are on screen now.
      sourceSwaps: result.swaps,
    };
    this.renderer.apply(record);

    // Claim everything the renderer touched before the observer can see it.
    this.owned.add(node);
    if (record.inserted) for (const inserted of record.inserted) this.owned.add(inserted);

    // In wrapped mode the renderer replaces the node, so key on whatever the
    // record now points at.
    this.records.set(record.node, record);
    if (record.node !== node) this.records.delete(node);
  }

  private revertNode(node: Text): void {
    const record = this.records.get(node);
    if (!record) return;
    for (const swap of record.swaps) {
      const lemma = swap.entry.tgtLemma;
      const count = (this.pageLemmaCounts.get(lemma) ?? 1) - 1;
      if (count <= 0) this.pageLemmaCounts.delete(lemma);
      else this.pageLemmaCounts.set(lemma, count);
    }
    const inserted = record.inserted ? [...record.inserted] : [];
    this.renderer.revert(record);
    // The text node revert put back is ours too, as are the ones it removed.
    this.owned.add(record.node);
    for (const old of inserted) this.owned.add(old);
    this.records.delete(node);
    if (record.node !== node) this.records.delete(record.node);
  }

  /**
   * Re-weave everything at a new ratio.
   *
   * Safe to do mid-read precisely because selection is prefix-monotone: every
   * word that was already in the target language stays in it, and the higher
   * ratio only appends. Offsets shift, so each node is reverted and re-woven
   * rather than patched.
   */
  private reweaveAll(pin: boolean): void {
    if (this.hoverTimer !== null) window.clearTimeout(this.hoverTimer);
    this.tooltip.hide();
    this.currentHit = null;

    // Iterate the records, not the map keys. In wrapped mode revert replaces
    // the text node, so the key is a detached node and `isConnected` on it is
    // false — which silently skipped every node and left the page unwoven
    // after the first escalation.
    const records = [...this.records.values()];
    const pinned = new Map<WovenRecord, Set<string>>();
    if (pin) {
      for (const record of records) {
        pinned.set(record, new Set(record.sourceSwaps.map(pinKey)));
      }
    }

    for (const record of records) this.revertNode(record.node);
    this.pageLemmaCounts.clear();

    for (const record of records) {
      if (!record.node.isConnected) continue;
      this.weaveNode(record.node, pinned.get(record));
    }
    this.renderer.flush();
  }

  /* --------------------------------------------------- provider top-up */

  /**
   * Note content words the shipped pack has never heard of.
   *
   * Only collected when a provider is configured, because otherwise there is
   * nothing to do with them. A coarse part-of-speech guess is attached here,
   * while the surrounding tokens are still available — by the time the
   * background worker sees the word, the context is gone.
   */
  private collectUnmatched(tokens: ReturnType<typeof tokenize>): void {
    if (this.unmatched.size >= PROVIDER_WORD_CAP * 3) return;
    const words = wordTokens(tokens);
    for (const { token, index } of words) {
      const lower = token.text.toLowerCase();
      if (this.pack.entries[lower]) continue;
      if (looksLikeJunk(token, tokens, index)) continue;
      const existing = this.unmatched.get(lower);
      if (existing) {
        existing.hits++;
        continue;
      }
      const guess = guessPos(tokens, index, { allowPlural: true });
      // Declining is the point: a guess below this threshold would be sent,
      // translated, cached and woven, and a wrong part of speech produces a
      // wrong word rather than a slightly odd one.
      if (!guess || guess.confidence < 0.55) continue;
      this.unmatched.set(lower, {
        pos: guess.pos,
        ...(guess.num ? { num: guess.num } : {}),
        context: this.state.settings.providers.sendContext ? sentenceOf(tokens, index) : '',
        hits: 1,
      });
    }
  }

  /**
   * Ask the background worker to translate the most-used unknown words, then
   * fold them into this page's pack and re-weave.
   *
   * Runs once per page load, after the first pass has finished, so the page is
   * already readable before any network call happens. The words are ranked by
   * how often they occur here: translating the word that appears eleven times
   * is worth more than the one that appears once.
   */
  private async extendVocabulary(): Promise<void> {
    if (this.providerRunDone || this.destroyed) return;
    if (!this.state.settings.providers.enabled) return;
    this.providerRunDone = true;
    if (!this.unmatched.size) return;

    const ranked = [...this.unmatched.entries()]
      .sort((a, b) => b[1].hits - a[1].hits)
      .slice(0, PROVIDER_WORD_CAP);

    const reply = await send({
      type: 'lookup-words',
      target: this.state.decision.target,
      words: ranked.map(([word, info]) => ({
        word,
        pos: info.pos as LexEntry['pos'],
        ...(info.num ? { num: info.num } : {}),
        ...(info.context ? { context: info.context } : {}),
      })),
    });

    if (!reply || this.destroyed || !reply.entries.length) return;

    const entries = { ...this.pack.entries };
    for (const entry of reply.entries) {
      const key = entry.src.toLowerCase();
      // A curated entry always wins; a machine gloss only fills a gap.
      if (entries[key]?.length) continue;
      entries[key] = [entry];
    }
    this.pack = { meta: this.pack.meta, entries };
    this.unmatched.clear();

    if (__WEFT_DEV__) {
      console.info(
        `[weft] provider added ${reply.entries.length} entries ` +
          `(${reply.fromCache} cached, ${reply.fromProvider} fetched)` +
          (reply.error ? `; ${reply.error}` : ''),
      );
    }
    this.reweaveAll(true);
  }

  /* ----------------------------------------------------------- mutations */

  private onMutations(mutations: MutationRecord[]): void {
    if (this.destroyed) return;
    const fresh: Text[] = [];

    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        const node = mutation.target as Text;
        const record = this.records.get(node);
        if (!record && this.owned.has(node)) continue;
        if (record) {
          // Our own write: ignore, or we loop forever.
          if (node.nodeValue === record.woven) continue;
          // The page rewrote text we owned. Drop the bookkeeping and treat it
          // as new content.
          this.renderer.revert(record);
          this.records.delete(node);
        }
        if (isCandidateText(node, this.walkerOptions)) fresh.push(node);
        continue;
      }

      for (const added of mutation.addedNodes) {
        if (this.owned.has(added)) continue;
        if (added.nodeType === Node.TEXT_NODE) {
          fresh.push(added as Text);
        } else if (added.nodeType === Node.ELEMENT_NODE) {
          const el = added as Element;
          if (el.hasAttribute('data-weft')) continue;
          fresh.push(...collectTextNodes(el, this.walkerOptions, 400));
        }
      }

      for (const removed of mutation.removedNodes) {
        // Our own detachment, not the page's: ignore it, or we revert the
        // weave we just applied.
        if (this.owned.has(removed)) continue;
        if (removed.nodeType === Node.TEXT_NODE) {
          const record = this.records.get(removed as Text);
          if (record) {
            this.renderer.revert(record);
            this.records.delete(removed as Text);
          }
        }
      }
    }

    if (fresh.length) this.enqueue(fresh);
  }

  /* -------------------------------------------------------------- reveal */

  private onPointerMove = (event: Event): void => {
    const e = event as PointerEvent;
    this.pointerAt = { x: e.clientX, y: e.clientY };
    const now = performance.now();
    if (now - this.lastPointerCheck < POINTER_THROTTLE_MS) return;
    this.lastPointerCheck = now;

    const trigger = this.state.settings.reveal.trigger;
    if (trigger === 'click') return;

    if (this.tooltip.containsPoint(e.clientX, e.clientY)) {
      this.cancelHide();
      return;
    }

    const hit = this.hitTest(e.clientX, e.clientY);
    if (!hit) {
      this.cancelHover();
      this.scheduleHide();
      return;
    }
    if (this.currentHit && this.currentHit.swap === hit.swap) {
      this.cancelHide();
      return;
    }
    this.cancelHover();
    const delay = this.state.settings.reveal.hoverDelayMs;
    this.hoverTimer = window.setTimeout(() => this.reveal(hit, false), delay);
  };

  private onPointerDown = (event: Event): void => {
    const e = event as PointerEvent;
    const trigger = this.state.settings.reveal.trigger;
    if (trigger === 'hover') return;
    if (this.tooltip.containsPoint(e.clientX, e.clientY)) return;

    const hit = this.hitTest(e.clientX, e.clientY);
    if (!hit) {
      this.tooltip.hide();
      this.renderer.clearRevealed();
      this.currentHit = null;
      return;
    }

    this.reveal(hit, false);

    // Only swallow the click when it would not have done anything else.
    // Inside a link or a control, the page's own behaviour wins: hovering has
    // already shown the translation, and eating a navigation click to show a
    // tooltip the user has already seen would be indefensible.
    const target = event.target as Element | null;
    const interactive = target?.closest?.('a,button,[role="button"],summary,label,input');
    if (!interactive) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  private onKeyDown = (event: Event): void => {
    const e = event as KeyboardEvent;
    if (e.key === 'Escape' && this.tooltip.isOpen()) {
      this.tooltip.hide();
      this.currentHit = null;
      this.renderer.clearRevealed();
    }
  };

  private onFocusIn = (event: Event): void => {
    // Wrapped mode puts the woven words in the tab order; focusing one should
    // reveal it, which is what makes keyboard reading work at all.
    if (this.renderer.mode !== 'wrapped') return;
    const el = event.target as HTMLElement | null;
    if (!el?.hasAttribute?.('data-weft-swap')) return;
    const hit = (this.renderer as WrappedRenderer).hitForElement(el);
    if (hit) this.reveal(hit, true);
  };

  private onScroll = (): void => {
    if (this.tooltip.isOpen()) {
      this.tooltip.hide();
      this.currentHit = null;
      this.renderer.clearRevealed();
    }
  };

  private onPageHide = (): void => {
    this.flushExposures();
    this.attention.stop();
  };

  private hitTest(x: number, y: number): Hit | null {
    return this.renderer.hitTest(x, y, (node) => this.records.get(node));
  }

  private reveal(hit: Hit, viaKeyboard: boolean): void {
    this.cancelHover();
    this.cancelHide();
    this.currentHit = hit;
    hit.swap.revealed = true;
    this.renderer.setRevealed(hit.record, hit.swap);
    // The tooltip is visual. A reader who asked for the English has to be
    // told it, and this is the one moment they are waiting to hear something.
    this.announcer.reveal(hit.swap.replacement, hit.swap.original);

    const rect = this.renderer.rectFor(hit.record, hit.swap);
    if (!rect) return;
    this.tooltip.show(
      {
        entry: hit.swap.entry,
        target: this.state.decision.target,
        original: hit.swap.original,
        replacement: hit.swap.replacement,
        ...(hit.swap.factors ? { factors: hit.swap.factors } : {}),
        ...(hit.swap.firstMeeting !== undefined ? { firstMeeting: hit.swap.firstMeeting } : {}),
      },
      rect,
      viaKeyboard,
    );

    // Needing the English is the signal that this word is not yet known.
    // Recording it as a lapse is what makes the scheduler show it again soon.
    void send({
      type: 'record-reveal',
      target: this.state.decision.target,
      lemma: hit.swap.entry.tgtLemma,
    });
  }

  private cancelHover(): void {
    if (this.hoverTimer !== null) {
      window.clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
  }

  private cancelHide(): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private scheduleHide(): void {
    if (!this.tooltip.isOpen() || this.hideTimer !== null) return;
    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = null;
      this.tooltip.hide();
      this.currentHit = null;
      this.renderer.clearRevealed();
    }, 180);
  }

  /* ----------------------------------------------------------- keyboard */

  /** Move the reading cursor to the next or previous woven word. */
  moveCursor(delta: number): void {
    const flat = this.flatSwaps();
    if (!flat.length) return;
    this.cursor = (this.cursor + delta + flat.length) % flat.length;
    const hit = flat[this.cursor] as Hit;
    const rect = this.renderer.rectFor(hit.record, hit.swap);
    if (rect && (rect.top < 0 || rect.bottom > window.innerHeight)) {
      const el = hit.record.elements?.[hit.record.swaps.indexOf(hit.swap)];
      if (el) el.scrollIntoView({ block: 'center', behavior: 'auto' });
      else window.scrollBy({ top: rect.top - window.innerHeight / 2, behavior: 'auto' });
    }
    this.reveal(hit, true);
  }

  /** A few words currently woven into this page, for the popup. */
  sample(count: number): Array<{ target: string; source: string }> {
    const out: Array<{ target: string; source: string }> = [];
    const seen = new Set<string>();
    for (const record of this.records.values()) {
      for (const swap of record.swaps) {
        if (seen.has(swap.entry.tgtLemma)) continue;
        seen.add(swap.entry.tgtLemma);
        out.push({ target: swap.replacement, source: swap.original });
        if (out.length >= count) return out;
      }
    }
    return out;
  }

  currentRatio(): number {
    return this.ratio;
  }

  /** Reveal whatever is under the pointer, for the keyboard shortcut. */
  revealAtPointer(): void {
    const hit = this.hitTest(this.pointerAt.x, this.pointerAt.y);
    if (hit) this.reveal(hit, false);
  }

  private flatSwaps(): Hit[] {
    const out: Hit[] = [];
    for (const record of this.records.values()) {
      if (!record.node.isConnected && !record.inserted?.length) continue;
      for (const swap of record.swaps) out.push({ record, swap });
    }
    out.sort((a, b) => {
      const ra = this.renderer.rectFor(a.record, a.swap);
      const rb = this.renderer.rectFor(b.record, b.swap);
      if (!ra || !rb) return 0;
      return ra.top - rb.top || ra.left - rb.left;
    });
    return out;
  }

  /* ---------------------------------------------------------- exposures */

  /**
   * A word counts as met when it has actually been on screen.
   *
   * Weaving a word at the bottom of a long page and calling that an exposure
   * would inflate every statistic and, worse, would tell the scheduler the
   * learner has seen something they have not. So visibility is sampled rather
   * than assumed.
   */
  private sweepExposures(): void {
    if (this.destroyed || !this.attention.isAttending()) return;
    const height = window.innerHeight;
    const width = window.innerWidth;

    for (const record of this.records.values()) {
      for (const swap of record.swaps) {
        const lemma = swap.entry.tgtLemma;
        if (this.exposedLemmas.has(lemma)) continue;
        const rect = this.renderer.rectFor(record, swap);
        if (!rect) continue;
        if (rect.bottom < 0 || rect.top > height) continue;
        if (rect.right < 0 || rect.left > width) continue;
        this.exposedLemmas.add(lemma);
        this.exposureBatch.add(lemma);
      }
    }
  }

  private flushExposures(): void {
    if (!this.exposureBatch.size) return;
    const lemmas = [...this.exposureBatch];
    this.exposureBatch.clear();
    void send({ type: 'record-exposure', target: this.state.decision.target, lemmas });
  }

  /* ---------------------------------------------------------- attention */

  private async reportAttention(seconds: number): Promise<void> {
    const reply = await send({
      type: 'record-attention',
      host: this.state.decision.attentionKey,
      seconds,
      url: location.href,
    });
    if (!reply || this.destroyed) return;

    if (reply.panicActive) {
      this.suspend();
      return;
    }
    if (Math.abs(reply.ratio - this.ratio) >= RATIO_EPSILON) {
      const rising = reply.ratio > this.ratio;
      this.ratio = reply.ratio;
      // Pin the words already on screen when difficulty is going up. Going
      // down, the reader has asked for less and pinning would deny it.
      this.reweaveAll(rising);
    }
  }

  private async grade(lemma: string, grade: Grade): Promise<void> {
    const reply = await send({
      type: 'record-grade',
      target: this.state.decision.target,
      lemma,
      grade,
    });
    if (reply?.card) this.cards.set(reply.card.id, reply.card);
  }

  /* --------------------------------------------------------- life cycle */

  /** Remove every trace of weaving but stay alive, ready to resume. */
  suspend(): void {
    for (const node of [...this.records.keys()]) this.revertNode(node);
    this.tooltip.hide();
    this.pageLemmaCounts.clear();
  }

  resume(): void {
    const nodes = collectTextNodes(document.body, this.walkerOptions);
    this.enqueue(nodes);
  }

  applySettings(settings: Settings, ratio: number, effectiveLevel: number): void {
    this.state = { ...this.state, settings, ratio, effectiveLevel };
    this.ratio = ratio;
    this.tooltip.updateSettings(settings);
    this.renderer.updateSettings(settings);
    this.attention.updateOptions({ idleThresholdSec: settings.attention.idleThresholdSec });
    this.announcer.setEnabled(settings.a11y.announceSwaps);
    // A reweave is a new state of the page, so its summary is worth saying
    // again — the count will have changed.
    this.announcer.resetSummary();
    applyPageStyles(settings);
    this.pack = applyLetterformsToPack(this.pack, settings);
    this.reweaveAll(false);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.observer?.disconnect();
    this.observer = null;
    this.attention.stop();
    this.announcer.stop();
    if (this.exposureTimer !== null) window.clearInterval(this.exposureTimer);
    if (this.flushTimer !== null) window.clearInterval(this.flushTimer);
    this.cancelHover();
    this.cancelHide();
    window.removeEventListener('pointermove', this.onPointerMove, { capture: true });
    window.removeEventListener('pointerdown', this.onPointerDown, { capture: true });
    window.removeEventListener('keydown', this.onKeyDown, { capture: true });
    window.removeEventListener('scroll', this.onScroll, { capture: true });
    window.removeEventListener('pagehide', this.onPageHide);
    document.removeEventListener('focusin', this.onFocusIn, { capture: true });
    this.renderer.destroy();
    this.tooltip.destroy();
    removePageStyles();
    this.records.clear();
    window.__weftActive = false;
  }
}

/* --------------------------------------------------------------- helpers */

function schedule(fn: () => void): number {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: object) => number })
    .requestIdleCallback;
  if (typeof ric === 'function') return ric(fn, { timeout: 300 });
  return window.setTimeout(fn, 16);
}

function speak(text: string, lang: string | null): void {
  if (!lang || typeof speechSynthesis === 'undefined') return;
  try {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.85;
    speechSynthesis.speak(utterance);
  } catch {
    // Speech is a nicety; never let it break a reveal.
  }
}

/* ------------------------------------------------------------ bootstrap */

let page: WeftPage | null = null;

async function boot(): Promise<void> {
  // Re-injection happens on extension update and on manual re-registration.
  if (window.__weftActive) return;
  window.__weftActive = true;

  if (window.top !== window) return; // top-level documents only
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => void boot(), { once: true });
    window.__weftActive = false;
    return;
  }

  const state = await send({ type: 'get-page-state', url: location.href });
  if (!state) return;
  if (state.decision.mode === 'excluded' || state.decision.mode === 'off') return;
  if (state.panicActive) return;
  if (!documentLanguageMatches(state.settings.learning.sourceLang)) return;

  const raw = await loadPack(state.settings.learning.sourceLang, state.decision.target);
  if (!raw) return;
  const pack = applyLetterformsToPack(raw, state.settings);

  const framework = detectFramework();
  const supported = HighlightRenderer.supported();
  const choice = resolveRenderMode(state.settings, framework, supported);
  const renderer: Renderer =
    choice.mode === 'highlight'
      ? new HighlightRenderer()
      : new WrappedRenderer(state.settings, state.decision.target);

  if (__WEFT_DEV__) {
    console.info(
      `[weft] ${choice.mode} (${choice.reason}); ratio ${(state.ratio * 100).toFixed(1)}%; ` +
        `${Object.keys(pack.entries).length} surface forms`,
    );
  }

  page = new WeftPage(state, pack, renderer);
  page.start();
}

if (contextAlive()) {
  api.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    const msg = message as { type?: string };
    if (msg.type === 'weft-sample') {
      // The popup's interlinear strip shows words actually woven into the
      // page in front of the user, not a canned sample. Real content is the
      // whole point of the device.
      sendResponse({ pairs: page?.sample(3) ?? [], ratio: page?.currentRatio() ?? 0 });
      return undefined;
    }
    if (!page) return undefined;
    switch (msg.type) {
      case 'weft-cycle':
        page.moveCursor(1);
        return undefined;
      case 'weft-cycle-back':
        page.moveCursor(-1);
        return undefined;
      case 'weft-reveal':
        page.revealAtPointer();
        return undefined;
      case 'weft-suspend':
        page.suspend();
        return undefined;
      case 'weft-resume':
        page.resume();
        return undefined;
      case 'weft-teardown':
        page.destroy();
        page = null;
        return undefined;
      case 'weft-settings-changed':
        void refresh();
        return undefined;
      default:
        return undefined;
    }
  });
}

async function refresh(): Promise<void> {
  if (!page) return;
  const state = await send({ type: 'get-page-state', url: location.href });
  if (!state) return;
  if (state.decision.mode === 'excluded' || state.decision.mode === 'off' || state.panicActive) {
    page.suspend();
    return;
  }
  page.applySettings(state.settings, state.ratio, state.effectiveLevel);
}

void boot();

export {};
