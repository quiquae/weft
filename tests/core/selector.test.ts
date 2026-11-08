import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { selectSwaps, bandWindow, idealZipf, effectiveLevel, entryAllowed, topBandOf } from '../../src/core/selector.ts';
import type { SelectorInput } from '../../src/core/selector.ts';
import { tokenize } from '../../src/core/tokenize.ts';
import { settings, entry, lookupFrom, card, cardMap, NOW } from '../helpers.ts';
import type { LexEntry } from '../../src/core/types.ts';

const TEXT =
  'The quick brown fox jumped over the lazy dog while the tired cat watched ' +
  'from a warm window in the old house. Water flowed under the stone bridge ' +
  'and the young king rode his black horse through the green field toward ' +
  'the distant mountain where the wise woman kept her heavy book of names.';

const PACK: LexEntry[] = [
  entry({ src: 'quick', lemma: 'quick', pos: 'adj', tgt: 'rapide', tgtLemma: 'rapide', zipf: 4.8, band: 1 }),
  entry({ src: 'brown', lemma: 'brown', pos: 'adj', tgt: 'brun', tgtLemma: 'brun', zipf: 4.4, band: 1 }),
  entry({ src: 'fox', lemma: 'fox', pos: 'noun', tgt: 'renard', tgtLemma: 'renard', zipf: 3.9, band: 2 }),
  entry({ src: 'dog', lemma: 'dog', pos: 'noun', tgt: 'chien', tgtLemma: 'chien', zipf: 5.1, band: 1 }),
  entry({ src: 'cat', lemma: 'cat', pos: 'noun', tgt: 'chat', tgtLemma: 'chat', zipf: 5.0, band: 1 }),
  entry({ src: 'lazy', lemma: 'lazy', pos: 'adj', tgt: 'paresseux', tgtLemma: 'paresseux', zipf: 4.0, band: 2 }),
  entry({ src: 'tired', lemma: 'tired', pos: 'adj', tgt: 'fatigué', tgtLemma: 'fatigué', zipf: 4.3, band: 1 }),
  entry({ src: 'warm', lemma: 'warm', pos: 'adj', tgt: 'chaud', tgtLemma: 'chaud', zipf: 4.5, band: 1 }),
  entry({ src: 'window', lemma: 'window', pos: 'noun', tgt: 'fenêtre', tgtLemma: 'fenêtre', zipf: 4.6, band: 1 }),
  entry({ src: 'old', lemma: 'old', pos: 'adj', tgt: 'vieux', tgtLemma: 'vieux', zipf: 5.4, band: 1 }),
  entry({ src: 'house', lemma: 'house', pos: 'noun', tgt: 'maison', tgtLemma: 'maison', zipf: 5.3, band: 1 }),
  entry({ src: 'water', lemma: 'water', pos: 'noun', tgt: 'eau', tgtLemma: 'eau', zipf: 5.2, band: 1 }),
  entry({ src: 'stone', lemma: 'stone', pos: 'noun', tgt: 'pierre', tgtLemma: 'pierre', zipf: 4.4, band: 2 }),
  entry({ src: 'bridge', lemma: 'bridge', pos: 'noun', tgt: 'pont', tgtLemma: 'pont', zipf: 4.3, band: 2 }),
  entry({ src: 'young', lemma: 'young', pos: 'adj', tgt: 'jeune', tgtLemma: 'jeune', zipf: 5.0, band: 1 }),
  entry({ src: 'king', lemma: 'king', pos: 'noun', tgt: 'roi', tgtLemma: 'roi', zipf: 4.7, band: 1 }),
  entry({ src: 'black', lemma: 'black', pos: 'adj', tgt: 'noir', tgtLemma: 'noir', zipf: 5.1, band: 1 }),
  entry({ src: 'horse', lemma: 'horse', pos: 'noun', tgt: 'cheval', tgtLemma: 'cheval', zipf: 4.6, band: 1 }),
  entry({ src: 'green', lemma: 'green', pos: 'adj', tgt: 'vert', tgtLemma: 'vert', zipf: 4.9, band: 1 }),
  entry({ src: 'field', lemma: 'field', pos: 'noun', tgt: 'champ', tgtLemma: 'champ', zipf: 4.8, band: 2 }),
  entry({ src: 'distant', lemma: 'distant', pos: 'adj', tgt: 'lointain', tgtLemma: 'lointain', zipf: 3.8, band: 2 }),
  entry({ src: 'mountain', lemma: 'mountain', pos: 'noun', tgt: 'montagne', tgtLemma: 'montagne', zipf: 4.4, band: 2 }),
  entry({ src: 'wise', lemma: 'wise', pos: 'adj', tgt: 'sage', tgtLemma: 'sage', zipf: 4.0, band: 2 }),
  entry({ src: 'woman', lemma: 'woman', pos: 'noun', tgt: 'femme', tgtLemma: 'femme', zipf: 5.2, band: 1 }),
  entry({ src: 'heavy', lemma: 'heavy', pos: 'adj', tgt: 'lourd', tgtLemma: 'lourd', zipf: 4.5, band: 1 }),
  entry({ src: 'book', lemma: 'book', pos: 'noun', tgt: 'livre', tgtLemma: 'livre', zipf: 5.2, band: 1 }),
  entry({ src: 'names', lemma: 'name', pos: 'noun', tgt: 'noms', tgtLemma: 'nom', zipf: 5.0, band: 1, num: 'pl' }),
  // Function words: present in the pack but excluded by default POS preference.
  entry({ src: 'the', lemma: 'the', pos: 'det', tgt: 'le', tgtLemma: 'le', zipf: 7.0, band: 1 }),
  entry({ src: 'over', lemma: 'over', pos: 'prep', tgt: 'sur', tgtLemma: 'sur', zipf: 5.5, band: 1 }),
  entry({ src: 'and', lemma: 'and', pos: 'conj', tgt: 'et', tgtLemma: 'et', zipf: 6.9, band: 1 }),
];

