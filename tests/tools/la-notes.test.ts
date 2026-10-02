/**
 * A Latin note names the dictionary entries it was checked against, or it does
 * not ship.
 *
 * A note is the sentence under the woven word: "originally an actor’s mask",
 * "a mile was mīlle passūs, a thousand paces". It is printed in the tooltip,
 * joined to the descent sentence on `/latin/<word>`, set in the note column of
 * the descent hub, and — where its wording says "means" or "literally" — it
 * is the discoveries feed's sentence. Nothing recorded that any of the 28 had
 * been looked up, and the first row of the pack said so by itself: man →
 * `vir`, "third-person plural “virī” also means “men” collectively". A noun
 * has no person.
 *
 * On 2026-10-02 all 28 were read: Lewis & Short for every Latin word a note
 * uses, Allen & Greenough for the two that state a rule of grammar, and
 * etymonline for every English word a note explains. 23 stood. Five did not:
 *
 *   vir     a noun's plural called "third-person"
 *   clāvis  the collarbone "named for its key-like shape", where etymonline
 *           has it "so called supposedly from its function" — and the bone
 *           is medieval Latin's *clāvicula*, not classical
 *   vacca   "Jenner named the vaccine", where etymonline credits him with
 *           *vaccination* and dates the noun to 1846, from French
 *   ita     "no bare word for yes", where the grammar says no one word "in
 *           common use" and Lewis & Short glosses *ita* as yes in replies
 *   umbra   "a little shade", which is *umbella* — read without the etymon
 *           badge above it, a gloss of the wrong word
 *
 * The last two, and the word "medieval" in the second, came from a second
 * reader given the same extracts and told to prove the first one wrong — the
 * first reader's own rewrite of `clāvis` among what it overturned.
 *
 * So the lookup is recorded, in `tools/seed/la-notes.tsv`, one line per note,
 * and these tests hold the two files together the way
 * `tests/tools/ang-etymons.test.ts` holds Old English etymons to theirs. The
 * line repeats the note, so editing a note leaves it without a source until
 * somebody reads the dictionary again and says which entry. What a line must
 * cite is derived from the row rather than listed:
 *
 *  - **Lewis & Short's entry for its own headword, always.** It is the
 *    dictionary the pack's attribution names, and a note is a claim about that
 *    word before it is about anything else.
 *  - **etymonline's entry for the English word, when the note names the row's
 *    etymon.** "“muscle” is a little mouse" is a claim about *muscle*, and the
 *    French pass is why that matters: twenty-nine of its claims were false and
 *    every one was about a word nobody had looked up.
 *
 * It cannot tell an entry somebody read from one somebody typed, which is the
 * limit every ledger here has. Cite the ones actually opened.
 *
 * Old English notes are still not held to a source: a gloss of Old English
 * meaning wants Bosworth–Toller, which nothing here cites. The Latin etymon
 * column is not covered either — that is a ledger of its own, and `TODO.md`
 * has the item.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const LEXICON = join(ROOT, 'tools/seed/lex-la.tsv');
const LEDGER = join(ROOT, 'tools/seed/la-notes.tsv');

/**
 * The entries a source can name.
 *
 *   ls:<key>           Lewis & Short, by the entry's `key` in the Perseus text:
 *                      perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0059:entry=<key>
 *   ag:<section>       Allen & Greenough's New Latin Grammar, by section:
 *                      perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0001:smythp=<section>
 *   etym:<english>     https://www.etymonline.com/word/<english>
 *   wikt:la:<latin>    https://en.wiktionary.org/wiki/<latin>#Latin
 *   wikt:en:<english>  https://en.wiktionary.org/wiki/<english>#English
 */
const SOURCE = /^(?:ls:[A-Za-z]+\d?|ag:\d+|etym:[^\s:]+|wikt:(?:la|en):[^\s:]+)$/u;

type Row = { line: number; lemma: string; pos: string; tgt: string; etymon: string; note: string };
type Recorded = Omit<Row, 'etymon'> & { sources: string[] };

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

/**
 * Lewis & Short's key for a headword: no macrons, and `j` where the pack
 * writes a consonantal `i` — `iānua` is filed under `janua`. Homographs take a
 * digit (`os1` mouth, `os2` bone), so the citation may carry one.
 */
const lewisAndShort = (tgt: string): string =>
  tgt
    .normalize('NFD')
    .replace(/̄/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/^i(?=[aeiou])/, 'j');

const citesOwnEntry = (r: Recorded): boolean =>
  r.sources.some((s) => new RegExp(`^ls:${lewisAndShort(r.tgt)}\\d?$`, 'i').test(s));

