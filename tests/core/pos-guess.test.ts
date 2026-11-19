import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { guessPos, sentenceOf } from '../../src/core/pos-guess.ts';
import { tokenize, wordTokens } from '../../src/core/tokenize.ts';
import type { LexEntry } from '../../src/core/types.ts';

/** Guess the part of speech of `word` inside `text`. */
function guess(text: string, word: string, opts = {}) {
  const tokens = tokenize(text);
  const hit = wordTokens(tokens).find((w) => w.token.text.toLowerCase() === word.toLowerCase());
  if (!hit) throw new Error(`"${word}" not found in ${JSON.stringify(text)}`);
  return guessPos(tokens, hit.index, opts);
}

/** The entries of every shipped pack, each keyed by the English form it weaves. */
function shippedEntries(): Array<Record<string, LexEntry[]>> {
  const dir = new URL('../../src/lexicon/packs/', import.meta.url);
  return readdirSync(dir)
    .filter((file) => file.startsWith('en-'))
    .map(
      (file) =>
        (JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as { entries: Record<string, LexEntry[]> })
          .entries,
    );
}

/** Every one-word base form a shipped pack weaves as a verb. */
function shippedBaseForms(): Set<string> {
  const bases = new Set<string>();
  for (const entries of shippedEntries()) {
    for (const rows of Object.values(entries)) {
      for (const e of rows) {
        if (e.pos === 'verb' && e.src === e.lemma && !e.src.includes(' ')) bases.add(e.src);
      }
    }
  }
  return bases;
}

