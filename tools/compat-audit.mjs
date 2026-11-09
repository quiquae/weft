#!/usr/bin/env node
/**
 * Does every browser we claim to support actually implement what we use?
 *
 * This exists because of a specific near-miss. Weft shipped a manifest
 * declaring the `idle` and `notifications` permissions. Safari has never
 * implemented either — not "not yet", MDN marks them unsupported outright —
 * and `notify()` was a bare `api.notifications.create(...)` inside a
 * try/catch. On Safari that is a TypeError, caught and discarded: every
 * notification Weft sends, silently dropped on an entire platform, with
 * nothing in the console and no test to catch it.
 *
 * Guessing at browser support does not work, and neither does reading a
 * compatibility table once and trusting the memory of it. So the support
 * matrix is queried from MDN's browser-compat-data at build time and checked
 * against the floors declared in `manifest.config.mjs`.
 *
 * Three verdicts:
 *
 *   PASS      supported at or below our declared minimum.
 *   DEGRADES  unsupported, or supported only above our minimum, AND we have
 *             a feature-detected fallback. Printed, not fatal.
 *   FAIL      unsupported with no fallback. Exits non-zero.
 *
 * The distinction is the whole point. "Safari lacks the Highlight API" is
 * fine — the content script probes for it and falls back to wrapped spans.
 * "Safari lacks notifications and we call it unguarded" is a bug. Only the
 * second should stop a release, and before this tool existed neither did.
 *
 * Two halves. What the code calls is listed below by hand, because it cannot
 * be read off a file. What the manifests declare is not listed anywhere: each
 * target's `buildManifest()` is walked, key by key and permission by
 * permission, and each is judged on that target alone (`tools/compat.ts`).
 * Until 2026-10-25 five manifest keys sat in the list below, judged in all
 * three browsers alike, and no manifest was read — so a Safari build that
 * declared `notifications` and `idle` again, the near-miss above, passed.
 */
import bcd from '@mdn/browser-compat-data' with { type: 'json' };
import { MINIMUMS, TARGETS, buildManifest } from '../manifest.config.mjs';
import { at, auditManifests, judge, manifestKeys } from './compat.ts';

/** MDN browser keys for the engines we ship to. */
const BROWSERS = { chrome: 'chrome', firefox: 'firefox', safari: 'safari' };

/**
 * What Weft depends on.
 *
 * `fallback` is the honest field: it names the code that handles the feature
 * being absent. An entry with no fallback is a hard requirement, and a
 * browser that lacks it cannot be a supported target. Writing the fallback
 * down here — rather than "we probably handle that" — is what makes the
 * DEGRADES verdict trustworthy.
 */
const DEPENDENCIES = [
  // ---------------------------------------------------------------- core
  {
    path: 'webextensions.api.scripting.registerContentScripts',
    why: 'the entire per-origin consent design; no static content_scripts exist',
  },
  {
    path: 'webextensions.api.scripting.RegisteredContentScript.persistAcrossSessions',
    why: 'registration must survive the service worker being killed',
  },
  { path: 'webextensions.api.storage.local', why: 'all persistence' },
  { path: 'webextensions.api.alarms', why: 'the attention tick and lock cooldowns' },
  { path: 'webextensions.api.permissions.request', why: 'the grant flow' },
  { path: 'webextensions.api.tabs.query', why: 'finding the tab in front of the reader' },

  // ------------------------------------------------- degrade gracefully
  {
    path: 'webextensions.api.notifications',
    why: 'confirming a lock cleared or a panic pass was spent',
    fallback: 'src/shared/browser.ts can.notify → action.setBadgeText',
  },
  {
    path: 'webextensions.api.menus',
    why: 'right-click shortcuts to progress and settings',
    fallback: 'src/shared/browser.ts contextMenus() returns undefined; setup returns early',
  },
  {
    path: 'webextensions.api.action.setBadgeText',
    why: 'the notification fallback itself',
    fallback: 'src/shared/browser.ts can.badge → notify() returns silently',
  },

  // --------------------------------------------------------- web platform
  {
    path: 'api.Highlight',
    why: 'the default renderer styles ranges without touching the DOM',
    fallback: 'HighlightRenderer.supported() → WrappedRenderer',
  },
  {
    path: 'css.selectors.highlight',
    why: 'the ::highlight() rules the renderer depends on',
    fallback: 'HighlightRenderer.supported() → WrappedRenderer',
  },
  {
    path: 'api.ShadowRoot.adoptedStyleSheets',
    why: 'tooltip styling inside a closed shadow root',
  },
  { path: 'api.Element.attachShadow', why: 'the tooltip is isolated from page CSS' },
  { path: 'api.structuredClone', why: 'manifest generation and settings cloning' },
  {
    path: 'api.SubtleCrypto.verify',
    why: 'offline ECDSA licence verification; there is no activation server',
  },
  {
    path: 'api.Window.requestIdleCallback',
    why: 'weaving is scheduled off the critical path',
    fallback: 'src/content/page.ts schedule() → window.setTimeout(fn, 16)',
  },
];

