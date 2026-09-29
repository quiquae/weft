/**
 * What the site builder writes, checked by reading the pages it wrote.
 *
 * Three unrelated claims live here because they are answered by one build. The
 * builder takes 0.6 s for all 711 pages, but the setup is the awkward part —
 * it must render into a temporary directory and never into `dist/site`, which
 * is what `npm run site:check` reads — so a second suite would duplicate that
 * seam to re-derive the same output.
 *
 *   1. Every `<lastmod>` in the sitemap comes from the content behind that
 *      page. `tests/tools/sitemap.test.ts` covers where a date comes from;
 *      this covers whether the builder asks.
 *   2. No word page states its own descent backwards. See below.
 *   3. No word page starts a second sentence with a lexicon note. See below.
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
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

/**
 * A rendered descent sentence, split at the English descendant it names.
 *
 * Read off the page rather than out of `META`, because the defect this guards
 * is not in either half — it is in where the builder puts the descendant
 * relative to the frame, which only the rendered sentence shows.
 */
type Descent = { page: string; before: string; descendant: string; after: string };

const plain = (html: string): string =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function descentOf(page: string, html: string): Descent | null {
  // The same section renders a bare "Worth knowing" note on entries with no
  // etymon, which has no <strong> and no descent claim to make.
  const para = html.match(/<section class="word__descent">[\s\S]*?<p>([\s\S]*?)<\/p>/)?.[1];
  const split = para?.match(/^([\s\S]*?)<strong>([^<]+)<\/strong>([\s\S]*)$/);
  if (!split) return null;
  return {
    page,
    before: plain(split[1] as string),
    descendant: split[2] as string,
    after: plain(split[3] as string),
  };
}

let dates: Map<string, string | null>;
let descents: Descent[];

