import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuiz,
  pickQuizCards,
  distractorsFor,
  normalizeAnswer,
  gradeAnswer,
  quizScore,
  quizPassed,
  type QuizQuestion,
} from '../../src/core/quiz.ts';
import { mulberry32 } from '../../src/core/rand.ts';
import { card, entry, NOW } from '../helpers.ts';
import type { LexEntry } from '../../src/core/types.ts';

const POOL: LexEntry[] = [
  entry({ src: 'cat', lemma: 'cat', pos: 'noun', tgt: 'chat', tgtLemma: 'chat', band: 1 }),
  entry({ src: 'dog', lemma: 'dog', pos: 'noun', tgt: 'chien', tgtLemma: 'chien', band: 1 }),
  entry({ src: 'house', lemma: 'house', pos: 'noun', tgt: 'maison', tgtLemma: 'maison', band: 1 }),
  entry({ src: 'water', lemma: 'water', pos: 'noun', tgt: 'eau', tgtLemma: 'eau', band: 1 }),
  entry({ src: 'book', lemma: 'book', pos: 'noun', tgt: 'livre', tgtLemma: 'livre', band: 1 }),
  entry({ src: 'tree', lemma: 'tree', pos: 'noun', tgt: 'arbre', tgtLemma: 'arbre', band: 1 }),
  entry({ src: 'quick', lemma: 'quick', pos: 'adj', tgt: 'rapide', tgtLemma: 'rapide', band: 1 }),
  entry({ src: 'green', lemma: 'green', pos: 'adj', tgt: 'vert', tgtLemma: 'vert', band: 1 }),
];

const byLemma = new Map(POOL.map((e) => [e.tgtLemma, e]));

const seenCards = ['chat', 'chien', 'maison', 'eau', 'livre', 'arbre'].map((lemma, i) =>
  card({ lemma, exposures: 3 + i, reps: 1, stability: 2, lastReview: NOW - 86_400_000 }),
);

describe('pickQuizCards', () => {
  test('only draws from words that have actually been shown', () => {
    const unseen = card({ lemma: 'never', exposures: 0 });
    const picked = pickQuizCards([...seenCards, unseen], 10, mulberry32(1));
    assert.ok(!picked.some((c) => c.lemma === 'never'));
  });

  test('skips retired words', () => {
    const retired = card({ lemma: 'done', exposures: 50, retiredAt: NOW });
    const picked = pickQuizCards([...seenCards, retired], 10, mulberry32(1));
    assert.ok(!picked.some((c) => c.lemma === 'done'));
  });

  test('returns nothing when nothing is eligible', () => {
    assert.deepEqual(pickQuizCards([card({ exposures: 0 })], 5, mulberry32(1)), []);
  });

  test('respects the requested count', () => {
    assert.equal(pickQuizCards(seenCards, 3, mulberry32(1)).length, 3);
  });
});

describe('distractorsFor', () => {
  test('prefers the same part of speech and a nearby band', () => {
    const target = POOL[0] as LexEntry;
    const options = distractorsFor(target, POOL, 3, mulberry32(7), 'target');
    assert.equal(options.length, 3);
    assert.ok(!options.includes('chat'), 'must not include the answer');
    for (const o of options) {
      const found = POOL.find((e) => e.tgt === o);
      assert.equal(found?.pos, 'noun');
    }
  });

  test('falls back to a looser pool rather than returning too few', () => {
    const lonely = entry({ src: 'x', pos: 'intj', tgt: 'oh', tgtLemma: 'oh', band: 6 });
    const options = distractorsFor(lonely, POOL, 3, mulberry32(3), 'target');
    assert.equal(options.length, 3);
  });

  test('never duplicates', () => {
    const options = distractorsFor(POOL[0] as LexEntry, POOL, 3, mulberry32(11), 'source');
    assert.equal(new Set(options).size, options.length);
  });

  test('never offers the other word of a spelling as a wrong answer', () => {
    // Old English hund is a dog and a hundred, and the seed writes the second
    // hund². Both questions show the learner "hund", so offering "dog" as a
    // wrong answer to it is offering a right one.
    const dog = entry({ src: 'dog', lemma: 'dog', pos: 'noun', tgt: 'hund', tgtLemma: 'hund', band: 1 });
    const hundred = entry({ src: 'hundred', lemma: 'hundred', pos: 'noun', tgt: 'hund', tgtLemma: 'hund²', band: 1 });
    const cat = entry({ src: 'cat', lemma: 'cat', pos: 'noun', tgt: 'catt', tgtLemma: 'catt', band: 1 });
    const house = entry({ src: 'house', lemma: 'house', pos: 'noun', tgt: 'hūs', tgtLemma: 'hūs', band: 1 });
    const pool = [dog, hundred, cat, house];

    for (const seed of [1, 2, 3, 4, 5]) {
      assert.ok(!distractorsFor(hundred, pool, 3, mulberry32(seed), 'source').includes('dog'), `seed ${seed} offered dog for hund²`);
      assert.ok(!distractorsFor(dog, pool, 3, mulberry32(seed), 'source').includes('hundred'), `seed ${seed} offered hundred for hund`);
    }
  });
});

