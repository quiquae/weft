/**
 * An Old English note names the dictionary entries it was checked against, or
 * it does not ship.
 *
 * A note is the sentence under the woven word: "“sellan” meant to give",
 * "literally “it rues me”". It is printed in the tooltip, on
 * `/old-english/<word>` — joined to the descent sentence, or under "Worth
 * knowing" where the word has no descendant — in the note column of the
 * descent hub, and, where its wording says "meant", "simply" or "literally",
 * as the word's line in the discoveries feed. Every other claim the Old
 * English pack makes about a word names its entry: the gloss in
 * `tools/seed/ang-glosses.tsv`, the etymon in `ang-etymons.tsv`, a noun's
 * gender in `ang-genders.tsv`, a phrase's text in `ang-phrases.tsv`. Until
 * 2026-10-25 the notes named none. The Latin ones have named theirs since
 * 2026-10-02 (`tests/tools/la-notes.test.ts`); Old English waited, the reason
 * given being that a gloss of Old English meaning wants Bosworth–Toller,
 * which nothing here cited. Four ledgers cite it now.
 *
 * So the lookup is recorded, in `tools/seed/ang-notes.tsv`, one line per
 * note, and these tests hold the two files together as `la-notes.test.ts`
 * holds the Latin ones. The line repeats the note, so editing a note leaves it
 * without a source until somebody reads the entries again and says which.
 * What a line must cite is derived from the row rather than listed:
 *
 *  - **An entry the row's gloss was read in**, from `ang-glosses.tsv`. A
 *    Wiktionary page holds every word of one spelling, and Bosworth–Toller
 *    heads two entries with one, so a note checked anywhere else could be a
 *    reading of a different word: `hund` is a dog and `hund²` a hundred.
 *  - **An entry for the English word, when the note names the row's
 *    etymon**: etymonline's, or English Wiktionary's, the two the etymon
 *    ledger takes. "“numb” was its past participle" is a claim about *numb*.
 *
 * It cannot tell an entry somebody read from one somebody typed, which is the
 * limit every ledger here has. Cite the ones actually opened.
 *
 * The ledger holds the parts of speech in `HELD`, each added as its notes
 * were read; a part of speech not in it is not yet checked.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const LEXICON = join(ROOT, 'tools/seed/lex-ang.tsv');
const LEDGER = join(ROOT, 'tools/seed/ang-notes.tsv');
const GLOSSES = join(ROOT, 'tools/seed/ang-glosses.tsv');

/** The parts of speech whose every note the ledger holds. */
const HELD = new Set(['verb', 'adj', 'adv', 'num', 'intj']);

/**
 * The entries a source can name.
 *
 *   bt:<id>            Bosworth–Toller, https://bosworthtoller.com/<id>
 *   wikt:ang:<title>   https://en.wiktionary.org/wiki/<title>#Old_English
 *   wikt:en:<title>    https://en.wiktionary.org/wiki/<title>#English, a
 *                      space written as an underscore
 *   etym:<english>     https://www.etymonline.com/word/<english>
 */
const SOURCE = /^(?:bt:\d+|wikt:(?:ang|en):[^\s:]+|etym:[^\s:]+)$/u;

type Row = { line: number; lemma: string; pos: string; tgt: string; etymon: string; note: string };
type Recorded = { line: number; lemma: string; pos: string; tgt: string; note: string; sources: string[] };

const key = (r: Pick<Row, 'lemma' | 'pos' | 'tgt'>): string => `${r.lemma}\t${r.pos}\t${r.tgt}`;

function lines(file: string): Array<{ line: number; fields: string[] }> {
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((text, i) => ({ line: i + 1, text: text.replace(/\r$/, '') }))
    .filter(({ text }) => text.trim() && !text.startsWith('#'))
    .map(({ line, text }) => ({ line, fields: text.split('\t').map((f) => f.trim()) }));
}

/** Every row of the lexicon that carries a note. */
function notes(): Row[] {
  return lines(LEXICON)
    .map(({ line, fields: [lemma = '', pos = '', tgt = '', , , , etymon = '', note = ''] }) => ({
      line,
      lemma,
      pos,
      tgt,
      etymon,
      note,
    }))
    .filter((r) => r.note);
}

function recorded(): Recorded[] {
  return lines(LEDGER).map(({ line, fields: [lemma = '', pos = '', tgt = '', note = '', cited = ''] }) => ({
    line,
    lemma,
    pos,
    tgt,
    note,
    sources: cited ? cited.split(/\s+/) : [],
  }));
}

/** The entries each row's gloss was read in, by the same key. */
const glossedIn = new Map(
  lines(GLOSSES).map(({ fields: [lemma = '', pos = '', tgt = '', cited = ''] }) => [
    `${lemma}\t${pos}\t${tgt}`,
    cited.split(/\s+/).filter(Boolean),
  ]),
);

