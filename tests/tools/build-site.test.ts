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
 *   4. Every headword gets a page, no two pages share a path, and none prints
 *      a homograph number. See below.
 *   5. A word page's address spells every letter of its headword. See below.
 *   6. Every page's header draws the mark that ships as the icon. See below.
 *   7. No page about Latin says English descends from it. See below.
 *   8. The landing page's descent tables say what the packs say. See below.
 *   9. No page quotes in straight marks but the three that print another
 *      document's copy. See below.
 *  10. A word page prints the pronunciation key the tooltip prints. See below.
 *  11. Nothing the site builds is a file the deploy leaves out. See below.
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentDate } from '../../tools/sitemap.ts';
import { getLanguage } from '../../src/core/languages.ts';
import { entriesByTarget, spelling } from '../../src/core/lexicon.ts';
import { SITE_URL } from '../../src/core/site.ts';
import type { LangCode, LexEntry } from '../../src/core/types.ts';
import { markInSvg, differences, type MarkReading } from './mark-reading.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TOOL = join(ROOT, 'tools/build-site.mjs');
const TODAY = new Date().toISOString().slice(0, 10);

const builtAt = (lang: string): string =>
  JSON.parse(readFileSync(join(ROOT, `src/lexicon/packs/en-${lang}.json`), 'utf8')).meta.builtAt;

/**
 * The two languages that get a page per word. Mirrors `DEEP` in the builder,
 * with the descent hub `descentHub()` writes for each.
 */
const DEEP = [
  { lang: 'la', dir: 'latin', hub: 'latin-words-in-everyday-english' },
  { lang: 'ang', dir: 'old-english', hub: 'old-english-words-that-became-english' },
];

/**
 * Every word a pack carries, which is one page each, as the page should
 * name it: its spelling and the English it glosses.
 *
 * Read off `tgtLemma` rather than off the surface forms, because the packs
 * hold a row per inflected form and the builder collapses them: `mouth` and
 * `mouths` are two rows of one headword and so one page. The gloss is the
 * word's first singular row, which is the one its page prints.
 *
 * The spelling is the headword with its homograph number taken off — `hund²`
 * is the second word spelled hund, the hundred — and it is taken off here
 * rather than by the builder's own function, so that a number the builder
 * failed to remove reaches the comparison and fails it.
 */
function headwords(lang: string, drafted = false): Set<string> {
  const pack = JSON.parse(readFileSync(join(ROOT, `src/lexicon/packs/en-${lang}.json`), 'utf8'));
  const rows = new Map<string, { lemma: string; num?: string }[]>();
  for (const list of Object.values(pack.entries) as { tgtLemma: string; lemma: string; num?: string; drafted?: boolean }[][]) {
    for (const e of list) if (Boolean(e.drafted) === drafted) rows.set(e.tgtLemma, [...(rows.get(e.tgtLemma) ?? []), e]);
  }
  const found = new Set<string>();
  for (const [word, same] of rows) {
    const head = same.find((e) => e.num !== 'pl') ?? same[0];
    found.add(`${word.replace(/[²³⁴⁵⁶⁷⁸⁹]$/u, '')} — ${head?.lemma}`);
  }
  return found;
}

/** Any superscript digit, which is what a homograph number is written with. */
const SUPERSCRIPT_DIGIT = /[⁰¹²³⁴⁵⁶⁷⁸⁹]/u;

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
/** Which word each page is *about*, by directory — its rendered headword and the English it glosses. */
let targets: Map<string, Set<string>>;
/** Every rendered page that prints a superscript digit anywhere, with the text around it. */
let numberedPages: string[];
/** Every word page's address beside the headword it is the page for. */
let words: { page: string; slug: string; headword: string }[];
/** Every `<loc>` the sitemap declares, **with duplicates kept**, and the file each resolves to. */
let served: { loc: string; file: string | null }[];
/** Every rendered page and the mark its header draws, or null where it draws none. */
let headers: { page: string; mark: MarkReading | null }[];
/**
 * Every page a deep language has — its words, its index, its hub — as it
 * reads, and in `own` with everything the pack itself says blanked out, which
 * leaves the builder's words where they stood.
 */
let told: { lang: LangCode; page: string; text: string; own: string }[];
/** The landing page as the site serves it. */
let landing: string;
/** Every page the site serves, as it reads. */
let pages: { page: string; text: string }[];
/** Every pronunciation key a word page prints, as it reads, beside the language it is the key to. */
let keys: { page: string; lang: LangCode; printed: string }[];
/** Every path the build wrote, files and directories, relative to the site's root. */
let written: string[];

