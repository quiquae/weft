import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  weaveRatio,
  minutesToRatio,
  decayAttention,
  dayKey,
  recordAttention,
  currentAttentionSeconds,
  formatDuration,
  mergeAttention,
} from '../../src/core/escalation.ts';
import type { SiteAttention } from '../../src/core/types.ts';
import { NOW } from '../helpers.ts';

const CURVE = { baseRatio: 0.06, ceilingRatio: 0.35, gainPerMinute: 0.02, escalate: true };

describe('weaveRatio', () => {
  test('starts at base with no attention', () => {
    assert.equal(weaveRatio({ ...CURVE, attentionSeconds: 0 }), 0.06);
  });

  test('is monotonically non-decreasing in attention', () => {
    let prev = -1;
    for (let s = 0; s <= 7200; s += 30) {
      const r = weaveRatio({ ...CURVE, attentionSeconds: s });
      assert.ok(r >= prev, `ratio fell at ${s}s: ${r} < ${prev}`);
      prev = r;
    }
  });

  test('never exceeds the ceiling, even at absurd attention', () => {
    const r = weaveRatio({ ...CURVE, attentionSeconds: 60 * 60 * 24 * 365 });
    assert.ok(r <= CURVE.ceilingRatio, `${r} > ${CURVE.ceilingRatio}`);
    assert.ok(r > 0.34, 'should asymptote close to the ceiling');
  });

  test('initial slope equals gainPerMinute', () => {
    // A one-minute sample should be within a few percent of the nominal gain.
    const atZero = weaveRatio({ ...CURVE, attentionSeconds: 0 });
    const atOne = weaveRatio({ ...CURVE, attentionSeconds: 60 });
    const slope = atOne - atZero;
    assert.ok(
      Math.abs(slope - CURVE.gainPerMinute) < CURVE.gainPerMinute * 0.05,
      `slope ${slope} should be ~${CURVE.gainPerMinute}`,
    );
  });

  test('gentle sites stay pinned at base', () => {
    const r = weaveRatio({ ...CURVE, escalate: false, attentionSeconds: 100_000 });
    assert.equal(r, 0.06);
  });

  test('handles a ceiling at or below base without NaN', () => {
    const r = weaveRatio({ baseRatio: 0.4, ceilingRatio: 0.2, gainPerMinute: 0.05, escalate: true, attentionSeconds: 600 });
    assert.equal(r, 0.4);
  });

  test('clamps out-of-range configuration', () => {
    const r = weaveRatio({ baseRatio: -1, ceilingRatio: 5, gainPerMinute: 0.02, escalate: true, attentionSeconds: 0 });
    assert.equal(r, 0);
  });
});

describe('minutesToRatio', () => {
  test('inverts weaveRatio', () => {
    for (const target of [0.1, 0.2, 0.3, 0.34]) {
      const minutes = minutesToRatio(target, CURVE);
      assert.ok(Number.isFinite(minutes), `${target} should be reachable`);
      const back = weaveRatio({ ...CURVE, attentionSeconds: minutes * 60 });
      assert.ok(Math.abs(back - target) < 1e-9, `${target} -> ${minutes}min -> ${back}`);
    }
  });

  test('returns 0 at or below base and Infinity at the ceiling', () => {
    assert.equal(minutesToRatio(0.05, CURVE), 0);
    assert.equal(minutesToRatio(0.35, CURVE), Infinity);
  });
});

describe('decayAttention', () => {
  test('loses the configured fraction per hour', () => {
    assert.equal(Math.round(decayAttention(1000, 1, 0.35)), 650);
  });

  test('compounds over multiple hours', () => {
    const two = decayAttention(1000, 2, 0.35);
    assert.ok(Math.abs(two - 1000 * 0.65 * 0.65) < 1e-6);
  });

  test('is a no-op for zero elapsed or zero rate', () => {
    assert.equal(decayAttention(500, 0, 0.5), 500);
    assert.equal(decayAttention(500, 10, 0), 500);
  });

  test('bottoms out at zero rather than a fractional second', () => {
    assert.equal(decayAttention(10, 100, 0.9), 0);
  });
});

describe('dayKey', () => {
  test('rolls over at the configured hour, not midnight', () => {
    const at0130 = new Date(2026, 8, 14, 1, 30).getTime();
    const at0430 = new Date(2026, 8, 14, 4, 30).getTime();
    assert.equal(dayKey(at0130, 4), '2026-09-13', '01:30 still belongs to the 13th');
    assert.equal(dayKey(at0430, 4), '2026-09-14');
  });

  test('handles month boundaries', () => {
    const at0200 = new Date(2026, 9, 1, 2, 0).getTime();
    assert.equal(dayKey(at0200, 4), '2026-09-30');
  });

  test('midnight rollover behaves conventionally', () => {
    const at0130 = new Date(2026, 8, 14, 1, 30).getTime();
    assert.equal(dayKey(at0130, 0), '2026-09-14');
  });
});

