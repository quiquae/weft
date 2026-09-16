#!/usr/bin/env node
/**
 * Weft build.
 *
 * Deliberately hand-rolled on top of esbuild rather than using a framework
 * plugin: MV3 has a few hard constraints (content scripts must be classic
 * scripts, the service worker cannot use top-level await in Firefox, the
 * manifest must be generated per target) and the failure modes of magic
 * plugins here are much worse than 150 lines of explicit build.
 */
import * as esbuild from 'esbuild';
import { buildManifest, VERSION, TARGETS } from './manifest.config.mjs';
// Test builds verify licences against a throwaway key so the end-to-end
// suite can mint one. See src/core/licence-key.ts for why, and
// tools/validate-package.mjs for the check that keeps it out of a release.
import { TEST_LICENCE_PUBLIC_JWK } from './tests/fixtures/licence-keypair.ts';
import { mkdir, writeFile, readFile, cp, rm, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';

const ROOT = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, dflt = undefined) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return dflt;
  const eq = hit.indexOf('=');
  return eq === -1 ? true : hit.slice(eq + 1);
};

const TARGET = String(flag('target', 'chrome'));
const WATCH = Boolean(flag('watch', false));
const ZIP = Boolean(flag('zip', false));
const TEST = Boolean(flag('test', false));
const DEV = Boolean(flag('dev', false)) || WATCH;
const OUT = join(ROOT, 'dist', TARGET);

if (!TARGETS.includes(TARGET)) {
  console.error(`unknown --target=${TARGET} (expected ${TARGETS.join('|')})`);
  process.exit(1);
}

/** Entry points. Content script and background must be IIFE classic scripts. */
const ENTRIES = [
  { in: 'src/content/index.ts', out: 'content', format: 'iife' },
  { in: 'src/background/index.ts', out: 'background', format: 'iife' },
  { in: 'src/ui/popup/index.tsx', out: 'popup', format: 'iife' },
  { in: 'src/ui/options/index.tsx', out: 'options', format: 'iife' },
  { in: 'src/ui/dashboard/index.tsx', out: 'dashboard', format: 'iife' },
  { in: 'src/ui/onboarding/index.tsx', out: 'onboarding', format: 'iife' },
];

const HTML_PAGES = ['popup', 'options', 'dashboard', 'onboarding'];

const sharedOptions = {
  bundle: true,
  target: ['chrome116', 'firefox128', 'safari16.4'],
  platform: 'browser',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  legalComments: 'none',
  minify: !DEV,
  sourcemap: DEV ? 'inline' : false,
  charset: 'utf8',
  logLevel: 'warning',
  define: {
    'process.env.NODE_ENV': JSON.stringify(DEV ? 'development' : 'production'),
    __WEFT_VERSION__: JSON.stringify(VERSION),
    __WEFT_TARGET__: JSON.stringify(TARGET),
    __WEFT_DEV__: JSON.stringify(DEV),
    // 'undefined' as a literal, not the string: the ternary in
    // licence-key.ts then folds at build time and the test key is absent
    // from shipped bytes entirely rather than merely unused.
    __WEFT_LICENCE_KEY__: TEST ? JSON.stringify(TEST_LICENCE_PUBLIC_JWK) : 'undefined',
  },
  loader: {
    '.svg': 'text',
    '.png': 'file',
  },
};

function pageHtml(name, title) {
  // No inline scripts: MV3's default CSP forbids them, and an inline <script>
  // fails silently rather than loudly, which is the worst kind of bug.
  return `<!doctype html>
<html lang="en" data-weft-page="${name}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="theme.css">
<link rel="stylesheet" href="${name}.css">
</head>
<body class="weft-page weft-page--${name}">
<div id="root"></div>
<script src="${name}.js"></script>
</body>
</html>
`;
}

async function buildCss() {
  const cssEntries = [
    { in: 'src/ui/theme.css', out: 'theme' },
    ...HTML_PAGES.map((p) => ({ in: `src/ui/${p}/${p}.css`, out: p })),
  ].filter((e) => existsSync(join(ROOT, e.in)));

  if (!cssEntries.length) return;

  await esbuild.build({
    ...sharedOptions,
    entryPoints: cssEntries.map((e) => ({ in: join(ROOT, e.in), out: e.out })),
    outdir: OUT,
    loader: { ...sharedOptions.loader, '.css': 'css' },
  });

  // Guarantee every page has a stylesheet so the <link> never 404s.
  for (const p of HTML_PAGES) {
    const f = join(OUT, `${p}.css`);
    if (!existsSync(f)) await writeFile(f, `/* ${p}: no page-specific styles */\n`);
  }
}

