/**
 * A woven modern verb form names the conjugation table that prints it.
 *
 * A verb row weaves its second form under an English *-ing*, and the tooltip
 * prints that form as the word the reader met. Each modern plural has named
 * the headword line that prints it since 2026-10-08, and the same pass left
 * the 400 verb forms unread. A verb's headword line prints none of them; its
 * conjugation table does, in one cell per language, and the cell is not the
 * same slot everywhere: French and German weave the present participle
 * (*disant*, *sagend*), Spanish, Portuguese and Italian the gerund
 * (*diciendo*, *dizendo*, *dicendo*). Italian's present participle is a
 * different word, *dicente*, so `SLOT` says which cell each language's form
 * must sit in, by the label English Wiktionary's table gives it.
 *
 * So `tools/seed/<lang>-verb-forms.tsv` repeats every woven verb form beside
 * the entry whose table prints it and the label and cell as the table prints
 * them, and these tests hold the files together: a form changed in the seed
 * and not in the ledger fails, as does a line citing some other word's entry,
 * a quote from another cell of the table, or a line outliving its row. The
 * quote is the check, as in the plural ledgers: it cannot tell a page
 * somebody read from one somebody typed, and the pages cited should be the
 * ones actually opened.
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

type Verb = { line: number; lemma: string; tgt: string; tgt2: string };
type Form = { line: number; lemma: string; tgt: string; tgt2: string; sources: string[]; quote: string };

const tsv = (path: string): Array<{ line: number; f: string[] }> =>
  readFileSync(path, 'utf8')
    .split('\n')
    .flatMap((text, i) => (text && !text.startsWith('#') ? [{ line: i + 1, f: text.split('\t') }] : []));

/** Every verb row that weaves a second form. A blank one is never woven under an *-ing*. */
const readVerbs = (path: string): Verb[] =>
  tsv(path)
    .filter(({ f }) => f[1] === 'verb' && (f[3] ?? '') !== '')
    .map(({ line, f }) => ({ line, lemma: f[0] ?? '', tgt: f[2] ?? '', tgt2: f[3] ?? '' }));

const readLedger = (path: string): Form[] =>
  tsv(path).map(({ line, f }) => ({
    line,
    lemma: f[0] ?? '',
    tgt: f[1] ?? '',
    tgt2: f[2] ?? '',
    sources: (f[3] ?? '').split(' ').filter(Boolean),
    quote: f[4] ?? '',
  }));

const key = (lemma: string, tgt: string): string => `${lemma}\t${tgt}`;

/**
 * The label English Wiktionary's conjugation table gives the cell each
 * language weaves, as the table prints it. French's one row is both, "present
 * participle or gerund"; Italian's table has a gerund and a present
 * participle, and the gerund is woven.
 */
const SLOT: Readonly<Record<string, string>> = {
  de: 'present participle',
  es: 'gerund',
  fr: 'present participle or gerund',
  it: 'gerund',
  pt: 'Gerund',
};

/**
 * A pronominal infinitive whose woven form is its verb's gerund without the
 * pronoun, with the verb whose table prints that gerund and what its own page
 * prints instead. The pronoun may stand before the verb that carries the
 * gerund, "se está sentando", "si sta sedendo", so the bare gerund is a form
 * the reader meets; its line cites both entries.
 */
const PRONOMINAL: ReadonlyMap<string, { verb: string; own: string }> = new Map([
  ['es\tsentarse', { verb: 'sentar', own: 'no table: “infinitive of sentar combined with se”' }],
  ['it\tsedersi', { verb: 'sedere', own: 'the gerund with its pronoun joined, “sedèndosi”' }],
]);

/**
 * Italian's tables mark the stressed vowel of every form, "avèndo", where the
 * spelling writes an accent only on a final vowel. So a mark on any other
 * vowel is the table's, and set aside.
 */
const unstressed = (form: string): string =>
  form
    .normalize('NFD')
    .replace(/([aeiou])[\u0300\u0301](?=\p{L})/gu, '$1')
    .normalize('NFC');

/**
 * The forms a quote prints in its language's woven cell: "present participle
 * or gerund assoyant or asseyant" prints assoyant and asseyant. Undefined for
 * a quote from any other cell of the table.
 */
const printed = (quote: string, lang: string): string[] | undefined => {
  const label = `${SLOT[lang] ?? '?'} `;
  if (!quote.startsWith(label)) return undefined;
  return quote
    .slice(label.length)
    .split(/\s*,\s*|\s+or\s+/)
    .map((form) => (lang === 'it' ? unstressed(form.trim()) : form.trim()))
    .filter(Boolean);
};

const shipped = readdirSync(PACKS).flatMap((f) => /^en-([a-z]+)\.json$/.exec(f)?.slice(1, 2) ?? []);

// Every shipped pack but the two read in their own dictionaries, so a pack
// added later fails here until its verb forms are read too.
const MODERN = shipped.filter((lang) => lang !== 'ang' && lang !== 'la');

const NAME: Readonly<Record<string, string>> = {
  de: 'German',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  pt: 'Portuguese',
};