before(() => {
  const out = mkdtempSync(join(tmpdir(), 'weft-site-'));
  try {
    execFileSync(process.execPath, [TOOL, `--out=${out}`], { stdio: 'pipe' });
    written = readdirSync(out, { recursive: true }) as string[];
    const xml = readFileSync(join(out, 'sitemap.xml'), 'utf8');
    dates = lastmods(xml);
    landing = readFileSync(join(out, 'index.html'), 'utf8');
    descents = [];
    targets = new Map();
    words = [];
    keys = [];
    for (const { lang, dir } of DEEP) {
      targets.set(dir, new Set());
      for (const file of readdirSync(join(out, dir))) {
        const html = readFileSync(join(out, dir, file), 'utf8');
        const slug = file.replace(/\.html$/, '');
        const found = descentOf(`/${dir}/${slug}`, html);
        if (found) descents.push(found);
        const key = html.match(/<p class="word__pronNote">([^<]*)<\/p>/)?.[1];
        if (key !== undefined) keys.push({ page: `/${dir}/${slug}`, lang: lang as LangCode, printed: readable(key).trim() });
        // The index page in the same directory carries no word heading.
        const h1 = html.match(/<h1 class="word__target"[^>]*>([^<]+)<\/h1>/);
        if (!h1) continue;
        const gloss = html.match(/<p class="word__gloss">[^<]*<strong>([^<]+)<\/strong>/)?.[1];
        (targets.get(dir) as Set<string>).add(`${h1[1]} — ${gloss}`);
        words.push({ page: `/${dir}/${slug}`, slug, headword: h1[1] as string });
      }
    }
    // Every page, the hand-written landing page among them: it is copied in
    // from `site/` rather than rendered, which is exactly why it has to be
    // read here and not assumed to follow the template.
    numberedPages = [];
    pages = [];
    headers = (readdirSync(out, { recursive: true }) as string[])
      .filter((file) => file.endsWith('.html'))
      .map((file) => {
        const html = readFileSync(join(out, file), 'utf8');
        pages.push({ page: `/${file}`, text: readable(html) });
        // Only the pages built from the packs: a privacy policy may one day
        // have a footnote, which is not a homograph number.
        const fromPacks = /^(?:latin|old-english)\//.test(file) || /-words-/.test(file);
        const at = fromPacks ? html.search(SUPERSCRIPT_DIGIT) : -1;
        if (at !== -1) numberedPages.push(`/${file}: …${html.slice(Math.max(0, at - 40), at + 2)}`);
        const svg = html.match(/<div class="brand">[\s\S]*?(<svg[\s\S]*?<\/svg>)/)?.[1];
        return { page: `/${file}`, mark: svg ? markInSvg(svg) : null };
      });
    // Deliberately a list and not a Map: a duplicated <loc> is the defect, so
    // keying by URL here would discard the very thing being counted.
    served = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
      // The site is served under SITE_URL's path, '/weft', and built at the root of `out`.
      const base = new URL(SITE_URL).pathname.replace(/\/$/, '');
      const rel = new URL(m[1] as string).pathname.slice(base.length).replace(/^\//, '');
      const target = join(out, rel);
      const file = [target, `${target}.html`, join(target, 'index.html')].find(
        (c) => existsSync(c) && statSync(c).isFile(),
      );
      return { loc: m[1] as string, file: file ? file.slice(out.length) : null };
    });
    told = DEEP.flatMap(({ lang, dir, hub }) => {
      const said = packSays(lang);
      // The hub by name, so a renamed hub fails here rather than going unread.
      return [...readdirSync(join(out, dir)).map((f) => join(dir, f)), `${hub}.html`].map((file) => {
        const text = readable(readFileSync(join(out, file), 'utf8'));
        // Blanked rather than cut, so a match in what is left can be quoted
        // from the page as the page has it.
        const own = text.replace(said, (m) => ' '.repeat(m.length));
        return { lang: lang as LangCode, page: `/${file.replace(/\.html$/, '')}`, text, own };
      });
    });
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
    assert.equal(dates.get(`${SITE_URL}/latin/`), builtAt('la'));
  });

  test('a hand-written page carries the commit date of its document', () => {
    // Computed through the same function the builder uses, so this stays a
    // test of the wiring in a shallow checkout — where there are no per-file
    // dates to be had and the honest answer is no <lastmod> at all.
    const expected = contentDate(ROOT, ['docs/PRIVACY.md']);

    assert.equal(dates.get(`${SITE_URL}/privacy`), expected);
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
    // Latin's sat at 300 exactly on 2026-10-03, once the descent pass had
    // taken 13 false claims off their pages, so its floor sits well below.
    const byLang = (prefix: string) => descents.filter((d) => d.page.startsWith(prefix)).length;

    assert.ok(byLang('/latin/') > 250, `only ${byLang('/latin/')} Latin pages render a descent sentence`);
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

/**
 * A page per headword, and one headword per page.
 *
 * `slugify()` strips diacritics so URLs stay ASCII and typeable, and the
 * doc comment on `tools/check-links.mjs` names the risk that creates in as
 * many words — "one collision … and a reader hits a 404". A collision does
 * not produce a 404. It produces the opposite: both links resolve, because
 * the second page written *overwrites* the first and is a perfectly valid
 * file. That is why `site:check` passed on 16 087 links while two Latin
 * words had no page at all.
 *
 * Latin is where it bites, because vowel length is the whole distinction
 * between two different words and a macron is exactly what gets stripped:
 * `ōs` (mouth, → *oral*) and `os` (bone, → *ossify*) both slugged to `os`,
 * and `liber` (book, → *library*) and `līber` (free, → *liberty*) both to
 * `liber`. The lexicon knows: the note on `os` reads "distinct from “ōs”,
 * mouth, only by vowel length". Both hub pages then printed two rows, one
 * labelled `os` and one `ōs`, pointing at the same URL — so a reader
 * clicking "ōs / mouth" arrived at a page saying English *ossify* was
 * borrowed from it. A false etymology, which is worse than a 404.
 *
 * Both tests are derived rather than listed — the first from the packs, the
 * second from the sitemap the builder just wrote — so a seed edit that
 * introduces a third collision fails here without an edit to this file, in
 * either language.
 *
 * One spelling can also be two words on purpose: Old English `hund` is a dog
 * and a hundred, and the seed writes the second `hund²`. Both pages are
 * headed hund, so a page is matched by its headword *and* its gloss, and the
 * number, which only tells the two cards apart, must appear on neither.
 */
describe('every headword gets its own page', () => {
  for (const { lang, dir } of DEEP) {
    test(`no ${dir} headword is overwritten by another that slugs the same`, () => {
      // By spelling *and* gloss, because one spelling can be two words: Old
      // English hund is a dog and a hundred, and each is a page.
      const rendered = targets.get(dir) as Set<string>;
      const lost = [...headwords(lang)].filter((w) => !rendered.has(w));

      assert.deepEqual(
        lost,
        [],
        `${lost.length} ${dir} headwords have no page of their own: ${lost.join(', ')}`,
      );
    });
  }

  test('no page is built from a row nobody has read', () => {
    // A drafted row is woven and labelled unreviewed in the tooltip; a page is
    // published copy, held to the rows a person has read.
    const drafted = DEEP.flatMap(({ lang, dir }) => [...headwords(lang, true)].map((w) => ({ dir, w })));
    assert.ok(drafted.length >= 50, `only ${drafted.length} drafted headwords were read, so the rule polices nothing`);
    const paged = drafted.filter(({ dir, w }) => (targets.get(dir) as Set<string>).has(w));
    assert.deepEqual(paged.map(({ dir, w }) => `/${dir}: ${w}`), [], `${paged.length} pages were built from drafted rows`);
  });

  test('no page prints a homograph number', () => {
    // `hund²` is the card's identity, not anything a reader is shown: the
    // page for the hundred is headed hund, like the page for the dog, and
    // told apart by its gloss and its address.
    assert.deepEqual(numberedPages, [], `${numberedPages.length} pages print a homograph number:\n  ${numberedPages.join('\n  ')}`);
  });

  test('no two sitemap entries serve the same page', () => {
    const byFile = new Map<string, string[]>();
    for (const { loc, file } of served) {
      if (!file) continue;
      if (!byFile.has(file)) byFile.set(file, []);
      (byFile.get(file) as string[]).push(loc);
    }
    const shared = [...byFile.values()].filter((ls) => ls.length > 1);

    assert.deepEqual(
      shared,
      [],
      `${shared.length} pages are advertised under more than one URL, so one page overwrote another:\n  ${shared
        .map((ls) => ls.join(' = '))
        .join('\n  ')}`,
    );
  });

  test('every sitemap entry has a page behind it', () => {
    // The complement, and the one `site:check` cannot ask: it walks the HTML
    // for href/src and never opens sitemap.xml, which is the file a crawler
    // reads first.
    const dead = served.filter((s) => !s.file).map((s) => s.loc);

    assert.deepEqual(dead, [], `${dead.length} sitemap URLs 404`);
    assert.ok(served.length > 700, `the sitemap came out with only ${served.length} URLs`);
  });
});

/**
 * A word page's address spells the whole of its headword.
 *
 * `slugify()` folds a headword to ASCII so that an address can be typed and
 * said aloud: marks come off, and the letters ASCII lacks are spelled out —
 * þ and ð as th, æ as ae. It spelled those letters *before* it took the word
 * apart, and a letter that arrives precomposed with its mark is not yet the
 * letter the table knows: `ǣ` is one code point, U+01E3. So `ǣ` slipped past
 * the rule for `æ`, came apart into `æ` and a macron, lost the macron, and
 * fell to the catch-all that turns anything else into a hyphen. 22 Old
 * English headwords lost their ǣ that way, and the worst were wrong rather
 * than ugly: `sǣ`, sea, was `/old-english/s`, and `ǣfen`, evening, was
 * `/old-english/fen`, which is an English word for something else. Every
 * link to them resolved, so `site:check` had nothing to say.
 *
 * The fold is written out here rather than borrowed from the builder,
 * because the defect was in the order of the builder's steps and a copy would
 * have copied the order. It takes the word apart first, by construction, and
 * it refuses a letter it has no spelling for instead of hyphenating it — the
 * same silent drop, arriving with a letter nobody has added yet. A slug may
 * run on past the fold: that is the English word `assignSlugs()` appends when
 * two headwords fold alike, which the suite above polices.
 */
const SPELLED: Record<string, string> = { æ: 'ae', œ: 'oe', þ: 'th', ð: 'th', ƿ: 'w', ȝ: 'g', ſ: 's' };

/** A headword's letters with their marks taken off, one string per letter. */
const bare = (word: string): string[] => [...word.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')];

/** The ASCII a headword's address should spell, or the first letter nothing spells. */
function fold(word: string): { ascii: string } | { unspelled: string } {
  let ascii = '';
  for (const ch of bare(word)) {
    if (/[a-z0-9]/.test(ch)) ascii += ch;
    else if (ch in SPELLED) ascii += SPELLED[ch];
    else if (/[\p{L}\p{N}]/u.test(ch)) return { unspelled: ch };
    else ascii += '-';
  }
  return { ascii: ascii.replace(/-+/g, '-').replace(/^-|-$/g, '') };
}

describe('a word page’s address spells every letter of its headword', () => {
  test('no address drops a letter of the word it is the page for', () => {
    const offenders = words.flatMap((w) => {
      const f = fold(w.headword);
      if ('unspelled' in f) return [`${w.page} is ${w.headword}, and nothing spells its ${f.unspelled}`];
      const kept = w.slug === f.ascii || w.slug.startsWith(`${f.ascii}-`);
      return kept ? [] : [`${w.page} is ${w.headword}, which spells ${f.ascii}`];
    });

    assert.deepEqual(
      offenders.slice(0, 5),
      [],
      `${offenders.length} word pages are published at an address that drops a letter of their headword:\n  ${offenders
        .slice(0, 5)
        .join('\n  ')}`,
    );
  });

  test('the rule has something to police', () => {
    // Floors, not exact counts, so a new headword needs no edit here. The
    // second is the one that matters: a letter the table spells reaching the
    // fold only once its mark is off is the case that slipped, and a rule
    // that no longer meets it cannot show the case is closed.
    const spelled = words.filter((w) => bare(w.headword).some((ch) => ch in SPELLED));
    const precomposed = words.filter((w) =>
      [...w.headword.toLowerCase()].some((ch) => !(ch in SPELLED) && bare(ch).some((b) => b in SPELLED)),
    );

    assert.ok(words.length > 600, `only ${words.length} word pages were read`);
    assert.ok(spelled.length > 50, `only ${spelled.length} headwords need a letter spelled out`);
    assert.ok(precomposed.length > 0, 'no headword carries a spelled letter precomposed with its mark');
  });
});

/**
 * The mark in the header of every page is the mark on the toolbar.
 *
 * It was not, for nine days. `0d9910e` redrew the mark so that the weft
 * crosses every warp thread but the last, and it changed the rasters; the
 * header of all 713 pages went on drawing the one it replaced, because the
 * header's SVG was written out by hand — once in the page template and once
 * more in `site/index.html` — and neither copy knew the geometry had moved.
 * `site:check` passed throughout, as it should have: every link resolved.
 *
 * Compared against `assets/icon.svg`, which a sibling test in
 * `brand.test.ts` holds to the 128px raster, so the chain from a page header
 * back to the pixels a browser toolbar shows has no hand-copied link in it.
 * Read off the rendered pages rather than out of the template, so the one
 * page that is copied in and not rendered is checked exactly as the others.
 */
describe('every page carries the mark that ships as the icon', () => {
  test('the header of every page draws what assets/icon.svg draws', () => {
    const icon = markInSvg(readFileSync(join(ROOT, 'assets/icon.svg'), 'utf8'));
    assert.ok(icon, 'assets/icon.svg draws no mark');
    // Non-vacuity floor: a walk that found no pages would pass on nothing.
    assert.ok(headers.length > 700, `only ${headers.length} pages were rendered`);

    // Both come from one generator, so they agree to the last digit written.
    const wrong = headers.filter((h) => !h.mark || differences(h.mark, icon, 0.005).length > 0);
    const first = wrong[0];
    const how = !first
      ? ''
      : first.mark
        ? differences(first.mark, icon, 0.005, [first.page, 'assets/icon.svg']).join('; ')
        : `${first.page} draws no mark in its header at all`;

    assert.deepEqual(
      wrong.map((h) => h.page).slice(0, 5),
      [],
      `${wrong.length} of ${headers.length} pages carry a different mark from the icon — ${how}`,
    );
  });
});

/**
 * A page about Latin never says that English descends from it.
 *
 * English descends from Old English and borrowed from Latin, and the product
 * tells the two in different verbs: the Latin word pages say "your English
 * *vaccine* was borrowed from", the feed "English borrowed vaccine from
 * vacca", and #49 took Old English's verbs out of the feed's Latin lines,
 * where "rēx survived into English as regal" had stood on 232 of 314. The
 * Latin index kept them for a day longer, in a string of its own: its
 * description, the two social copies of it and its structured data said the
 * Latin words had "the English word they became", its lead "the English word
 * they turned into", and its title "their English descendants". Its word
 * pages had it right throughout, down to the description a search result
 * prints: Latin's says "the source of English vaccine" where Old English's
 * says "the direct ancestor of English mouse".
 *
 * Read off every page a deep language has, in the builder's own words. The
 * pack's own English — its glosses, the English words it names, its notes —
 * is taken out first, because a note is the lexicon's sentence and is held to
 * its dictionary by `tests/tools/la-notes.test.ts`: "“very” descends from
 * vērus" is a note about a French route, and is that file's business. Which
 * language is which comes from `ancestorOfEnglish` in the language table,
 * whose own guard is `tests/tools/feed-frames.test.ts`.
 */
const DESCENT =
  /\b(?:became|turned into|descendants?|descends? from|ancestors? of|survived into|comes straight from|began as)\b/i;

/**
 * What a page says to a reader and to a crawler: its body, and from its head
 * the title and descriptions a search result and a shared link print. A
 * script is read only for the structured data's own sentences, because the
 * rest of it is addresses, and an address spells a headword.
 */
function readable(html: string): string {
  const strings = (v: unknown): string[] =>
    typeof v === 'string'
      ? /^https?:\/\//.test(v)
        ? []
        : [v]
      : v && typeof v === 'object'
        ? Object.values(v).flatMap(strings)
        : [];
  const head = [...html.matchAll(/<meta\b[^>]*\bcontent="([^"]*)"/g)].map((m) => m[1] as string);
  const data = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) =>
    strings(JSON.parse(m[1] as string)),
  );
  const body = html.replace(/<script\b[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');
  return [...head, ...data, body]
    .join(' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

/** Everything a pack says in English, as one pattern matching any of it as whole words, longest first. */
function packSays(lang: string): RegExp {
  const pack = JSON.parse(readFileSync(join(ROOT, `src/lexicon/packs/en-${lang}.json`), 'utf8'));
  const said = new Set<string>();
  for (const list of Object.values(pack.entries) as Record<string, string | undefined>[][]) {
    for (const e of list) for (const s of [e.src, e.lemma, e.etymonOf, e.note]) if (s) said.add(s);
  }
  const alternatives = [...said]
    .sort((a, b) => b.length - a.length)
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}])`, 'gu');
}

describe('a page about a language English borrowed from never says English descends from it', () => {
  test('no Latin page tells a borrowing in the verbs of descent', () => {
    // Every occurrence, not every page: the index printed its description
    // four times — in the head, twice for a shared link, and once in its
    // structured data — and its title three.
    const offenders = told
      .filter((t) => !getLanguage(t.lang).ancestorOfEnglish)
      .flatMap((t) =>
        [...t.own.matchAll(new RegExp(DESCENT, 'gi'))].map((m) => {
          const at = m.index as number;
          return `${t.page}: “…${t.text.slice(Math.max(0, at - 50), at + m[0].length + 10).trim()}…”`;
        }),
      );

    assert.deepEqual(
      offenders.slice(0, 10),
      [],
      `a page says English descends from a language it borrowed from, ${offenders.length} times:\n  ${offenders
        .slice(0, 10)
        .join('\n  ')}`,
    );
  });

  test('the verbs are still found where they are true', () => {
    // The control. A pattern that matched nothing would pass every Latin page
    // above; Old English is told in these verbs on every page with a claim,
    // in the builder's words, so the pattern has to keep finding them there.
    const ancestral = told.filter((t) => getLanguage(t.lang).ancestorOfEnglish);
    const found = ancestral.filter((t) => DESCENT.test(t.own));

    assert.ok(found.length > 300, `only ${found.length} of ${ancestral.length} Old English pages say became`);
  });

  test('the rule has something to police', () => {
    // A floor, so a new word page needs no edit here: every Latin page is read,
    // the index and the hub among them.
    const latin = told.filter((t) => t.lang === 'la').map((t) => t.page);

    assert.ok(latin.length > 300, `only ${latin.length} Latin pages were read`);
    assert.ok(latin.includes('/latin/index'), 'the Latin index was not read');
    assert.ok(latin.includes('/latin-words-in-everyday-english'), 'the Latin descent hub was not read');
  });
});

/**
 * The landing page's descent tables, held to the packs they quote.
 *
 * `site/index.html` is written by hand and cannot import, so every row of its
 * two tables was typed from a pack: seven French words with the claim each
 * carries, then five Old English and three Latin words with the English word
 * each became or was borrowed into. Twice in two days a row had to be
 * corrected by hand after its pack moved — *drēam → dream* when the Old
 * English pack stopped claiming it, the vaccine row when its note stopped
 * saying Jenner named it — and both times somebody remembered. Nothing read
 * the tables; `tests/tools/lexicon-orthography.test.ts` checks only how they
 * spell.
 *
 * A row's word is read through `entriesByTarget()`, as the tooltip, the
 * dashboard and the word pages read one, so the table is held to what the
 * product shows rather than to a row of the seed.
 *
 * What a row claims is derived wherever the pack says it in a form a test can
 * read. A French row's English is the word's gloss, and its claim is either a
 * descent — "English took the word itself", which is the word's etymon being
 * that gloss — or a cousin note naming exactly the English words the pack's
 * own note names. A deep row's English is the word's etymon, its target read
 * by its first word, so *mīlle passūs* is `mīlle`, and a phrase has to stand
 * in the pack's note as the table prints it.
 *
 * A deep row's note is a paraphrase — the table's "it meant simply “to die”"
 * is the pack's "“steorfan” simply meant to die" — and a paraphrase cannot be
 * derived, so it is ledgered. `CHECKED` repeats each cell beside the note it
 * was read against, as `tools/seed/la-notes.tsv` repeats a Latin note, and a
 * move on either side leaves the row unchecked until somebody reads the two
 * together again. A cell may stay empty: silence is never false.
 */
const CHECKED: readonly { row: string; cell: string; note: string }[] = [
  { row: 'hlāford', cell: 'literally “loaf-keeper”', note: '“hlāf-weard”, the loaf-keeper' },
  { row: 'steorfan', cell: 'it meant simply “to die”', note: '“steorfan” simply meant to die' },
  { row: 'sellan', cell: 'it meant “to give”', note: '“sellan” meant to give' },
  { row: 'vacca', cell: 'named after the cowpox Jenner used', note: 'the vaccine is named after the cowpox Jenner used' },
  { row: 'mīlle passūs', cell: 'a thousand paces', note: 'a mile was mīlle passūs, a thousand paces' },
  { row: 'paene īnsula', cell: 'almost an island', note: 'paene īnsula, almost an island' },
];

/** One row of a descent table, cell by cell, and which table it is in. */
type DescentRow = { table: number; cells: number; target: string; english: string; claim: string };

/**
 * Every row of every descent table on the page. The French table comes first
 * and the Latin and Old English one second, which is how the two are told
 * apart: their third columns mean different things, a gloss in the first and
 * the English word the target gave in the second.
 */
function descentRows(html: string): DescentRow[] {
  return [...html.matchAll(/<table class="descent">([\s\S]*?)<\/table>/g)].flatMap((t, table) =>
    [...(t[1] as string).matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) => {
      const cells = [...(r[1] as string).matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((c) => plain(c[1] as string));
      const [target = '', , english = '', claim = ''] = cells;
      return { table, cells: cells.length, target, english, claim };
    }),
  );
}

/** Each word a pack carries, under its spelling, as the product reads it. */
function wordsOf(lang: string): Map<string, LexEntry[]> {
  const pack = JSON.parse(readFileSync(join(ROOT, `src/lexicon/packs/en-${lang}.json`), 'utf8'));
  const found = new Map<string, LexEntry[]>();
  for (const word of entriesByTarget(pack.entries).values()) {
    const key = spelling(word.tgtLemma);
    found.set(key, [...(found.get(key) ?? []), word]);
  }
  return found;
}

/** The words a sentence puts in quotation marks, in order. */
const quoted = (s: string): string[] => [...s.matchAll(/“([^”]+)”/g)].map((m) => m[1] as string);

const TOOK = 'English took the word itself';
const COUSIN = /^shares a root with /;

/** What is wrong with a French row, or null. */
function frenchRow(row: DescentRow, fr: Map<string, LexEntry[]>): string | null {
  const said = `${row.target} → ${row.english}, \`${row.claim}\``;
  const words = fr.get(row.target) ?? [];
  const word = words.find((w) => w.lemma === row.english);
  if (!word) {
    return words.length
      ? `${said}: the pack glosses it ${words.map((w) => `“${w.lemma}”`).join(' and ')}`
      : `${said}: the French pack has no word “${row.target}”`;
  }
  if (row.claim === TOOK) {
    if (word.etymonOf === row.english) return null;
    return `${said}: the pack ${word.etymonOf ? `gives its etymon as “${word.etymonOf}”` : 'names no etymon'}`;
  }
  if (COUSIN.test(row.claim)) {
    if (!word.note || !/^shares a root with English /.test(word.note)) {
      return `${said}: the pack’s note is ${word.note ? `\`${word.note}\`` : 'empty'}`;
    }
    const [table, pack] = [quoted(row.claim), quoted(word.note)];
    if (table.join('|') === pack.join('|')) return null;
    return `${said}: the pack’s note names ${pack.map((w) => `“${w}”`).join(' and ')}`;
  }
  return `${said}: a claim this test cannot read — say it as the other rows do, or teach the test`;
}

/** The deep word a row is about, by its first word, if its pack gives the row's English. */
function deepWord(row: DescentRow, deep: Map<string, LexEntry[]>[]): LexEntry | undefined {
  const head = row.target.split(' ')[0] as string;
  return deep.flatMap((words) => words.get(head) ?? []).find((w) => w.etymonOf === row.english);
}

describe('the landing page’s descent tables say what the packs say', () => {
  const rows = (): DescentRow[] => descentRows(landing);
  const deep = (): Map<string, LexEntry[]>[] => DEEP.map(({ lang }) => wordsOf(lang));

  test('every French row gives the word’s gloss and the pack’s own claim', () => {
    const fr = wordsOf('fr');
    const offenders = rows()
      .filter((r) => r.table === 0)
      .flatMap((r) => frenchRow(r, fr) ?? []);

    assert.deepEqual(offenders, [], `${offenders.length} French rows disagree with the pack:\n  ${offenders.join('\n  ')}`);
  });

  test('every Latin and Old English row names the English word its pack does', () => {
    const packs = deep();
    const offenders = rows()
      .filter((r) => r.table === 1)
      .flatMap((r) => {
        const head = r.target.split(' ')[0] as string;
        const said = `${r.target} → ${r.english}`;
        const word = deepWord(r, packs);
        if (!word) {
          const found = packs.flatMap((words) => words.get(head) ?? []);
          return found.length
            ? `${said}: the pack gives ${found.map((w) => (w.etymonOf ? `“${w.etymonOf}”` : 'no etymon')).join(' and ')}`
            : `${said}: neither deep pack has a word “${head}”`;
        }
        // A phrase is the table's, not the pack's, unless the note gives it.
        if (r.target !== head && !word.note?.includes(r.target)) {
          return `${said}: the pack’s note does not give the phrase “${r.target}”`;
        }
        return [];
      });

    assert.deepEqual(offenders, [], `${offenders.length} rows disagree with their pack:\n  ${offenders.join('\n  ')}`);
  });

  test('every note the deep table prints was read against the pack’s note it now carries', () => {
    const packs = deep();
    const offenders = rows()
      .filter((r) => r.table === 1 && r.claim)
      .flatMap((r) => {
        const said = `${r.target} → ${r.english}`;
        const word = deepWord(r, packs);
        // A row whose word was not found is named by the test above.
        if (!word) return [];
        const note = word.note;
        if (!note) return `${said}: the row says \`${r.claim}\` and the pack carries no note`;
        const line = CHECKED.find((c) => c.row === r.target);
        if (!line) return `${said}: \`${r.claim}\` has no line in CHECKED — read it against the pack’s \`${note}\` and add one`;
        if (line.cell !== r.claim) return `${said}: the row now reads \`${r.claim}\`, and was checked as \`${line.cell}\``;
        if (line.note !== note) return `${said}: the pack’s note is now \`${note}\`, and the row was checked against \`${line.note}\``;
        return [];
      });

    assert.deepEqual(offenders, [], `${offenders.length} notes are unchecked:\n  ${offenders.join('\n  ')}`);
  });

  test('no line in CHECKED outlives its row', () => {
    const printed = new Set(rows().flatMap((r) => (r.table === 1 && r.claim ? r.target : [])));
    const stale = CHECKED.filter((c) => !printed.has(c.row)).map((c) => c.row);

    assert.deepEqual(stale, [], `CHECKED holds lines for rows the page no longer prints a note on: ${stale.join(', ')}`);
  });

  test('the rule has something to police', () => {
    // Floors rather than counts, so a row added needs no edit here — but
    // every row it adds is read, and both kinds of French claim are, so a
    // table whose markup moved fails here instead of passing empty.
    const all = rows();
    const tables = new Set(all.map((r) => r.table));
    const french = all.filter((r) => r.table === 0);
    const deepRows = all.filter((r) => r.table === 1);
    const packs = deep();

    assert.deepEqual([...tables], [0, 1], `expected two descent tables, French first, and found ${tables.size}`);
    assert.deepEqual(all.filter((r) => r.cells !== 4).map((r) => r.target), [], 'a row without four cells');
    assert.ok(french.length >= 5, `only ${french.length} French rows were read`);
    assert.ok(french.some((r) => r.claim === TOOK), 'no French row says English took the word itself');
    assert.ok(french.some((r) => COUSIN.test(r.claim)), 'no French row names a cousin');
    assert.ok(deepRows.length >= 5, `only ${deepRows.length} Latin and Old English rows were read`);
    for (const [i, { lang }] of DEEP.entries()) {
      const from = deepRows.filter((r) => packs[i]?.has(r.target.split(' ')[0] as string));
      assert.ok(from.length >= 2, `only ${from.length} rows come from the ${lang} pack`);
    }
    assert.ok(deepRows.filter((r) => r.claim).length >= 3, 'fewer than three deep rows print a note');
  });
});

