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
 * later "wætru" and "hēafdu". Or it may cite the entry of Bosworth–Toller
 * whose quotations print it, quoting the entry's head before the passage,
 * because one spelling can head two entries: "treów, es; n." is the tree,
 * "treów, e; f." faith. A row none prints, `QUEUED` names with what its
 * table prints, until a grammar or Bosworth–Toller is read for it; a queued
 * row that gains a line fails, so the list can only shrink.
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

const GENDER: Readonly<Record<string, string>> = { m: 'masculine', f: 'feminine', n: 'neuter' };

/**
 * The labels of the cell a row's form is read in: its part of speech's, or,
 * for a noun read as an adjective, the nominative plural of the row's gender
 * in the strong declension or the weak, each a form the table prints.
 */
const labels = (pos: Pos, adjective?: string): string[] =>
  adjective === undefined ? [SLOT[pos]] : ['strong', 'weak'].map((d) => `${d} ${GENDER[adjective] ?? adjective} ${SLOT[pos]}`);

/**
 * The forms a quote prints in its row's woven cell: "nominative plural
 * frīend, frēond, frēondas" prints all three, and, for a noun read as a
 * masculine adjective, "weak masculine nominative plural fremdan" prints
 * fremdan. Undefined for a quote from any other cell of the table.
 */
