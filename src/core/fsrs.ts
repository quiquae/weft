import type { Grade, MemoryCard } from './types.ts';

/**
 * FSRS-6, implemented directly.
 *
 * Ported from the reference implementation at
 * https://github.com/open-spaced-repetition/ts-fsrs (MIT) so that Weft carries
 * no runtime dependency in the content script, where every kilobyte is paid on
 * every page load. The formulas and default weights are the reference ones;
 * see docs/PEDAGOGY.md for why a real memory model matters here.
 *
 * Why FSRS at all, when Weft never asks you to sit a review session? Because
 * the question "which words should be in the target language right now?" is
 * exactly the question a scheduler answers. A word whose retrievability has
 * decayed to ~0.7 is the word that most benefits from being seen again; a word
 * whose stability has passed the retirement threshold can be left in L2
 * permanently. The page becomes the review session.
 */

/** Reference FSRS-6 default weights (21 parameters). */
export const DEFAULT_W: readonly number[] = Object.freeze([
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835,
  0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
]);

const S_MIN = 0.001;
const S_MAX = 36500;
const INIT_S_MAX = 100;
const DAY_MS = 86_400_000;

/** Per-parameter clamp ranges, mirroring the reference implementation. */
const CLAMPS: ReadonlyArray<readonly [number, number]> = Object.freeze([
  [S_MIN, INIT_S_MAX],
  [S_MIN, INIT_S_MAX],
  [S_MIN, INIT_S_MAX],
  [S_MIN, INIT_S_MAX],
  [1.0, 10.0],
  [0.001, 4.0],
  [0.001, 4.0],
  [0.001, 0.75],
  [0.0, 4.5],
  [0.0, 0.8],
  [0.001, 3.5],
  [0.001, 5.0],
  [0.001, 0.25],
  [0.001, 0.9],
  [0.0, 4.0],
  [0.0, 1.0],
  [1.0, 6.0],
  [0.0, 2.0],
  [0.0, 2.0],
  [0.01, 0.8],
  [0.1, 0.8],
]);

export const clamp = (n: number, lo: number, hi: number): number =>
  n < lo ? lo : n > hi ? hi : n;

const at = (w: readonly number[], i: number): number => w[i] ?? (DEFAULT_W[i] as number);

/** Clip user-supplied or optimiser-supplied weights into valid ranges. */
export function clipWeights(w: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < CLAMPS.length; i++) {
    const range = CLAMPS[i] as readonly [number, number];
    out.push(clamp(at(w, i), range[0], range[1]));
  }
  return out;
}

export interface DecayFactor {
  decay: number;
  factor: number;
}

/**
 * decay = -w20, factor = exp(ln(0.9) / decay) - 1.
 * Chosen so that R(S, S) is exactly 0.9 — i.e. stability is by definition the
 * interval at which recall probability has fallen to 90%.
 */
export function decayFactor(w: readonly number[] = DEFAULT_W): DecayFactor {
  const decay = -at(w, 20);
  const factor = Math.exp(Math.log(0.9) / decay) - 1;
  return { decay, factor };
}

/** R(t, S) = (1 + factor · t/S)^decay. `elapsedDays` may be fractional. */
export function retrievability(
  elapsedDays: number,
  stability: number,
  w: readonly number[] = DEFAULT_W,
): number {
  if (stability <= 0) return 0;
  const t = Math.max(0, elapsedDays);
  const { decay, factor } = decayFactor(w);
  return clamp(Math.pow(1 + (factor * t) / stability, decay), 0, 1);
}

/** Days until retrievability falls to `target`. The classic FSRS interval. */
export function intervalForRetention(
  stability: number,
  target = 0.9,
  w: readonly number[] = DEFAULT_W,
): number {
  const { decay, factor } = decayFactor(w);
  return (stability / factor) * (Math.pow(target, 1 / decay) - 1);
}

export function initialStability(g: Grade, w: readonly number[] = DEFAULT_W): number {
  return Math.max(at(w, g - 1), 0.1);
}

export function initialDifficulty(g: Grade, w: readonly number[] = DEFAULT_W): number {
  return clamp(at(w, 4) - Math.exp((g - 1) * at(w, 5)) + 1, 1, 10);
}

function linearDamping(deltaD: number, oldD: number): number {
  return (deltaD * (10 - oldD)) / 9;
}

function meanReversion(init: number, current: number, w: readonly number[]): number {
  return at(w, 7) * init + (1 - at(w, 7)) * current;
}

