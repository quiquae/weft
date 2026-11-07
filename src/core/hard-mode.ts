/**
 * Where Hard Mode has a file to offer.
 *
 * Hard Mode is a managed-policy file marking Weft force-installed, and a
 * policy holds only in the browser that reads it. Weft writes Google Chrome's
 * and Microsoft Edge's (`src/background/hard-mode.ts`). Until 2026-11-07 the
 * settings page offered Chrome's in every build and every browser, so Firefox
 * was handed a Chrome policy naming a Firefox add-on, Edge, which runs the
 * Chrome package unchanged, was handed a file it never reads, and Safari one
 * nothing applies. A file nothing obeys is worse than no file: it looks like
 * Hard Mode and holds nothing, and the person who installed it finds out on
 * the day they try to remove Weft and can.
 *
 * The build is known at build time. Which Chromium browser runs the Chrome
 * package is not, so it is read from the brands the browser names itself by
 * (`navigator.userAgentData.brands`, which every Chromium Weft supports has),
 * handed in by the caller so that this stays a function of its arguments.
 *
 * Edge's file holds for one copy only. Microsoft's `ExtensionSettings` page,
 * read 2026-11-07: "apps and extensions from outside the Microsoft Edge
 * Add-ons website can only be forced installed if the instance is joined to a
 * Microsoft Active Directory domain or joined to Microsoft Azure Active
 * Directory", and on macOS "if the instance is managed via MDM, joined to a
 * domain via MCX". Hard Mode is for a machine nobody manages, so in Edge the
 * file is offered to the copy from Edge Add-ons, and which store a copy came
 * from is the `update_url` that store wrote into the manifest it served, also
 * handed in by the caller.
 */

export type BuildTarget = 'chrome' | 'firefox' | 'safari';

/** A browser Weft writes a policy file for. */
export type PolicyBrowser = 'chrome' | 'edge';

export type Platform = 'macos' | 'windows' | 'linux';

/** Why there is no file: the browser obeys none Weft writes, or Edge would not hold this copy. */
export type NoFile = { browser: string; reason: 'browser' | 'store' };

/** A file the running browser obeys, or why there is none. */
export type HardModeHere = { file: PolicyBrowser } | ({ file: null } & NoFile);

/**
 * Where each browser's own store serves its updates, as the store writes it
 * into the manifest of every copy it serves: read off a CRX fetched from each
 * on 2026-11-07, and Edge Add-ons' is the one Microsoft's examples of a
 * force-installed extension name. The policy file names it as the place to
 * install from.
 */
export const STORE_UPDATE_URL: Record<PolicyBrowser, string> = {
  chrome: 'https://clients2.google.com/service/update2/crx',
  edge: 'https://edge.microsoft.com/extensionwebstorebase/v1/crx',
};

/**
 * The platforms each browser's file is written for. Microsoft lists
 * `ExtensionSettings` for Windows and macOS (and Android), and Microsoft Learn
 * has no page for an Edge policy directory on Linux, so Edge has no Linux
 * file: one written to a guessed directory would look like Hard Mode and hold
 * nothing.
 */
export const HARD_MODE_PLATFORMS: Record<PolicyBrowser, readonly Platform[]> = {
  chrome: ['macos', 'windows', 'linux'],
  edge: ['macos', 'windows'],
};

/** What the settings page says beside a browser's platforms where one has no file. */
export const MISSING_PLATFORMS: Record<PolicyBrowser, string | null> = {
  chrome: null,
  edge:
    'Microsoft lists Edge’s ExtensionSettings policy for Windows and macOS only, so there is no ' +
    'Linux file for Edge: one written to a guessed directory would look like Hard Mode and hold nothing.',
};

/** The entry every Chromium adds so that nobody parses the list strictly. */
const GREASE = /^Not.A.Brand$/i;

/**
 * Brands that are Google's Chrome or the Chromium it is built from. Chromium
 * on Linux reads `/etc/chromium/policies/managed/`, which the Linux file
 * names; the browser the e2e suite drives names itself Chromium or
 * HeadlessChrome; and Chrome for Testing is "Google Chrome for Testing".
 */
const CHROME_FAMILY = /^(Google Chrome|Chromium|HeadlessChrome)\b/;

const EDGE = /^Microsoft Edge$/;

/** Whether an update address is the given store's, read by its host. */
function fromStore(updateUrl: string, store: PolicyBrowser): boolean {
  try {
    return new URL(updateUrl).hostname === new URL(STORE_UPDATE_URL[store]).hostname;
  } catch {
    return false;
  }
}

/**
 * `updateUrl` is the running copy's manifest `update_url`, undefined for an
 * unpacked copy, which is a developer's: it is offered its browser's file, as
 * it always was in Chrome, so the file can be read before a store serves Weft.
 */
export function hardModeHere(
  target: BuildTarget,
  brands: readonly string[],
  updateUrl: string | undefined,
): HardModeHere {
  if (target === 'firefox') return { file: null, browser: 'Firefox', reason: 'browser' };
  if (target === 'safari') return { file: null, browser: 'Safari', reason: 'browser' };
  const named = brands.filter((brand) => !GREASE.test(brand) && !CHROME_FAMILY.test(brand));
  const other = named.find((brand) => !EDGE.test(brand));
  if (other) return { file: null, browser: other, reason: 'browser' };
  if (named.length === 0) return { file: 'chrome' };
  if (updateUrl === undefined || fromStore(updateUrl, 'edge')) return { file: 'edge' };
  return { file: null, browser: 'Microsoft Edge', reason: 'store' };
}

/** What the settings page says where there is no file. */
export function noPolicyHere({ browser, reason }: NoFile): string {
  if (reason === 'store') {
    return (
      'Hard Mode is a policy file Microsoft Edge obeys, which stops Weft being disabled or removed ' +
      'without an administrator password. On a machine no organisation manages, Edge holds it only ' +
      'for a copy installed from Edge Add-ons, and this copy of Weft was installed from somewhere ' +
      'else, so Weft offers no file here: one Edge would not hold would look like Hard Mode and ' +
      'hold nothing.'
    );
  }
  return (
    'Hard Mode is a policy file Google Chrome and Microsoft Edge obey, which stops Weft being ' +
    `disabled or removed without an administrator password. ${browser} reads no policy written ` +
    'for Chrome or Edge, so Weft offers no file here: one that nothing obeys would look like Hard ' +
    'Mode and hold nothing.'
  );
}
