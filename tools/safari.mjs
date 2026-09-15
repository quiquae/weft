#!/usr/bin/env node
/**
 * Turn the Safari build into an Xcode project, then an app.
 *
 * Safari is the odd one out. Chrome, Edge and Firefox take a zip; Safari
 * requires the extension to be wrapped in a native app, built by Xcode, and
 * shipped through App Store Connect. `xcrun safari-web-extension-converter`
 * does the wrapping.
 *
 * Two things this script does that a copied-and-pasted command does not:
 *
 * **It verifies every flag against the local --help before using it.** The
 * converter ships with Xcode, so its options differ between Xcode versions,
 * and an unrecognised flag makes it fail with a usage dump rather than doing
 * the obvious thing. Rather than hardcode a flag list from a blog post, the
 * script reads the help text on the machine it is running on and drops any
 * flag that version does not advertise.
 *
 * **It refuses to convert a stale build.** The converter copies the contents
 * of the directory it is given, so pointing it at a dist/ from last week
 * silently ships last week's code. It rebuilds first, every time.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION, MINIMUMS } from '../manifest.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXT = join(ROOT, 'dist/safari');
const PROJECT = join(ROOT, 'dist/safari-xcode');

/** Reverse-DNS identifier for the wrapper app. Change with the domain. */
const BUNDLE_ID = process.env.WEFT_BUNDLE_ID ?? 'study.weft.Weft';
const APP_NAME = 'Weft';

const args = process.argv.slice(2);
const has = (f) => args.includes(`--${f}`);

function run(cmd, argv, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { stdio: 'inherit', cwd: ROOT, ...opts });
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

/* ------------------------------------------------------- prerequisites */

/**
 * The converter lives inside Xcode.app, not the Command Line Tools.
 *
 * Checked explicitly because the failure otherwise reads "unable to find
 * utility", which sounds like a broken install rather than a missing 7 GB
 * download.
 */
function checkXcode() {
  const dev = spawnSync('xcode-select', ['-p'], { encoding: 'utf8' });
  const path = (dev.stdout ?? '').trim();

  if (!path || path.includes('CommandLineTools')) {
    console.error(`
Safari conversion needs the full Xcode, not the Command Line Tools.

  currently selected: ${path || '(none)'}

  1. Install Xcode from the Mac App Store (free, ~7 GB):
       mas install 497799835
     or download it from https://developer.apple.com/xcode/

  2. Point the toolchain at it:
       sudo xcode-select -s /Applications/Xcode.app/Contents/Developer

  3. Accept the licence once:
       sudo xcodebuild -license accept

  4. Re-run:
       npm run safari

Everything else in this repository builds and tests without Xcode — only
the Safari wrapper needs it.
`);
    process.exit(1);
  }

  const conv = spawnSync('xcrun', ['--find', 'safari-web-extension-converter'], { encoding: 'utf8' });
  if (conv.status !== 0) {
    console.error(
      `Xcode is selected at ${path} but safari-web-extension-converter is not in it.\n` +
        'Open Xcode once so it can finish installing its components, then re-run.',
    );
    process.exit(1);
  }
  return path;
}

/**
 * Keep only the flags this Xcode's converter actually advertises.
 *
 * The converter rejects the whole invocation on an unknown option, so one
 * flag that was renamed between Xcode versions would break the script with a
 * usage dump. Reading --help first turns that into a printed notice.
 */
function filterFlags(desired) {
  const help = spawnSync('xcrun', ['safari-web-extension-converter', '--help'], { encoding: 'utf8' });
  const text = `${help.stdout ?? ''}${help.stderr ?? ''}`;

  // If --help itself is unavailable, pass everything through rather than
  // silently dropping flags: a loud failure beats a quiet wrong conversion.
  if (!text.trim()) {
    console.warn('  (could not read converter --help; passing all flags through)');
    return desired;
  }

  const kept = [];
  const dropped = [];
  for (const [flag, value] of desired) {
    if (text.includes(flag)) {
      kept.push(flag);
      if (value !== undefined) kept.push(value);
    } else {
      dropped.push(flag);
    }
  }
  if (dropped.length) {
    console.warn(`  this Xcode's converter does not advertise: ${dropped.join(', ')} — skipped`);
  }
  return kept;
}

/* ---------------------------------------------------------------- main */

const dev = checkXcode();
console.log(`Xcode: ${dev}`);

console.log('\nrebuilding dist/safari so the conversion cannot pick up stale code…');
await run('node', ['build.mjs', '--target=safari']);
await run('node', ['tools/validate-package.mjs']);

if (!existsSync(join(EXT, 'manifest.json'))) {
  console.error(`no manifest at ${EXT} — the build did not produce one`);
  process.exit(1);
}

const desired = [
  ['--project-location', PROJECT],
  ['--app-name', APP_NAME],
  ['--bundle-identifier', BUNDLE_ID],
  ['--swift', undefined],
  ['--no-open', undefined],
  ['--force', undefined],
];
// The iOS target roughly doubles conversion and build time. Skipping it is
// the right default while iterating; ship both for the App Store.
if (has('macos-only')) desired.push(['--macos-only', undefined]);

const flags = filterFlags(desired);

console.log(`\nconverting ${EXT} → ${PROJECT}`);
console.log(`  bundle id: ${BUNDLE_ID}   version: ${VERSION}   min Safari: ${MINIMUMS.safari}\n`);
await run('xcrun', ['safari-web-extension-converter', EXT, ...flags]);

console.log(`
converted. Next steps, in order:

  1. Open the project:
       open ${PROJECT}/${APP_NAME}/${APP_NAME}.xcodeproj

  2. Set the signing team on BOTH targets — the app and the extension.
     They are separate targets and Xcode only nags about the first one.

  3. Set the deployment target to macOS 13 / Safari ${MINIMUMS.safari}. The converter
     defaults to the SDK it shipped with, which will exclude users the
     extension supports perfectly well.

  4. Build and run (Cmd-R). The app window is a stub whose only job is to
     open Safari Settings; that is normal and Apple expects it.

  5. In Safari: Settings → Advanced → "Show features for web developers",
     then Develop → Allow Unsigned Extensions, then enable Weft in
     Settings → Extensions.

  6. Grant a site: Weft asks per-origin. In Safari the toolbar button also
     has its own "Always Allow on This Website" — both are needed, which
     surprises people, so it is on the install page.

Then verify by hand, because no test covers this path:

  - Safari 16.4-17.1 must run the WRAPPED renderer. The CSS Custom
    Highlight API only arrives in 17.2, so if the highlight path is taken
    there the words will not be styled at all.
  - Clear a lock and confirm the TOOLBAR BADGE changes. Safari has no
    notifications API, so the badge is the only feedback.
  - Keyboard shortcuts do nothing below Safari 26. That is expected; every
    command is also reachable from the popup.

To distribute you need an Apple Developer Program membership (99 USD/year).
Notarisation for direct distribution, or App Store Connect for the store.
`);