export function nextDifficulty(d: number, g: Grade, w: readonly number[] = DEFAULT_W): number {
  const deltaD = -at(w, 6) * (g - 3);
  const nextD = d + linearDamping(deltaD, d);
  return clamp(meanReversion(initialDifficulty(4, w), nextD, w), 1, 10);
}

export function nextRecallStability(
  d: number,
  s: number,
  r: number,
  g: Grade,
  w: readonly number[] = DEFAULT_W,
): number {
  const hardPenalty = g === 2 ? at(w, 15) : 1;
  const easyBonus = g === 4 ? at(w, 16) : 1;
  const grown =
    s *
    (1 +
      Math.exp(at(w, 8)) *
        (11 - d) *
        Math.pow(s, -at(w, 9)) *
        (Math.exp((1 - r) * at(w, 10)) - 1) *
        hardPenalty *
        easyBonus);
  return clamp(grown, S_MIN, S_MAX);
}

export function nextForgetStability(
  d: number,
  s: number,
  r: number,
  w: readonly number[] = DEFAULT_W,
): number {
  const decayed =
    at(w, 11) *
    Math.pow(d, -at(w, 12)) *
    (Math.pow(s + 1, at(w, 13)) - 1) *
    Math.exp((1 - r) * at(w, 14));
  return clamp(decayed, S_MIN, S_MAX);
}

export function nextShortTermStability(
  s: number,
  g: Grade,
  w: readonly number[] = DEFAULT_W,
): number {
  const sinc = Math.pow(s, -at(w, 19)) * Math.exp(at(w, 17) * (g - 3 + at(w, 18)));
  const masked = g >= 2 ? Math.max(sinc, 1) : sinc;
  return clamp(s * masked, S_MIN, S_MAX);
}

export interface MemoryState {
  stability: number;
  difficulty: number;
}

/**
 * Advance a memory state by one graded review.
 *
 * `elapsedDays === 0` takes the short-term branch, which is the normal case in
 * Weft: a learner may meet the same word twice while reading one thread, and
 * the short-term formula is what stops that from inflating stability.
 */
export function nextState(
  prev: MemoryState | null,
  elapsedDays: number,
  g: Grade,
  w: readonly number[] = DEFAULT_W,
  enableShortTerm = true,
): MemoryState {
  if (elapsedDays < 0) throw new RangeError(`elapsedDays must be >= 0, got ${elapsedDays}`);
  if (g < 1 || g > 4) throw new RangeError(`grade must be 1..4, got ${g}`);

  if (!prev || (prev.stability === 0 && prev.difficulty === 0)) {
    return {
      stability: initialStability(g, w),
      difficulty: initialDifficulty(g, w),
    };
  }

  const { stability: s, difficulty: d } = prev;
  const r = retrievability(elapsedDays, s, w);

  let newS: number;
  if (elapsedDays === 0 && enableShortTerm) {
    newS = nextShortTermStability(s, g, w);
  } else if (g === 1) {
    const afterFail = nextForgetStability(d, s, r, w);
    const w17 = enableShortTerm ? at(w, 17) : 0;
    const w18 = enableShortTerm ? at(w, 18) : 0;
    const floor = s / Math.exp(w17 * w18);
    newS = clamp(floor, S_MIN, afterFail);
  } else {
    newS = nextRecallStability(d, s, r, g, w);
  }

  return { stability: newS, difficulty: nextDifficulty(d, g, w) };
}

/* ------------------------------------------------------------ card helpers */

export function cardId(target: string, lemma: string): string {
  return `${target}:${lemma}`;
}

export function newCard(target: string, lemma: string, now: number): MemoryCard {
  return {
    id: cardId(target, lemma),
    target,
    lemma,
    stability: 0,
    difficulty: 0,
    lastReview: 0,
    reps: 0,
    lapses: 0,
    exposures: 0,
    firstSeen: now,
  };
}

/** Current retrievability of a card. Unseen cards return 0 (maximum urgency). */
export function cardRetrievability(
  card: MemoryCard | undefined,
  now: number,
  w: readonly number[] = DEFAULT_W,
): number {
  if (!card || card.reps === 0 || card.stability <= 0) return 0;
  const elapsedDays = Math.max(0, (now - card.lastReview) / DAY_MS);
  return retrievability(elapsedDays, card.stability, w);
}

