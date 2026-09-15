import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenize,
  wordTokens,
  sentenceWordCounts,
  matchCase,
  casePatternOf,
  looksLikeJunk,
} from '../../src/core/tokenize.ts';

describe('tokenize offsets', () => {
  test('every token slice matches the source exactly', () => {
    const inputs = [
      'The cat sat on the mat.',
      "Don't touch O'Brien's well-known café — it's naïve.",
      'Multi  spaced\n\nparagraph two.',
      '¿Dónde está el año 2026? 3.14 is π.',
      'Ĥeĺlo þēod ƿīf ȝif ſome æsc.',
      'emoji 🎉 and CJK 漢字 mixed',
    ];
    for (const input of inputs) {
      const tokens = tokenize(input);
      let reconstructed = '';
      for (const t of tokens) {
        assert.equal(
          input.slice(t.start, t.end),
          t.text,
          `offset mismatch for ${JSON.stringify(t.text)} in ${JSON.stringify(input)}`,
        );
        reconstructed += t.text;
      }
      assert.equal(reconstructed, input, 'tokens must cover the input with no gaps');
    }
  });

  test('offsets are strictly increasing and contiguous', () => {
    const tokens = tokenize('Alpha beta; gamma.');
    let cursor = 0;
    for (const t of tokens) {
      assert.equal(t.start, cursor);
      assert.ok(t.end > t.start);
      cursor = t.end;
    }
  });
});

describe('word boundaries', () => {
  test('keeps internal apostrophes inside one word', () => {
    const words = wordTokens(tokenize("don't can't it's")).map((w) => w.token.text);
    assert.deepEqual(words, ["don't", "can't", "it's"]);
  });

  test('keeps curly apostrophes too', () => {
    const words = wordTokens(tokenize('don’t')).map((w) => w.token.text);
    assert.deepEqual(words, ['don’t']);
  });

  test('keeps hyphenated compounds whole so half of one is never swapped', () => {
    const words = wordTokens(tokenize('a well-known short-lived thing')).map((w) => w.token.text);
    assert.deepEqual(words, ['a', 'well-known', 'short-lived', 'thing']);
  });

  test('treats accented and non-Latin letters as letters', () => {
    const words = wordTokens(tokenize('café naïve þēod Ἑλληνική')).map((w) => w.token.text);
    assert.deepEqual(words, ['café', 'naïve', 'þēod', 'Ἑλληνική']);
  });

  test('separates digits from words', () => {
    const tokens = tokenize('year 2026 and 3.14');
    const digits = tokens.filter((t) => t.kind === 'digit').map((t) => t.text);
    assert.deepEqual(digits, ['2026', '3.14']);
  });
});

describe('sentence segmentation', () => {
  test('splits on terminal punctuation', () => {
    const tokens = tokenize('One two. Three four! Five?');
    const counts = sentenceWordCounts(tokens);
    assert.deepEqual(counts.filter((c) => c > 0), [2, 2, 1]);
  });

  test('does not split on abbreviations', () => {
    const tokens = tokenize('Dr. Smith met Mrs. Jones on Tue. evening and left.');
    const sentences = new Set(tokens.filter((t) => t.kind === 'word').map((t) => t.sentence));
    assert.equal(sentences.size, 1, 'abbreviations must not end the sentence');
  });

  test('does not split on initials', () => {
    const tokens = tokenize('J. R. R. Tolkien wrote books.');
    const sentences = new Set(tokens.filter((t) => t.kind === 'word').map((t) => t.sentence));
    assert.equal(sentences.size, 1);
  });

  test('treats a blank line as a break', () => {
    const tokens = tokenize('First line\n\nSecond line');
    const sentences = new Set(tokens.filter((t) => t.kind === 'word').map((t) => t.sentence));
    assert.equal(sentences.size, 2);
  });

  test('keeps a closing quote with the sentence it ends', () => {
    const tokens = tokenize('He said "stop." Then he left.');
    const sentences = new Set(tokens.filter((t) => t.kind === 'word').map((t) => t.sentence));
    assert.equal(sentences.size, 2);
  });
});

