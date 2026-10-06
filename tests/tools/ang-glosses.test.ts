/**
 * An Old English gloss names the dictionary entry that gives it.
 *
 * The gloss is the first claim a reader meets: the English word an Old
 * English word is woven for, printed back in the tooltip and on its word
 * page. Every other claim the Old English pack makes about a word already
 * names its entry — the etymon in `tools/seed/ang-etymons.tsv`, a noun's
 * gender in `ang-genders.tsv`, a phrase's text in `ang-phrases.tsv` — and
 * until 2026-10-07 the gloss named none, as the Latin glosses named none
 * until `la-glosses.tsv`.
 *
 * So `tools/seed/ang-glosses.tsv` quotes, for every row of `lex-ang.tsv` of a
 * part of speech it holds, the words of the entry that give its gloss, and
 * these tests hold the two files together. A quote holds its row's English
 * word, or the line names the word of the quote that stands for it: `hund`
 * is "dog" where the row is woven for "hound", and `setl` "seat, bench,
 * throne" where it is woven for "chair". Naming the stand-in is the point — a line cannot
 * pass for one that holds the word, and a reader of the ledger sees each
 * gloss the dictionary only approaches. The quote cannot be checked against
 * the dictionary here; every quote was drafted from the entry's text and read
 * against it when it was written, and the entries cited should be the ones
 * actually opened.
 *
 * The ledger holds every part of speech but the adverbs, which are the next
 * item in `TODO.md`; `HELD` grows as each is read.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const LEXICON = join(ROOT, 'tools/seed/lex-ang.tsv');
const LEDGER = join(ROOT, 'tools/seed/ang-glosses.tsv');
const GENDERS = join(ROOT, 'tools/seed/ang-genders.tsv');
const PHRASES = join(ROOT, 'tools/seed/ang-phrases.tsv');

/** The parts of speech whose every row the ledger holds. */
const HELD = new Set(['noun', 'verb', 'adj', 'num', 'intj']);

/**
 * Words whose own Wiktionary entry gives no definition but names the entry it
 * is an alternative form of, by title. Wiktionary files most Old English words
 * under their þ spelling, so a ð spelling's page says only "Alternative form
 * of brōþor"; a line for one of these cites both entries, quoting the second.
 */
const FORM_OF = new Map([
  ['broðor', 'broþor'],
  ['muð', 'muþ'],
  ['toð', 'toþ'],
  ['clað', 'claþ'],
  ['eorðe', 'eorþe'],
  ['monað', 'monaþ'],
  ['deað', 'deaþ'],
  ['meoluc', 'meolc'],
  ['wall', 'weall'],
  ['hæt', 'hætt'],
  ['wolcen', 'wolcn'],
  ['wicu', 'wice'],
  ['sceort', 'scort'],
  ['niwe', 'niewe'],
  ['softe', 'sefte'],
  ['æmettig', 'æmtig'],
  ['eaþe', 'ieþe'],
  ['bald', 'beald'],
  ['þreo', 'þri'],
  ['siex', 'six'],
]);

/**
 * Rows whose gloss no entry gives, each queued in `TODO.md` to be taught
 * differently, with what the entries say the word is. Their lines quote the
 * entry all the same, so the ledger says what is wrong rather than nothing.
 */
const QUEUED = new Map<string, string>([
  [
    'low\tadj\tlāh',
    'no adjective: Wiktionary’s lah is only a past tense of lēon, to lend, and Bosworth–Toller’s lah a noun, “Law”; English low is Middle English lah, from Old Norse lágr (English Wiktionary, low)',
  ],
]);

type Row = { line: number; lemma: string; pos: string; tgt: string };
type Gloss = Row & { sources: string[]; quote: string; stands: string };

const tsv = (path: string): Array<{ line: number; f: string[] }> =>
  readFileSync(path, 'utf8')
    .split('\n')
    .flatMap((text, i) => (text && !text.startsWith('#') ? [{ line: i + 1, f: text.split('\t') }] : []));

const rows: Row[] = tsv(LEXICON).map(({ line, f }) => ({ line, lemma: f[0] ?? '', pos: f[1] ?? '', tgt: f[2] ?? '' }));

const ledger: Gloss[] = tsv(LEDGER).map(({ line, f }) => ({
  line,
  lemma: f[0] ?? '',
  pos: f[1] ?? '',
  tgt: f[2] ?? '',
  sources: (f[3] ?? '').split(' ').filter(Boolean),
  quote: f[4] ?? '',
  stands: f[5] ?? '',
}));

