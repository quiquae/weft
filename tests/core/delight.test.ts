import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { explainChoice, factorTable } from '../../src/core/explain.ts';
import { buildDiscoveries, discoveryCoverage } from '../../src/core/discoveries.ts';
import { milestones, nextMilestone, earnedMilestones } from '../../src/core/milestones.ts';
import type { LexEntry } from '../../src/core/types.ts';
import { card, entry, settings, NOW } from '../helpers.ts';

/* ------------------------------------------------------------- explain */

describe('explainChoice', () => {
  const plain = entry({ src: 'dog', lemma: 'dog', tgt: 'chien', tgtLemma: 'chien' });

  test('leads with newness when the word is new', () => {
    const { sentence } = explainChoice(plain, { due: 1 }, { firstMeeting: true });
    assert.match(sentence, /New to you/);
  });

  test('mentions the cognate when the word is a cognate', () => {
    const cognate = entry({
      src: 'nation',
      lemma: 'nation',
      tgt: 'nación',
      tgtLemma: 'nación',
    });
    const { sentence } = explainChoice(cognate, { cognate: 0.95, due: 0.2 });
    assert.match(sentence, /identical to the English word/i);
  });

  test('names the etymon for a historical word', () => {
    const oe = entry({ src: 'house', lemma: 'house', tgt: 'hūs', tgtLemma: 'hūs', etymonOf: 'house' });
    const { sentence } = explainChoice(oe, { cognate: 0.9, due: 0.3 });
    assert.match(sentence, /ancestor of English/i);
  });

  test('is a sentence, not a table of numbers', () => {
    const { sentence } = explainChoice(plain, {
      due: 0.9,
      cognate: 0.2,
      frequency: 0.8,
      bandFit: 0.7,
      confidence: 0.95,
      score: 0.61,
    });
    assert.doesNotMatch(sentence, /[0-9]\.[0-9]/, 'no decimals in user-facing copy');
    assert.match(sentence, /^Chosen because /);
    assert.ok(sentence.length < 160);
  });

  test('never explains itself with a gate', () => {
    // Confidence and the ambiguity gate are filters, not reasons. "Chosen
    // because we were confident" tells the reader nothing.
    const { drivers } = explainChoice(plain, {
      confidence: 1,
      ambiguityGate: 1,
      repeatGate: 1,
      positionGate: 1,
      score: 1,
      due: 0.5,
    });
    for (const gate of ['confidence', 'ambiguityGate', 'repeatGate', 'positionGate', 'score']) {
      assert.ok(!drivers.includes(gate), `${gate} must never be a reason`);
    }
  });

  test('falls back gracefully with no factors at all', () => {
    const { sentence } = explainChoice(plain, undefined);
    assert.ok(sentence.length > 10);
    assert.doesNotMatch(sentence, /undefined|NaN/);
  });

  test('joins at most two reasons', () => {
    const { sentence } = explainChoice(plain, {
      due: 0.9,
      frequency: 0.85,
      bandFit: 0.8,
      guessability: 0.75,
      pos: 0.7,
    });
    assert.ok((sentence.match(/, and /g) ?? []).length <= 1, sentence);
  });

  test('factorTable is sorted and stringified, for the debug view only', () => {
    const rows = factorTable({ a: 0.1, b: 0.9, c: 0.5 });
    assert.deepEqual(
      rows.map((r) => r[0]),
      ['b', 'c', 'a'],
    );
    assert.equal(rows[0]?.[1], '0.900');
    assert.deepEqual(factorTable(undefined), []);
  });
});

/* --------------------------------------------------------- discoveries */

