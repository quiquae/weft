/**
 * An etymon names the dictionary entry it was checked against, or it does not
 * ship: in Old English since 2026-10-01, and in Latin from 2026-10-03.
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
 * Latin's column is printed as "This is the Latin word your English X was
 * borrowed from" on every Latin word page, "Source of English X" in the
 * tooltip, and in the feed's borrowing frames. Its standard is looser than Old
 * English's, because its verb is: a learned borrowing from a word built on
 * this one is still a borrowing — *vaccine* is from *vaccīnus*, from `vacca`.
 * What it does not survive is the English word coming from a sibling, which
 * is a cousin — *salvation* is from *salvāre*, from *salvus*, which `salvē`
 * comes from too — or from another Latin word through French, or from no
 * Latin at all: "semper fidelis" is a motto English quotes, not a word it has.
 *
 * So the lookup is recorded, in `tools/seed/<code>-etymons.tsv`, one line per
 * claim, and these tests hold each pair of files together. The rule is the
 * French one (`tools/cousins.ts`, `sourcesNeeded`), derived from the claim
 * rather than listed: a descent is a claim about the *English* word, so it
 * must cite that word's own entry — etymonline, or English Wiktionary where
 * etymonline has none. It cannot tell a reference somebody read from one
 * somebody typed; the entries cited should be the ones actually opened.
 *
 * Notes are not covered here: each language's have their own ledger,
 * `tests/tools/la-notes.test.ts` and `tests/tools/ang-notes.test.ts`.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

type Pack = {
  code: 'ang' | 'la';
  /** The adjective the suite is named with. */
  language: string;
  /**
   * The entries a source can name, beyond the English word's own:
   *
   *   etym:<english>      https://www.etymonline.com/word/<english>
   *   wikt:en:<english>   https://en.wiktionary.org/wiki/<english>#English
   *   wikt:ang:<old>      https://en.wiktionary.org/wiki/<old>#Old_English
   *   wikt:la:<latin>     https://en.wiktionary.org/wiki/<latin>#Latin
   *   ls:<key>            Lewis & Short, by the entry's key in the Perseus text
   *                       (`la-notes.tsv` spells out the address)
   */
  source: RegExp;
  forms: string;
  /** How many claims the rule must police before it is close to vacuous. */
  floor: number;
};

const PACKS: Pack[] = [
  {
    code: 'ang',
    language: 'Old English',
    source: /^(?:etym|wikt:(?:en|ang)):[^\s:]+$/u,
    forms: 'etym:<english>, wikt:en:<english> or wikt:ang:<old>',
    // 309 claims on 2026-10-01. A floor rather than the count, so that taking
    // out another false one does not have to be registered here too.
    floor: 250,
  },
  {
    code: 'la',
    language: 'Latin',
    source: /^(?:etym:[^\s:]+|wikt:(?:en|la):[^\s:]+|ls:[A-Za-z]+\d?)$/u,
    forms: 'etym:<english>, wikt:en:<english>, wikt:la:<latin> or ls:<key>',
    // 305 claims on 2026-10-03, after 14 were taken out.
    floor: 250,
  },
];

/**
 * Etymons whose etymonline entry is filed under another heading. etymonline
 * heads its entries with the American form and its page for the British one
 * carries no entry at all — measured: `/word/neighbour` holds 911 characters
 * of navigation and `/word/grey` only the entries that mention the colour.
 * The packs write British English throughout, so the etymon keeps its
 * spelling and the citation names the page that was read. *malic acid* is
 * told under *malic*, "1790 (in malic acid …)", and has no page of its own.
 */
const SPELLED: Record<string, string> = { neighbour: 'neighbor', grey: 'gray', 'malic acid': 'malic' };

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

/** Every row of a lexicon that claims a descendant, in the file's order. */
function claims(pack: Pack): Row[] {
  return lines(join(ROOT, `tools/seed/lex-${pack.code}.tsv`))
    .map(({ line, fields: [lemma = '', pos = '', tgt = '', , , , etymon = ''] }) => ({ line, lemma, pos, tgt, etymon }))
    .filter((r) => r.etymon);
}

