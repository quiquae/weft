/**
 * A tooltip note has to read on its own, because the line above it is optional.
 *
 * The tooltip prints two things under a woven word: an etymon badge
 * ("Source of English **November**") and, beneath it, the pack's note. The
 * badge is behind a user switch — `reveal.showEtymon`, `src/core/settings.ts`,
 * default on, toggled at `src/ui/options/sections.tsx` under "Where your
 * English word came from". The note is not: `src/content/tooltip.ts` appends
 * it unconditionally. So a note written to sit *beneath* the badge can lose
 * the only word that made it a sentence, and nothing notices.
 *
 * `src/content/tooltip.ts` already knows this worry for its sibling — the
 * "why" sentence is passed `allowEtymon: reveal.showEtymon` with the comment
 * "must not reinstate a fact they hid". The note was the unguarded half.
 *
 * The rule below is narrower than "every note must stand alone", which is not
 * decidable: most notes that never name their descendant are describing the
 * *target* and are perfectly fine read alone — `persōna`'s "originally an
 * actor's mask", `bōc`'s "usually traced to “beech”". 62 of the 99 Latin and
 * Old English notes never named their etymon when this was written, and only
 * three of them were wrong.
 *
 * What separates the three is that their descendant is a **proper noun**, and
 * a proper noun cannot be alluded to, only named. "the month" and "the
 * country" are not descriptions a reader can resolve; they are placeholders
 * for *January* and *Argentina*. And because every other `etymonOf` in the
 * seven packs is an ordinary English word stored lowercase, capitalisation
 * derives the rule from the data rather than from a hand-curated list — which
 * is what `tests/tools/lexicon-orthography.test.ts` had to fall back on when
 * its own derivation could not see the word it was missing.
 *
 * The three it caught, all Latin:
 *
 *   iānua    → January   "…gave the month its name"
 *   argentum → Argentina "the country is named for the metal"
 *   septem   → September "the seventh month of the old Roman year"
 *
 * The last is the worst of them: with the badge off it does not merely dangle,
 * it reads as a gloss, and *septem* means seven, not September.
 *
 * `iānua` has since left the rule altogether. The Latin descent pass of
 * 2026-10-03 found *January* is from *Janus*, as `iānua` itself is, so its
 * etymon is *janitor* now, and its note names the *iānitor* who kept the door.
 *
 * Deliberately outside the rule: a handful of notes gloss a *common*-noun
 * descendant the same way — `setl` → settle, "the high-backed bench";
 * `nēahġebūr` → neighbour, "the near-dweller". Read alone these still parse
 * as a gloss of the Old English word, which is close enough to true to be
 * harmless, and drawing the line at proper nouns is what keeps this guard
 * from needing a judgement call per entry.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PACKS = join(ROOT, 'src/lexicon/packs');

type Entry = {
  src?: string;
  lemma?: string;
  tgtLemma?: string;
  etymonOf?: string;
  note?: string;
  pos?: string;
};

/** Every pack, so a note added to a language that has none today is covered. */
function everyEntry(): Array<{ pack: string; entry: Entry }> {
  const out: Array<{ pack: string; entry: Entry }> = [];
  for (const file of readdirSync(PACKS).filter((f) => /^en-\w+\.json$/.test(f))) {
    const { entries } = JSON.parse(readFileSync(join(PACKS, file), 'utf8')) as {
      entries: Record<string, Entry[]>;
    };
    for (const list of Object.values(entries)) {
      for (const entry of list) out.push({ pack: file.replace('.json', ''), entry });
    }
  }
  return out;
}

/** A descendant that is a name rather than a word: January, Argentina. */
const isProperNoun = (word: string): boolean => /^\p{Lu}/u.test(word);

const names = (note: string, word: string): boolean =>
  new RegExp(String.raw`(^|[^\p{L}])${word}(?![\p{L}])`, 'iu').test(note);

