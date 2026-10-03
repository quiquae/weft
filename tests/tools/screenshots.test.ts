/**
 * The documentation screenshots must not photograph the wall clock, or the
 * order a Map happened to iterate in.
 *
 * `docs/screens/` is embedded in documentation a stranger reads — `README.md`
 * uses `options-density.png` — and `npm run artefacts:check` reports the set
 * stale whenever `src/` has moved since it was last written. That report is
 * only worth acting on if regenerating produces a diff that means something,
 * and for five of the nineteen files it did not: `dashboard.png`,
 * `dashboard-dark.png`, `dashboard-milestones.png`,
 * `dashboard-vocabulary.png` and `popup.png` differed between two runs a
 * minute apart, on a tree nothing had changed.
 *
 * `TODO.md` recorded the cause as an absolute calendar date rendered from
 * `Date.now()`, and for two runs a minute apart that was wrong: the dates
 * `dashboard.png` prints move only between days. Measured, it was two
 * causes, neither of them a date — the date is the third, and has its own
 * `describe` at the foot of this file:
 *
 * 1. **Attention accrued by the run itself.** The popup's attention line and
 *    the dashboard's milestone bars read whatever the run happened to earn
 *    while it wove a real page — single-digit seconds, different every time.
 *    Fixed the way `store-assets.spec.ts` fixed its progress tile: seed a
 *    minute-aligned value that `formatDuration` renders identically whatever
 *    the run adds underneath the next boundary.
 *
 * 2. **Cards the weaving created.** The vocabulary list held words read off
 *    `article.html`, not just the seeded plan, with counts that moved run to
 *    run; one of them crossing a row in or out of the list is why
 *    `dashboard.png` changed *height*, 4145px against 4199px. Fixed by
 *    resetting the store before seeding it, which `import-data` cannot do
 *    for us because `mergeCards` takes the max of `exposures` by design.
 *
 * The ordering half of (2) is guarded in `tests/core/stats.test.ts` instead,
 * because it was a defect in the product and not in the spec: every column of
 * the list but `alpha` tied constantly and the comparator returned 0, so a
 * real learner's list reshuffled between visits too.
 *
 * Lives in `tests/tools/` for the reason `store-assets.test.ts` does: it
 * reads files off disk, which `tests/core/`'s no-I/O rule forbids, and the
 * constants it polices sit outside the test suite where they are free to
 * drift. The spec is read as text, never imported — importing a Playwright
 * spec would run `test.describe` at load time.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dayKey, formatDuration } from '../../src/core/escalation.ts';
import { cardRetrievability } from '../../src/core/fsrs.ts';
import { defaultSettings } from '../../src/core/settings.ts';
import type { MemoryCard } from '../../src/core/types.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SPEC = join(ROOT, 'tests/e2e/screenshots.spec.ts');

/** The widest accrual a minute-aligned constant can absorb. See store-assets.test.ts. */
const MAX_ACCRUAL_SECONDS = 59;

const spec = readFileSync(SPEC, 'utf8');

/**
 * Every page the spec opens that loads a page over HTTP, and where it closes.
 *
 * Derived from the source rather than listed by hand, and that is the whole
 * point. The guard this replaces named `reader` and `oe` as literals, so it
 * could not see the third page — and its own failure message called
 * `oe.close()` "the wrapped-mode page", which is the variable named
 * `wrapped`, the one it had missed. A hand-typed list of the things to check
 * cannot police the thing that was forgotten; the same shape as the note
 * guard that skipped `novem` for having no note.
 *
 * A `chrome-extension://` page is not taxed and is deliberately not matched:
 * the content script is registered per granted origin, so an extension
 * surface cannot weave and cannot record an exposure. Anchored on `.goto(`
 * rather than on `${origin}` appearing anywhere in the block, because the
 * popup passes `${origin}/article.html` into an init script as a stubbed tab
 * URL while navigating to `popup.html`.
 */
function taxedPages(): Array<{ name: string; opened: number; closed: number }> {
  const opens = [...spec.matchAll(/const (\w+) = await context\.newPage\(\)/g)];
  return opens
    .map((m, i) => {
      const opened = m.index ?? 0;
      const end = i + 1 < opens.length ? (opens[i + 1]!.index ?? spec.length) : spec.length;
      return { name: m[1]!, opened, block: spec.slice(opened, end) };
    })
    .filter(({ name, block }) =>
      new RegExp(String.raw`await ${name}\.goto\(\`\$\{origin\}`).test(block),
    )
    .map(({ name, opened }) => ({
      name,
      opened,
      closed: spec.indexOf(`${name}.close()`, opened),
    }));
}

