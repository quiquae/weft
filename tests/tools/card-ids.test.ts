/**
 * A card id, once shipped, is a card somebody may have.
 *
 * A card's id is `${target}:${tgtLemma}`, so changing a headword's spelling
 * in a seed — dotting a palatal letter, adding a macron — files every card a
 * learner has for that word under an id no pack reads any more. Nothing in
 * the build notices: the packs rebuild, every page renders, and the word
 * arrives at the next install as new while its reviews sit unread beside it.
 * The only defence is to remember the old spelling, in `RENAMED`
 * (`src/core/renames.ts`), which moves those cards when they are loaded or
 * imported — and remembering is exactly what nothing enforced.
 *
 * So `tools/seed/card-ids.tsv` records every id a pack has carried, and the
 * two are held together here. A word a pack teaches must be in the ledger,
 * which is one line for a new word. A word in the ledger must still be
 * taught, or be renamed in `RENAMED` to one that is, which is the line a
 * respelling would otherwise forget. And the table itself must be safe to
 * run against a real learner's cards: it may never move a card off a word a
 * pack still teaches, it must name spellings a pack really used, and a
 * rename may change marks only, because a different word is a different
 * card.
 *
 * The ledger was taken on 2026-10-04 from the packs as they stood, which hold
 * every id the published 1.0.0 packs did — measured against `git show
 * v1.0.0:src/lexicon/packs/…`, no id had been lost since — and the four
 * homograph seconds added after it.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entriesByTarget, spelling } from '../../src/core/lexicon.ts';
import { RENAMED } from '../../src/core/renames.ts';
import type { LexEntry } from '../../src/core/types.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PACKS = join(ROOT, 'src/lexicon/packs');
const LEDGER = join(ROOT, 'tools/seed/card-ids.tsv');

interface Pack {
  meta: { target: string };
  entries: Record<string, LexEntry[]>;
}

/** The ids the shipped packs teach, as `target:lemma`. */
const live = new Set<string>();
const languages = new Set<string>();
for (const name of readdirSync(PACKS).filter((f) => /^en-.+\.json$/.test(f))) {
  const pack = JSON.parse(readFileSync(join(PACKS, name), 'utf8')) as Pack;
  languages.add(pack.meta.target);
  for (const word of entriesByTarget(pack.entries).keys()) live.add(`${pack.meta.target}:${word}`);
}

const lines = readFileSync(LEDGER, 'utf8')
  .split('\n')
  .map((line, i) => ({ line, at: i + 1 }))
  .filter(({ line }) => line && !line.startsWith('#'));
const ledger = lines.map(({ line, at }) => {
  const [target, lemma, ...rest] = line.split('\t');
  assert.ok(target && lemma && !rest.length, `card-ids.tsv:${at} is not "target<TAB>lemma": ${line}`);
  return { id: `${target}:${lemma}`, target, lemma, at };
});
const recorded = new Set(ledger.map(({ id }) => id));

/** Where a renamed id's trail ends, or why it does not. */
function follow(target: string, lemma: string): { to?: string; loop?: string[] } {
  const table = RENAMED[target] ?? {};
  const trail = [lemma];
  for (let next = table[lemma]; next !== undefined; next = table[trail.at(-1) as string]) {
    if (trail.includes(next)) return { loop: [...trail, next] };
    trail.push(next);
  }
  return { to: trail.at(-1) as string };
}

/** A spelling's letters, with its marks and any homograph number off. */
function letters(lemma: string): string {
  return spelling(lemma).normalize('NFD').replace(/\p{M}/gu, '');
}

describe('the ledger of card ids', () => {
  test('holds every word a pack teaches', () => {
    const missing = [...live].filter((id) => !recorded.has(id)).sort();
    assert.deepEqual(
      missing,
      [],
      `${missing.length} card id(s) a pack teaches are not in tools/seed/card-ids.tsv. ` +
        `A new word is one line, target and lemma: ${missing.slice(0, 8).join(', ')}`,
    );
  });

  test('names only words a pack still teaches, or one RENAMED moves to one', () => {
    const lost = ledger
      .filter(({ id }) => !live.has(id))
      .filter(({ target, lemma }) => {
        const { to } = follow(target, lemma);
        return to === lemma || !live.has(`${target}:${to}`);
      })
      .map(({ id, at }) => `${id} (card-ids.tsv:${at})`);
    assert.deepEqual(
      lost,
      [],
      `${lost.length} card id(s) were shipped and no pack reads them any more, so every card a ` +
        'learner has for them is stranded. A respelt word needs its old spelling in RENAMED, ' +
        `src/core/renames.ts: ${lost.join(', ')}`,
    );
  });

  test('is sorted, holds each id once, and covers every pack', () => {
    const ids = ledger.map(({ id }) => id);
    assert.deepEqual(ids, [...ids].sort(), 'card-ids.tsv is not in sorted order');
    assert.equal(recorded.size, ids.length, 'card-ids.tsv holds an id twice');
    assert.ok(languages.size >= 7, `only ${languages.size} packs were read`);
    for (const target of languages) {
      assert.ok(
        ledger.filter((row) => row.target === target).length > 300,
        `the ledger holds almost nothing for ${target}`,
      );
    }
  });
});

describe('the rename table', () => {
  const renames = Object.entries(RENAMED).flatMap(([target, table]) =>
    Object.entries(table).map(([from, to]) => ({ target, from, to })),
  );

  test('has something in it, or nothing below tests a real rename', () => {
    assert.ok(renames.length > 0);
  });

  test('never moves a card off a word a pack still teaches', () => {
    const stolen = renames.filter(({ target, from }) => live.has(`${target}:${from}`));
    assert.deepEqual(
      stolen.map(({ target, from, to }) => `${target}:${from} → ${to}`),
      [],
      'a rename whose old spelling is still a headword would move learners off a word still taught',
    );
  });

  test('names spellings a pack really used', () => {
    // A mistyped old spelling renames nothing and fails nowhere else.
    const unknown = renames.filter(({ target, from }) => !recorded.has(`${target}:${from}`));
    assert.deepEqual(
      unknown.map(({ target, from }) => `${target}:${from}`),
      [],
      'RENAMED moves a spelling tools/seed/card-ids.tsv has never recorded',
    );
  });

  test('ends every trail at a word a pack teaches, without going round', () => {
    const bad = renames.flatMap(({ target, from }) => {
      const { to, loop } = follow(target, from);
      if (loop) return [`${target}: ${loop.join(' → ')} goes round`];
      return live.has(`${target}:${to}`) ? [] : [`${target}:${from} ends at ${to}, which no pack teaches`];
    });
    assert.deepEqual(bad, []);
  });

  test('changes marks, never letters', () => {
    const respelt = renames.filter(({ from, to }) => letters(from) !== letters(to));
    assert.deepEqual(
      respelt.map(({ target, from, to }) => `${target}:${from} → ${to}`),
      [],
      'a rename that changes letters joins two words into one card',
    );
  });
});
