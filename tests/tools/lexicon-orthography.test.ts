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
 * The second guard is the documents that quote Latin headwords at a reader. It
 * stops short of sweeping every document because Latin and English are full of
 * homographs — `docs/LAUNCH.md` says a Show HN post "dies" and
 * `docs/PRIVACY.md` says "your OS", which collide with `diēs` and `ōs` and have
 * nothing to do with the lexicon. Same reasoning as above: a general scan of
 * English prose fires for the wrong reason. But the boundary is drawn by
 * measurement, not by assumption, and it had only ever been measured against
 * those two: adding `site/index.html` and `docs/STORE-LISTING.md` turns out to
 * fire nothing at all, so both are in — the landing page and the copy that goes
 * to Google are the last two places a misspelling should survive.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * The documents that quote Latin headwords at a reader, rather than mentioning
 * Latin. `site/index.html` and `docs/STORE-LISTING.md` were added after being
 * measured rather than assumed: adding them plus `docs/LAUNCH.md` fires exactly
 * one offender, and it is the known homograph below, so the first two are clean
 * and the third stays out.
 */
const PROSE = [
  'README.md',
  'docs/PEDAGOGY.md',
  'tools/build-site.mjs',
  'site/index.html',
  'docs/STORE-LISTING.md',
];

/**
 * Latin that Weft writes down but the lexicon never defines.
 *
 * Both guards below derive their vocabulary from the packs, so they can only
 * police a word the lexicon contains — and the prose is free to reach for Latin
 * it never glosses. `peninsula` is explained as `paene īnsula` in four source
 * files and `īnsula` is not an entry, so every one of them was invisible: the
 * note under `paene`, the seed comment above it, `README.md` and
 * `docs/PEDAGOGY.md`. That note alone reaches three surfaces — the shipped
 * tooltip, `/latin/paene`, and the `latin-words-in-everyday-english` hub —
 * while `docs/LAUNCH.md` and `site/index.html` had the macron all along.
 *
 * Unlike the headword list, this one is applied across every note rather than
 * only to the entry that owns it, and that is safe *because* it is hand-picked:
 * the 14 false positives that rule out a pack-wide headword scan are English
 * homographs (`an`, `is`, `dead`, `ham`), and a word only enters this table once
 * someone has checked it is not one. Add to it when prose gains a Latin word the
 * lexicon does not carry.
 *
 * `homō` and `clāvicula` joined it when the notes under `vir` and `clāvis` were
 * rewritten to name them. Neither is a headword, and neither bare spelling
 * occurs in any note or in the prose scanned below — which is what makes each
 * safe to police everywhere. The match is case-sensitive, so the genus in
 * "Homo sapiens" is not the Latin noun misspelled.
 */
const UNDEFINED: ReadonlyMap<string, string> = new Map([
  ['insula', 'īnsula'],
  ['homo', 'homō'],
  ['clavicula', 'clāvicula'],
]);

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

        for (const [stripped, headword] of [...headwords([entry]), ...UNDEFINED]) {
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
    const latin = new Map([...headwords(pack('la')), ...UNDEFINED]);
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

/**
 * A note quotes with the same marks the site's own prose does.
 *
 * Latin and Old English were seeded with a straight `"`; French was seeded with
 * curly `“ ”`; the other five packs carry no notes at all. Reading all 59
 * straight-quoted notes shows this is not two different jobs — both packs quote
 * target-language citation forms (`"mann"`, `"frēon"`) *and* English descendant
 * words (`"muscle"`, `"despair"`, `"hopeless"`, `"warden"`), the same mix French
 * writes in curly, so the split tracks which pack a note was typed into rather
 * than what kind of word it names. `site/index.html` uses curly quotes 24 times
 * in running prose and straight none, so curly is the site's own convention;
 * unifying on it, rather than leaving two conventions, is what this guard now
 * holds. The note itself is plain text — `tooltip.ts`'s `el()` sets
 * `textContent`, not `innerHTML` — so a curly quote is a content change only,
 * with nothing to escape and no markup to add.
 */
const ALL_LANGS = readdirSync(join(ROOT, 'src/lexicon/packs'))
  .filter((f) => f.startsWith('en-') && f.endsWith('.json'))
  .map((f) => f.slice('en-'.length, -'.json'.length));

describe('a lexicon note quotes with the same marks the site itself does', () => {
  test('no pack note contains a straight double quote', () => {
    const offenders: string[] = [];

    for (const lang of ALL_LANGS) {
      for (const entry of pack(lang)) {
        const { note = '', tgtLemma = '', src = '?' } = entry;
        if (note.includes('"')) {
          offenders.push(`en-${lang} ${src} → ${tgtLemma}: ${note}`);
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `${offenders.length} notes quote with a straight " where the site's own prose uses curly “ ”:\n  ${offenders.join('\n  ')}`,
    );
  });

  test('the guard has something to police', () => {
    assert.ok(ALL_LANGS.length >= 7, `expected at least 7 packs, found ${ALL_LANGS.length}`);
  });
});
