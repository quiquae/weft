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
 * **Since 2026-09-29 the tile is no longer in shot, and this guard is kept
 * anyway.** `frameOn` in the spec aligns scene 4 on the discoveries feed,
 * which scrolls the tile row out of all three frames — measured, by running
 * the generator at 60s instead of 1800s and finding all fifteen hashes
 * unmoved. So these tests defend a property of the seeding rather than a
 * committed byte. That is a weaker claim than they were written to make and
 * is worth stating, but it is not the vacuity this suite polices elsewhere:
 * `formatDuration` and the constant both exist and are both exercised, and
 * the drift comes straight back if anyone reframes the scene to put the
 * tiles in shot.
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

/**
 * The listing shots must be framed on a section boundary, not nudged.
 *
 * Four of the six scrolled captures were cut across a row of content, and
 * every automated check in the repository was happy with them: the files are
 * byte-stable and byte-identical to what is committed, so `artefacts:check`
 * called the group `ok` and the reproducibility diff agreed with itself.
 * They were found by opening them.
 *
 * `apple-04-progress.png` cut the tops off the digits of all four progress
 * tiles; `apple-05-settings.png` halved the preset button row. Both are the
 * row *above* the target bleeding in. But `chrome-05-settings.png` halved
 * the "Resting density" heading and `edge-05-settings.png` lost it
 * altogether, opening mid-sentence — the row the scene exists to show, with
 * its head cut off.
 *
 * So the diagnosis "the scroll is minimal, so whatever sits above bleeds in"
 * described only half the cases. `scrollIntoViewIfNeeded` states no
 * alignment at all: Blink chooses one from the element's position and the
 * viewport height, so the landing point is a function of the frame size and
 * can err in *either* direction. A guard that only asked "is anything above
 * in shot" would have passed `edge-05`, which is the worst of the four.
 * Hence a two-sided assertion, and hence this file asserting it is two-sided.
 *
 * The selector list below is derived from the spec rather than typed out,
 * for the reason `screenshots.test.ts` records: a hand-written list of the
 * things to check cannot police the thing that was forgotten, so a fourth
 * framed scene added later is covered without an edit here.
 */
describe('the store shots are framed on a section boundary', () => {
  /** Every `.section` selector the spec frames a capture on. */
  const framed = (): string[] => {
    const found = [...spec.matchAll(/'(\.section[^']*)'/g)].map((m) => m[1] as string);
    return [...new Set(found)];
  };

  test('every section a scene frames is framed deterministically', () => {
    const selectors = framed();
    /*
     * Non-vacuity. Rename the locator call and the loop below runs over an
     * empty list and passes — the silent skip this suite polices elsewhere.
     */
    assert.ok(
      selectors.length >= 2,
      `found ${selectors.length} framed sections in store-assets.spec.ts, expected at least 2 ` +
        '(04-progress and 05-settings) — has the selector or the locator call been renamed?',
    );
    for (const selector of selectors) {
      assert.ok(
        spec.includes(`frameOn(page, '${selector}')`),
        `'${selector}' is scrolled into shot by something other than frameOn(), so its ` +
          'framing is whatever Blink picks for that viewport height — which cut a row of ' +
          'content in four of the six committed captures',
      );
      assert.ok(
        !new RegExp(`locator\\('${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\)[^\\n]*scrollIntoViewIfNeeded`).test(spec),
        `'${selector}' still uses scrollIntoViewIfNeeded, which states no alignment`,
      );
    }
  });

  /*
   * The two-sidedness of `frameOn` itself is asserted in
   * `tests/tools/shot-framing.test.ts`, not here, and the move is the point.
   * `frameOn` used to be a local helper in this one spec; it is now exported
   * from `tests/e2e/fixtures.ts`, because this spec was never the only
   * generator scrolling a section into shot — `firstrun.spec.ts` had the
   * same `scrollIntoViewIfNeeded` call on `.section:has(.help__report)` and
   * this file could not see it. A guard that derives its selectors from one
   * hand-picked file has exactly that blind spot, so the cross-cutting rule
   * is stated once, over every spec with an `OUT` directory under `docs/`.
   */
});

/**
 * Scene 4 photographs the seeded plan and nothing the run met on its own.
 *
 * Scenes 1–3 weave `showcase.html` nine times, once per frame, and every page
 * that weaves records exposures, flushed to the worker as it closes — so the
 * run makes cards of its own before the plan is imported. `import-data` merges
 * rather than replaces, keeping what is there, so whether those cards reached
 * the feed depended on whether the last flush landed before the dashboard read
 * the store. On 2026-10-05 one run in four wrote all three `*-04-progress.png`
 * with *arbre*, *église* and *route* above the seeded nineteen, 41 113 to 50 272
 * pixels from the committed shots, and the other three matched them byte for
 * byte. `tests/e2e/screenshots.spec.ts` closes the same race the same way: let
 * the closing pages' writes land, reset the vocabulary, then seed.
 */
describe('the store progress shot holds the seeded plan and nothing else', () => {
  const lastWeave = spec.lastIndexOf('/showcase.html`)');
  const reset = spec.indexOf("type: 'reset-vocabulary'");
  const seed = spec.indexOf("type: 'import-data'");
  const shoot = spec.indexOf("capture('04-progress'");

  test('the spec can still find what it orders', () => {
    // A renamed page or message would leave every comparison below reading -1.
    assert.ok(lastWeave > 0, 'no woven showcase.html page was found in store-assets.spec.ts');
    assert.ok(seed > 0, 'store-assets.spec.ts no longer imports its plan through import-data');
    assert.ok(shoot > seed, 'scene 4 is no longer captured after the plan is imported');
  });

  test('the vocabulary is reset after the last page that weaves, and before the plan', () => {
    assert.ok(reset > 0, 'store-assets.spec.ts never resets the vocabulary, so the plan is merged into the run’s own cards');
    assert.ok(reset > lastWeave, 'the vocabulary is reset before a page that weaves, which makes cards again');
    assert.ok(reset < seed, 'the vocabulary is reset after the plan is imported, which wipes the plan');
    const settle = spec.slice(lastWeave, reset);
    assert.match(settle, /setTimeout\(resolve, \d{4,}\)/, 'nothing waits for the closing pages’ writes to land before the reset');
  });

  test('the store is read back as exactly the plan before and after scene 4 is shot', () => {
    const checks = [...spec.matchAll(/expectStoreIsThePlan\(\)/g)].map((m) => m.index ?? -1);
    assert.ok(checks.some((i) => i > seed && i < shoot), 'nothing checks the store is the plan before scene 4 is shot');
    assert.ok(checks.some((i) => i > shoot), 'nothing checks the store is still the plan after scene 4 is shot');
  });
});