function baseInput(over: Partial<SelectorInput> = {}): SelectorInput {
  return {
    tokens: tokenize(TEXT),
    lookup: lookupFrom(PACK),
    cards: new Map(),
    now: NOW,
    target: 'fr',
    ratio: 0.5,
    settings: settings({ 'learning.introduceNewPerDay': 500 }),
    effectiveLevel: 1,
    topBand: 6,
    introducedToday: new Set<string>(),
    pageLemmaCounts: new Map(),
    seed: 12345,
    ...over,
  };
}

const originals = (r: ReturnType<typeof selectSwaps>) => r.swaps.map((s) => s.original.toLowerCase());

describe('prefix monotonicity', () => {
  test('raising the ratio only ever adds swaps, never removes them', () => {
    // This is the property that makes attention-linked escalation usable: a
    // word you have just decoded must not flip back to English as the page
    // gets harder around it.
    let previous = new Set<string>();
    for (const ratio of [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.65, 0.8, 0.95, 1]) {
      const result = selectSwaps(baseInput({ ratio }));
      const current = new Set(result.swaps.map((s) => `${s.start}:${s.original}`));
      for (const prev of previous) {
        assert.ok(current.has(prev), `ratio ${ratio} dropped swap ${prev}`);
      }
      previous = current;
    }
  });

  test('swap count is non-decreasing in ratio', () => {
    let last = -1;
    for (let r = 0; r <= 1.0001; r += 0.05) {
      const n = selectSwaps(baseInput({ ratio: r })).swaps.length;
      assert.ok(n >= last, `count fell from ${last} to ${n} at ratio ${r}`);
      last = n;
    }
  });
});

describe('determinism', () => {
  test('the same input yields byte-identical swaps', () => {
    const a = selectSwaps(baseInput());
    const b = selectSwaps(baseInput());
    assert.deepEqual(originals(a), originals(b));
  });

  test('a different seed can choose differently but stays valid', () => {
    const a = selectSwaps(baseInput({ seed: 1 }));
    const b = selectSwaps(baseInput({ seed: 999 }));
    assert.equal(a.eligible, b.eligible);
    for (const r of [a, b]) {
      for (const s of r.swaps) assert.ok(s.replacement.length > 0);
    }
  });

  test('falls back to hashing the text when no seed is given', () => {
    const input = baseInput();
    delete (input as { seed?: number }).seed;
    const a = selectSwaps(input);
    const b = selectSwaps({ ...input });
    assert.deepEqual(originals(a), originals(b));
  });
});

