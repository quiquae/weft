/**
 * An Old English noun's gender names the dictionary entry it was read in.
 *
 * The tooltip prints a noun's gender beside it — "because you cannot use a
 * noun without it" — and its word page prints it twice, in the Gender row and
 * the page's description. Nothing had ever checked one. On 2026-10-04 every
 * Old English noun was read against English Wiktionary's Old English entry
 * and, where Wiktionary has none or disagrees with itself or with the seed,
 * against Bosworth–Toller, the dictionary the pack's attribution names. One of
 * 178 was wrong: `wīfmann`, woman, was marked feminine, and Bosworth–Toller
 * has "wíf-mann … es; m. (but seó wífman occurs)". It is declined as `mann`
 * is, among the masculines — Sievers (tr. Cook, 1903), §281 note 1, and
 * Wright's *Elementary Old English Grammar* (1923), §256 — because the word
 * is a compound of `mann`.
 *
 * So `tools/seed/ang-genders.tsv` repeats each noun's gender beside the
 * entries it was read in, and these tests hold the two files together: a
 * gender changed in the seed and not in the ledger fails, as does a line
 * naming no entry, a Wiktionary entry of some other word, or a noun the seed
 * no longer has. Repeating the gender is the point, as repeating the note is
 * in `tools/seed/la-notes.tsv`: an edit leaves the gender unsourced until
 * somebody reads again. It cannot tell an entry somebody read from one
 * somebody typed; the entries cited should be the ones actually opened.
 *
 * Latin's genders are held the same way, by `tools/seed/la-genders.tsv`. On
 * 2026-10-06 all 178 Latin nouns were read in Lewis & Short, and seven
 * disagreed: `hostis`, `mīles`, `canis` twice, `mūs` and `bōs` are "comm.",
 * common, where the seed said masculine, and `locus` is masculine where the
 * seed said neuter, the gender of the plural *loca* it wove.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const LEXICON = join(ROOT, 'tools/seed/lex-ang.tsv');
const LEDGER = join(ROOT, 'tools/seed/ang-genders.tsv');

type Noun = { line: number; lemma: string; tgt: string; gender: string };
type Entry = { line: number; lemma: string; tgt: string; gender: string; sources: string[] };

const tsv = (path: string): Array<{ line: number; f: string[] }> =>
  readFileSync(path, 'utf8')
    .split('\n')
    .flatMap((text, i) => (text && !text.startsWith('#') ? [{ line: i + 1, f: text.split('\t') }] : []));

const readNouns = (path: string): Noun[] =>
  tsv(path)
    .filter(({ f }) => f[1] === 'noun')
    .map(({ line, f }) => ({ line, lemma: f[0] ?? '', tgt: f[2] ?? '', gender: f[4] ?? '' }));

const readLedger = (path: string): Entry[] =>
  tsv(path).map(({ line, f }) => ({
    line,
    lemma: f[0] ?? '',
    tgt: f[1] ?? '',
    gender: f[2] ?? '',
    sources: (f[3] ?? '').split(' ').filter(Boolean),
  }));

const nouns = readNouns(LEXICON);
const ledger = readLedger(LEDGER);

const key = (lemma: string, tgt: string): string => `${lemma}\t${tgt}`;
const byKey = new Map(ledger.map((e) => [key(e.lemma, e.tgt), e]));

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

/** Why a source cannot be the entry a gender was read in, or nothing. */
function unsourced(entry: Entry, source: string): string | undefined {
  if (/^bt:\d+$/.test(source)) return undefined; // https://bosworthtoller.com/<id>
  const wikt = /^wikt:ang:(.+)$/.exec(source);
  if (!wikt) return `“${source}” is neither bt:<id> nor wikt:ang:<title>`;
  const want = wiktionaryTitle(entry.tgt);
  return wikt[1] === want ? undefined : `“${source}” is not ${entry.tgt}'s own entry, wikt:ang:${want}`;
}

describe('every Old English gender names the entry it was read in', () => {
  test('every noun has the gender its ledger line gives', () => {
    const offenders = nouns.flatMap((n) => {
      const e = byKey.get(key(n.lemma, n.tgt));
      if (!e) return [`lex-ang.tsv:${n.line} ${n.lemma} → ${n.tgt} (${n.gender}): no line in ang-genders.tsv`];
      return e.gender === n.gender
        ? []
        : [`lex-ang.tsv:${n.line} ${n.lemma} → ${n.tgt} is ${n.gender}, where ang-genders.tsv:${e.line} read ${e.gender}`];
    });
    assert.deepEqual(offenders, [], `${offenders.length} Old English genders are unsourced:\n  ${offenders.join('\n  ')}`);
  });

  test('every ledger line names an entry, and a Wiktionary entry is its own word’s', () => {
    const offenders = ledger.flatMap((e) => {
      if (!['m', 'f', 'n'].includes(e.gender)) return [`ang-genders.tsv:${e.line} ${e.tgt}: “${e.gender}” is not m, f or n`];
      if (e.sources.length === 0) return [`ang-genders.tsv:${e.line} ${e.tgt}: names no entry`];
      return e.sources.flatMap((s) => {
        const why = unsourced(e, s);
        return why ? [`ang-genders.tsv:${e.line} ${e.tgt}: ${why}`] : [];
      });
    });
    assert.deepEqual(offenders, [], `${offenders.length} ledger lines cannot be read:\n  ${offenders.join('\n  ')}`);
  });

  test('no ledger line outlives its noun', () => {
    const taught = new Set(nouns.map((n) => key(n.lemma, n.tgt)));
    const stale = ledger.filter((e) => !taught.has(key(e.lemma, e.tgt)));
    const seen = new Set<string>();
    const twice = ledger.filter((e) => {
      const k = key(e.lemma, e.tgt);
      return seen.has(k) || !seen.add(k);
    });
    assert.deepEqual(
      stale.map((e) => `ang-genders.tsv:${e.line} ${e.lemma} → ${e.tgt}`),
      [],
      'lines here for a noun lex-ang.tsv no longer teaches',
    );
    assert.deepEqual(
      twice.map((e) => `ang-genders.tsv:${e.line} ${e.lemma} → ${e.tgt}`),
      [],
      'a noun with two lines',
    );
  });

  test('the ledger has something to hold', () => {
    // Floors, not exact counts, so a new noun needs no edit here.
    assert.ok(nouns.length > 150, `only ${nouns.length} Old English nouns were read from lex-ang.tsv`);
    const genders = new Set(nouns.map((n) => n.gender));
    assert.deepEqual([...genders].sort(), ['f', 'm', 'n'], 'the seed should use all three genders');
    const dictionary = ledger.filter((e) => e.sources.some((s) => s.startsWith('bt:')));
    assert.ok(dictionary.length >= 5, `only ${dictionary.length} lines name Bosworth–Toller`);
  });
});

