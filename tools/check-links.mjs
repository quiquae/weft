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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist/site');

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

    const base = path.startsWith('/') ? OUT : dirname(file);
    const target = resolve(base, path.replace(/^\//, ''));

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

console.log(`${files.length} pages, ${checked} internal links checked`);
if (broken.length) {
  console.error(`\n${broken.length} broken:`);
  for (const b of broken.slice(0, 30)) console.error(`  ${b}`);
  if (broken.length > 30) console.error(`  … and ${broken.length - 30} more`);
  process.exit(1);
}
console.log('all resolve');
