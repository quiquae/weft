#!/usr/bin/env node
/**
 * Pre-flight the built packages against what each store actually rejects for.
 *
 * Store review is a slow feedback loop — days for Chrome, longer for Apple —
 * and almost everything it rejects is mechanically detectable. So it is
 * detected here instead.
 *
 * Every rule below corresponds to a real rejection reason, not a style
 * opinion:
 *
 *   - An unused permission is the single most common Chrome Web Store
 *     rejection. Weft shipped `idle` and `unlimitedStorage` with zero call
 *     sites until this check was written.
 *   - An unresolved `__MSG_*__` renders literally in the store listing, so
 *     the extension is published under the name "__MSG_extName__".
 *   - An inline <script> is silently dropped by the MV3 CSP, so the page
 *     loads blank rather than erroring.
 *   - A missing referenced file is a 404 at runtime that no test catches
 *     because tests import modules rather than loading the page.
 *   - Remote code (eval, new Function, a script from a URL) is grounds for
 *     removal, not just rejection.
 *
 * Runs against dist/<target>, so it validates the bytes that get uploaded
 * rather than the source they came from.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGETS } from '../manifest.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

/**
 * Permissions that are a quota or capability grant rather than a namespace.
 *
 * These legitimately have no `api.<name>.*` call sites, so the unused-
 * permission check must not flag them — but each one still has to be
 * justified in the comment here, because an unjustified grant is exactly what
 * the check exists to catch.
 */
const NON_API_PERMISSIONS = {
  // Not currently declared by any target. Left documented because it was
  // removed once already: it was masking two unbounded stores rather than
  // granting anything, and src/core/prune.ts bounds them instead.
  unlimitedStorage: 'quota grant — must be justified by a store that cannot be bounded',
};

/** api.<alias> names that satisfy a differently-named permission. */
const PERMISSION_ALIASES = { contextMenus: ['contextMenus', 'menus'] };

const problems = [];
const notes = [];
const fail = (target, msg) => problems.push(`${target}: ${msg}`);
const note = (target, msg) => notes.push(`${target}: ${msg}`);

/** Every .ts/.tsx source, for the usage cross-reference. */
async function sourceText() {
  let out = '';
  const walk = async (dir) => {
    for (const name of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, name.name);
      if (name.isDirectory()) await walk(p);
      else if (['.ts', '.tsx'].includes(extname(name.name))) out += await readFile(p, 'utf8');
    }
  };
  await walk(SRC);
  return out;
}

