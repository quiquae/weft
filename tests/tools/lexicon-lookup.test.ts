/**
 * A card is read back as a word in one place, and that place tells the
 * word's story wherever the pack keeps it.
 *
 * Cards are keyed by target word, and the pack holds a row per English word,
 * so `fr:argent` stands for *silver* and *money* both. Three readers each
 * built their own lookup from target word to row by hand — the dashboard,
 * the background's quiz builder and the site builder — and each kept the
 * first row it met. Where that row carried no claim, the word had no story:
 * the feed said nothing about argent and fille, whose claims sit on the
 * money and daughter rows. `src/core/lexicon.ts` is the one lookup now, and
 * this file holds both halves of that.
 *
 * **No reader builds its own.** Three hand copies of one loop is how the
 * defect was in three places, and a fourth copy would bring it back without
 * failing anything else. The pattern looked for is a map keyed by a row's
 * `tgtLemma` — `byLemma.set(entry.tgtLemma, entry)`, the shape of the line
 * all three copies had — and it is looked for in every source file under
 * `src/` and `tools/`, rather than in the three files that had it.
 *
 * **On the packs that ship, the lookup moves stories and nothing else.**
 * Worked out here from the rows directly rather than by calling the lookup's
 * own rule twice: for each word, the claims its rows of the first row's part
 * of speech carry, and the gloss of its first singular row. The lookup must
 * tell one of those claims whenever there is one, never a claim from a row
 * of another part of speech — Old English `hund` is a dog and a hundred, two
 * words, which the seed now numbers apart (`tests/tools/lexicon-homographs.test.ts`)
 * — and gloss every word exactly as its first singular row does, which is
 * what the vocabulary list, the quiz and the site go on showing.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entriesByTarget } from '../../src/core/lexicon.ts';
import type { LexEntry } from '../../src/core/types.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PACKS = join(ROOT, 'src/lexicon/packs');

/** Where the lookup is defined, and so the one file allowed to build it. */
const HOME = 'src/core/lexicon.ts';

/** A map keyed by a row's target word: `seen.set(e.tgtLemma, e)`. */
const HAND_LOOKUP = /\.set\(\s*[\w.]+\.tgtLemma\s*,/;

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) out.push(...sources(path));
    else if (/\.(?:ts|tsx|mjs|js)$/.test(item.name)) out.push(path);
  }
  return out;
}

describe('one lookup reads a card back as a word', () => {
  const files = [...sources(join(ROOT, 'src')), ...sources(join(ROOT, 'tools'))];

  test('no source file builds its own map from target word to row', () => {
    const offenders: string[] = [];
    for (const path of files) {
      const rel = relative(ROOT, path);
      if (rel === HOME) continue;
      readFileSync(path, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (HAND_LOOKUP.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
        });
    }
    assert.deepEqual(
      offenders,
      [],
      `read a pack back by target word with entriesByTarget() from ${HOME}, not by hand:\n  ${offenders.join('\n  ')}`,
    );
  });

  test('the walk read the extension and its tools, and the exemption is the lookup', () => {
    // Without these, a walk that found nothing — a moved directory, a renamed
    // extension — would pass the test above with nothing in it.
    assert.ok(files.length > 80, `only ${files.length} source files were read`);
    const home = readFileSync(join(ROOT, HOME), 'utf8');
    assert.match(home, /export function entriesByTarget\(/, `${HOME} no longer defines entriesByTarget`);
  });
});

type Pack = { entries: Record<string, LexEntry[]> };

const packs = readdirSync(PACKS)
  .filter((name) => /^en-[a-z]+\.json$/.test(name))
  .map((name) => ({
    lang: name.slice(3, -5),
    pack: JSON.parse(readFileSync(join(PACKS, name), 'utf8')) as Pack,
  }));

/** Every row of every word, in pack order. */
function rowsByWord(pack: Pack): Map<string, LexEntry[]> {
  const out = new Map<string, LexEntry[]>();
  for (const list of Object.values(pack.entries)) {
    for (const row of list) out.set(row.tgtLemma, [...(out.get(row.tgtLemma) ?? []), row]);
  }
  return out;
}

const claimOf = (row: LexEntry): string | null =>
  row.etymonOf || row.note ? JSON.stringify([row.etymonOf ?? null, row.note ?? null]) : null;

describe('on the packs that ship, the lookup moves stories and nothing else', () => {
  test('a word whose story sits on another row of its part of speech is told it', () => {
    const untold: string[] = [];
    for (const { lang, pack } of packs) {
      const lookup = entriesByTarget(pack.entries);
      for (const [word, rows] of rowsByWord(pack)) {
        const head = rows.find((r) => r.num !== 'pl') ?? rows[0]!;
        const told = rows.filter((r) => r.pos === head.pos).map(claimOf).filter(Boolean);
        if (told.length && !claimOf(lookup.get(word)!)) {
          untold.push(`${lang}:${word} — read as “${head.lemma}”, while “${rows.find((r) => claimOf(r))!.lemma}” carries its story`);
        }
      }
    }
    assert.deepEqual(untold, [], `the feed would say nothing about:\n  ${untold.join('\n  ')}`);
  });

  test('no word is told a claim that only a row of another part of speech carries', () => {
    const borrowed: string[] = [];
    for (const { lang, pack } of packs) {
      const lookup = entriesByTarget(pack.entries);
      for (const [word, rows] of rowsByWord(pack)) {
        const head = rows.find((r) => r.num !== 'pl') ?? rows[0]!;
        const own = new Set(rows.filter((r) => r.pos === head.pos).map(claimOf));
        const claim = claimOf(lookup.get(word)!);
        if (claim && !own.has(claim)) borrowed.push(`${lang}:${word} (${head.pos}) — ${claim}`);
      }
    }
    assert.deepEqual(borrowed, [], `told a claim about a different word:\n  ${borrowed.join('\n  ')}`);
  });

  test('every word keeps the gloss and form of its first singular row', () => {
    const moved: string[] = [];
    for (const { lang, pack } of packs) {
      const lookup = entriesByTarget(pack.entries);
      for (const [word, rows] of rowsByWord(pack)) {
        const head = rows.find((r) => r.num !== 'pl') ?? rows[0]!;
        const read = lookup.get(word)!;
        for (const key of ['src', 'lemma', 'pos', 'tgt', 'ipa'] as const) {
          if (read[key] !== head[key]) moved.push(`${lang}:${word} ${key}: “${head[key]}” → “${read[key]}”`);
        }
      }
    }
    assert.deepEqual(moved, [], `a gloss moved:\n  ${moved.join('\n  ')}`);
  });

  test('the packs give the rule something to police', () => {
    // Without a floor the three tests above pass on any pack that has no word
    // with two English glosses. All seven have some: 49 words across them on
    // 2026-10-02, two of which (fr argent, fr fille) kept their story on a row
    // other than the first.
    assert.equal(packs.length, 7, `read ${packs.length} packs`);
    let shared = 0;
    for (const { pack } of packs) {
      for (const rows of rowsByWord(pack).values()) {
        if (new Set(rows.map((r) => r.lemma)).size > 1) shared++;
      }
    }
    assert.ok(shared > 40, `only ${shared} target words have more than one English gloss`);
  });
});