/** A noun's entries as its gender was read, by the same key. */
const genders = new Map(
  tsv(GENDERS).map(({ f }) => [`${f[0]}\t${f[1]}`, (f[3] ?? '').split(' ').filter(Boolean)] as const),
);

/** A phrase's entries as its text was read, by the same key as a row. */
const phrases = new Map<string, string[]>(
  tsv(PHRASES).map(({ f }) => [`${f[0]}\t${f[1]}\t${f[2]}`, (f[3] ?? '').split(' ').filter(Boolean)] as const),
);

const key = (r: Row): string => `${r.lemma}\t${r.pos}\t${r.tgt}`;
const byKey = new Map(ledger.map((g) => [key(g), g]));

/**
 * The title of a word's English Wiktionary entry: Old English entries drop
 * macrons and the dots of ċ and ġ, and a homograph's number is not spelled.
 */
const wiktionaryTitle = (tgt: string): string =>
  tgt
    .replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]+$/, '')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .normalize('NFC');

/** Why a source cannot be an entry the gloss was read in, or nothing. */
function unsourced(g: Gloss, source: string): string | undefined {
  if (/^bt:\d+$/.test(source)) return undefined; // https://bosworthtoller.com/<id>
  const wikt = /^wikt:ang:(.+)$/.exec(source);
  if (!wikt) return `“${source}” is neither bt:<id> nor wikt:ang:<title>`;
  const want = wiktionaryTitle(g.tgt);
  if (wikt[1] === want) return undefined;
  const form = FORM_OF.get(want);
  if (wikt[1] !== form) return `“${source}” is not ${g.tgt}'s own entry, wikt:ang:${want}`;
  return g.sources.includes(`wikt:ang:${want}`) ? undefined : `“${source}” is cited without ${g.tgt}'s own entry, wikt:ang:${want}`;
}

/** Whether `text` holds `words` whole, in any case: "man" is not in "woman". */
const holds = (text: string, words: string): boolean =>
  new RegExp(`(?<![A-Za-z])${words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`, 'i').test(text);

