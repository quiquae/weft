/**
 * A modern gloss names the dictionary entry that gives it.
 *
 * The gloss is the first claim a reader meets: the English word a target word
 * is woven for, printed back in the tooltip. Every other claim the five modern
 * packs make about a word has named its entry since 2026-10-08 — a noun's
 * gender in `<lang>-genders.tsv`, a woven plural in `<lang>-plurals.tsv`, a
 * woven verb form in `<lang>-verb-forms.tsv` — and the gloss named none, as
 * the Latin and Old English glosses named none until `la-glosses.tsv` and
 * `ang-glosses.tsv`, which `la-glosses.test.ts` and `ang-glosses.test.ts`
 * hold to the rules this file repeats.
 *
 * So `tools/seed/<lang>-glosses.tsv` quotes, for every row of
 * `lex-<lang>.tsv`, the definition line of the word's English Wiktionary
 * entry that gives its gloss, and these tests hold the two files together. A
 * quote holds its row's English word, or the line names the word of the quote
 * that stands for it: `tissu` is "fabric" where the row is woven for "cloth".
 * Naming the stand-in is the point — a line cannot pass for one that holds
 * the word, and a reader of the ledger sees each gloss the dictionary only
 * approaches. The quote cannot be checked against the dictionary here; every
 * quote was drafted from the entry's rendered page and read against it when
 * it was written, and the entries cited should be the ones actually opened.
 *
 * The languages are read one at a time, each added to `READ` as it is, and
 * `UNREAD` names those still waiting, so a pack added later fails here until
 * its glosses are read or it is listed.
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

/** The languages whose every row the ledgers hold. */
const READ = new Set(['fr', 'es', 'pt']);

/** The modern languages whose glosses are not read yet, each an item in `TODO.md`. */
const UNREAD = new Set(['de', 'it']);

/**
 * Words whose own Wiktionary entry gives no definition of the word the row
 * weaves but names the entry it is a form of, keyed by language and title. A
 * line for one of these cites both entries, quoting the second. None of
 * French's is such a page; three of Spanish's are — `sentarse` is "infinitive
 * of sentar combined with se", `juntos` "masculine plural of junto", `quizás`
 * "alternative form of quizá" — and two of Portuguese's: `juntos`, the same,
 * and `desculpa`, which beside a noun, "excuse" and "apology", is the
 * imperative of `desculpar`, "to forgive", the word said for "sorry", as
 * Latin's `ignōsce` is quoted as "forgive".
 */
const FORM_OF: ReadonlyMap<string, string> = new Map([
  ['es\tsentarse', 'sentar'],
  ['es\tjuntos', 'junto'],
  ['es\tquizás', 'quizá'],
  ['pt\tjuntos', 'junto'],
  ['pt\tdesculpa', 'desculpar'],
]);

/**
 * Phrases no entry gives whole, keyed by language and title, with the words
 * whose entries gloss them, in order. English Wiktionary has no entry for
 * Spanish `en ningún lugar`, nor for `en ninguna parte`, `en ningún lado` or
 * `en ningún sitio`: it is "in", "not any" and "place". Its line cites each
 * word's entry and quotes each word's line, joined by " / ", and names no
 * stand-in, since no one word of it means "nowhere"; the phrase's meaning is
 * the words', not a dictionary's. Portuguese has four: `estar de pé`,
 * `muitas vezes`, `em todo lugar` and `em nenhum lugar`. A word the phrase
 * inflects is cited by the entry it is a form of — `muitas` is "feminine
 * plural of muito", `vezes` "plural of vez" — and `de pé`, "up; standing",
 * is one entry of two words.
 */
const COMPOSED: ReadonlyMap<string, readonly string[]> = new Map([
  ['es\ten_ningún_lugar', ['en', 'ningún', 'lugar']],
  ['pt\testar_de_pé', ['estar', 'de_pé']],
  ['pt\tmuitas_vezes', ['muito', 'vez']],
  ['pt\tem_todo_lugar', ['em', 'todo', 'lugar']],
  ['pt\tem_nenhum_lugar', ['em', 'nenhum', 'lugar']],
]);

