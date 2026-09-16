import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_W,
  decayFactor,
  retrievability,
  intervalForRetention,
  initialStability,
  initialDifficulty,
  nextState,
  nextDifficulty,
  cardRetrievability,
  reviewCard,
  isRetirable,
  newCard,
  clipWeights,
  daysUntilDue,
  mergeCards,
} from '../../src/core/fsrs.ts';
import { card, NOW } from '../helpers.ts';
import type { MemoryCard } from '../../src/core/types.ts';

const DAY = 86_400_000;

describe('decay and factor', () => {
  test('are derived so that R(S, S) is exactly 0.9', () => {
    // This is the definition of stability. If it drifts, every interval is wrong.
    for (const s of [0.5, 1, 7, 40, 365]) {
      const r = retrievability(s, s);
      assert.ok(Math.abs(r - 0.9) < 1e-9, `R(${s},${s}) = ${r}`);
    }
  });

  test('match the reference derivation', () => {
    const { decay, factor } = decayFactor();
    assert.ok(Math.abs(decay - -0.1542) < 1e-12);
    assert.ok(Math.abs(factor - (Math.exp(Math.log(0.9) / -0.1542) - 1)) < 1e-12);
  });
});

describe('retrievability', () => {
  test('is 1 at t=0 and decreases monotonically', () => {
    assert.equal(retrievability(0, 10), 1);
    let prev = 1.1;
    for (let t = 0; t <= 400; t += 1) {
      const r = retrievability(t, 10);
      assert.ok(r <= prev, `rose at t=${t}`);
      assert.ok(r >= 0 && r <= 1);
      prev = r;
    }
  });

  test('higher stability means slower forgetting', () => {
    assert.ok(retrievability(30, 100) > retrievability(30, 10));
  });

  test('returns 0 for non-positive stability', () => {
    assert.equal(retrievability(5, 0), 0);
    assert.equal(retrievability(5, -3), 0);
  });
});

describe('intervalForRetention', () => {
  test('returns the stability itself at 0.9', () => {
    assert.ok(Math.abs(intervalForRetention(17, 0.9) - 17) < 1e-9);
  });

  test('a higher desired retention means a shorter interval', () => {
    assert.ok(intervalForRetention(17, 0.95) < intervalForRetention(17, 0.85));
  });
});

describe('initial state', () => {
  test('initial stability is w[g-1]', () => {
    for (const g of [1, 2, 3, 4] as const) {
      assert.equal(initialStability(g), Math.max(DEFAULT_W[g - 1] as number, 0.1));
    }
  });

  test('easier grades give higher initial stability', () => {
    assert.ok(initialStability(4) > initialStability(3));
    assert.ok(initialStability(3) > initialStability(2));
    assert.ok(initialStability(2) > initialStability(1));
  });

  test('initial difficulty falls as the grade rises, and stays in 1..10', () => {
    const ds = ([1, 2, 3, 4] as const).map((g) => initialDifficulty(g));
    for (const d of ds) assert.ok(d >= 1 && d <= 10, `${d} out of range`);
    for (let i = 1; i < ds.length; i++) {
      assert.ok((ds[i] as number) < (ds[i - 1] as number), 'difficulty should fall');
    }
  });
});

