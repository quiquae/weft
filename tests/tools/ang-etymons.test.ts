/**
 * An Old English etymon names the dictionary entry it was checked against, or
 * it does not ship.
 *
 * The etymon column of `tools/seed/lex-ang.tsv` makes the strongest claim the
 * product prints: the word page says "This is the Old English word that became
 * X", its meta description "the direct ancestor of English X", and the
 * discoveries feed "English X comes straight from Y". On 2026-10-01 every one
 * of the 330 was read against etymonline, and 27 were not true as the product
 * states them; 21 were removed and 6 replaced by the word's real descendant.
 * Sixteen are the shape the French pass found the day before: the English word
 * was paired with its Old English *translation*, and the translation called
 * its ancestor. *window* is Old Norse *vindauga*, which replaced `ēagþȳrel`;
 * *egg*, *gift*, *weak* and *wassail* are Norse too; *lion* and *ire* came
 * from French; *sad* is `sæd`, not `unrōt`. The other eleven named a compound
 * or a derivative as though it were the word itself — *gospel* for `spell`,
 * *bishopric* for `rīċe`, *hundred* for `hund` — which "comes straight from"
 * cannot survive. Nothing in the repository could have said so, because
 * nothing recorded that any of them had been looked up.
 *
 * So the lookup is recorded now, in `tools/seed/ang-etymons.tsv`, one line per
 * claim, and these tests hold the two files together. The rule is the French
 * one (`tools/cousins.ts`, `sourcesNeeded`), derived from the claim rather than
 * listed: a descent is a claim about the *English* word, so it must cite that
 * word's own entry — etymonline, or English Wiktionary where etymonline has
 * none. It cannot tell a reference somebody read from one somebody typed; the
 * entries cited should be the ones actually opened.
 *
 * Notes are not covered. The pass rewrote every note a fetched entry
 * contradicted or hedged, and read the rest against their etymon's entry
 * only; a note's gloss of the Old English meaning wants Bosworth–Toller, which
 * nothing here cites.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const LEXICON = join(ROOT, 'tools/seed/lex-ang.tsv');
const LEDGER = join(ROOT, 'tools/seed/ang-etymons.tsv');

/**
 * The entries a source can name. The French grammar, with Old English's own
 * Wiktionary section in place of French's.
 *
 *   etym:<english>      https://www.etymonline.com/word/<english>
 *   wikt:en:<english>   https://en.wiktionary.org/wiki/<english>#English
 *   wikt:ang:<old>      https://en.wiktionary.org/wiki/<old>#Old_English
 */
const SOURCE = /^(?:etym|wikt:(?:en|ang)):[^\s:]+$/u;

/**
 * Two etymons whose etymonline entry is filed under another spelling.
 * etymonline heads its entries with the American form and its page for the
 * British one carries no entry at all — measured: `/word/neighbour` holds 911
 * characters of navigation and `/word/grey` only the entries that mention the
 * colour. The pack writes British English throughout, so the etymon keeps its
 * spelling and the citation names the page that was read.
 */
const SPELLED: Record<string, string> = { neighbour: 'neighbor', grey: 'gray' };

/** etymonline's URL for an English word, as `tools/cousins.ts` builds it. */
const slug = (word: string): string => word.toLowerCase().replace(/\s+/g, '-');

type Row = { line: number; lemma: string; pos: string; tgt: string; etymon: string };
type Recorded = Row & { sources: string[] };

const key = (r: Pick<Row, 'lemma' | 'pos' | 'tgt'>): string => `${r.lemma}\t${r.pos}\t${r.tgt}`;

function lines(file: string): Array<{ line: number; fields: string[] }> {
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((text, i) => ({ line: i + 1, text: text.replace(/\r$/, '') }))
    .filter(({ text }) => text.trim() && !text.startsWith('#'))
    .map(({ line, text }) => ({ line, fields: text.split('\t').map((f) => f.trim()) }));
}

