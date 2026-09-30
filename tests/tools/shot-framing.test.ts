/**
 * No generator may frame a committed shot with `scrollIntoViewIfNeeded`.
 *
 * This is PR #32's finding, applied to the specs it did not look at. That
 * session fixed `store-assets.spec.ts`, where four of the six scrolled
 * captures were cut across a row of content: `apple-04-progress.png` cut the
 * tops off all four progress tiles' digits and `apple-05-settings.png`
 * halved the preset row (the row *above* the target bleeding in), while
 * `chrome-05-settings.png` halved the "Resting density" heading and
 * `edge-05-settings.png` lost it altogether and opened mid-sentence (the
 * target section's own head cut off). `scrollIntoViewIfNeeded` states no
 * alignment: Blink picks one from the element's position and the viewport
 * height, so the landing point is a function of the frame size and the
 * *sign* of the error is not a property of the call.
 *
 * `firstrun.spec.ts:107` had the same call on the same kind of selector,
 * `.section:has(.help__report)`, and nothing saw it. Its shot happens to
 * land correctly at 1000x900 — which is exactly the trap, because the four
 * store shots were byte-stable too, and `artefacts:check` called that group
 * `ok` the whole time they were clipped. A call whose correctness is a
 * coincidence of the viewport height is one options-page edit away from
 * being wrong, silently, in documentation a stranger reads.
 *
 * **The reason it was missed is the guard, not the reviewer.**
 * `store-assets.test.ts` already derives its selector list from the spec
 * rather than typing it out, and says why in as many words: "a hand-written
 * list of the things to check cannot police the thing that was forgotten."
 * But the file it reads is hand-picked. The derivation was *within-file*,
 * and the thing forgotten was a different file — the same lesson one level
 * up. So this guard derives the **specs** too, from the one thing every
 * generator has and no other e2e spec does: an `OUT` directory under
 * `docs/`. A fourth generator is covered without an edit here.
 *
 * It is a fourth `tests/tools/` suite rather than a third `describe` in
 * `store-assets.test.ts`, on the seam argument this repository already uses
 * for `build-site.test.ts`: the rule is not a property of the store listing.
 * It holds across every generator, and a file named for one spec policing
 * three is how the blind spot above got built in the first place.
 *
 * The specs are read as text, never imported — importing a Playwright spec
 * would run `test.describe` at load time.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const E2E = join(ROOT, 'tests/e2e');
const FIXTURES = join(ROOT, 'tests/e2e/fixtures.ts');

/**
 * Every e2e spec that writes a committed artefact, derived rather than
 * listed.
 *
 * The signature is an output directory under `docs/`, which is what makes a
 * spec a generator: it writes files a human uploads to a store or embeds in
 * a document, rather than assertions nobody looks at. `friction`,
 * `licensing`, `privacy` and `weaving` take no screenshots at all and are
 * correctly absent.
 */
