import type {
  Candidate,
  LangCode,
  LexEntry,
  MemoryCard,
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
   * Level after progression, 1..6. Higher levels widen the band window and
   * shift preference towards less common words.
   */
  effectiveLevel: number;
  /** Lemmas already introduced today, used for the daily new-word budget. */
  introducedToday: Set<string>;
  /** Occurrences of each lemma already woven on this page. */
  pageLemmaCounts: Map<string, number>;
  /** Seed for deterministic tie-breaking; normally hashed from the text. */
  seed?: number;
  /** Set true to collect factor breakdowns for the debug panel. */
  explain?: boolean;
}

export interface SelectionResult {
  swaps: Swap[];
  /** Word tokens examined. */
  considered: number;
  /** Word tokens that had at least one usable dictionary entry. */
  eligible: number;
  /** Budget the ratio produced. */
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
 * Which difficulty bands a learner at `level` may be shown.
 *
 * The window is asymmetric on purpose: one band below (consolidation) and one
 * above (stretch). Krashen's i+1 in list form. Widening it further produces
 * pages that mix A1 and C2 vocabulary, which reads as noise.
 */
export function bandWindow(level: number): { min: number; max: number } {
  const l = Math.max(1, Math.min(6, Math.round(level)));
  return { min: Math.max(1, l - 1), max: Math.min(6, l + 1) };
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

  // Ambiguity is a gate: "light" with nine senses is a bad swap even if
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

  const { min, max } = bandWindow(input.effectiveLevel);
  if (entry.band < min || entry.band > max) return { ok: false, why: 'band' };

  // Function words are excluded unless the learner explicitly asked for them:
  // swapping "the" and "of" wrecks readability for almost no vocabulary gain.
  if (!s.posPreference.includes(entry.pos)) return { ok: false, why: 'pos' };

  if (!entry.tgt || entry.tgt === entry.src) return { ok: false, why: 'identity' };
  return { ok: true };
}

/* --------------------------------------------------------------- selection */

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
  const rng = mulberry32(input.seed ?? hashString(tokens.map((t) => t.text).join('')));

  const candidates: Array<Candidate & { window: Window; retired: boolean; jitter: number }> = [];
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
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.jitter !== b.jitter) return a.jitter - b.jitter;
    return a.window.start - b.window.start;
  });

  const budget = Math.max(0, Math.round(input.ratio * eligible));
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

  for (const cand of candidates) {
    const isFree = cand.retired && settings.learning.retireKnownWords;
    if (!isFree && accepted >= budget) continue;

    const win = cand.window;

    // Minimum gap, measured in word tokens, so two swaps never touch.
    let tooClose = false;
    const gap = Math.max(1, settings.weave.minWordGap);
    for (let k = win.wordIndex - gap; k < win.wordIndex + win.span + gap; k++) {
      if (takenWordIndices.has(k)) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const inSentence = perSentence.get(win.sentence) ?? 0;
    if (inSentence >= settings.weave.maxPerSentence) continue;

    const isNew = !cand.card || cand.card.reps === 0;
    if (isNew && !input.introducedToday.has(cand.entry.tgtLemma)) {
      if (newBudget <= 0) continue;
      newBudget--;
      newLemmas.push(cand.entry.tgtLemma);
    }

    const replacement = matchCase(cand.entry.tgt, win.text);
    swaps.push({
      tokenIndex: win.tokenIndex,
      start: win.start,
      end: win.end,
      original: win.text,
      replacement,
      entry: cand.entry,
    });

    for (let k = win.wordIndex; k < win.wordIndex + win.span; k++) takenWordIndices.add(k);
    perSentence.set(win.sentence, inSentence + 1);
    if (isFree) retiredCount++;
    else accepted++;
  }

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