/**
 * Rows whose gloss no definition gives, each queued in `TODO.md` to be taught
 * differently, with what the entry says the word is. Their lines quote the
 * entry all the same, so the ledger says what is wrong rather than nothing.
 *
 * Empty since 2026-10-08. It named French `tenir debout`, woven for "stand"
 * and "(informal) to hold water, to be valid, to make sense", and Portuguese
 * `tarde`, woven for "evening" and in its entry only "afternoon", each for
 * the night it was found; "stand" is `être debout` now and "evening"
 * `serão`, and both old cards are withdrawn.
 */
const QUEUED: ReadonlyMap<string, string> = new Map([]);

const NAME: Readonly<Record<string, string>> = {
  de: 'German',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  pt: 'Portuguese',
};

type Row = { line: number; lemma: string; pos: string; tgt: string };
type Gloss = Row & { sources: string[]; quote: string; stands: string };

const tsv = (path: string): Array<{ line: number; f: string[] }> =>
  readFileSync(path, 'utf8')
    .split('\n')
    .flatMap((text, i) => (text && !text.startsWith('#') ? [{ line: i + 1, f: text.split('\t') }] : []));

const readRows = (path: string): Row[] =>
  tsv(path).map(({ line, f }) => ({ line, lemma: f[0] ?? '', pos: f[1] ?? '', tgt: f[2] ?? '' }));

const readLedger = (path: string): Gloss[] =>
  tsv(path).map(({ line, f }) => ({
    line,
    lemma: f[0] ?? '',
    pos: f[1] ?? '',
    tgt: f[2] ?? '',
    sources: (f[3] ?? '').split(' ').filter(Boolean),
    quote: f[4] ?? '',
    stands: f[5] ?? '',
  }));

const key = (r: Row): string => `${r.lemma}\t${r.pos}\t${r.tgt}`;

/**
 * The title of a word's English Wiktionary entry as its address writes it:
 * its spelling without a homograph's number, with a straight apostrophe,
 * which is how Wiktionary titles French `aujourd’hui`, and an underscore for
 * a space, so a source stays one word of the space-separated field —
 * `wikt:fr:au_revoir`, as `ang-etymons.tsv` cites
 * `wikt:en:many_a_mickle_makes_a_muckle`.
 */
const title = (tgt: string): string => spelling(tgt).replace(/’/g, "'").replace(/ /g, '_');

/** Whether `text` holds `words` whole, in any case: "man" is not in "woman". */
const holds = (text: string, words: string): boolean =>
  new RegExp(`(?<![A-Za-z])${words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`, 'i').test(text);

const shipped = readdirSync(PACKS).flatMap((f) => /^en-([a-z]+)\.json$/.exec(f)?.slice(1, 2) ?? []);

// Every shipped pack but the two read in their own dictionaries.
const MODERN = shipped.filter((lang) => lang !== 'ang' && lang !== 'la');

describe('the modern gloss ledgers', () => {
  test('every modern pack is read, or waits in UNREAD', () => {
    const offenders = MODERN.flatMap((lang) => {
      const ledger = existsSync(join(SEED, `${lang}-glosses.tsv`));
      if (READ.has(lang) && UNREAD.has(lang)) return [`${lang} is in both READ and UNREAD`];
      if (READ.has(lang)) return ledger ? [] : [`${lang} is READ, and tools/seed/${lang}-glosses.tsv does not exist`];
      if (UNREAD.has(lang)) return ledger ? [`tools/seed/${lang}-glosses.tsv exists, so ${lang} belongs in READ`] : [];
      return [`en-${lang}.json ships, and its glosses are neither read nor listed in UNREAD`];
    });
    const stale = [...READ, ...UNREAD].flatMap((lang) => (MODERN.includes(lang) ? [] : [`${lang} is listed, and no modern pack ships for it`]));
    assert.deepEqual([...offenders, ...stale], []);
    assert.ok(MODERN.length >= 5, `only ${MODERN.length} modern packs were found`);
  });

  test('every alternative form, composed phrase and queued gloss names a language that is read', () => {
    const offenders = [...FORM_OF.keys(), ...COMPOSED.keys(), ...QUEUED.keys()].flatMap((k) => {
      const lang = k.split('\t')[0] ?? '';
      return READ.has(lang) ? [] : [`${k.replace(/\t/g, ' ')}: ${lang} is not in READ`];
    });
    assert.deepEqual(offenders, []);
  });
});