describe('the woven cell of a conjugation table is read as a reader reads it', () => {
  test('a cell with two forms prints each of them', () => {
    assert.deepEqual(printed('present participle or gerund assoyant or asseyant', 'fr'), ['assoyant', 'asseyant']);
    assert.deepEqual(printed('gerund diciendo', 'es'), ['diciendo']);
    assert.deepEqual(printed('present participle sagend', 'de'), ['sagend']);
  });

  test('an Italian stress mark is the table’s, and a final accent is the word’s', () => {
    assert.deepEqual(printed('gerund avèndo', 'it'), ['avendo']);
    assert.deepEqual(printed('gerund dicèndo', 'it'), ['dicendo']);
    assert.equal(unstressed('città'), 'città');
  });

  test('a quote from another cell is not the woven one', () => {
    assert.equal(printed('present participle avènte', 'it'), undefined);
    assert.equal(printed('past participle dit', 'fr'), undefined);
    assert.equal(printed('gerund sagend', 'de'), undefined);
    assert.equal(printed('with gerund diciendo', 'es'), undefined);
  });
});

test('every modern pack has a verb-form ledger, and a woven cell', () => {
  const missing = MODERN.flatMap((lang) => [
    ...(existsSync(join(SEED, `${lang}-verb-forms.tsv`)) ? [] : [`en-${lang}.json ships, and tools/seed/${lang}-verb-forms.tsv does not exist`]),
    ...(SLOT[lang] ? [] : [`en-${lang}.json ships, and SLOT does not say which cell of its tables is woven`]),
  ]);
  assert.deepEqual(missing, []);
  assert.ok(MODERN.length >= 5, `only ${MODERN.length} modern packs were found`);
});

test('no infinitive is listed as pronominal unless a pack weaves a form of it', () => {
  const offenders = [...PRONOMINAL.keys()].flatMap((k) => {
    const [lang = '', tgt = ''] = k.split('\t');
    const path = join(SEED, `lex-${lang}.tsv`);
    const taught = existsSync(path) && readVerbs(path).some((v) => v.tgt === tgt);
    return taught ? [] : [`PRONOMINAL ${lang} ${tgt}: lex-${lang}.tsv weaves no form of it`];
  });
  assert.deepEqual(offenders, []);
});

for (const lang of MODERN.filter((l) => existsSync(join(SEED, `${l}-verb-forms.tsv`)))) {
  const name = NAME[lang] ?? lang;
  const lexicon = `lex-${lang}.tsv`;
  const file = `${lang}-verb-forms.tsv`;
  const verbs = readVerbs(join(SEED, lexicon));
  const ledger = readLedger(join(SEED, file));
  const byKey = new Map(ledger.map((e) => [key(e.lemma, e.tgt), e]));

  describe(`every woven ${name} verb form names the table that prints it`, () => {
    test('every verb weaves the form its ledger line gives', () => {
      const offenders = verbs.flatMap((v) => {
        const e = byKey.get(key(v.lemma, v.tgt));
        if (!e) return [`${lexicon}:${v.line} ${v.lemma} → ${v.tgt} / ${v.tgt2}: no line in ${file}`];
        return e.tgt2 === v.tgt2 ? [] : [`${lexicon}:${v.line} ${v.lemma} → ${v.tgt} weaves ${v.tgt2}, where ${file}:${e.line} read ${e.tgt2}`];
      });
      assert.deepEqual(offenders, [], `${offenders.length} ${name} verb forms are unsourced:\n  ${offenders.join('\n  ')}`);
    });

    test('every ledger line cites its own word’s entry, and a pronominal verb’s the one without it', () => {
      const offenders = ledger.flatMap((e) => {
        const own = `wikt:${lang}:${spelling(e.tgt)}`;
        const verb = PRONOMINAL.get(`${lang}\t${e.tgt}`)?.verb;
        const wanted = verb ? [own, `wikt:${lang}:${verb}`] : [own];
        const other = e.sources.filter((s) => !wanted.includes(s));
        if (other.length) return [`${file}:${e.line} ${e.tgt}: ${other.map((s) => `“${s}”`).join(' ')} is not ${wanted.join(' or ')}`];
        const lacking = wanted.filter((s) => !e.sources.includes(s));
        return lacking.length ? [`${file}:${e.line} ${e.tgt} does not cite ${lacking.join(' ')}`] : [];
      });
      assert.deepEqual(offenders, [], `${offenders.length} ledger lines cannot be read:\n  ${offenders.join('\n  ')}`);
    });

    test(`every quote prints the form beside it, in the ${SLOT[lang] ?? '?'} cell`, () => {
      const offenders = ledger.flatMap((e) => {
        const forms = printed(e.quote, lang);
        if (forms === undefined) return [`${file}:${e.line} ${e.tgt}: “${e.quote}” is not the ${SLOT[lang] ?? '?'} cell of its table`];
        return forms.includes(e.tgt2) ? [] : [`${file}:${e.line} ${e.tgt}: “${e.quote}” prints ${forms.join(', ')}, not ${e.tgt2}`];
      });
      assert.deepEqual(offenders, [], `${offenders.length} quotes do not print their form:\n  ${offenders.join('\n  ')}`);
    });

    test('no ledger line outlives its row, and no row has two', () => {
      const taught = new Set(verbs.map((v) => key(v.lemma, v.tgt)));
      const seen = new Set<string>();
      const offenders = ledger.flatMap((e) => {
        const k = key(e.lemma, e.tgt);
        if (!taught.has(k)) return [`${file}:${e.line} ${e.lemma} → ${e.tgt}: ${lexicon} weaves no form of it`];
        return seen.has(k) || !seen.add(k) ? [`${file}:${e.line} ${e.lemma} → ${e.tgt}: a second line`] : [];
      });
      assert.deepEqual(offenders, [], offenders.join('\n'));
    });

    test('the ledger has something to hold', () => {
      assert.ok(verbs.length > 70, `only ${verbs.length} woven ${name} verb forms were read from ${lexicon}`);
      assert.ok(ledger.length > 70, `only ${ledger.length} lines were read from ${file}`);
    });
  });
}
