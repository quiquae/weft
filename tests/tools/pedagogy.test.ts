/**
 * `docs/PEDAGOGY.md`, held to the packs and the selector it describes.
 *
 * The document states every default as a pedagogical claim, the README sends
 * readers to it, and the store description's "tested since" leans on its
 * citations. Nothing read it until 2026-11-08, and its claims about the
 * product had drifted from the code in the ways these rules now refuse, each
 * read from the code rather than typed here:
 *
 * - **Every word it gives as an example is one the pack teaches, with the
 *   descendant it names.** It said `pecus`, cattle, "gave us *pecuniary*":
 *   the Latin pack has no `pecus`, and *pecuniary* is `pecūnia`'s, whose
 *   note is where the cattle are — the same skipped link
 *   `docs/LAUNCH.md`'s draft was corrected for on 2026-09-28.
 * - **Every row of its false-friend table is a word the pack marks**: an
 *   Old English target whose etymon is the English word the row names, with
 *   a note saying what it meant, and every word of the row's "Means" cell
 *   standing in the row's gloss or its note. It listed `sōþ`, which carries
 *   no note, so nothing anywhere tells a reader of *sōþ* what the table
 *   says, and which is not a false friend: *sooth* still means truth.
 * - **"Usually the literal ancestor" is a majority of the seed's rows**,
 *   counted a row at a time, where the plural rows would halve it: 236 of
 *   358 on the day this was written.
 * - **The selector's factors are the ones the code scores**, read off
 *   `scoreCandidate()`'s own `factors` record. Its list named six and left
 *   out four — the part of speech, the confidence gate, the repetition gate
 *   and the sentence-initial one.
 * - **No pack ships a part of speech the defaults do not weave**, because
 *   the document says the four function-word switches weave nothing: no
 *   pack has an article, preposition, conjunction or pronoun, and the
 *   provider path's guesser never returns one. A pack that gains one makes
 *   that sentence false.
 *
 * Claims about the world — what Burling proposed, what a study found — are
 * not the code's, and these rules cannot hold them. They were read in the
 * sources the document cites; TODO.md's Notes say what each said. One is
 * refused by its words, because it had spread to nine sentences before
 * anyone read a source: that the method came from Brigham Young University
 * in the 1970s, where the first study cited credits Robbins Burling, 1968.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entriesByTarget } from '../../src/core/lexicon.ts';
import { scoreCandidate, type SelectorInput } from '../../src/core/selector.ts';
import { DEFAULT_POS, defaultSettings } from '../../src/core/settings.ts';
import type { LexEntry, Token } from '../../src/core/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DOC = 'docs/PEDAGOGY.md';
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

type Entries = Record<string, LexEntry[]>;
const entries = (lang: string): Entries =>
  (JSON.parse(read(`src/lexicon/packs/en-${lang}.json`)) as { entries: Entries }).entries;

/** The text under a heading of the document, up to the next heading of its rank or above. */
function section(heading: string): string {
  const lines = read(DOC).split('\n');
  const start = lines.findIndex((line) => line === heading);
  assert.notEqual(start, -1, `${DOC} has no "${heading}" heading`);
  const rank = heading.indexOf(' ');
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => {
    const m = /^(#+) /.exec(line);
    return m !== null && m[1]!.length <= rank;
  });
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

const ETYMON = '### The etymon is the point';

describe(`${DOC}'s examples`, () => {
  test('every Old English word it shows becoming an English one is a pack word with that etymon', () => {
    const byTarget = entriesByTarget(entries('ang'));
    const shown = [...section(ETYMON).matchAll(/`([^`]+)`\s*→\s*([a-z]+)/g)];
    assert.ok(shown.length >= 4, `only ${shown.length} Old English examples were read; has the → notation changed?`);
    const wrong = shown.flatMap(([, word, english]) => {
      const entry = byTarget.get(word!);
      if (!entry) return [`\`${word}\` → ${english}: the Old English pack teaches no \`${word}\``];
      if (entry.etymonOf !== english) {
        return [`\`${word}\` → ${english}: the pack names its descendant ${entry.etymonOf ?? 'nowhere'}`];
      }
      return [];
    });
    assert.deepEqual(wrong, []);
  });

  test('every Latin word it says "gave us" an English one is a pack word with that etymon', () => {
    const byTarget = entriesByTarget(entries('la'));
    const shown = [...section(ETYMON).matchAll(/`([^`]+)`[^`.]*?gave\s+us\s+\*([a-z]+)\*/g)];
    assert.ok(shown.length >= 4, `only ${shown.length} Latin examples were read; has "gave us" changed?`);
    const wrong = shown.flatMap(([, phrase, english]) => {
      // A phrase is read by its first word, as the landing page's tables
      // are: `mīlle passūs` is the pack's `mīlle`.
      const word = phrase!.split(' ')[0]!;
      const entry = byTarget.get(word);
      if (!entry) return [`\`${phrase}\` gave us ${english}: the Latin pack teaches no \`${word}\``];
      if (entry.etymonOf !== english) {
        return [`\`${phrase}\` gave us ${english}: the pack names its descendant ${entry.etymonOf ?? 'nowhere'}`];
      }
      return [];
    });
    assert.deepEqual(wrong, []);
  });
});

