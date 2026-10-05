import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { RENAMED, WITHDRAWN, isWithdrawn, renameCards, type Renames } from '../../src/core/renames.ts';
import type { MemoryCard } from '../../src/core/types.ts';

/**
 * A card follows its word when the pack respells it.
 *
 * A card's id is `${target}:${tgtLemma}`, so a change of spelling is a change
 * of identity: when the Old English pack dots `sēcan` as `sēċan`, which is how
 * Wright's grammar and English Wiktionary write it, every card a learner has
 * for the word is filed under an id no pack row reads any more. Nothing would
 * delete it; it would simply never be found again, and the word would arrive
 * as new with its reviews stranded beside it. The homograph decision refuses
 * that ("Do not number the first"), and a respelling needs the same care.
 *
 * So the old spelling is recorded beside the new one, in `RENAMED`, and a
 * card filed under it is moved wherever cards come in: when an install loads
 * the cards an older version wrote, and when an export written by one is
 * imported.
 */

const NOW = Date.UTC(2026, 9, 4, 12);
const DAY = 86_400_000;

function card(target: string, lemma: string, over: Partial<MemoryCard> = {}): MemoryCard {
  return {
    id: `${target}:${lemma}`,
    target,
    lemma,
    stability: 12,
    difficulty: 4.5,
    lastReview: NOW - 3 * DAY,
    reps: 6,
    lapses: 1,
    exposures: 40,
    firstSeen: NOW - 30 * DAY,
    ...over,
  };
}

const TABLE: Renames = { ang: { sēcan: 'sēċan' } };

describe('renameCards', () => {
  test('moves a card filed under an old spelling, its whole history with it', () => {
    const old = card('ang', 'sēcan', { retiredAt: NOW - DAY });
    const { cards, moved } = renameCards({ 'ang:sēcan': old }, TABLE);

    assert.equal(moved, 1);
    assert.deepEqual(Object.keys(cards), ['ang:sēċan']);
    assert.deepEqual(cards['ang:sēċan'], { ...old, id: 'ang:sēċan', lemma: 'sēċan' });
  });

  test('leaves the map it was given alone, and returns it when nothing moves', () => {
    const given = { 'ang:sēcan': card('ang', 'sēcan') };
    const snapshot = structuredClone(given);
    renameCards(given, TABLE);
    assert.deepEqual(given, snapshot, 'the input map was written to');

    const current = { 'ang:sēċan': card('ang', 'sēċan') };
    const result = renameCards(current, TABLE);
    assert.equal(result.moved, 0);
    assert.equal(result.cards, current, 'a map with nothing to move should come back as itself');
  });

  test('merges into a card the new spelling already has, as an import merges', () => {
    // An export from before the rename, opened on a machine that has met the
    // word since: two records of one word, which mergeCards exists to join.
    const studied = card('ang', 'sēcan', { reps: 9, stability: 30, exposures: 12 });
    const met = card('ang', 'sēċan', {
      reps: 1,
      stability: 2,
      exposures: 55,
      firstSeen: NOW - 90 * DAY,
      lastReview: NOW,
    });
    const { cards, moved } = renameCards({ 'ang:sēcan': studied, 'ang:sēċan': met }, TABLE);

    assert.equal(moved, 1);
    assert.deepEqual(Object.keys(cards), ['ang:sēċan']);
    const joined = cards['ang:sēċan'] as MemoryCard;
    assert.equal(joined.id, 'ang:sēċan');
    assert.equal(joined.lemma, 'sēċan', 'the merged card kept the old spelling as its lemma');
    assert.equal(joined.reps, 9, 'the more-reviewed history was not the one kept');
    assert.equal(joined.stability, 30);
    assert.equal(joined.exposures, 55);
    assert.equal(joined.firstSeen, NOW - 90 * DAY);
  });

  test('renames in the language named, and only there', () => {
    const elsewhere = card('la', 'sēcan');
    const { cards, moved } = renameCards({ 'la:sēcan': elsewhere }, TABLE);
    assert.equal(moved, 0);
    assert.deepEqual(cards, { 'la:sēcan': elsewhere });
  });

  test('follows a word respelt twice to where it is now', () => {
    const twice: Renames = { ang: { a: 'ā', ā: 'ǣ' } };
    const { cards } = renameCards({ 'ang:a': card('ang', 'a') }, twice);
    assert.deepEqual(Object.keys(cards), ['ang:ǣ']);
    assert.equal(cards['ang:ǣ']?.lemma, 'ǣ');
  });

  test('stops on a table that goes round in a circle, and moves nothing', () => {
    // The shipped table is held against this by tests/tools/card-ids.test.ts;
    // this is the guarantee that a bad one cannot hang the worker.
    const circle: Renames = { ang: { a: 'ā', ā: 'a' } };
    const given = { 'ang:a': card('ang', 'a') };
    const { cards, moved } = renameCards(given, circle);
    assert.equal(moved, 0);
    assert.deepEqual(cards, given);
  });

  test('the shipped table is the one used when none is given', () => {
    const [target, renames] = Object.entries(RENAMED)[0] ?? [];
    assert.ok(target && renames, 'RENAMED is empty, so nothing below tests a shipped rename');
    const [from, to] = Object.entries(renames)[0] as [string, string];
    const { cards } = renameCards({ [`${target}:${from}`]: card(target, from) });
    assert.deepEqual(Object.keys(cards), [`${target}:${to}`]);
  });
});

