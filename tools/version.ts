/**
 * Every place the version is written, and the one function that moves it.
 *
 * `VERSION` in `manifest.config.mjs` is the version, and everything that
 * builds reads it there. But npm reads its own copy in `package.json`, and
 * `package-lock.json` repeats the root package's version twice, at `version`
 * and at `packages[""].version`. `tools/release.mjs` wrote the first two by
 * hand and did not know of the lockfile, so from the day 1.0.1 was cut the
 * lockfile said 1.0.0. `npm ci` does not read those fields, so CI passed;
 * `npm install` rewrites them, so anyone who ran it was left with a dirty
 * tree, which the release script refuses.
 *
 * So the release script calls `writeVersion()`, and
 * `tests/tools/version.test.ts` holds every copy in the tree to `VERSION`.
 * A copy the writer cannot find is an error, never a copy passed over: the
 * script's own `replace()` would have done nothing, silently, had the
 * declaration been reworded.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** The files that carry the version, relative to the repository root. */
export const VERSION_FILES = ['manifest.config.mjs', 'package.json', 'package-lock.json'] as const;

export interface VersionCopy {
  file: (typeof VERSION_FILES)[number];
  field: string;
  /** As written; undefined where the field is missing. */
  version: string | undefined;
}

const DECLARATION = /export const VERSION = '([^']*)'/;

const read = (root: string, file: string): string => readFileSync(join(root, file), 'utf8');

/**
 * JSON written back as npm writes it: two-space indent and a final newline.
 * Both files round-trip through it byte for byte, so a bump moves one line
 * per copy and nothing else.
 */
const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n';

/** Every copy of the version in the tree rooted at `root`, read as written. */
export function readVersions(root: string): VersionCopy[] {
  const pkg = JSON.parse(read(root, 'package.json'));
  const lock = JSON.parse(read(root, 'package-lock.json'));
  return [
    { file: 'manifest.config.mjs', field: 'VERSION', version: read(root, 'manifest.config.mjs').match(DECLARATION)?.[1] },
    { file: 'package.json', field: 'version', version: pkg.version },
    { file: 'package-lock.json', field: 'version', version: lock.version },
    { file: 'package-lock.json', field: 'packages[""].version', version: lock.packages?.['']?.version },
  ];
}

/**
 * Write `version` into every copy under `root`, changing nothing else.
 *
 * Everything is read and checked before anything is written, so a file whose
 * copy cannot be found leaves all three as they were.
 */
export function writeVersion(root: string, version: string): void {
  const config = read(root, 'manifest.config.mjs');
  if (!DECLARATION.test(config)) {
    throw new Error("manifest.config.mjs declares no `export const VERSION = '…'` to bump");
  }
  const pkg = JSON.parse(read(root, 'package.json'));
  if (typeof pkg.version !== 'string') throw new Error('package.json has no version to bump');
  const lock = JSON.parse(read(root, 'package-lock.json'));
  if (typeof lock.version !== 'string' || typeof lock.packages?.['']?.version !== 'string') {
    throw new Error('package-lock.json has no root version, at version and packages[""].version, to bump');
  }

  pkg.version = version;
  lock.version = version;
  lock.packages[''].version = version;
  writeFileSync(join(root, 'manifest.config.mjs'), config.replace(DECLARATION, `export const VERSION = '${version}'`));
  writeFileSync(join(root, 'package.json'), json(pkg));
  writeFileSync(join(root, 'package-lock.json'), json(lock));
}
