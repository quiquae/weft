#!/usr/bin/env node
/**
 * Fold tools/seed/fr-cousins.tsv into the etymon and note columns of
 * tools/seed/lex-fr.tsv.
 *
 *   npm run cousins                  # fill empty fields; name everything else
 *   npm run cousins -- --force       # make lex-fr.tsv say what fr-cousins.tsv says
 *   npm run cousins -- --dry         # report only; exit 1 if anything would change
 *
 * Kept as a merge step rather than hand-editing the lexicon because the two
 * files answer different questions. lex-fr.tsv is the translation table and
 * changes when a gloss is wrong; fr-cousins.tsv is the etymology and changes
 * when someone checks a claim. Mixing them means every etymology review has
 * to read 356 rows of vocabulary to find the nine that matter.
 *
 * Without --force it only fills empty fields. A field holding something
 * other than its claim, or a value fr-cousins.tsv no longer claims, is left
 * alone — which of the two files is right is a question for a person — but
 * it is named, and the run exits 1, because each is an edit to the review
 * file that has not reached the pack.
 *
 * That used to be silent, and the old version of this comment said so: a
 * corrected claim was counted with the untouched ones as "left alone
 * (already had a value)", and a deleted claim was not looked for at all, so
 * both printed exactly what an in-step tree prints and exited 0. --force
 * settles every such field in fr-cousins.tsv's favour, overwriting and
 * clearing, and lists each one it changed.
 *
 * A claim that does not cite the dictionary entry for every word it names
 * is refused outright, with or without --force, and named with the entries
 * it lacks. --force decides which of two files is right; whether a claim was
 * ever checked is a question neither file can answer for the other.
 *
 * tests/tools/cousins.test.ts checks that the committed lexicon is a fixed
 * point of this merge, which is what turns a forgotten run into a red CI
 * rather than a claim that silently never ships. How each field is sorted is
 * in tools/cousins.ts.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeCousins } from './cousins.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEX = join(ROOT, 'tools/seed/lex-fr.tsv');
const COUSINS = join(ROOT, 'tools/seed/fr-cousins.tsv');
const dry = process.argv.includes('--dry');
const force = process.argv.includes('--force');

const before = await readFile(LEX, 'utf8');
const r = mergeCousins(before, await readFile(COUSINS, 'utf8'), { force });

const column = (d) => (d.kind === 'descent' ? 'etymon' : 'note');
function list(drifts) {
  for (const d of drifts) {
    console.error(`  lex-fr.tsv:${d.line}  ${d.lemma} (${column(d)})`);
    console.error(`    lex-fr.tsv      ${d.lexicon || '(empty)'}`);
    console.error(`    fr-cousins.tsv  ${d.claim || '(no claim)'}`);
  }
}

const added = (kind) => r.added.filter((d) => d.kind === kind).length;
console.log(`${added('descent')} etymons, ${added('cousin')} notes added`);
console.log(`${r.inStep} already in step`);

if (r.disagree.length) {
  console.error(`\n${r.disagree.length} disagree with fr-cousins.tsv, ${force ? 'overwritten' : 'left alone'}:`);
  list(r.disagree);
}
if (r.unclaimed.length) {
  console.error(`\n${r.unclaimed.length} no longer claimed by fr-cousins.tsv, ${force ? 'cleared' : 'left alone'}:`);
  list(r.unclaimed);
}
if (!force && (r.disagree.length || r.unclaimed.length)) {
  console.error('\nEach is an edit to fr-cousins.tsv that has not reached the pack. If fr-cousins.tsv is');
  console.error('right, re-run with --force. If lex-fr.tsv is, move the value into fr-cousins.tsv.');
}

/*
 * A lemma in the cousin file that matches nothing in the lexicon is a typo,
 * not a no-op. Silently dropping it is how half the etymology quietly fails
 * to ship while the file looks complete.
 */
if (r.unmatched.length) {
  console.error(`\n${r.unmatched.length} lemma(s) in fr-cousins.tsv match no row in lex-fr.tsv:`);
  for (const c of r.unmatched) console.error(`  fr-cousins.tsv:${c.line}  ${c.lemma}`);
  console.error('\nEach is a claim that will not ship. Fix the spelling or remove the line.');
}
if (r.malformed.length) {
  console.error(`\n${r.malformed.length} line(s) in fr-cousins.tsv cannot ship as written:`);
  for (const m of r.malformed) console.error(`  fr-cousins.tsv:${m.line}  ${m.reason}`);
}

if (dry) {
  console.log('\n(dry run — nothing written)');
} else if (r.text !== before) {
  await writeFile(LEX, r.text);
  console.log('\nwrote tools/seed/lex-fr.tsv — now run npm run packs');
} else {
  console.log('\nlex-fr.tsv unchanged');
}

// A dry run fails on anything a merge would change. A real run fails on
// anything it was not allowed to settle, so a claim that did not land can
// never exit 0. exitCode rather than exit(), which can cut off output still
// queued for a pipe.
const refused = r.unmatched.length + r.malformed.length + (force ? 0 : r.disagree.length + r.unclaimed.length);
const pending = r.added.length + r.disagree.length + r.unclaimed.length + r.unmatched.length + r.malformed.length;
process.exitCode = (dry ? pending : refused) ? 1 : 0;
