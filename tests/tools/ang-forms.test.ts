/**
 * A woven Old English plural or participle names the table that prints it.
 *
 * A noun row weaves its second form under an English plural and a verb row
 * under an English *-ing*, and the tooltip prints that form as the word the
 * reader met. Every modern plural and verb form has named the entry that
 * prints it since 2026-10-08, and the Old English ones named none: the dots
 * along their stems were held to their headwords, their transcriptions to
 * Wright, and nothing to a dictionary's paradigm. English Wiktionary's
 * Old English entries decline every noun and conjugate every verb in a table
 * whose cells carry a class per slot — `nom|p` for the nominative plural,
 * `pres|part` for the present participle — and on 2026-10-08 each of the 239
 * second forms was read in the rendered table of the entry its gloss was read
 * in.
 *
 * So `tools/seed/ang-plurals.tsv` and `ang-verb-forms.tsv` repeat every woven
 * form beside that entry and the cell as the table prints it, and these tests
 * hold the files together: a form changed in the seed and not in the ledger
 * fails, as does a line citing an entry its gloss was not read in, a quote
 * from another cell, or a line outliving its row. Where the table prints
 * another form than the one woven, the line may cite instead the section of
 * Joseph and Elizabeth Mary Wright's *Old English Grammar* (1914) that prints
 * it, quoting its words: the paradigm of `wæter` and `hēafod` gives their
 * plurals as "wæter" and "hēafodu" (§ 347) where the tables print only the
 * later "wætru" and "hēafdu". A row neither prints, `QUEUED` names with what
 * its table prints, until a grammar or Bosworth–Toller is read for it; a
 * queued row that gains a line fails, so the list can only shrink.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SEED = join(ROOT, 'tools/seed');
const LEXICON = 'lex-ang.tsv';
const GLOSSES = 'ang-glosses.tsv';

type Pos = 'noun' | 'verb';
type Row = { line: number; lemma: string; tgt: string; tgt2: string };
type Form = { line: number; lemma: string; tgt: string; tgt2: string; sources: string[]; quote: string };

const tsv = (file: string): Array<{ line: number; f: string[] }> =>
  readFileSync(join(SEED, file), 'utf8')
    .split('\n')
    .flatMap((text, i) => (text && !text.startsWith('#') ? [{ line: i + 1, f: text.split('\t') }] : []));

/** Every row of a part of speech that weaves a second form. */
const woven = (pos: Pos): Row[] =>
  tsv(LEXICON)
    .filter(({ f }) => f[1] === pos && (f[3] ?? '') !== '')
    .map(({ line, f }) => ({ line, lemma: f[0] ?? '', tgt: f[2] ?? '', tgt2: f[3] ?? '' }));

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
const SLOT: Readonly<Record<Pos, string>> = { noun: 'nominative plural', verb: 'present participle' };
const FILE: Readonly<Record<Pos, string>> = { noun: 'ang-plurals.tsv', verb: 'ang-verb-forms.tsv' };
const NAME: Readonly<Record<Pos, string>> = { noun: 'plural', verb: 'present participle' };

/**
 * Two things the pack writes otherwise than English Wiktionary's tables, on
 * every word: ð, which the pack keeps where a teaching edition prints it and
 * Wiktionary files under þ, so that its `broðor` page only names `broþor`;
 * and the doubled palatal, which the pack writes cg, "dg" in its
 * pronunciation key, where the tables write ċġ. Neither is a different form.
 */
const fold = (form: string): string => form.replaceAll('ð', 'þ').replaceAll('ċġ', 'cg');

/**
 * The forms a quote prints in its part of speech's woven cell: "nominative
 * plural frīend, frēond, frēondas" prints all three. Undefined for a quote
 * from any other cell of the table.
 */
const printed = (quote: string, pos: Pos): string[] | undefined => {
  const label = `${SLOT[pos]} `;
  if (!quote.startsWith(label)) return undefined;
  return quote
    .slice(label.length)
    .split(/\s*,\s*|\s+or\s+/)
    .map((form) => form.trim())
    .filter(Boolean);
};

/** A source naming a section of Wright's *Old English Grammar*. */
const WRIGHT = /^wright:§\d+$/;

