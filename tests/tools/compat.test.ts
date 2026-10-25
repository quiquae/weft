/**
 * `npm run compat` asks MDN's compatibility data whether each browser Weft
 * ships to implements what Weft uses. `CLAUDE.md` and the header of
 * `manifest.config.mjs` both said it checks every key a target's manifest
 * declares against that target. It did not read a manifest at all: it judged
 * a hand-written list of 21 paths, five of them manifest keys, in all three
 * browsers alike. With `notifications` and `idle` added to the Safari build's
 * permissions — the near-miss its own header says it exists to stop — it
 * exited 0 on 2026-10-25.
 *
 * So the manifest half is derived. `manifestKeys()` walks what
 * `buildManifest(target)` writes, every key and every permission, and each is
 * judged on its own target at that target's floor. A key MDN has no entry for
 * fails unless `UNTRACKED` names it, for exactly the targets that declare it,
 * with where it is documented: NO-DATA is not a pass, which is what catches a
 * misspelt key. The verdicts are one function, `judge()`, for both halves.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { KEY_FALLBACKS, UNTRACKED, at, auditManifests, judge, manifestKeys } from '../../tools/compat.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CONFIG = join(ROOT, 'manifest.config.mjs');

// Computed specifiers, so tsc types both as `any` rather than refusing an
// untyped .mjs import; the audit reads the same two things.
const config = await import(pathToFileURL(CONFIG).href);
const bcd: unknown = createRequire(import.meta.url)('@mdn/browser-compat-data');

type Manifests = Record<string, Record<string, any>>;
const shipped = (): Manifests =>
  Object.fromEntries((config.TARGETS as string[]).map((t) => [t, config.buildManifest(t)]));

const m = (path: string): string => `webextensions.manifest.${path}`;

describe('manifestKeys', () => {
  test('walks every key a manifest declares, and each permission, as an MDN path', () => {
    const keys = manifestKeys({
      manifest_version: 3,
      icons: { 16: 'icon-16.png' },
      action: { default_popup: 'popup.html', default_icon: { 16: 'icon-16.png' } },
      web_accessible_resources: [{ resources: ['lexicon/*'], matches: ['*://*/*'], use_dynamic_url: false }],
      commands: { 'weft-reveal': { description: 'Reveal' } },
      permissions: ['storage', 'notifications'],
      optional_permissions: ['bookmarks'],
      background: { scripts: ['background.js'] },
      browser_specific_settings: { gecko: { id: 'weft@weft.study' } },
    });
    // Icon sizes and command names are names a developer chooses, not keys;
    // a resource pattern or a script file is a value. None is walked.
    assert.deepEqual(
      keys.map((k) => [k.label, k.path]),
      [
        ['manifest_version', m('manifest_version')],
        ['icons', m('icons')],
        ['action', m('action')],
        ['action.default_popup', m('action.default_popup')],
        ['action.default_icon', m('action.default_icon')],
        ['web_accessible_resources', m('web_accessible_resources')],
        ['web_accessible_resources[].resources', m('web_accessible_resources.resources')],
        ['web_accessible_resources[].matches', m('web_accessible_resources.matches')],
        ['web_accessible_resources[].use_dynamic_url', m('web_accessible_resources.use_dynamic_url')],
        ['commands', m('commands')],
        ['permissions', m('permissions')],
        ['permission storage', m('permissions.storage')],
        ['permission notifications', m('permissions.notifications')],
        ['optional_permissions', m('optional_permissions')],
        ['optional permission bookmarks', m('permissions.bookmarks')],
        ['background', m('background')],
        ['background.scripts', m('background.scripts')],
        ['browser_specific_settings', m('browser_specific_settings')],
        ['browser_specific_settings.gecko', m('browser_specific_settings.gecko')],
        ['browser_specific_settings.gecko.id', m('browser_specific_settings.gecko.id')],
      ],
    );
  });
});

describe('judge', () => {
  const node = (safari: unknown) => ({ __compat: { support: { safari } } });

  test('support above the floor fails, or degrades when a fallback is named', () => {
    assert.deepEqual(judge(node({ version_added: '17.2' }), 'safari', '16.4'), {
      verdict: 'FAIL',
      detail: 'needs 17.2, we claim 16.4',
    });
    assert.deepEqual(judge(node({ version_added: '17.2' }), 'safari', '16.4', 'the wrapped renderer'), {
      verdict: 'DEGRADES',
      detail: 'needs 17.2, we claim 16.4',
    });
    // The first entry of an array is the current state.
    assert.equal(judge(node([{ version_added: '17.2' }, { version_added: '15' }]), 'safari', '16.4').verdict, 'FAIL');
  });

  test('support at or below the floor passes, whatever prefix MDN writes', () => {
    assert.deepEqual(judge(node({ version_added: '16.4' }), 'safari', '16.4'), {
      verdict: 'PASS',
      detail: 'since 16.4',
    });
    assert.deepEqual(judge(node({ version_added: '≤14', partial_implementation: true }), 'safari', '16.4'), {
      verdict: 'PASS',
      detail: 'since ≤14 (partial)',
    });
  });

  test('never implemented, removed, a preview or no entry at all is not support', () => {
    assert.deepEqual(judge(node({ version_added: false }), 'safari', '16.4'), {
      verdict: 'FAIL',
      detail: 'never implemented',
    });
    assert.deepEqual(judge(node({ version_added: '14', version_removed: '17' }), 'safari', '16.4'), {
      verdict: 'FAIL',
      detail: 'removed in 17',
    });
    // "preview" once compared as NaN, which read as supported at the floor.
    assert.deepEqual(judge(node({ version_added: 'preview' }), 'safari', '16.4'), {
      verdict: 'FAIL',
      detail: 'marked "preview" — not a released version',
    });
    assert.equal(judge({ __compat: { support: {} } }, 'safari', '16.4').verdict, 'NO-DATA');
    assert.equal(judge(undefined, 'safari', '16.4').verdict, 'NO-DATA');
  });
});