describe('nextState', () => {
  test('a null previous state produces the initial state', () => {
    const s = nextState(null, 0, 3);
    assert.equal(s.stability, initialStability(3));
    assert.equal(s.difficulty, initialDifficulty(3));
  });

  test('a lapse reduces stability', () => {
    const first = nextState(null, 0, 3);
    const lapsed = nextState(first, 10, 1);
    assert.ok(lapsed.stability < first.stability, `${lapsed.stability} !< ${first.stability}`);
  });

  test('a successful recall increases stability', () => {
    const first = nextState(null, 0, 3);
    const later = nextState(first, 3, 3);
    assert.ok(later.stability > first.stability);
  });

  test('easy grows stability more than good, which beats hard', () => {
    const base = { stability: 10, difficulty: 5 };
    const hard = nextState(base, 10, 2).stability;
    const good = nextState(base, 10, 3).stability;
    const easy = nextState(base, 10, 4).stability;
    assert.ok(hard < good && good < easy, `${hard} ${good} ${easy}`);
  });

  test('same-day review takes the short-term branch', () => {
    const base = { stability: 10, difficulty: 5 };
    const sameDay = nextState(base, 0, 3).stability;
    const nextDay = nextState(base, 1, 3).stability;
    assert.notEqual(sameDay, nextDay);
    assert.ok(sameDay >= 10, 'short-term good should not shrink stability');
  });

  test('difficulty rises on lapse and falls on easy', () => {
    assert.ok(nextDifficulty(5, 1) > 5);
    assert.ok(nextDifficulty(5, 4) < 5);
    assert.ok(nextDifficulty(1, 1) <= 10);
    assert.ok(nextDifficulty(10, 4) >= 1);
  });

  test('rejects impossible inputs rather than producing nonsense', () => {
    assert.throws(() => nextState({ stability: 5, difficulty: 5 }, -1, 3), RangeError);
    assert.throws(() => nextState({ stability: 5, difficulty: 5 }, 1, 0 as 1), RangeError);
    assert.throws(() => nextState({ stability: 5, difficulty: 5 }, 1, 9 as 1), RangeError);
  });

  test('stability stays inside bounds under long random walks', () => {
    let s = nextState(null, 0, 3);
    for (let i = 0; i < 500; i++) {
      const g = ((i * 7919) % 4 + 1) as 1 | 2 | 3 | 4;
      s = nextState(s, (i % 30) + 1, g);
      assert.ok(Number.isFinite(s.stability) && s.stability > 0, `bad stability at ${i}`);
      assert.ok(s.difficulty >= 1 && s.difficulty <= 10, `bad difficulty at ${i}`);
      assert.ok(s.stability <= 36500);
    }
  });
});

describe('clipWeights', () => {
  test('clamps out-of-range weights and fills missing ones', () => {
    const clipped = clipWeights([999, -5]);
    assert.equal(clipped.length, 21);
    assert.ok((clipped[0] as number) <= 100);
    assert.ok((clipped[1] as number) >= 0.001);
    assert.equal(clipped[20], DEFAULT_W[20]);
  });
});

describe('card helpers', () => {
  test('an unseen card has retrievability 0 so it is maximally urgent', () => {
    assert.equal(cardRetrievability(undefined, NOW), 0);
    assert.equal(cardRetrievability(newCard('fr', 'chat', NOW), NOW), 0);
  });

  test('reviewCard advances reps and records lapses', () => {
    let c = newCard('fr', 'chat', NOW);
    c = reviewCard(c, 3, NOW);
    assert.equal(c.reps, 1);
    assert.equal(c.lapses, 0);
    assert.ok(c.stability > 0);
    c = reviewCard(c, 1, NOW + 5 * DAY);
    assert.equal(c.reps, 2);
    assert.equal(c.lapses, 1);
  });

  test('retrievability decays between reviews', () => {
    let c = newCard('fr', 'chat', NOW);
    c = reviewCard(c, 3, NOW);
    const r0 = cardRetrievability(c, NOW);
    const r1 = cardRetrievability(c, NOW + 10 * DAY);
    assert.ok(r0 > r1, `${r0} !> ${r1}`);
  });
});

describe('isRetirable', () => {
  test('refuses cards with too few reps, however stable', () => {
    assert.equal(isRetirable(card({ reps: 2, stability: 500, lastReview: NOW }), 21, NOW), false);
  });

  test('refuses cards below the stability threshold', () => {
    assert.equal(isRetirable(card({ reps: 9, stability: 10, lastReview: NOW }), 21, NOW), false);
  });

  test('refuses once-stable cards that are no longer well remembered', () => {
    const stale = card({ reps: 9, stability: 25, lastReview: NOW - 400 * DAY });
    assert.equal(isRetirable(stale, 21, NOW), false, 'must be currently recalled, not merely once-stable');
  });

  test('accepts a stable, recently recalled card', () => {
    const good = card({ reps: 9, stability: 60, lastReview: NOW - 2 * DAY });
    assert.equal(isRetirable(good, 21, NOW), true);
  });

  test('honours an explicit retiredAt', () => {
    assert.equal(isRetirable(card({ retiredAt: NOW }), 21, NOW), true);
  });

  test('undefined is never retirable', () => {
    assert.equal(isRetirable(undefined, 21, NOW), false);
  });
});

describe('daysUntilDue', () => {
  test('is 0 for an unseen card', () => {
    assert.equal(daysUntilDue(newCard('fr', 'x', NOW)), 0);
    assert.equal(daysUntilDue(undefined), 0);
  });

  test('is positive for a freshly reviewed stable card', () => {
    const c = card({ reps: 3, stability: 30, lastReview: Date.now() });
    assert.ok(daysUntilDue(c) > 20);
  });
});

