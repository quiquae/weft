import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  fold,
  collapseDoubles,
  jaro,
  jaroWinkler,
  levenshtein,
  levenshteinSimilarity,
  cognateScore,
  cognateReason,
} from '../../src/core/similarity.ts';
import { entry } from '../helpers.ts';

describe('fold', () => {
  test('strips diacritics and lowercases', () => {
    assert.equal(fold('Café'), 'cafe');
    assert.equal(fold('naïve'), 'naive');
    assert.equal(fold('NACIÓN'), 'nacion');
  });

  test('expands historical letterforms to their modern equivalents', () => {
    assert.equal(fold('þēod'), 'theod');
    assert.equal(fold('brōðor'), 'brothor');
    assert.equal(fold('wæter'), 'waeter');
    assert.equal(fold('ƿīf'), 'wif');
    assert.equal(fold('ſome'), 'some');
    assert.equal(fold('straße'), 'strase');
  });

  test('collapses doubled letters so spelling noise does not count', () => {
    assert.equal(collapseDoubles('letter'), 'leter');
    assert.equal(collapseDoubles('aaa'), 'a');
    assert.equal(collapseDoubles(''), '');
    assert.equal(fold('Mississippi'), 'misisipi');
  });

  test('drops non-letters', () => {
    assert.equal(fold("it's-a 42"), 'itsa');
  });
});

describe('jaro and jaroWinkler', () => {
  test('identical strings score 1', () => {
    assert.equal(jaro('abc', 'abc'), 1);
    assert.equal(jaroWinkler('abc', 'abc'), 1);
  });

  test('disjoint strings score 0', () => {
    assert.equal(jaro('abc', 'xyz'), 0);
  });

  test('matches the textbook DWAYNE/DUANE value', () => {
    assert.ok(Math.abs(jaro('dwayne', 'duane') - 0.8222222) < 1e-5);
  });

  test('matches the textbook MARTHA/MARHTA values', () => {
    assert.ok(Math.abs(jaro('martha', 'marhta') - 0.9444444) < 1e-5);
    assert.ok(Math.abs(jaroWinkler('martha', 'marhta') - 0.9611111) < 1e-5);
  });

  test('winkler rewards a shared prefix', () => {
    assert.ok(jaroWinkler('nation', 'nacion') > jaro('nation', 'nacion'));
  });

  test('handles empty input without dividing by zero', () => {
    assert.equal(jaro('', 'abc'), 0);
    assert.equal(jaro('', ''), 1);
  });
});

describe('levenshtein', () => {
  test('known distances', () => {
    assert.equal(levenshtein('kitten', 'sitting'), 3);
    assert.equal(levenshtein('flaw', 'lawn'), 2);
    assert.equal(levenshtein('', 'abc'), 3);
    assert.equal(levenshtein('abc', ''), 3);
    assert.equal(levenshtein('same', 'same'), 0);
  });

  test('similarity is 1 for equal, 0 for fully different of equal length', () => {
    assert.equal(levenshteinSimilarity('abc', 'abc'), 1);
    assert.equal(levenshteinSimilarity('abc', 'xyz'), 0);
    assert.equal(levenshteinSimilarity('', ''), 1);
  });
});

describe('cognateScore', () => {
  test('scores near-identical Romance cognates very high', () => {
    const nation = cognateScore(
      entry({ src: 'nation', lemma: 'nation', tgt: 'nación', tgtLemma: 'nación' }),
    );
    assert.ok(nation > 0.9, `nation/nación scored ${nation}`);
  });

  test('scores unrelated words low', () => {
    const s = cognateScore(entry({ src: 'dog', lemma: 'dog', tgt: 'chien', tgtLemma: 'chien' }));
    assert.ok(s < 0.5, `dog/chien scored ${s}`);
  });

  test('recognises German cognates through sound shifts', () => {
    const water = cognateScore(entry({ src: 'water', lemma: 'water', tgt: 'Wasser', tgtLemma: 'Wasser' }));
    assert.ok(water > 0.6, `water/Wasser scored ${water}`);
  });

  test('an etymon floors the score even when orthography has drifted', () => {
    const plain = cognateScore(entry({ src: 'house', lemma: 'house', tgt: 'hūs', tgtLemma: 'hūs' }));
    const withEtymon = cognateScore(
      entry({ src: 'house', lemma: 'house', tgt: 'hūs', tgtLemma: 'hūs', etymonOf: 'house' }),
    );
    assert.ok(withEtymon >= 0.7, `etymon should floor the score, got ${withEtymon}`);
    assert.ok(withEtymon > plain, 'knowing the descent must help');
  });

  test('rewards a shared suffix correspondence with a related stem', () => {
    const s = cognateScore(
      entry({ src: 'importance', lemma: 'importance', tgt: 'importancia', tgtLemma: 'importancia' }),
    );
    assert.ok(s > 0.85, `importance/importancia scored ${s}`);
  });

  test('does not treat every adverb as a cognate', () => {
    const s = cognateScore(
      entry({ src: 'quickly', lemma: 'quickly', pos: 'adv', tgt: 'rapidement', tgtLemma: 'rapidement' }),
    );
    assert.ok(s < 0.55, `quickly/rapidement scored ${s}`);
  });

  test('never exceeds 1 or falls below 0', () => {
    for (const e of [
      entry({ src: 'a', tgt: 'a' }),
      entry({ src: '', tgt: '' }),
      entry({ src: 'x', tgt: 'yyyyyyyyyy', etymonOf: 'x' }),
    ]) {
      const s = cognateScore(e);
      assert.ok(s >= 0 && s <= 1, `out of range: ${s}`);
    }
  });
});

describe('cognateReason', () => {
  test('names the etymon when there is one', () => {
    const r = cognateReason(entry({ src: 'house', tgt: 'hūs', etymonOf: 'house' }));
    assert.match(String(r), /ancestor of English/);
  });

  test('describes near-identity', () => {
    const r = cognateReason(entry({ src: 'nation', tgt: 'nación' }));
    assert.match(String(r), /near-identical|identical/);
  });

  test('returns null when there is nothing to say', () => {
    assert.equal(cognateReason(entry({ src: 'dog', tgt: 'chien' })), null);
  });
});