const printed = (quote: string, pos: Pos, adjective?: string): string[] | undefined => {
  const label = labels(pos, adjective).find((l) => quote.startsWith(`${l} `));
  if (label === undefined) return undefined;
  return quote
    .slice(label.length + 1)
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

/** A source naming an entry of Bosworth–Toller's *Anglo-Saxon Dictionary*. */
const BT = /^bt:\d+$/;

/**
 * A word of Bosworth–Toller's, read as the pack spells it: the dictionary
 * marks a long vowel with an acute accent where the pack writes a macron,
 * and a long diphthong on its second vowel where the pack marks the first —
 * "treów" is trēow, "heáfod" hēafod — hyphenates a compound's head,
 * "híw-scipe", capitalises a main entry's, and prints no dots.
 */
const ACUTE: Readonly<Record<string, string>> = { á: 'ā', é: 'ē', í: 'ī', ó: 'ō', ú: 'ū', ý: 'ȳ', ǽ: 'ǣ' };
const DIPHTHONG: Readonly<Record<string, string>> = { eá: 'ēa', eó: 'ēo', ié: 'īe', ió: 'īo' };
const btSpelling = (word: string): string =>
  undotted(
    word
      .toLowerCase()
      .replace(/eá|eó|ié|ió/gu, (d) => DIPHTHONG[d] ?? d)
      .replace(/[áéíóúýǽ]/gu, (c) => ACUTE[c] ?? c)
      .replaceAll('-', ''),
  );

/**
 * A quote from Bosworth–Toller opens with the entry's head as the
 * dictionary prints it and goes on, after " … ", to the passage that prints
 * the form: "híw-scipe, híg-, es; m. … Ealle híwscipas þeóda". The head is
 * how the line shows the entry is this word's, since one spelling can head
 * two — "treów, es; n." is the tree, "treów, e; f." faith — so it must
 * spell the headword and, for a noun, name the row's gender. Undefined for a
 * quote with no head.
 */
const btQuote = (quote: string): { head: string; gender: string | undefined; words: string[] } | undefined => {
  const at = quote.indexOf(' … ');
  if (at < 0) return undefined;
  const head = quote.slice(0, at);
  return {
    head: btSpelling(head.split(/[,\s]/u)[0] ?? ''),
    gender: head.match(/\b([mfn])\.(?!\p{L})/u)?.[1],
    words: quote.slice(at + 3).split(/[^\p{L}\p{M}-]+/u).filter(Boolean).map(btSpelling),
  };
};

/**
 * A woven form the table of its entry does not print, with what it prints
 * instead: waiting for a grammar or Bosworth–Toller to say which is right.
 * Keyed by part of speech, English lemma and headword.
 */
const QUEUED: ReadonlyMap<string, string> = new Map([
  ['noun\thusband\thūsbonda', 'its entry has no table'],
  ['noun\tface\tonsīen', 'its gloss was read in Bosworth–Toller, whose quotations are singular; Wright § 390 declines ansīen like cwēn, plural cwēne (§ 389)'],
  ['noun\tbody\tlīċ', 'its table prints līc'],
  ['noun\tbook\tbōc', 'its table prints bēċ; bōca, bōce'],
  ['noun\tchurch\tċiriċe', 'its table prints ċiriċan'],
  ['noun\tcoat\tmentel', 'its entry has no table'],
  ['noun\that\thæt', 'its table prints hættas; Bosworth–Toller (bt:17964) prints no plural, and Wright § 57 keeps a before a double consonant when a back vowel followed (catte, sacc)'],
  ['noun\tvillage\tþorp', 'its table, neuter, prints þorp; Bosworth–Toller, masculine (bt:31961), prints only the late “ealle þa þorpes”'],
  ['noun\tevening\tǣfen', 'its table prints ǣfennas'],
  ['noun\twar\twīġ', 'its own table, war’s, prints wīg; wīġ is the idol’s'],
  ['verb\tgo\tgān', 'its table prints gānde, and Wright’s paradigm of gān (§ 550) prints no present participle'],
  ['verb\twash\twasċan', 'its table prints wascende'],
]);

/**
 * Nouns whose entry is an adjective's, declined as one: English Wiktionary
 * gives `fremde`, "a stranger", no noun section, and its table declines the
 * adjective strong and weak. Such a row's line quotes the nominative plural
 * of the row's own gender, in either declension, by the labels the table
 * prints: "weak masculine nominative plural fremdan".
 */
const ADJECTIVE: ReadonlySet<string> = new Set(['noun\tstranger\tfremde']);

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

  test('a noun read as an adjective prints its own gender’s nominative plural, strong or weak', () => {
    assert.deepEqual(printed('weak masculine nominative plural fremdan', 'noun', 'm'), ['fremdan']);
    assert.deepEqual(printed('strong masculine nominative plural fremde', 'noun', 'm'), ['fremde']);
    assert.equal(printed('weak feminine nominative plural fremdan', 'noun', 'm'), undefined);
    assert.equal(printed('nominative plural fremdan', 'noun', 'm'), undefined);
    assert.equal(printed('weak masculine nominative plural fremdan', 'noun'), undefined);
  });

  test('a Wright quote holds a form as one of its words, its dots set aside', () => {
    const quote = 'burg, burh (OS. OHG. burg), city; but dat. sing. and nom. plural byrig beside byrg';
    assert.ok(wrightWords(quote).map(undotted).includes(undotted('byriġ')));
    assert.ok(!wrightWords('mete (pl. mettas), food').map(undotted).includes(undotted('metas')));
    assert.ok(WRIGHT.test('wright:§386'));
    assert.ok(!WRIGHT.test('wright:386'));
  });

  test('a Bosworth–Toller quote is read with its accents as length marks, its head naming the entry', () => {
    const q = btQuote('híw-scipe, híg-, es; m. … Ealle híwscipas þeóda universæ familiæ gentium');
    assert.equal(q?.head, undotted('hīwsċipe'));
    assert.equal(q?.gender, 'm');
    assert.ok(q?.words.includes(undotted('hīwsċipas')));
    assert.equal(btQuote('treów, es; n. … and óþre treów')?.head, undotted('trēow'));
    assert.ok(btQuote('treów, es; n. … and óþre treów')?.words.includes(undotted('trēow')));
    assert.equal(btQuote('treów, e; f. … Treów wæs gecýþed')?.gender, 'f');
    assert.equal(btQuote('ǼFEN, ǽfyn, éfen, es; m. … Ǽfena gehwám')?.head, undotted('ǣfen'));
    assert.equal(btQuote('FLÓR, gen. flóre; f: flór, es; m. … On flóra')?.gender, 'm');
    assert.equal(btQuote('Ealle híwscipas þeóda'), undefined);
    assert.ok(BT.test('bt:19147'));
    assert.ok(!BT.test('bt:'));
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
  const byRow = new Map(rows.map((r) => [key(r.lemma, r.tgt), r]));
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

    test('every ledger line cites one entry: its gloss’s, a section of Wright, or Bosworth–Toller’s', () => {
      const offenders = ledger.flatMap((e) => {
        const read = glossEntries.get(`${pos}\t${key(e.lemma, e.tgt)}`) ?? [];
        if (e.sources.length !== 1) return [`${file}:${e.line} ${e.tgt} cites ${e.sources.length} entries, where it wants the one its table is in`];
        const [source = ''] = e.sources;
        if (WRIGHT.test(source) || BT.test(source)) return [];
        return read.includes(source) ? [] : [`${file}:${e.line} ${e.tgt}: “${source}” is not an entry ${GLOSSES} read its gloss in (${read.join(' ') || 'none'}), a section of Wright, or an entry of Bosworth–Toller`];
      });
      assert.deepEqual(offenders, [], `${offenders.length} ledger lines cannot be read:\n  ${offenders.join('\n  ')}`);
    });

    test(`every quote prints the form beside it, in the ${SLOT[pos]} cell, in Wright’s words or in Bosworth–Toller’s`, () => {
      const offenders = ledger.flatMap((e) => {
        if (e.sources.some((s) => BT.test(s))) {
          const q = btQuote(e.quote);
          if (q === undefined) return [`${file}:${e.line} ${e.tgt}: “${e.quote}” does not open with the entry’s head and “ … ”`];
          if (q.head !== undotted(e.tgt)) return [`${file}:${e.line} ${e.tgt}: the entry’s head spells ${q.head}, not ${e.tgt}`];
          const gender = byRow.get(key(e.lemma, e.tgt))?.gender;
          if (pos === 'noun' && q.gender !== gender) return [`${file}:${e.line} ${e.tgt}: the entry’s head names ${q.gender ?? 'no gender'}, where ${LEXICON} gives ${gender}`];
          return q.words.includes(undotted(e.tgt2)) ? [] : [`${file}:${e.line} ${e.tgt}: Bosworth–Toller’s “${e.quote}” does not print ${e.tgt2}`];
        }
        if (e.sources.some((s) => WRIGHT.test(s))) {
          return wrightWords(e.quote).map(undotted).includes(undotted(e.tgt2)) ? [] : [`${file}:${e.line} ${e.tgt}: Wright’s “${e.quote}” does not print ${e.tgt2}`];
        }
        const k = key(e.lemma, e.tgt);
        const adjective = ADJECTIVE.has(`${pos}\t${k}`) ? (byRow.get(k)?.gender ?? '') : undefined;
        const forms = printed(e.quote, pos, adjective);
        if (forms === undefined) return [`${file}:${e.line} ${e.tgt}: “${e.quote}” is not the ${labels(pos, adjective).join(' or ')} cell`];
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

    test('nothing is queued, or read as an adjective, that the pack no longer weaves', () => {
      const taught = new Set(rows.map((r) => key(r.lemma, r.tgt)));
      const listed = [...[...QUEUED.keys()].map((k) => ['QUEUED', k]), ...[...ADJECTIVE].map((k) => ['ADJECTIVE', k])];
      const offenders = listed
        .filter(([, k = '']) => k.startsWith(`${pos}\t`))
        .flatMap(([table, k = '']) => (taught.has(k.slice(pos.length + 1)) ? [] : [`${table} ${k.replace(/\t/g, ' ')}: ${LEXICON} weaves no ${NAME[pos]} of it`]));
      assert.deepEqual(offenders, [], offenders.join('\n'));
    });

    test('the ledger has something to hold', () => {
      assert.ok(rows.length > 70, `only ${rows.length} woven Old English ${NAME[pos]}s were read from ${LEXICON}`);
      assert.ok(ledger.length > 70, `only ${ledger.length} lines were read from ${file}`);
    });
  });
}
