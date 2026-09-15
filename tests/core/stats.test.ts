import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  stageOf, vocabStats, studyQueue, attentionSummary, upcoming, retirementSeries, wordsRead,
} from '../../src/core/stats.ts';
import { recordAttention, dayKey } from '../../src/core/escalation.ts';
import { card, settings, NOW } from '../helpers.ts';
import type { SiteAttention } from '../../src/core/types.ts';

const DAY = 86_400_000;
const S = settings();

describe('stageOf', () => {
  test('classifies the lifecycle', () => {
    assert.equal(stageOf(card({ reps: 0 }), S, NOW), 'new');
    assert.equal(stageOf(card({ reps: 2, stability: 2, lastReview: NOW }), S, NOW), 'learning');
    assert.equal(stageOf(card({ reps: 2, stability: 9, lastReview: NOW }), S, NOW), 'familiar');
    assert.equal(stageOf(card({ reps: 9, stability: 90, lastReview: NOW - DAY }), S, NOW), 'retired');
    assert.equal(stageOf(card({ retiredAt: NOW }), S, NOW), 'retired');
  });
});

describe('vocabStats', () => {
  const cards = [
    card({ lemma: 'a', reps: 0, exposures: 1 }),
    card({ lemma: 'b', reps: 3, stability: 2, lastReview: NOW - DAY, exposures: 10, lapses: 3 }),
    card({ lemma: 'c', reps: 4, stability: 12, lastReview: NOW, exposures: 20, lapses: 1 }),
    card({ lemma: 'd', reps: 9, stability: 90, lastReview: NOW - DAY, exposures: 40, lapses: 0 }),
  ];

  test('counts each stage exactly once', () => {
    const v = vocabStats(cards, S, NOW);
    assert.equal(v.total, 4);
    assert.equal(v.new + v.learning + v.familiar + v.retired, 4);
    assert.equal(v.new, 1);
    assert.equal(v.retired, 1);
  });

  test('sums exposures and reveals', () => {
    const v = vocabStats(cards, S, NOW);
    assert.equal(v.totalExposures, 71);
    assert.equal(v.totalReveals, 4);
  });

  test('comprehension rate is reveals over exposures, inverted and clamped', () => {
    const v = vocabStats(cards, S, NOW);
    assert.ok(Math.abs(v.comprehensionRate - (1 - 4 / 71)) < 1e-9);
    const worse = vocabStats([card({ reps: 1, exposures: 2, lapses: 50, lastReview: NOW })], S, NOW);
    assert.ok(worse.comprehensionRate >= 0, 'never negative');
  });

  test('handles an empty collection', () => {
    const v = vocabStats([], S, NOW);
    assert.equal(v.total, 0);
    assert.equal(v.medianStability, 0);
    assert.equal(v.comprehensionRate, 0);
  });

  test('median stability ignores unseen cards', () => {
    const v = vocabStats(cards, S, NOW);
    assert.equal(v.medianStability, 12);
  });
});

describe('studyQueue', () => {
  test('puts the least-recalled words first', () => {
    const q = studyQueue(
      [
        card({ lemma: 'fresh', reps: 3, stability: 100, lastReview: NOW }),
        card({ lemma: 'stale', reps: 3, stability: 1, lastReview: NOW - 60 * DAY }),
      ],
      NOW,
    );
    assert.equal(q[0]?.lemma, 'stale');
  });

  test('excludes retired words', () => {
    const q = studyQueue([card({ lemma: 'done', retiredAt: NOW })], NOW);
    assert.equal(q.length, 0);
  });
});

describe('attentionSummary', () => {
  const cfg = { rolloverHour: 4, decayPerHourAway: 0.35, dailyCapMinutes: 240 };
  const now = new Date(2026, 8, 14, 12, 0, 0).getTime();

  function site(host: string, seconds: number, history: Array<{ day: string; seconds: number }> = []): SiteAttention {
    const a = recordAttention(undefined, host, seconds, now, cfg).attention;
    return { ...a, history };
  }

  test('sums today across hosts and ranks them', () => {
    const s = attentionSummary([site('x.com', 600), site('reddit.com', 1200)], now, 4);
    assert.equal(s.todaySeconds, 1800);
    assert.equal(s.today[0]?.host, 'reddit.com');
  });

  test('builds a gap-free daily series', () => {
    const s = attentionSummary([site('x.com', 600)], now, 4, 7);
    assert.equal(s.series.length, 7);
    assert.equal(s.series.at(-1)?.day, dayKey(now, 4));
    assert.equal(s.series.at(-1)?.seconds, 600);
    assert.equal(s.series[0]?.seconds, 0);
  });

  test('reads archived history', () => {
    const yesterday = dayKey(now - DAY, 4);
    const s = attentionSummary([site('x.com', 100, [{ day: yesterday, seconds: 900 }])], now, 4);
    assert.equal(s.yesterdaySeconds, 900);
    assert.equal(s.weekSeconds, 1000);
  });

  test('counts a streak of consecutive active days', () => {
    const history = [1, 2, 3].map((d) => ({ day: dayKey(now - d * DAY, 4), seconds: 60 }));
    const s = attentionSummary([site('x.com', 60, history)], now, 4);
    assert.equal(s.streakDays, 4);
  });

  test('a gap ends the streak', () => {
    const history = [{ day: dayKey(now - 3 * DAY, 4), seconds: 60 }];
    const s = attentionSummary([site('x.com', 60, history)], now, 4);
    assert.equal(s.streakDays, 1);
  });

  test('handles no data at all', () => {
    const s = attentionSummary([], now, 4);
    assert.equal(s.todaySeconds, 0);
    assert.equal(s.streakDays, 0);
    assert.equal(s.today.length, 0);
  });
});

describe('upcoming', () => {
  test('orders by days until due and skips unseen and retired words', () => {
    const list = upcoming([
      card({ lemma: 'soon', reps: 3, stability: 1, lastReview: Date.now() }),
      card({ lemma: 'later', reps: 3, stability: 100, lastReview: Date.now() }),
      card({ lemma: 'unseen', reps: 0 }),
      card({ lemma: 'retired', reps: 5, stability: 50, retiredAt: Date.now() }),
    ]);
    assert.deepEqual(list.map((u) => u.lemma), ['soon', 'later']);
  });
});

describe('retirementSeries', () => {
  test('buckets retirements by week', () => {
    const series = retirementSeries(
      [
        card({ lemma: 'a', retiredAt: NOW - 1 * DAY }),
        card({ lemma: 'b', retiredAt: NOW - 2 * DAY }),
        card({ lemma: 'c', retiredAt: NOW - 20 * DAY }),
        card({ lemma: 'old', retiredAt: NOW - 400 * DAY }),
        card({ lemma: 'never' }),
      ],
      NOW,
      12,
    );
    assert.equal(series.length, 12);
    assert.equal(series.reduce((a, b) => a + b.retired, 0), 3, 'out-of-window retirements excluded');
    assert.equal(series.at(-1)?.retired, 2);
  });
});

describe('wordsRead', () => {
  test('sums exposures', () => {
    assert.equal(wordsRead([card({ exposures: 10 }), card({ exposures: 5 })]), 15);
    assert.equal(wordsRead([]), 0);
  });
});
