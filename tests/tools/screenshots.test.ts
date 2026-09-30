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
 * `Date.now()`, and that was wrong — `dashboard-transparency.png` holds the
 * only visible rendered date in the page and was rock stable. Measured, it
 * was two causes, neither of them a date:
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
import { formatDuration } from '../../src/core/escalation.ts';

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