/**
 * A page quotes in the marks the site's own prose uses.
 *
 * The site writes “ ” — the landing page, the descent hubs, and every lexicon
 * note since PR #20 unified them. That guard,
 * `tests/tools/lexicon-orthography.test.ts`, reads the packs, and the
 * builder's own strings are not in a pack: so the Old English pronunciation
 * key, `META.ang.note`, printed `þ and ð are both "th"` in straight marks
 * under the transcription of 349 word pages, out of sight of the one rule
 * that would have named it. Read off the built pages instead, so a string is
 * held wherever it comes from — the builder, a pack, or `site/index.html` —
 * and a page added later is held without an edit here.
 *
 * Read through `readable()`, which decodes what `esc()` encodes. The builder
 * writes a straight quote as `&quot;`, so a search of the HTML for `"` finds
 * nothing but attribute delimiters, and a search for `&quot;` misses the
 * structured data, where JSON escapes it its own way.
 */

/**
 * Pages that print another document's copy, and keep that document's marks.
 * Whether those move is a different decision, written up in `TODO.md`: a
 * smart-quote pass in the Markdown renderer would change nothing on GitHub,
 * where the two documents are also read.
 */
const OWN_MARKS: Readonly<Record<string, string>> = {
  '/support.html': 'docs/SUPPORT.md, which a reader also opens on GitHub',
  '/privacy.html': 'docs/PRIVACY.md, which a reader also opens on GitHub',
};

