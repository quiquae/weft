#!/usr/bin/env node
/**
 * Check every internal link in the generated site resolves.
 *
 * Seven hundred pages cross-link each other by slug, and a slug is derived
 * from a word with diacritics stripped. One collision or one stale reference
 * and a reader hits a 404 — which is worse for search than the page not
 * existing, because the link is already indexed.
 *
 * Runs in CI before the site is published.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_URL, SUPPORT_URL } from '../src/core/site.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist/site');

/**
 * The path the site is served under, as the builder takes it: '' at a
 * domain's root, '/weft' on GitHub Pages. A root link outside it leaves the
 * site, which is how a link the builder forgot to move shows up.
 */
const BASE = new URL(process.env.WEFT_SITE_URL || SITE_URL).pathname.replace(/\/$/, '');
const local = (path) =>
  !BASE ? path : path === BASE || path.startsWith(`${BASE}/`) ? path.slice(BASE.length) || '/' : null;

async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    const s = await stat(path);
    if (s.isDirectory()) out.push(...(await walk(path)));
    else if (name.endsWith('.html')) out.push(path);
  }
  return out;
}

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const files = await walk(OUT);
let checked = 0;
const broken = [];

for (const file of files) {
  const html = await readFile(file, 'utf8');
  const hrefs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);

  for (const href of hrefs) {
    // External, anchors and data URLs are somebody else's problem.
    if (/^(?:https?:)?\/\//.test(href) || href.startsWith('#') || href.startsWith('data:')) continue;
    checked++;

    const path = href.split('#')[0].split('?')[0];
    if (!path) continue;

    const inSite = path.startsWith('/') ? local(path) : path;
    if (inSite === null) {
      broken.push(`${file.replace(OUT + '/', '')} -> ${href} (outside ${BASE}/)`);
      continue;
    }
    const base = inSite.startsWith('/') ? OUT : dirname(file);
    const target = resolve(base, inSite.replace(/^\//, ''));

    // A bare path may be served as .html, or as a directory index.
    const candidates = [target, `${target}.html`, join(target, 'index.html')];
    let ok = false;
    for (const candidate of candidates) {
      if (await exists(candidate)) {
        ok = true;
        break;
      }
    }
    if (!ok) broken.push(`${file.replace(OUT + '/', '')} -> ${href}`);
  }
}

/*
 * The two pages something outside this repository depends on.
 *
 * `SUPPORT_URL` is compiled into the shipped extension and rendered as a
 * button on its help page, and `/privacy` is the URL `docs/STORE-LISTING.md`
 * hands the Chrome Web Store, which rejects a submission without a live one.
 *
 * Neither can be fixed by shipping the site again — a published
 * extension keeps pointing wherever it was built pointing. So a missing page
 * here fails the build rather than waiting for a user, or a reviewer, to
 * find the 404.
 */
const REQUIRED = [
  ['SUPPORT_URL, on the extension help page', local(new URL(SUPPORT_URL).pathname)],
  ['the privacy policy the store listing promises', '/privacy'],
];

const missing = [];
for (const [why, path] of REQUIRED) {
  const target = join(OUT, path.replace(/^\//, ''));
  const found = await Promise.all(
    [target, `${target}.html`, join(target, 'index.html')].map(exists),
  );
  if (!found.some(Boolean)) missing.push(`${path} — ${why}`);
}

console.log(`${files.length} pages, ${checked} internal links checked`);

if (broken.length) {
  console.error(`\n${broken.length} broken:`);
  for (const b of broken.slice(0, 30)) console.error(`  ${b}`);
  if (broken.length > 30) console.error(`  … and ${broken.length - 30} more`);
}
if (missing.length) {
  console.error(`\n${missing.length} required page(s) not generated:`);
  for (const m of missing) console.error(`  ${m}`);
}
if (broken.length || missing.length) process.exit(1);

console.log(`all resolve, and all ${REQUIRED.length} externally-referenced pages exist`);
