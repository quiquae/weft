/**
 * An Old English phrase names the text it was read in.
 *
 * A single word is checked against a dictionary entry wherever the pack makes
 * a claim about it — its etymon, its gender — and a phrase had nothing. A
 * phrase is where this lexicon wrote Old English of its own, and of the four
 * interjections it taught for a speech act, two were not what Old English said:
 * `far wel`, goodbye, which English Wiktionary has only as the reconstruction
 * "*far wel!", and `mē is lāþ`, sorry, which Bosworth–Toller has as loathing
 * — "mé láð wæs" glosses Latin "multum detestatus sum", I greatly detested —
 * and not as regret. Both were withdrawn on 2026-10-05, for `wes hāl` and
 * `mē hrēoweþ`, and neither had been checked against a text by anything.
 *
 * So `tools/seed/ang-phrases.tsv` gives every Old English interjection, and
 * every target of more than one word, the Bosworth–Toller entry it was read
 * in and the text quoted there, and these tests hold the two files together:
 * a phrase with no line fails, as does a line naming no entry, a quotation
 * missing a word of its phrase, or a line outliving its row. Requiring the
 * quotation is the design. It cannot tell a text somebody read from one
 * somebody typed, which is the limit every ledger here has; but a phrase no
 * text has cannot be given one honestly.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spelling } from '../../src/core/lexicon.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const LEXICON = join(ROOT, 'tools/seed/lex-ang.tsv');
const LEDGER = join(ROOT, 'tools/seed/ang-phrases.tsv');

type Row = { line: number; lemma: string; pos: string; tgt: string };
type Entry = Row & { sources: string[]; quotation: string };

const tsv = (path: string): Array<{ line: number; f: string[] }> =>
  readFileSync(path, 'utf8')
    .split('\n')
    .flatMap((text, i) => (text && !text.startsWith('#') ? [{ line: i + 1, f: text.split('\t') }] : []));

/** A speech act, or a target the lexicon put together from more than one word. */
const isPhrase = (pos: string, tgt: string): boolean => pos === 'intj' || /\s/.test(spelling(tgt).trim());

const rows: Row[] = tsv(LEXICON)
  .map(({ line, f }) => ({ line, lemma: f[0] ?? '', pos: f[1] ?? '', tgt: f[2] ?? '' }))
  .filter((r) => r.tgt && isPhrase(r.pos, r.tgt));

const ledger: Entry[] = tsv(LEDGER).map(({ line, f }) => ({
  line,
  lemma: f[0] ?? '',
  pos: f[1] ?? '',
  tgt: f[2] ?? '',
  sources: (f[3] ?? '').split(' ').filter(Boolean),
  quotation: f[4] ?? '',
}));

const key = (r: Pick<Row, 'lemma' | 'pos' | 'tgt'>): string => `${r.lemma}\t${r.pos}\t${r.tgt}`;
const byKey = new Map(ledger.map((e) => [key(e), e]));

/**
 * A spelling as it can be compared with Bosworth–Toller's: lower case, with
 * its accents, macrons and the dots of ċ and ġ taken off, and ð read as þ,
 * the two letters being one sound that scribes wrote either way.
 */
const fold = (s: string): string =>
  s.toLowerCase().replace(/ð/g, 'þ').normalize('NFD').replace(/\p{Mn}/gu, '').normalize('NFC');

const words = (s: string): string[] => fold(s).split(/[^\p{L}]+/u).filter(Boolean);

/** The words of a phrase its quotation lacks, as a word or the start of one. */
const missing = (e: Entry): string[] => {
  const quoted = words(e.quotation);
  return words(spelling(e.tgt)).filter((w) => !quoted.some((q) => q.startsWith(w)));
};

describe('every Old English phrase names the text it was read in', () => {
  test('every interjection, and every target of more than one word, has a line', () => {
    const offenders = rows
      .filter((r) => !byKey.has(key(r)))
      .map((r) => `lex-ang.tsv:${r.line} ${r.lemma} (${r.pos}) → ${r.tgt}: no line in ang-phrases.tsv`);
    assert.deepEqual(
      offenders,
      [],
      `${offenders.length} Old English phrases were read in no text:\n  ${offenders.join('\n  ')}`,
    );
  });

  test('every line names a Bosworth–Toller entry, and nothing it cannot read', () => {
    const offenders = ledger.flatMap((e) => {
      const at = `ang-phrases.tsv:${e.line} ${e.tgt}`;
      const unread = e.sources.filter((s) => !/^bt:\d+$/.test(s) && !/^wikt:ang:\S+$/.test(s));
      if (unread.length > 0) return [`${at}: “${unread.join(' ')}” is neither bt:<id> nor wikt:ang:<title>`];
      return e.sources.some((s) => s.startsWith('bt:')) ? [] : [`${at}: names no Bosworth–Toller entry`];
    });
    assert.deepEqual(offenders, [], `${offenders.length} ledger lines cannot be read:\n  ${offenders.join('\n  ')}`);
  });

  test('every quotation holds each word of its phrase', () => {
    const offenders = ledger.flatMap((e) => {
      const lacking = missing(e);
      return lacking.length === 0
        ? []
        : [`ang-phrases.tsv:${e.line} ${e.tgt}: “${e.quotation}” has no ${lacking.join(', ')}`];
    });
    assert.deepEqual(
      offenders,
      [],
      `${offenders.length} quotations are not of their phrase:\n  ${offenders.join('\n  ')}`,
    );
  });

  test('no line outlives its row, and no row has two', () => {
    const taught = new Set(rows.map(key));
    const stale = ledger.filter((e) => !taught.has(key(e)));
    const seen = new Set<string>();
    const twice = ledger.filter((e) => seen.has(key(e)) || !seen.add(key(e)));
    assert.deepEqual(
      stale.map((e) => `ang-phrases.tsv:${e.line} ${e.lemma} (${e.pos}) → ${e.tgt}`),
      [],
      'lines here for a phrase lex-ang.tsv no longer teaches',
    );
    assert.deepEqual(
      twice.map((e) => `ang-phrases.tsv:${e.line} ${e.lemma} (${e.pos}) → ${e.tgt}`),
      [],
      'a phrase with two lines',
    );
  });

  test('the ledger has something to hold, and the match can fail', () => {
    // Floors, not exact counts, so a new phrase needs no edit here.
    assert.ok(rows.length >= 5, `only ${rows.length} Old English phrases were read from lex-ang.tsv`);
    assert.ok(
      rows.some((r) => /\s/.test(r.tgt)),
      'no target of more than one word was found, so the second half of the rule tests nothing',
    );
    // The withdrawn phrase against the text Bosworth–Toller does quote for
    // it: "is" is not there, which is the shape of a phrase nobody read.
    const loath: Entry = {
      line: 0,
      lemma: 'sorry',
      pos: 'intj',
      tgt: 'mē is lāþ',
      sources: ['bt:21202'],
      quotation: 'Ðá wæs ic swíðe onscúniende and mé láð wæs (Bd. 5, 12)',
    };
    assert.deepEqual(missing(loath), ['is']);
  });
});
