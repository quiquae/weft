/**
 * The progress screenshot must not photograph the wall clock.
 *
 * `docs/store/*-04-progress.png` is listing art: B5 step 7 uploads it to the
 * Chrome Web Store. Four of its five tiles are seeded through the real import
 * path and are therefore reproducible. The fifth, "taxed attention today",
 * is not seeded at all — it reads whatever attention the run itself happened
 * to accrue while scenes 1-3 hovered and scrolled a real page. Two runs a day
 * apart produced `9s` and `6s`, which is a one-glyph diff and a 303-byte diff
 * in the PNG.
 *
 * That cost a session. The 126 711-byte `apple-04-progress.png` sitting on
 * one abandoned ref was recorded in `TODO.md` as a stray that "the generator
 * does not produce"; it is in fact exactly what the generator produces when
 * the tile happens to read `6s`. Both blobs are legitimate output of the same
 * code, so "the shots came back byte-identical" could never mean anything
 * for this scene, and the one check that could vouch for the listing art was
 * reporting noise.
 *
 * The fix is not a frozen clock — it is a seeded value far enough above a
 * minute boundary that `formatDuration` renders the same string whatever the
 * run accrues on top. This guard pins that argument: it re-derives the
 * rendered string across the whole plausible accrual range rather than
 * trusting the two clauses that make it work.
 *
 * It lives in `tests/tools/` for the reason `demo-curve.test.ts` does: it
 * reads a file off disk, which `tests/core/`'s no-I/O rule forbids, and the
 * constant it polices lives outside the test suite, where it is free to
 * drift. `store-assets.spec.ts` is read as text, never imported — importing a
 * Playwright spec would run `test.describe` at load time.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatDuration } from '../../src/core/escalation.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SPEC = join(ROOT, 'tests/e2e/store-assets.spec.ts');
const DASHBOARD = join(ROOT, 'src/ui/dashboard/index.tsx');

/**
 * The widest accrual the guard defends against.
 *
 * Scenes 1-3 load `showcase.html` nine times and hover twice, and attention
 * only counts while a taxed page is visible, focused and being used, so the
 * measured figures are single digits. 59 is not a measurement, it is the
 * largest error a minute-aligned constant can absorb — one second more and
 * no choice of constant would help.
 */
const MAX_ACCRUAL_SECONDS = 59;

const spec = readFileSync(SPEC, 'utf8');

const seeded = (): number => {
  const m = /SEEDED_ATTENTION_SECONDS\s*=\s*(\d+)/.exec(spec);
  assert.ok(m, 'no SEEDED_ATTENTION_SECONDS in store-assets.spec.ts — has it been renamed?');
  return Number(m[1]);
};

describe('the store progress shot is reproducible', () => {
  test('attention is seeded rather than left to the run', () => {
    const s = seeded();
    assert.ok(
      s >= 60,
      `attention is seeded at ${s}s, which formatDuration renders as "${formatDuration(s)}" — ` +
        'under a minute it prints whole seconds, so the tile photographs the clock',
    );
  });

  test('the tile renders the same string whatever the run accrues', () => {
    const s = seeded();
    const expected = formatDuration(s);
    for (let accrued = 0; accrued <= MAX_ACCRUAL_SECONDS; accrued++) {
      assert.equal(
        formatDuration(s + accrued),
        expected,
        `seeded ${s}s + ${accrued}s of the run's own attention renders as ` +
          `"${formatDuration(s + accrued)}" rather than "${expected}", so two runs of the ` +
          'generator disagree and the shot cannot be diffed',
      );
    }
  });

  /*
   * Non-vacuity, and the reason this file is not just a test of arithmetic:
   * the property above holds for any minute-aligned value, so it has to be
   * shown to fail for one that is not. `9s` is the figure actually committed.
   */
  test('the guard fires on the value that shipped', () => {
    assert.notEqual(
      formatDuration(9),
      formatDuration(9 + MAX_ACCRUAL_SECONDS),
      'formatDuration no longer distinguishes these, so this guard proves nothing',
    );
  });

  /*
   * The coupling the two tests above rest on. If the dashboard ever renders
   * that tile through something other than `formatDuration`, every assertion
   * here is about a function nothing calls, and this names it.
   */
  test('the dashboard still renders the tile through formatDuration', () => {
    const src = readFileSync(DASHBOARD, 'utf8');
    assert.match(
      src,
      /value=\{formatDuration\(attn\.todaySeconds\)\}\s*\n\s*label="taxed attention today"/,
      'the "taxed attention today" tile no longer reads formatDuration(attn.todaySeconds)',
    );
  });
});