/*
 * The same moves, where cards actually come in. A Map-backed
 * `chrome.storage.local`, as tests/core/storage-export.test.ts uses, and a
 * fresh module instance for each install, so a load really is the first one
 * a new version makes.
 */

type Store = typeof import('../../src/background/storage.ts');

const backing = new Map<string, unknown>();

before(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  g['__WEFT_VERSION__'] = '1.0.1-test';
  g['__WEFT_TARGET__'] = 'chrome';
  g['chrome'] = {
    storage: {
      local: {
        get: async (key: string) => (backing.has(key) ? { [key]: backing.get(key) } : {}),
        set: async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items)) backing.set(k, structuredClone(v));
        },
        remove: async (key: string) => void backing.delete(key),
      },
    },
  };
});

let seq = 0;

async function install(cards?: Record<string, MemoryCard>): Promise<Store> {
  backing.clear();
  if (cards) backing.set('weft:cards', structuredClone(cards));
  seq++;
  return (await import(
    new URL(`../../src/background/storage.ts?install=${seq}`, import.meta.url).href
  )) as Store;
}

describe('a card an older version filed under the old spelling', () => {
  test('is under the new one when the cards are next loaded', async () => {
    const old = card('ang', 'sēcan');
    const store = await install({ 'ang:sēcan': old });

    const cards = await store.loadCards();
    assert.deepEqual(Object.keys(cards), ['ang:sēċan']);
    assert.equal(cards['ang:sēċan']?.reps, old.reps, 'the reviews did not come with it');
  });

  test('is written back moved, so the move is made once', async () => {
    const store = await install({ 'ang:sēcan': card('ang', 'sēcan') });
    await store.loadCards();

    const stored = backing.get('weft:cards') as Record<string, MemoryCard>;
    assert.deepEqual(Object.keys(stored), ['ang:sēċan']);
  });

  test('arrives under the new spelling from an export an older version wrote', async () => {
    const old = card('ang', 'sēcan');
    const store = await install();
    const result = await store.importAll({
      format: 'weft-export/1',
      cards: { 'ang:sēcan': old },
    });

    assert.equal(result.ok, true);
    assert.match(result.message, /1 vocabulary record\b/);
    const cards = await store.loadCards();
    assert.deepEqual(Object.keys(cards), ['ang:sēċan']);
    assert.equal(cards['ang:sēċan']?.lemma, 'sēċan');
    assert.equal(cards['ang:sēċan']?.reps, old.reps);
  });

  test('joins the card this install already has for the word', async () => {
    const store = await install({ 'ang:sēċan': card('ang', 'sēċan', { reps: 1, exposures: 3 }) });
    await store.importAll({
      format: 'weft-export/1',
      cards: { 'ang:sēcan': card('ang', 'sēcan', { reps: 8, exposures: 20 }) },
    });

    const cards = await store.loadCards();
    assert.deepEqual(Object.keys(cards), ['ang:sēċan']);
    assert.equal(cards['ang:sēċan']?.reps, 8);
    assert.equal(cards['ang:sēċan']?.exposures, 20);
  });
});

/**
 * A word a pack taught and stopped teaching, because it was not the language.
 *
 * Old English `far wel` was taught for "goodbye", and no Old English text has
 * it: English Wiktionary gives it only as a reconstruction, `*far wel!`. It
 * cannot be renamed to the formula that replaced it, because a different word
 * is a different card, and its card cannot be deleted, because it is the
 * learner's record of what they read. So it is withdrawn: kept, carried by an
 * export, moved by nothing, and listed as vocabulary nowhere.
 */
describe('a word a pack no longer teaches', () => {
  test('is withdrawn in its own language, and nothing beside it is', () => {
    assert.equal(isWithdrawn(card('ang', 'far wel')), true);
    assert.equal(isWithdrawn(card('ang', 'wes hāl')), false, 'the formula that replaced it');
    assert.equal(isWithdrawn(card('la', 'far wel')), false, 'the same letters in another language');
    assert.equal(isWithdrawn(card('ang', 'far')), false, 'a word inside the phrase');
  });

  test('reads only the table it is given', () => {
    assert.equal(isWithdrawn(card('ang', 'far wel'), {}), false);
    assert.equal(isWithdrawn(card('fr', 'pomme'), { fr: { pomme: 'a test' } }), true);
  });

  test('is never also renamed, so nothing moves its card', () => {
    for (const [target, table] of Object.entries(WITHDRAWN)) {
      for (const lemma of Object.keys(table)) {
        assert.equal(RENAMED[target]?.[lemma], undefined, `${target}:${lemma} is renamed and withdrawn`);
        const given = { [`${target}:${lemma}`]: card(target, lemma) };
        const { cards, moved } = renameCards(given);
        assert.equal(moved, 0);
        assert.equal(cards, given, `${target}:${lemma} was moved`);
      }
    }
  });

  test('keeps its card in what an install loads and in what it exports', async () => {
    const kept = card('ang', 'far wel', { reps: 3, exposures: 12 });
    const store = await install({ 'ang:far wel': kept });

    assert.deepEqual((await store.loadCards())['ang:far wel'], kept);
    const exported = (await store.exportAll()) as { cards: Record<string, MemoryCard> };
    assert.deepEqual(exported.cards['ang:far wel'], kept);
  });
});