for (const lang of [...READ].filter((l) => MODERN.includes(l))) {
  const name = NAME[lang] ?? lang;
  const lexicon = `lex-${lang}.tsv`;
  const file = `${lang}-glosses.tsv`;
  const rows = readRows(join(SEED, lexicon));
  const ledger = existsSync(join(SEED, file)) ? readLedger(join(SEED, file)) : [];
  const byKey = new Map(ledger.map((g) => [key(g), g]));
  const genders = existsSync(join(SEED, `${lang}-genders.tsv`))
    ? new Map(tsv(join(SEED, `${lang}-genders.tsv`)).map(({ f }) => [`${f[0]}\t${f[1]}`, (f[3] ?? '').split(' ').filter(Boolean)] as const))
    : new Map<string, string[]>();
  const queued = (g: Row): boolean => QUEUED.has(`${lang}\t${key(g)}`);

  describe(`every ${name} gloss names the entry that gives it`, () => {
    test('every row has a line', () => {
      const missing = rows.filter((r) => !byKey.has(key(r)));
      assert.deepEqual(
        missing.map((r) => `${lexicon}:${r.line} ${r.lemma} → ${r.tgt}`),
        [],
        `${missing.length} ${name} glosses name no entry in ${file}`,
      );
    });

    test('every line cites its own word’s Wiktionary entry', () => {
      const offenders = ledger.flatMap((g) => {
        const own = `wikt:${lang}:${title(g.tgt)}`;
        const form = FORM_OF.get(`${lang}\t${title(g.tgt)}`);
        const words = COMPOSED.get(`${lang}\t${title(g.tgt)}`);
        const wanted = words ? words.map((w) => `wikt:${lang}:${w}`) : form ? [own, `wikt:${lang}:${form}`] : [own];
        if (g.sources.length === 0) return [`${file}:${g.line} ${g.tgt}: names no entry`];
        const other = g.sources.filter((s) => !wanted.includes(s));
        if (other.length) return [`${file}:${g.line} ${g.tgt}: ${other.map((s) => `“${s}”`).join(' ')} is not ${wanted.join(' or ')}`];
        const lacking = wanted.filter((s) => !g.sources.includes(s));
        return lacking.length ? [`${file}:${g.line} ${g.tgt} does not cite ${lacking.join(' ')}`] : [];
      });
      assert.deepEqual(offenders, [], `${offenders.length} ledger lines cannot be read:\n  ${offenders.join('\n  ')}`);
    });

    test('every quote holds its English word, or names the word of it that stands for it', () => {
      const offenders = ledger.flatMap((g) => {
        const at = `${file}:${g.line} ${g.lemma} → ${g.tgt}`;
        if (!g.quote) return [`${at}: quotes nothing`];
        if (queued(g)) return [];
        const words = COMPOSED.get(`${lang}\t${title(g.tgt)}`);
        if (words) {
          if (g.stands) return [`${at}: a composed phrase names no stand-in, and “${g.stands}” is named`];
          const parts = g.quote.split(' / ').length;
          return parts === words.length ? [] : [`${at}: quotes ${parts} lines for the ${words.length} words ${words.join(', ')}`];
        }
        if (!g.stands) return holds(g.quote, g.lemma) ? [] : [`${at}: “${g.quote}” does not hold “${g.lemma}”, and no word is named to stand for it`];
        if (holds(g.quote, g.lemma)) return [`${at}: “${g.quote}” holds “${g.lemma}” itself, so “${g.stands}” need not stand for it`];
        return holds(g.quote, g.stands) ? [] : [`${at}: “${g.stands}” is not in “${g.quote}”`];
      });
      assert.deepEqual(offenders, [], `${offenders.length} quotes do not give their gloss:\n  ${offenders.join('\n  ')}`);
    });

    test('a quote is the words a reader sees, not the markup they were drafted from', () => {
      const offenders = ledger.flatMap((g) =>
        /\[\[|\]\]|\{\{|\}\}|''|<[a-z/]|&[a-z]+;|&#/i.test(g.quote) ? [`${file}:${g.line} ${g.tgt}: “${g.quote}”`] : [],
      );
      assert.deepEqual(offenders, [], `${offenders.length} quotes carry markup:\n  ${offenders.join('\n  ')}`);
    });

    test('a noun’s gloss is read in the entry its gender was read in', () => {
      // A Wiktionary title holds every word of one spelling — livre, a book
      // and a pound — so a gloss read in another entry than the gender could
      // be a reading of a different word.
      const offenders = ledger.flatMap((g) => {
        if (g.pos !== 'noun') return [];
        const read = genders.get(`${g.lemma}\t${g.tgt}`);
        if (!read) return [`${file}:${g.line} ${g.lemma} → ${g.tgt}: ${lang}-genders.tsv has no line for it`];
        return g.sources.includes(read[0] ?? '')
          ? []
          : [`${file}:${g.line} ${g.tgt} cites ${g.sources.join(' ')}, where its gender was read in ${read[0]}`];
      });
      assert.deepEqual(offenders, [], `${offenders.length} nouns are glossed from another entry:\n  ${offenders.join('\n  ')}`);
    });

    test('every alternative form, composed phrase and queued gloss is still one a line needs', () => {
      // Both tables excuse a line from a rule, so neither may outlive the line
      // it excuses: a queued gloss that is fixed, or a form whose line cites
      // its own entry's text, would otherwise go on excusing nothing.
      const cited = new Set(ledger.flatMap((g) => g.sources));
      const forms = [...FORM_OF].flatMap(([k, lemma]) => {
        const [l, own] = k.split('\t');
        if (l !== lang) return [];
        return cited.has(`wikt:${lang}:${lemma}`) && cited.has(`wikt:${lang}:${own}`) ? [] : [`FORM_OF ${own} → ${lemma}: no line cites both`];
      });
      const composed = [...COMPOSED.keys()].flatMap((k) => {
        const [l, phrase] = k.split('\t');
        if (l !== lang) return [];
        return ledger.some((g) => title(g.tgt) === phrase) ? [] : [`COMPOSED ${phrase}: no line, or ${lexicon} no longer teaches it`];
      });
      const stale = [...QUEUED.keys()].flatMap((k) => {
        if (!k.startsWith(`${lang}\t`)) return [];
        const g = byKey.get(k.slice(lang.length + 1));
        if (!g) return [`QUEUED ${k.replace(/\t/g, ' ')}: no line, or ${lexicon} no longer teaches it`];
        return holds(g.quote, g.lemma) || (g.stands && holds(g.quote, g.stands))
          ? [`QUEUED ${k.replace(/\t/g, ' ')}: its quote gives its gloss now, so it need not be queued`]
          : [];
      });
      assert.deepEqual([...forms, ...composed, ...stale], []);
    });

    test('no line outlives its row, and no row has two', () => {
      const taught = new Set(rows.map(key));
      const seen = new Set<string>();
      const offenders = ledger.flatMap((g) => {
        const k = key(g);
        if (!taught.has(k)) return [`${file}:${g.line} ${g.lemma} → ${g.tgt}: ${lexicon} no longer teaches it`];
        return seen.has(k) || !seen.add(k) ? [`${file}:${g.line} ${g.lemma} → ${g.tgt}: a second line`] : [];
      });
      assert.deepEqual(offenders, []);
    });

    test('the ledger has something to hold', () => {
      // Floors, not exact counts, so a new row needs no edit here.
      assert.ok(rows.length > 300, `only ${rows.length} rows were read from ${lexicon}`);
      assert.ok(ledger.length > 300, `only ${ledger.length} lines were read from ${file}`);
      const standing = ledger.filter((g) => g.stands);
      assert.ok(standing.length >= 3, `only ${standing.length} lines name a word standing for their gloss`);
      assert.ok(standing.length < ledger.length / 4, `${standing.length} of ${ledger.length} lines need a stand-in`);
    });
  });
}