describe('case handling', () => {
  test('classifies case patterns', () => {
    assert.equal(casePatternOf('word'), 'lower');
    assert.equal(casePatternOf('Word'), 'title');
    assert.equal(casePatternOf('WORD'), 'upper');
    assert.equal(casePatternOf('wORD'), 'mixed');
    assert.equal(casePatternOf('I'), 'title');
  });

  test('carries the original casing onto the replacement', () => {
    assert.equal(matchCase('chat', 'cat'), 'chat');
    assert.equal(matchCase('chat', 'Cat'), 'Chat');
    assert.equal(matchCase('chat', 'CAT'), 'CHAT');
  });

  test('handles target words whose first letter uppercases to two chars', () => {
    // German ß uppercases to SS; must not corrupt the rest of the word.
    assert.equal(matchCase('straße', 'Street'), 'Straße');
  });

  test('preserves diacritics when title-casing', () => {
    assert.equal(matchCase('église', 'Church'), 'Église');
  });
});

describe('looksLikeJunk', () => {
  const junkOf = (text: string) => {
    const tokens = tokenize(text);
    const words = wordTokens(tokens);
    return words.map((w) => ({ text: w.token.text, junk: looksLikeJunk(w.token, tokens, w.index) }));
  };

  test('rejects handles and hashtags', () => {
    const got = junkOf('hello @alice and #topic here');
    assert.equal(got.find((g) => g.text === 'alice')?.junk, true);
    assert.equal(got.find((g) => g.text === 'topic')?.junk, true);
    assert.equal(got.find((g) => g.text === 'hello')?.junk, false);
  });

  test('rejects all-caps acronyms', () => {
    assert.equal(junkOf('the NASA mission')[1]?.junk, true);
  });

  test('rejects camelCase identifiers', () => {
    const got = junkOf('call getUserName now');
    assert.equal(got.find((g) => g.text === 'getUserName')?.junk, true);
    assert.equal(got.find((g) => g.text === 'call')?.junk, false);
  });

  test('rejects both halves of a snake_case identifier', () => {
    const got = junkOf('use user_name here');
    assert.equal(got.find((g) => g.text === 'user')?.junk, true);
    assert.equal(got.find((g) => g.text === 'name')?.junk, true);
    assert.equal(got.find((g) => g.text === 'here')?.junk, false);
  });

  test('does not reject an ordinary sentence-final word', () => {
    const got = junkOf('the cat sat down.');
    assert.equal(got.find((g) => g.text === 'down')?.junk, false);
  });

  test('rejects both halves of a path or URL fragment', () => {
    const got = junkOf('see docs/guide now');
    assert.equal(got.find((g) => g.text === 'docs')?.junk, true);
    assert.equal(got.find((g) => g.text === 'guide')?.junk, true);
  });

  test('rejects single letters', () => {
    assert.equal(junkOf('a cat')[0]?.junk, true);
  });

  test('rejects domain-like fragments', () => {
    const got = junkOf('visit example.com today');
    assert.equal(got.find((g) => g.text === 'com')?.junk, true);
  });

  test('accepts ordinary words', () => {
    for (const g of junkOf('the quick brown fox jumped over lazy dogs')) {
      if (g.text.length > 1) assert.equal(g.junk, false, `${g.text} wrongly rejected`);
    }
  });
});

describe('robustness', () => {
  test('handles empty and whitespace-only input', () => {
    assert.deepEqual(tokenize(''), []);
    assert.equal(tokenize('   ').length, 1);
  });

  test('respects maxTokens', () => {
    const tokens = tokenize('a '.repeat(5000), { maxTokens: 100 });
    assert.equal(tokens.length, 100);
  });

  test('does not hang on pathological punctuation', () => {
    const tokens = tokenize('!'.repeat(2000));
    assert.equal(tokens.length, 2000);
  });
});
