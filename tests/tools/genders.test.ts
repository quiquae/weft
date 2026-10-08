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
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spelling } from '../../src/core/lexicon.ts';

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

/**
 * A gender is one its language has, and it is true of every form a row
 * weaves. The tooltip prints a pack entry's gender under the form that entry
 * wove, and a seed row has one gender for both its forms, so a plural is
 * printed with its singular's gender. These read the shipped packs, because
 * the printed gender is the claim.
 *
 * Italian has two genders, and until 2026-10-08 the pack printed a third:
 * `orecchio`, ear, was marked neuter, because its plural `orecchie` is
 * feminine. Four more rows were the same kind of word marked the other way —
 * `osso`, `braccio`, `dito` and `uovo` are masculine and were woven in their
 * feminine plurals, `ossa`, `braccia`, `dita` and `uova`, printed
 * "masculine". The rule Latin's `locus` set on 2026-10-06 decides them: a
 * noun whose plural takes another gender weaves a plural of its own gender or
 * none. Each masculine plural Wiktionary gives these words is figurative or
 * means the parts one at a time, so none is woven.
 */
const PACKS = join(ROOT, 'src/lexicon/packs');

type Woven = { src: string; tgt: string; tgtLemma: string; pos?: string; gender?: string; num?: string };

const woven = (lang: string): Woven[] =>
  Object.values(JSON.parse(readFileSync(join(PACKS, `en-${lang}.json`), 'utf8')).entries as Record<string, Woven[]>).flat();

const shipped = readdirSync(PACKS).flatMap((f) => /^en-([a-z]+)\.json$/.exec(f)?.slice(1, 2) ?? []);

/** The genders each language's nouns are given, by its grammar. */
const INVENTORY: ReadonlyMap<string, { name: string; genders: string; grammar: string }> = new Map([
  ['ang', { name: 'Old English', genders: 'mfn', grammar: 'masculine, feminine and neuter' }],
  ['de', { name: 'German', genders: 'mfn', grammar: 'der, die and das' }],
  ['es', { name: 'Spanish', genders: 'mf', grammar: 'masculine and feminine; the Latin neuter is gone' }],
  ['fr', { name: 'French', genders: 'mf', grammar: 'masculine and feminine; the Latin neuter is gone' }],
  ['it', { name: 'Italian', genders: 'mf', grammar: 'masculine and feminine; the Latin neuter is gone' }],
  ['la', { name: 'Latin', genders: 'mfnc', grammar: 'masculine, feminine, neuter, and Lewis & Short’s “comm.”, common' }],
  ['pt', { name: 'Portuguese', genders: 'mf', grammar: 'masculine and feminine; the Latin neuter is gone' }],
]);

describe('a gender is one its language has', () => {
  test('every gender a pack prints is one of its language’s', () => {
    const offenders = shipped.flatMap((lang) => {
      const known = INVENTORY.get(lang);
      if (!known) return [`en-${lang}.json ships, and INVENTORY gives ${lang} no genders`];
      return woven(lang).flatMap((e) =>
        e.gender && !known.genders.includes(e.gender)
          ? [`en-${lang} ${e.src} → ${e.tgt} is printed “${e.gender}”, and ${known.name} has ${known.grammar}`]
          : [],
      );
    });
    assert.deepEqual(offenders, [], `${offenders.length} printed genders are not their language’s:\n  ${offenders.join('\n  ')}`);
  });

  test('every language listed is one a pack ships', () => {
    const stale = [...INVENTORY.keys()].filter((lang) => !shipped.includes(lang)).map((lang) => `INVENTORY lists ${lang}, and no pack ships`);
    assert.deepEqual(stale, [], stale.join('\n'));
    assert.ok(shipped.length >= 7, `only ${shipped.length} packs were found under src/lexicon/packs`);
  });
});

/**
 * Italian masculine nouns whose plural is feminine, and what English
 * Wiktionary's Italian entry prints. A row is woven in the singular only,
 * masculine: the feminine plural would be printed "masculine", and the
 * masculine one is not the plural English means by the word.
 */
const ITALIAN_OTHER_GENDER: ReadonlyMap<string, string> = new Map([
  ['orecchio', 'orecchio m (plural (in the literal meaning) orecchie f or (figuratively) orecchi m)'],
  ['osso', 'osso m (plural (collective) ossa f or (individual) ossi m)'],
  ['braccio', 'braccio m (plural (in most meanings 1, 2, 4) braccia f or (in the figurative meanings …) bracci m'],
  ['dito', 'dito m (plural (considered individually) diti m or (collectively) dita f'],
  ['uovo', 'uovo m (plural uova f'],
]);

describe('an Italian plural of another gender is not printed with its singular’s', () => {
  const entries = woven('it').filter((e) => e.pos === 'noun');

  test('no masculine noun is woven in a plural that ends as a feminine one does', () => {
    // A plural in -a that is not its singular unchanged is feminine, the old
    // Latin neuter plural, uova beside uovo; so is one in -e, the plural of a
    // feminine noun in -a. A masculine plural ends in -i, or is its singular.
    const offenders = entries.flatMap((e) =>
      e.num === 'pl' && e.gender === 'm' && e.tgt !== spelling(e.tgtLemma) && /[ae]$/.test(e.tgt)
        ? [`en-it ${e.src} → ${e.tgt} is printed “m”, the gender of ${spelling(e.tgtLemma)}; a plural in -${e.tgt.slice(-1)} is feminine`]
        : [],
    );
    assert.deepEqual(offenders, [], `${offenders.length} Italian plurals are printed a gender they do not have:\n  ${offenders.join('\n  ')}`);
  });

  test('a listed word is a masculine noun the pack weaves in the singular only', () => {
    const offenders = [...ITALIAN_OTHER_GENDER].flatMap(([word, prints]) => {
      const forms = entries.filter((e) => spelling(e.tgtLemma) === word);
      if (!forms.length) return [`${word} is listed, and the Italian pack teaches no such noun`];
      return forms.flatMap((e) => [
        ...(e.gender === 'm' ? [] : [`en-it ${e.src} → ${e.tgt} is printed “${e.gender}”; Wiktionary: ${prints}`]),
        ...(e.tgt === word ? [] : [`en-it ${e.src} → ${e.tgt} weaves a plural of ${word}; Wiktionary: ${prints}`]),
      ]);
    });
    assert.deepEqual(offenders, [], `${offenders.length} listed Italian nouns are woven against their entries:\n  ${offenders.join('\n  ')}`);
  });

  test('the rule has something to police', () => {
    const plurals = entries.filter((e) => e.num === 'pl' && e.gender === 'm' && e.tgt !== spelling(e.tgtLemma));
    assert.ok(plurals.length > 50, `only ${plurals.length} masculine Italian plurals were found to read`);
  });
});
