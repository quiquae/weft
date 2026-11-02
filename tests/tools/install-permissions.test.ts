/**
 * A fresh install reaches no site, and every manifest is held to it.
 *
 * Weft declares no static `content_scripts` and asks for no host permission
 * at install. `optional_host_permissions` names every web origin, each is
 * requested one at a time from a click on Weft's own pages, and the worker
 * registers the content script for exactly the origins granted. That is the
 * difference between an install prompt reading "read and change all your
 * data on all websites" and one reading nothing, and it is the answer
 * Chrome's narrow-permission review asks for.
 *
 * CLAUDE.md said an end-to-end test held it, and none ever had:
 * `tools/validate-package.mjs` refused `host_permissions` in a built
 * package, and nothing refused a static `content_scripts` key anywhere. So
 * `installFaults()` in `tools/install-permissions.ts` is the one refusal,
 * run here on what `buildManifest()` writes for every target, production
 * and test build, by `npm run validate` on each built package's bytes, and
 * by `npm run verify:release` on the package GitHub serves.
 * The probes are manifests that live only in this file, so the refusal is
 * shown to fire on every run.
 *
 * `web_accessible_resources` names every web origin too, and is not refused:
 * it says which pages may load the packaged lexicons, and grants nothing.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { installFaults } from '../../tools/install-permissions.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const config = await import(pathToFileURL(join(ROOT, 'manifest.config.mjs')).href);
const TARGETS = config.TARGETS as string[];

/** A manifest that asks for nothing at install, as the shipped ones do. */
const CLEAN = { permissions: ['storage', 'scripting'], optional_host_permissions: ['*://*/*'] };

/** The test build's seam, which `manifest.config.mjs` adds under `opts.test`. */
const LOOPBACK = ['http://localhost/*', 'http://127.0.0.1/*'];

/**
 * The one fault `manifest` has in `build`, which must name `key` as a word of
 * its own: `host_permissions` is inside `optional_host_permissions`, and a
 * substring match would take a fault about one for a fault about the other.
 */
function onlyFault(manifest: Record<string, unknown>, build: 'production' | 'test', key: string): string {
  const faults = installFaults(manifest, build);
  assert.equal(faults.length, 1, `expected one fault naming ${key}, got ${JSON.stringify(faults)}`);
  const [fault] = faults as [string];
  assert.match(fault, new RegExp(`(?<!\\w)${key}(?!\\w)`), `the fault does not name ${key}: ${fault}`);
  return fault;
}

describe('the refusal', () => {
  test('passes a manifest that asks for nothing at install', () => {
    assert.deepEqual(installFaults(CLEAN, 'production'), []);
    assert.deepEqual(installFaults({ ...CLEAN, host_permissions: LOOPBACK }, 'test'), []);
  });

  test('refuses a static content_scripts key in either build, an empty one too', () => {
    const injected = [{ matches: ['<all_urls>'], js: ['content.js'] }];
    onlyFault({ ...CLEAN, content_scripts: injected }, 'production', 'content_scripts');
    onlyFault({ ...CLEAN, host_permissions: LOOPBACK, content_scripts: injected }, 'test', 'content_scripts');
    // A key nobody has filled yet is a key somebody means to fill.
    onlyFault({ ...CLEAN, content_scripts: [] }, 'production', 'content_scripts');
  });

  test('refuses host_permissions in a production build, and names the seam', () => {
    const fault = onlyFault({ ...CLEAN, host_permissions: LOOPBACK }, 'production', 'host_permissions');
    assert.match(fault, /--test/, 'the fault does not say the test build is where these come from');
    onlyFault({ ...CLEAN, host_permissions: [] }, 'production', 'host_permissions');
  });

  test("refuses a test build's host permission beyond the loopback seam", () => {
    for (const pattern of ['*://*/*', '<all_urls>', 'https://example.com/*', 'http://localhost.example.com/*']) {
      const fault = onlyFault({ ...CLEAN, host_permissions: [...LOOPBACK, pattern] }, 'test', 'host_permissions');
      assert.ok(fault.includes(pattern), `the fault does not name ${pattern}: ${fault}`);
    }
    assert.deepEqual(installFaults({ ...CLEAN, host_permissions: ['http://localhost:8080/*'] }, 'test'), []);
  });

  test('refuses a host pattern listed under permissions, in either build', () => {
    for (const pattern of ['<all_urls>', 'https://*/*', '*://*.example.com/*']) {
      const fault = onlyFault({ ...CLEAN, permissions: ['storage', pattern] }, 'production', 'permissions');
      assert.ok(fault.includes(pattern), `the fault does not name ${pattern}: ${fault}`);
      onlyFault({ ...CLEAN, host_permissions: LOOPBACK, permissions: [pattern] }, 'test', 'permissions');
    }
  });

  test('holds optional_host_permissions to every web origin and nothing else', () => {
    const { optional_host_permissions: _, ...missing } = CLEAN;
    onlyFault(missing, 'production', 'optional_host_permissions');
    for (const asked of [[], ['https://*/*'], ['<all_urls>'], ['*://*/*', 'file:///*']]) {
      onlyFault({ ...CLEAN, optional_host_permissions: asked }, 'production', 'optional_host_permissions');
    }
  });

  test('names every fault a manifest has, not the first', () => {
    const everything = {
      content_scripts: [{ matches: ['*://*/*'], js: ['content.js'] }],
      host_permissions: ['*://*/*'],
      permissions: ['<all_urls>'],
      optional_host_permissions: [],
    };
    assert.equal(installFaults(everything, 'production').length, 4);
  });
});

describe('the three manifests', () => {
  test('are the three targets this repository builds', () => {
    // Read from the config rather than typed here, so a fourth target is
    // held without an edit; this only stops an emptied list from passing.
    for (const target of ['chrome', 'firefox', 'safari']) {
      assert.ok(TARGETS.includes(target), `manifest.config.mjs no longer builds ${target}`);
    }
  });

  test('reach no site at install, in the builds that ship', () => {
    const faults = Object.fromEntries(
      TARGETS.map((t) => [t, installFaults(config.buildManifest(t), 'production')] as const).filter(([, f]) => f.length),
    );
    assert.deepEqual(faults, {}, 'a shipped manifest asks for a site at install');
  });

  test('reach nothing beyond loopback in the builds the end-to-end suite loads', () => {
    const faults = Object.fromEntries(
      TARGETS.map((t) => [t, installFaults(config.buildManifest(t, { test: true }), 'test')] as const).filter(
        ([, f]) => f.length,
      ),
    );
    assert.deepEqual(faults, {}, 'a test build asks for more than the loopback origin the e2e server listens on');
  });
});

describe('the package gates', () => {
  // `npm run validate` reads each package `npm run build:all` writes, and
  // `npm run verify:release` each one GitHub serves; both refuse with the
  // function the probes above hold, rather than with a check of their own.
  for (const [gate, manifest] of [
    ['tools/validate-package.mjs', 'm'],
    ['tools/verify-release.mjs', 'manifest'],
  ] as const) {
    test(`${gate} refuses with the same function, on the bytes it reads`, () => {
      const source = readFileSync(join(ROOT, gate), 'utf8');
      // assert.ok rather than assert.match, which would print the whole file.
      assert.ok(
        /import \{ installFaults \} from '\.\/install-permissions\.ts';/.test(source),
        `${gate} does not import installFaults`,
      );
      assert.ok(source.includes(`installFaults(${manifest}, 'production')`), `${gate} does not refuse with it`);
    });
  }
});