/* ------------------------------------------------------------------- main */

/** "UNTRACKED" is the longest verdict. */
const TAG = 9;
const INDENT = ' '.repeat(2 + TAG + 1);

/** Print every line worth reading: everything but a pass. */
function show(rows) {
  const shown = rows.filter((r) => r.verdict !== 'PASS');
  if (shown.length === 0) console.log('  everything supported at or below every declared floor.');
  for (const r of shown) {
    console.log(`  ${r.verdict.padEnd(TAG)} ${r.browser.padEnd(8)} ${r.name}`);
    console.log(`${INDENT}${r.detail}`);
    if (r.fallback) console.log(`${INDENT}fallback: ${r.fallback}`);
    else if (r.verdict === 'FAIL' && r.why) console.log(`${INDENT}needed for: ${r.why}`);
  }
}

function tally(rows) {
  const n = (verdict) => rows.filter((r) => r.verdict === verdict).length;
  return { pass: n('PASS'), degrade: n('DEGRADES'), fail: n('FAIL'), unknown: n('NO-DATA'), untracked: n('UNTRACKED') };
}

const floors = Object.entries(MINIMUMS)
  .map(([k, v]) => `${k} ${v}`)
  .join(', ');
console.log(`compat audit — floors: ${floors}`);

// The code's half: every listed path, in every browser.
const code = [];
for (const dep of DEPENDENCIES) {
  const node = at(bcd, dep.path);
  if (!node) {
    code.push({ browser: '-', name: dep.path, verdict: 'NO-DATA', detail: 'path not in compat data' });
    continue;
  }
  for (const [target, key] of Object.entries(BROWSERS)) {
    const judgement = judge(node, key, MINIMUMS[target], dep.fallback);
    code.push({
      browser: target,
      name: dep.path,
      why: dep.why,
      ...judgement,
      ...(judgement.verdict === 'DEGRADES' ? { fallback: dep.fallback } : {}),
    });
  }
}

console.log(`\n${DEPENDENCIES.length} dependencies of the code x ${Object.keys(BROWSERS).length} browsers\n`);
show(code);
const c = tally(code);
console.log(`\n  ${c.pass} pass, ${c.degrade} degrade with a named fallback, ${c.fail} fail, ${c.unknown} without data`);

// The manifests' half: every key each target's manifest declares, on that target.
const manifests = Object.fromEntries(TARGETS.map((target) => [target, buildManifest(target)]));
const keys = auditManifests(manifests, MINIMUMS, bcd).map((r) => ({ ...r, browser: r.target, name: r.label }));
const counts = TARGETS.map((target) => `${target} ${manifestKeys(manifests[target]).length} keys`).join(', ');

console.log(`\nmanifest keys, each on its own target: ${counts}\n`);
show(keys);
const k = tally(keys);
console.log(
  `\n  ${k.pass} pass, ${k.degrade} degrade with a named fallback, ` +
    `${k.untracked} untracked by MDN and named, ${k.fail} fail, ${k.unknown} without data`,
);

const failures = c.fail + k.fail;
const unknown = c.unknown + k.unknown;

if (unknown) {
  console.log(
    '\n  NO-DATA is not a pass. It means MDN has no entry for that path, so\n' +
      '  the path is probably misspelled — fix the path, do not ignore the line.\n' +
      '  A manifest key MDN really does not track is named in UNTRACKED in\n' +
      '  tools/compat.ts, for the targets that declare it, with its page.',
  );
}

if (failures || unknown) {
  console.error(`\ncompat audit failed: ${failures} unsupported without a fallback, ${unknown} unverifiable`);
  // exitCode rather than exit(): exit() can cut off output still queued for a pipe.
  process.exitCode = 1;
}