const generators = (): { name: string; src: string }[] =>
  readdirSync(E2E)
    .filter((f) => f.endsWith('.spec.ts'))
    .map((name) => ({ name, src: readFileSync(join(E2E, name), 'utf8') }))
    .filter(({ src }) => /const OUT\s*=\s*join\([^;]*['"][^'"]*\.\.\/docs\//.test(src));

/** Every `.section` selector a spec scrolls to, with how it scrolls there. */
const framedSections = (src: string): { selector: string; line: string }[] =>
  src
    .split('\n')
    .filter((line) => /\.section[^'"]*/.test(line) && /scrollIntoViewIfNeeded|frameOn/.test(line))
    .map((line) => ({
      selector: (/['"](\.section[^'"]*)['"]/.exec(line)?.[1] ?? '').trim(),
      line: line.trim(),
    }))
    .filter(({ selector }) => selector !== '');

describe('every generator frames its shots deterministically', () => {
  /*
   * Non-vacuity, and it has two halves because the derivation has two
   * stages. Rename `OUT` and the spec list empties; rename the selectors and
   * every spec looks clean. Either way the loop below runs over nothing and
   * passes, which is the silent skip this suite polices everywhere else.
   */
  test('the generator specs and their framed sections are both found', () => {
    const specs = generators();
    assert.equal(
      specs.length,
      3,
      `found ${specs.length} generator specs (${specs.map((s) => s.name).join(', ') || 'none'}), ` +
        'expected 3 — store-assets, screenshots and firstrun. Has an OUT directory been ' +
        'renamed, or has a fourth generator been added without reading this?',
    );
    const total = specs.reduce((n, { src }) => n + framedSections(src).length, 0);
    assert.ok(
      total >= 3,
      `found ${total} framed sections across the generator specs, expected at least 3 ` +
        '(two in store-assets, one in firstrun) — has a selector or a scroll call been renamed?',
    );
  });

  /*
   * The rule. A section is framed with `frameOn`, which puts its top edge at
   * the top of the shot with an integer `scrollTo` and then asserts, on both
   * sides, that it landed there — so the generator fails rather than writing
   * a clipped shot.
   *
   * Scene 3's word-level `scrollIntoViewIfNeeded()` is deliberately not
   * matched and must not be: it makes a word hoverable rather than framing a
   * shot, and a partly visible line of prose at the top of an article
   * screenshot is what reading an article looks like. That is why this
   * matches on `.section` selectors rather than on the call.
   */
  for (const { name, src } of generators()) {
    test(`${name} frames every section with frameOn()`, () => {
      for (const { selector, line } of framedSections(src)) {
        assert.ok(
          !/scrollIntoViewIfNeeded/.test(line),
          `${name} scrolls '${selector}' with scrollIntoViewIfNeeded, which states no ` +
            'alignment — Blink picks the landing point from the viewport height, which cut a ' +
            `row of content in four of six committed store captures. Use frameOn(). Line: ${line}`,
        );
        assert.match(
          line,
          /frameOn\(/,
          `${name} scrolls '${selector}' by something other than frameOn(), so nothing ` +
            'asserts where the shot landed',
        );
      }
    });
  }
});

/*
 * `frameOn` is shared rather than copied, and this is the half of that which
 * is worth asserting: one implementation means the two-sided assertion
 * cannot be present in one spec and absent in another. A second copy is how
 * `firstrun.spec.ts` came to differ from `store-assets.spec.ts` in the first
 * place.
 */
describe('the shared frameOn helper', () => {
  const fixtures = readFileSync(FIXTURES, 'utf8');

  test('lives in fixtures.ts, so every generator gets the same framing', () => {
    assert.match(
      fixtures,
      /export const frameOn/,
      'no exported frameOn in tests/e2e/fixtures.ts — if it has moved back into a single ' +
        'spec, the other generators are framing their shots some other way',
    );
  });

  test('bounds the landing point on both sides, because two shots erred each way', () => {
    const body = /export const frameOn[\s\S]*?\n};/.exec(fixtures);
    assert.ok(body, 'no frameOn helper body in fixtures.ts — has it been renamed?');
    const src = body[0];
    assert.match(
      src,
      /toBeLessThanOrEqual/,
      'frameOn does not bound the section from above, so the row above it can bleed in — ' +
        'the defect in apple-04-progress.png and apple-05-settings.png',
    );
    assert.match(
      src,
      /toBeGreaterThanOrEqual/,
      'frameOn does not bound the section from below, so a scene can behead the very row ' +
        'it exists to show — the defect in chrome-05 and edge-05-settings.png',
    );
    /*
     * Integer, because a fractional scroll offset shifts subpixel text
     * rendering and these files are diffed byte for byte. `Math.ceil` rather
     * than `Math.round` so the rounding error is spent on the section's own
     * top padding rather than on a sliver of the row above it.
     */
    assert.match(
      src,
      /Math\.ceil/,
      'frameOn does not round its scroll offset up to an integer, so the landing point can ' +
        'be fractional — which shifts subpixel text rendering in files compared byte for byte',
    );
  });
});
