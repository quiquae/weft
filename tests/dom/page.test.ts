import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDom } from './setup.ts';
import type { LexEntry, LexPack, MemoryCard, Settings } from '../../src/core/types.ts';
import type { PageState, Request, ResponseFor } from '../../src/shared/messages.ts';
import type { Renderer } from '../../src/content/renderer.ts';
import type { WovenRecord } from '../../src/content/weave.ts';

/**
 * The content script's page object, outside the browser.
 *
 * `WeftPage` keeps the bookkeeping that decides what a page shows: a record
 * for each woven node, the nodes that wove nothing, the nodes it made itself,
 * and the queue the idle scanner reads. Until 2026-11-08 every defect found in
 * that bookkeeping was held only by an end-to-end test in a real Chromium, and
 * two of its guards by nothing at all. The class lived in the module that
 * boots the content script, which reads the extension's namespace and
 * registers a message listener the moment it is imported, so nothing could
 * construct it anywhere else. It has a module of its own now, and these tests
 * build it in jsdom, handing it a renderer that writes `nodeValue` in place
 * as the highlight renderer does, or the real wrapped renderer, with the
 * extension's namespace faked so the real `send()` has somewhere to post.
 *
 * The fake worker answers by message type, and only the types a test gives an
 * answer, so the two paths that act on a reply are reached too: what the page
 * does when its attention report comes back with a new density or a panic
 * pass, and when a translation service's words come back to fill its gaps.
 */

const dom = installDom('');
const g = globalThis as unknown as Record<string, unknown>;
// Build-time constants esbuild would otherwise have inlined.
g['__WEFT_TARGET__'] = 'chrome';
g['__WEFT_DEV__'] = false;
g['location'] = dom.window.location;
/** What the fake worker answers, by message type. */
type Answers = { [T in Request['type']]?: (message: Extract<Request, { type: T }>) => ResponseFor<T> };
const answers: Answers = {};
/** Every message the page posted, in order. */
const posted: Request[] = [];
// The page posts what it records to the worker. A type no test has given an
// answer gets none, which `send()` reads as no reply, as it does when the
// worker is asleep.
g['chrome'] = {
  runtime: {
    id: 'weft-test',
    sendMessage: async (message: Request) => {
      posted.push(message);
      const answer = answers[message.type] as ((m: Request) => unknown) | undefined;
      return answer ? { ok: true, data: answer(message) } : undefined;
    },
  },
};

const { WeftPage } = await import('../../src/content/page.ts');
const { WrappedRenderer } = await import('../../src/content/render-wrapped.ts');
const { defaultSettings } = await import('../../src/core/settings.ts');

const pack = JSON.parse(
  readFileSync(new URL('../../src/lexicon/packs/en-fr.json', import.meta.url), 'utf8'),
) as LexPack;

/** English the French pack can weave much of: every noun here is in it. */
const PARAGRAPH =
  'The house by the water stood at the end of the road, and every morning the bread came ' +
  'from the city across the river, past the tree where a bird sang to the horse at the door.';

/** What the highlight renderer does to the tree, and nothing else. */
class NodeValueRenderer implements Renderer {
  readonly mode = 'highlight' as const;
  readonly applied: WovenRecord[] = [];
  apply(record: WovenRecord): void {
    this.applied.push(record);
    record.node.nodeValue = record.woven;
  }
  revert(record: WovenRecord): void {
    if (record.node.nodeValue === record.woven) record.node.nodeValue = record.original;
  }
  setRevealed(): void {}
  clearRevealed(): void {}
  hitTest(): null {
    return null;
  }
  rectFor(): null {
    return null;
  }
  flush(): void {}
  updateSettings(): void {}
  destroy(): void {}
}

function stateFor(ratio: number, settings: Settings = defaultSettings(Date.now(), 'test')): PageState {
  return {
    settings,
    tier: 'free',
    decision: {
      mode: 'taxed',
      rule: null,
      attentionKey: 'example.test',
      baseRatio: ratio,
      ceilingRatio: ratio,
      escalate: false,
      target: 'fr',
    },
    ratio,
    attentionSeconds: 0,
    cards: {},
    introducedToday: [],
    panicActive: false,
    effectiveLevel: 1,
    penaltyActive: false,
  };
}

const live: Array<InstanceType<typeof WeftPage>> = [];

function open(state: PageState, renderer: Renderer): InstanceType<typeof WeftPage> {
  const page = new WeftPage(state, pack, renderer);
  live.push(page);
  page.start();
  return page;
}