describe('constraints', () => {
  test('never swaps two adjacent words', () => {
    const tokens = tokenize(TEXT);
    const result = selectSwaps(baseInput({ ratio: 1, tokens }));
    const wordIndex = new Map<number, number>();
    let w = 0;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i]?.kind === 'word') wordIndex.set(i, w++);
    }
    const taken = result.swaps
      .map((s) => wordIndex.get(s.tokenIndex))
      .filter((n): n is number => n !== undefined)
      .sort((a, b) => a - b);
    for (let i = 1; i < taken.length; i++) {
      const gap = (taken[i] as number) - (taken[i - 1] as number);
      assert.ok(gap >= 3, `words ${taken[i - 1]} and ${taken[i]} only ${gap} apart (minWordGap 2)`);
    }
  });

  test('respects maxPerSentence', () => {
    const tokens = tokenize(TEXT);
    const result = selectSwaps(
      baseInput({ ratio: 1, tokens, settings: settings({ 'weave.maxPerSentence': 2, 'learning.introduceNewPerDay': 500 }) }),
    );
    const perSentence = new Map<number, number>();
    for (const s of result.swaps) {
      const sentence = tokens[s.tokenIndex]?.sentence ?? -1;
      perSentence.set(sentence, (perSentence.get(sentence) ?? 0) + 1);
    }
    for (const [sentence, n] of perSentence) {
      assert.ok(n <= 2, `sentence ${sentence} had ${n} swaps`);
    }
  });

  test('leaves short sentences alone', () => {
    const short = 'The cat sat. Water flowed under the stone bridge and the young king rode.';
    const result = selectSwaps(
      baseInput({
        tokens: tokenize(short),
        ratio: 1,
        settings: settings({ 'weave.protectShortSentences': 5, 'learning.introduceNewPerDay': 500 }),
      }),
    );
    assert.ok(!originals(result).includes('cat'), 'three-word sentence must be protected');
  });

  test('ratio 0 produces nothing', () => {
    assert.equal(selectSwaps(baseInput({ ratio: 0 })).swaps.length, 0);
  });

  test('offsets always match the tokens they came from', () => {
    const tokens = tokenize(TEXT);
    const result = selectSwaps(baseInput({ ratio: 1, tokens }));
    assert.ok(result.swaps.length > 0);
    for (const s of result.swaps) {
      assert.equal(TEXT.slice(s.start, s.end), s.original);
    }
  });

  test('swaps are returned in document order', () => {
    const result = selectSwaps(baseInput({ ratio: 1 }));
    for (let i = 1; i < result.swaps.length; i++) {
      assert.ok((result.swaps[i]?.start ?? 0) > (result.swaps[i - 1]?.start ?? 0));
    }
  });
});

describe('filtering', () => {
  test('never weaves function words with the default POS preference', () => {
    const result = selectSwaps(baseInput({ ratio: 1 }));
    for (const word of originals(result)) {
      assert.ok(!['the', 'over', 'and'].includes(word), `function word "${word}" was woven`);
    }
  });

  test('honours the confidence threshold', () => {
    const lowConf = PACK.map((e) => ({ ...e, conf: 0.4 }));
    const result = selectSwaps(baseInput({ ratio: 1, lookup: lookupFrom(lowConf) }));
    assert.equal(result.swaps.length, 0);
    assert.equal(result.eligible, 0);
  });

  test('honours the ambiguity threshold', () => {
    const ambiguous = PACK.map((e) => ({ ...e, senses: 20 }));
    const result = selectSwaps(baseInput({ ratio: 1, lookup: lookupFrom(ambiguous) }));
    assert.equal(result.swaps.length, 0);
  });

  test('applies the band window around the effective level', () => {
    const hard = PACK.map((e) => ({ ...e, band: 6 }));
    const atLevel1 = selectSwaps(baseInput({ ratio: 1, lookup: lookupFrom(hard), effectiveLevel: 1 }));
    assert.equal(atLevel1.swaps.length, 0, 'band 6 is out of reach at level 1');
    const atLevel6 = selectSwaps(baseInput({ ratio: 1, lookup: lookupFrom(hard), effectiveLevel: 6 }));
    assert.ok(atLevel6.swaps.length > 0, 'band 6 should be available at level 6');
  });

  test('skips identity mappings', () => {
    const identity = [entry({ src: 'cat', tgt: 'cat', tgtLemma: 'cat' })];
    const result = selectSwaps(baseInput({ ratio: 1, lookup: lookupFrom(identity) }));
    assert.equal(result.swaps.length, 0);
  });

  test('never weaves handles, acronyms or domains', () => {
    const text = 'The @cat and the NASA dog visited example.house today with the cat.';
    const result = selectSwaps(baseInput({ tokens: tokenize(text), ratio: 1 }));
    for (const s of result.swaps) {
      assert.notEqual(s.start, text.indexOf('cat'), 'handle was woven');
    }
    const woven = result.swaps.map((s) => text.slice(s.start, s.end));
    assert.ok(!woven.includes('house'), 'domain fragment was woven');
  });
});