/** Whether `note` names `word` whole, in any case: "tell" is not in "teller". */
const names = (note: string, word: string): boolean =>
  new RegExp(String.raw`(^|[^\p{L}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\p{L}])`, 'iu').test(note);

/** The entries that are the English word's own: etymonline's and Wiktionary's. */
const englishEntries = (word: string): string[] => [
  `etym:${word.toLowerCase().replace(/\s+/g, '-')}`,
  `wikt:en:${word.replace(/\s+/g, '_')}`,
];

describe('an Old English note names the entries it was checked against', () => {
  test('every note of a part of speech the ledger holds has a line for exactly that note', () => {
    const byKey = new Map(recorded().map((r) => [key(r), r]));
    const offenders = notes()
      .filter((n) => HELD.has(n.pos))
      .flatMap((n) => {
        const r = byKey.get(key(n));
        if (!r) return [`lex-ang.tsv:${n.line} ${n.lemma} → ${n.tgt}: no source is recorded for its note — ${n.note}`];
        if (r.note !== n.note) {
          return [
            `lex-ang.tsv:${n.line} ${n.lemma} → ${n.tgt}: the note has changed since ang-notes.tsv:${r.line} was checked — it says “${n.note}”, the ledger vouches for “${r.note}”`,
          ];
        }
        return [];
      });

    assert.deepEqual(
      offenders,
      [],
      `${offenders.length} Old English notes name no entry they were checked against:\n  ${offenders.join('\n  ')}`,
    );
  });

  test('a line cites an entry its row’s gloss was read in', () => {
    const offenders = recorded().flatMap((r) => {
      const read = glossedIn.get(key(r));
      if (!read) return [`ang-notes.tsv:${r.line} ${r.lemma} → ${r.tgt}: ang-glosses.tsv has no line for it`];
      return r.sources.some((s) => read.includes(s))
        ? []
        : [`ang-notes.tsv:${r.line} ${r.tgt} cites ${r.sources.join(' ') || 'nothing'}, where its gloss was read in ${read.join(' ')}`];
    });

    assert.deepEqual(
      offenders,
      [],
      `${offenders.length} notes were checked in another entry than their gloss:\n  ${offenders.join('\n  ')}`,
    );
  });

  test('a note that names its English descendant cites that word’s own entry', () => {
    const etymonOf = new Map(notes().map((n) => [key(n), n.etymon]));
    const offenders = recorded().flatMap((r) => {
      const etymon = etymonOf.get(key(r));
      if (!etymon || !names(r.note, etymon)) return [];
      const wanted = englishEntries(etymon);
      return r.sources.some((s) => wanted.includes(s))
        ? []
        : [`ang-notes.tsv:${r.line} ${r.tgt}: the note names “${etymon}” and cites ${r.sources.join(' ')}; it needs ${wanted.join(' or ')}`];
    });

    assert.deepEqual(
      offenders,
      [],
      `${offenders.length} notes explain an English word without citing its entry:\n  ${offenders.join('\n  ')}`,
    );
  });

  test('every source names an entry in a form someone can open', () => {
    const offenders = recorded().flatMap((r) =>
      r.sources.length === 0
        ? [`ang-notes.tsv:${r.line} ${r.tgt}: names no entry`]
        : r.sources
            .filter((s) => !SOURCE.test(s))
            .map((s) => `ang-notes.tsv:${r.line} “${s}” is not bt:<id>, wikt:ang|en:<title> or etym:<english>`),
    );

    assert.deepEqual(offenders, [], `${offenders.length} sources cannot be read:\n  ${offenders.join('\n  ')}`);
  });

  test('no line vouches for a note the lexicon no longer carries, and no note has two', () => {
    // The converse, so that deleting a note cannot leave a line here vouching
    // for a sentence nobody ships. A reworded note fails the first test; this
    // one catches the row that went away altogether.
    const live = new Set(notes().map(key));
    const stale = recorded()
      .filter((r) => !live.has(key(r)))
      .map((r) => `ang-notes.tsv:${r.line} ${r.lemma} → ${r.tgt} matches no note in lex-ang.tsv`);
    const twice = recorded()
      .map(key)
      .filter((k, i, all) => all.indexOf(k) !== i)
      .map((k) => `recorded twice: ${k.replace(/\t/g, ' ')}`);

    assert.deepEqual([...stale, ...twice], []);
  });

  test('the rule has something to police', () => {
    // Floors rather than counts, so that adding a note does not have to be
    // registered here as well as sourced.
    const all = notes();
    assert.ok(all.length > 70, `only ${all.length} Old English rows carry a note`);
    const held = all.filter((n) => HELD.has(n.pos));
    assert.ok(held.length >= 30, `only ${held.length} notes are of a part of speech the ledger holds`);
    const explained = held.filter((n) => n.etymon && names(n.note, n.etymon)).length;
    assert.ok(explained >= 5, `only ${explained} held notes name their English descendant, so that rule polices almost nothing`);
  });
});
