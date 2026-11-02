/**
 * What a manifest may ask for at install, and the one function that says.
 *
 * Weft declares no static `content_scripts` and asks for no host permission
 * at install: every web origin is optional, requested one at a time from a
 * click on Weft's own pages, and the worker registers the content script for
 * the origins granted. The test build is the one exception, on purpose.
 * Chrome shows a native dialog for an optional permission request, which
 * Playwright cannot dismiss, so `buildManifest(target, { test: true })`
 * grants the loopback origins the end-to-end server listens on, and
 * `tools/validate-package.mjs` refuses a package that still carries them.
 *
 * `tests/tools/install-permissions.test.ts` holds every target's manifest to
 * `installFaults()`, in both builds; `npm run validate` runs it on the bytes
 * of each built package, and `npm run verify:release` on the package GitHub
 * serves.
 */

/** Every web origin: what the per-origin consent design requests from. */
export const EVERY_WEB_ORIGIN = '*://*/*';

/** The hosts the test build may grant, which the end-to-end server listens on. */
const LOOPBACK = new Set(['localhost', '127.0.0.1']);

export type Build = 'production' | 'test';

/** Whether `entry` names a site, as a match pattern or `<all_urls>` does. */
const namesASite = (entry: unknown): boolean =>
  typeof entry === 'string' && (entry === '<all_urls>' || entry.includes('://'));

/** The host a match pattern names, without its port, or null where it names none. */
function hostOf(pattern: unknown): string | null {
  if (typeof pattern !== 'string') return null;
  const m = /^(?:\*|https?):\/\/([^/]+)\//.exec(pattern);
  return m?.[1] ? m[1].replace(/:\d+$/, '') : null;
}

/**
 * Each way `manifest` reaches a site nobody has granted, as a sentence that
 * names the key; empty when it reaches none.
 *
 * A key is judged wherever it appears, whatever its value: an empty
 * `content_scripts` is a key somebody means to fill, and a production
 * `host_permissions` of `[]` is the test seam half removed.
 */
export function installFaults(manifest: Record<string, unknown>, build: Build): string[] {
  const faults: string[] = [];

  if ('content_scripts' in manifest) {
    faults.push(
      `declares static content_scripts ${JSON.stringify(manifest.content_scripts)}, which run wherever ` +
        'their matches say from the moment of install; the content script is registered at runtime, ' +
        'for the origins the user grants',
    );
  }

  if ('host_permissions' in manifest) {
    const hosts = manifest.host_permissions;
    if (build === 'production') {
      faults.push(
        `declares host_permissions ${JSON.stringify(hosts)}, which are granted at install — that is the ` +
          'test-build seam and must never ship; rebuild without --test',
      );
    } else {
      const wide = (Array.isArray(hosts) ? hosts : [hosts]).filter((p) => !LOOPBACK.has(hostOf(p) ?? ''));
      if (wide.length) {
        faults.push(
          `the test build's host_permissions grant ${wide.map(String).join(', ')}, beyond the loopback ` +
            'origins the end-to-end server listens on',
        );
      }
    }
  }

  const named = Array.isArray(manifest.permissions) ? manifest.permissions.filter(namesASite) : [];
  if (named.length) {
    faults.push(`lists ${named.join(', ')} under permissions, which grants a site at install`);
  }

  const optional = manifest.optional_host_permissions;
  if (!(Array.isArray(optional) && optional.length === 1 && optional[0] === EVERY_WEB_ORIGIN)) {
    faults.push(
      `optional_host_permissions is ${JSON.stringify(optional)}, where the per-origin consent design ` +
        `needs exactly ["${EVERY_WEB_ORIGIN}"]: narrower, and a site the user names cannot be requested; ` +
        'wider, and it reaches file: pages, which Weft refuses',
    );
  }

  return faults;
}
