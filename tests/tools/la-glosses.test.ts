/**
 * A Latin gloss names the dictionary entry that gives it.
 *
 * The gloss is the first claim a reader meets: the English word a Latin word
 * is woven for, printed back in the tooltip and on its word page. Every other
 * claim the Latin pack makes about a word already names its entry — the note
 * in `tools/seed/la-notes.tsv`, the etymon in `la-etymons.tsv`, a noun's
 * gender in `la-genders.tsv` — and until 2026-10-06 the gloss named none. The
 * one check on it was a crude pass on 2026-10-02 asking whether the English
 * word occurs anywhere in the headword's Lewis & Short entry, which is how
 * `camera`, taught for "room" and in Lewis & Short only a vault, was found.
 *
 * So `tools/seed/la-glosses.tsv` quotes, for every row of `lex-la.tsv`, the
 * words of Lewis & Short that give its gloss, and these tests hold the two
 * files together. A quote holds its row's English word, or the line names
 * the word of the quote that stands for it: `cānus` is "gray" in an American
 * dictionary, and a check for "grey" misses it; `medicus` is "a medical man,
 * physician", and "doctor" is not in the entry at all. Naming the stand-in
 * is the point — a line cannot pass for one that holds the word, and a
 * reader of the ledger sees each gloss the dictionary only approaches. The
 * quote cannot be checked against the dictionary here, which is 77 MB and
 * not in the repository; every quote was copied from the entry's text and
 * checked verbatim when it was written, and the entries cited should be the
 * ones actually opened.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const LEXICON = join(ROOT, 'tools/seed/lex-la.tsv');
const LEDGER = join(ROOT, 'tools/seed/la-glosses.tsv');
const GENDERS = join(ROOT, 'tools/seed/la-genders.tsv');

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

const key = (r: Row): string => `${r.lemma}\t${r.pos}\t${r.tgt}`;
const byKey = new Map(ledger.map((g) => [key(g), g]));

/** Whether `text` holds `words` whole, in any case: "man" is not in "woman". */
const holds = (text: string, words: string): boolean =>
  new RegExp(`(?<![A-Za-z])${words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`, 'i').test(text);

describe('every Latin gloss names the entry that gives it', () => {
  test('every row of the Latin pack has a line', () => {
    const missing = rows.filter((r) => !byKey.has(key(r)));
    assert.deepEqual(
      missing.map((r) => `lex-la.tsv:${r.line} ${r.lemma} → ${r.tgt}`),
      [],
      `${missing.length} Latin glosses name no entry in la-glosses.tsv`,
    );
  });

  test('every line cites Lewis & Short by an entry’s key', () => {
    const offenders = ledger.flatMap((g) => {
      if (g.sources.length === 0) return [`la-glosses.tsv:${g.line} ${g.tgt}: names no entry`];
      const unreadable = g.sources.filter((s) => !/^ls:[a-z]+\d?$/.test(s));
      return unreadable.length
        ? [`la-glosses.tsv:${g.line} ${g.tgt}: ${unreadable.map((s) => `“${s}”`).join(' ')} is not ls:<key>`]
        : [];
    });
    assert.deepEqual(offenders, [], `${offenders.length} ledger lines cannot be read:\n  ${offenders.join('\n  ')}`);
  });

  test('every quote holds its English word, or names the word of it that stands for it', () => {
    const offenders = ledger.flatMap((g) => {
      const at = `la-glosses.tsv:${g.line} ${g.lemma} → ${g.tgt}`;
      if (!g.quote) return [`${at}: quotes nothing`];
      if (!g.stands) return holds(g.quote, g.lemma) ? [] : [`${at}: “${g.quote}” does not hold “${g.lemma}”, and no word is named to stand for it`];
      if (holds(g.quote, g.lemma)) return [`${at}: “${g.quote}” holds “${g.lemma}” itself, so “${g.stands}” need not stand for it`];
      return holds(g.quote, g.stands) ? [] : [`${at}: “${g.stands}” is not in “${g.quote}”`];
    });
    assert.deepEqual(offenders, [], `${offenders.length} quotes do not give their gloss:\n  ${offenders.join('\n  ')}`);
  });

  test('a noun’s gloss is read in the entry its gender was read in', () => {
    // la-genders.tsv chose among Lewis & Short's homographs by eye — canis1
    // the dog, os2 the bone, liber4 the book — so a gloss citing another
    // would be a reading of a different word.
    const offenders = ledger.flatMap((g) => {
      if (g.pos !== 'noun') return [];
      const read = genders.get(`${g.lemma}\t${g.tgt}`);
      if (!read) return [`la-glosses.tsv:${g.line} ${g.lemma} → ${g.tgt}: la-genders.tsv has no line for it`];
      return g.sources.includes(read[0] ?? '')
        ? []
        : [`la-glosses.tsv:${g.line} ${g.tgt} cites ${g.sources.join(' ')}, where its gender was read in ${read[0]}`];
    });
    assert.deepEqual(offenders, [], `${offenders.length} nouns are glossed from another entry:\n  ${offenders.join('\n  ')}`);
  });

  test('no line outlives its row, and no row has two', () => {
    const taught = new Set(rows.map(key));
    const seen = new Set<string>();
    const offenders = ledger.flatMap((g) => {
      const k = key(g);
      if (!taught.has(k)) return [`la-glosses.tsv:${g.line} ${g.lemma} → ${g.tgt}: lex-la.tsv no longer teaches it`];
      return seen.has(k) || !seen.add(k) ? [`la-glosses.tsv:${g.line} ${g.lemma} → ${g.tgt}: a second line`] : [];
    });
    assert.deepEqual(offenders, []);
  });

  test('the ledger has something to hold', () => {
    // Floors, not exact counts, so a new row needs no edit here.
    assert.ok(rows.length > 300, `only ${rows.length} rows were read from lex-la.tsv`);
    const standing = ledger.filter((g) => g.stands);
    assert.ok(standing.length >= 10, `only ${standing.length} lines name a word standing for their gloss`);
    assert.ok(standing.length < ledger.length / 4, `${standing.length} of ${ledger.length} lines need a stand-in`);
  });
});
