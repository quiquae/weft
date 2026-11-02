/**
 * A data export is named for the day it was made, where the user is.
 *
 * `src/ui/options/data.tsx` named the file from `toISOString()` until
 * 2026-11-02, which is the date in UTC, so a backup made before 09:00 in Tokyo
 * was named for the day before, and one made after 16:00 in a Californian
 * winter for the day after.
 *
 * Each test sets its own zone, one process having to be in two of them, and CI
 * running in UTC, where the two dates agree and every test here would pass on
 * the bug. So each fails first if its zone did not take.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { exportFilename } from '../../src/core/escalation.ts';

function inZone(zone: string, hourAtNoonUtcInJuly: number): void {
  process.env.TZ = zone;
  assert.equal(
    new Date(Date.UTC(2026, 6, 1, 12)).getHours(),
    hourAtNoonUtcInJuly,
    `TZ=${zone} did not take`,
  );
}

describe('the name of a data export', () => {
  test('before 09:00 in Tokyo it is today, where UTC is still on yesterday', () => {
    inZone('Asia/Tokyo', 21);
    // 08:30 on 3 November in Tokyo, UTC+9, and 23:30 on the 2nd in UTC.
    assert.equal(exportFilename(Date.UTC(2026, 10, 2, 23, 30)), 'weft-2026-11-03.json');
  });

  test('after 16:00 in a Californian winter it is today, where UTC is already on tomorrow', () => {
    inZone('America/Los_Angeles', 5);
    // 17:30 on 2 November in California, UTC−8, and 01:30 on the 3rd in UTC.
    assert.equal(exportFilename(Date.UTC(2026, 10, 3, 1, 30)), 'weft-2026-11-02.json');
  });

  test('turns at midnight, not at the 4 a.m. rollover a reading day keeps', () => {
    inZone('Asia/Tokyo', 21);
    // 23:59 on the 2nd, then 00:00 and 03:59 on the 3rd, in Tokyo.
    assert.equal(exportFilename(Date.UTC(2026, 10, 2, 14, 59)), 'weft-2026-11-02.json');
    assert.equal(exportFilename(Date.UTC(2026, 10, 2, 15, 0)), 'weft-2026-11-03.json');
    assert.equal(exportFilename(Date.UTC(2026, 10, 2, 18, 59)), 'weft-2026-11-03.json');
  });
});
