#!/usr/bin/env node
/**
 * Verify the seed lexicons and the built packs.
 *
 * Runs in CI. Catches the classes of mistake that a human proof-reader misses
 * in a 350-row TSV but that a reader will notice immediately on a live page:
 *
 *  - A target that *contains* the English word without being identical to it.
 *    This is the signature of a paste slip ("felizhappy" for "feliz") and it
 *    is invisible when scanning a column of correct-looking Portuguese.
 *  - One target reused across many unrelated English words, which is what a
 *    copy-paste-down accident looks like.
 *  - Characters outside a language's expected script, which catches a row
 *    landing in the wrong file.
 *  - Historical-language rows with no IPA, which would ship a word the reader
 *    has no way to pronounce and no voice to read it.
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spelling } from '../src/core/lexicon.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = join(ROOT, 'tools/seed');
const PACKS = join(ROOT, 'src/lexicon/packs');

const HISTORICAL = new Set(['la', 'ang', 'enm', 'non', 'grc', 'got']);

/** Characters each language may legitimately use, beyond ASCII letters. */
const SCRIPT_EXTRAS = {
  fr: 'àâäçéèêëîïôöùûüÿœæ’-',
  es: 'áéíóúüñ¿¡-',
  de: 'äöüß-',
  it: 'àèéìòóù’-',
  pt: 'áâãàçéêíóôõú-',
  la: 'āēīōūȳăĕĭŏŭæœ-',
  ang: 'āēīōūȳǣþðæƿċġ-',
  enm: 'āēīōūþðȝſæ-',
  non: 'áéíóúýæøǫþð-',
  grc: 'Ͱ-Ͽἀ-῿',
  got: 'āēīōūþƕ-',
};

