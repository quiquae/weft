/**
 * One spelling is sometimes two words, and two words are two cards.
 *
 * A memory card is keyed by its target headword, `tgtLemma`, and a pack holds
 * a row per English gloss, so rows sharing a headword share a card: one
 * schedule, one line in the discoveries feed, one gloss in the vocabulary
 * list, one question in the quiz, one page on the site. That is right for
 * `fille`, a girl and a daughter. It was wrong for three Old English words
 * that are two words each, to which English Wiktionary gives two etymologies
 * apiece:
 *
 *   hund   a dog, which became *hound*, and a hundred
 *   earm   an arm, which is still *arm*, and poor
 *   rīċe   a realm, and rich, which became *rich*
 *
 * A reader who met *hund* as "hundred" was told it survived into English as
 * *hound*, asked "dog" in the quiz, and scheduled as though meeting the
 * number were meeting the animal; `rīċe` → *rich*, a checked descent, was on
 * no page at all. The seed now writes the second word of each with a
 * homograph number, `hund²`, which reaches `tgtLemma` and so the card's id,
 * and nothing a reader sees. Three things are held here.
 *
 * **A headword shared across parts of speech has been decided, not
 * defaulted.** It is the one sign of two words that the data itself carries:
 * every pair of rows sharing a headword *and* a part of speech was read on
 * 2026-10-02 and each is one word with two glosses. Sharing across parts of
 * speech is either two words, numbered, or one word on purpose — listed in
 * `ONE_WORD` with what the dictionary says — and a new case fails here by
 * name until somebody has looked. A homograph within one part of speech is
 * invisible to this, and to anything short of reading the entries.
 *
 * **A number marks a later word, never the first.** The first word is
 * written bare and the numbers count up from two, so numbering a second word
 * never moves the card the first one already has: every existing `ang:hund`
 * card stays the dog. Read here without `spelling()`, the function that takes
 * the number off, so a fault in how it reads a number cannot agree with
 * itself.
 *
 * **In the packs that ship, each word of a pair reads as itself** — the
 * three Old English pairs, and French `mort`, death and dead, numbered on
 * 2026-10-04 — through the lookup the dashboard, the quiz and the site read,
 * and through the feed — checked against the sentences each reader should be
 * told, written out by hand.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entriesByTarget } from '../../src/core/lexicon.ts';
import { getLanguage } from '../../src/core/languages.ts';
import { buildDiscoveries } from '../../src/core/discoveries.ts';
import type { LangCode, LexEntry, MemoryCard } from '../../src/core/types.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PACKS = join(ROOT, 'src/lexicon/packs');

type Pack = { entries: Record<string, LexEntry[]> };

const packs = readdirSync(PACKS)
  .filter((name) => /^en-[a-z]+\.json$/.test(name))
  .map((name) => ({
    lang: name.slice(3, -5),
    pack: JSON.parse(readFileSync(join(PACKS, name), 'utf8')) as Pack,
  }));

/** Every row of every headword, in pack order. */
function rowsByWord(pack: Pack): Map<string, LexEntry[]> {
  const out = new Map<string, LexEntry[]>();
  for (const list of Object.values(pack.entries)) {
    for (const row of list) out.set(row.tgtLemma, [...(out.get(row.tgtLemma) ?? []), row]);
  }
  return out;
}

/**
 * Headwords shared across parts of speech that are one word, and the reason.
 *
 * Read in English Wiktionary on 2026-10-02, and kept to what was read there.
 * `fr:mort` was listed here until 2026-10-04, as one word on purpose though
 * Wiktionary gives death and dead two etymologies, from *mors* and from
 * *mortuus*. It is two cards now, as `hund` is, and dead is `mort²`.
 */
const ONE_WORD: ReadonlyMap<string, string> = new Map([
  ['ang:sōþ', 'true and truth: one etymology, an adjective and a noun, and both rows claim sooth'],
  ['de:schnell', 'quick and quickly: one etymology, the adjective serving as its own adverb'],
  ['de:langsam', 'slow and slowly: one etymology, the adjective serving as its own adverb'],
  ['es:mañana', 'morning and tomorrow: one etymology, a noun and an adverb'],
]);