/** Apply a graded review to a card, returning a new card object. */
export function reviewCard(
  card: MemoryCard,
  g: Grade,
  now: number,
  w: readonly number[] = DEFAULT_W,
): MemoryCard {
  const elapsedDays = card.reps === 0 ? 0 : Math.max(0, (now - card.lastReview) / DAY_MS);
  const prev: MemoryState | null =
    card.reps === 0 ? null : { stability: card.stability, difficulty: card.difficulty };
  const next = nextState(prev, elapsedDays, g, w);
  return {
    ...card,
    stability: next.stability,
    difficulty: next.difficulty,
    lastReview: now,
    reps: card.reps + 1,
    lapses: card.lapses + (g === 1 ? 1 : 0),
  };
}

/**
 * True when a word has been internalised well enough to leave in the target
 * language permanently. Deliberately conservative: retiring a word too early
 * makes the page harder than the learner's level, which is the one failure
 * mode that makes people uninstall.
 */
export function isRetirable(
  card: MemoryCard | undefined,
  stabilityDays: number,
  now: number,
  w: readonly number[] = DEFAULT_W,
): boolean {
  if (!card) return false;
  if (card.retiredAt) return true;
  if (card.reps < 3) return false;
  if (card.stability < stabilityDays) return false;
  // Must also be currently well-remembered, not merely once-stable.
  return cardRetrievability(card, now, w) >= 0.85;
}

/** Days from `now` until this card next wants to be seen, for the dashboard. */
export function daysUntilDue(
  card: MemoryCard | undefined,
  now: number,
  target = 0.9,
  w: readonly number[] = DEFAULT_W,
): number {
  if (!card || card.reps === 0) return 0;
  const ivl = intervalForRetention(card.stability, target, w);
  const elapsed = card.lastReview ? (now - card.lastReview) / DAY_MS : 0;
  return Math.max(0, ivl - elapsed);
}

/**
 * Merge two records of the same word.
 *
 * Needed by import, and it has to be exactly right, because the failure mode
 * is silently resetting a word someone has learned.
 *
 * The obvious version is wrong, and was shipped:
 *
 *     if (!current || card.reps > current.reps || card.exposures > current.exposures)
 *       merged[id] = card;
 *
 * That replaces the *whole* record when *either* counter is higher, under a
 * comment promising it "never loses progress in either direction". Give it
 * an existing card at reps 10 / exposures 5 and an incoming one at reps 1 /
 * exposures 50, and the incoming record wins on exposures and drops nine
 * reviews, a mature stability and the retirement flag with it. Exposures
 * count page sightings and grow much faster than reviews, so the *less*
 * studied copy is the one that usually wins that comparison.
 *
 * The fix is not to take field-wise maxima either. Stability, difficulty,
 * lastReview, reps and lapses are one coherent FSRS state; a card with one
 * machine's stability and another's review count describes a history that
 * never happened, and the scheduler would then act on it.
 *
 * So: the review state moves as a unit, from whichever copy has genuinely
 * reviewed more. The counters that are only ever monotone — exposures, and
 * first-seen as a minimum — are merged independently, because those really
 * are additive facts about the same word.
 */
export function mergeCards(a: MemoryCard, b: MemoryCard): MemoryCard {
  /**
   * Which copy has the more advanced review history.
   *
   * `reps` first, then the more recent review as a tie-break: two copies at
   * the same rep count differ only in when they were last seen, and the
   * later one is the one whose stability the scheduler should trust.
   */
  const primary =
    b.reps > a.reps || (b.reps === a.reps && b.lastReview > a.lastReview) ? b : a;
  const other = primary === a ? b : a;

  return {
    ...primary,
    // Sightings are additive facts, not review state. Max rather than sum:
    // the same word read on two machines is not twice as familiar, and
    // summing would let a round-trip through export inflate it.
    exposures: Math.max(a.exposures, b.exposures),
    // The earliest meeting is the true one.
    firstSeen: Math.min(a.firstSeen || b.firstSeen, b.firstSeen || a.firstSeen),
    // Retirement is a promise to stop teaching the word. If either copy
    // earned it, honour it, and date it from whichever happened first.
    ...(a.retiredAt || b.retiredAt
      ? { retiredAt: Math.min(a.retiredAt ?? Infinity, b.retiredAt ?? Infinity) }
      : {}),
    // Lapses are a count of failures; losing them would make a difficult
    // word look easy. Keep the higher.
    lapses: Math.max(a.lapses, b.lapses),
    // Guard against a hand-edited or older export missing the field.
    id: primary.id || other.id,
  };
}