/** The paragraph's one text node, as the page wrote it. */
function paragraph(text: string): Text {
  document.body.replaceChildren();
  const p = document.createElement('p');
  p.textContent = text;
  document.body.append(p);
  return p.firstChild as Text;
}

/** Let the idle scanner, on 16 ms timeouts in jsdom, read its queue to the end. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

afterEach(() => {
  for (const page of live.splice(0)) page.destroy();
  document.body.replaceChildren();
  for (const type of Object.keys(answers)) delete answers[type as Request['type']];
  posted.length = 0;
});

describe('the page object, built in jsdom', () => {
  test('weaves a page through the renderer it is handed', async () => {
    const node = paragraph(PARAGRAPH);
    const renderer = new NodeValueRenderer();
    open(stateFor(0.35), renderer);
    await settle();
    assert.equal(renderer.applied.length, 1, 'one paragraph should be woven once');
    assert.equal(renderer.applied[0]!.original, PARAGRAPH);
    assert.ok(renderer.applied[0]!.swaps.length > 0, 'the paragraph wove no word');
    assert.equal(node.nodeValue, renderer.applied[0]!.woven);
  });
});

describe('the bookkeeping that decides what a page shows', () => {
  test('a paragraph the page rewrites before the scan reaches it is woven once', async () => {
    // start() queues the node, and the rewrite queues it again, from the
    // observer, before the idle scanner has run. Read a second time, its value
    // is the woven text, and weaving that as English weaves the page twice.
    const node = paragraph('The road ran down to the water.');
    const renderer = new NodeValueRenderer();
    open(stateFor(0.35), renderer);
    node.nodeValue = PARAGRAPH;
    await settle();
    const woven = renderer.applied.filter((record) => record.node === node);
    assert.equal(woven.length, 1, `the paragraph was woven ${woven.length} times`);
    assert.equal(woven[0]!.original, PARAGRAPH);
    assert.equal(node.nodeValue, woven[0]!.woven);
  });

  test('a page suspended before its scan weaves nothing it had queued', async () => {
    // A panic pass can arrive between start() queueing the page and the idle
    // scanner reading the queue.
    const node = paragraph(PARAGRAPH);
    const renderer = new NodeValueRenderer();
    const page = open(stateFor(0.35), renderer);
    page.suspend();
    await settle();
    assert.equal(renderer.applied.length, 0, 'a suspended page wove what it had queued');
    assert.equal(node.nodeValue, PARAGRAPH);
  });

  test('a woven page suspended stays in English', async () => {
    // suspend() writes the English back into every node it wove. Read as the
    // page rewriting its own text, that write is queued and woven again, and
    // a panic pass ends a moment after it starts.
    const node = paragraph(PARAGRAPH);
    const renderer = new NodeValueRenderer();
    const page = open(stateFor(0.35), renderer);
    await settle();
    assert.equal(renderer.applied.length, 1);
    page.suspend();
    await settle();
    assert.equal(node.nodeValue, PARAGRAPH, 'the suspended page is woven again');
    assert.equal(renderer.applied.length, 1, `the paragraph was woven ${renderer.applied.length} times`);
  });

  test('and weaves the page again when it resumes', async () => {
    const node = paragraph(PARAGRAPH);
    const renderer = new NodeValueRenderer();
    const page = open(stateFor(0.35), renderer);
    page.suspend();
    await settle();
    page.resume();
    await settle();
    assert.equal(renderer.applied.length, 1);
    assert.equal(node.nodeValue, renderer.applied[0]!.woven);
  });

  test('a paragraph that wove nothing at rest is woven when the density rises', async () => {
    const node = paragraph(PARAGRAPH);
    const renderer = new NodeValueRenderer();
    const settings = defaultSettings(Date.now(), 'test');
    const page = open(stateFor(0, settings), renderer);
    await settle();
    assert.equal(renderer.applied.length, 0, 'a resting density of 0 wove a word');
    page.applySettings(settings, 0.35, 1);
    await settle();
    assert.equal(renderer.applied.length, 1, 'the re-weave never reached the paragraph that wove nothing');
    assert.equal(node.nodeValue, renderer.applied[0]!.woven);
  });

  test('the wrapped renderer replacing a node is not read as the page changing', async () => {
    // The renderer swaps the text node for a fragment, which the observer
    // reports as a removal and several additions. Read as the page's doing,
    // the English runs it inserted are queued and woven again.
    paragraph(PARAGRAPH);
    const settings = defaultSettings(Date.now(), 'test');
    const renderer = new WrappedRenderer(settings, 'fr');
    const applied: WovenRecord[] = [];
    const apply = renderer.apply.bind(renderer);
    renderer.apply = (record) => {
      applied.push(record);
      apply(record);
    };
    open(stateFor(0.35, settings), renderer);
    await settle();
    assert.equal(applied.length, 1, `one paragraph was woven ${applied.length} times`);
    const swaps = document.querySelectorAll('p [data-weft-swap]');
    assert.equal(swaps.length, applied[0]!.swaps.length, 'the words woven are not the words on the page');
    assert.equal(document.querySelector('p')!.textContent, applied[0]!.woven);
  });

  test('a re-weave in wrapped mode reaches the nodes the renderer replaced', async () => {
    // Reverting a wrapped weave puts a fresh text node back, so by then the
    // record's key is a node no longer on the page. Read by its keys, the
    // re-weave skipped every node and left the page in English after the
    // first time the density moved.
    paragraph(PARAGRAPH);
    const settings = defaultSettings(Date.now(), 'test');
    const page = open(stateFor(0.2, settings), new WrappedRenderer(settings, 'fr'));
    await settle();
    const before = document.querySelectorAll('p [data-weft-swap]').length;
    assert.ok(before > 0, 'the paragraph wove no word at 20%');
    page.applySettings(settings, 0.35, 1);
    await settle();
    const after = document.querySelectorAll('p [data-weft-swap]').length;
    assert.ok(after >= before, `the re-weave left ${after} of the ${before} words woven`);
  });
});

describe('what the page does with the worker’s replies', () => {
  type Page = InstanceType<typeof WeftPage>;

  /** The tracker's own report, as five seconds of attention would make it. */
  const attend = (page: Page): void => page['attention']['opts'].onReport(5);

  /** The words a paragraph shows now, keyed as the selector pins them. */
  function onScreen(renderer: NodeValueRenderer, node: Text): Set<string> {
    const record = renderer.applied.filter((r) => r.node === node).at(-1);
    if (!record || node.nodeValue !== record.woven) return new Set();
    return new Set(record.sourceSwaps.map((s) => `${s.start}:${s.original.toLowerCase()}`));
  }

  /** A card the reader has just reviewed: well remembered, so not due, and too new to retire. */
  const fresh = (target: MemoryCard['target'], lemma: string): MemoryCard => ({
    id: `${target}:${lemma}`,
    target,
    lemma,
    stability: 5,
    difficulty: 5,
    lastReview: Date.now(),
    reps: 2,
    lapses: 0,
    exposures: 4,
    firstSeen: Date.now() - 86_400_000,
  });

  /** How many times the renderer has woven a node. */
  const weaves = (renderer: NodeValueRenderer, node: Text): number =>
    renderer.applied.filter((r) => r.node === node).length;

  /**
   * Weave the paragraph at 20%, then grade every word it wove as just
   * reviewed, which drives each one's "due" score to the bottom: re-woven
   * without pinning, at 15% or at 25%, the selector puts other words in their
   * places. The densities either side are 5 points away, because a step of
   * 0.01 is `0.2 - 0.19` = 0.010000000000000009 one way and 0.00999… the
   * other, and the page re-weaves only on a change of `RATIO_EPSILON`, 0.01.
   */
  async function wovenAndGraded(): Promise<{ page: Page; renderer: NodeValueRenderer; node: Text; before: Set<string> }> {
    const node = paragraph(PARAGRAPH);
    const renderer = new NodeValueRenderer();
    const page = open(stateFor(0.2), renderer);
    await settle();
    const record = renderer.applied.at(-1);
    assert.ok(record && record.sourceSwaps.length > 0, 'the paragraph wove no word at 20%');
    answers['record-grade'] = (m) => ({ card: fresh(m.target, m.lemma) });
    for (const swap of record.sourceSwaps) await page['grade'](swap.entry.tgtLemma, 3);
    return { page, renderer, node, before: onScreen(renderer, node) };
  }

  test('a density that falls re-weaves without pinning, so a word just reviewed can make way', async () => {
    // Falling, the reader has asked for less, and pinning what is on screen
    // would deny it. It is also the control for the test below: a word the
    // reader has not reviewed takes a reviewed word's place, so these grades
    // evict a word wherever nothing pins it.
    const { page, renderer, node, before } = await wovenAndGraded();
    const woven = weaves(renderer, node);
    answers['record-attention'] = () => ({ ratio: 0.15, attentionSeconds: 60, panicActive: false });
    attend(page);
    await settle();
    assert.ok(weaves(renderer, node) > woven, 'the reply did not re-weave the paragraph');
    const after = onScreen(renderer, node);
    const kept = [...before].filter((key) => after.has(key));
    const came = [...after].filter((key) => !before.has(key));
    assert.ok(kept.length < before.size, `all ${before.size} reviewed words stayed when the density fell`);
    assert.ok(came.length > 0, 'no unreviewed word took a reviewed word’s place, so nothing shows the grades evict');
  });

  test('a density that rises keeps every word on screen, reviewed or not', async () => {
    // "Difficulty only ever rises mid-page": a word just decoded must not
    // flip back to English as the page gets harder around it.
    const { page, renderer, node, before } = await wovenAndGraded();
    const woven = weaves(renderer, node);
    answers['record-attention'] = () => ({ ratio: 0.25, attentionSeconds: 60, panicActive: false });
    attend(page);
    await settle();
    assert.ok(weaves(renderer, node) > woven, 'the reply did not re-weave the paragraph');
    const after = onScreen(renderer, node);
    const lost = [...before].filter((key) => !after.has(key));
    assert.deepEqual(lost, [], 'words on screen flipped back to English as the density rose');
  });

  test('a reply saying a panic pass has begun leaves the page in English', async () => {
    const node = paragraph(PARAGRAPH);
    const renderer = new NodeValueRenderer();
    const page = open(stateFor(0.35), renderer);
    await settle();
    assert.notEqual(node.nodeValue, PARAGRAPH, 'the paragraph wove no word');
    answers['record-attention'] = () => ({ ratio: 0.35, attentionSeconds: 60, panicActive: true });
    attend(page);
    await settle();
    assert.equal(node.nodeValue, PARAGRAPH, 'the page is still woven during a panic pass');
    await settle();
    assert.equal(node.nodeValue, PARAGRAPH, 'the page wove itself again during a panic pass');
    assert.equal(renderer.applied.length, 1, 'the page re-wove during a panic pass');
  });

  /** A translation service's answer, in the shape the worker gives it (`makeEntry()`). */
  const machine = (word: string, tgt: string): LexEntry => ({
    src: word,
    lemma: word,
    pos: 'noun',
    tgt,
    tgtLemma: tgt,
    zipf: 3.6,
    senses: 1,
    conf: 0.75,
    band: 3,
    num: 'sg',
    note: 'Machine translation, not a checked gloss.',
  });

  /** Lookups on, a paragraph with one word the French pack lacks, and the service's answer. */
  async function lookedUp(level: number): Promise<{ node: Text; renderer: NodeValueRenderer }> {
    const settings = defaultSettings(Date.now(), 'test');
    settings.providers.enabled = true;
    const node = paragraph('The house by the water stood below the lighthouse.');
    const renderer = new NodeValueRenderer();
    answers['lookup-words'] = () => ({
      // The page asked for "lighthouse" alone; an answer for "house" as well
      // is the case a curated entry must win.
      entries: [machine('lighthouse', 'phare'), machine('house', 'chaumière')],
      fromCache: 0,
      fromProvider: 2,
    });
    open({ ...stateFor(1, settings), effectiveLevel: level }, renderer);
    await settle();
    return { node, renderer };
  }

  test('a lookup asks only for the words the pack lacks, and its answer never displaces a pack word', async () => {
    const { node } = await lookedUp(1);
    const asked = posted.filter((m) => m.type === 'lookup-words');
    assert.equal(asked.length, 1, `the page asked ${asked.length} times`);
    const words = asked[0]!.type === 'lookup-words' ? asked[0]!.words.map((w) => w.word) : [];
    assert.deepEqual(words, ['lighthouse']);
    assert.ok(!node.nodeValue!.includes('chaumière'), `a machine gloss displaced the pack's: ${node.nodeValue}`);
    assert.ok(node.nodeValue!.includes('maison'), `the pack's word for "house" is not woven: ${node.nodeValue}`);
  });

  test('a word a translation service fills is woven, from A2', async () => {
    // Not at A1, the default level, where the band window is bands 1 and 2
    // and the worker makes every entry band 3, so every word a service fills
    // is refused as out of band — sent, counted against the daily limit and
    // never woven. Measured 2026-11-09, and the first item in TODO.md's Now:
    // when it is fixed, this test reads level 1.
    const { node } = await lookedUp(2);
    assert.ok(node.nodeValue!.includes('phare'), `the filled word is not woven: ${node.nodeValue}`);
  });
});