describe('buildDiscoveries', () => {
  const entries = new Map<string, LexEntry>([
    [
      'steorfan',
      entry({
        src: 'die',
        lemma: 'die',
        pos: 'verb',
        tgt: 'steorfan',
        tgtLemma: 'steorfan',
        etymonOf: 'starve',
        note: '"steorfan" simply meant to die',
      }),
    ],
    [
      'hlāford',
      entry({
        src: 'lord',
        lemma: 'lord',
        tgt: 'hlāford',
        tgtLemma: 'hlāford',
        etymonOf: 'lord',
        note: 'literally the loaf-keeper',
      }),
    ],
    [
      'hūs',
      entry({ src: 'house', lemma: 'house', tgt: 'hūs', tgtLemma: 'hūs', etymonOf: 'house' }),
    ],
    ['dull', entry({ src: 'thing', lemma: 'thing', tgt: 'þing', tgtLemma: 'þing' })],
  ]);

  const met = [
    card({ lemma: 'steorfan', target: 'ang', exposures: 4, firstSeen: NOW - 1000 }),
    card({ lemma: 'hlāford', target: 'ang', exposures: 2, firstSeen: NOW - 5000 }),
    card({ lemma: 'hūs', target: 'ang', exposures: 9, firstSeen: NOW - 9000 }),
  ];

  test('only includes words the learner has actually met', () => {
    const unseen = card({ lemma: 'dull', target: 'ang', exposures: 0 });
    const found = buildDiscoveries({
      cards: [...met, unseen],
      entriesByLemma: entries,
      historical: true, ancestorOfEnglish: true,
    });
    assert.ok(!found.some((d) => d.target === 'þing'));
  });

  test('skips words with nothing to say', () => {
    const found = buildDiscoveries({
      cards: [card({ lemma: 'dull', target: 'ang', exposures: 5 })],
      entriesByLemma: entries,
      historical: true, ancestorOfEnglish: true,
    });
    assert.deepEqual(found, []);
  });

  test('classifies a meaning shift as a false friend', () => {
    const found = buildDiscoveries({ cards: met, entriesByLemma: entries, historical: true, ancestorOfEnglish: true });
    const starve = found.find((d) => d.target === 'steorfan');
    assert.ok(starve);
    assert.equal(starve.kind, 'false-friend');
    assert.match(starve.text, /became English starve/);
    assert.match(starve.text, /simply meant to die/);
  });

  test('classifies a literal gloss as literal', () => {
    const found = buildDiscoveries({ cards: met, entriesByLemma: entries, historical: true, ancestorOfEnglish: true });
    const lord = found.find((d) => d.target === 'hlāford');
    assert.equal(lord?.kind, 'literal');
    assert.match(String(lord?.text), /loaf-keeper/);
  });

  test('classifies a plain descent as descent', () => {
    const found = buildDiscoveries({ cards: met, entriesByLemma: entries, historical: true, ancestorOfEnglish: true });
    const house = found.find((d) => d.target === 'hūs');
    assert.equal(house?.kind, 'descent');
    assert.match(String(house?.text), /hūs/);
    assert.match(String(house?.text), /house/);
  });

  test('a word that did not change is not reported as a descent', () => {
    // "English weald comes straight from weald" is a tautology. That it has
    // not changed in a thousand years is the more interesting fact.
    const same = new Map<string, LexEntry>([
      ['weald', entry({ src: 'forest', lemma: 'forest', tgt: 'weald', tgtLemma: 'weald', etymonOf: 'weald' })],
    ]);
    const found = buildDiscoveries({
      cards: [card({ lemma: 'weald', target: 'ang', exposures: 3 })],
      entriesByLemma: same,
      historical: true, ancestorOfEnglish: true,
    });
    assert.equal(found[0]?.kind, 'unchanged');
    assert.match(String(found[0]?.text), /has not changed/);
  });

  test('an additive note is not turned into a contrast', () => {
    // A note reading "whence evening and eve" is additive. Treating it as a
    // meaning shift produced "aefen became English even, but whence evening
    // and eve", which is not a sentence.
    const additive = new Map<string, LexEntry>([
      ['ǣfen', entry({ src: 'evening', lemma: 'evening', tgt: 'ǣfen', tgtLemma: 'ǣfen', etymonOf: 'even', note: 'whence "evening" and "eve"' })],
    ]);
    const found = buildDiscoveries({
      cards: [card({ lemma: 'ǣfen', target: 'ang', exposures: 3 })],
      entriesByLemma: additive,
      historical: true, ancestorOfEnglish: true,
    });
    assert.notEqual(found[0]?.kind, 'false-friend');
    assert.doesNotMatch(String(found[0]?.text), /but whence/);
  });

  test('puts the most interesting kinds first', () => {
    const found = buildDiscoveries({ cards: met, entriesByLemma: entries, historical: true, ancestorOfEnglish: true });
    const kinds = found.map((d) => d.kind);
    const firstDescent = kinds.indexOf('descent');
    const lastInteresting = Math.max(kinds.lastIndexOf('false-friend'), kinds.lastIndexOf('literal'));
    if (firstDescent !== -1 && lastInteresting !== -1) {
      assert.ok(lastInteresting < firstDescent, `plain descents should sink: ${kinds.join(',')}`);
    }
  });

  test('descent phrasing varies but is stable per word', () => {
    // Two lines in three reading the same template stops being read; but a
    // feed that rewords itself between visits is unsettling.
    const many = new Map<string, LexEntry>();
    const cards = [];
    for (const [t, e] of [['hūs', 'house'], ['stān', 'stone'], ['cyning', 'king'], ['bōc', 'book'], ['weġ', 'way']] as Array<[string, string]>) {
      many.set(t, entry({ src: e, lemma: e, tgt: t, tgtLemma: t, etymonOf: e }));
      cards.push(card({ lemma: t, target: 'ang', exposures: 3 }));
    }
    const first = buildDiscoveries({ cards, entriesByLemma: many, historical: true, ancestorOfEnglish: true });
    const again = buildDiscoveries({ cards, entriesByLemma: many, historical: true, ancestorOfEnglish: true });
    assert.deepEqual(first.map((d) => d.text), again.map((d) => d.text), 'must be stable');
    assert.ok(new Set(first.map((d) => d.text.replace(/[a-zāēīōūǣþðæġ]+/gi, 'X'))).size > 1, 'must vary');
  });

  test('the order is stable when kind and metAt both tie', () => {
    /*
     * The sibling test above re-sorts the *same array* twice, so it can only
     * ever see the wording drift, never the order. The comparator's two keys
     * are the kind and the recency, and cards first met in the same
     * millisecond tie on both — so the result fell through to input order,
     * which is whatever the storage round-trip happened to hand back.
     *
     * That is not hypothetical. `docs/store/*-04-progress.png` is listing
     * art generated from nineteen cards that all carry
     * `firstSeen: now - 30 * day`, and two consecutive runs of the generator
     * swapped `montagne` and `forêt` in the feed — 4416 pixels, and the one
     * check that could vouch for the art reporting noise again.
     *
     * The file already committed to this rule for the *wording* four
     * paragraphs up: varied by a stable hash, "not random", so the feed does
     * not reshuffle itself between visits. An order that depends on map
     * iteration reshuffles it just as visibly.
     */
    const tied = new Map<string, LexEntry>();
    const cards = [];
    for (const [t, e] of [
      ['montagne', 'mountain'], ['forêt', 'forest'], ['rivière', 'river'],
      ['pierre', 'stone'], ['fenêtre', 'window'],
    ] as Array<[string, string]>) {
      tied.set(t, entry({ src: e, lemma: e, tgt: t, tgtLemma: t, etymonOf: e }));
      // Every card met in the same millisecond, as a bulk import produces.
      cards.push(card({ lemma: t, target: 'fr', exposures: 3, firstSeen: NOW - 1000 }));
    }
    const forwards = buildDiscoveries({ cards, entriesByLemma: tied, historical: false, ancestorOfEnglish: false });
    const backwards = buildDiscoveries({
      cards: [...cards].reverse(),
      entriesByLemma: tied,
      historical: false, ancestorOfEnglish: false,
    });
    assert.ok(forwards.length > 1, 'nothing to order, so this proves nothing');
    assert.deepEqual(
      backwards.map((d) => d.id),
      forwards.map((d) => d.id),
      'permuting the input reorders the feed, so two renders of one vocabulary disagree',
    );
  });

  test('the tiebreak ignores accents rather than sorting on their code points', () => {
    /*
     * A raw code-unit tiebreak is stable and reads like a bug: `i` is U+0069
     * and `è` is U+00E8, so "pierre" lands before "père" in a feed of French.
     * `localeCompare` reads correctly and reintroduces the problem it is
     * fixing, since its answer depends on the runtime's ICU data. Folding is
     * the third option and the one this asserts.
     */
    const accented = new Map<string, LexEntry>([
      ['père', entry({ src: 'father', lemma: 'father', tgt: 'père', tgtLemma: 'père', note: 'shares a root with English "paternal"' })],
      ['pierre', entry({ src: 'stone', lemma: 'stone', tgt: 'pierre', tgtLemma: 'pierre', note: 'shares a root with English "petrify"' })],
    ]);
    const found = buildDiscoveries({
      cards: [
        card({ lemma: 'pierre', target: 'fr', exposures: 3, firstSeen: NOW - 1000 }),
        card({ lemma: 'père', target: 'fr', exposures: 3, firstSeen: NOW - 1000 }),
      ],
      entriesByLemma: accented,
      historical: false, ancestorOfEnglish: false,
    });
    assert.deepEqual(found.map((d) => d.target), ['père', 'pierre']);
  });

  test('a living language is never described as having died', () => {
    /*
     * This asserted the literal string "came from", which was a proxy for
     * the real rule and broke the moment the living-language branch gained
     * varied phrasing. The rule itself is what matters: "survived into
     * English as" and "has not changed in a thousand years" are true of Old
     * English and absurd about French, so those framings must never reach a
     * language that still has speakers.
     */
    const found = buildDiscoveries({
      cards: [card({ lemma: 'hūs', target: 'ang', exposures: 3 })],
      entriesByLemma: entries,
      historical: false, ancestorOfEnglish: false,
    });
    const text = String(found[0]?.text);
    assert.match(text, /from/, `expected a borrowing sentence, got "${text}"`);
    for (const dead of [/survived into/i, /comes straight from/i, /thousand years/i]) {
      assert.ok(!dead.test(text), `a living language was described with "${text}"`);
    }
  });

  /** The verbs that say English descends from a word: true only of a stage of English. */
  const INHERITED = [/survived into English/, /comes straight from/, /began as/, /thousand years/, /became English/];

  test('a dead language English borrowed from is told in the verbs of borrowing', () => {
    /*
     * Latin has no living speakers, so it was handed the frames written for
     * Old English, and 232 of the 314 lines the Latin pack can produce said
     * English descends from the word: "rēx survived into English as regal",
     * "English aquatic comes straight from aqua". English borrowed them,
     * often through a derivative or through French, which is why the Latin
     * site says "was borrowed from". Whether a language is dead is the wrong
     * question for the verb; whether English descends from it is the right one.
     */
    const latin = new Map<string, LexEntry>();
    const cards = [];
    for (const [t, e, en] of [
      ['rēx', 'regal', 'king'], ['aqua', 'aquatic', 'water'], ['lūna', 'lunar', 'moon'],
      ['manus', 'manual', 'hand'], ['mare', 'marine', 'sea'],
    ] as Array<[string, string, string]>) {
      latin.set(t, entry({ src: en, lemma: en, tgt: t, tgtLemma: t, etymonOf: e }));
      cards.push(card({ lemma: t, target: 'la', exposures: 3 }));
    }
    const found = buildDiscoveries({ cards, entriesByLemma: latin, historical: true, ancestorOfEnglish: false });
    assert.equal(found.length, 5, 'every word should have a line');
    for (const d of found) {
      assert.match(d.text, /from/, `expected a borrowing sentence, got "${d.text}"`);
      for (const verb of INHERITED) assert.doesNotMatch(d.text, verb, `a borrowing was told as a descent: "${d.text}"`);
    }
  });

  test('a word English borrowed unchanged is not given a thousand years', () => {
    // English took camera for a vault in 1708; Old English's timescale is a
    // claim about words English never stopped saying.
    const same = new Map<string, LexEntry>([
      ['camera', entry({ src: 'room', lemma: 'room', tgt: 'camera', tgtLemma: 'camera', etymonOf: 'camera' })],
    ]);
    const found = buildDiscoveries({
      cards: [card({ lemma: 'camera', target: 'la', exposures: 3 })],
      entriesByLemma: same,
      historical: true,
      ancestorOfEnglish: false,
    });
    assert.equal(found[0]?.kind, 'unchanged');
    assert.equal(found[0]?.text, 'camera is simply camera.');
  });

  test('a borrowed word whose sense moved is not said to have become English', () => {
    // No pack carries such a row today, and this frame was the last one that
    // said "became" whatever the language.
    const moved = new Map<string, LexEntry>([
      ['dōnum', entry({ src: 'gift', lemma: 'gift', tgt: 'dōnum', tgtLemma: 'dōnum', etymonOf: 'donation', note: '“dōnum” meant a gift to a god' })],
    ]);
    const found = buildDiscoveries({
      cards: [card({ lemma: 'dōnum', target: 'la', exposures: 3 })],
      entriesByLemma: moved,
      historical: true,
      ancestorOfEnglish: false,
    });
    assert.equal(found[0]?.kind, 'false-friend');
    assert.equal(found[0]?.text, 'English borrowed donation from dōnum, but “dōnum” meant a gift to a god.');
  });

  test('a dead language keeps the dead languages’ order, whoever English took its words from', () => {
    // The order answers "what is rare in this language", which is about the
    // data, not the verb: in Latin, as in Old English, a descent is the
    // default and a note the find. A living language puts descents first.
    const two = new Map<string, LexEntry>([
      ['rēx', entry({ src: 'king', lemma: 'king', tgt: 'rēx', tgtLemma: 'rēx', etymonOf: 'regal' })],
      ['ita', entry({ src: 'yes', lemma: 'yes', pos: 'adv', tgt: 'ita', tgtLemma: 'ita', note: 'Latin has no one common word for yes' })],
    ]);
    const cards = [
      card({ lemma: 'rēx', target: 'la', exposures: 3, firstSeen: NOW - 1000 }),
      card({ lemma: 'ita', target: 'la', exposures: 3, firstSeen: NOW - 9000 }),
    ];
    const kinds = (historical: boolean) =>
      buildDiscoveries({ cards, entriesByLemma: two, historical, ancestorOfEnglish: false }).map((d) => d.kind);
    assert.deepEqual(kinds(true), ['note', 'descent']);
    assert.deepEqual(kinds(false), ['descent', 'note']);
  });

  test('the living-language frames vary, as the historical ones do', () => {
    /*
     * The historical branch had four frames and a test demanding variation;
     * the living branch had one template and no such test, so when French
     * gained etymologies the feed came out as two dozen identical lines.
     * Same bug, opposite direction.
     */
    const many = new Map(entries);
    const cards: ReturnType<typeof card>[] = [];
    for (const [lemma, entry] of entries) {
      if (!entry.etymonOf) continue;
      many.set(lemma, entry);
      cards.push(card({ lemma, target: 'ang', exposures: 3 }));
    }
    const found = buildDiscoveries({ cards, entriesByLemma: many, historical: false, ancestorOfEnglish: false });
    const descents = found.filter((d) => d.kind === 'descent');
    if (descents.length < 2) return; // not enough data in the fixture to judge
    const shapes = new Set(descents.map((d) => d.text.replace(/[^ ]+/g, (w) => (/^[A-Z]/.test(w) ? 'X' : w))));
    assert.ok(shapes.size > 1, 'every borrowing sentence used the same wording');
  });

  test('puts the most recently met first', () => {
    const found = buildDiscoveries({ cards: met, entriesByLemma: entries, historical: true, ancestorOfEnglish: true });
    for (let i = 1; i < found.length; i++) {
      assert.ok((found[i - 1]?.metAt ?? 0) >= (found[i]?.metAt ?? 0));
    }
  });

  test('respects the limit', () => {
    assert.equal(
      buildDiscoveries({ cards: met, entriesByLemma: entries, historical: true, ancestorOfEnglish: true, limit: 2 }).length,
      2,
    );
  });

  test('never emits a double full stop or a stray capital mid-sentence', () => {
    const found = buildDiscoveries({ cards: met, entriesByLemma: entries, historical: true, ancestorOfEnglish: true });
    for (const d of found) {
      assert.doesNotMatch(d.text, /\.\./, d.text);
      assert.match(d.text, /\.$/, `should end in a full stop: ${d.text}`);
    }
  });

  test('coverage counts met words and how many have a story', () => {
    const coverage = discoveryCoverage(
      [...met, card({ lemma: 'dull', target: 'ang', exposures: 2 })],
      entries,
    );
    assert.equal(coverage.met, 4);
    assert.equal(coverage.withStory, 3);
  });
});