describe('a page quotes in the site’s own marks', () => {
  test('no page prints a straight double quote', () => {
    const offenders = pages.filter((p) => !(p.page in OWN_MARKS) && p.text.includes('"'));
    const at = (text: string): string => {
      const i = text.indexOf('"');
      return text.slice(Math.max(0, i - 40), i + 20).trim();
    };

    assert.deepEqual(
      offenders.map((p) => p.page).slice(0, 5),
      [],
      `${offenders.length} pages print a straight double quote:\n  ${offenders
        .slice(0, 5)
        .map((p) => `${p.page}: …${at(p.text)}…`)
        .join('\n  ')}`,
    );
  });

  test('every page excused its own marks is one the site still serves', () => {
    const served = new Set(pages.map((p) => p.page));
    const gone = Object.keys(OWN_MARKS).filter((page) => !served.has(page));

    assert.deepEqual(gone, [], `OWN_MARKS excuses pages the build no longer writes: ${gone.join(', ')}`);
  });

  test('the rule has something to police', () => {
    // The reader first: a `readable()` that stopped decoding `&quot;` would
    // pass every page while every page still printed the mark.
    assert.ok(
      readable('<p class="word__pronNote">&quot;th&quot;</p>').includes('"th"'),
      'the reader cannot see an escaped quote',
    );
    assert.ok(pages.length > 700, `only ${pages.length} pages were read`);
    const exempt = pages.filter((p) => p.page in OWN_MARKS).length;
    assert.ok(pages.length - exempt > 700, `only ${pages.length - exempt} pages are held to the rule`);
  });
});