/** Compare words ignoring diacritics, so "route" matches "route". */
function fold(word) {
  return String(word)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

let errors = 0;
let warnings = 0;
const fail = (m) => {
  errors++;
  console.error(`  ERROR ${m}`);
};
const warn = (m) => {
  warnings++;
  console.warn(`  warn  ${m}`);
};

function parse(text) {
  return text
    .split('\n')
    .map((l, i) => ({ line: i + 1, text: l.replace(/\r$/, '') }))
    .filter((r) => r.text.trim() && !r.text.startsWith('#'))
    .map((r) => ({ line: r.line, cols: r.text.split('\t') }));
}

async function verifySeed(lang) {
  const file = join(SEED, `lex-${lang}.tsv`);
  const rows = parse(await readFile(file, 'utf8'));
  const targetUse = new Map();
  const multiWord = [];
  const extras = SCRIPT_EXTRAS[lang] ?? '';
  // German capitalizes every noun, so Überzeugung needs Ü as well as ü.
  const letters = `${extras}${extras.toUpperCase()}`.replace(/-/g, '\\-');
  const allowed = new RegExp(`^[a-zA-Z ${letters}]+$`, 'u');

  for (const { line, cols } of rows) {
    // etymon and note were never destructured, so no check had ever looked
    // at either column — including Old English's 544 etymons.
    const [lemma, pos, cell, tgt2, gender, ipa, etymon, note] = cols;
    const where = `lex-${lang}.tsv:${line} ${lemma} (${pos})`;
    if (!cell) continue;
    if (cell !== cell.trim()) fail(`${where}: target has surrounding whitespace`);
    // `hund²` is the second word spelled hund: the number is the card's
    // identity, and every check below is about the spelling.
    const tgt = spelling(cell);

    // Distinguishing a paste slip from a cognate: a real cognate *starts*
    // with (or shares a stem with) the English word — "persona", "foresta",
    // "beginnen", "mover". A slip *ends* with the English word, appended
    // after an already-complete foreign word: "felizhappy", "casahouse".
    const lem = String(lemma).toLowerCase();
    for (const [label, value] of [['target', tgt], ['plural', tgt2]]) {
      if (!value || lem.length < 4) continue;
      const lower = value.toLowerCase();
      if (lower === lem) continue;
      const endsWithEnglish = lower.endsWith(lem) && !lower.startsWith(lem);
      const prefix = lower.slice(0, lower.length - lem.length);
      if (endsWithEnglish && prefix.length >= 3) {
        fail(`${where}: ${label} "${value}" ends with the English word after "${prefix}" — paste slip?`);
      }
      if (lower.includes(lem) && lower.length > lem.length + 8) {
        fail(`${where}: ${label} "${value}" contains the English word and is suspiciously long`);
      }
    }

    if (!allowed.test(tgt)) {
      warn(`${where}: target "${tgt}" has characters outside the expected script for ${lang}`);
    }

    if (HISTORICAL.has(lang) && !ipa) {
      warn(`${where}: no IPA, and ${lang} has no speech-synthesis voice`);
    }
    if (gender && !'mfnc'.includes(gender)) fail(`${where}: bad gender "${gender}"`);

    /*
     * A note that claims kinship must not name the target as its own
     * relative.
     *
     * "route — shares a root with English “route”" is circular and tells
     * nobody anything, and it reaches the discoveries feed verbatim.
     *
     * The first version of this check flagged any note quoting the target
     * and failed on 21 correct ones: «"wīf" meant woman generally, and was
     * neuter» quotes the target in order to DEFINE it, which is both
     * natural and the most interesting thing about the word. Naming the
     * word you are explaining is fine; claiming it is related to itself is
     * not. Only the relationship phrasings are checked.
     */
    if (note && /\b(root|related|comes? from|descend|ancestor)\b/i.test(note)) {
      for (const match of note.matchAll(/[“"]([^”"]+)[”"]/g)) {
        const quoted = fold(match[1] ?? '');
        if (quoted && quoted === fold(tgt)) {
          fail(
            `${where}: note claims kinship with "${match[1]}", which is the target ` +
              'itself — name the English relative instead',
          );
        }
      }
    }

    // Multi-word targets are legitimate ("au revoir", "por favor") but they
    // read awkwardly under a single underline, so list them for review.
    if (tgt.includes(' ')) multiWord.push(`${lemma}/${pos} -> ${tgt}`);

    const key = tgt.toLowerCase();
    const uses = targetUse.get(key) ?? [];
    uses.push(`${lemma}/${pos}`);
    targetUse.set(key, uses);
  }

  // One target for several unrelated English words is sometimes right
  // (French "terre" for both earth and land) but four or more is a slip.
  for (const [tgt, uses] of targetUse) {
    if (uses.length >= 4) {
      warn(`lex-${lang}.tsv: "${tgt}" is the target for ${uses.length} entries (${uses.join(', ')})`);
    }
  }

  if (multiWord.length) {
    console.log(`        ${multiWord.length} multi-word targets: ${multiWord.slice(0, 5).join('; ')}${multiWord.length > 5 ? ' …' : ''}`);
  }

  return rows.length;
}

async function verifyPack(file) {
  const raw = await readFile(join(PACKS, file), 'utf8');
  let pack;
  try {
    pack = JSON.parse(raw);
  } catch (err) {
    fail(`${file}: not valid JSON (${err.message})`);
    return;
  }
  const { meta, entries } = pack;
  if (!meta || !entries) return fail(`${file}: missing meta or entries`);
  if (!meta.attribution?.length) fail(`${file}: no attribution — required by CC BY-SA`);
  if (!meta.license) fail(`${file}: no license field`);

  let count = 0;
  for (const [surface, list] of Object.entries(entries)) {
    if (surface !== surface.toLowerCase()) fail(`${file}: key "${surface}" is not lowercased`);
    if (!Array.isArray(list) || !list.length) fail(`${file}: key "${surface}" has no entries`);
    for (const e of list) {
      count++;
      if (e.src !== surface) fail(`${file}: ${surface}: entry.src is "${e.src}"`);
      if (!e.tgt) fail(`${file}: ${surface}: empty target`);
      if (!(e.conf > 0 && e.conf <= 1)) fail(`${file}: ${surface}: conf ${e.conf} out of range`);
      if (!(e.band >= 1 && e.band <= 6)) fail(`${file}: ${surface}: band ${e.band} out of range`);
      if (!(e.zipf >= 1 && e.zipf <= 7.5)) fail(`${file}: ${surface}: zipf ${e.zipf} out of range`);
      if (!e.tgtLemma) fail(`${file}: ${surface}: missing tgtLemma`);
    }
  }
  if (count !== meta.entryCount) {
    fail(`${file}: meta.entryCount is ${meta.entryCount} but found ${count}`);
  }
  console.log(`  ${file}: ${count} entries across ${Object.keys(entries).length} surface forms`);
}

async function main() {
  const seedFiles = (await readdir(SEED)).filter((f) => /^lex-[a-z]{2,3}\.tsv$/.test(f));
  if (!seedFiles.length) {
    console.error('no seed lexicons found');
    process.exit(1);
  }

  console.log('seed lexicons:');
  for (const f of seedFiles.sort()) {
    const lang = f.slice(4, -4);
    const n = await verifySeed(lang);
    console.log(`  lex-${lang}.tsv: ${n} rows`);
  }

  if (existsSync(PACKS)) {
    const packFiles = (await readdir(PACKS)).filter((f) => /^en-[a-z]{2,3}\.json$/.test(f));
    if (packFiles.length) {
      console.log('\nbuilt packs:');
      for (const f of packFiles.sort()) await verifyPack(f);
    } else {
      console.log('\nno built packs yet (run: npm run packs)');
    }
  }

  console.log(`\n${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}`);
  if (errors) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
