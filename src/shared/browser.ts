/**
 * Thin cross-browser shim.
 *
 * Firefox and Safari both expose `browser` with promises; Chrome exposes
 * `chrome`, which has also been promise-based since MV3. Rather than pull in
 * webextension-polyfill (20 KB in a content script that runs on every page
 * load) we alias the namespace and rely on the promise APIs all three now
 * implement.
 */

declare const browser: typeof chrome | undefined;

export const api: typeof chrome =
  typeof browser !== 'undefined' && browser ? (browser as typeof chrome) : chrome;

/**
 * Which build this is.
 *
 * Authoritative because Weft ships a separate package per store, so the
 * target is known at build time and never has to be sniffed. Kept as a
 * declared value rather than derived from the user agent because every
 * user-agent heuristic for "is this Safari" is wrong for some Chromium fork.
 */
export const ENGINE = __WEFT_TARGET__;

/**
 * The brands the running browser names itself by, empty where it names none.
 *
 * The build says which package this is, never which Chromium browser runs the
 * Chrome one: Microsoft Edge runs it unchanged. `navigator.userAgentData` has
 * been in every Chromium since 90, Weft's floor being 116, and in neither
 * Firefox nor Safari, whose builds never need to ask. Read only where the
 * answer changes what Weft can honestly offer, which is Hard Mode's file.
 */
export function uaBrands(): string[] {
  const data = (globalThis.navigator as { userAgentData?: { brands?: Array<{ brand: string }> } } | undefined)
    ?.userAgentData;
  return data?.brands?.map((entry) => entry.brand) ?? [];
}

/**
 * Where the store this copy came from serves its updates, undefined for an
 * unpacked copy. Each store writes its own address into the manifest of every
 * copy it serves (the Chrome Web Store
 * `https://clients2.google.com/service/update2/crx`, Edge Add-ons
 * `https://edge.microsoft.com/extensionwebstorebase/v1/crx`, read off a CRX
 * fetched from each on 2026-11-07), so it says which store a policy has to
 * name for this copy. Read only for Hard Mode's file, as the brands are.
 */
export function updateUrl(): string | undefined {
  return api.runtime.getManifest().update_url;
}

/**
 * Capabilities, not engines.
 *
 * `isFirefox` used to live here, defined as `typeof browser !== 'undefined'`
 * — which is also true in Safari, so it answered "Firefox" on Safari. It
 * happened to be harmless because nothing read it, but it was a loaded gun:
 * the next person to branch on it would have shipped Firefox behaviour to
 * Safari users.
 *
 * The replacement asks what it actually needs to know. Code branching on
 * "does this browser have notifications" keeps working when a browser gains
 * the API; code branching on "is this Safari" does not. Every flag here is a
 * live probe of the namespace, so a Safari release that adds an API is picked
 * up without a rebuild.
 *
 * Support at the time of writing, from MDN's compatibility data — see
 * `tools/compat-audit.mjs`, which fails the build if these drift:
 *
 * | API             | Chrome | Firefox | Safari  |
 * |-----------------|--------|---------|---------|
 * | notifications   | 28     | 45      | never   |
 * | idle            | 6      | 45      | never   |
 * | contextMenus    | 6      | 55      | 14 (as `menus` too) |
 * | commands        | 25     | 48      | 26      |
 */
export const can = {
  /** Safari has never shipped browser.notifications. */
  get notify(): boolean {
    return typeof api?.notifications?.create === 'function';
  },
  /** Safari exposes `menus`; Chrome exposes `contextMenus`; Firefox both. */
  get contextMenus(): boolean {
    return Boolean(contextMenus());
  },
  /** Safari only gained the `commands` manifest key in Safari 26. */
  get commands(): boolean {
    return typeof api?.commands?.onCommand?.addListener === 'function';
  },
  /** Chrome-only; used to set a badge when a notification is unavailable. */
  get badge(): boolean {
    return typeof api?.action?.setBadgeText === 'function';
  },
};

/**
 * The context-menu namespace under whichever name this browser uses.
 *
 * Safari and Firefox call it `menus`, Chrome calls it `contextMenus`, and
 * Firefox aliases both. Returning the namespace rather than a boolean means
 * callers never have to repeat the fallback.
 */
export function contextMenus(): typeof chrome.contextMenus | undefined {
  const withMenus = api as unknown as { menus?: typeof chrome.contextMenus };
  return api?.contextMenus ?? withMenus?.menus;
}

/** Resolve a packaged resource URL. */
export function resourceUrl(path: string): string {
  return api.runtime.getURL(path);
}

/**
 * True when the extension context is still valid.
 *
 * A content script outlives its extension across an update or a reload, and
 * every `chrome.*` call then throws "Extension context invalidated". Checking
 * before each call is the difference between a clean shutdown and a console
 * full of red on every page the user has open when they update.
 */
export function contextAlive(): boolean {
  try {
    return Boolean(api.runtime?.id);
  } catch {
    return false;
  }
}
