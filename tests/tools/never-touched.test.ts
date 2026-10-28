/**
 * The rest of what `CLAUDE.md` lists as never touched, held.
 *
 * The list has four entries. Core's purity is held by
 * `tests/tools/core-purity.test.ts`, and the version by
 * `tests/tools/version.test.ts`. Until 2026-10-28 the other two were held by
 * a sentence each:
 *
 *   - `browser_specific_settings.gecko.id` is `weft@weft.study`, and changing
 *     it orphans every Firefox install, because AMO keys a listing, and every
 *     update to it, to the id;
 *   - `.licence-private.jwk` is the one thing that can mint a licence, and it
 *     is on Creagh's machine only, by a `.gitignore` line that `git add -f`
 *     walks straight past. A licence cannot be revoked, so a private key
 *     committed once is a key anyone can sign with for as long as the
 *     extension trusts its public half.
 *
 * The key test never opens `.licence-private.jwk`. A private JWK repeats its
 * public members, so the publisher's private half is a `d` written in the
 * same object as the `x` that `src/core/licence-key.ts` trusts, and that is
 * what it looks for, in every tracked file.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PUBLISHER_KEY_X } from '../../src/core/licence-key.ts';
import { TEST_LICENCE_PUBLIC_JWK } from '../fixtures/licence-keypair.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = await import(pathToFileURL(join(ROOT, 'manifest.config.mjs')).href);

const git = (...args: string[]): string => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });

/** Tracked files containing `needle`; `git grep` exits 1 when there are none. */
function trackedFilesHolding(needle: string): string[] {
  try {
    return git('grep', '-lF', needle).split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

// A P-256 private scalar is 32 bytes, 43 characters of base64url, and a JWK
// names it `d`, quoted in JSON and bare or quoted in a TypeScript literal.
const PRIVATE_MEMBER = /(?:^|[{,\s])["']?d["']?\s*:\s*["'][A-Za-z0-9_-]{43}["']/;

// A PEM private key's armour, put together here so that this file, once
// tracked, does not hold it: written out whole, it was the one tracked file
// the search found, in CI, the moment the test was committed.
const PEM_ARMOUR = ['PRIVATE', 'KEY-----'].join(' ');

// Far wider than one key object, which is about 250 characters as
// `tools/make-licence.mjs` writes it, so a reordered key is still one object.
const OBJECT_REACH = 400;

/** Whether `text` holds a private JWK member beside the public `x`. */
function holdsPrivateHalf(text: string, x: string): boolean {
  for (let at = text.indexOf(x); at !== -1; at = text.indexOf(x, at + 1)) {
    const near = text.slice(Math.max(0, at - OBJECT_REACH), at + x.length + OBJECT_REACH);
    if (PRIVATE_MEMBER.test(near)) return true;
  }
  return false;
}

describe('the Firefox add-on id', () => {
  test('is weft@weft.study, which AMO keys every install and update to', () => {
    const id = manifest.buildManifest('firefox').browser_specific_settings?.gecko?.id;
    assert.equal(
      id,
      'weft@weft.study',
      'the Firefox build changed its gecko.id; AMO would treat it as a new add-on and every install of the old one would be orphaned',
    );
  });
});

describe("the publisher's private key", () => {
  test('is ignored by git, and not tracked', () => {
    // --no-index asks the rules, so a tracked copy cannot hide a missing one.
    assert.doesNotThrow(
      () => git('check-ignore', '-q', '--no-index', '.licence-private.jwk'),
      '.gitignore no longer ignores .licence-private.jwk',
    );
    assert.equal(git('ls-files', '--', '.licence-private.jwk').trim(), '', '.licence-private.jwk is tracked');
  });

  test('the search sees a private key written as this repository writes one', () => {
    // The fixture's halves are both committed on purpose, so the search must
    // find the test key's private half there, or it can find nothing anywhere.
    const fixture = readFileSync(join(ROOT, 'tests/fixtures/licence-keypair.ts'), 'utf8');
    assert.ok(holdsPrivateHalf(fixture, TEST_LICENCE_PUBLIC_JWK.x!), 'the search misses the fixture private key');
    const asWritten = JSON.stringify({ crv: 'P-256', d: 'A'.repeat(43), ext: true, key_ops: ['sign'], kty: 'EC', x: PUBLISHER_KEY_X, y: 'B'.repeat(43) }, null, 2);
    assert.ok(holdsPrivateHalf(asWritten, PUBLISHER_KEY_X), 'the search misses a key as tools/make-licence.mjs writes it');
    assert.ok(!holdsPrivateHalf(readFileSync(join(ROOT, 'src/core/licence-key.ts'), 'utf8'), PUBLISHER_KEY_X));
  });

  test('no tracked file holds its private half', () => {
    const holding = trackedFilesHolding(PUBLISHER_KEY_X);
    assert.ok(holding.includes('src/core/licence-key.ts'), "the search cannot find the publisher's public key");
    const leaked = holding.filter((file) => holdsPrivateHalf(readFileSync(join(ROOT, file), 'utf8'), PUBLISHER_KEY_X));
    assert.deepEqual(
      leaked,
      [],
      'the private key that mints licences is committed; a licence cannot be revoked, so the key must be rotated',
    );
    assert.deepEqual(trackedFilesHolding(PEM_ARMOUR), [], 'a PEM private key is committed');
  });
});