describe('daily new-word budget', () => {
  test('stops introducing once the budget is spent', () => {
    const result = selectSwaps(
      baseInput({ ratio: 1, settings: settings({ 'learning.introduceNewPerDay': 3 }) }),
    );
    assert.equal(result.newLemmas.length, 3);
    assert.equal(result.swaps.length, 3);
  });

  test('already-introduced lemmas do not consume budget', () => {
    const introduced = new Set(['chat', 'chien', 'maison', 'eau']);
    const cards = cardMap(
      [...introduced].map((lemma) => card({ lemma, reps: 2, stability: 3, lastReview: NOW - 86_400_000 })),
    );
    const result = selectSwaps(
      baseInput({
        ratio: 1,
        cards,
        introducedToday: new Set(),
        settings: settings({ 'learning.introduceNewPerDay': 0 }),
      }),
    );
    assert.ok(result.swaps.length > 0, 'known words should still be woven with zero new-word budget');
    for (const s of result.swaps) {
      assert.ok(introduced.has(s.entry.tgtLemma), `unexpected new lemma ${s.entry.tgtLemma}`);
    }
  });
});

describe('retired words', () => {
  test('are woven for free, outside the ratio budget', () => {
    const cards = cardMap([
      card({ lemma: 'chat', reps: 9, stability: 90, lastReview: NOW - 86_400_000 }),
      card({ lemma: 'maison', reps: 9, stability: 90, lastReview: NOW - 86_400_000 }),
    ]);
    const result = selectSwaps(baseInput({ ratio: 0, cards }));
    assert.ok(result.retiredCount >= 1, 'a retired word should appear even at ratio 0');
    const woven = originals(result);
    assert.ok(woven.includes('cat') || woven.includes('house'));
  });

  test('can be switched off', () => {
    const cards = cardMap([card({ lemma: 'chat', reps: 9, stability: 90, lastReview: NOW - 86_400_000 })]);
    const result = selectSwaps(
      baseInput({ ratio: 0, cards, settings: settings({ 'learning.retireKnownWords': false }) }),
    );
    assert.equal(result.swaps.length, 0);
  });
});

describe('scoring preferences', () => {
  test('prefers due words over freshly reviewed ones', () => {
    const fresh = card({ lemma: 'chat', reps: 5, stability: 200, lastReview: NOW });
    const due = card({ lemma: 'chien', reps: 5, stability: 1, lastReview: NOW - 30 * 86_400_000 });
    const result = selectSwaps(baseInput({ ratio: 0.08, cards: cardMap([fresh, due]) }));
    const lemmas = result.swaps.map((s) => s.entry.tgtLemma);
    if (lemmas.includes('chat') || lemmas.includes('chien')) {
      assert.ok(
        lemmas.indexOf('chien') === -1 || lemmas.indexOf('chat') === -1 || lemmas.indexOf('chien') < lemmas.indexOf('chat'),
      );
    }
  });

  test('prefers cognates at low ratios', () => {
    const pack = [
      entry({ src: 'important', lemma: 'important', pos: 'adj', tgt: 'important', tgtLemma: 'important', zipf: 4.8, band: 1 }),
      entry({ src: 'thing', lemma: 'thing', pos: 'noun', tgt: 'truc', tgtLemma: 'truc', zipf: 4.8, band: 1 }),
    ];
    // Identity mappings are skipped, so use a near-cognate rather than an exact one.
    pack[0] = entry({ src: 'important', lemma: 'important', pos: 'adj', tgt: 'importante', tgtLemma: 'importante', zipf: 4.8, band: 1 });
    const text = 'This is a very important thing to consider carefully today in the morning.';
    const result = selectSwaps(
      baseInput({ tokens: tokenize(text), lookup: lookupFrom(pack), ratio: 0.5 }),
    );
    assert.equal(result.swaps[0]?.entry.tgtLemma, 'importante');
  });
});

describe('case preservation', () => {
  test('capitalises the replacement when the original was capitalised', () => {
    const text = 'Water flowed under the stone bridge and the young king rode away.';
    const result = selectSwaps(baseInput({ tokens: tokenize(text), ratio: 1 }));
    const waterSwap = result.swaps.find((s) => s.original === 'Water');
    if (waterSwap) assert.equal(waterSwap.replacement, 'Eau');
  });
});

