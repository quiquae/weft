import type {
  Candidate,
  LangCode,
  LexEntry,
  MemoryCard,
  PackMeta,
  Pos,
  Settings,
  Swap,
  Token,
} from './types.ts';
import { cardRetrievability, isRetirable } from './fsrs.ts';
import { cognateScore } from './similarity.ts';
import { looksLikeJunk, matchCase, sentenceWordCounts, wordTokens } from './tokenize.ts';
import { hashString, mulberry32 } from './rand.ts';

/**
 * Word selection: the part that decides whether this feels like a lesson or
 * like vandalism.
 *
 * The defining property of this module is that selection is **prefix-monotone
 * in the difficulty ratio**. Candidates are ranked once, deterministically, and
 * then accepted greedily in that fixed order until the budget is spent. Raising
 * the ratio only ever appends to the accepted set.
 *
 * That property is what makes attention-linked escalation bearable. If ranking
 * were re-randomised at each ratio, words you had just decoded would flip back
 * to English while new ones appeared, and the reader would never build on
 * anything. Instead, the page gets strictly denser around a stable core.
 */

/** Per-page cap on how often one lemma may be woven, before it is penalised. */
const DEFAULT_MAX_REPEATS = 3;

/**
 * Mixed into a node's seed for the draw that rounds its budget, so the draw
 * is a stream of its own and the tie-breaking jitter, drawn from the seed
 * itself, is the same as it was before the budget was dithered.
 */
const BUDGET_STREAM = 0x9e3779b9;

export interface SelectorInput {
  tokens: Token[];
  /** Surface-form lookup into the loaded pack. */
  lookup: (surface: string) => LexEntry[] | undefined;
  cards: Map<string, MemoryCard>;
  now: number;
  target: LangCode;
  /** Proportion of *eligible* words to weave, 0..1. */
  ratio: number;
  settings: Settings;
  /**
   * Level after progression, 1..6. A higher level moves the band window up,
   * as far as the pack's top band, and shifts preference towards less common
   * words.
   */
  effectiveLevel: number;
  /**
   * The highest band the loaded pack has, `topBandOf(pack.meta)`. The band
   * window slides down to end here rather than run past every band the pack
   * has. Required, so a caller cannot forget it.
   */
  topBand: number;
  /** Lemmas already introduced today, used for the daily new-word budget. */
  introducedToday: Set<string>;
  /** Occurrences of each lemma already woven on this page. */
  pageLemmaCounts: Map<string, number>;
  /** Seed for deterministic tie-breaking; normally hashed from the text. */
  seed?: number;
  /**
   * Swaps that must be kept, as `${start}:${lowercased original}` in this
   * text's own coordinates.
   *
   * Ranking is prefix-monotone for a FIXED set of inputs, which the unit
   * tests verify. At runtime the inputs drift: exposures and reveals change
   * every card's retrievability, so a word ranked third before a re-weave can
   * rank ninth after one and fall outside the budget. That showed up as a
   * word flipping back to English while the page got harder around it, which
   * is the one thing escalation must never do. Pinning makes the guarantee
   * explicit instead of hoping it falls out of the scoring.
   */
  pinned?: Set<string>;
  /** Set true to collect factor breakdowns for the debug panel. */
  explain?: boolean;
}

export interface SelectionResult {
  swaps: Swap[];
  /** Word tokens examined. */
  considered: number;
  /** Word tokens that had at least one usable dictionary entry. */
  eligible: number;
  /**
   * Budget the ratio produced: its share of the eligible words, rounded down
   * or up by a draw seeded from the text.
   */
  budget: number;
  /** Lemmas woven here that the learner has never met before. */
  newLemmas: string[];
  /** Retired words, woven for free and excluded from the budget. */
  retiredCount: number;
  /** Populated when `explain` is set. */
  explained?: Candidate[];
}

/* -------------------------------------------------------------- band window */

/**
 * Which difficulty bands a learner at `level` may be shown, from a pack whose
 * highest band is `topBand`.
 *
 * One band below the level (consolidation) and one above (stretch): Krashen's
 * i+1 in list form. Widening it further produces pages that mix A1 and C2
 * vocabulary, which reads as noise. At A1 there is no band below, so the
 * window is two bands.
 *
 * And it never runs past the pack's top band. Where it would, it slides down
 * to end there, still three bands wide, so a level above everything a pack
 * has meets the rarest words it has, put first by `idealZipf` and band fit,
 * rather than none. Every pack shipped tops out at band 4, and until
 * 2026-11-08 C2's window, bands 5 and 6, held no word of any pack, C1's 4
 * lemmas of 356 and B2's 23, and all three wove nothing on ordinary prose even
 * at the ceiling. It slides only downwards: sliding up at A1 would hand a
 * beginner words above their level, the failure that makes people uninstall,
 * where sliding down hands an advanced reader easier ones, which only
 * stretches them less.
 */