before(() => {
  const out = mkdtempSync(join(tmpdir(), 'weft-site-'));
  try {
    execFileSync(process.execPath, [TOOL, `--out=${out}`], { stdio: 'pipe' });
    dates = lastmods(readFileSync(join(out, 'sitemap.xml'), 'utf8'));
    descents = [];
    for (const dir of ['latin', 'old-english']) {
      for (const file of readdirSync(join(out, dir))) {
        const found = descentOf(
          `/${dir}/${file.replace(/\.html$/, '')}`,
          readFileSync(join(out, dir, file), 'utf8'),
        );
        if (found) descents.push(found);
      }
    }
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

/**
 * A word page's whole claim is which word came from which. Saying it backwards
 * is not a typo, it is the page asserting the opposite of the truth, and it is
 * the one sentence a reader arriving from a search result reads first.
 *
 * The rule is one word, and it is narrow for a reason that was measured. The
 * general form — "the descendant must not be the object of a preposition" —
 * is wrong, because most prepositions take the descendant correctly: "the
 * ancestor of November" and "the root of vaccine" both put the English word
 * exactly where it belongs. **from** is the one that cannot: in a sentence
 * about descent it names the source, and the source is the page's own
 * headword. So a frame that ends in "from" captures whatever the builder
 * appends after it and hands the descendant the role the Latin word holds.
 *
 * That is the shape the defect had. `META.la.descent` read "This is the Latin
 * word your English borrowed from" and `wordPage()` appended the descendant,
 * so 312 published Latin pages said English took *novem* **from** *November*.
 * Its Old English sibling, "This is the Old English word that became", takes
 * its object at the end and was right on all 325 of its pages — which is why
 * this is a guard over both languages rather than a fix to one string.
 */
describe('a word page states its descent in the right direction', () => {
  test('no page names its English descendant as the word it came from', () => {
    const offenders = descents.filter((d) => /\bfrom$/i.test(d.before));

    assert.deepEqual(
      offenders.map((d) => d.page).slice(0, 5),
      [],
      `${offenders.length} pages hand the English descendant to "from", which names the source:\n  ${offenders
        .slice(0, 5)
        .map((d) => `${d.page}: "${d.before} ${d.descendant}"`)
        .join('\n  ')}`,
    );
  });

  test('every page with a descent sentence names its own descendant in it', () => {
    // Guards the cheap way out of the rule above: deleting the descendant
    // rather than moving it would satisfy a check that only reads the frame.
    const silent = descents.filter((d) => !d.descendant.trim());

    assert.deepEqual(silent.map((d) => d.page), [], 'a descent sentence renders an empty descendant');
  });

  test('the rule has something to police', () => {
    // A floor, not an exact count, so a new word page does not have to be
    // registered here — but a builder that stops rendering the sentence, or a
    // parser that stops finding it, can no longer pass by inspecting nothing.
    const byLang = (prefix: string) => descents.filter((d) => d.page.startsWith(prefix)).length;

    assert.ok(byLang('/latin/') > 300, `only ${byLang('/latin/')} Latin pages render a descent sentence`);
    assert.ok(
      byLang('/old-english/') > 300,
      `only ${byLang('/old-english/')} Old English pages render a descent sentence`,
    );
  });
});

/**
 * A lexicon note is an appositive fragment, and the word page is the one
 * surface that forgets it.
 *
 * `src/content/tooltip.ts` gives each note its own `<div class="note">` and
 * the descent hub gives it its own `<td>`, so in both places a lowercase
 * opener lands as a caption and reads correctly — which is what the corpus is
 * written for: 141 of the 185 distinct notes across the seven packs begin with
 * a lowercase letter ("a beech-wood tablet", "the near-dweller", "literally
 * 'woman-person'"). The word page alone put the note in the *same* `<p>` as
 * the descent sentence, after that sentence's full stop, so on 55 pages it
 * opened a second sentence in lower case:
 *
 *     This is the Latin word your English mile was borrowed from.
 *     a mile was mīlle passūs, a thousand paces.
 *
 * The fix joins the note into the sentence with a dash rather than moving the
 * corpus, and which corpus to move is what the measurement settled. Of the 99
 * notes that reach a word page, 39 open with a quotation mark around a cited
 * target-language form ("mann" meant a human being of either sex) and 5 open
 * with a proper noun (Jenner, Janus, Argentina, September, November). So
 * capitalising the first letter at render time would have been a silent no-op
 * on 44 of the 99, and on `paene īnsula, almost an island` it would have
 * capitalised a cited Latin phrase. A dash needs no exception list: every
 * capital already in the corpus is required by a name, not by sentence
 * position, so the dash can never produce a spurious one.
 *
 * The rule is therefore about the paragraph, not the letter — one sentence,
 * one full stop, and it comes last. That is strictly stronger than "no
 * sentence starts in lower case", which would have passed all 39 quoted notes
 * and all 5 named ones straight back through.
 */
describe('a word page joins its note to the descent sentence', () => {
  test('no descent paragraph starts a second sentence', () => {
    // `after` is everything the builder puts past the descendant, which is
    // where the note lands. A full stop with text past it is the defect.
    const offenders = descents.filter((d) => /\.\s*\S/.test(d.after));

    assert.deepEqual(
      offenders.map((d) => d.page).slice(0, 5),
      [],
      `${offenders.length} pages append the note after the sentence's full stop instead of joining it:\n  ${offenders
        .slice(0, 5)
        .map((d) => `${d.page}: "…${d.descendant}${d.after}"`)
        .join('\n  ')}`,
    );
  });

  test('the notes are still on the page, joined rather than dropped', () => {
    // Guards the cheap way out of the rule above: deleting the note satisfies
    // a check that only looks for a second full stop. A floor rather than an
    // exact count, so adding a note to a seed lexicon needs no edit here.
    const joined = descents.filter((d) => d.after.includes('—'));

    assert.ok(
      joined.length > 90,
      `only ${joined.length} word pages carry a note joined to the descent sentence`,
    );
    assert.deepEqual(
      joined.filter((d) => !/—\s*\S/.test(d.after)).map((d) => d.page),
      [],
      'a page renders the joining dash with nothing after it',
    );
  });
});