describe('recordAttention', () => {
  const cfg = { rolloverHour: 4, decayPerHourAway: 0.35, dailyCapMinutes: 240 };
  const now = new Date(2026, 8, 14, 12, 0, 0).getTime();

  test('creates a fresh record', () => {
    const { attention, rolled } = recordAttention(undefined, 'x.com', 5, now, cfg);
    assert.equal(attention.seconds, 5);
    assert.equal(attention.host, 'x.com');
    assert.equal(rolled, false);
  });

  test('accumulates within a day', () => {
    let a = recordAttention(undefined, 'x.com', 5, now, cfg).attention;
    a = recordAttention(a, 'x.com', 5, now + 5000, cfg).attention;
    assert.equal(a.seconds, 10);
  });

  test('does not decay across a single tick gap', () => {
    let a = recordAttention(undefined, 'x.com', 600, now, cfg).attention;
    a = recordAttention(a, 'x.com', 1, now + 1000, cfg).attention;
    assert.equal(a.seconds, 601, 'a one-second gap is not "away"');
  });

  test('decays once a real gap opens', () => {
    let a = recordAttention(undefined, 'x.com', 600, now, cfg).attention;
    a = recordAttention(a, 'x.com', 1, now + 3_600_000, cfg).attention;
    assert.ok(a.seconds < 400, `expected decay, got ${a.seconds}`);
  });

  test('rolls the day over and archives history', () => {
    const a = recordAttention(undefined, 'x.com', 600, now, cfg).attention;
    const tomorrow = now + 24 * 3_600_000;
    const res = recordAttention(a, 'x.com', 5, tomorrow, cfg);
    assert.equal(res.rolled, true);
    assert.equal(res.attention.seconds, 5);
    assert.equal(res.attention.history.length, 1);
    assert.equal(res.attention.history[0]?.seconds, 600);
    assert.equal(res.attention.history[0]?.day, '2026-09-14');
  });

  test('respects the daily cap', () => {
    let a = recordAttention(undefined, 'x.com', 0, now, cfg).attention;
    for (let i = 0; i < 400; i++) {
      a = recordAttention(a, 'x.com', 60, now + i * 60_000, cfg).attention;
    }
    assert.equal(a.seconds, 240 * 60);
  });
});

describe('currentAttentionSeconds', () => {
  const cfg = { rolloverHour: 4, decayPerHourAway: 0.35 };
  const now = new Date(2026, 8, 14, 12, 0, 0).getTime();

  test('returns 0 for a stale day', () => {
    const a = recordAttention(undefined, 'x.com', 600, now, { ...cfg, dailyCapMinutes: 240 }).attention;
    assert.equal(currentAttentionSeconds(a, now + 48 * 3_600_000, cfg), 0);
  });

  test('applies decay without mutating', () => {
    const a = recordAttention(undefined, 'x.com', 600, now, { ...cfg, dailyCapMinutes: 240 }).attention;
    const v = currentAttentionSeconds(a, now + 2 * 3_600_000, cfg);
    assert.ok(v < 600 && v > 0);
    assert.equal(a.seconds, 600, 'input must not be mutated');
  });
});

describe('formatDuration', () => {
  test('formats seconds, minutes and hours', () => {
    assert.equal(formatDuration(45), '45s');
    assert.equal(formatDuration(600), '10 min');
    assert.equal(formatDuration(3600), '1h');
    assert.equal(formatDuration(3900), '1h 5m');
    assert.equal(formatDuration(-5), '0s');
  });
});

/**
 * Merging two machines' attention.
 *
 * An export carries `attention` and an import has always thrown it away, so
 * a user moving machines lost their whole history in silence. Restoring it
 * is a merge rather than a replace, and the merge has exactly two jobs:
 * never lose a day, and never invent one.
 *
 * Max per day rather than sum, for the reason `mergeCards` already gives
 * about exposures — a round trip through export must not inflate the
 * number, and the dashboard calls this panel "facts about reading you have
 * actually done". Summing would also make importing the same file twice
 * different from importing it once.
 */