describe('a tooltip note reads on its own, without the etymon badge above it', () => {
  test('a note whose descendant is a proper noun names it', () => {
    const offenders = new Set<string>();

    for (const { pack, entry } of everyEntry()) {
      const { note, etymonOf, tgtLemma = '?', src = '?' } = entry;
      if (!note || !etymonOf || !isProperNoun(etymonOf)) continue;
      if (names(note, etymonOf)) continue;
      offenders.add(`${pack} ${src} → ${tgtLemma}: never says "${etymonOf}" — ${note}`);
    }

    assert.deepEqual(
      [...offenders],
      [],
      `${offenders.size} notes allude to a proper noun the reader may not have on screen:\n  ${[
        ...offenders,
      ].join('\n  ')}`,
    );
  });

  test('a descendant that is a proper noun has a note at all', () => {
    // The other half of the same premise. The rule above polices notes that
    // exist; a missing note leaves the proper noun unexplained outright, and
    // the surfaces still promise prose — `/latin/novem` renders its "Where
    // November comes from" heading regardless, and the descent hub renders an
    // empty note cell in the column its neighbours fill.
    //
    // Narrow for the same measured reason: 962 of the 1131 entries carrying an
    // `etymonOf` have no note, and almost all of them are right to. An
    // ordinary descendant is inferable from the headword beside it — *octō*
    // next to "Source of English octave" explains itself. A name is not:
    // *novem* next to "Source of English November" tells the reader nothing
    // about why nine became a month, so the historical fact is the only thing
    // that can.
    const missing = everyEntry()
      .filter(({ entry }) => entry.etymonOf && isProperNoun(entry.etymonOf) && !entry.note)
      .map(({ pack, entry }) => `${pack} ${entry.src ?? '?'} → ${entry.tgtLemma ?? '?'}: nothing says why it became "${entry.etymonOf}"`);

    assert.deepEqual(
      [...new Set(missing)],
      [],
      `${missing.length} proper-noun descendants are left unexplained:\n  ${missing.join('\n  ')}`,
    );
  });

  test('the rule has something to police', () => {
    // Without this the guard goes quietly vacuous the day someone lowercases
    // an etymon or the packs stop shipping a proper-noun descendant at all: a
    // scan that inspects nothing passes for the wrong reason. Phrased as a
    // floor rather than an exact set, so it fires only when coverage shrinks
    // — a *new* proper-noun note is already checked by the rule above and
    // should not also have to be registered here.
    const policed = new Set(
      everyEntry()
        .filter(({ entry }) => entry.note && entry.etymonOf && isProperNoun(entry.etymonOf))
        .map(({ entry }) => entry.etymonOf as string),
    );

    assert.ok(
      policed.size >= 3,
      `only ${policed.size} proper-noun descendants carry a note, so the rule above is close to vacuous: ${[...policed].join(', ')}`,
    );
  });
});

/**
 * A note may not hand its entry a grammatical category its part of speech lacks.
 *
 * The first row of the Latin pack read: man → `vir`, "third-person plural
 * “virī” also means “men” collectively". *virī* is the nominative plural of a
 * noun; person is a property of verbs. It stood in the tooltip, on
 * `/latin/vir`, and — because the note contains "means", which is how
 * `src/core/discoveries.ts` recognises a false friend — in the feed, as "vir
 * became English virile, but third-person plural “virī” also means “men”
 * collectively", which is not a sentence about anything.
 *
 * Nothing could have noticed, because nothing compares a note with the
 * columns beside it. The pack already says what each entry is: `pos` is on
 * every one. So the rule is derived from the data rather than from a list of
 * notes somebody remembered — person, tense and conjugation are a verb's, and
 * a note on anything else that reaches for one has mislabelled a form.
 *
 * Narrow in both directions, and each limit was measured against the 212
 * distinct notes in the seven packs, eleven of which use a grammatical term:
 *
 *  - **Participles are out.** A participle is the verb's adjective and nouns
 *    are made from them, so a noun's note may fairly name one. Two verbs'
 *    notes already do — `fōn`, whose participle gave "fang", and `niman`,
 *    whose participle was "numb" — and the same fact told from the noun's
 *    side would be just as true.
 *  - **Only the verb's categories are policed, not the noun's.** A verb
 *    governs a case, so "takes the dative" is a true thing to say on a verb's
 *    row. `burg`'s "its dative, “byriġ”" and `agricola`'s "first-declension"
 *    are on nouns today, but the converse rule would refuse a correct note
 *    the first time somebody wrote one.
 *  - **"woman-person" is not grammar.** `wīfmann`'s note glosses the compound;
 *    only *first-*, *second-* and *third-person* count.
 *
 * It cannot go quietly vacuous through missing data: were `pos` ever dropped
 * from the packs, every verb's note would be policed too, and `wendan`'s "its
 * past tense “went”" would fail by name.
 */
const VERB_ONLY = /\b(?:first|second|third)[- ]person\b|\btense\b|\bconjugation\b/iu;

describe('a note names only the grammar its entry has', () => {
  test('person, tense and conjugation appear only in notes on verbs', () => {
    const offenders = new Set<string>();

    for (const { pack, entry } of everyEntry()) {
      // By lemma, not surface form: `man` and `men` are one row and one note.
      const { note, pos, tgtLemma = '?', lemma = '?' } = entry;
      if (!note || pos === 'verb') continue;
      const found = VERB_ONLY.exec(note);
      if (found) {
        offenders.add(
          `${pack} ${lemma} → ${tgtLemma} (${pos ?? 'no part of speech'}): “${found[0]}” is a verb’s — ${note}`,
        );
      }
    }

    assert.deepEqual(
      [...offenders],
      [],
      `${offenders.size} notes give a verb’s category to a word that is not a verb:\n  ${[...offenders].join('\n  ')}`,
    );
  });

  test('the rule has something to police', () => {
    // A floor rather than an exact count, so it fires only when coverage
    // shrinks: a pack losing its notes, or the glob above matching nothing.
    // 168 notes sat on something other than a verb when this was written.
    const policed = new Set(
      everyEntry()
        .filter(({ entry }) => entry.note && entry.pos !== 'verb')
        .map(({ pack, entry }) => `${pack} ${entry.tgtLemma} ${entry.note}`),
    );

    assert.ok(
      policed.size >= 100,
      `only ${policed.size} notes sit on a word that is not a verb, so the rule above inspects almost nothing`,
    );
  });
});