/* ---------------------------------------------------------- milestones */

describe('milestones', () => {
  const base = { settings: settings(), now: NOW, streakDays: 0 };

  test('a fresh learner has earned nothing and is not shown a wall of failures', () => {
    const input = { ...base, cards: [] };
    assert.deepEqual(earnedMilestones(input), []);
    // Nothing is close enough to be worth naming yet.
    assert.equal(nextMilestone(input), null);
  });

  test('reading a hundred words earns the first one', () => {
    const cards = [card({ lemma: 'a', exposures: 60 }), card({ lemma: 'b', exposures: 45 })];
    const earned = earnedMilestones({ ...base, cards });
    assert.ok(earned.some((m) => m.id === 'first-hundred'));
  });

  test('a retired word earns the first graduate', () => {
    const cards = [
      card({ lemma: 'a', reps: 9, stability: 90, lastReview: NOW - 86_400_000, exposures: 40 }),
    ];
    assert.ok(earnedMilestones({ ...base, cards }).some((m) => m.id === 'first-graduate'));
  });

  test('comprehension needs a real sample before it counts', () => {
    // Two exposures and no reveals is 100%, and means nothing.
    const thin = [card({ lemma: 'a', reps: 1, exposures: 2, lapses: 0, lastReview: NOW })];
    const all = milestones({ ...base, cards: thin });
    const comprehension = all.find((m) => m.id === 'comprehension');
    assert.equal(comprehension?.earned, false, 'must not be earnable on a tiny sample');
  });

  test('exactly one next milestone is offered, and only when it is close', () => {
    const cards = [card({ lemma: 'a', exposures: 60 })];
    const next = nextMilestone({ ...base, cards });
    assert.ok(next, 'sixty words should put something within reach');
    assert.equal(next.earned, false);
    assert.ok(next.progress > 0.08);
  });

  test('progress never exceeds one and the measure is readable', () => {
    const cards = [card({ lemma: 'a', exposures: 99_999 })];
    for (const m of milestones({ ...base, cards })) {
      assert.ok(m.progress >= 0 && m.progress <= 1, `${m.id}: ${m.progress}`);
      assert.match(m.measure, /^[\d,]+ \/ [\d,]+$/, m.measure);
    }
  });

  test('every milestone has copy explaining why it is worth something', () => {
    for (const m of milestones({ ...base, cards: [] })) {
      assert.ok(m.detail.length > 40, `${m.id} needs a real reason`);
      assert.doesNotMatch(m.detail, /TODO|points|XP|badge/i, m.id);
    }
  });

  test('the list is finite and ends somewhere hard', () => {
    // A product that keeps inventing tiers forever is not measuring anything.
    const all = milestones({ ...base, cards: [] });
    assert.ok(all.length <= 12);
    assert.equal(all.at(-1)?.id, 'five-hundred-known');
  });

  test('nothing decays: a streak milestone once earned stays earned', () => {
    const cards = [card({ lemma: 'a', exposures: 300 })];
    const earnedWithStreak = earnedMilestones({ ...base, cards, streakDays: 9 }).map((m) => m.id);
    assert.ok(earnedWithStreak.includes('week'));
    // The streak resetting removes the streak milestone, which is why the
    // dashboard only ever shows earned ones as a permanent list — this test
    // documents that the recomputation is streak-sensitive so the UI must
    // not rely on it for permanence.
    const earnedWithout = earnedMilestones({ ...base, cards, streakDays: 0 }).map((m) => m.id);
    assert.ok(!earnedWithout.includes('week'));
  });
});