/** Each of `cases` must be declined, the way the page asks. */
function assertDeclined(cases: ReadonlyArray<readonly [string, string]>): void {
  for (const [text, word] of cases) {
    assert.equal(guess(text, word, { allowPlural: true }), null, `"${word}" in "${text}"`);
  }
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

describe('after a subject pronoun', () => {
  // A verb there is finite, and a provider is asked for the infinitive and
  // woven in its place: right under a present base form, "they walk", and
  // a form no grammar has under anything else, "she went" woven as "she
  // aller".

  test('declines an irregular past tense', () => {
    for (const [text, word] of [
      ['I went home early', 'went'],
      ['we saw them leave', 'saw'],
      ['they took the train', 'took'],
      ['you knew the way', 'knew'],
      ['I ran outside', 'ran'],
      ['who came first', 'came'],
      ['we gave up', 'gave'],
      ['they thought so', 'thought'],
      ['I told nobody', 'told'],
      ['we found nothing', 'found'],
      ['they left early', 'left'],
      ['I felt nothing', 'felt'],
      ['we began again', 'began'],
      ['you wrote back', 'wrote'],
      ['they stood up', 'stood'],
      ['I sat down', 'sat'],
      ['we spoke later', 'spoke'],
      ['they lost again', 'lost'],
      ['I met nobody', 'met'],
      ['we ate later', 'ate'],
      ['they drove home', 'drove'],
      ['I fell asleep', 'fell'],
      ['we grew up', 'grew'],
      ['you threw it', 'threw'],
      ['they broke down', 'broke'],
      ['I chose this', 'chose'],
      ['we forgot again', 'forgot'],
      ['they won easily', 'won'],
      ['I bought bread', 'bought'],
      ['we built this', 'built'],
      ['they sent word', 'sent'],
      ['I slept badly', 'slept'],
      ['we sang along', 'sang'],
    ] as const) {
      assert.equal(guess(text, word, { allowPlural: true }), null, `"${word}" in "${text}"`);
    }
  });

  test('declines the past of be, have and do, and of the modals', () => {
    for (const [text, word] of [
      ['I was late', 'was'],
      ['we were late', 'were'],
      ['they had a dog', 'had'],
      ['you did well', 'did'],
      ['I could swim', 'could'],
      ['we would go', 'would'],
      ['they should know', 'should'],
      ['you might win', 'might'],
    ] as const) {
      assert.equal(guess(text, word, { allowPlural: true }), null, `"${word}" in "${text}"`);
    }
  });

  test('declines any bare word after he, she or it, where a present tense carries -s', () => {
    // "she walks", never "she walk", so a bare word there is a past no list
    // need know, a modal or an adverb, and none of them is a base form.
    for (const [text, word] of [
      ['she smote the dragon', 'smote'],
      ['he never sleeps', 'never'],
      ['she must go', 'must'],
      ['I like it very much', 'very'],
    ] as const) {
      assert.equal(guess(text, word, { allowPlural: true }), null, `"${word}" in "${text}"`);
    }
  });

  test('declines an -s word rather than reading it as a plural noun', () => {
    // There the -s is a third-person verb's, "she walks", or an adverb's,
    // "they always", and never a plural noun's.
    for (const [text, word] of [
      ['she walks home', 'walks'],
      ['he goes out', 'goes'],
      ['she does not', 'does'],
      ['who knows why', 'knows'],
      ['they always win', 'always'],
    ] as const) {
      assert.equal(guess(text, word, { allowPlural: true }), null, `"${word}" in "${text}"`);
    }
  });

  test('still takes a base form after I, you, we or they as a verb', () => {
    for (const [text, word] of [
      ['I know that', 'know'],
      ['you want more', 'want'],
      ['we water it daily', 'water'],
      ['they think so', 'think'],
    ] as const) {
      const g = guess(text, word, { allowPlural: true });
      assert.equal(g?.pos, 'verb', `"${word}" in "${text}"`);
      assert.ok((g?.confidence ?? 0) >= 0.55, `"${word}" in "${text}" is below the threshold`);
    }
  });

  test('treats every base form a shipped pack weaves the same after "they" as after "to"', () => {
    // The packs' English verbs are base forms somebody checked, so a rule
    // that declined one after "they" for a reason "to" would not, a list of
    // pasts that took in "have" or "fall", fails here by name.
    const bases = shippedBaseForms();
    assert.ok(bases.size > 60, `only ${bases.size} base forms were read from the packs`);
    for (const word of bases) {
      assert.equal(
        guess(`they ${word} it`, word) === null,
        guess(`to ${word} it`, word) === null,
        `"${word}" is declined after one and not the other`,
      );
    }
  });
});

describe('function words, and the adverbs before a verb', () => {
  // No pack weaves a function word, so on the provider path the selector's
  // part-of-speech filter never sees one: the part of speech is this
  // guesser's, and it names every word a content word's. Each case below was
  // sent at 0.55 or more, "will" asked for an infinitive and answered
  // "vouloir".

  test('declines a modal or an auxiliary', () => {
    assertDeclined([
      ['I can swim', 'can'],
      ['we will go', 'will'],
      ['they must leave', 'must'],
      ['you may sit', 'may'],
      ['we shall see', 'shall'],
      ['you ought to know', 'ought'],
      ['they cannot stay', 'cannot'],
      ['they are happy', 'are'],
      ['who has left', 'has'],
      ['what does it mean', 'does'],
    ]);
  });

  test('declines a pronoun or a determiner', () => {
    assertDeclined([
      ['with him', 'him'],
      ['for them', 'them'],
      ['from you', 'you'],
      ['some of these', 'these'],
      ['by those', 'those'],
      ['with whom', 'whom'],
      ['to everyone', 'everyone'],
      ['for ourselves', 'ourselves'],
      ['it was hers', 'hers'],
      ['each other', 'other'],
      ['it is this', 'this'],
      ['over there', 'there'],
    ]);
  });

  test('declines a preposition, a conjunction or a wh-word', () => {
    assertDeclined([
      ['it is about time', 'about'],
      ['it was but a dream', 'but'],
      ['he is from Spain', 'from'],
      ['we are with you', 'with'],
      ['the reason is because', 'because'],
      ['from under', 'under'],
      ['to and fro', 'and'],
      ['that is why', 'why'],
      ['from where', 'where'],
      ['it is not', 'not'],
    ]);
  });

  test('declines a contraction or a possessive, which has no base form to weave', () => {
    assertDeclined([
      ["I don't know", "don't"],
      ["we can't stay", "can't"],
      ["they won't come", "won't"],
      ["I didn't see", "didn't"],
      ["she's gone", "she's"],
      ["the dog's tail", "dog's"],
      ['I don’t know', 'don’t'],
    ]);
  });

  test('declines an adverb where a subject, a modal or "to" says a verb comes next', () => {
    assertDeclined([
      ['I never sleep', 'never'],
      ['we also know', 'also'],
      ['they still wait', 'still'],
      ['you just left', 'just'],
      ['we often walk', 'often'],
      ['I even tried', 'even'],
      ['we only want', 'only'],
      ['they soon left', 'soon'],
      ['I once lived', 'once'],
      ['you can never tell', 'never'],
      ['they must still go', 'still'],
      ['I would rather stay', 'rather'],
      ['you should also try', 'also'],
      ['to just leave', 'just'],
      ['to never forget', 'never'],
      ['they very much like it', 'very'],
      ['you too can', 'too'],
      // An -s adverb after a modal or "to" was read as a plural noun.
      ['you can always tell', 'always'],
      ['to sometimes win', 'sometimes'],
      ['we could perhaps go', 'perhaps'],
    ]);
  });

  test('declines no word a shipped pack weaves but for its length or an -ed or -ing ending', () => {
    // A word a pack weaves is a content word by somebody's checking, and a
    // pack that lacks it asks a service for it, so a list declined wherever
    // it stands must hold none of them: "have", "one", "here", "inside".
    // After "the" and before "yesterday" nothing else declines a word.
    let read = 0;
    for (const entries of shippedEntries()) {
      for (const word of Object.keys(entries)) {
        if (word.includes(' ')) continue;
        read++;
        const shape = word.length < 3 || /(?:ed|ing)$/.test(word);
        const g = guess(`the ${word} yesterday`, word, { allowPlural: true });
        assert.equal(g === null, shape, `"${word}" is ${g === null ? 'declined' : 'guessed'} after "the"`);
      }
    }
    assert.ok(read > 5000, `only ${read} words were read from the packs`);
  });

  test('still takes every base form a shipped pack weaves after "to", a modal and "they"', () => {
    // A list declined only where a verb comes next would pass the test
    // above, and "they" against "to" too, being declined after both.
    const bases = shippedBaseForms();
    assert.ok(bases.size > 60, `only ${bases.size} base forms were read from the packs`);
    for (const word of bases) {
      for (const text of [`to ${word} it`, `you should ${word} it`, `they ${word} it`]) {
        const g = guess(text, word, { allowPlural: true });
        if (word.length < 3 || /(?:ed|ing)$/.test(word)) {
          assert.equal(g, null, `"${word}" in "${text}"`);
        } else {
          assert.ok(g && g.confidence >= 0.55, `"${word}" in "${text}" is declined`);
        }
      }
    }
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