/**
 * The words of a quote from Wright, read as the pack spells them: Wright
 * prints no dots on ċ and ġ, where the pack dots every palatal, so a Wright
 * quote is compared with the dots set aside. "nom. plural byrig beside
 * byrg" holds byriġ.
 */
const wrightWords = (quote: string): string[] => quote.split(/[^\p{L}\p{M}]+/u).filter(Boolean).map((w) => fold(w));
const undotted = (form: string): string => fold(form).replaceAll('ċ', 'c').replaceAll('ġ', 'g');

/**
 * A woven form the table of its entry does not print, with what it prints
 * instead: waiting for a grammar or Bosworth–Toller to say which is right.
 * Keyed by part of speech, English lemma and headword.
 */
const QUEUED: ReadonlyMap<string, string> = new Map([
  ['noun\tfamily\thīwsċipe', 'its gloss was read in Bosworth–Toller, whose entry (bt:19147) prints “Ealle híwscipas þeóda”, and no Wiktionary table was read'],
  ['noun\thusband\thūsbonda', 'its entry has no table'],
  ['noun\tstranger\tfremde', 'its entry has no table'],
  ['noun\tsoldier\tċempa', 'its table prints cempan'],
  ['noun\tface\tonsīen', 'its gloss was read in Bosworth–Toller, whose quotations are singular; Wright § 390 declines ansīen like cwēn, plural cwēne (§ 389)'],
  ['noun\tbody\tlīċ', 'its table prints līc'],
  ['noun\tbook\tbōc', 'its table prints bēċ; bōca, bōce'],
  ['noun\tkey\tċǣġ', 'its table prints cǣġa, cǣġe'],
  ['noun\tchurch\tċiriċe', 'its table prints ċiriċan'],
  ['noun\tcoat\tmentel', 'its entry has no table'],
  ['noun\that\thæt', 'its table prints hættas; Bosworth–Toller (bt:17964) prints no plural, and Wright § 57 keeps a before a double consonant when a back vowel followed (catte, sacc)'],
  ['noun\ttree\ttrēow', 'its table, the tree’s, prints trēowu; Wright § 363 declines trēo(w) like cnēo, plural cnēo (§ 361)'],
  ['noun\tvillage\tþorp', 'its table, neuter, prints þorp; Bosworth–Toller, masculine (bt:31961), prints only the late “ealle þa þorpes”'],
  ['noun\tevening\tǣfen', 'its table prints ǣfennas'],
  ['noun\twar\twīġ', 'its own table, war’s, prints wīg; wīġ is the idol’s'],
  ['verb\tgo\tgān', 'its table prints gānde, and Wright’s paradigm of gān (§ 550) prints no present participle'],
  ['verb\tbegin\tbeginnan', 'its table prints beġinnende'],
  ['verb\tlaugh\thlīehhan', 'its table prints hliehhende'],
  ['verb\twash\twasċan', 'its table prints wascende'],
]);

/** The Wiktionary titles each row's gloss line names: the entries its gloss was read in. */
const glossEntries = new Map(
  tsv(GLOSSES).map(({ f }) => [
    `${f[1]}\t${key(f[0] ?? '', f[2] ?? '')}`,
    (f[3] ?? '').split(' ').filter((s) => s.startsWith('wikt:ang:')),
  ]),
);

describe('the woven cell of an Old English table is read as a reader reads it', () => {
  test('a cell with several forms prints each of them', () => {
    assert.deepEqual(printed('nominative plural frīend, frēond, frēondas', 'noun'), ['frīend', 'frēond', 'frēondas']);
    assert.deepEqual(printed('present participle berende', 'verb'), ['berende']);
  });

  test('a quote from another cell is not the woven one', () => {
    assert.equal(printed('genitive plural manna', 'noun'), undefined);
    assert.equal(printed('nominative plural berende', 'verb'), undefined);
    assert.equal(printed('past participle boren', 'verb'), undefined);
  });

  test('a Wright quote holds a form as one of its words, its dots set aside', () => {
    const quote = 'burg, burh (OS. OHG. burg), city; but dat. sing. and nom. plural byrig beside byrg';
    assert.ok(wrightWords(quote).map(undotted).includes(undotted('byriġ')));
    assert.ok(!wrightWords('mete (pl. mettas), food').map(undotted).includes(undotted('metas')));
    assert.ok(WRIGHT.test('wright:§386'));
    assert.ok(!WRIGHT.test('wright:386'));
  });

  test('ð is þ and cg is ċġ, and nothing else is folded', () => {
    assert.equal(fold('mōnðas'), fold('mōnþas'));
    assert.equal(fold('bryċġa'), 'brycga');
    assert.notEqual(fold('wīġ'), fold('wīg'));
    assert.notEqual(fold('hēafodu'), fold('hēafdu'));
  });
});