describe('every Old English gloss names the entry that gives it', () => {
  test('every row of a part of speech the ledger holds has a line', () => {
    const missing = rows.filter((r) => HELD.has(r.pos) && !byKey.has(key(r)));
    assert.deepEqual(
      missing.map((r) => `lex-ang.tsv:${r.line} ${r.lemma} → ${r.tgt}`),
      [],
      `${missing.length} Old English glosses name no entry in ang-glosses.tsv`,
    );
  });

  test('every line cites Bosworth–Toller or the word’s own Wiktionary entry', () => {
    const offenders = ledger.flatMap((g) => {
      if (g.sources.length === 0) return [`ang-glosses.tsv:${g.line} ${g.tgt}: names no entry`];
      return g.sources.flatMap((s) => {
        const why = unsourced(g, s);
        return why ? [`ang-glosses.tsv:${g.line} ${g.tgt}: ${why}`] : [];
      });
    });
    assert.deepEqual(offenders, [], `${offenders.length} ledger lines cannot be read:\n  ${offenders.join('\n  ')}`);
  });

  test('every quote holds its English word, or names the word of it that stands for it', () => {
    const offenders = ledger.flatMap((g) => {
      const at = `ang-glosses.tsv:${g.line} ${g.lemma} → ${g.tgt}`;
      if (!g.quote) return [`${at}: quotes nothing`];
      if (QUEUED.has(key(g))) return [];
      if (!g.stands) return holds(g.quote, g.lemma) ? [] : [`${at}: “${g.quote}” does not hold “${g.lemma}”, and no word is named to stand for it`];
      if (holds(g.quote, g.lemma)) return [`${at}: “${g.quote}” holds “${g.lemma}” itself, so “${g.stands}” need not stand for it`];
      return holds(g.quote, g.stands) ? [] : [`${at}: “${g.stands}” is not in “${g.quote}”`];
    });
    assert.deepEqual(offenders, [], `${offenders.length} quotes do not give their gloss:\n  ${offenders.join('\n  ')}`);
  });

  test('a quote is the words a reader sees, not the markup they were drafted from', () => {
    // Wiktionary's raw text writes a definition as [[links]] and {{templates}},
    // and a quote copied straight from it would be checked against words no
    // reader of the entry sees: the link's target where the page prints its
    // text, a template's name where the page prints its label.
    const offenders = ledger.flatMap((g) =>
      /\[\[|\]\]|\{\{|\}\}|''|<[a-z/]/i.test(g.quote) ? [`ang-glosses.tsv:${g.line} ${g.tgt}: “${g.quote}”`] : [],
    );
    assert.deepEqual(offenders, [], `${offenders.length} quotes carry markup:\n  ${offenders.join('\n  ')}`);
  });

  test('a noun’s gloss is read in the entry its gender was read in', () => {
    // ang-genders.tsv names Bosworth–Toller first wherever it decided the
    // gender — wīfmann, īren, þorp — and a Wiktionary title holds every word
    // of one spelling, so a gloss read elsewhere could be a reading of a
    // different word.
    const offenders = ledger.flatMap((g) => {
      if (g.pos !== 'noun') return [];
      const read = genders.get(`${g.lemma}\t${g.tgt}`);
      if (!read) return [`ang-glosses.tsv:${g.line} ${g.lemma} → ${g.tgt}: ang-genders.tsv has no line for it`];
      return g.sources.includes(read[0] ?? '')
        ? []
        : [`ang-glosses.tsv:${g.line} ${g.tgt} cites ${g.sources.join(' ')}, where its gender was read in ${read[0]}`];
    });
    assert.deepEqual(offenders, [], `${offenders.length} nouns are glossed from another entry:\n  ${offenders.join('\n  ')}`);
  });

  test('a phrase’s gloss is read in an entry its text was read in', () => {
    // ang-phrases.tsv names the Bosworth–Toller entries each interjection and
    // each target of more than one word was found in a text under; a gloss
    // read anywhere else could be a reading of some other use of the words.
    const offenders = ledger.flatMap((g) => {
      const read = phrases.get(key(g));
      if (!read) return [];
      return g.sources.some((s) => read.includes(s))
        ? []
        : [`ang-glosses.tsv:${g.line} ${g.tgt} cites ${g.sources.join(' ')}, where its text was read in ${read.join(' ')}`];
    });
    assert.deepEqual(offenders, [], `${offenders.length} phrases are glossed from another entry:\n  ${offenders.join('\n  ')}`);
  });

  test('every alternative form and every queued gloss is still one a line needs', () => {
    // Both tables excuse a line from a rule, so neither may outlive the line
    // it excuses: a queued gloss that is fixed, or a form whose line cites
    // its own entry's text, would otherwise go on excusing nothing.
    const cited = new Set(ledger.flatMap((g) => g.sources));
    const forms = [...FORM_OF].flatMap(([own, lemma]) =>
      cited.has(`wikt:ang:${lemma}`) && cited.has(`wikt:ang:${own}`) ? [] : [`FORM_OF ${own} → ${lemma}: no line cites both`],
    );
    const queued = [...QUEUED.keys()].flatMap((k) => {
      const g = byKey.get(k);
      if (!g) return [`QUEUED ${k.replace(/\t/g, ' ')}: no line, or lex-ang.tsv no longer teaches it`];
      return holds(g.quote, g.lemma) || (g.stands && holds(g.quote, g.stands))
        ? [`QUEUED ${k.replace(/\t/g, ' ')}: its quote gives its gloss now, so it need not be queued`]
        : [];
    });
    assert.deepEqual([...forms, ...queued], []);
  });

  test('no line outlives its row, and no row has two', () => {
    const taught = new Set(rows.map(key));
    const seen = new Set<string>();
    const offenders = ledger.flatMap((g) => {
      const k = key(g);
      if (!taught.has(k)) return [`ang-glosses.tsv:${g.line} ${g.lemma} → ${g.tgt}: lex-ang.tsv no longer teaches it`];
      return seen.has(k) || !seen.add(k) ? [`ang-glosses.tsv:${g.line} ${g.lemma} → ${g.tgt}: a second line`] : [];
    });
    assert.deepEqual(offenders, []);
  });

  test('the ledger has something to hold', () => {
    // Floors, not exact counts, so a new row needs no edit here.
    assert.ok(rows.length > 300, `only ${rows.length} rows were read from lex-ang.tsv`);
    const held = rows.filter((r) => HELD.has(r.pos));
    assert.ok(held.length > 150, `only ${held.length} rows are of a part of speech the ledger holds`);
    const standing = ledger.filter((g) => g.stands);
    assert.ok(standing.length >= 5, `only ${standing.length} lines name a word standing for their gloss`);
    assert.ok(standing.length < ledger.length / 4, `${standing.length} of ${ledger.length} lines need a stand-in`);
  });
});
