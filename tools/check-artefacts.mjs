#!/usr/bin/env node
/**
 * Report which committed artefacts the tree has moved past.
 *
 *   npm run artefacts:check
 *
 * Deliberately *not* part of `npm run test:all`. Every commit that touches
 * `src/` makes the screenshots stale, and every commit at all makes the
 * release notes stale, so wiring this into the per-PR gate would turn it red
 * on almost every pull request — and a gate that is usually red is a gate
 * nobody reads. The two moments it has teeth are both in `docs/SUBMIT.md`:
 * immediately before `git push origin v1.0.1`, and immediately before
 * uploading the listing art. It is called out at both.
 *
 * Exit 1 when anything is stale, missing, or cannot be dated. "Cannot tell"
 * is not "fine" for a check whose whole job is to be run before something
 * irreversible.
 *
 * The reasoning about why this asks about provenance rather than content is
 * in `tools/artefacts.ts`.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../manifest.config.mjs';
import { artefactsFor, checkArtefacts, formatReport } from './artefacts.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const report = checkArtefacts(ROOT, artefactsFor(VERSION));

console.log(`\nGenerated artefacts committed in this tree, at version ${VERSION}:\n`);
console.log(formatReport(report));

const unresolved = report.results.filter((r) => r.state !== 'fresh');
if (unresolved.length) {
  console.log(
    '\nStale does not mean wrong. It means nobody has checked since the\n' +
      'sources moved, so the artefact describes an older tree. Regenerate\n' +
      'before anything is published from it.\n',
  );
  process.exit(1);
}
console.log('\nEvery generated artefact is newer than everything it is generated from.\n');
