/**
 * A Latin word has to be spelled the same way everywhere Weft shows it.
 *
 * The lexicon marks vowel length, because the IPA is generated from the
 * orthography and is only deterministic once it is marked: the pack's headword
 * for a thousand is `mīlle`. But the *prose around it* was written by hand, so
 * the tooltip note under `mīlle` read "a mile was mille passūs" — the same word,
 * one line apart, spelled two ways — and the same bare `mille` had reached the
 * published meta description of the Latin landing page, `README.md` and
 * `docs/PEDAGOGY.md`. Nothing generates that prose from the lexicon, so nothing
 * could notice.
 *
 * Two guards, because the copy lives in two different kinds of place.
 *
 * The first is the pack notes, which ship: they are tooltip text, sitting
 * directly beneath the headword they contradict. The rule is deliberately
 * narrow — a note may not spell *its own* entry's headword without the macron.
 * Widening it to every headword in the pack makes it fire 14 times on Old
 * English, because headwords collide with ordinary English words that notes
 * legitimately use (`an`, `is`, `dead`, `ham`), and a gate that fails for two
 * different reasons gets ignored. Only `tgtLemma` counts, not `tgt`: the
 * inflected form is often the macron-bearing one (`manus` → `manūs`), and the
 * singular in the note is then correct rather than careless.
 *
 * Its one exemption is a note that shows *both* spellings. That is not drift,
 * it is the point of the note: `mālum` apple and `malum` evil differ only in
 * vowel length, and saying so requires writing both.
 *
 * The second guard is the three documents that quote Latin headwords at a
 * reader. It stops at three rather than sweeping every document because Latin
 * and English are full of homographs — `docs/LAUNCH.md` says a Show HN post
 * "dies" and `docs/PRIVACY.md` says "your OS", which collide with `diēs` and
 * `ōs` and have nothing to do with the lexicon. Same reasoning as above: a
 * general scan of English prose fires for the wrong reason.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** The documents that quote Latin headwords at a reader, rather than mentioning Latin. */
const PROSE = ['README.md', 'docs/PEDAGOGY.md', 'tools/build-site.mjs'];

type Entry = { tgtLemma?: string; note?: string; src?: string };

/** `mīlle` → `mille`. Decompose, drop the combining macron, recompose. */
const bare = (s: string): string => s.normalize('NFD').replace(/̄/g, '').normalize('NFC');

const pack = (lang: string): Entry[] =>
  Object.values(
    JSON.parse(readFileSync(join(ROOT, `src/lexicon/packs/en-${lang}.json`), 'utf8')).entries as Record<
      string,
      Entry[]
    >,
  ).flat();

/** Macron-stripped headword → the way the pack spells it. */
function headwords(entries: Entry[]): Map<string, string> {
  const found = new Map<string, string>();
  for (const { tgtLemma } of entries) {
    for (const word of (tgtLemma ?? '').split(/\s+/)) {
      if (word && bare(word) !== word) found.set(bare(word).toLowerCase(), word);
    }
  }
  return found;
}

/** Whole-word, and not the tail of a hyphenated English suffix like `-ham`. */
const writes = (text: string, word: string): boolean =>
  new RegExp(String.raw`(^|[^\p{L}-])${word}(?![\p{L}])`, 'u').test(text);

describe('a Latin word is spelled the same way everywhere Weft shows it', () => {
  test('a pack note spells its own headword the way the pack does', () => {
    const offenders: string[] = [];

    for (const lang of ['la', 'ang']) {
      for (const entry of pack(lang)) {
        const { note = '', tgtLemma = '', src = '?' } = entry;
        if (!note) continue;

        for (const [stripped, headword] of headwords([entry])) {
          // A note showing both spellings is contrasting vowel length on purpose.
          if (note.includes(headword)) continue;
          if (writes(note, stripped)) {
            offenders.push(`en-${lang} ${src} → ${tgtLemma}: note writes "${stripped}" — ${note}`);
          }
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `${offenders.length} tooltip notes spell their own headword without its macron:\n  ${offenders.join('\n  ')}`,
    );
  });

  test('published prose spells a Latin headword the way the lexicon does', () => {
    const latin = headwords(pack('la'));
    const offenders: string[] = [];

    for (const file of PROSE) {
      const text = readFileSync(join(ROOT, file), 'utf8');
      // Paragraph by paragraph, so a passage contrasting vowel length can show
      // both spellings the way a pack note can.
      for (const para of text.split(/\n\s*\n/)) {
        for (const [stripped, headword] of latin) {
          if (para.includes(headword)) continue;
          if (writes(para, stripped)) {
            offenders.push(`${file}: writes "${stripped}", the lexicon spells it "${headword}"`);
          }
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `${offenders.length} places in published copy disagree with the lexicon's own spelling:\n  ${[...new Set(offenders)].join('\n  ')}`,
    );
  });
});