describe(`${DOC}'s false-friend table`, () => {
  const rows = () =>
    [...section(ETYMON).matchAll(/^\| `([^`]+)` \| ([^|]+) \| \*([a-z]+)\*[^|]* \|$/gm)].map(
      ([, word, means, became]) => ({ word: word!, means: means!.trim(), became: became! }),
    );

  test('has rows to hold', () => {
    assert.ok(rows().length >= 5, `only ${rows().length} rows were read; has the table's shape changed?`);
  });

  test('each row is an Old English word the pack marks, with the descendant and the sense it says', () => {
    const byTarget = entriesByTarget(entries('ang'));
    const wrong = rows().flatMap(({ word, means, became }) => {
      const entry = byTarget.get(word);
      if (!entry) return [`\`${word}\`: the Old English pack teaches no such word`];
      const out: string[] = [];
      if (entry.etymonOf !== became) out.push(`\`${word}\`: the table says it became ${became}, the pack ${entry.etymonOf ?? 'nothing'}`);
      if (!entry.note) {
        out.push(`\`${word}\`: the pack carries no note, so nothing tells a reader it meant "${means}"`);
      }
      // Every word the cell says it meant stands in the gloss or the note.
      const said = `${entry.src} ${entry.note ?? ''}`.toLowerCase();
      for (const w of means.toLowerCase().match(/[a-z]{3,}/g) ?? []) {
        if (!said.includes(w)) out.push(`\`${word}\`: "${w}" is in the table's "${means}" and in neither its gloss nor its note`);
      }
      return out;
    });
    assert.deepEqual(wrong, []);
  });
});

describe('where the method comes from', () => {
  // The copy a stranger reads: the README, every tracked document under
  // `docs/` and the hand-written pages under `site/`.
  const COPY = execFileSync('git', ['ls-files', 'README.md', 'docs/*.md', 'site/*.html'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);

  test('no copy credits the diglot weave to BYU or dates it to the 1970s', () => {
    // The first study the pedagogy notes cite says the diglot method was
    // "originally conceived by Burling", whose paper is 1968's; until
    // 2026-11-08 nine sentences said Brigham Young University in the 1970s,
    // which no source the documents cite says.
    assert.ok(COPY.length > 10, `only ${COPY.length} documents were read`);
    const said = COPY.flatMap((path) =>
      read(path)
        .split(/\n\s*\n/)
        .filter((p) => /diglot/i.test(p) && /\bBYU\b|Brigham Young|\b1970s\b|95[–-]98\s?%/.test(p))
        .map((p) => `${path}: ${p.replace(/\s+/g, ' ').slice(0, 120)}…`),
    );
    assert.deepEqual(said, []);
  });
});

describe(`${DOC}'s statements about the packs and the selector`, () => {
  test('"usually the literal ancestor" is a majority of the Old English seed rows', () => {
    const said = /the target is usually the literal ancestor/.test(section(ETYMON));
    assert.ok(said, `${DOC} no longer says the Old English target is usually the ancestor; update this test with it`);
    // A row at a time, as the seed writes them: a plural row's `src` is the
    // English plural while its etymon is the lemma, so counting every
    // surface form would read "men" as no ancestor of "menn".
    const rows = Object.values(entries('ang'))
      .flat()
      .filter((e) => e.src === e.lemma);
    const ancestors = rows.filter((e) => e.etymonOf === e.lemma).length;
    assert.ok(rows.length > 300, `only ${rows.length} Old English seed rows were read`);
    assert.ok(
      ancestors * 2 > rows.length,
      `${ancestors} of ${rows.length} Old English rows are the ancestor of the word they replace, which is not "usually"`,
    );
  });

  test('every factor scoreCandidate() scores is named in "Which words, in which order"', () => {
    // The labels the document gives each of the record's keys. A key with
    // no label here is a factor the code scores and the document does not
    // say; a label the section does not print in bold is a factor it lost.
    const LABEL: Readonly<Record<string, string>> = {
      due: 'Due',
      cognate: 'Cognate',
      frequency: 'Frequency',
      bandFit: 'Band fit',
      guessability: 'Guessability',
      pos: 'Part of speech',
      confidence: 'Confidence',
      ambiguityGate: 'Ambiguity',
      repeatGate: 'Repetition',
      positionGate: 'Position',
    };
    const entry = {
      src: 'house', lemma: 'house', pos: 'noun', tgt: 'maison', tgtLemma: 'maison',
      zipf: 5, senses: 1, band: 1, conf: 0.9,
    } as LexEntry;
    const token = { text: 'house', capitalized: false } as Token;
    const input = { settings: defaultSettings(0, 'pedagogy'), effectiveLevel: 1, now: 0, explain: true } as unknown as SelectorInput;
    const keys = Object.keys(scoreCandidate(entry, token, undefined, input, 12, 0).factors).filter((k) => k !== 'score');
    assert.ok(keys.length >= 6, `scoreCandidate() explained only ${keys.length} factors`);

    const text = section('## Which words, in which order');
    const missing = keys.flatMap((key) => {
      const label = LABEL[key];
      if (!label) return [`${key}: scored by the selector and given no label in this test`];
      return text.includes(`**${label}**`) ? [] : [`${key}: the section does not name **${label}**`];
    });
    assert.deepEqual(missing, []);
    const stale = Object.keys(LABEL).filter((key) => !keys.includes(key));
    assert.deepEqual(stale, [], 'LABEL names a factor the selector no longer scores');
  });

  test('no pack ships a part of speech the defaults do not weave', () => {
    const woven = new Set<string>([...DEFAULT_POS, 'phrase']);
    const index = JSON.parse(read('src/lexicon/packs/index.json')) as { packs: { target: string }[] };
    assert.ok(index.packs.length >= 7, `only ${index.packs.length} packs were read`);
    const extra = index.packs.flatMap(({ target }) =>
      [...new Set(Object.values(entries(target)).flat().map((e) => e.pos))]
        .filter((pos) => !woven.has(pos))
        .map((pos) => `en-${target}: a ${pos} row, which ${DOC} says no pack has`),
    );
    assert.deepEqual(extra, []);
  });
});
