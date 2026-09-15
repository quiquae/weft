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
 */
import bcd from '@mdn/browser-compat-data' with { type: 'json' };
import { MINIMUMS } from '../manifest.config.mjs';

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
  {
    path: 'webextensions.manifest.optional_host_permissions',
    why: 'hosts are granted per-origin at runtime, never at install',
  },
  { path: 'webextensions.api.storage.local', why: 'all persistence' },
  { path: 'webextensions.api.alarms', why: 'the attention tick and lock cooldowns' },
  { path: 'webextensions.api.permissions.request', why: 'the grant flow' },
  { path: 'webextensions.api.tabs.query', why: 'finding the tab in front of the reader' },
  { path: 'webextensions.manifest.action', why: 'the popup' },
  { path: 'webextensions.manifest.options_ui', why: 'the settings page' },
  { path: 'webextensions.manifest.default_locale', why: 'the _locales bundle' },

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
    path: 'webextensions.manifest.commands',
    why: 'keyboard shortcuts for reveal, cycle and panic',
    fallback: 'api.commands?.onCommand optional chain; every command has UI too',
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
    fallback: 'src/content/index.ts schedule() → window.setTimeout(fn, 16)',
  },
];

/* ------------------------------------------------------------------ utils */

/** Walk a dotted BCD path, returning undefined rather than throwing. */
function at(path) {
  let node = bcd;
  for (const part of path.split('.')) {
    if (node === undefined || node === null) return undefined;
    node = node[part];
  }
  return node;
}

/**
 * Compare dotted version strings numerically.
 *
 * Needed because string comparison puts "9" after "16.4", and because BCD
 * uses "≤" prefixes for "at or before this release" and `true` for "since
 * forever". Returns negative when a < b.
 */
function cmp(a, b) {
  const clean = (v) => String(v).replace(/^[≤<>=~ ]+/, '');
  const pa = clean(a).split('.').map(Number);
  const pb = clean(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Resolve support for one browser into a comparable shape.
 *
 * BCD gives an array when a feature was added, removed and re-added; the
 * first element is the current state, which is the one we want. A
 * `version_removed` matters: a feature present in 14 and gone in 17 is not
 * support.
 */
function support(node, browser) {
  const raw = node?.__compat?.support?.[browser];
  if (raw === undefined) return { known: false };
  const entry = Array.isArray(raw) ? raw[0] : raw;
  if (entry.version_added === false) return { known: true, supported: false };
  if (entry.version_removed) return { known: true, supported: false, removedIn: entry.version_removed };
  return {
    known: true,
    supported: true,
    since: entry.version_added === true ? '0' : entry.version_added,
    partial: Boolean(entry.partial_implementation),
  };
}

/* ------------------------------------------------------------------- main */

const results = [];
let failures = 0;
let degradations = 0;
let unknown = 0;

for (const dep of DEPENDENCIES) {
  const node = at(dep.path);
  if (!node) {
    results.push({ dep, browser: '-', verdict: 'NO-DATA', detail: 'path not in compat data' });
    unknown++;
    continue;
  }

  for (const [target, key] of Object.entries(BROWSERS)) {
    const floor = MINIMUMS[target];
    const s = support(node, key);

    if (!s.known) {
      results.push({ dep, browser: target, verdict: 'NO-DATA', detail: 'no entry for this browser' });
      unknown++;
      continue;
    }

    if (!s.supported) {
      const detail = s.removedIn ? `removed in ${s.removedIn}` : 'never implemented';
      if (dep.fallback) {
        results.push({ dep, browser: target, verdict: 'DEGRADES', detail });
        degradations++;
      } else {
        results.push({ dep, browser: target, verdict: 'FAIL', detail });
        failures++;
      }
      continue;
    }

    if (cmp(s.since, floor) > 0) {
      const detail = `needs ${s.since}, we claim ${floor}`;
      if (dep.fallback) {
        results.push({ dep, browser: target, verdict: 'DEGRADES', detail });
        degradations++;
      } else {
        results.push({ dep, browser: target, verdict: 'FAIL', detail });
        failures++;
      }
      continue;
    }

    results.push({
      dep,
      browser: target,
      verdict: 'PASS',
      detail: `since ${s.since}${s.partial ? ' (partial)' : ''}`,
    });
  }
}

const shown = results.filter((r) => r.verdict !== 'PASS');
const floors = Object.entries(MINIMUMS)
  .map(([k, v]) => `${k} ${v}`)
  .join(', ');

console.log(`compat audit — floors: ${floors}`);
console.log(`${DEPENDENCIES.length} dependencies x ${Object.keys(BROWSERS).length} browsers\n`);

if (shown.length === 0) {
  console.log('  everything supported at or below every declared floor.');
} else {
  for (const r of shown) {
    const tag = r.verdict.padEnd(8);
    console.log(`  ${tag} ${r.browser.padEnd(8)} ${r.dep.path}`);
    console.log(`           ${r.detail}`);
    if (r.dep.fallback) console.log(`           fallback: ${r.dep.fallback}`);
    else if (r.verdict === 'FAIL') console.log(`           needed for: ${r.dep.why}`);
  }
}

console.log(
  `\n  ${results.filter((r) => r.verdict === 'PASS').length} pass, ` +
    `${degradations} degrade with a named fallback, ${failures} fail, ${unknown} without data`,
);

if (unknown) {
  console.log(
    '\n  NO-DATA is not a pass. It means MDN has no entry for that path, so\n' +
      '  the path is probably misspelled — fix the path, do not ignore the line.',
  );
}

if (failures || unknown) {
  console.error(`\ncompat audit failed: ${failures} unsupported without a fallback, ${unknown} unverifiable`);
  process.exit(1);
}