describe('band window and level helpers', () => {
  test('inside a pack of six bands, bandWindow is i+1 around the level', () => {
    assert.deepEqual(bandWindow(1, 6), { min: 1, max: 2 });
    assert.deepEqual(bandWindow(3, 6), { min: 2, max: 4 });
    assert.deepEqual(bandWindow(5, 6), { min: 4, max: 6 });
    assert.deepEqual(bandWindow(-4, 6), { min: 1, max: 2 });
  });

  test('idealZipf falls as the level rises', () => {
    assert.ok(idealZipf(1) > idealZipf(3));
    assert.ok(idealZipf(3) > idealZipf(6));
    assert.ok(Math.abs(idealZipf(1) - 6.2) < 1e-9);
    assert.ok(Math.abs(idealZipf(6) - 3.2) < 1e-9);
  });

  test('effectiveLevel advances one band per 200 retired words', () => {
    assert.equal(effectiveLevel(1, 0), 1);
    assert.equal(effectiveLevel(1, 199), 1);
    assert.equal(effectiveLevel(1, 200), 2);
    assert.equal(effectiveLevel(1, 2000), 6);
    assert.equal(effectiveLevel(6, 2000), 6);
  });
});

describe('the band window stays inside the bands a pack has', () => {
  // Every shipped pack tops out at band 4, and until 2026-11-08 the window
  // slid past it: C2 looked for bands 5 and 6, which no pack has, C1 for
  // band 4 and above, 4 lemmas of 356, and B2 for bands 3 to 5, 23 of them.
  test('past the top band it slides down to end there, three bands wide', () => {
    assert.deepEqual(bandWindow(4, 4), { min: 2, max: 4 });
    assert.deepEqual(bandWindow(5, 4), { min: 2, max: 4 });
    assert.deepEqual(bandWindow(6, 4), { min: 2, max: 4 });
    assert.deepEqual(bandWindow(99, 4), { min: 2, max: 4 });
    assert.deepEqual(bandWindow(6, 6), { min: 4, max: 6 });
  });

  test('for every level and top band: inside the pack, as high as it may reach, as wide as the pack allows', () => {
    for (let top = 1; top <= 6; top++) {
      for (let level = 1; level <= 6; level++) {
        const { min, max } = bandWindow(level, top);
        const at = `level ${level} on a pack whose top band is ${top} gets [${min}, ${max}]`;
        assert.ok(1 <= min && min <= max && max <= top, `${at}, outside the pack's bands`);
        assert.equal(max, Math.min(level + 1, top), `${at}, short of the highest band it may reach`);
        // At A1 there is no band below, so the window is two bands; it never
        // slides up, which would hand a beginner words above their level.
        assert.equal(max - min + 1, Math.min(level === 1 ? 2 : 3, top), `${at}, narrower than the pack allows`);
        if (level + 1 <= top) {
          assert.deepEqual({ min, max }, { min: Math.max(1, level - 1), max: level + 1 }, `${at}, though i+1 fits`);
        }
      }
    }
  });

  test('topBandOf reads the highest band a pack has', () => {
    assert.equal(topBandOf({ bands: [1, 2, 3, 4] }), 4);
    assert.equal(topBandOf({ bands: [3, 1] }), 3);
    assert.equal(topBandOf({ bands: [9] }), 6);
    // A pack that names no band restricts nothing.
    assert.equal(topBandOf({ bands: [] }), 6);
  });

  test('a level above every band a pack has still weaves', () => {
    // PACK holds bands 1 and 2, as the shipped packs hold 1 to 4.
    const top = topBandOf({ bands: [...new Set(PACK.map((e) => e.band))] });
    assert.equal(top, 2);
    for (const level of [3, 4, 5, 6]) {
      const r = selectSwaps(baseInput({ ratio: 1, effectiveLevel: level, topBand: top }));
      assert.ok(r.eligible > 0, `level ${level} found no eligible word in a pack whose top band is ${top}`);
      assert.ok(r.swaps.length > 0, `level ${level} wove nothing from a pack whose top band is ${top}`);
    }
  });

  test('a higher level puts the rarer words first', () => {
    const mean = (r: ReturnType<typeof selectSwaps>) =>
      r.swaps.reduce((sum, s) => sum + s.entry.zipf, 0) / r.swaps.length;
    const low = selectSwaps(baseInput({ ratio: 0.3, effectiveLevel: 1, topBand: 2 }));
    const high = selectSwaps(baseInput({ ratio: 0.3, effectiveLevel: 6, topBand: 2 }));
    assert.ok(low.swaps.length > 0 && high.swaps.length > 0, 'both levels must weave for the comparison to mean anything');
    assert.ok(
      mean(high) < mean(low),
      `level 6 wove words of mean Zipf ${mean(high).toFixed(2)}, no rarer than level 1's ${mean(low).toFixed(2)}`,
    );
  });
});

