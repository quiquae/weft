/**
 * The site builder's one testable claim about dates: every `<lastmod>` in the
 * sitemap comes from the content behind that page. `tests/tools/sitemap.test.ts`
 * covers where a date comes from; this covers whether the builder asks.
 *
 * It runs the real builder into a temporary directory. It must never write
 * into `dist/site`, which is what `npm run site:check` reads.
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentDate } from '../../tools/sitemap.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TOOL = join(ROOT, 'tools/build-site.mjs');
const TODAY = new Date().toISOString().slice(0, 10);

const builtAt = (lang: string): string =>
  JSON.parse(readFileSync(join(ROOT, `src/lexicon/packs/en-${lang}.json`), 'utf8')).meta.builtAt;

/** URL → its `<lastmod>`, or null where the sitemap declines to give one. */
function lastmods(xml: string): Map<string, string | null> {
  const found = new Map<string, string | null>();
  for (const m of xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)) {
    found.set(m[1] as string, m[2] ?? null);
  }
  return found;
}

let dates: Map<string, string | null>;

before(() => {
  const out = mkdtempSync(join(tmpdir(), 'weft-site-'));
  try {
    execFileSync(process.execPath, [TOOL, `--out=${out}`], { stdio: 'pipe' });
    dates = lastmods(readFileSync(join(out, 'sitemap.xml'), 'utf8'));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
  assert.ok(dates.size > 700, `the sitemap came out with only ${dates.size} URLs`);
});

describe('the sitemap dates each page by its own content', () => {
  test('a word page carries the date of the lexicons it is generated from', () => {
    // Every Latin page links to its Old English counterpart and back, so both
    // packs are content for both sets of pages.
    const lexicon = [builtAt('la'), builtAt('ang')].sort().at(-1);
    const [url, lastmod] = [...dates].find(([u]) => /\/latin\/[a-z]/.test(u)) ?? [];

    assert.ok(url, 'no Latin word page reached the sitemap');
    assert.equal(lastmod, lexicon, `${url} is not dated by the lexicon behind it`);
  });

  test('a language index carries the date of its own pack', () => {
    assert.equal(dates.get('https://weft.study/latin/'), builtAt('la'));
  });

  test('a hand-written page carries the commit date of its document', () => {
    // Computed through the same function the builder uses, so this stays a
    // test of the wiring in a shallow checkout — where there are no per-file
    // dates to be had and the honest answer is no <lastmod> at all.
    const expected = contentDate(ROOT, ['docs/PRIVACY.md']);

    assert.equal(dates.get('https://weft.study/privacy'), expected);
  });

  test('no page is dated by the clock', () => {
    // The bug: one `new Date()` for all 711 URLs. Pages whose source really
    // did change today are allowed to say so — what cannot happen again is
    // every page in the sitemap agreeing on one date that is not in any file.
    if (contentDate(ROOT, ['docs/PRIVACY.md']) === null) return; // shallow checkout: no dates to disagree
    const distinct = new Set([...dates.values()]);

    assert.ok(
      distinct.size > 1,
      `all ${dates.size} URLs share one <lastmod> (${[...distinct]}), which is the wall clock, not their content`,
    );
    assert.notEqual([...distinct].join(), TODAY, 'every page claims to have changed today');
  });
});