/** Superscript digits, by value. A headword's homograph number is one of these, last. */
const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** `hund²` → `{ bare: 'hund', n: 2 }`; a headword with no number → `n: null`. */
function numbered(word: string): { bare: string; n: number | null } {
  const n = SUPERSCRIPT.indexOf(word.at(-1) ?? '');
  return n === -1 ? { bare: word, n: null } : { bare: word.slice(0, -1), n };
}

describe('a headword shared across parts of speech has been decided', () => {
  test('it is two words by number, or one word on purpose', () => {
    const undecided: string[] = [];
    for (const { lang, pack } of packs) {
      for (const [word, rows] of rowsByWord(pack)) {
        if (new Set(rows.map((r) => r.pos)).size < 2 || ONE_WORD.has(`${lang}:${word}`)) continue;
        const glosses = [...new Set(rows.map((r) => `${r.lemma} (${r.pos})`))].join(', ');
        undecided.push(
          `${lang}:${word} is ${glosses}. If they are two words, write the later one ${word}² in the seed; if one, list it in ONE_WORD with what the dictionary says`,
        );
      }
    }
    assert.deepEqual(undecided, [], `${undecided.length} headwords stand for two parts of speech undecided:\n  ${undecided.join('\n  ')}`);
  });

  test('the one-word list names only headwords that still span parts of speech', () => {
    // The converse, so that numbering a listed word, or dropping it, cannot
    // leave its reason here vouching for nothing.
    const live = new Set<string>();
    for (const { lang, pack } of packs) {
      for (const [word, rows] of rowsByWord(pack)) {
        if (new Set(rows.map((r) => r.pos)).size > 1) live.add(`${lang}:${word}`);
      }
    }
    const stale = [...ONE_WORD.keys()].filter((key) => !live.has(key));
    assert.deepEqual(stale, [], `listed as one word across parts of speech, and no longer one: ${stale.join(', ')}`);
  });
});

describe('a homograph number marks a later word, never the first', () => {
  test('a numbered headword follows its bare spelling, and the numbers count up from two', () => {
    const offenders: string[] = [];
    for (const { lang, pack } of packs) {
      const words = new Set(rowsByWord(pack).keys());
      for (const word of words) {
        const { bare, n } = numbered(word);
        if ([...bare].some((ch) => SUPERSCRIPT.includes(ch))) {
          offenders.push(`${lang}:${word} carries a superscript digit before its end`);
        }
        if (n === null) continue;
        if (n < 2) {
          offenders.push(`${lang}:${word} — the first word is written bare, so that numbering never moves its card`);
          continue;
        }
        if (!words.has(bare)) {
          // Not "so write it bare": every card a learner already has for the
          // first word would then silently become this one.
          offenders.push(`${lang}:${word} numbers a second ${bare}, and the pack has no first — restore the first rather than rename this one bare`);
        }
        const before = n === 2 ? bare : `${bare}${SUPERSCRIPT[n - 1]}`;
        if (!words.has(before)) offenders.push(`${lang}:${word} skips ${before}`);
      }
    }
    assert.deepEqual(offenders, [], `${offenders.length} homograph numbers are malformed:\n  ${offenders.join('\n  ')}`);
  });

  test('no row shows its number to a reader', () => {
    // `tgt` is what the page, the tooltip, the feed and the quiz print.
    const shown: string[] = [];
    for (const { lang, pack } of packs) {
      for (const list of Object.values(pack.entries)) {
        for (const row of list) {
          if ([...row.tgt].some((ch) => SUPERSCRIPT.includes(ch))) shown.push(`${lang} ${row.src} → ${row.tgt}`);
          // No target in any pack is spelled with a digit, so one is a number
          // typed on the line rather than raised: `hund2` would be printed.
          if (/[0-9]/.test(row.tgtLemma)) shown.push(`${lang} ${row.src} → ${row.tgtLemma}: write a homograph number raised, ²`);
        }
      }
    }
    assert.deepEqual(shown, [], `${shown.length} rows print a homograph number:\n  ${shown.join('\n  ')}`);
  });
});

/**
 * The three pairs as the item that found them described them, and what each
 * reader should now be told. Written out by hand from the seed rows, so the
 * lookup and the feed are checked against something they did not produce.
 */