const LA_LEXICON = join(ROOT, 'tools/seed/lex-la.tsv');
const LA_LEDGER = join(ROOT, 'tools/seed/la-genders.tsv');
const laNouns = readNouns(LA_LEXICON);
const laLedger = readLedger(LA_LEDGER);
const laByKey = new Map(laLedger.map((e) => [key(e.lemma, e.tgt), e]));

/**
 * Lewis & Short's key for a headword, as `la-notes.test.ts` derives it: no
 * macrons, and `j` where the pack writes a consonantal `i`.
 */
const lewisAndShort = (tgt: string): string =>
  tgt
    .normalize('NFD')
    .replace(/\u0304/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/^i(?=[aeiou])/, 'j');

/** Headwords Lewis & Short files under another spelling, and what it prints. */
const FILED: Record<string, { key: string; prints: string }> = {
  autumnus: { key: 'auctumnus', prints: 'auctumnus (correctly aut-), i, m.' },
  iūsiūrandum: { key: 'jusjurandum', prints: 'jus-jūrandum, jurisjurandi … n.' },
};

describe('every Latin gender names the entry it was read in', () => {
  test('every noun has the gender its ledger line gives', () => {
    const offenders = laNouns.flatMap((n) => {
      const e = laByKey.get(key(n.lemma, n.tgt));
      if (!e) return [`lex-la.tsv:${n.line} ${n.lemma} → ${n.tgt} (${n.gender}): no line in la-genders.tsv`];
      return e.gender === n.gender
        ? []
        : [`lex-la.tsv:${n.line} ${n.lemma} → ${n.tgt} is ${n.gender}, where la-genders.tsv:${e.line} read ${e.gender}`];
    });
    assert.deepEqual(offenders, [], `${offenders.length} Latin genders are unsourced:\n  ${offenders.join('\n  ')}`);
  });

  test('every ledger line cites Lewis & Short, its own headword’s entry among them', () => {
    const offenders = laLedger.flatMap((e) => {
      if (!['m', 'f', 'n', 'c'].includes(e.gender)) return [`la-genders.tsv:${e.line} ${e.tgt}: “${e.gender}” is not m, f, n or c`];
      const unreadable = e.sources.filter((s) => !/^ls:[a-z]+\d?$/.test(s));
      if (unreadable.length) return [`la-genders.tsv:${e.line} ${e.tgt}: ${unreadable.map((s) => `“${s}”`).join(' ')} is not ls:<key>`];
      const own = FILED[e.tgt]?.key ?? lewisAndShort(e.tgt);
      return e.sources.some((s) => new RegExp(`^ls:${own}\\d?$`).test(s))
        ? []
        : [`la-genders.tsv:${e.line} ${e.tgt} cites ${e.sources.join(' ') || 'nothing'}; it needs ls:${own}, its own entry`];
    });
    assert.deepEqual(offenders, [], `${offenders.length} ledger lines cannot be read:\n  ${offenders.join('\n  ')}`);
  });

  test('no ledger line outlives its noun, and no spelling is listed that needs no listing', () => {
    const taught = new Set(laNouns.map((n) => key(n.lemma, n.tgt)));
    const seen = new Set<string>();
    const offenders = laLedger.flatMap((e) => {
      const k = key(e.lemma, e.tgt);
      if (!taught.has(k)) return [`la-genders.tsv:${e.line} ${e.lemma} → ${e.tgt}: lex-la.tsv no longer teaches it`];
      return seen.has(k) || !seen.add(k) ? [`la-genders.tsv:${e.line} ${e.lemma} → ${e.tgt}: a second line`] : [];
    });
    const tgts = new Set(laNouns.map((n) => n.tgt));
    for (const [tgt, { key: filed }] of Object.entries(FILED)) {
      if (!tgts.has(tgt)) offenders.push(`FILED lists ${tgt}, which lex-la.tsv does not teach`);
      if (filed === lewisAndShort(tgt)) offenders.push(`FILED lists ${tgt}, whose key ${filed} needs no listing`);
    }
    assert.deepEqual(offenders, []);
  });

  test('the ledger has something to hold', () => {
    assert.ok(laNouns.length > 150, `only ${laNouns.length} Latin nouns were read from lex-la.tsv`);
    const genders = new Set(laNouns.map((n) => n.gender));
    assert.deepEqual([...genders].sort(), ['c', 'f', 'm', 'n'], 'the seed should use all four genders');
  });
});
