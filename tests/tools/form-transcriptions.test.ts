/**
 * A transcription a pack prints is of the form it is printed under.
 *
 * The tooltip heads a card with the woven word, and its "sound" row is the
 * `ipa` of the pack row that wove it. The seed had one transcription per row,
 * of its headword, and `tools/build-pack.mjs` copied it onto the row of the
 * second form as well — the plural of a noun, the participle of a verb — so on
 * 2026-10-04 the Old English pack printed /ˈmɑnː/ under *menn*, /ˈtʃild/ under
 * *ċildru* and /ˈseːtʃɑn/ under *sēċende* on 206 rows, and the Latin pack
 * /ˈwɪr/ under *virī* on 223. The tooltip never shows the headword beside the
 * sound, so each is a claim about the word on the page, and a false one.
 *
 * The rule reads the shipped packs rather than the seed, because the defect
 * was in the step between them: two spellings of one word never print one
 * transcription, and one spelling never prints two. A plural spelled as its
 * singular, Old English `hūs` beside `hūs`, prints the same sound under both,
 * as it should. A second form whose seed row writes no transcription of it
 * prints none, which is silence rather than a claim, and is not policed here.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKS = fileURLToPath(new URL('../../src/lexicon/packs/', import.meta.url));

type Row = { src: string; tgt: string; tgtLemma: string; ipa?: string };

/** Every transcribed row of every pack, by language and then by the word's card id. */
const words = new Map<string, Map<string, Row[]>>();
for (const file of readdirSync(PACKS).filter((f) => /^en-[a-z]{2,3}\.json$/.test(f))) {
  const pack = JSON.parse(readFileSync(join(PACKS, file), 'utf8')) as { entries: Record<string, Row[]> };
  const byWord = new Map<string, Row[]>();
  for (const row of Object.values(pack.entries).flat()) {
    if (!row.ipa) continue;
    byWord.set(row.tgtLemma, [...(byWord.get(row.tgtLemma) ?? []), row]);
  }
  words.set(file.slice(3, -5), byWord);
}

/** The distinct `from` values of `rows` grouped under each distinct `by` value. */
function grouped(rows: Row[], by: (r: Row) => string, from: (r: Row) => string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const row of rows) out.set(by(row), (out.get(by(row)) ?? new Set()).add(from(row)));
  return out;
}

function report(offenders: string[], what: string): void {
  assert.deepEqual(
    offenders.slice(0, 30),
    [],
    `${offenders.length} words ${what}:\n  ${offenders.slice(0, 30).join('\n  ')}`,
  );
}

describe('every transcription a pack prints is of the form it is printed under', () => {
  test('no two spellings of one word print one transcription', () => {
    const offenders: string[] = [];
    for (const [lang, byWord] of words) {
      for (const [word, rows] of byWord) {
        for (const [ipa, tgts] of grouped(rows, (r) => r.ipa as string, (r) => r.tgt)) {
          if (tgts.size > 1) offenders.push(`${lang}:${word} prints ${ipa} under ${[...tgts].join(' and ')}`);
        }
      }
    }
    report(offenders, 'print one transcription under two spellings, so at least one is of another form');
  });

  test('no spelling of a word prints two transcriptions', () => {
    const offenders: string[] = [];
    for (const [lang, byWord] of words) {
      for (const [word, rows] of byWord) {
        for (const [tgt, ipas] of grouped(rows, (r) => r.tgt, (r) => r.ipa as string)) {
          if (ipas.size > 1) offenders.push(`${lang}:${word} prints ${[...ipas].join(' and ')} under ${tgt}`);
        }
      }
    }
    report(offenders, 'print two transcriptions under one spelling');
  });

  test('the rule has something to police', () => {
    // Without a floor the first test passes on a pack whose second forms print
    // no transcription at all, which is what a builder that stops reading the
    // second form's column would ship. Old English transcribes 204 words under
    // two spellings each, as of 2026-10-04, and Latin 218.
    assert.equal(words.size, 7, `read ${words.size} packs`);
    for (const [lang, name] of [
      ['ang', 'Old English'],
      ['la', 'Latin'],
    ] as const) {
      const twoSpellings = [...(words.get(lang) ?? new Map<string, Row[]>()).values()].filter(
        (rows) => new Set(rows.map((r) => r.tgt)).size > 1,
      );
      assert.ok(twoSpellings.length > 150, `only ${twoSpellings.length} ${name} words print a sound under two spellings`);
    }
  });
});
