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
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentDate } from '../../tools/sitemap.ts';
import { markInSvg, differences, type MarkReading } from './mark-reading.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TOOL = join(ROOT, 'tools/build-site.mjs');
const TODAY = new Date().toISOString().slice(0, 10);

const builtAt = (lang: string): string =>
  JSON.parse(readFileSync(join(ROOT, `src/lexicon/packs/en-${lang}.json`), 'utf8')).meta.builtAt;

/** The two languages that get a page per word. Mirrors `DEEP` in the builder. */
const DEEP = [
  { lang: 'la', dir: 'latin' },
  { lang: 'ang', dir: 'old-english' },
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
function headwords(lang: string): Set<string> {
  const pack = JSON.parse(readFileSync(join(ROOT, `src/lexicon/packs/en-${lang}.json`), 'utf8'));
  const rows = new Map<string, { lemma: string; num?: string }[]>();
  for (const list of Object.values(pack.entries) as { tgtLemma: string; lemma: string; num?: string }[][]) {
    for (const e of list) rows.set(e.tgtLemma, [...(rows.get(e.tgtLemma) ?? []), e]);
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

before(() => {
  const out = mkdtempSync(join(tmpdir(), 'weft-site-'));
  try {
    execFileSync(process.execPath, [TOOL, `--out=${out}`], { stdio: 'pipe' });
    const xml = readFileSync(join(out, 'sitemap.xml'), 'utf8');
    dates = lastmods(xml);
    descents = [];
    targets = new Map();
    words = [];
    for (const dir of ['latin', 'old-english']) {
      targets.set(dir, new Set());
      for (const file of readdirSync(join(out, dir))) {
        const html = readFileSync(join(out, dir, file), 'utf8');
        const slug = file.replace(/\.html$/, '');
        const found = descentOf(`/${dir}/${slug}`, html);
        if (found) descents.push(found);
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
    headers = (readdirSync(out, { recursive: true }) as string[])
      .filter((file) => file.endsWith('.html'))
      .map((file) => {
        const html = readFileSync(join(out, file), 'utf8');
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
      const rel = new URL(m[1] as string).pathname.replace(/^\//, '');
      const target = join(out, rel);
      const file = [target, `${target}.html`, join(target, 'index.html')].find(
        (c) => existsSync(c) && statSync(c).isFile(),
      );
      return { loc: m[1] as string, file: file ? file.slice(out.length) : null };
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
