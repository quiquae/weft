/**
 * A woven modern plural names the dictionary entry that prints it.
 *
 * A noun row weaves its second form under an English plural, and the tooltip
 * prints that form as the word the reader met. Each modern noun's gender has
 * named its English Wiktionary entry since 2026-10-08, and the same pass found
 * five Italian rows wrong in gender — `uova` printed with `uovo`'s masculine —
 * which said nothing about whether the 868 plurals were spelled right. Their
 * raw templates mostly do not say: `{{es-noun|m}}` and German's `^er` leave
 * the plural to Wiktionary's module. Its rendered headword line does, as a
 * reader sees it, "uovo m (plural uova f", so each was read there, on
 * 2026-10-08. Two were wrong: Spanish `país` was woven in the singular
 * under "countries", where its line prints "plural países", and Portuguese
 * `chão` as *chões*, where it prints "plural chãos".
 *
 * So `tools/seed/<lang>-plurals.tsv` repeats every woven plural beside the
 * entry it was read in and the clause of the headword line that prints it,
 * and these tests hold the files together: a plural changed in the seed and
 * not in the ledger fails, as does a line citing some other word's entry, a
 * quote that does not print the plural it stands beside, or a line outliving
 * its row. The quote is the check, as in the gloss ledgers: it cannot tell a
 * page somebody read from one somebody typed, and the pages cited should be
 * the ones actually opened.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spelling } from '../../src/core/lexicon.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SEED = join(ROOT, 'tools/seed');
const PACKS = join(ROOT, 'src/lexicon/packs');

type Noun = { line: number; lemma: string; tgt: string; tgt2: string; gender: string };
type Plural = { line: number; lemma: string; tgt: string; tgt2: string; sources: string[]; quote: string };

const tsv = (path: string): Array<{ line: number; f: string[] }> =>
  readFileSync(path, 'utf8')
    .split('\n')
    .flatMap((text, i) => (text && !text.startsWith('#') ? [{ line: i + 1, f: text.split('\t') }] : []));

/** Every noun row that weaves a second form. A blank one weaves the singular only. */
const readNouns = (path: string): Noun[] =>
  tsv(path)
    .filter(({ f }) => f[1] === 'noun' && (f[3] ?? '') !== '')
    .map(({ line, f }) => ({ line, lemma: f[0] ?? '', tgt: f[2] ?? '', tgt2: f[3] ?? '', gender: f[4] ?? '' }));

const readLedger = (path: string): Plural[] =>
  tsv(path).map(({ line, f }) => ({
    line,
    lemma: f[0] ?? '',
    tgt: f[1] ?? '',
    tgt2: f[2] ?? '',
    sources: (f[3] ?? '').split(' ').filter(Boolean),
    quote: f[4] ?? '',
  }));

const key = (lemma: string, tgt: string): string => `${lemma}\t${tgt}`;

const GENDER_NAME: Readonly<Record<string, string>> = { m: 'masculine', f: 'feminine', n: 'neuter' };

/**
 * The forms a headword line's plural clause prints, its qualifiers and gender
 * marks set aside: "plural (collective) ossa f or (individual) ossi m" prints
 * ossa and ossi. A clause may also be labelled with the noun's own gender,
 * as Italian prints a noun with a feminine counterpart — "masculine plural
 * signori" — and an invariable noun's plural is its singular. Undefined for
 * a quote that is no plural clause at all.
 */
const printed = (quote: string, gender: string): string[] | 'invariable' | undefined => {
  if (quote === 'invariable') return 'invariable';
  const label = ['plural ', `${GENDER_NAME[gender] ?? '?'} plural `].find((l) => quote.startsWith(l));
  if (!label) return undefined;
  let rest = quote.slice(label.length);
  // Qualifiers are parenthesised, and may hold parentheses of their own.
  for (let before = ''; before !== rest; ) [before, rest] = [rest, rest.replace(/\([^()]*\)/g, ' ')];
  return rest
    .split(/\s+or\s+/)
    .map((form) => form.trim().replace(/\s+[mfn](?:\s+pl)?$/, '').trim())
    .filter(Boolean);
};

const shipped = readdirSync(PACKS).flatMap((f) => /^en-([a-z]+)\.json$/.exec(f)?.slice(1, 2) ?? []);

// Every shipped pack but the two read in their own dictionaries, so a pack
// added later fails here until its plurals are read too.
const MODERN = shipped.filter((lang) => lang !== 'ang' && lang !== 'la');

const NAME: Readonly<Record<string, string>> = {
  de: 'German',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  pt: 'Portuguese',
};