/**
 * A word page prints the pronunciation key the tooltip prints.
 *
 * The tooltip reads `pronunciationNote` from `src/core/languages.ts`; until
 * 2026-10-04 the site printed `META.<lang>.note` from the builder, a hand
 * copy of the same sentence that had drifted in both languages — Latin's had
 * lost its line about *ae*, Old English's its line about *g* — and was in
 * straight marks in one of them. `tests/tools/pronunciation-keys.test.ts`
 * holds the table's key to the pack's transcriptions; this holds every page
 * to the table, so the two cannot drift apart again.
 */
describe('a word page prints the key the tooltip prints', () => {
  test('every pronunciation key on a word page is its language table’s', () => {
    const off = keys.filter((k) => k.printed !== getLanguage(k.lang).pronunciationNote);

    assert.deepEqual(
      off.map((k) => k.page).slice(0, 5),
      [],
      `${off.length} pages print a key other than the language table’s:\n  ${off
        .slice(0, 3)
        .map((k) => `${k.page}: ${k.printed}\n    the table: ${getLanguage(k.lang).pronunciationNote}`)
        .join('\n  ')}`,
    );
  });

  test('the rule has something to police', () => {
    for (const { lang, dir } of DEEP) {
      const n = keys.filter((k) => k.lang === lang).length;
      assert.ok(n > 300, `only ${n} ${dir} pages print a pronunciation key`);
    }
  });
});