describe('the manifests Weft builds, each on its own target', () => {
  test('a permission a target never implemented fails, as notifications and idle once would have on Safari', () => {
    const manifests = shipped();
    manifests.safari!.permissions.push('notifications', 'idle');
    const failed = auditManifests(manifests, config.MINIMUMS, bcd)
      .filter((r) => r.verdict === 'FAIL')
      .map((r) => `${r.target} ${r.label}`);
    assert.deepEqual(failed, ['safari permission notifications', 'safari permission idle']);
  });

  test('a key on a target its UNTRACKED line does not name is no pass, and nor is a misspelt one', () => {
    const manifests = shipped();
    manifests.firefox!.minimum_chrome_version = '116';
    manifests.chrome!.options_ui.open_in_tabs = true;
    const unjudged = auditManifests(manifests, config.MINIMUMS, bcd)
      .filter((r) => r.verdict === 'NO-DATA')
      .map((r) => `${r.target} ${r.label}`);
    assert.deepEqual(unjudged.sort(), ['chrome options_ui.open_in_tabs', 'firefox minimum_chrome_version']);
  });

  test('the shipped manifests pass: nothing fails and nothing goes unjudged', () => {
    const results = auditManifests(shipped(), config.MINIMUMS, bcd);
    const bad = results.filter((r) => r.verdict === 'FAIL' || r.verdict === 'NO-DATA');
    assert.deepEqual(bad.map((r) => `${r.verdict} ${r.target} ${r.label}: ${r.detail}`), []);
    // Not vacuous: every target is walked, its permissions among its keys.
    for (const target of config.TARGETS as string[]) {
      const mine = results.filter((r) => r.target === target);
      assert.ok(mine.length > 25, `only ${mine.length} keys of the ${target} manifest were judged`);
      assert.ok(mine.some((r) => r.label === 'permission storage'), `the ${target} permissions were not walked`);
    }
  });

  test('every key MDN has no entry for is named for exactly the targets that declare it', () => {
    const manifests = shipped();
    assert.ok(Object.keys(UNTRACKED).length > 0, 'UNTRACKED is empty');
    for (const [path, line] of Object.entries(UNTRACKED)) {
      assert.equal(at(bcd, path), undefined, `MDN has an entry for ${path} now: judge it, and take its line out`);
      const declaring = Object.entries(manifests)
        .filter(([, manifest]) => manifestKeys(manifest).some((k) => k.path === path))
        .map(([target]) => target);
      assert.deepEqual(declaring, line.targets, `${path} is declared by [${declaring}] and named for [${line.targets}]`);
      assert.match(line.source, /^https:\/\//, `${path} names no page that documents it`);
    }
  });

  test('every fallback named for a manifest key is one a target needs', () => {
    const results = auditManifests(shipped(), config.MINIMUMS, bcd);
    for (const path of Object.keys(KEY_FALLBACKS)) {
      assert.ok(
        results.some((r) => r.path === path && r.verdict === 'DEGRADES'),
        `${path} has a fallback, and no target declares it without support at its floor`,
      );
    }
  });
});

describe('npm run compat', () => {
  const run = (cwd: string) =>
    spawnSync(process.execPath, ['--experimental-strip-types', join(cwd, 'tools/compat-audit.mjs')], {
      cwd,
      encoding: 'utf8',
    });

  test('judges every key of each target’s manifest, and passes on this tree', () => {
    const { status, stdout, stderr } = run(ROOT);
    assert.equal(status, 0, stdout + stderr);
    for (const target of config.TARGETS as string[]) {
      const counted = new RegExp(`${target} (\\d+) keys`).exec(stdout);
      assert.ok(counted, `the audit printed no key count for ${target}:\n${stdout}`);
      assert.equal(Number(counted[1]), manifestKeys(config.buildManifest(target)).length);
    }
  });

  test('exits 1 naming the permission when a target declares one it cannot honour', () => {
    const root = mkdtempSync(join(tmpdir(), 'weft-compat-'));
    try {
      mkdirSync(join(root, 'tools'));
      copyFileSync(join(ROOT, 'tools/compat-audit.mjs'), join(root, 'tools/compat-audit.mjs'));
      copyFileSync(join(ROOT, 'tools/compat.ts'), join(root, 'tools/compat.ts'));
      symlinkSync(join(ROOT, 'node_modules'), join(root, 'node_modules'));
      const real = pathToFileURL(CONFIG).href;
      writeFileSync(
        join(root, 'manifest.config.mjs'),
        `import { buildManifest as real } from '${real}';\n` +
          `export { MINIMUMS, TARGETS, VERSION } from '${real}';\n` +
          `export function buildManifest(target, opts) {\n` +
          `  const m = real(target, opts);\n` +
          `  if (target === 'safari') m.permissions.push('notifications');\n` +
          `  return m;\n` +
          `}\n`,
      );
      const { status, stdout, stderr } = run(root);
      assert.equal(status, 1, stdout + stderr);
      assert.match(stdout, /FAIL\s+safari\s+permission notifications/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