async function buildJs() {
  const present = ENTRIES.filter((e) => existsSync(join(ROOT, e.in)));
  const missing = ENTRIES.filter((e) => !existsSync(join(ROOT, e.in)));
  if (missing.length) {
    console.warn(`  (skipping missing entries: ${missing.map((m) => m.in).join(', ')})`);
  }
  // esbuild cannot mix output formats in one build call when using outdir with
  // multiple entryPoints, so group by format.
  const byFormat = new Map();
  for (const e of present) {
    if (!byFormat.has(e.format)) byFormat.set(e.format, []);
    byFormat.get(e.format).push(e);
  }
  const contexts = [];
  for (const [format, group] of byFormat) {
    const opts = {
      ...sharedOptions,
      format,
      entryPoints: group.map((e) => ({ in: join(ROOT, e.in), out: e.out })),
      outdir: OUT,
    };
    if (WATCH) {
      const ctx = await esbuild.context(opts);
      await ctx.watch();
      contexts.push(ctx);
    } else {
      await esbuild.build(opts);
    }
  }
  return contexts;
}

async function copyStatic() {
  await mkdir(join(OUT, 'assets'), { recursive: true });
  if (existsSync(join(ROOT, 'assets'))) {
    await cp(join(ROOT, 'assets'), join(OUT, 'assets'), { recursive: true });
  }
  if (existsSync(join(ROOT, 'src/lexicon/packs'))) {
    await mkdir(join(OUT, 'lexicon'), { recursive: true });
    await cp(join(ROOT, 'src/lexicon/packs'), join(OUT, 'lexicon'), { recursive: true });
  }
  if (existsSync(join(ROOT, 'src/_locales'))) {
    await cp(join(ROOT, 'src/_locales'), join(OUT, '_locales'), { recursive: true });
  }
  for (const p of HTML_PAGES) {
    const titles = {
      popup: 'Weft',
      options: 'Weft — Settings',
      dashboard: 'Weft — Progress',
      onboarding: 'Welcome to Weft',
    };
    await writeFile(join(OUT, `${p}.html`), pageHtml(p, titles[p]));
  }
}

async function writeManifest() {
  const m = buildManifest(TARGET, { test: TEST });
  await writeFile(join(OUT, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
}

async function dirSize(dir) {
  let total = 0;
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    const s = await stat(p);
    total += s.isDirectory() ? await dirSize(p) : s.size;
  }
  return total;
}

async function makeZip() {
  const zipPath = join(ROOT, `weft-${TARGET}-${VERSION}.zip`);
  await rm(zipPath, { force: true });
  await new Promise((resolve, reject) => {
    // `zip` ships with macOS and every CI image we target; shelling out avoids
    // adding an archiver dependency for one line of work.
    const proc = spawn('zip', ['-r', '-q', '-X', zipPath, '.'], { cwd: OUT, stdio: 'inherit' });
    proc.on('error', reject);
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`zip exited ${code}`))));
  });
  const s = await stat(zipPath);
  console.log(`  zip     ${zipPath.replace(ROOT + '/', '')}  ${(s.size / 1024).toFixed(0)} KB`);
}

async function main() {
  const t0 = Date.now();
  if (!WATCH) await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const contexts = await buildJs();
  await buildCss();
  await copyStatic();
  await writeManifest();

  const size = await dirSize(OUT);
  console.log(
    `weft ${VERSION} → dist/${TARGET}${TEST ? ' (test)' : ''}  ${(size / 1024).toFixed(0)} KB  ${Date.now() - t0}ms${DEV ? '  (dev)' : ''}`,
  );

  if (ZIP) await makeZip();

  if (WATCH) {
    console.log('watching for changes… (ctrl-c to stop)');
    // Rebuild static assets on any change under src/ui or assets.
    const { watch } = await import('node:fs');
    let timer = null;
    const rebuild = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await buildCss();
        await copyStatic();
        await writeManifest();
        console.log(`  static rebuilt ${new Date().toTimeString().slice(0, 8)}`);
      }, 120);
    };
    for (const d of ['src/ui', 'assets', 'src/lexicon/packs']) {
      if (existsSync(join(ROOT, d))) watch(join(ROOT, d), { recursive: true }, rebuild);
    }
    await new Promise(() => {});
    for (const c of contexts) await c.dispose();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
