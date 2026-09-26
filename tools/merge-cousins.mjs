#!/usr/bin/env node
/**
 * Fold tools/seed/fr-cousins.tsv into the etymon and note columns of
 * tools/seed/lex-fr.tsv.
 *
 *   node tools/merge-cousins.mjs           # write
 *   node tools/merge-cousins.mjs --dry     # report only
 *
 * Kept as a merge step rather than hand-editing the lexicon because the two
 * files answer different questions. lex-fr.tsv is the translation table and
 * changes when a gloss is wrong; fr-cousins.tsv is the etymology and changes
 * when someone checks a claim. Mixing them means every etymology review has
 * to read 356 rows of vocabulary to find the nine that matter.
 *
 * Refuses to overwrite an existing value: if a row already carries an etymon
 * or a note, whoever wrote it there knew something this file does not.
 *
 * Which makes the tool non-idempotent in one specific and predictable case —
 * correcting a claim. Once the merged values are committed, editing
 * fr-cousins.tsv and re-running does nothing at all, silently, and the
 * correction appears to have been applied. --force exists for that, and only
 * that: it overwrites values that this file is the source of.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEX = join(ROOT, 'tools/seed/lex-fr.tsv');
const COUSINS = join(ROOT, 'tools/seed/fr-cousins.tsv');
const dry = process.argv.includes('--dry');
const force = process.argv.includes('--force');

/** lemma -> { descent?: string, cousin?: string } */
const wanted = new Map();
for (const line of (await readFile(COUSINS, 'utf8')).split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  const [lemma, kind, value] = line.split('\t');
  if (!lemma || !kind || !value) continue;
  const entry = wanted.get(lemma) ?? {};
  entry[kind.trim()] = value.trim();
  wanted.set(lemma.trim(), entry);
}

const lines = (await readFile(LEX, 'utf8')).split('\n');
const out = [];
let etymonsAdded = 0;
let notesAdded = 0;
let skippedExisting = 0;
const matched = new Set();

for (const line of lines) {
  if (!line.trim() || line.startsWith('#')) {
    out.push(line);
    continue;
  }
  const cols = line.split('\t');
  // lemma | pos | tgt | tgt2 | gender | ipa | etymon | note
  while (cols.length < 8) cols.push('');
  const lemma = (cols[0] ?? '').trim();
  const want = wanted.get(lemma);
  if (!want) {
    out.push(cols.join('\t'));
    continue;
  }
  matched.add(lemma);

  if (want.descent) {
    if (cols[6] && !force) skippedExisting++;
    else {
      const changed = cols[6] !== want.descent;
      cols[6] = want.descent;
      if (changed) etymonsAdded++;
    }
  }
  if (want.cousin) {
    if (cols[7] && !force) skippedExisting++;
    else {
      const changed = cols[7] !== want.cousin;
      cols[7] = want.cousin;
      if (changed) notesAdded++;
    }
  }
  out.push(cols.join('\t'));
}

/*
 * A lemma in the cousin file that matches nothing in the lexicon is a typo,
 * not a no-op. Silently dropping it is how half the etymology quietly fails
 * to ship while the file looks complete.
 */
const unmatched = [...wanted.keys()].filter((l) => !matched.has(l));

console.log(`${etymonsAdded} etymons, ${notesAdded} notes added`);
if (skippedExisting) console.log(`${skippedExisting} left alone (already had a value)`);
if (unmatched.length) {
  console.error(`\n${unmatched.length} lemma(s) in fr-cousins.tsv match no row in lex-fr.tsv:`);
  for (const l of unmatched) console.error(`  ${l}`);
  console.error('\nEach is a claim that will not ship. Fix the spelling or remove the line.');
}

if (!dry) {
  await writeFile(LEX, out.join('\n'));
  console.log(`\nwrote ${LEX.replace(ROOT + '/', '')}`);
} else {
  console.log('\n(dry run — nothing written)');
}

process.exit(unmatched.length ? 1 : 0);
