/**
 * A tooltip note has to read on its own, because the line above it is optional.
 *
 * The tooltip prints two things under a woven word: an etymon badge
 * ("Ancestor of English **January**") and, beneath it, the pack's note. The
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
 * Deliberately outside the rule: a handful of notes gloss a *common*-noun
 * descendant the same way — `setl` → settle, "the high-backed bench";
 * `nēahgebūr` → neighbour, "the near-dweller". Read alone these still parse
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

type Entry = { src?: string; tgtLemma?: string; etymonOf?: string; note?: string };

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
    // next to "Ancestor of English octave" explains itself. A name is not:
    // *novem* next to "Ancestor of English November" tells the reader nothing
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
