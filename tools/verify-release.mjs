#!/usr/bin/env node
/**
 * Load the artefact a user downloads, in a real browser.
 *
 *   npm run verify:release              # latest release
 *   npm run verify:release -- v1.0.0    # a specific tag
 *
 * Everything else in this repository tests what the build produces. This
 * tests what GitHub actually serves, which is not guaranteed to be the same
 * thing: a release can attach the wrong file, attach a stale one, or — the
 * case that motivated the two-archive split — attach one that unzips into
 * nineteen loose files with no folder to load.
 *
 * It is deliberately a smoke test rather than a suite. If this passes, the
 * download works and the first screen is right; the 500-odd tests already
 * cover whether the product is correct.
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const tag = process.argv[2] ?? '';
const work = await mkdtemp(join(tmpdir(), 'weft-verify-'));

let failures = 0;
function check(label, ok, extra = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${extra ? `  ${extra}` : ''}`);
}

/**
 * Chrome derives an unpacked extension's id from the SHA-256 of its absolute
 * path, mapping each nibble to a-p. Computing it beats waiting for the
 * service worker, which is lazy and may have been killed again already.
 */
function extensionId(path) {
  const hash = createHash('sha256').update(path).digest();
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += String.fromCharCode(97 + (hash[i] >> 4));
    id += String.fromCharCode(97 + (hash[i] & 0x0f));
  }
  return id;
}

/* ------------------------------------------------------------- download */

const args = ['release', 'download'];
if (tag) args.push(tag);
args.push('--pattern', 'weft-chrome-*-folder.zip', '--dir', work);

console.log(`downloading ${tag || 'the latest release'}…`);
try {
  execFileSync('gh', args, { stdio: 'pipe' });
} catch (err) {
  console.error(`could not download: ${err.stderr?.toString().trim() || err.message}`);
  console.error('Is there a release yet? Tag one with: git tag v1.0.0 && git push --tags');
  process.exit(1);
}

const { readdirSync } = await import('node:fs');
const archive = readdirSync(work).find((n) => n.endsWith('.zip'));
if (!archive) { console.error('no archive was downloaded'); process.exit(1); }
execFileSync('unzip', ['-q', '-o', join(work, archive), '-d', work]);
const folder = readdirSync(work).find((n) => n.startsWith('weft-chrome') && !n.endsWith('.zip'));

// The whole reason the -folder archive exists: it must contain exactly one
// directory, not spill its contents into the download location.
check('unzips to a single named folder', Boolean(folder), folder ?? readdirSync(work).join(', '));
if (!folder) process.exit(1);

/*
 * The real path, not the symlinked one.
 *
 * On macOS tmpdir() is /var/folders/..., a symlink to /private/var/folders.
 * Chrome resolves it before deriving the extension id from the path hash,
 * so an id computed from the symlink does not match the extension that
 * loaded and every chrome-extension:// URL fails with
 * ERR_BLOCKED_BY_CLIENT — which reads like the extension was rejected
 * rather than like the address was wrong.
 */
const ext = realpathSync(join(work, folder));

/* -------------------------------------------------------- the manifest */

const manifest = JSON.parse(await readFile(join(ext, 'manifest.json'), 'utf8'));
check('manifest is v3', manifest.manifest_version === 3);
check(
  'no host permissions ship',
  manifest.host_permissions === undefined,
  manifest.host_permissions ? manifest.host_permissions.join(',') : '',
);
check('name is not the test build', !String(manifest.name).includes('test build'));
check('locales are present', existsSync(join(ext, '_locales', 'en', 'messages.json')));

/* ------------------------------------------------------ load it for real */

const userDataDir = await mkdtemp(join(tmpdir(), 'weft-verify-profile-'));
const ctx = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--no-first-run'],
});

const id = extensionId(ext);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`chrome-extension://${id}/onboarding.html`);
await page.waitForTimeout(1500);

const heading = await page.locator('h2').first().innerText().catch(() => '');
check('the first-run page renders', /learning/i.test(heading), `"${heading}"`);
check('no unavailable languages are offered', (await page.getByText('no lexicon').count()) === 0);

const answered = await page.evaluate(async () => {
  try {
    return (await chrome.runtime.sendMessage({ type: 'get-settings' }))?.ok === true;
  } catch (e) {
    return `threw: ${e.message}`;
  }
});
check('the background worker answers', answered === true, String(answered));

await page.goto(`chrome-extension://${id}/dashboard.html`);
await page.waitForTimeout(1200);
check('a new install sees the empty state', (await page.locator('.empty__lead').count()) === 1);
check('and is told nothing has left the machine', (await page.getByText(/network requests, ever/i).count()) > 0);

check('no uncaught errors on any page', errors.length === 0, errors.join(' | '));

await ctx.close();
await rm(userDataDir, { recursive: true, force: true });
await rm(work, { recursive: true, force: true });

console.log(
  failures === 0
    ? '\nthe published download loads and works.'
    : `\n${failures} problem(s) with the published download.`,
);
process.exit(failures === 0 ? 0 : 1);