function recorded(pack: Pack): Recorded[] {
  return lines(join(ROOT, `tools/seed/${pack.code}-etymons.tsv`)).map(
    ({ line, fields: [lemma = '', pos = '', tgt = '', etymon = '', cited = ''] }) => ({
      line,
      lemma,
      pos,
      tgt,
      etymon,
      sources: cited ? cited.split(/\s+/) : [],
    }),
  );
}

/** What a claim must cite: the English word's own entry, in either dictionary. */
const accepted = (etymon: string): string[] => {
  const entry = SPELLED[etymon] ?? etymon;
  return [`etym:${slug(entry)}`, `wikt:en:${entry}`];
};

for (const pack of PACKS) {
  const lexicon = `lex-${pack.code}.tsv`;
  const ledger = `${pack.code}-etymons.tsv`;

  describe(`a${pack.language.startsWith('O') ? 'n' : ''} ${pack.language} etymon names the entry it was checked against`, () => {
    test('every claim in the lexicon has a source recorded for exactly that claim', () => {
      const byKey = new Map(recorded(pack).map((r) => [key(r), r]));
      const offenders = claims(pack).flatMap((c) => {
        const r = byKey.get(key(c));
        if (!r) return [`${lexicon}:${c.line} ${c.lemma} → ${c.tgt} claims “${c.etymon}”, and no source is recorded for it`];
        if (r.etymon !== c.etymon) {
          return [
            `${lexicon}:${c.line} ${c.lemma} → ${c.tgt} claims “${c.etymon}”, but ${ledger}:${r.line} records a source for “${r.etymon}”`,
          ];
        }
        return [];
      });

      assert.deepEqual(offenders, [], `${offenders.length} etymons name no entry they were checked against:\n  ${offenders.join('\n  ')}`);
    });

    test('a recorded source cites the English word’s own entry', () => {
      // The French guard's derivation: the claim is about the English word, so
      // that is the entry that can settle it. Citing the source language's
      // page alone is what let the translation pass for the ancestor.
      const offenders = recorded(pack)
        .filter((r) => !accepted(r.etymon).some((s) => r.sources.includes(s)))
        .map(
          (r) =>
            `${ledger}:${r.line} ${r.tgt} → “${r.etymon}” cites ${r.sources.join(' ') || 'nothing'}; it needs ${accepted(r.etymon).join(' or ')}`,
        );

      assert.deepEqual(offenders, [], `${offenders.length} recorded sources miss the English word's entry:\n  ${offenders.join('\n  ')}`);
    });

    test('every source names an entry in a form someone can open', () => {
      const offenders = recorded(pack).flatMap((r) =>
        r.sources.filter((s) => !pack.source.test(s)).map((s) => `${ledger}:${r.line} “${s}” is not ${pack.forms}`),
      );

      assert.deepEqual(offenders, [], `${offenders.length} sources cannot be read:\n  ${offenders.join('\n  ')}`);
    });

    test('no source is recorded for a claim the lexicon no longer makes', () => {
      // The converse, so that removing a false etymon from the lexicon cannot
      // leave a line here vouching for it. The claims taken out are kept as
      // comments at the foot of each ledger, with the reason.
      const live = new Set(claims(pack).map(key));
      const stale = recorded(pack)
        .filter((r) => !live.has(key(r)))
        .map((r) => `${ledger}:${r.line} ${r.lemma} → ${r.tgt} → “${r.etymon}” matches no claim in ${lexicon}`);
      const twice = recorded(pack)
        .map(key)
        .filter((k, i, all) => all.indexOf(k) !== i);

      assert.deepEqual([...stale, ...twice.map((k) => `recorded twice: ${k.replace(/\t/g, ' ')}`)], []);
    });

    test('the rule has something to police', () => {
      const n = claims(pack).length;
      assert.ok(n >= pack.floor, `only ${n} ${pack.language} rows must name a source, so this guard is close to vacuous`);
    });
  });
}