describe('entryAllowed', () => {
  test('reports why an entry was rejected', () => {
    const input = baseInput();
    assert.equal(entryAllowed(entry({ conf: 0.1 }), input).why, 'confidence');
    assert.equal(entryAllowed(entry({ senses: 99 }), input).why, 'ambiguous');
    assert.equal(entryAllowed(entry({ band: 6 }), input).why, 'band');
    assert.equal(entryAllowed(entry({ pos: 'det' }), input).why, 'pos');
    assert.equal(entryAllowed(entry({ src: 'x', tgt: 'x' }), input).why, 'identity');
    assert.equal(entryAllowed(entry({ pos: 'phrase' }), input).why, 'phrases-off');
    assert.equal(entryAllowed(entry({}), input).ok, true);
  });
});

describe('pinned swaps', () => {
  test('a pinned word survives a change that would have dropped it', () => {
    // Ranking is prefix-monotone for fixed inputs, but exposures and reveals
    // change every card's retrievability, so a word ranked third can rank
    // ninth after a re-weave and fall outside the budget. That showed up in
    // the browser as a word flipping back to English while the page got
    // harder around it. Pinning is the explicit guarantee.
    const low = selectSwaps(baseInput({ ratio: 0.1 }));
    assert.ok(low.swaps.length > 0);
    const keys = new Set(low.swaps.map((s) => `${s.start}:${s.original.toLowerCase()}`));

    // Make every pinned word look freshly reviewed, which drives its "due"
    // score to the bottom and would otherwise evict it.
    const cards = cardMap(
      low.swaps.map((s) =>
        card({ lemma: s.entry.tgtLemma, reps: 8, stability: 400, lastReview: NOW }),
      ),
    );

    const without = selectSwaps(baseInput({ ratio: 0.1, cards }));
    const withoutKeys = new Set(without.swaps.map((s) => `${s.start}:${s.original.toLowerCase()}`));
    const dropped = [...keys].filter((k) => !withoutKeys.has(k));
    assert.ok(
      dropped.length > 0,
      'the scenario should evict something, or the test proves nothing',
    );

    const pinnedResult = selectSwaps(baseInput({ ratio: 0.1, cards, pinned: keys }));
    const pinnedKeys = new Set(
      pinnedResult.swaps.map((s) => `${s.start}:${s.original.toLowerCase()}`),
    );
    for (const key of keys) {
      assert.ok(pinnedKeys.has(key), `pinned swap ${key} was dropped`);
    }
  });

  test('pinning still respects the spacing and per-sentence caps', () => {
    const tokens = tokenize(TEXT);
    const all = selectSwaps(baseInput({ ratio: 1, tokens }));
    const keys = new Set(all.swaps.map((s) => `${s.start}:${s.original.toLowerCase()}`));

    const tight = selectSwaps(
      baseInput({
        ratio: 1,
        tokens,
        pinned: keys,
        settings: settings({ 'weave.maxPerSentence': 1, 'learning.introduceNewPerDay': 500 }),
      }),
    );
    const perSentence = new Map<number, number>();
    for (const s of tight.swaps) {
      const sentence = tokens[s.tokenIndex]?.sentence ?? -1;
      perSentence.set(sentence, (perSentence.get(sentence) ?? 0) + 1);
    }
    for (const [sentence, n] of perSentence) {
      assert.ok(n <= 1, `sentence ${sentence} had ${n} swaps despite the cap`);
    }
  });

  test('pinning nothing behaves exactly as before', () => {
    const plain = selectSwaps(baseInput({ ratio: 0.3 }));
    const empty = selectSwaps(baseInput({ ratio: 0.3, pinned: new Set() }));
    assert.deepEqual(
      empty.swaps.map((s) => s.original),
      plain.swaps.map((s) => s.original),
    );
  });
});
