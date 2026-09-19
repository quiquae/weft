#!/usr/bin/env node
/**
 * Cut a release.
 *
 *   node tools/release.mjs --version=1.1.0
 *   node tools/release.mjs --version=1.1.0 --dry
 *
 * Bumps the version in one place, rebuilds everything, packages both
 * browsers, and writes release notes. Refuses to run on a dirty tree or
 * without a green test suite, because a release is the one moment where
 * "I'll check afterwards" is most expensive.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stat } from 'node:fs/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n, d) => {
  const hit = args.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  if (!hit) return d;
  const eq = hit.indexOf('=');
  return eq === -1 ? true : hit.slice(eq + 1);
};

const version = String(flag('version', ''));
const dry = Boolean(flag('dry', false));
const skipTests = Boolean(flag('skip-tests', false));

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: node tools/release.mjs --version=X.Y.Z');
  process.exit(1);
}

const run = (cmd, cmdArgs, opts = {}) =>
  execFileSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit', ...opts });
const capture = (cmd, cmdArgs) =>
  execFileSync(cmd, cmdArgs, { cwd: ROOT, encoding: 'utf8' }).trim();

/* ------------------------------------------------------------- preflight */

const dirty = capture('git', ['status', '--porcelain']);
if (dirty && !dry) {
  console.error('The working tree is dirty. Commit or stash first:\n' + dirty);
  process.exit(1);
}

console.log(`\nweft ${version}\n`);

if (!skipTests) {
  console.log('→ typecheck');
  run('npx', ['tsc', '--noEmit']);
  console.log('→ unit and dom tests');
  run('npm', ['test']);
  console.log('→ lexicon check');
  run('npm', ['run', 'packs:verify']);
} else {
  console.warn('! skipping tests at your own risk (--skip-tests)\n');
}

/* --------------------------------------------------------------- version */

// One source of truth. manifest.config.mjs reads VERSION, package.json is
// what npm and the tooling read, and they must not drift.
const manifestConfig = join(ROOT, 'manifest.config.mjs');
let mc = await readFile(manifestConfig, 'utf8');
const before = mc.match(/export const VERSION = '([^']+)'/)?.[1];
mc = mc.replace(/export const VERSION = '[^']+'/, `export const VERSION = '${version}'`);

const pkgPath = join(ROOT, 'package.json');
const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
pkg.version = version;

if (dry) {
  console.log(`would bump ${before} → ${version} in manifest.config.mjs and package.json`);
} else {
  await writeFile(manifestConfig, mc);
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`→ version ${before} → ${version}`);
}

/* ----------------------------------------------------------------- build */

console.log('→ lexicons');
run('npm', ['run', 'packs']);
console.log('→ icons');
run('node', ['tools/make-icons.mjs']);
console.log('→ extension, both targets');
run('npm', ['run', 'build:all']);
console.log('→ packages');
run('npm', ['run', 'zip']);
console.log('→ content site');
run('node', ['tools/build-site.mjs']);

/* ----------------------------------------------------------------- notes */

const zips = ['chrome', 'firefox'].map((t) => `weft-${t}-${version}.zip`);
const sizes = await Promise.all(
  zips.map(async (z) => {
    try {
      return `${z} — ${Math.round((await stat(join(ROOT, z))).size / 1024)} KB`;
    } catch {
      return `${z} — MISSING`;
    }
  }),
);

const previous = (() => {
  try {
    return capture('git', ['describe', '--tags', '--abbrev=0']);
  } catch {
    return '';
  }
})();
const log = previous
  ? capture('git', ['log', '--oneline', `${previous}..HEAD`])
  : capture('git', ['log', '--oneline', '-20']);

const notes = `# Weft ${version}

## Install

Take the file ending **\`-folder.zip\`**. The plain \`.zip\` is the one the
stores want: it has no folder inside and will empty itself into your Downloads.

**Chrome, Edge, Brave** — download \`weft-chrome-${version}-folder.zip\`, unzip it,
open \`chrome://extensions\`, turn on Developer mode, then **Load unpacked** and
pick the \`weft-chrome-${version}\` folder itself, not the \`manifest.json\` inside it.

**Firefox** — download \`weft-firefox-${version}-folder.zip\`, unzip it, open
\`about:debugging\` → This Firefox → **Load Temporary Add-on**, and pick the
\`manifest.json\` inside the folder. Firefox unloads temporary add-ons when it
closes, so this is for trying Weft rather than living with it.

**Safari** — needs the extension wrapped in a signed app, which needs Xcode.
See \`docs/SUBMIT.md\`.

Weft opens its first-run page and asks three questions. It has access to no
website until you answer the third one.

## Packages

${sizes.map((s) => `- ${s}`).join('\n')}

## Changes since ${previous || 'the beginning'}

${log || '(none)'}

---

Free for one language, forever. [Pro](https://weft.study/pricing) adds every
language at once, a different one per site, Hard Mode, and your own
translation key.
`;

if (dry) {
  console.log('\n--- release notes ---\n' + notes);
} else {
  await writeFile(join(ROOT, `RELEASE-${version}.md`), notes);
  console.log(`→ RELEASE-${version}.md`);
}

console.log(`\ndone.${dry ? ' (dry run — nothing written)' : `

Next:
  git add -A && git commit -m "Release ${version}"
  git tag v${version}
  git push && git push --tags

The GitHub Actions release workflow attaches both zips to the tag.`}`);