export function bandWindow(level: number, topBand: number): { min: number; max: number } {
  const l = Math.max(1, Math.min(6, Math.round(level)));
  const top = Math.max(1, Math.min(6, Math.round(topBand)));
  const max = Math.min(l + 1, top);
  return { min: Math.max(1, Math.min(l - 1, max - 2)), max };
}

/**
 * The highest band a pack has, which the band window may not run past. A pack
 * that names no band restricts nothing.
 */
export function topBandOf(meta: Pick<PackMeta, 'bands'>): number {
  if (!meta.bands.length) return 6;
  return Math.max(1, Math.min(6, Math.max(...meta.bands)));
}

/** Zipf frequency a learner at this level should mostly be meeting. */
export function idealZipf(level: number): number {
  const l = Math.max(1, Math.min(6, level));
  return 6.2 - ((l - 1) / 5) * 3;
}

/* ------------------------------------------------------------------ scoring */

export interface ScoreWeights {
  due: number;
  cognate: number;
  frequency: number;
  band: number;
  confidence: number;
  guessability: number;
  pos: number;
}

export function weightsFrom(settings: Settings): ScoreWeights {
  return {
    due: settings.learning.dueWeight,
    cognate: settings.learning.cognateWeight,
    frequency: settings.learning.frequencyWeight,
    band: 0.8,
    confidence: 1.0,
    guessability: 0.7,
    pos: 0.5,
  };
}

function posRank(pos: Pos, preference: Pos[]): number {
  const i = preference.indexOf(pos);
  if (i === -1) return 0.15;
  return 1 - i / Math.max(1, preference.length);
}

/**
 * Composite desirability of weaving this entry here, right now.
 *
 * Multiplicative gates (confidence, ambiguity) rather than additive terms,
 * because a low-confidence mapping should not be rescuable by being a cognate:
 * a wrong translation teaches a wrong word, which is worse than teaching
 * nothing.
 */
export function scoreCandidate(
  entry: LexEntry,
  token: Token,
  card: MemoryCard | undefined,
  input: SelectorInput,
  sentenceWords: number,
  repeats: number,
): { score: number; factors: Record<string, number> } {
  const w = weightsFrom(input.settings);
  const level = input.effectiveLevel;

  // Urgency: an unseen word scores 1, a freshly-reviewed word ~0.
  const r = cardRetrievability(card, input.now);
  const due = card ? 1 - r : 1;

  const cognate = cognateScore(entry);

  const ideal = idealZipf(level);
  const frequency = Math.max(0, 1 - Math.abs(entry.zipf - ideal) / 3.2);

  const bandFit = Math.max(0, 1 - Math.abs(entry.band - level) / 3);

  // Longer sentences carry more context, so a swap inside one is easier to
  // decode from surroundings. Saturates at 12 words.
  const guessability = Math.min(1, sentenceWords / 12);

  const pos = posRank(entry.pos, input.settings.learning.posPreference);

  // Ambiguity is a gate: "light" with eight senses is a bad swap even if
  // everything else about it is ideal.
  const ambiguityGate = 1 / (1 + Math.log2(1 + Math.max(0, entry.senses - 1)));

  // Repetition is good for learning up to a point, then it is wallpaper.
  const repeatGate = repeats < DEFAULT_MAX_REPEATS ? 1 : 0.15 / (1 + repeats - DEFAULT_MAX_REPEATS);

  // Sentence-initial words carry grammatical weight and lose their capital
  // cue when swapped; discourage slightly rather than forbid.
  const positionGate = token.capitalized && sentenceWords > 3 ? 0.85 : 1;

  const additive =
    w.due * due +
    w.cognate * cognate +
    w.frequency * frequency +
    w.band * bandFit +
    w.guessability * guessability +
    w.pos * pos;

  const totalWeight = w.due + w.cognate + w.frequency + w.band + w.guessability + w.pos;
  const normalized = totalWeight > 0 ? additive / totalWeight : 0;

  const score = normalized * entry.conf * ambiguityGate * repeatGate * positionGate;

  const factors: Record<string, number> = input.explain
    ? {
        due,
        cognate,
        frequency,
        bandFit,
        guessability,
        pos,
        confidence: entry.conf,
        ambiguityGate,
        repeatGate,
        positionGate,
        score,
      }
    : {};

  return { score, factors };
}

/* --------------------------------------------------------------- filtering */

export interface FilterReason {
  ok: boolean;
  why?: string;
}

