/**
 * Thin cross-browser shim.
 *
 * Firefox exposes `browser` with promises; Chrome exposes `chrome`, which has
 * also been promise-based since MV3. Rather than pull in webextension-polyfill
 * (which is 20 KB in a content script that runs on every page load), we alias
 * the namespace and rely on the promise APIs both browsers now implement.
 */

declare const browser: typeof chrome | undefined;

export const api: typeof chrome =
  typeof browser !== 'undefined' && browser ? (browser as typeof chrome) : chrome;

export const isFirefox = typeof browser !== 'undefined' && browser !== undefined;

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