/** etymonline's URL for an English word, as `tools/cousins.ts` builds it. */
const slug = (word: string): string => word.toLowerCase().replace(/\s+/g, '-');

const names = (note: string, word: string): boolean =>
  new RegExp(String.raw`(^|[^\p{L}])${word}(?![\p{L}])`, 'iu').test(note);

describe('a Latin note names the entries it was checked against', () => {
  test('every note in the lexicon has a source recorded for exactly that note', () => {
    const byKey = new Map(recorded().map((r) => [key(r), r]));
    const offenders = notes().flatMap((n) => {
      const r = byKey.get(key(n));
      if (!r) return [`lex-la.tsv:${n.line} ${n.lemma} → ${n.tgt}: no source is recorded for its note — ${n.note}`];
      if (r.note !== n.note) {
        return [
          `lex-la.tsv:${n.line} ${n.lemma} → ${n.tgt}: the note has changed since la-notes.tsv:${r.line} was checked — it says “${n.note}”, the ledger vouches for “${r.note}”`,
        ];
      }
      return [];
    });

    assert.deepEqual(
      offenders,
      [],
      `${offenders.length} Latin notes name no entry they were checked against:\n  ${offenders.join('\n  ')}`,
    );
  });

  test('a recorded source cites Lewis & Short for the note’s own headword', () => {
    const offenders = recorded()
      .filter((r) => !citesOwnEntry(r))
      .map(
        (r) =>
          `la-notes.tsv:${r.line} ${r.tgt} cites ${r.sources.join(' ') || 'nothing'}; it needs ls:${lewisAndShort(r.tgt)}, Lewis & Short's entry for ${r.tgt}`,
      );

    assert.deepEqual(
      offenders,
      [],
      `${offenders.length} recorded sources miss the headword's own entry:\n  ${offenders.join('\n  ')}`,
    );
  });

  test('a note that names its English descendant cites that word’s entry', () => {
    // The French guard's derivation. A sentence about *muscle* is settled by
    // the entry for *muscle*, and citing only the Latin word's page is what
    // let a translation pass for an ancestor twenty-nine times.
    const etymonOf = new Map(notes().map((n) => [key(n), n.etymon]));
    const offenders = recorded().flatMap((r) => {
      const etymon = etymonOf.get(key(r));
      if (!etymon || !names(r.note, etymon)) return [];
      const needed = `etym:${slug(etymon)}`;
      return r.sources.some((s) => s.toLowerCase() === needed)
        ? []
        : [`la-notes.tsv:${r.line} ${r.tgt}: the note names “${etymon}” and cites ${r.sources.join(' ')}; it needs ${needed}`];
    });

    assert.deepEqual(
      offenders,
      [],
      `${offenders.length} notes explain an English word without citing its entry:\n  ${offenders.join('\n  ')}`,
    );
  });

  test('every source names an entry in a form someone can open', () => {
    const offenders = recorded().flatMap((r) =>
      r.sources
        .filter((s) => !SOURCE.test(s))
        .map((s) => `la-notes.tsv:${r.line} “${s}” is not ls:<key>, ag:<section>, etym:<english> or wikt:la|en:<word>`),
    );

    assert.deepEqual(offenders, [], `${offenders.length} sources cannot be read:\n  ${offenders.join('\n  ')}`);
  });

  test('no source is recorded for a note the lexicon no longer carries', () => {
    // The converse, so that deleting or rewording a note cannot leave a line
    // here vouching for a sentence nobody ships. A reworded note fails the
    // first test; this one catches the row that went away altogether.
    const live = new Set(notes().map(key));
    const stale = recorded()
      .filter((r) => !live.has(key(r)))
      .map((r) => `la-notes.tsv:${r.line} ${r.lemma} → ${r.tgt} matches no note in lex-la.tsv`);
    const twice = recorded()
      .map(key)
      .filter((k, i, all) => all.indexOf(k) !== i);

    assert.deepEqual([...stale, ...twice.map((k) => `recorded twice: ${k.replace(/\t/g, ' ')}`)], []);
  });

  test('the rule has something to police', () => {
    // 28 notes on 2026-10-02. A floor rather than the count, so that adding
    // one does not have to be registered here as well as sourced.
    const n = notes().length;
    assert.ok(n >= 20, `only ${n} Latin rows carry a note, so this guard is close to vacuous`);
    const explained = notes().filter((r) => r.etymon && names(r.note, r.etymon)).length;
    assert.ok(explained >= 5, `only ${explained} notes name their English descendant, so the etymonline rule polices almost nothing`);
  });
});
