/**
 * The discoveries feed tells each pack's words in the verbs that are true of
 * them.
 *
 * Its frames for a plain descent once came in two sets chosen by whether the
 * language is still spoken, so Latin, being dead, was told in the set
 * written for Old English: "rēx survived into English as regal", "English
 * aquatic comes straight from aqua", "camera has not changed in a thousand
 * years". 232 of the 314 lines the Latin pack can produce said English
 * descends from the word; English borrowed it, as the Latin site's own word
 * pages say. The set is now chosen by whether English descends from the
 * language, which the language table records as `ancestorOfEnglish`.
 *
 * Worked out here over the packs that ship, with each language's own entry
 * in that table, so a flag that moves fails by name. Only the lines whose
 * sentence is wholly a frame are read — a descent, and a word that did not
 * change — because a note is the pack's own words and may say "began as"
 * about a Latin word's meaning.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entriesByTarget } from '../../src/core/lexicon.ts';
import { buildDiscoveries, type Discovery } from '../../src/core/discoveries.ts';
import { getLanguage, LANGUAGES } from '../../src/core/languages.ts';
import type { LangCode, LexEntry, MemoryCard } from '../../src/core/types.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PACKS = join(ROOT, 'src/lexicon/packs');

/** The verbs that say English descends from a word. */
const DESCENT = [/survived into English/, /comes straight from/, /began as/, /thousand years/, /became English/];

/** Every line a pack's feed can print, every word met once, read as the dashboard reads it. */
function feed(lang: LangCode): Discovery[] {
  const pack = JSON.parse(readFileSync(join(PACKS, `en-${lang}.json`), 'utf8')) as { entries: Record<string, LexEntry[]> };
  const lookup = entriesByTarget(pack.entries);
  const cards: MemoryCard[] = [...lookup.keys()].map((lemma, i) => ({
    id: `${lang}:${lemma}`,
    target: lang,
    lemma,
    stability: 0,
    difficulty: 5,
    lastReview: 0,
    reps: 0,
    lapses: 0,
    exposures: 1,
    firstSeen: i,
  }));
  const language = getLanguage(lang);
  return buildDiscoveries({
    cards,
    entriesByLemma: lookup,
    historical: language.historical,
    ancestorOfEnglish: language.ancestorOfEnglish === true,
    limit: cards.length,
  });
}

const framed = (lines: Discovery[]): Discovery[] => lines.filter((d) => d.kind === 'descent' || d.kind === 'unchanged');
const toldAsDescent = (d: Discovery): boolean => DESCENT.some((verb) => verb.test(d.text));

const langs = readdirSync(PACKS)
  .filter((name) => /^en-[a-z]+\.json$/.test(name))
  .map((name) => name.slice(3, -5) as LangCode);

describe('the feed tells each pack’s words in the verbs that are true of them', () => {
  test('English descends from the stages of English, and from no other language', () => {
    // Derived from the table's own names rather than listed, so the checks
    // below cannot be satisfied by moving the flag: the first probe of this
    // file flagged Latin and every other test here still passed.
    const wrong = Object.values(LANGUAGES)
      .filter((l) => Boolean(l.ancestorOfEnglish) !== (l.historical && / English$/.test(l.name)))
      .map((l) => `${l.code} (${l.name}): ancestorOfEnglish is ${Boolean(l.ancestorOfEnglish)}`);
    assert.deepEqual(wrong, []);
    assert.ok(Object.values(LANGUAGES).some((l) => l.ancestorOfEnglish), 'no language is an ancestor of English');
  });

  test('no language English borrowed from is told as though English descends from it', () => {
    const offenders: string[] = [];
    for (const lang of langs) {
      if (getLanguage(lang).ancestorOfEnglish) continue;
      for (const d of framed(feed(lang)).filter(toldAsDescent)) offenders.push(`${lang}: ${d.text}`);
    }
    assert.deepEqual(
      offenders.slice(0, 5),
      [],
      `${offenders.length} lines tell a borrowing as a descent, first:\n  ${offenders.slice(0, 5).join('\n  ')}`,
    );
  });

  test('Old English, which English descends from, is told in the verbs of descent', () => {
    const lines = framed(feed('ang'));
    const told = lines.filter(toldAsDescent).length;
    assert.ok(told > lines.length / 2, `only ${told} of ${lines.length} Old English lines say the word became English`);
  });

  test('the packs give both rules something to police', () => {
    // 304 Latin descents and 264 Old English on 2026-10-02. Floors, so that
    // correcting a claim needs no edit here.
    assert.equal(langs.length, 7, `read ${langs.length} packs`);
    assert.ok(framed(feed('la')).length > 200, 'the Latin pack gave the feed almost nothing to tell');
    assert.ok(framed(feed('ang')).length > 200, 'the Old English pack gave the feed almost nothing to tell');
  });
});