export function entryAllowed(entry: LexEntry, input: SelectorInput): FilterReason {
  const s = input.settings.learning;
  if (entry.conf < s.minConfidence) return { ok: false, why: 'confidence' };
  if (entry.senses > s.maxSenses) return { ok: false, why: 'ambiguous' };
  if (entry.pos === 'phrase' && !s.phrasesEnabled) return { ok: false, why: 'phrases-off' };

  const { min, max } = bandWindow(input.effectiveLevel, input.topBand);
  if (entry.band < min || entry.band > max) return { ok: false, why: 'band' };

  // Function words are excluded unless the learner explicitly asked for them:
  // swapping "the" and "of" wrecks readability for almost no vocabulary gain.
  if (!s.posPreference.includes(entry.pos)) return { ok: false, why: 'pos' };

  if (!entry.tgt || entry.tgt === entry.src) return { ok: false, why: 'identity' };
  return { ok: true };
}

/* --------------------------------------------------------------- selection */

/** A candidate after scoring, with the bookkeeping the accept pass needs. */
type ScoredCandidate = Candidate & { window: Window; retired: boolean; jitter: number };

interface Window {
  /** Index into the word-token array. */
  wordIndex: number;
  /** Index into the full token array of the first token. */
  tokenIndex: number;
  start: number;
  end: number;
  text: string;
  /** How many word tokens this window spans (1 for a single word). */
  span: number;
  sentence: number;
}

/**
 * Build match windows, longest first, so "as well as" beats "well".
 * Only runs multi-word matching when phrases are enabled, because the window
 * scan is the most expensive part of selection on a long page.
 */
function buildWindows(input: SelectorInput): Window[] {
  const words = wordTokens(input.tokens);
  const out: Window[] = [];
  const maxSpan = input.settings.learning.phrasesEnabled ? 3 : 1;
  const consumed = new Set<number>();

  for (let span = maxSpan; span >= 1; span--) {
    for (let i = 0; i + span <= words.length; i++) {
      if (consumed.has(i)) continue;
      const first = words[i] as { token: Token; index: number };
      const last = words[i + span - 1] as { token: Token; index: number };
      if (first.token.sentence !== last.token.sentence) continue;

      let blocked = false;
      for (let k = 0; k < span; k++) if (consumed.has(i + k)) blocked = true;
      if (blocked) continue;

      const text =
        span === 1
          ? first.token.text
          : words
              .slice(i, i + span)
              .map((x) => x.token.text)
              .join(' ');

      if (!input.lookup(text.toLowerCase())) continue;

      for (let k = 0; k < span; k++) consumed.add(i + k);
      out.push({
        wordIndex: i,
        tokenIndex: first.index,
        start: first.token.start,
        end: last.token.end,
        text,
        span,
        sentence: first.token.sentence,
      });
    }
  }

  out.sort((a, b) => a.start - b.start);
  return out;
}

