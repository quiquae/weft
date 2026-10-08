/**
 * A woven Latin plural or participle names the table that prints it.
 *
 * A noun row weaves its second form under an English plural and a verb row
 * under an English *-ing*, and the tooltip prints that form as the word the
 * reader met. Their sounds have been held to Allen & Greenough since
 * 2026-10-04, and two plurals Lewis & Short refuses are woven no more, but
 * nothing held their spellings: `iūsiūranda` and `loca` were each found by
 * chance. Lewis & Short prints a noun's genitive and gender, not its plural,
 * and a verb's principal parts, not its participle; English Wiktionary's
 * Latin entries decline and conjugate every word in a table whose cells
 * carry a class per slot — `nom|p` for the nominative plural,
 * `pres|act|part` for the present active participle — and on 2026-10-08
 * each second form was read in the rendered table of its headword's entry.
 *
 * So `tools/seed/la-plurals.tsv` and `la-verb-forms.tsv` repeat every woven
 * form beside that entry and the cell as the table prints it, and these
 * tests hold the files together: a form changed in the seed and not in the
 * ledger fails, as does a line citing another word's entry, a quote from
 * another cell, or a line outliving its row. Wiktionary files a verb under
 * its first person, the key Lewis & Short files it under in
 * `la-glosses.tsv`, so a verb's line cites that key's entry, with *j*
 * written *i* and the homograph number dropped. Where the table prints
 * another form than the one woven, `QUEUED` names the row with what the
 * table prints, until a grammar is read for it; a queued row that gains a
 * line fails, so the list can only shrink.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SEED = join(ROOT, 'tools/seed');
const LEXICON = 'lex-la.tsv';
const GLOSSES = 'la-glosses.tsv';

type Pos = 'noun' | 'verb';
type Row = { line: number; lemma: string; tgt: string; tgt2: string; gender: string };
type Form = { line: number; lemma: string; tgt: string; tgt2: string; sources: string[]; quote: string };

const tsv = (file: string): Array<{ line: number; f: string[] }> =>
  readFileSync(join(SEED, file), 'utf8')
    .split('\n')
    .flatMap((text, i) => (text && !text.startsWith('#') ? [{ line: i + 1, f: text.split('\t') }] : []));

/** Every row of a part of speech that weaves a second form. */
const woven = (pos: Pos): Row[] =>
  tsv(LEXICON)
    .filter(({ f }) => f[1] === pos && (f[3] ?? '') !== '')
    .map(({ line, f }) => ({ line, lemma: f[0] ?? '', tgt: f[2] ?? '', tgt2: f[3] ?? '', gender: f[4] ?? '' }));

/** A ledger not yet written holds nothing, so every row it should hold is named. */
const readLedger = (file: string): Form[] =>
  (existsSync(join(SEED, file)) ? tsv(file) : []).map(({ line, f }) => ({
    line,
    lemma: f[0] ?? '',
    tgt: f[1] ?? '',
    tgt2: f[2] ?? '',
    sources: (f[3] ?? '').split(' ').filter(Boolean),
    quote: f[4] ?? '',
  }));

const key = (lemma: string, tgt: string): string => `${lemma}\t${tgt}`;

/** The cell each part of speech weaves, by the label English Wiktionary's table gives it. */
const SLOT: Readonly<Record<Pos, string>> = { noun: 'nominative plural', verb: 'present active participle' };
const FILE: Readonly<Record<Pos, string>> = { noun: 'la-plurals.tsv', verb: 'la-verb-forms.tsv' };
const NAME: Readonly<Record<Pos, string>> = { noun: 'plural', verb: 'present participle' };