for (const pos of ['noun', 'verb'] as const) {
  const file = FILE[pos];
  const rows = woven(pos);
  const ledger = readLedger(file);
  const byKey = new Map(ledger.map((e) => [key(e.lemma, e.tgt), e]));
  const queued = (lemma: string, tgt: string): boolean => QUEUED.has(`${pos}\t${key(lemma, tgt)}`);

  describe(`every woven Old English ${NAME[pos]} names the table that prints it`, () => {
    test(`every ${pos} weaves the form its ledger line gives, or is queued`, () => {
      const offenders = rows.flatMap((r) => {
        if (queued(r.lemma, r.tgt)) return [];
        const e = byKey.get(key(r.lemma, r.tgt));
        if (!e) return [`${LEXICON}:${r.line} ${r.lemma} → ${r.tgt} / ${r.tgt2}: no line in ${file}`];
        return e.tgt2 === r.tgt2 ? [] : [`${LEXICON}:${r.line} ${r.lemma} → ${r.tgt} weaves ${r.tgt2}, where ${file}:${e.line} read ${e.tgt2}`];
      });
      assert.deepEqual(offenders, [], `${offenders.length} Old English ${NAME[pos]}s are unsourced:\n  ${offenders.join('\n  ')}`);
    });

    test('every ledger line cites one entry, its gloss’s or a section of Wright', () => {
      const offenders = ledger.flatMap((e) => {
        const read = glossEntries.get(`${pos}\t${key(e.lemma, e.tgt)}`) ?? [];
        if (e.sources.length !== 1) return [`${file}:${e.line} ${e.tgt} cites ${e.sources.length} entries, where it wants the one its table is in`];
        const [source = ''] = e.sources;
        if (WRIGHT.test(source)) return [];
        return read.includes(source) ? [] : [`${file}:${e.line} ${e.tgt}: “${source}” is not an entry ${GLOSSES} read its gloss in (${read.join(' ') || 'none'}), nor a section of Wright`];
      });
      assert.deepEqual(offenders, [], `${offenders.length} ledger lines cannot be read:\n  ${offenders.join('\n  ')}`);
    });

    test(`every quote prints the form beside it, in the ${SLOT[pos]} cell or in Wright’s words`, () => {
      const offenders = ledger.flatMap((e) => {
        if (e.sources.some((s) => WRIGHT.test(s))) {
          return wrightWords(e.quote).map(undotted).includes(undotted(e.tgt2)) ? [] : [`${file}:${e.line} ${e.tgt}: Wright’s “${e.quote}” does not print ${e.tgt2}`];
        }
        const forms = printed(e.quote, pos);
        if (forms === undefined) return [`${file}:${e.line} ${e.tgt}: “${e.quote}” is not the ${SLOT[pos]} cell`];
        return forms.map(fold).includes(fold(e.tgt2)) ? [] : [`${file}:${e.line} ${e.tgt}: “${e.quote}” prints ${forms.join(', ')}, not ${e.tgt2}`];
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

    test('nothing is queued that the pack no longer weaves', () => {
      const taught = new Set(rows.map((r) => key(r.lemma, r.tgt)));
      const offenders = [...QUEUED.keys()]
        .filter((k) => k.startsWith(`${pos}\t`))
        .flatMap((k) => (taught.has(k.slice(pos.length + 1)) ? [] : [`QUEUED ${k.replace(/\t/g, ' ')}: ${LEXICON} weaves no ${NAME[pos]} of it`]));
      assert.deepEqual(offenders, [], offenders.join('\n'));
    });

    test('the ledger has something to hold', () => {
      assert.ok(rows.length > 70, `only ${rows.length} woven Old English ${NAME[pos]}s were read from ${LEXICON}`);
      assert.ok(ledger.length > 70, `only ${ledger.length} lines were read from ${file}`);
    });
  });
}