export function selectSwaps(input: SelectorInput): SelectionResult {
  const { tokens, settings } = input;
  const words = wordTokens(tokens);
  const sentenceCounts = sentenceWordCounts(tokens);
  const seed = input.seed ?? hashString(tokens.map((t) => t.text).join(''));
  const rng = mulberry32(seed);

  const candidates: ScoredCandidate[] = [];
  let eligible = 0;

  for (const win of buildWindows(input)) {
    const token = tokens[win.tokenIndex] as Token;
    if (win.span === 1 && looksLikeJunk(token, tokens, win.tokenIndex)) continue;

    const sentenceWords = sentenceCounts[win.sentence] ?? 0;
    if (sentenceWords < settings.weave.protectShortSentences) continue;

    const entries = input.lookup(win.text.toLowerCase());
    if (!entries || !entries.length) continue;

    let best: { entry: LexEntry; score: number; factors: Record<string, number> } | null = null;
    let anyAllowed = false;

    for (const entry of entries) {
      const allowed = entryAllowed(entry, input);
      const card = input.cards.get(`${input.target}:${entry.tgtLemma}`);
      const retired = isRetirable(card, settings.learning.retireStabilityDays, input.now);

      // Retired words bypass the band window: you know them, so they are not
      // difficulty, they are reward.
      if (!allowed.ok && !retired) continue;
      anyAllowed = true;

      const repeats = input.pageLemmaCounts.get(entry.tgtLemma) ?? 0;
      const { score, factors } = scoreCandidate(
        entry,
        token,
        card,
        input,
        sentenceWords,
        repeats,
      );
      if (!best || score > best.score) best = { entry, score, factors };
    }

    if (!anyAllowed || !best) continue;
    eligible++;

    const card = input.cards.get(`${input.target}:${best.entry.tgtLemma}`);
    candidates.push({
      token,
      entry: best.entry,
      card,
      score: best.score,
      factors: best.factors,
      window: win,
      retired: isRetirable(card, settings.learning.retireStabilityDays, input.now),
      jitter: rng(),
    });
  }

  // Deterministic total order. Score first; jitter (seeded, so stable) breaks
  // ties without letting document order bias everything to the top of a page.
  candidates.sort((a: ScoredCandidate, b: ScoredCandidate) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.jitter !== b.jitter) return a.jitter - b.jitter;
    return a.window.start - b.window.start;
  });

  // The ratio's share of the eligible words, rounded down or up by a draw
  // seeded from this text. The content script selects one text node at a
  // time, so a page's density is the sum of its nodes' budgets, and rounded
  // to the nearest a node needed half a word of share before it wove one: at
  // the default 6%, nine eligible words, so a page of short paragraphs wove
  // almost nothing, and above the half-word mark every node rounded up at
  // once. Rounded up with a probability equal to the fraction, a node weaves
  // its share on average and a page of them weaves the page's. The draw is
  // the text's own, so a paragraph weaves the same way however often a
  // framework re-renders it, whatever the nodes around it, and a fixed draw
  // under a rising ratio only ever rounds up later, never down: the budget
  // never falls as the ratio rises, which the pinning below relies on.
  const roundUp = mulberry32((seed ^ BUDGET_STREAM) >>> 0)();
  const budget = Math.max(0, Math.floor(input.ratio * eligible + roundUp));
  const swaps: Swap[] = [];
  const newLemmas: string[] = [];
  const perSentence = new Map<number, number>();
  const takenWordIndices = new Set<number>();
  let accepted = 0;
  let retiredCount = 0;
  let newBudget = Math.max(
    0,
    settings.learning.introduceNewPerDay - input.introducedToday.size,
  );

  /** Try to take a candidate, enforcing the hard layout constraints. */
  const tryAccept = (cand: ScoredCandidate, ignoreBudget: boolean): boolean => {
    const isFree = cand.retired && settings.learning.retireKnownWords;
    if (!isFree && !ignoreBudget && accepted >= budget) return false;

    const win = cand.window;

    // Minimum gap, measured in word tokens, so two swaps never touch. An
    // already-accepted window fails this against itself, which is how the
    // second pass skips what the first pass took.
    const gap = Math.max(1, settings.weave.minWordGap);
    for (let k = win.wordIndex - gap; k < win.wordIndex + win.span + gap; k++) {
      if (takenWordIndices.has(k)) return false;
    }

    const inSentence = perSentence.get(win.sentence) ?? 0;
    if (inSentence >= settings.weave.maxPerSentence) return false;

    const isNew = !cand.card || cand.card.reps === 0;
    if (isNew && !input.introducedToday.has(cand.entry.tgtLemma)) {
      if (newBudget <= 0 && !ignoreBudget) return false;
      if (newBudget > 0) newBudget--;
      newLemmas.push(cand.entry.tgtLemma);
    }

    swaps.push({
      tokenIndex: win.tokenIndex,
      start: win.start,
      end: win.end,
      original: win.text,
      replacement: matchCase(cand.entry.tgt, win.text),
      entry: cand.entry,
      retired: isFree,
      ...(input.explain ? { factors: cand.factors } : {}),
      firstMeeting: !cand.card || cand.card.reps === 0,
    });

    for (let k = win.wordIndex; k < win.wordIndex + win.span; k++) takenWordIndices.add(k);
    perSentence.set(win.sentence, inSentence + 1);
    if (isFree) retiredCount++;
    else accepted++;
    return true;
  };

  // Pinned words first, outside the budget: whatever the reader can already
  // see stays where it is.
  if (input.pinned?.size) {
    const pinned = input.pinned;
    for (const cand of candidates) {
      if (!pinned.has(`${cand.window.start}:${cand.window.text.toLowerCase()}`)) continue;
      tryAccept(cand, true);
    }
  }

  for (const cand of candidates) tryAccept(cand, false);

  swaps.sort((a, b) => a.start - b.start);

  const result: SelectionResult = {
    swaps,
    considered: words.length,
    eligible,
    budget,
    newLemmas,
    retiredCount,
  };
  if (input.explain) result.explained = candidates.slice(0, 60);
  return result;
}

/**
 * Effective level, given self-reported level plus demonstrated progress.
 *
 * Retiring 200 words is roughly the point at which a learner's tolerance for
 * the next band up has measurably moved, so progression is one band per 200
 * retired words rather than anything cleverer. Deliberately slow: levelling a
 * user up too fast is indistinguishable from breaking the product.
 */
export function effectiveLevel(baseLevel: number, retiredCount: number): number {
  return Math.min(6, Math.max(1, baseLevel + Math.floor(retiredCount / 200)));
}
