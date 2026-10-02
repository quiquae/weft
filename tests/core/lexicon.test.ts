import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { entriesByTarget } from '../../src/core/lexicon.ts';
import { buildDiscoveries } from '../../src/core/discoveries.ts';
import type { LexEntry } from '../../src/core/types.ts';
import { card, entry } from '../helpers.ts';

/**
 * A card is keyed by its target word alone, and the pack holds a row per
 * English word and surface form, so one card stands for several rows. These
 * tests are about which row speaks for the word, and they are written from
 * the pack as it ships: `argent` is two rows in `en-fr.json`, *silver* first
 * and *money* second, and only the second carries a claim.
 */

/** A pack's `entries`, keyed by English surface form the way the packs are. */
function pack(...rows: LexEntry[]): Record<string, LexEntry[]> {
  const out: Record<string, LexEntry[]> = {};
  for (const row of rows) (out[row.src] ??= []).push(row);
  return out;
}

const ARGENTINE = 'shares a root with English “argentine”, silvery';
const silver = entry({ src: 'silver', lemma: 'silver', tgt: 'argent', tgtLemma: 'argent' });
const money = entry({ src: 'money', lemma: 'money', tgt: 'argent', tgtLemma: 'argent', note: ARGENTINE });

describe('entriesByTarget', () => {
  test('gives each target word one entry', () => {
    const chien = entry({ src: 'dog', lemma: 'dog', tgt: 'chien', tgtLemma: 'chien' });
    const lookup = entriesByTarget(pack(silver, money, chien));
    assert.deepEqual([...lookup.keys()], ['argent', 'chien']);
  });

  test('takes a word’s claim from a later row when its own row carries none', () => {
    assert.equal(entriesByTarget(pack(silver, money)).get('argent')?.note, ARGENTINE);
  });

  test('keeps the first row’s gloss, so nothing that glosses the word moves', () => {
    // The vocabulary list, the quiz and the site gloss a word from this entry.
    // Which English word the claims file happened to file the claim under is
    // no reason to change what they say.
    const found = entriesByTarget(pack(silver, money)).get('argent');
    assert.equal(found?.lemma, 'silver');
    assert.equal(found?.src, 'silver');
    assert.equal(found?.tgt, 'argent');
  });

  test('leaves a row that carries its own claim alone', () => {
    // domus, as en-la.json has it: two true descents, one per row.
    const house = entry({ src: 'house', lemma: 'house', tgt: 'domus', tgtLemma: 'domus', etymonOf: 'domestic' });
    const home = entry({ src: 'home', lemma: 'home', tgt: 'domus', tgtLemma: 'domus', etymonOf: 'domicile' });
    assert.equal(entriesByTarget(pack(house, home)).get('domus')?.etymonOf, 'domestic');
  });

  test('takes an etymon and a note from one row together, never one from each', () => {
    // A note is written about its own row's etymon — the false-friend frame
    // reads them as one sentence — so a claim travels whole or not at all.
    const bare = entry({ src: 'a', lemma: 'a', tgt: 'x', tgtLemma: 'x' });
    const etymon = entry({ src: 'b', lemma: 'b', tgt: 'x', tgtLemma: 'x', etymonOf: 'ex' });
    const note = entry({ src: 'c', lemma: 'c', tgt: 'x', tgtLemma: 'x', note: 'simply meant something else' });
    const found = entriesByTarget(pack(bare, etymon, note)).get('x');
    assert.equal(found?.etymonOf, 'ex');
    assert.equal(found?.note, undefined);
  });

  test('never takes a claim across parts of speech, because one spelling can be two words', () => {
    // Old English earm is an arm and it is poor: two words. Were the adjective
    // listed first, borrowing the noun's etymon would tell everyone who met
    // earm as "poor" that it survived into English as arm.
    const poor = entry({ src: 'poor', lemma: 'poor', pos: 'adj', tgt: 'earm', tgtLemma: 'earm' });
    const arm = entry({ src: 'arm', lemma: 'arm', pos: 'noun', tgt: 'earm', tgtLemma: 'earm', etymonOf: 'arm' });
    const found = entriesByTarget(pack(poor, arm)).get('earm');
    assert.equal(found?.lemma, 'poor');
    assert.equal(found?.etymonOf, undefined);
  });

  test('reads a word from its singular row, as the site prints it', () => {
    const children = entry({ src: 'children', lemma: 'child', tgt: 'puerī', tgtLemma: 'puer', num: 'pl' });
    const child = entry({ src: 'child', lemma: 'child', tgt: 'puer', tgtLemma: 'puer', num: 'sg' });
    assert.equal(entriesByTarget(pack(children, child)).get('puer')?.tgt, 'puer');
  });

  test('does not touch the pack it reads', () => {
    // The dashboard, the quiz builder and the site all hand over the pack
    // they loaded. A claim written onto its first row would be a claim the
    // tooltip then showed for a word it does not belong to.
    const frozen = pack(Object.freeze({ ...silver }), Object.freeze({ ...money }));
    const found = entriesByTarget(frozen).get('argent');
    assert.equal(found?.note, ARGENTINE);
    assert.equal(frozen.silver?.[0]?.note, undefined);
  });
});

describe('the feed, read the way the dashboard reads the pack', () => {
  test('tells argent’s story, which sits on the money row', () => {
    const met = [card({ lemma: 'argent', target: 'fr', exposures: 3 })];
    const found = buildDiscoveries({
      cards: met,
      entriesByLemma: entriesByTarget(pack(silver, money)),
      historical: false,
    });
    assert.deepEqual(
      found.map((d) => d.text),
      ['argent — shares a root with English “argentine”, silvery.'],
    );
  });
});
