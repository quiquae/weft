import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { applyLetterforms, letterformsFor, orthographyCost } from '../../src/core/letterforms.ts';

const ALL_OFF = {
  macrons: false, thorn: false, eth: false, ash: false, wynn: false, yogh: false, longS: false,
};
const ALL_ON = {
  macrons: true, thorn: true, eth: true, ash: true, wynn: true, yogh: true, longS: true,
};

describe('applyLetterforms', () => {
  test('leaves modern languages entirely alone', () => {
    assert.equal(applyLetterforms('fenêtre', 'fr', ALL_OFF), 'fenêtre');
    assert.equal(applyLetterforms('Mädchen', 'de', ALL_OFF), 'Mädchen');
  });

  test('strips macrons from Latin when the toggle is off', () => {
    assert.equal(applyLetterforms('rēx', 'la', ALL_OFF), 'rex');
    assert.equal(applyLetterforms('rēx', 'la', ALL_ON), 'rēx');
  });

  test('simplifies Old English letterforms when toggles are off', () => {
    assert.equal(applyLetterforms('þēod', 'ang', ALL_OFF), 'theod');
    assert.equal(applyLetterforms('brōðor', 'ang', ALL_OFF), 'brothor');
    assert.equal(applyLetterforms('wæter', 'ang', ALL_OFF), 'waeter');
    assert.equal(applyLetterforms('ƿīf', 'ang', ALL_OFF), 'wif');
  });

  test('keeps Old English letterforms when toggles are on', () => {
    assert.equal(applyLetterforms('þēod', 'ang', ALL_ON), 'þēod');
  });

  test('preserves capitals through the transform', () => {
    assert.equal(applyLetterforms('Þēod', 'ang', ALL_OFF), 'Theod');
    assert.equal(applyLetterforms('Æsc', 'ang', ALL_OFF), 'Aesc');
  });

  test('resolves yogh by position for Middle English', () => {
    assert.equal(applyLetterforms('ȝif', 'enm', ALL_OFF), 'yif');
    assert.equal(applyLetterforms('niȝt', 'enm', ALL_OFF), 'night');
  });

  test('replaces long s', () => {
    assert.equal(applyLetterforms('ſome', 'enm', ALL_OFF), 'some');
  });

  test('only applies the transforms a language declares', () => {
    // Latin declares macrons only, so a stray thorn is left untouched.
    assert.equal(applyLetterforms('þrex', 'la', ALL_OFF), 'þrex');
  });
});

describe('letterformsFor', () => {
  test('lists the toggles a language supports', () => {
    assert.deepEqual(letterformsFor('la'), ['macrons']);
    assert.ok(letterformsFor('ang').includes('thorn'));
    assert.deepEqual(letterformsFor('fr'), []);
  });
});

describe('orthographyCost', () => {
  test('is near zero for Latin script and high for Greek', () => {
    assert.ok(orthographyCost('fr', ALL_OFF) < 0.1);
    assert.ok(orthographyCost('grc', ALL_OFF) > 0.8);
  });

  test('rises as more letterforms are kept', () => {
    assert.ok(orthographyCost('ang', ALL_ON) > orthographyCost('ang', ALL_OFF));
  });

  test('never exceeds 1', () => {
    assert.ok(orthographyCost('grc', ALL_ON) <= 1);
  });
});