/** Every row of the lexicon that claims a descendant. */
function claims(): Row[] {
  return lines(LEXICON)
    .map(({ line, fields: [lemma = '', pos = '', tgt = '', , , , etymon = ''] }) => ({ line, lemma, pos, tgt, etymon }))
    .filter((r) => r.etymon);
}

function recorded(): Recorded[] {
  return lines(LEDGER).map(({ line, fields: [lemma = '', pos = '', tgt = '', etymon = '', cited = ''] }) => ({
    line,
    lemma,
    pos,
    tgt,
    etymon,
    sources: cited ? cited.split(/\s+/) : [],
  }));
}

/** What a claim must cite: the English word's own entry, in either dictionary. */
const accepted = (etymon: string): string[] => {
  const entry = SPELLED[etymon] ?? etymon;
  return [`etym:${slug(entry)}`, `wikt:en:${entry}`];
};

describe('an Old English etymon names the entry it was checked against', () => {
  test('every claim in the lexicon has a source recorded for exactly that claim', () => {
    const byKey = new Map(recorded().map((r) => [key(r), r]));
    const offenders = claims().flatMap((c) => {
      const r = byKey.get(key(c));
      if (!r) return [`lex-ang.tsv:${c.line} ${c.lemma} → ${c.tgt} claims “${c.etymon}”, and no source is recorded for it`];
      if (r.etymon !== c.etymon) {
        return [
          `lex-ang.tsv:${c.line} ${c.lemma} → ${c.tgt} claims “${c.etymon}”, but ang-etymons.tsv:${r.line} records a source for “${r.etymon}”`,
        ];
      }
      return [];
    });

    assert.deepEqual(offenders, [], `${offenders.length} etymons name no entry they were checked against:\n  ${offenders.join('\n  ')}`);
  });

  test('a recorded source cites the English word’s own entry', () => {
    // The French guard's derivation: the claim is about the English word, so
    // that is the entry that can settle it. Citing the Old English word's page
    // alone is what let the translation pass for the ancestor.
    const offenders = recorded()
      .filter((r) => !accepted(r.etymon).some((s) => r.sources.includes(s)))
      .map((r) => `ang-etymons.tsv:${r.line} ${r.tgt} → “${r.etymon}” cites ${r.sources.join(' ') || 'nothing'}; it needs ${accepted(r.etymon).join(' or ')}`);

    assert.deepEqual(offenders, [], `${offenders.length} recorded sources miss the English word's entry:\n  ${offenders.join('\n  ')}`);
  });

  test('every source names an entry in a form someone can open', () => {
    const offenders = recorded().flatMap((r) =>
      r.sources.filter((s) => !SOURCE.test(s)).map((s) => `ang-etymons.tsv:${r.line} “${s}” is not etym:<english>, wikt:en:<english> or wikt:ang:<old>`),
    );

    assert.deepEqual(offenders, [], `${offenders.length} sources cannot be read:\n  ${offenders.join('\n  ')}`);
  });

  test('no source is recorded for a claim the lexicon no longer makes', () => {
    // The converse, so that removing a false etymon from the lexicon cannot
    // leave a line here vouching for it. The claims taken out on 2026-10-01
    // are kept as comments at the foot of the ledger, with the reason.
    const live = new Set(claims().map(key));
    const stale = recorded()
      .filter((r) => !live.has(key(r)))
      .map((r) => `ang-etymons.tsv:${r.line} ${r.lemma} → ${r.tgt} → “${r.etymon}” matches no claim in lex-ang.tsv`);
    const twice = recorded()
      .map(key)
      .filter((k, i, all) => all.indexOf(k) !== i);

    assert.deepEqual([...stale, ...twice.map((k) => `recorded twice: ${k.replace(/\t/g, ' ')}`)], []);
  });

  test('the rule has something to police', () => {
    // 309 claims on 2026-10-01. A floor rather than the count, so that taking
    // out another false one does not have to be registered here too.
    const n = claims().length;
    assert.ok(n >= 250, `only ${n} Old English rows claim a descendant, so this guard is close to vacuous`);
  });
});