describe('mergeCards', () => {
  /*
   * The bug this replaces lost real learning. Import merged two copies of a
   * word with
   *
   *     card.reps > current.reps || card.exposures > current.exposures
   *
   * and replaced the whole record when either was higher, under a comment
   * claiming it never lost progress in either direction.
   */
  const base = (over: Partial<MemoryCard> = {}): MemoryCard => ({
    id: 'fr:maison',
    target: 'fr',
    lemma: 'house',
    stability: 1,
    difficulty: 5,
    lastReview: 0,
    reps: 0,
    lapses: 0,
    exposures: 0,
    firstSeen: NOW,
    ...over,
  });

  test('a high exposure count cannot overwrite a real review history', () => {
    // The exact shape of the old bug. Exposures count page sightings and
    // grow far faster than reviews, so the barely-studied copy wins that
    // comparison routinely — this is the common case, not a corner.
    const studied = base({ reps: 10, exposures: 5, stability: 120, lastReview: NOW });
    const seenOften = base({ reps: 1, exposures: 50, stability: 1.2, lastReview: NOW - 1000 });

    const merged = mergeCards(studied, seenOften);
    assert.equal(merged.reps, 10, 'nine reviews were thrown away');
    assert.equal(merged.stability, 120, 'a mature stability was replaced by a fresh one');
    assert.equal(merged.exposures, 50, 'the higher sighting count should still be kept');
  });

  test('the FSRS state moves as one unit, never field by field', () => {
    /*
     * Taking maxima per field would look safer and be worse: a card with one
     * machine's stability and another's rep count describes a history that
     * never happened, and the scheduler would then act on it.
     */
    const a = base({ reps: 8, stability: 90, difficulty: 3, lastReview: NOW });
    const b = base({ reps: 2, stability: 200, difficulty: 9, lastReview: NOW - 5000 });

    const merged = mergeCards(a, b);
    assert.equal(merged.reps, 8);
    assert.equal(merged.stability, 90, 'stability came from the other copy');
    assert.equal(merged.difficulty, 3, 'difficulty came from the other copy');
    assert.equal(merged.lastReview, NOW);
  });

  test('equal rep counts are broken by the more recent review', () => {
    const older = base({ reps: 4, stability: 20, lastReview: NOW - 86_400_000 });
    const newer = base({ reps: 4, stability: 35, lastReview: NOW });
    assert.equal(mergeCards(older, newer).stability, 35);
    assert.equal(mergeCards(newer, older).stability, 35, 'result depends on argument order');
  });

  test('retirement survives from either side, dated from the earlier', () => {
    // Retirement is a promise to stop teaching a word. Losing it means a
    // word the reader has finished with starts appearing again.
    const retired = base({ reps: 6, retiredAt: NOW - 1000 });
    const active = base({ reps: 9 });
    const merged = mergeCards(active, retired);
    assert.equal(merged.retiredAt, NOW - 1000, 'retirement was dropped');
    assert.equal(merged.reps, 9, 'the review history should still be the richer one');
  });

  test('lapses keep the higher count, so a hard word stays hard', () => {
    const a = base({ reps: 9, lapses: 4 });
    const b = base({ reps: 2, lapses: 7 });
    assert.equal(mergeCards(a, b).lapses, 7);
  });

  test('the earliest first-seen wins', () => {
    const early = base({ reps: 1, firstSeen: NOW - 30 * 86_400_000 });
    const late = base({ reps: 5, firstSeen: NOW });
    assert.equal(mergeCards(late, early).firstSeen, NOW - 30 * 86_400_000);
  });

  test('a missing firstSeen does not become zero', () => {
    // An older export, or a hand-edited file. Math.min(0, real) would date
    // the word to 1970 and every "learning for N days" figure with it.
    const noDate = base({ reps: 1, firstSeen: 0 });
    const dated = base({ reps: 5, firstSeen: NOW });
    assert.equal(mergeCards(dated, noDate).firstSeen, NOW);
  });

  test('is commutative in everything that matters', () => {
    const a = base({ reps: 7, exposures: 12, lapses: 2, stability: 44, lastReview: NOW });
    const b = base({ reps: 3, exposures: 30, lapses: 5, stability: 9, retiredAt: NOW - 500 });
    const ab = mergeCards(a, b);
    const ba = mergeCards(b, a);
    assert.deepEqual(ab, ba, 'merging depends on which file you happened to import');
  });

  test('exposures are maxed, not summed', () => {
    // Summing would let a word inflate every time a file is exported and
    // imported back into the same install.
    const a = base({ exposures: 20 });
    const b = base({ exposures: 20 });
    assert.equal(mergeCards(a, b).exposures, 20);
  });
});