const PAIRS = [
  {
    lang: 'ang',
    word: 'hund',
    first: { gloss: 'dog', etymonOf: 'hound' },
    second: { gloss: 'hundred', etymonOf: undefined, feed: ['hund — the usual word for the number; English kept “hundred”, “a counting of 100”.'] },
  },
  {
    lang: 'ang',
    word: 'earm',
    first: { gloss: 'arm', etymonOf: 'arm' },
    second: { gloss: 'poor', etymonOf: undefined, feed: [] },
  },
  {
    lang: 'ang',
    word: 'rīċe',
    first: { gloss: 'country', etymonOf: undefined },
    second: { gloss: 'rich', etymonOf: 'rich', feed: ['rīċe became English rich, but it meant powerful before it meant wealthy.'] },
  },
  {
    // Death is first because it had the card: Wiktionary numbers the
    // adjective first, and the seed's rule is that the word already holding
    // the card stays bare. The one claim, “mortal”, was read for death.
    lang: 'fr',
    word: 'mort',
    first: { gloss: 'death', etymonOf: undefined },
    second: { gloss: 'dead', etymonOf: undefined, feed: [] },
  },
] as const;

const shipped = (lang: string) => packs.find((p) => p.lang === lang)?.pack;

/** A card for one word, met once, the way the content script makes one. */
function met(lang: LangCode, lemma: string): MemoryCard {
  return {
    id: `${lang}:${lemma}`,
    target: lang,
    lemma,
    stability: 0,
    difficulty: 5,
    lastReview: 0,
    reps: 0,
    lapses: 0,
    exposures: 1,
    firstSeen: Date.UTC(2026, 9, 2),
  };
}

describe('in the packs that ship, each word of a pair reads as itself', () => {
  test('each word has its own entry, gloss and claim', () => {
    const wrong: string[] = [];
    for (const { lang, word, first, second } of PAIRS) {
      const pack = shipped(lang);
      assert.ok(pack, `no ${lang} pack was read`);
      const lookup = entriesByTarget(pack.entries);
      for (const [key, want] of [
        [word, first],
        [`${word}²`, second],
      ] as const) {
        const read = lookup.get(key);
        if (!read) {
          wrong.push(`${key} has no entry of its own`);
          continue;
        }
        if (read.lemma !== want.gloss) wrong.push(`${key} is glossed “${read.lemma}”, not “${want.gloss}”`);
        if (read.etymonOf !== want.etymonOf) wrong.push(`${key} claims “${read.etymonOf}”, not “${want.etymonOf}”`);
        if (read.tgt !== word) wrong.push(`${key} is printed “${read.tgt}”, not “${word}”`);
      }
    }
    assert.deepEqual(wrong, [], `${wrong.length} words read as the other word of their spelling:\n  ${wrong.join('\n  ')}`);
  });

  test('a reader who met only the second word is told its own story and not the first’s', () => {
    for (const { lang, word, second } of PAIRS) {
      const pack = shipped(lang);
      assert.ok(pack, `no ${lang} pack was read`);
      const { historical, ancestorOfEnglish } = getLanguage(lang);
      const told = buildDiscoveries({
        cards: [met(lang, `${word}²`)],
        entriesByLemma: entriesByTarget(pack.entries),
        historical,
        ancestorOfEnglish: ancestorOfEnglish === true,
      }).map((d) => d.text);
      assert.deepEqual(told, [...second.feed], `a reader who met ${word} as “${second.gloss}”`);
    }
  });
});

describe('the guards above have something to police', () => {
  test('seven packs were read, and they carry both kinds of shared headword', () => {
    // Floors, not counts: a sixth cross-part-of-speech word is a decision for
    // ONE_WORD or the seed, not an edit here.
    assert.equal(packs.length, 7, `read ${packs.length} packs`);
    let across = 0;
    let numberedWords = 0;
    for (const { pack } of packs) {
      for (const [word, rows] of rowsByWord(pack)) {
        if (new Set(rows.map((r) => r.pos)).size > 1) across++;
        if ((numbered(word).n ?? 0) >= 2) numberedWords++;
      }
    }
    assert.ok(across >= ONE_WORD.size, `only ${across} headwords span parts of speech`);
    assert.ok(numberedWords >= 3, `only ${numberedWords} headwords carry a homograph number`);
  });
});
