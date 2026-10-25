/**
 * A day is not 24 hours long on the two nights a year the clocks change, so a
 * day key is stepped by the calendar, never by subtracting 86 400 000.
 *
 * `attentionSummary` built the dashboard's "yesterday", its daily series and
 * the streak from `dayKey(now - i * 86_400_000)` until 2026-10-25. With the
 * 4 a.m. rollover a 25-hour day, the clocks going back, holds two instants 24
 * hours apart, so for the hour from 03:00 on every day it was still in the
 * series — seven days on Free, sixty on Pro — the series counted it twice and
 * the streak with it; a 23-hour day, the clocks going forward, holds none, so
 * for the hour from 04:00 the series skipped it. `tests/core/storage-export.test.ts` found it, failing at 03:29
 * GMT on 2026-10-25 for the same arithmetic in its own fixture.
 *
 * Europe/London is fixed here, so that CI, which runs in UTC and has no clock
 * changes, exercises the same nights as a machine in London. The first test
 * fails, rather than every other test passing vacuously, if the zone did not
 * take.
 */
process.env.TZ = 'Europe/London';

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, shiftDay } from '../../src/core/escalation.ts';
import { attentionSummary } from '../../src/core/stats.ts';
import type { SiteAttention } from '../../src/core/types.ts';

/** 03:30 GMT on Sunday 25 October 2026, half an hour into the 25th hour of the 24th. */
const CLOCKS_BACK = Date.UTC(2026, 9, 25, 3, 30);
/** 04:30 BST on Sunday 28 March 2027, half an hour into a day after a 23-hour one. */
const CLOCKS_FORWARD = Date.UTC(2027, 2, 28, 3, 30);
/** 03:30 GMT on 10 November 2026, with the 25-hour day still inside the default thirty. */
const A_FORTNIGHT_ON = Date.UTC(2026, 10, 10, 3, 30);

function site(now: number, day: string, seconds: number, history: SiteAttention['history']): SiteAttention {
  return { host: 'news.test', seconds, lastTick: now, day, history };
}

describe('a day key across a change of the clocks', () => {
  test('the zone took, and 24 hours is not always a day', () => {
    assert.equal(new Date(Date.UTC(2026, 6, 1, 12)).getHours(), 13, 'TZ=Europe/London did not take: noon UTC in July is not 13:00');
    // The hazard itself: two instants 24 hours apart, one day key.
    assert.equal(dayKey(CLOCKS_BACK, 4), '2026-10-24');
    assert.equal(dayKey(CLOCKS_BACK - 86_400_000, 4), '2026-10-24');
    // And the other way: 24 hours back from the 28th lands on the 26th.
    assert.equal(dayKey(CLOCKS_FORWARD, 4), '2027-03-28');
    assert.equal(dayKey(CLOCKS_FORWARD - 86_400_000, 4), '2027-03-26');
  });

  test('shiftDay steps a day key by the calendar', () => {
    assert.equal(shiftDay('2026-10-25', -1), '2026-10-24');
    assert.equal(shiftDay('2027-03-28', -1), '2027-03-27');
    assert.equal(shiftDay('2026-10-24', 0), '2026-10-24');
    assert.equal(shiftDay('2026-03-01', -1), '2026-02-28');
    assert.equal(shiftDay('2028-03-01', -1), '2028-02-29', 'a leap year');
    assert.equal(shiftDay('2027-01-01', -1), '2026-12-31');
    assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');
    assert.equal(shiftDay('2026-11-09', -29), '2026-10-11');
  });

  test('the night the clocks go back, yesterday is the day before and no day counts twice', () => {
    const s = attentionSummary(
      [site(CLOCKS_BACK, '2026-10-24', 600, [{ day: '2026-10-23', seconds: 900 }])],
      CLOCKS_BACK,
      4,
    );
    assert.equal(s.todaySeconds, 600);
    assert.equal(s.yesterdaySeconds, 900, 'yesterday read today again');
    const days = s.series.map((d) => d.day);
    assert.equal(days.at(-1), '2026-10-24');
    assert.equal(days.at(-2), '2026-10-23');
    assert.equal(days[0], '2026-09-25', 'thirty days back from the 24th is the 25th of September');
    assert.equal(new Set(days).size, days.length, `a day appears twice: ${days.join(' ')}`);
    assert.equal(s.weekSeconds, 1500, 'the week counted today twice');
    assert.equal(s.streakDays, 2, 'the streak counted today twice');
  });

  test('the morning the clocks go forward, no day is skipped', () => {
    const s = attentionSummary(
      [site(CLOCKS_FORWARD, '2027-03-28', 60, [{ day: '2027-03-27', seconds: 900 }])],
      CLOCKS_FORWARD,
      4,
    );
    assert.equal(s.yesterdaySeconds, 900, 'yesterday read the day before it');
    const days = s.series.map((d) => d.day);
    assert.deepEqual(days.slice(-3), ['2027-03-26', '2027-03-27', '2027-03-28']);
    assert.equal(new Set(days).size, days.length, `a day appears twice: ${days.join(' ')}`);
    assert.equal(s.streakDays, 2, 'the streak skipped the 27th');
  });

  test('a fortnight later, the 25-hour day is still counted once', () => {
    const s = attentionSummary(
      [site(A_FORTNIGHT_ON, '2026-11-09', 60, [{ day: '2026-10-24', seconds: 300 }])],
      A_FORTNIGHT_ON,
      4,
    );
    const days = s.series.map((d) => d.day);
    assert.equal(days.filter((d) => d === '2026-10-24').length, 1, `the 24th of October appears ${days.filter((d) => d === '2026-10-24').length} times`);
    assert.equal(days[0], '2026-10-11');
    assert.equal(days.at(-1), '2026-11-09');
  });
});