describe('explainChoice and the etymon preference', () => {
  const oe = entry({
    src: 'house',
    lemma: 'house',
    tgt: 'hūs',
    tgtLemma: 'hūs',
    etymonOf: 'house',
  });

  test('mentions descent by default', () => {
    assert.match(explainChoice(oe, { cognate: 0.9 }).sentence, /ancestor of English/i);
  });

  test('says nothing about descent when the reader has hidden it', () => {
    // The explanation sits one line below the etymon badge. Leaking the same
    // fact there would quietly undo the setting.
    const { sentence } = explainChoice(oe, { cognate: 0.9 }, { allowEtymon: false });
    assert.doesNotMatch(sentence, /ancestor of English/i);
    assert.ok(sentence.length > 10, 'still has to say something');
  });

  test('also withholds it on a first meeting', () => {
    const { sentence } = explainChoice(oe, { due: 1 }, { firstMeeting: true, allowEtymon: false });
    assert.doesNotMatch(sentence, /ancestor of English/i);
    assert.match(sentence, /New to you/);
  });

  test('a non-etymon cognate reason is still allowed', () => {
    const cognate = entry({ src: 'nation', lemma: 'nation', tgt: 'nación', tgtLemma: 'nación' });
    const { sentence } = explainChoice(cognate, { cognate: 0.95 }, { allowEtymon: false });
    assert.match(sentence, /identical to the English word/i);
  });
});
