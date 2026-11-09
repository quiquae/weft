/**
 * What `npm run compat` judges, and how. `tools/compat-audit.mjs` prints;
 * this module decides, so the deciding can be tested without a process.
 *
 * Two halves, one verdict. The code's half is a list written by hand in the
 * audit, because what the code calls cannot be read off a file. The
 * manifest's half is not written anywhere: `manifestKeys()` walks what
 * `buildManifest(target)` actually writes, and each key and permission is
 * judged on the target that declares it, at that target's floor. Until
 * 2026-10-25 the audit judged five manifest keys from its own list, in all
 * three browsers alike, and never read a manifest, so a Safari build
 * declaring `notifications` and `idle` — the near-miss its header says it
 * exists to stop — passed it.
 *
 * Pure: MDN's data is passed in, never imported, so the tests can hand it a
 * tree of their own.
 */

export type Verdict = 'PASS' | 'DEGRADES' | 'FAIL' | 'NO-DATA' | 'UNTRACKED';

export interface Judgement {
  verdict: Verdict;
  detail: string;
}

/** A key a manifest declares: as the manifest spells it, and MDN's path for it. */
export interface ManifestKey {
  label: string;
  path: string;
}

export interface KeyResult extends ManifestKey, Judgement {
  target: string;
  fallback?: string;
}

/** Walk a dotted path through MDN's data, returning undefined rather than throwing. */
export function at(data: unknown, path: string): any {
  let node: any = data;
  for (const part of path.split('.')) {
    if (node === undefined || node === null) return undefined;
    node = node[part];
  }
  return node;
}

const clean = (v: unknown): string => String(v).replace(/^[≤<>=~ ]+/, '');

/** True when a version string is something we can actually compare. */
function isNumericVersion(v: unknown): boolean {
  const parts = clean(v).split('.');
  return parts.length > 0 && parts.every((p) => p !== '' && Number.isFinite(Number(p)));
}

/**
 * Compare dotted version strings numerically.
 *
 * Needed because string comparison puts "9" after "16.4", and because MDN
 * uses "≤" prefixes for "at or before this release" and `true` for "since
 * forever". Returns negative when a < b.
 *
 * Throws on anything non-numeric rather than returning NaN, because NaN was
 * a silent false pass. MDN also uses "preview" for a feature that exists
 * only in a browser's technology preview — Safari's requestIdleCallback was
 * marked that way — and `cmp('preview', '16.4')` is NaN, so the
 * `cmp(...) > 0` test read false and the feature was reported as SUPPORTED
 * at our floor. A tool whose whole job is refusing to guess about browser
 * support cannot afford to guess optimistically when it meets a version
 * string it does not understand.
 */