/**
 * `actions/upload-pages-artifact` has left hidden files out of the artifact
 * since v4, by a `--exclude=.[^/]*` handed to `tar`, unless its step sets
 * `include-hidden-files: true`, which v5 added. Nothing says so: the site
 * builds, the links check, and the file is simply not on the deploy. The
 * site had none on 2026-10-30, when site.yml moved to v5, so the step does
 * not ask for them, and a `.well-known/` or a `.nojekyll` the builder starts
 * writing fails here, naming itself, until it does.
 */
describe('the deploy carries every file the site builds', () => {
  const SITE_WORKFLOW = '.github/workflows/site.yml';

  test('no path the builder writes is hidden, while site.yml leaves hidden files out', () => {
    // 719 on 2026-10-30. A walk that found nothing would pass the rule.
    assert.ok(written.length > 700, `the walk found only ${written.length} paths`);
    const asks = /^\s*include-hidden-files:\s*['"]?true['"]?\s*$/m.test(readFileSync(join(ROOT, SITE_WORKFLOW), 'utf8'));
    if (asks) return;
    const hidden = written.filter((path) => path.split(/[\\/]/).some((part) => part.startsWith('.')));
    assert.deepEqual(hidden, [], `${SITE_WORKFLOW} uploads with actions/upload-pages-artifact, which leaves these out of the deploy`);
  });
});