describe('the documentation screenshots are reproducible', () => {
  const seeded = (): number => {
    const m = /SEEDED_ATTENTION_SECONDS\s*=\s*(\d+)/.exec(spec);
    assert.ok(m, 'no SEEDED_ATTENTION_SECONDS in screenshots.spec.ts — has it been renamed?');
    return Number(m[1]);
  };

  test('attention is seeded rather than left to the run', () => {
    const s = seeded();
    assert.ok(
      s >= 60,
      `attention is seeded at ${s}s, which formatDuration renders as "${formatDuration(s)}" — ` +
        'under a minute it prints whole seconds, so the shots photograph the clock',
    );
  });

  test('the shots render the same duration whatever the run accrues', () => {
    const s = seeded();
    const expected = formatDuration(s);
    for (let accrued = 0; accrued <= MAX_ACCRUAL_SECONDS; accrued++) {
      assert.equal(
        formatDuration(s + accrued),
        expected,
        `seeded ${s}s + ${accrued}s of the run's own attention renders as ` +
          `"${formatDuration(s + accrued)}" rather than "${expected}", so two runs disagree`,
      );
    }
  });

  test('the guard fires on a value that is not minute-aligned', () => {
    // Non-vacuity: the property above holds for any minute-aligned value, so
    // it has to be shown to fail for one that is not. 9s was the real reading.
    assert.notEqual(
      formatDuration(9),
      formatDuration(9 + MAX_ACCRUAL_SECONDS),
      'formatDuration no longer distinguishes these, so this guard proves nothing',
    );
  });

  test('the seeded attention is actually recorded, not just declared', () => {
    // A constant nothing reads is the failure mode a regex-based guard invites.
    assert.match(
      spec,
      /type:\s*'record-attention',[\s\S]{0,200}?seconds:\s*SEEDED_ATTENTION_SECONDS/,
      'SEEDED_ATTENTION_SECONDS is declared but never passed to record-attention',
    );
  });

  test('every page that weaves is closed before the store is seeded', () => {
    // A taxed page with the content script running keeps writing exposures,
    // so resetting the store while one is open leaves the run's own reading
    // in the list. Closing them is what makes the seeded plan authoritative.
    const reset = spec.indexOf("type: 'reset-vocabulary'");
    assert.notEqual(reset, -1, 'nothing resets the vocabulary — has the message been renamed?');
    for (const page of taxedPages()) {
      assert.notEqual(
        page.closed,
        -1,
        `\`${page.name}\` loads a taxed page over HTTP and is never closed, so it goes on ` +
          'recording exposures for the whole run',
      );
      assert.ok(
        page.closed < reset,
        `\`${page.name}\` is still open when reset-vocabulary runs, so the words it reads land ` +
          'in the vocabulary list after the reset and the seeded plan is not the whole store',
      );
    }
  });

  test('the derivation sees every HTTP navigation in the spec', () => {
    // Non-vacuity, and the failure the loop above invites: if
    // `context.newPage()` is ever renamed or wrapped in a helper, the
    // derivation matches nothing and the loop passes over an empty list.
    // Counting the navigations independently is what makes that loud.
    const navigated = [...spec.matchAll(/await (\w+)\.goto\(`\$\{origin\}/g)].map((m) => m[1]!);
    assert.ok(navigated.length > 0, 'no page in the spec navigates to the local server any more');
    assert.deepEqual(
      [...new Set(navigated)].sort(),
      taxedPages()
        .map((p) => p.name)
        .sort(),
      'a page navigates to the local server but the newPage() derivation did not find it, so ' +
        'the close-before-reset guard above is silently skipping it',
    );
  });

  test('the cooldown the seeding queues is cancelled before anything is shot', () => {
    // An import of default settings over a configured density is a difficulty
    // reduction, so it queues a pending change and the options shots grow a
    // "One change is waiting" banner that no user journey produces.
    const cancelled = spec.indexOf("type: 'cancel-pending'");
    // Anchored on the shots table's own entry, not on the file name: the
    // file name also appears in a comment above, which this first matched.
    const firstShot = spec.indexOf("['onboarding.html'");
    assert.notEqual(cancelled, -1, 'nothing cancels the change the import queues');
    assert.notEqual(firstShot, -1, 'the shots table no longer starts at onboarding.html');
    assert.ok(
      cancelled < firstShot,
      'the pending change is cancelled after the options shots are taken, so they still show it',
    );
  });

  test('the vocabulary store is reset before the plan is imported', () => {
    // Order is the whole point. A reset *after* the import wipes the plan and
    // leaves the shots empty; no reset at all lets the run's own reading in.
    const reset = spec.indexOf("type: 'reset-vocabulary'");
    const imported = spec.indexOf("type: 'import-data'");
    assert.notEqual(reset, -1, 'nothing resets the vocabulary, so the run adds its own words');
    assert.notEqual(imported, -1, "the seeded plan is no longer imported — has 'import-data' moved?");
    assert.ok(
      reset < imported,
      'reset-vocabulary runs after import-data, which erases the seeded plan instead of the ' +
        'words the run happened to read',
    );
  });
});

/**
 * The instant the spec draws the extension's surfaces at, read out of it.
 *
 * A local date and time, the way the dashboard reads a day key itself —
 * `new Date(`${d.day}T12:00:00`)` — so a run in any time zone prints the
 * same day.
 */
function held(): { literal: string; at: number } {
  const m = /HELD_AT\s*=\s*new Date\('(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})'\)\.getTime\(\)/.exec(spec);
  assert.ok(
    m,
    "screenshots.spec.ts declares no HELD_AT = new Date('YYYY-MM-DDTHH:MM:SS').getTime(), so " +
      'dashboard.png prints the day the generator runs on and differs from its commit every ' +
      'other day',
  );
  return { literal: m[1]!, at: new Date(m[1]!).getTime() };
}

/** How long before the held instant the plan is written, read out of the spec. */
function lead(): number {
  const m = /SEEDED_AT\s*=\s*HELD_AT\s*-\s*([\d_]+);/.exec(spec);
  assert.ok(m, 'screenshots.spec.ts declares no SEEDED_AT = HELD_AT - <ms>;');
  return Number(m[1]!.replace(/_/g, ''));
}

/** The seeded plan's reviewed cards: lemma, stability in days, days since review. */
function plan(): Array<{ lemma: string; stability: number; ago: number }> {
  const start = spec.indexOf('const plan');
  assert.notEqual(start, -1, 'the seeded plan is no longer `const plan` — has it been renamed?');
  const block = spec.slice(start, spec.indexOf('];', start));
  const rows = [...block.matchAll(/\['([^']+)', (\d+), ([\d.]+), (\d+), (\d+)\]/g)];
  assert.ok(rows.length >= 10, `only ${rows.length} rows of the plan were read`);
  return rows
    .filter((r) => Number(r[2]) > 0)
    .map((r) => ({ lemma: r[1]!, stability: Number(r[3]), ago: Number(r[4]) }));
}

/** The calendar day of `ts` in local time, as `dayKey` writes one. */
const localDay = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/*
 * `dashboard.png` prints three dates in its attention chart — the first
 * day, the peak and the last — and one in the change log, so a plain
 * regeneration differed from its commit by those four on every day but the
 * one it was taken. From 13:00 BST on 2026-10-03 no time zone held the 2nd
 * that the rebaseline had drawn, so `TZ=` could not buy it back either.
 *
 * The two dates come from two clocks. The chart is drawn from the page's
 * own `Date.now()`, but the change log's entry is stamped by the background
 * worker when the import queues a change and the spec cancels it, and the
 * attention the chart plots is filed under the worker's day. Holding the
 * page alone would have moved the chart's labels and left the log on the
 * real day — and filed the seeded half hour under a day the held chart
 * does not show.
 */
describe('the documentation screenshots hold the date', () => {
  const firstShot = (): number => {
    const at = spec.indexOf("['onboarding.html'");
    assert.notEqual(at, -1, 'the shots table no longer starts at onboarding.html');
    return at;
  };

  test('the extension pages are drawn at the held instant', () => {
    held();
    const fixed = spec.search(/context\.clock\.setFixedTime\(HELD_AT\)/);
    assert.notEqual(
      fixed,
      -1,
      "no context.clock.setFixedTime(HELD_AT), so the dashboard's chart reads its days off the " +
        'wall clock',
    );
    assert.ok(
      fixed < firstShot(),
      'the page clock is held after the first extension surface is shot, so the shots before ' +
        'it are drawn on the real day',
    );
  });

  test("the worker's clock is held before it stamps anything the dashboard prints", () => {
    const call = spec.indexOf('await holdWorkerClock(worker, SEEDED_AT)');
    assert.notEqual(
      call,
      -1,
      "the background worker's clock is never held, so the change log prints the real day",
    );
    assert.match(
      spec,
      /async function holdWorkerClock\([\s\S]*?\.evaluate\([\s\S]*?globalThis\.Date\s*=/,
      'holdWorkerClock does not replace Date inside the worker, so it holds nothing',
    );
    for (const stamp of ["type: 'import-data'", "type: 'cancel-pending'", "type: 'record-attention'"]) {
      const at = spec.indexOf(stamp);
      assert.notEqual(at, -1, `the spec no longer sends ${stamp} — has it moved?`);
      assert.ok(
        call < at,
        `${stamp} reaches the worker before its clock is held, so what it stamps is dated by the ` +
          'wall clock',
      );
    }
    // A restarted worker comes back on the real clock, and the first thing
    // it does is read the step back as tampering. Checking the held worker
    // is still the one answering is what turns that into a failed run
    // rather than a quietly wrong shot.
    const check = spec.search(/expect\(await worker\.evaluate\(\(\) => Date\.now\(\)\)\)/);
    assert.ok(
      check > call && check < firstShot(),
      'nothing checks the held worker is still running before the extension surfaces are shot',
    );
  });

  test('the seeded cards are dated from the held clock', () => {
    // "Due in 3d" and "97% held" are the distance from a card's last review
    // to the page's now. Seeded from the wall clock, they would be read
    // against a page held somewhere else.
    assert.match(spec, /const now = SEEDED_AT;/, 'the seeded plan is not dated from SEEDED_AT');
    assert.doesNotMatch(
      spec,
      /const now = Date\.now\(\)/,
      'the seeded plan is dated from the wall clock while the pages are held',
    );
    assert.ok(lead() > 0, 'the plan is written at the instant the pages are drawn, not before it');
  });

  test('every reviewed card in the plan is clear of its 90% line when the page is drawn', () => {
    // "N words are slipping" counts the cards below 90% retrievability, and
    // a card reviewed as many days ago as its stability sits exactly on the
    // line at the seeding instant — so drawn there, the count is a question
    // of the last bit of Math.pow. `oiseau` is such a card, and the first
    // held run counted 3 where every earlier one had counted 4.
    const at = held().at;
    const card = (row: { stability: number; ago: number }, seeded: number): MemoryCard => ({
      id: 'fr:x',
      target: 'fr',
      lemma: 'x',
      stability: row.stability,
      difficulty: 5,
      lastReview: seeded - row.ago * 86_400_000,
      reps: 1,
      lapses: 0,
      exposures: 1,
      firstSeen: 0,
    });
    const onTheLine = (seeded: number): string[] =>
      plan()
        .filter((row) => Math.abs(cardRetrievability(card(row, seeded), at) - 0.9) < 1e-9)
        .map((row) => row.lemma);
    assert.deepEqual(
      onTheLine(at - lead()),
      [],
      'these cards sit on their 90% line when the page is drawn, so whether they count as ' +
        'slipping is a rounding error',
    );
    // Non-vacuity: seeded at the instant itself, the plan does put one there.
    assert.ok(onTheLine(at).length > 0, 'no card in the plan sits on its line at the seeding instant');
  });

  test('the held instant is ahead of every real one', () => {
    // The worker has already read the real time by the time a spec can
    // reach it, and `noteClock` reads any step backwards as tampering —
    // which forces difficulty up and prints itself. So the held instant has
    // to be later than now, and stay so: only its month and day are printed.
    const { literal, at } = held();
    assert.ok(
      at - Date.now() > 365 * 86_400_000,
      `HELD_AT is ${literal}, which is not a year ahead of the wall clock; move its year on ` +
        'and keep the month and day, which are all the shots print',
    );
  });

  test('the chart and the change log name the same day at the held instant', () => {
    // The chart labels its bars by `dayKey`, which rolls over at 04:00; the
    // change log prints the calendar day. Between midnight and four they
    // disagree — correct, and it reads as a bug in documentation art.
    const rollover = defaultSettings(0, 'test').attention.rolloverHour;
    const { literal, at } = held();
    assert.equal(
      dayKey(at, rollover),
      localDay(at),
      `at ${literal} the chart's day is ${dayKey(at, rollover)} and the change log's ` +
        `${localDay(at)}`,
    );
    // Non-vacuity: the same day before the rollover does disagree.
    const early = new Date(`${literal.slice(0, 10)}T00:30:00`).getTime();
    assert.notEqual(dayKey(early, rollover), localDay(early), 'dayKey no longer rolls over late');
  });
});