/** A Wiktionary title: the macrons dropped, as English Wiktionary titles a Latin word. */
const title = (word: string): string =>
  word
    .replace(/[²³⁴⁵⁶⁷⁸⁹]$/u, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .normalize('NFC');

/** The Lewis & Short keys each row's gloss line names. */
const glossKeys = new Map(
  tsv(GLOSSES).map(({ f }) => [
    `${f[1]}\t${key(f[0] ?? '', f[2] ?? '')}`,
    (f[3] ?? '').split(' ').flatMap((s) => (s.startsWith('ls:') ? [s.slice(3)] : [])),
  ]),
);

/**
 * The entry a row's table is read in: a noun's own, by its headword; a verb's
 * first person, by the key `la-glosses.tsv` read it under in Lewis & Short.
 */
const entryOf = (pos: Pos, lemma: string, tgt: string): string => {
  if (pos === 'noun') return `wikt:la:${title(tgt)}`;
  const [k = ''] = glossKeys.get(`${pos}\t${key(lemma, tgt)}`) ?? [];
  return `wikt:la:${k.replace(/\d+$/, '').replaceAll('j', 'i').replaceAll('J', 'I')}`;
};

const GENDER: Readonly<Record<string, string>> = { m: 'masculine', f: 'feminine', n: 'neuter' };

/** The label of the cell a row's form is read in: for a noun read as an adjective, its gender's. */
const label = (pos: Pos, adjective?: string): string =>
  adjective === undefined ? SLOT[pos] : `${GENDER[adjective] ?? adjective} ${SLOT[pos]}`;

/**
 * The forms a quote prints in its row's woven cell: "nominative plural locī,
 * loca" prints both, and, for a noun read as a masculine adjective,
 * "masculine nominative plural aliēnī" prints aliēnī. Undefined for a quote
 * from any other cell.
 */
const printed = (quote: string, pos: Pos, adjective?: string): string[] | undefined => {
  const cell = `${label(pos, adjective)} `;
  if (!quote.startsWith(cell)) return undefined;
  return quote
    .slice(cell.length)
    .split(/\s*,\s*|\s+or\s+/)
    .map((form) => form.trim())
    .filter(Boolean);
};

/**
 * A woven form the table of its entry does not print, with what it prints
 * instead: waiting for a grammar or Lewis & Short to say which is right.
 * Keyed by part of speech, English lemma and headword.
 */
const QUEUED: ReadonlyMap<string, string> = new Map([
  ['verb\ttell\tnārrāre', 'its table prints narrāns, the first vowel short'],
]);

/**
 * Nouns whose entry is an adjective's, declined as one: English Wiktionary
 * gives `aliēnus`, a stranger in Lewis & Short's "Subst.", no noun section.
 * Such a row's line quotes the nominative plural of the row's own gender, by
 * the labels the table prints: "masculine nominative plural aliēnī".
 */
const ADJECTIVE: ReadonlySet<string> = new Set(['noun\tstranger\taliēnus']);

describe('the woven cell of a Latin table is read as a reader reads it', () => {
  test('a cell with several forms prints each of them', () => {
    assert.deepEqual(printed('nominative plural locī, loca', 'noun'), ['locī', 'loca']);
    assert.deepEqual(printed('present active participle movēns', 'verb'), ['movēns']);
  });

  test('a quote from another cell is not the woven one', () => {
    assert.equal(printed('genitive plural virōrum', 'noun'), undefined);
    assert.equal(printed('future active participle mōtūrus', 'verb'), undefined);
  });

  test('a noun read as an adjective prints its own gender’s nominative plural', () => {
    assert.deepEqual(printed('masculine nominative plural aliēnī', 'noun', 'm'), ['aliēnī']);
    assert.equal(printed('feminine nominative plural aliēnae', 'noun', 'm'), undefined);
    assert.equal(printed('nominative plural aliēnī', 'noun', 'm'), undefined);
    assert.equal(printed('masculine nominative plural aliēnī', 'noun'), undefined);
  });

  test('a title drops the macrons, and a verb is filed under its first person', () => {
    assert.equal(title('iānua'), 'ianua');
    assert.equal(entryOf('verb', 'go', 'īre'), 'wikt:la:eo');
  });
});

for (const pos of ['noun', 'verb'] as const) {
  const file = FILE[pos];
  const rows = woven(pos);
  const ledger = readLedger(file);
  const byKey = new Map(ledger.map((e) => [key(e.lemma, e.tgt), e]));
  const byRow = new Map(rows.map((r) => [key(r.lemma, r.tgt), r]));
  const queued = (lemma: string, tgt: string): boolean => QUEUED.has(`${pos}\t${key(lemma, tgt)}`);

  describe(`every woven Latin ${NAME[pos]} names the table that prints it`, () => {
    test(`every ${pos} weaves the form its ledger line gives, or is queued`, () => {
      const offenders = rows.flatMap((r) => {
        if (queued(r.lemma, r.tgt)) return [];
        const e = byKey.get(key(r.lemma, r.tgt));
        if (!e) return [`${LEXICON}:${r.line} ${r.lemma} → ${r.tgt} / ${r.tgt2}: no line in ${file}`];
        return e.tgt2 === r.tgt2 ? [] : [`${LEXICON}:${r.line} ${r.lemma} → ${r.tgt} weaves ${r.tgt2}, where ${file}:${e.line} read ${e.tgt2}`];
      });
      assert.deepEqual(offenders, [], `${offenders.length} Latin ${NAME[pos]}s are unsourced:\n  ${offenders.join('\n  ')}`);
    });

    test('every ledger line cites its headword’s entry', () => {
      const offenders = ledger.flatMap((e) => {
        const wanted = entryOf(pos, e.lemma, e.tgt);
        if (e.sources.length !== 1) return [`${file}:${e.line} ${e.tgt} cites ${e.sources.length} entries, where it wants ${wanted}`];
        return e.sources[0] === wanted ? [] : [`${file}:${e.line} ${e.tgt}: “${e.sources[0]}” is not ${wanted}`];
      });
      assert.deepEqual(offenders, [], `${offenders.length} ledger lines cannot be read:\n  ${offenders.join('\n  ')}`);
    });

    test(`every quote prints the form beside it, in the ${SLOT[pos]} cell`, () => {
      const offenders = ledger.flatMap((e) => {
        const k = key(e.lemma, e.tgt);
        const adjective = ADJECTIVE.has(`${pos}\t${k}`) ? (byRow.get(k)?.gender ?? '') : undefined;
        const forms = printed(e.quote, pos, adjective);
        if (forms === undefined) return [`${file}:${e.line} ${e.tgt}: “${e.quote}” is not the ${label(pos, adjective)} cell`];
        return forms.includes(e.tgt2) ? [] : [`${file}:${e.line} ${e.tgt}: “${e.quote}” prints ${forms.join(', ')}, not ${e.tgt2}`];
      });
      assert.deepEqual(offenders, [], `${offenders.length} quotes do not print their form:\n  ${offenders.join('\n  ')}`);
    });

    test('no ledger line outlives its row, and no row has two', () => {
      const taught = new Set(rows.map((r) => key(r.lemma, r.tgt)));
      const seen = new Set<string>();
      const offenders = ledger.flatMap((e) => {
        const k = key(e.lemma, e.tgt);
        if (!taught.has(k)) return [`${file}:${e.line} ${e.lemma} → ${e.tgt}: ${LEXICON} weaves no ${NAME[pos]} of it`];
        if (queued(e.lemma, e.tgt)) return [`${file}:${e.line} ${e.lemma} → ${e.tgt} has a line, so QUEUED need not name it`];
        return seen.has(k) || !seen.add(k) ? [`${file}:${e.line} ${e.lemma} → ${e.tgt}: a second line`] : [];
      });
      assert.deepEqual(offenders, [], offenders.join('\n'));
    });

    test('nothing is queued, or read as an adjective, that the pack no longer weaves', () => {
      const taught = new Set(rows.map((r) => key(r.lemma, r.tgt)));
      const listed = [...[...QUEUED.keys()].map((k) => ['QUEUED', k]), ...[...ADJECTIVE].map((k) => ['ADJECTIVE', k])];
      const offenders = listed
        .filter(([, k = '']) => k.startsWith(`${pos}\t`))
        .flatMap(([table, k = '']) => (taught.has(k.slice(pos.length + 1)) ? [] : [`${table} ${k.replace(/\t/g, ' ')}: ${LEXICON} weaves no ${NAME[pos]} of it`]));
      assert.deepEqual(offenders, [], offenders.join('\n'));
    });

    test('the ledger has something to hold', () => {
      assert.ok(rows.length > 70, `only ${rows.length} woven Latin ${NAME[pos]}s were read from ${LEXICON}`);
      assert.ok(ledger.length > 60, `only ${ledger.length} lines were read from ${file}`);
    });
  });
}
