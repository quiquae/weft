/**
 * Where Hard Mode has a file to offer.
 *
 * Hard Mode is a managed-policy file marking Weft force-installed, and a
 * policy holds only in the browser that reads it. Weft writes Google
 * Chrome's (`src/background/hard-mode.ts`). Until 2026-11-07 the settings
 * page offered it in every build and every browser, so Firefox was handed a
 * Chrome policy naming a Firefox add-on, Microsoft Edge, which runs the
 * Chrome package unchanged, was handed a file it never reads, and Safari one
 * nothing applies. A file nothing obeys is worse than no file: it looks like
 * Hard Mode and holds nothing, and the person who installed it finds out on
 * the day they try to remove Weft and can.
 *
 * The build is known at build time. Which Chromium browser runs the Chrome
 * package is not, so it is read from the brands the browser names itself by
 * (`navigator.userAgentData.brands`, which every Chromium Weft supports has),
 * handed in by the caller so that this stays a function of its arguments.
 */

export type BuildTarget = 'chrome' | 'firefox' | 'safari';

/** A file the running browser obeys, or the browser that obeys none Weft writes. */
export type HardModeHere = { file: 'chrome' } | { file: null; browser: string };

/** The entry every Chromium adds so that nobody parses the list strictly. */
const GREASE = /^Not.A.Brand$/i;

/**
 * Brands that are Google's Chrome or the Chromium it is built from. Chromium
 * on Linux reads `/etc/chromium/policies/managed/`, which the Linux file
 * names; the browser the e2e suite drives names itself Chromium or
 * HeadlessChrome; and Chrome for Testing is "Google Chrome for Testing".
 */
const CHROME_FAMILY = /^(Google Chrome|Chromium|HeadlessChrome)\b/;

export function hardModeHere(target: BuildTarget, brands: readonly string[]): HardModeHere {
  if (target === 'firefox') return { file: null, browser: 'Firefox' };
  if (target === 'safari') return { file: null, browser: 'Safari' };
  const other = brands.find((brand) => !GREASE.test(brand) && !CHROME_FAMILY.test(brand));
  return other ? { file: null, browser: other } : { file: 'chrome' };
}

/** What the settings page says in a browser that obeys no file Weft writes. */
export function noPolicyHere(browser: string): string {
  return (
    'Hard Mode is a policy file Google Chrome obeys, which stops Weft being disabled or removed ' +
    `without an administrator password. ${browser} reads no policy written for Chrome, so Weft ` +
    'offers no file here: one that nothing obeys would look like Hard Mode and hold nothing.'
  );
}