describe('mergeAttention', () => {
  const day = (d: number) => `2026-09-${String(d).padStart(2, '0')}`;
  const site = (over: Partial<SiteAttention> = {}): SiteAttention => ({
    host: 'example.test',
    seconds: 0,
    lastTick: NOW,
    day: day(29),
    history: [],
    ...over,
  });

  test('brings over a host this machine has never seen', () => {
    const merged = mergeAttention({}, { 'news.test': site({ host: 'news.test', seconds: 600 }) }, NOW);
    assert.equal(merged['news.test']?.seconds, 600);
  });

  test('leaves a host the import does not mention alone', () => {
    const mine = { 'a.test': site({ host: 'a.test', seconds: 120 }) };
    const merged = mergeAttention(mine, {}, NOW);
    assert.deepEqual(merged['a.test'], mine['a.test']);
  });

  test('takes the larger of the two same-day figures, never the sum', () => {
    const merged = mergeAttention(
      { 'a.test': site({ host: 'a.test', seconds: 600 }) },
      { 'a.test': site({ host: 'a.test', seconds: 900 }) },
      NOW,
    );
    assert.equal(merged['a.test']?.seconds, 900, 'the larger day should win');
  });

  test('never lowers a figure this machine already has', () => {
    const merged = mergeAttention(
      { 'a.test': site({ host: 'a.test', seconds: 900 }) },
      { 'a.test': site({ host: 'a.test', seconds: 10 }) },
      NOW,
    );
    assert.equal(merged['a.test']?.seconds, 900);
  });

  test('is idempotent: importing the same file twice is importing it once', () => {
    const theirs = { 'a.test': site({ host: 'a.test', seconds: 900, history: [{ day: day(28), seconds: 300 }] }) };
    const once = mergeAttention({ 'a.test': site({ host: 'a.test', seconds: 120 }) }, theirs, NOW);
    const twice = mergeAttention(once, theirs, NOW);
    assert.deepEqual(twice, once, 'a second import of the same export changed the totals');
  });

  test('merges history day by day, keeping the larger of each', () => {
    const merged = mergeAttention(
      {
        'a.test': site({
          host: 'a.test',
          seconds: 100,
          history: [
            { day: day(26), seconds: 500 },
            { day: day(27), seconds: 60 },
          ],
        }),
      },
      {
        'a.test': site({
          host: 'a.test',
          seconds: 100,
          history: [
            { day: day(27), seconds: 800 },
            { day: day(28), seconds: 400 },
          ],
        }),
      },
      NOW,
    );
    assert.deepEqual(merged['a.test']?.history, [
      { day: day(26), seconds: 500 },
      { day: day(27), seconds: 800 },
      { day: day(28), seconds: 400 },
    ]);
  });

  test("the older machine's current day becomes history rather than being lost", () => {
    const merged = mergeAttention(
      { 'a.test': site({ host: 'a.test', seconds: 700, day: day(29) }) },
      { 'a.test': site({ host: 'a.test', seconds: 400, day: day(27) }) },
      NOW,
    );
    assert.equal(merged['a.test']?.day, day(29), 'the later day is the current one');
    assert.equal(merged['a.test']?.seconds, 700);
    assert.deepEqual(merged['a.test']?.history, [{ day: day(27), seconds: 400 }]);
  });

  test('clamps a forged future lastTick to now, so decay cannot be dodged', () => {
    const merged = mergeAttention(
      { 'a.test': site({ host: 'a.test', seconds: 10 }) },
      { 'a.test': site({ host: 'a.test', seconds: 10, lastTick: NOW + 30 * 86_400_000 }) },
      NOW,
    );
    assert.equal(merged['a.test']?.lastTick, NOW);
  });

  test('caps merged history at sixty days, keeping the most recent', () => {
    const many = (from: number, count: number) =>
      Array.from({ length: count }, (_, i) => ({ day: `2026-01-${String(from + i).padStart(2, '0')}`, seconds: 60 }));
    const merged = mergeAttention(
      { 'a.test': site({ host: 'a.test', history: many(1, 20) }) },
      { 'a.test': site({ host: 'a.test', history: [...many(1, 20), ...manyMonths()] }) },
      NOW,
    );
    const history = merged['a.test']?.history ?? [];
    assert.ok(history.length <= 60, `history grew to ${history.length} days`);
    assert.equal(history.at(-1)?.day, '2026-03-30', 'the cap dropped the newest days instead of the oldest');
  });

  function manyMonths(): Array<{ day: string; seconds: number }> {
    const out: Array<{ day: string; seconds: number }> = [];
    for (const [month, days] of [['02', 28], ['03', 30]] as Array<[string, number]>) {
      for (let d = 1; d <= days; d++) out.push({ day: `2026-${month}-${String(d).padStart(2, '0')}`, seconds: 30 });
    }
    return out;
  }
});