function cmp(a: unknown, b: unknown): number {
  if (!isNumericVersion(a) || !isNumericVersion(b)) {
    throw new Error(`non-numeric version compared: ${a} vs ${b}`);
  }
  const pa = clean(a).split('.').map(Number);
  const pb = clean(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

interface Support {
  known: boolean;
  supported?: boolean;
  since?: string;
  removedIn?: string;
  partial?: boolean;
}

/**
 * Resolve support for one browser into a comparable shape.
 *
 * MDN gives an array when a feature was added, removed and re-added; the
 * first element is the current state, which is the one we want. A
 * `version_removed` matters: a feature present in 14 and gone in 17 is not
 * support.
 */
function support(node: any, browser: string): Support {
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

/**
 * PASS when supported at or below the floor. Otherwise DEGRADES when a
 * fallback is named and FAIL when none is: the distinction is the whole
 * point, since "Safari lacks the Highlight API" is handled and "Safari lacks
 * notifications and we call it unguarded" is a bug. NO-DATA is not a pass.
 */
export function judge(node: unknown, browser: string, floor: string, fallback?: string): Judgement {
  if (node === undefined || node === null) return { verdict: 'NO-DATA', detail: 'path not in compat data' };
  const s = support(node, browser);
  if (!s.known) return { verdict: 'NO-DATA', detail: 'no entry for this browser' };
  const short = (detail: string): Judgement => ({ verdict: fallback ? 'DEGRADES' : 'FAIL', detail });
  if (!s.supported) return short(s.removedIn ? `removed in ${s.removedIn}` : 'never implemented');
  // "preview" and friends: present somewhere, but not in a release a user
  // can install, so treat it exactly as unsupported.
  if (!isNumericVersion(s.since)) return short(`marked "${s.since}" — not a released version`);
  if (cmp(s.since, floor) > 0) return short(`needs ${s.since}, we claim ${floor}`);
  return { verdict: 'PASS', detail: `since ${s.since}${s.partial ? ' (partial)' : ''}` };
}

/* ------------------------------------------------------------ the manifest */

const MANIFEST = 'webextensions.manifest';

/**
 * Keys whose children are names a developer chooses — an icon's size, a
 * command's name — rather than keys MDN could have an entry for.
 */
const NAMES = new Set(['icons', 'action.default_icon', 'commands']);

/** Lists whose items are permissions, each judged under MDN's `permissions`. */
const PERMISSION_LISTS = new Map([
  ['permissions', 'permission'],
  ['optional_permissions', 'optional permission'],
]);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Every key a manifest declares, and every permission it asks for, as MDN's
 * path for it. Objects are walked into; so is each object in an array, under
 * the array's own path, which is how MDN files `web_accessible_resources`.
 * A list of strings is a value — match patterns, file names — except a list
 * of permissions.
 */
export function manifestKeys(manifest: Record<string, unknown>): ManifestKey[] {
  const keys: ManifestKey[] = [];
  const walk = (object: Record<string, unknown>, labelPrefix: string, dottedPrefix: string): void => {
    for (const [key, value] of Object.entries(object)) {
      const label = labelPrefix + key;
      const dotted = dottedPrefix + key;
      keys.push({ label, path: `${MANIFEST}.${dotted}` });
      const list = PERMISSION_LISTS.get(dotted);
      if (list && Array.isArray(value)) {
        for (const p of value) keys.push({ label: `${list} ${p}`, path: `${MANIFEST}.permissions.${p}` });
      } else if (NAMES.has(dotted)) {
        continue;
      } else if (Array.isArray(value)) {
        for (const item of value) if (isObject(item)) walk(item, `${label}[].`, `${dotted}.`);
      } else if (isObject(value)) {
        walk(value, `${label}.`, `${dotted}.`);
      }
    }
  };
  walk(manifest, '', '');
  return keys;
}

const BSS = 'https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings';

/**
 * Keys MDN's compatibility data has no entry for, each named for exactly the
 * targets whose manifests declare it, with the page that documents it. Any
 * other key MDN does not know is NO-DATA, and fails: most likely it is
 * misspelt. A line goes the day MDN gains an entry for its key, which is
 * then judged like any other.
 */
export const UNTRACKED: Record<string, { targets: string[]; why: string; source: string }> = {
  [`${MANIFEST}.minimum_chrome_version`]: {
    targets: ['chrome'],
    why: 'Chrome’s own key, which Chrome documents and MDN does not: below it the store shows “Not compatible”',
    source: 'https://developer.chrome.com/docs/extensions/reference/manifest/minimum-chrome-version',
  },
  [`${MANIFEST}.browser_specific_settings.gecko.id`]: {
    targets: ['firefox'],
    why: 'MDN documents it in prose, not in its data: the id signing a Manifest V3 extension requires',
    source: BSS,
  },
  [`${MANIFEST}.browser_specific_settings.gecko.strict_min_version`]: {
    targets: ['firefox'],
    why: 'MDN documents it in prose, not in its data: below it Firefox does not install or run the extension',
    source: BSS,
  },
  [`${MANIFEST}.browser_specific_settings.gecko.data_collection_permissions.required`]: {
    targets: ['firefox'],
    why: 'MDN documents it in prose, not in its data: what an add-on must collect to work at all, here none',
    source: BSS,
  },
  [`${MANIFEST}.browser_specific_settings.gecko.data_collection_permissions.optional`]: {
    targets: ['firefox'],
    why: 'MDN documents it in prose, not in its data: what Firefox asks the reader for later, here website content',
    source: BSS,
  },
  [`${MANIFEST}.browser_specific_settings.gecko_android.strict_min_version`]: {
    targets: ['firefox'],
    why: 'MDN documents it in prose, not in its data: the Android floor, 142, where data collection consent arrived',
    source: BSS,
  },
  [`${MANIFEST}.browser_specific_settings.safari.strict_min_version`]: {
    targets: ['safari'],
    why: 'MDN documents it in prose, not in its data: the minimum version of Safari to support',
    source: BSS,
  },
};

/** What happens where a target declares a key it does not support at its floor. */
export const KEY_FALLBACKS: Record<string, string> = {
  [`${MANIFEST}.commands`]: 'api.commands?.onCommand optional chain; every command has UI too',
  [`${MANIFEST}.browser_specific_settings.gecko_android`]:
    'desktop Firefox ignores it; it only sets the Android floor that data collection consent needs',
  [`${MANIFEST}.web_accessible_resources.use_dynamic_url`]:
    'false is what an absent key means, so a Chrome that does not read it behaves as declared',
};

/**
 * Judge every key of each target's manifest on that target alone. The
 * target's name is also MDN's name for its browser.
 */
export function auditManifests(
  manifests: Record<string, Record<string, unknown>>,
  minimums: Record<string, string>,
  data: unknown,
): KeyResult[] {
  const results: KeyResult[] = [];
  for (const [target, manifest] of Object.entries(manifests)) {
    const floor = minimums[target];
    if (floor === undefined) throw new Error(`no floor is declared for ${target}`);
    for (const key of manifestKeys(manifest)) {
      const node = at(data, key.path);
      if (node === undefined) {
        const line = UNTRACKED[key.path];
        results.push(
          line?.targets.includes(target)
            ? { ...key, target, verdict: 'UNTRACKED', detail: line.why }
            : { ...key, target, verdict: 'NO-DATA', detail: `MDN has no entry for it, and UNTRACKED does not name it for ${target}` },
        );
        continue;
      }
      const fallback = KEY_FALLBACKS[key.path];
      const judgement = judge(node, target, floor, fallback);
      results.push({ ...key, target, ...judgement, ...(judgement.verdict === 'DEGRADES' ? { fallback } : {}) });
    }
  }
  return results;
}
