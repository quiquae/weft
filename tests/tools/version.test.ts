/**
 * The version is written in four places, and they must say one thing.
 *
 * `CLAUDE.md` lists it among the things never touched: the version lives in
 * `VERSION` in `manifest.config.mjs`, with `package.json` kept in step by
 * `tools/release.mjs`. Nothing held it, and it was already false. The root
 * package's version is in `package-lock.json` too, twice, and the bump that
 * cut 1.0.1 moved the other two and left both of those at 1.0.0. `npm ci`
 * does not read them, so CI never said so; `npm install` rewrites them, so a
 * contributor who ran it was left with a dirty tree, which `npm run release`
 * refuses.
 *
 * The bump is a function now, `writeVersion()` in `tools/version.ts`, and the
 * release script calls it. These tests run it on a copy of the three files in
 * a temporary directory; they must never write into the tree.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { VERSION_FILES, readVersions, writeVersion } from '../../tools/version.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

// The manifest is the one source of truth; it is imported dynamically because
// a static import of an untyped .mjs from a .ts test is TS7016.
const manifest = await import(pathToFileURL(join(ROOT, 'manifest.config.mjs')).href);
const VERSION: string = manifest.VERSION;

/** Run `body` against a copy of every file that carries the version. */
function withCopy(body: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'weft-version-'));
  try {
    for (const file of VERSION_FILES) copyFileSync(join(ROOT, file), join(dir, file));
    body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Every line of every version file, keyed by file and line number. */
function lines(dir: string): Map<string, string> {
  const all = new Map<string, string>();
  for (const file of VERSION_FILES) {
    readFileSync(join(dir, file), 'utf8')
      .split('\n')
      .forEach((line, i) => all.set(`${file}:${i + 1}`, line));
  }
  return all;
}

describe('the version', () => {
  test('every copy in the tree is VERSION', () => {
    const copies = readVersions(ROOT);
    assert.ok(copies.length >= 4, `only ${copies.length} copies of the version were read`);
    const stale = copies
      .filter((c) => c.version !== VERSION)
      .map((c) => `${c.file} ${c.field} says ${c.version ?? 'nothing'}`);
    assert.deepEqual(
      stale,
      [],
      `VERSION is ${VERSION}; run npm run release -- --version=X.Y.Z to move every copy, never an editor`,
    );
  });

  test('a bump writes every copy and changes no other line', () => {
    withCopy((dir) => {
      const before = lines(dir);
      writeVersion(dir, '9.8.7');
      const after = lines(dir);

      const unmoved = readVersions(dir)
        .filter((c) => c.version !== '9.8.7')
        .map((c) => `${c.file} ${c.field} says ${c.version ?? 'nothing'}`);
      assert.deepEqual(unmoved, [], 'the bump left a copy behind');

      // One line per copy: a bump that reformats a file, or touches anything
      // but the version, turns a four-line release diff into a rewrite.
      assert.equal(after.size, before.size, 'the bump added or removed lines');
      const moved = [...after].filter(([at, line]) => before.get(at) !== line).map(([at]) => at);
      assert.equal(
        moved.length,
        readVersions(dir).length,
        `the bump moved ${moved.length} lines: ${moved.slice(0, 6).join(', ')}${moved.length > 6 ? ', …' : ''}`,
      );
    });
  });

  test('a declaration the bump cannot find fails it, rather than being passed over', () => {
    withCopy((dir) => {
      const config = join(dir, 'manifest.config.mjs');
      writeFileSync(config, readFileSync(config, 'utf8').replace('export const VERSION', 'export const RELEASE'));
      assert.throws(() => writeVersion(dir, '9.8.7'), /manifest\.config\.mjs/);
    });
    withCopy((dir) => {
      const lock = join(dir, 'package-lock.json');
      const json = JSON.parse(readFileSync(lock, 'utf8'));
      delete json.packages[''];
      writeFileSync(lock, JSON.stringify(json, null, 2) + '\n');
      assert.throws(() => writeVersion(dir, '9.8.7'), /package-lock\.json/);
    });
  });

  test('tools/release.mjs bumps through writeVersion, and writes no copy itself', () => {
    const release = readFileSync(join(ROOT, 'tools/release.mjs'), 'utf8');
    assert.ok(release.includes("from './version.ts'"), 'tools/release.mjs does not import tools/version.ts');
    assert.ok(release.includes('writeVersion(ROOT, version)'), 'tools/release.mjs never calls writeVersion');
    // It opened manifest.config.mjs and package.json by name and wrote each
    // itself, which is how it came to know of two copies and not four.
    for (const file of VERSION_FILES) {
      assert.ok(!release.includes(`join(ROOT, '${file}')`), `tools/release.mjs opens ${file} itself`);
    }
  });
});
