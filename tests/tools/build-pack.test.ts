/**
 * The pack builder is the only thing that turns tools/seed/*.tsv into the
 * lexicons the extension ships, and nothing tested it. These tests cover the
 * one property a generator has to have: the same input gives the same output.
 *
 * They run the real tool in a child process against a temporary output
 * directory. They must never write into src/lexicon/packs/ — a test that
 * dirties the tracked packs is the bug it is meant to catch.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TOOL = join(ROOT, 'tools/build-pack.mjs');

// Compared as a lower bound rather than for equality, so a run that straddles
// midnight cannot fail: ISO dates sort lexicographically, and what matters is
// that the stamp is now and not the date the file already carried.
const isoDate = () => new Date().toISOString().slice(0, 10);

// Any date that is not today. A stamp that survives a rebuild proves the
// rebuild read it rather than replacing it with the wall clock.
const LONG_AGO = '2020-01-01';

/** Run the real builder for one language into `out`. */
function build(out: string): void {
  execFileSync(process.execPath, [TOOL, '--lang=fr', `--out=${out}`], { stdio: 'pipe' });
}

function withTempOut(body: (out: string) => void): void {
  const out = mkdtempSync(join(tmpdir(), 'weft-packs-'));
  try {
    body(out);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

const packPath = (out: string) => join(out, 'en-fr.json');
const indexPath = (out: string) => join(out, 'index.json');

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

describe('build-pack stamps content, not the wall clock', () => {
  test('a rebuild that changes nothing changes nothing', () => {
    withTempOut((out) => {
      const day = isoDate();
      build(out);
      const pack = readJson(packPath(out));
      assert.ok(pack.meta.builtAt >= day, 'a first build stamps the current date');

      // Stand in for a pack committed on an earlier day, byte-for-byte as the
      // tool writes them.
      pack.meta.builtAt = LONG_AGO;
      writeFileSync(packPath(out), JSON.stringify(pack) + '\n');
      const committed = readFileSync(packPath(out), 'utf8');

      build(out);

      assert.equal(readJson(packPath(out)).meta.builtAt, LONG_AGO, 'the stamp moved although no lexicon did');
      assert.equal(readFileSync(packPath(out), 'utf8'), committed, 'the rebuilt pack differs from the committed one');
    });
  });

  test('a rebuild whose content differs stamps the day the content changed', () => {
    withTempOut((out) => {
      const day = isoDate();
      build(out);
      const pack = readJson(packPath(out));

      // A pack that no longer matches the seed lexicon, dated as if it had
      // been committed that way.
      pack.meta.builtAt = LONG_AGO;
      const [dropped] = Object.keys(pack.entries) as string[];
      assert.ok(dropped, 'the pack came out with no entries at all');
      delete pack.entries[dropped];
      writeFileSync(packPath(out), JSON.stringify(pack) + '\n');

      build(out);

      const rebuilt = readJson(packPath(out));
      assert.ok(rebuilt.entries[dropped], 'the dropped surface form came back');
      assert.ok(rebuilt.meta.builtAt >= day, 'the content changed, so the stamp must move to now');
    });
  });

  test('the pack index keeps its date as well', () => {
    withTempOut((out) => {
      const day = isoDate();
      build(out);
      const index = readJson(indexPath(out));
      assert.ok(index.builtAt >= day, 'a first build stamps the current date');

      index.builtAt = LONG_AGO;
      writeFileSync(indexPath(out), JSON.stringify(index, null, 2) + '\n');
      const committed = readFileSync(indexPath(out), 'utf8');

      build(out);

      assert.equal(readJson(indexPath(out)).builtAt, LONG_AGO, 'the index stamp moved although no pack did');
      assert.equal(readFileSync(indexPath(out), 'utf8'), committed, 'the rebuilt index differs from the committed one');
    });
  });
});
