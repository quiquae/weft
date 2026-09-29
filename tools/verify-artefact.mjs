#!/usr/bin/env node
/**
 * Stamp one artefact as verified at the current tree.
 *
 *   npm run artefacts:verify -- "store listing screenshots"
 *
 * `artefacts:check` dates an artefact by the last commit that touched its
 * own committed paths. A regeneration that reproduces the same bytes commits
 * nothing, so that date never moves — a group already confirmed correct
 * reports exactly the same staleness forever, however many times someone
 * checks it. This writes a small manifest file under `docs/artefacts/`
 * instead; *that* commit is a real change `checkArtefacts` can see.
 *
 * This tool does not check anything itself, and cannot: whether a
 * regeneration actually came back byte-identical is a judgement only the
 * caller can make, by running the `regenerate` command `artefacts:check`
 * prints and diffing the result. Stamp only after actually looking — a
 * stamp is a claim that somebody did.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { VERSION } from '../manifest.config.mjs';
import { artefactsFor, artefactManifestPath } from './artefacts.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const name = process.argv[2];

function listKnown() {
  console.error('\nKnown artefacts:');
  for (const a of artefactsFor(VERSION)) console.error(`  ${a.name}`);
}

if (!name) {
  console.error('Usage: npm run artefacts:verify -- "<artefact name>"');
  listKnown();
  process.exit(1);
}

const artefact = artefactsFor(VERSION).find((a) => a.name === name);
if (!artefact) {
  console.error(`No artefact named "${name}".`);
  listKnown();
  process.exit(1);
}

const relPath = artefactManifestPath(artefact.name);
const stamp = {
  artefact: artefact.name,
  verifiedAt: new Date().toISOString(),
  note: 'Regenerated and compared against the committed files; no change to commit.',
};

mkdirSync(dirname(join(ROOT, relPath)), { recursive: true });
writeFileSync(join(ROOT, relPath), `${JSON.stringify(stamp, null, 2)}\n`);

console.log(`Wrote ${relPath}.`);
console.log('Commit it — the commit is the part checkArtefacts actually reads.');