describe('buildQuiz', () => {
  const quiz = buildQuiz({
    cards: seenCards,
    entriesByLemma: byLemma,
    pool: POOL,
    target: 'fr',
    source: 'en',
    count: 6,
    seed: 42,
    includeTyping: true,
  });

  test('produces the requested number of questions', () => {
    assert.equal(quiz.length, 6);
  });

  test('every multiple-choice question contains its own answer exactly once', () => {
    for (const q of quiz) {
      if (!q.options) continue;
      const matches = q.options.filter((o) => o === q.answer);
      assert.equal(matches.length, 1, `answer appears ${matches.length} times in ${q.id}`);
      assert.equal(q.options.length, 4, 'four options, so guessing is 25%');
    }
  });

  test('is deterministic for a given seed', () => {
    const again = buildQuiz({
      cards: seenCards, entriesByLemma: byLemma, pool: POOL,
      target: 'fr', source: 'en', count: 6, seed: 42, includeTyping: true,
    });
    assert.deepEqual(again.map((q) => `${q.kind}:${q.prompt}:${q.answer}`), quiz.map((q) => `${q.kind}:${q.prompt}:${q.answer}`));
  });

  test('mixes recognition and production', () => {
    const kinds = new Set(quiz.map((q) => q.kind));
    assert.ok(kinds.size >= 2, `only got ${[...kinds]}`);
  });

  test('typing questions carry a hint and no options', () => {
    for (const q of quiz.filter((x) => x.kind === 'type-it')) {
      assert.equal(q.options, undefined);
      assert.match(String(q.hint), /letters/);
    }
  });

  test('omits typing questions when not requested', () => {
    const q = buildQuiz({
      cards: seenCards, entriesByLemma: byLemma, pool: POOL,
      target: 'fr', source: 'en', count: 6, seed: 42, includeTyping: false,
    });
    assert.equal(q.filter((x) => x.kind === 'type-it').length, 0);
  });

  test('skips cards with no matching pack entry instead of crashing', () => {
    const orphan = card({ lemma: 'ghost', exposures: 5, reps: 1 });
    const q = buildQuiz({
      cards: [orphan], entriesByLemma: byLemma, pool: POOL,
      target: 'fr', source: 'en', count: 5, seed: 1,
    });
    assert.deepEqual(q, []);
  });
});

describe('normalizeAnswer', () => {
  test('forgives accents, case and punctuation', () => {
    assert.equal(normalizeAnswer('  Fatigué! '), normalizeAnswer('fatigue'));
  });

  test('forgives a leading article', () => {
    assert.equal(normalizeAnswer('le chat'), normalizeAnswer('chat'));
    assert.equal(normalizeAnswer('el perro'), normalizeAnswer('perro'));
    assert.equal(normalizeAnswer('das Haus'), normalizeAnswer('haus'));
  });

  test('forgives Old English letterform choices', () => {
    assert.equal(normalizeAnswer('þēod'), normalizeAnswer('theod'));
  });

  test('does not reduce a one-word answer to nothing', () => {
    assert.ok(normalizeAnswer('la').length > 0, 'an answer that is only an article must survive');
  });
});

const typed = (answer: string): QuizQuestion => ({
  id: 'q', kind: 'type-it', prompt: 'x', promptLang: 'en',
  answer, answerLang: 'fr', lemma: answer, pos: 'noun',
});

describe('gradeAnswer', () => {
  test('accepts an exact answer', () => {
    assert.equal(gradeAnswer(typed('maison'), 'maison'), true);
  });

  test('accepts a missing accent', () => {
    assert.equal(gradeAnswer(typed('fatigué'), 'fatigue'), true);
  });

  test('accepts a single-character typo on a longer word', () => {
    assert.equal(gradeAnswer(typed('montagne'), 'montaigne'), true);
    assert.equal(gradeAnswer(typed('montagne'), 'montagn'), true);
  });

  test('rejects a genuinely wrong answer', () => {
    assert.equal(gradeAnswer(typed('maison'), 'chien'), false);
  });

  test('is strict on short words where one letter is the whole word', () => {
    assert.equal(gradeAnswer(typed('eau'), 'oeu'), false);
    assert.equal(gradeAnswer(typed('roi'), 'rue'), false);
  });

  test('rejects an empty answer', () => {
    assert.equal(gradeAnswer(typed('maison'), ''), false);
    assert.equal(gradeAnswer(typed('maison'), '   '), false);
  });

  test('multiple choice is compared exactly after normalisation', () => {
    const mc: QuizQuestion = {
      id: 'q', kind: 'target-to-source', prompt: 'chat', promptLang: 'fr',
      answer: 'cat', answerLang: 'en', options: ['cat', 'dog', 'house', 'water'],
      lemma: 'chat', pos: 'noun',
    };
    assert.equal(gradeAnswer(mc, 'cat'), true);
    assert.equal(gradeAnswer(mc, 'Cat'), true);
    assert.equal(gradeAnswer(mc, 'dog'), false);
  });
});

describe('scoring', () => {
  const results = (correct: number, total: number) =>
    Array.from({ length: total }, (_, i) => ({
      questionId: `q${i}`, lemma: 'x', correct: i < correct, given: '',
    }));

  test('score is the fraction correct', () => {
    assert.equal(quizScore(results(3, 4)), 0.75);
    assert.equal(quizScore([]), 0);
  });

  test('passing needs the threshold to be met, not merely approached', () => {
    assert.equal(quizPassed(results(3, 4), 0.75), true);
    assert.equal(quizPassed(results(2, 4), 0.75), false);
  });

  test('an empty quiz never passes', () => {
    assert.equal(quizPassed([], 0), false, 'a zero-question quiz must not be a free unlock');
  });
});