describe('the plural clause of a headword line is read as a reader reads it', () => {
  test('a qualified plural prints each of its forms, and nothing of the qualifiers', () => {
    assert.deepEqual(printed('plural (collective) ossa f or (individual) ossi m', 'm'), ['ossa', 'ossi']);
    assert.deepEqual(printed('plural Männer or (poetic) Mannen', 'm'), ['Männer', 'Mannen']);
    assert.deepEqual(printed('plural (in most meanings 1, 2, 4) braccia f or (figuratively (of a river)) bracci m', 'm'), [
      'braccia',
      'bracci',
    ]);
  });

  test('a clause labelled with another gender is not this noun’s plural', () => {
    assert.deepEqual(printed('masculine plural signori', 'm'), ['signori']);
    assert.equal(printed('feminine plural signore', 'm'), undefined);
    assert.equal(printed('diminutive Büchlein n', 'n'), undefined);
    assert.equal(printed('invariable', 'f'), 'invariable');
  });
});

test('every modern pack has a plural ledger', () => {
  const missing = MODERN.filter((lang) => !existsSync(join(SEED, `${lang}-plurals.tsv`)));
  assert.deepEqual(missing.map((lang) => `en-${lang}.json ships, and tools/seed/${lang}-plurals.tsv does not exist`), []);
  assert.ok(MODERN.length >= 5, `only ${MODERN.length} modern packs were found`);
});

for (const lang of MODERN.filter((l) => existsSync(join(SEED, `${l}-plurals.tsv`)))) {
  const name = NAME[lang] ?? lang;
  const lexicon = `lex-${lang}.tsv`;
  const file = `${lang}-plurals.tsv`;
  const nouns = readNouns(join(SEED, lexicon));
  const ledger = readLedger(join(SEED, file));
  const byKey = new Map(ledger.map((e) => [key(e.lemma, e.tgt), e]));
  const genderOf = new Map(nouns.map((n) => [key(n.lemma, n.tgt), n.gender]));

  describe(`every woven ${name} plural names the entry that prints it`, () => {
    test('every noun weaves the plural its ledger line gives', () => {
      const offenders = nouns.flatMap((n) => {
        const e = byKey.get(key(n.lemma, n.tgt));
        if (!e) return [`${lexicon}:${n.line} ${n.lemma} → ${n.tgt} / ${n.tgt2}: no line in ${file}`];
        return e.tgt2 === n.tgt2 ? [] : [`${lexicon}:${n.line} ${n.lemma} → ${n.tgt} weaves ${n.tgt2}, where ${file}:${e.line} read ${e.tgt2}`];
      });
      assert.deepEqual(offenders, [], `${offenders.length} ${name} plurals are unsourced:\n  ${offenders.join('\n  ')}`);
    });

    test('every ledger line cites its own word’s entry', () => {
      const offenders = ledger.flatMap((e) => {
        const own = `wikt:${lang}:${spelling(e.tgt)}`;
        const other = e.sources.filter((s) => s !== own);
        if (other.length) return [`${file}:${e.line} ${e.tgt}: ${other.map((s) => `“${s}”`).join(' ')} is not ${own}`];
        return e.sources.length ? [] : [`${file}:${e.line} ${e.tgt} cites nothing; it needs ${own}`];
      });
      assert.deepEqual(offenders, [], `${offenders.length} ledger lines cannot be read:\n  ${offenders.join('\n  ')}`);
    });

    test('every quote prints the plural beside it', () => {
      const offenders = ledger.flatMap((e) => {
        const forms = printed(e.quote, genderOf.get(key(e.lemma, e.tgt)) ?? '');
        if (forms === undefined) return [`${file}:${e.line} ${e.tgt}: “${e.quote}” is no plural clause of this noun`];
        if (forms === 'invariable') return e.tgt2 === spelling(e.tgt) ? [] : [`${file}:${e.line} ${e.tgt} is invariable, and ${e.tgt2} is not ${spelling(e.tgt)}`];
        return forms.includes(e.tgt2) ? [] : [`${file}:${e.line} ${e.tgt}: “${e.quote}” prints ${forms.join(', ')}, not ${e.tgt2}`];
      });
      assert.deepEqual(offenders, [], `${offenders.length} quotes do not print their plural:\n  ${offenders.join('\n  ')}`);
    });

    test('no ledger line outlives its row, and no row has two', () => {
      const taught = new Set(nouns.map((n) => key(n.lemma, n.tgt)));
      const seen = new Set<string>();
      const offenders = ledger.flatMap((e) => {
        const k = key(e.lemma, e.tgt);
        if (!taught.has(k)) return [`${file}:${e.line} ${e.lemma} → ${e.tgt}: ${lexicon} weaves no plural of it`];
        return seen.has(k) || !seen.add(k) ? [`${file}:${e.line} ${e.lemma} → ${e.tgt}: a second line`] : [];
      });
      assert.deepEqual(offenders, [], offenders.join('\n'));
    });

    test('the ledger has something to hold', () => {
      assert.ok(nouns.length > 150, `only ${nouns.length} woven ${name} plurals were read from ${lexicon}`);
      assert.ok(ledger.length > 150, `only ${ledger.length} lines were read from ${file}`);
    });
  });
}
