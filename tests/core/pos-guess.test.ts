import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { guessPos, sentenceOf } from '../../src/core/pos-guess.ts';
import { tokenize, wordTokens } from '../../src/core/tokenize.ts';

/** Guess the part of speech of `word` inside `text`. */
function guess(text: string, word: string, opts = {}) {
  const tokens = tokenize(text);
  const hit = wordTokens(tokens).find((w) => w.token.text.toLowerCase() === word.toLowerCase());
  if (!hit) throw new Error(`"${word}" not found in ${JSON.stringify(text)}`);
  return guessPos(tokens, hit.index, opts);
}

describe('contextual cues', () => {
  test('"to" marks an infinitive', () => {
    assert.equal(guess('I want to book a table', 'book')?.pos, 'verb');
  });

  test('a determiner plus a phrase closer marks a noun', () => {
    assert.equal(guess('I read the book yesterday', 'book')?.pos, 'noun');
    assert.equal(guess('I read the book yesterday', 'book')?.num, 'sg');
    assert.ok((guess('I read the book yesterday', 'book')?.confidence ?? 0) > 0.7);
  });

  test('declines when a determiner is followed by two bare words', () => {
    // Nothing local distinguishes the attributive adjective in "the quick
    // brown fox" from the noun modifier in "the stone bridge", so the
    // guesser reports low confidence and the caller declines rather than
    // sending a wrong part of speech for translation.
    const g = guess('the stone bridge fell', 'stone');
    assert.ok(g);
    assert.ok(g.confidence < 0.55, `expected low confidence, got ${g.confidence}`);
  });

  test('a modal marks a verb', () => {
    assert.equal(guess('You should water the plants', 'water')?.pos, 'verb');
  });

  test('a subject pronoun marks a verb', () => {
    assert.equal(guess('They water it daily', 'water')?.pos, 'verb');
  });

  test('a copula marks an adjective', () => {
    assert.equal(guess('The room was warm', 'warm')?.pos, 'adj');
  });

  test('an intensifier marks an adjective', () => {
    assert.equal(guess('It felt very warm', 'warm')?.pos, 'adj');
  });

  test('a preposition marks a noun', () => {
    assert.equal(guess('made of stone and iron', 'stone')?.pos, 'noun');
  });

  test('an adjectival suffix wins over a weak contextual cue', () => {
    // "lordship" is a noun whatever precedes it: reliable morphology is
    // checked before the contextual rules, which are guesses about English
    // structure made without a parser.
    assert.equal(guess('under his lordship then', 'lordship')?.pos, 'noun');
    assert.equal(guess('the dangerous plan failed', 'dangerous')?.pos, 'adj');
  });
});

describe('morphology', () => {
  test('-ly is an adverb', () => {
    assert.equal(guess('He walked slowly along', 'slowly')?.pos, 'adv');
  });

  test('nominal suffixes are nouns', () => {
    for (const [text, word] of [
      ['great kindness matters', 'kindness'],
      ['about information flow', 'information'],
      ['under his lordship then', 'lordship'],
    ] as const) {
      assert.equal(guess(text, word)?.pos, 'noun', word);
    }
  });

  test('adjectival suffixes are adjectives', () => {
    for (const [text, word] of [
      ['a dangerous plan', 'dangerous'],
      ['felt hopeful about it', 'hopeful'],
      ['seemed childish then', 'childish'],
    ] as const) {
      assert.equal(guess(text, word)?.pos, 'adj', word);
    }
  });
});

describe('declining to guess', () => {
  test('declines on -ed and -ing forms', () => {
    // Only base forms are ever woven, so an inflected form must not be sent
    // for translation: there is nothing grammatical to put in its place.
    assert.equal(guess('They walked home quietly', 'walked'), null);
    assert.equal(guess('She is walking home', 'walking'), null);
  });

  test('declines on plurals unless the caller allows them', () => {
    assert.equal(guess('the books were heavy', 'books'), null);
    const allowed = guess('the books were heavy', 'books', { allowPlural: true });
    assert.equal(allowed?.pos, 'noun');
    assert.equal(allowed?.num, 'pl');
  });

  test('does not treat -ss or -us endings as plural', () => {
    assert.ok(guess('across the glass table', 'glass'));
    assert.ok(guess('about the campus today', 'campus'));
  });

  test('declines on very short words', () => {
    assert.equal(guess('go to it now', 'go'), null);
  });

  test('gives a low confidence when nothing is decisive', () => {
    const g = guess('Weft rewrites pages', 'rewrites', { allowPlural: true });
    // "rewrites" looks plural by suffix; confidence must stay low enough that
    // the caller declines.
    assert.ok(!g || g.confidence <= 0.6);
  });
});

describe('sentenceOf', () => {
  test('returns only the sentence containing the token', () => {
    const text = 'First sentence here. Second sentence has the word cat in it.';
    const tokens = tokenize(text);
    const hit = wordTokens(tokens).find((w) => w.token.text === 'cat');
    assert.ok(hit);
    const sentence = sentenceOf(tokens, hit.index);
    assert.match(sentence, /Second sentence/);
    assert.ok(!sentence.includes('First sentence'));
  });

  test('is capped in length', () => {
    const long = `${'word '.repeat(200)}cat.`;
    const tokens = tokenize(long);
    const hit = wordTokens(tokens).find((w) => w.token.text === 'cat');
    assert.ok(hit);
    assert.ok(sentenceOf(tokens, hit.index, 100).length <= 105);
  });
});