async function validate(target, src) {
  const dir = join(ROOT, 'dist', target);
  if (!existsSync(dir)) {
    fail(target, `dist/${target} does not exist — run npm run build:all`);
    return;
  }

  const manifestPath = join(dir, 'manifest.json');
  if (!existsSync(manifestPath)) return fail(target, 'no manifest.json');

  let m;
  try {
    m = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (err) {
    return fail(target, `manifest.json is not valid JSON: ${err.message}`);
  }

  /* ------------------------------------------------------- shipped seams */

  if (m.host_permissions) {
    fail(
      target,
      `host_permissions present (${m.host_permissions.join(', ')}) — that is the ` +
        'test-build seam and must never ship; rebuild without --test',
    );
  }
  if (String(m.name).includes('test build')) fail(target, 'name still says "test build"');

  /* -------------------------------------------------------- localisation */

  const locales = join(dir, '_locales');
  if (!existsSync(locales)) {
    fail(target, '_locales missing but default_locale is set — the extension will not load');
  } else {
    const dirs = await readdir(locales);
    if (!dirs.includes(m.default_locale)) {
      fail(target, `default_locale "${m.default_locale}" has no _locales/${m.default_locale}`);
    }
    // Every __MSG_key__ anywhere in the manifest must exist in every locale.
    const used = [...JSON.stringify(m).matchAll(/__MSG_([A-Za-z0-9_]+)__/g)].map((x) => x[1]);
    for (const loc of dirs) {
      const f = join(locales, loc, 'messages.json');
      if (!existsSync(f)) {
        fail(target, `_locales/${loc} has no messages.json`);
        continue;
      }
      const msgs = JSON.parse(await readFile(f, 'utf8'));
      for (const key of new Set(used)) {
        if (!msgs[key]) fail(target, `__MSG_${key}__ has no entry in _locales/${loc}`);
        else if (!msgs[key].message) fail(target, `_locales/${loc} ${key} has an empty message`);
      }
    }
  }

  /* ------------------------------------------------- referenced files exist */

  const refs = new Set();
  for (const size of Object.values(m.icons ?? {})) refs.add(size);
  for (const size of Object.values(m.action?.default_icon ?? {})) refs.add(size);
  if (m.action?.default_popup) refs.add(m.action.default_popup);
  if (m.options_ui?.page) refs.add(m.options_ui.page);
  if (m.background?.service_worker) refs.add(m.background.service_worker);
  for (const s of m.background?.scripts ?? []) refs.add(s);

  for (const ref of refs) {
    if (!existsSync(join(dir, ref))) fail(target, `manifest references missing file: ${ref}`);
  }

  // web_accessible_resources are globs; check each glob matches something.
  for (const war of m.web_accessible_resources ?? []) {
    for (const pattern of war.resources ?? []) {
      const base = pattern.replace(/\/\*$/, '');
      if (pattern.endsWith('/*')) {
        if (!existsSync(join(dir, base))) fail(target, `web_accessible_resources: ${base}/ missing`);
        else if ((await readdir(join(dir, base))).length === 0)
          fail(target, `web_accessible_resources: ${base}/ is empty`);
      } else if (!existsSync(join(dir, pattern))) {
        fail(target, `web_accessible_resources: ${pattern} missing`);
      }
    }
  }

  /* ---------------------------------------------------------- HTML pages */

  for (const name of await readdir(dir)) {
    if (extname(name) !== '.html') continue;
    const html = await readFile(join(dir, name), 'utf8');

    // An inline script is dropped silently by the MV3 CSP: blank page, no error.
    for (const tag of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
      if (tag[1].trim()) fail(target, `${name} has an inline <script>; MV3 CSP drops it silently`);
    }
    for (const src of html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) {
      const v = src[1];
      if (/^https?:/.test(v)) fail(target, `${name} loads remote script ${v} — grounds for removal`);
      else if (!existsSync(join(dir, v.replace(/^\//, '')))) fail(target, `${name} → missing ${v}`);
    }
    for (const href of html.matchAll(/<link[^>]*\bhref="([^"]+)"/g)) {
      const v = href[1];
      if (/^https?:/.test(v)) fail(target, `${name} loads remote stylesheet ${v}`);
      else if (!existsSync(join(dir, v.replace(/^\//, '')))) fail(target, `${name} → missing ${v}`);
    }
  }

  /* -------------------------------------------------------- remote code */

  for (const name of await readdir(dir)) {
    if (extname(name) !== '.js') continue;
    const js = await readFile(join(dir, name), 'utf8');
    // Minified output legitimately contains the substring "eval" inside words
    // like "evaluate", so match a call.
    if (/[^.\w]eval\s*\(/.test(js)) fail(target, `${name} calls eval() — grounds for removal`);
    if (/new\s+Function\s*\(/.test(js)) fail(target, `${name} uses new Function() — remote code`);
    if (/<script/i.test(js) && name !== 'content.js') {
      note(target, `${name} contains the string "<script" — check it is not injecting one`);
    }
  }

  /* ------------------------------------------------- unused permissions */

  for (const perm of m.permissions ?? []) {
    if (NON_API_PERMISSIONS[perm]) {
      note(target, `permission "${perm}": ${NON_API_PERMISSIONS[perm]}`);
      continue;
    }
    const names = PERMISSION_ALIASES[perm] ?? [perm];
    const used = names.some((n) => new RegExp(`\\b(api|chrome|browser)\\.${n}\\b`).test(src));
    if (!used) {
      fail(
        target,
        `permission "${perm}" is declared but never used — the most common ` +
          'Chrome Web Store rejection reason',
      );
    }
  }

  /* --------------------------------------------------- per-store details */

  if (m.manifest_version !== 3) fail(target, `manifest_version is ${m.manifest_version}, expected 3`);
  if (!/^\d+\.\d+(\.\d+)?(\.\d+)?$/.test(m.version)) fail(target, `version "${m.version}" is not store-legal`);

  const desc = (await localisedValue(dir, m, m.description)) ?? '';
  if (desc.length > 132) fail(target, `description is ${desc.length} chars; the store limit is 132`);
  if (!desc) fail(target, 'description is empty');

  if (target === 'firefox') {
    if (!m.browser_specific_settings?.gecko?.id) fail(target, 'Firefox build has no gecko.id');
    if (m.background?.service_worker) fail(target, 'Firefox does not support background.service_worker');
    if (m.web_accessible_resources?.some((w) => 'use_dynamic_url' in w))
      fail(target, 'use_dynamic_url is unsupported in Firefox and warns at AMO review');
  }

  if (target === 'safari') {
    if (!m.browser_specific_settings?.safari?.strict_min_version)
      fail(target, 'Safari build has no safari.strict_min_version');
    for (const banned of ['notifications', 'idle']) {
      if ((m.permissions ?? []).includes(banned))
        fail(target, `Safari has never implemented "${banned}"; do not declare it`);
    }
    if (m.minimum_chrome_version) fail(target, 'minimum_chrome_version is meaningless in Safari');
  }

  if (target === 'chrome' && !m.minimum_chrome_version) {
    note(target, 'no minimum_chrome_version; Chrome will offer the extension to versions that cannot run it');
  }

  const size = await dirSize(dir);
  note(target, `${(size / 1024).toFixed(0)} KB unpacked`);
}

/** Resolve a __MSG_key__ value against the default locale. */
async function localisedValue(dir, m, value) {
  const match = /^__MSG_([A-Za-z0-9_]+)__$/.exec(String(value ?? ''));
  if (!match) return value;
  const f = join(dir, '_locales', m.default_locale, 'messages.json');
  if (!existsSync(f)) return undefined;
  const msgs = JSON.parse(await readFile(f, 'utf8'));
  return msgs[match[1]]?.message;
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

const src = await sourceText();
for (const target of TARGETS) await validate(target, src);

console.log(`package validation — ${TARGETS.join(', ')}\n`);
for (const n of notes) console.log(`  note  ${n}`);
if (notes.length) console.log('');

if (problems.length === 0) {
  console.log(`  all ${TARGETS.length} packages pass.`);
} else {
  for (const p of problems) console.error(`  FAIL  ${p}`);
  console.error(`\n${problems.length} problem(s) — these are store rejections, fix before upload`);
  process.exit(1);
}
