import { api, uaBrands, updateUrl } from '../shared/browser.ts';
import {
  HARD_MODE_PLATFORMS,
  MISSING_PLATFORMS,
  STORE_UPDATE_URL,
  hardModeHere,
  noPolicyHere,
  type Platform,
  type PolicyBrowser,
} from '../core/hard-mode.ts';

/**
 * Hard Mode: OS-level enforcement.
 *
 * Everything else in Weft is friction the user could remove by opening
 * chrome://extensions and clicking Remove. That is an honest limit of a
 * browser extension and no amount of client-side cleverness changes it, so
 * rather than pretend otherwise, Weft generates the one mechanism that does
 * work: a managed-policy profile marking the extension `force_installed`,
 * which Chrome refuses to let a non-administrator disable or uninstall.
 *
 * Three things make this defensible rather than malware behaviour:
 *
 *  - The user installs it themselves, deliberately, on their own machine,
 *    with an administrator password they type.
 *  - The removal procedure is written into the file itself, as comments its
 *    reader skips, and documented in docs/HARD-MODE.md. Nothing is hidden.
 *    The page that generates it is closed the moment the file is saved; the
 *    file is what somebody finds again on the day they want out.
 *  - Weft does not touch the default search engine or the new tab page, which
 *    is the specific abuse Chrome began blocking for policy-installed
 *    extensions on unmanaged devices in 2026. A policy that only pins this
 *    extension is unaffected by that change.
 *
 * Microsoft Edge runs the Chrome package and reads a policy of its own, so it
 * has a file of its own: the same `ExtensionSettings`, under Edge's domain
 * and registry key, naming Edge Add-ons' update address. Edge force-installs
 * an extension from anywhere else only on a machine an organisation manages
 * (`src/core/hard-mode.ts`), so the file is for the Edge Add-ons copy.
 */

export interface PolicyProfile {
  filename: string;
  contents: string;
  instructions: string;
}

function extensionId(): string {
  return api.runtime.id;
}

/**
 * What a browser's file says and where it puts it. Chrome's reproduces, byte
 * for byte, the file Weft wrote before Edge had one of its own.
 *
 * Edge's facts are Microsoft's, read 2026-11-07: the macOS preference domain
 * `com.microsoft.Edge` ("Configure Microsoft Edge policy settings for macOS
 * using a property list"), the key `SOFTWARE\Policies\Microsoft\Edge`, and
 * `toolbar_state`, which the ExtensionSettings guide gives from Edge 103,
 * where Chrome's is `toolbar_pin`. Microsoft documents ExtensionSettings on
 * Windows only as a string of JSON; Chromium's registry reader, which Edge
 * builds on, reads a dictionary policy from its subkeys too
 * (`RegistryDict::ConvertToJSON`), which is the form Chrome's file writes, and
 * the one whose removal deletes Weft's key alone.
 */
interface Browser {
  store: PolicyBrowser;
  /** As its steps name it, and with the article a sentence gives it. */
  name: string;
  a: string;
  /** How a heading names the browser, where the file is not Chrome's. */
  heading: string;
  /** The scheme of its own pages: chrome://policy, edge://policy. */
  scheme: string;
  /** Its macOS preference domain, which the profile's payload sets. */
  domain: string;
  /** Its policy key under HKEY_LOCAL_MACHINE. */
  registry: string;
  /** The setting that keeps Weft's icon on the toolbar, in this browser's words. */
  toolbar: readonly [string, string];
  /** What its files are saved as, before the extension. */
  stem: string;
  /**
   * The profile as System Settings lists it, and the identifiers that keep
   * Chrome's and Edge's apart, since installing a profile replaces any other
   * with its identifier.
   */
  profile: { name: string; id: string; payloadName: string; payloadId: string; uuid: string };
}

const BROWSERS: Record<PolicyBrowser, Browser> = {
  chrome: {
    store: 'chrome',
    name: 'Chrome',
    a: 'a Chrome',
    heading: '',
    scheme: 'chrome',
    domain: 'com.google.Chrome',
    registry: 'SOFTWARE\\Policies\\Google\\Chrome',
    toolbar: ['toolbar_pin', 'force_pinned'],
    stem: 'weft-hard-mode',
    profile: {
      name: 'Weft — Hard Mode',
      id: 'study.weft.hardmode',
      payloadName: 'Weft — Hard Mode (Chrome)',
      payloadId: 'study.weft.hardmode.chrome',
      uuid: '0001',
    },
  },
  edge: {
    store: 'edge',
    name: 'Edge',
    a: 'an Edge',
    heading: ', in Microsoft Edge',
    scheme: 'edge',
    domain: 'com.microsoft.Edge',
    registry: 'SOFTWARE\\Policies\\Microsoft\\Edge',
    toolbar: ['toolbar_state', 'force_shown'],
    stem: 'weft-hard-mode-edge',
    profile: {
      name: 'Weft — Hard Mode (Edge)',
      id: 'study.weft.hardmode.edge',
      payloadName: 'Weft — Hard Mode (Edge)',
      payloadId: 'study.weft.hardmode.edge.policy',
      uuid: '0002',
    },
  },
};

/** A text as comment lines, each behind the marker its format skips. */
function commented(text: string, marker: string): string {
  return text
    .replace(/\n$/, '')
    .split('\n')
    .map((line) => (line ? `${marker} ${line}` : marker))
    .join('\n');
}

/** A text as a plist `<string>` holds it. */
function xmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Where macOS keeps an installed profile. Apple's guide, read 2026-11-06 at
 * its macOS 27 version, says "General > Device Management"; macOS before that
 * move kept profiles in Privacy & Security, which is all these steps named
 * until then. Both are given, because the file outlives any one version.
 */
const MACOS_PROFILES =
  'System Settings > General > Device Management (Privacy & Security > Profiles on older macOS)';

export function macosProfile(b: Browser = BROWSERS.chrome): PolicyProfile {
  const id = extensionId();
  const uuid = `weft-${id.slice(0, 8)}-${b.profile.uuid}`;

  const instructions = `Hard Mode for macOS${b.heading}

What this does
  Installs ${b.a} managed-policy profile that marks Weft as force-installed.
  ${b.name} will then refuse to disable or remove the extension from
  ${b.scheme}://extensions. The Remove button goes away.

To install
  1. Save the downloaded file as ${b.stem}.mobileconfig, and open it.
  2. Open ${MACOS_PROFILES}.
  3. Double-click the profile under Downloaded, then click Install. Enter your
     administrator password.
  4. Quit ${b.name} completely (Cmd-Q) and reopen it.
  5. Check ${b.scheme}://policy. You should see ExtensionSettings listed.

To remove it
  This is deliberately not hidden from you, and it is written into the file
  as well, so it is there when you come looking.
  1. Open ${MACOS_PROFILES}.
  2. Select "${b.profile.name}" and click Remove.
  3. Enter your administrator password.
  4. Restart ${b.name}. The extension becomes removable again.

  Note that PayloadRemovalDisallowed is set to false in this profile, which
  means you can always take it off with your own admin password. Weft will not
  ship a profile you cannot remove.

What it does not do
  It does not change your search engine, your homepage or your new tab page,
  it does not install anything else, and it does not send anything anywhere.
  You can read the whole file: it names one extension id.

Extension id: ${id}
`;

  // System Settings shows a profile's description and never the file, so the
  // way out is said again there, where somebody stands when they want it.
  const description =
    `Stops Weft being disabled or removed in ${b.name} without an administrator password. ` +
    `To take it off: open ${MACOS_PROFILES}, select ${b.profile.name}, click Remove, ` +
    `enter your administrator password, then restart ${b.name}.`;

  const contents = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!--
${instructions.replace(/\n$/, '').replace(/^(?=.)/gm, '  ')}
-->
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key>
      <string>${b.domain}</string>
      <key>PayloadIdentifier</key>
      <string>${b.profile.payloadId}</string>
      <key>PayloadUUID</key>
      <string>${uuid}-0000-0000-000000000001</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadDisplayName</key>
      <string>${b.profile.payloadName}</string>
      <key>ExtensionSettings</key>
      <dict>
        <key>${id}</key>
        <dict>
          <key>installation_mode</key>
          <string>force_installed</string>
          <key>update_url</key>
          <string>${STORE_UPDATE_URL[b.store]}</string>
          <key>${b.toolbar[0]}</key>
          <string>${b.toolbar[1]}</string>
        </dict>
      </dict>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>${xmlText(description)}</string>
  <key>PayloadDisplayName</key>
  <string>${b.profile.name}</string>
  <key>PayloadIdentifier</key>
  <string>${b.profile.id}</string>
  <key>PayloadOrganization</key>
  <string>Installed by the user, for the user</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadScope</key>
  <string>System</string>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${uuid}-0000-0000-000000000000</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>
`;

  return { filename: `${b.stem}.mobileconfig`, contents, instructions };
}

export function windowsProfile(b: Browser = BROWSERS.chrome): PolicyProfile {
  const id = extensionId();
  const key = `HKEY_LOCAL_MACHINE\\${b.registry}\\ExtensionSettings\\${id}`;

  // ASCII only: regedit reads a version 5 file as UTF-16 or the ANSI code
  // page, never as the UTF-8 a Blob writes.
  const instructions = `Hard Mode for Windows${b.heading}

What this does
  Adds ${b.a} policy marking Weft as force-installed. ${b.name} will then
  refuse to disable or remove it from ${b.scheme}://extensions.

To install
  1. Save the downloaded file as ${b.stem}.reg.
  2. Right-click it and choose Merge. Approve the administrator prompt.
  3. Close ${b.name} completely and reopen it.
  4. Check ${b.scheme}://policy to confirm ExtensionSettings is listed.

To remove it
  Save these lines as ${b.stem}-remove.reg and merge it, as
  administrator. Inside ${b.stem}.reg they are comments: leave out the
  semicolons that start them.

    Windows Registry Editor Version 5.00

    [-${key}]

  Then restart ${b.name}. Or open regedit and delete the key by hand.

Extension id: ${id}
`;

  const contents = `Windows Registry Editor Version 5.00

${commented(instructions, ';')}

[${key}]
"installation_mode"="force_installed"
"update_url"="${STORE_UPDATE_URL[b.store]}"
"${b.toolbar[0]}"="${b.toolbar[1]}"
`;

  return { filename: `${b.stem}.reg`, contents, instructions };
}

/** Chrome's alone: Edge has no Linux file (`HARD_MODE_PLATFORMS`). */
export function linuxProfile(): PolicyProfile {
  const id = extensionId();
  const policy = JSON.stringify(
    {
      ExtensionSettings: {
        [id]: {
          installation_mode: 'force_installed',
          update_url: STORE_UPDATE_URL.chrome,
          toolbar_pin: 'force_pinned',
        },
      },
    },
    null,
    2,
  );

  const instructions = `Hard Mode for Linux

What this does
  Installs a Chrome managed policy marking Weft as force-installed, so Chrome
  will not allow it to be disabled or removed.

To install
  1. Save the downloaded file as weft-hard-mode.json.
  2. Copy it into Chrome's managed-policy directory:

       sudo mkdir -p /etc/opt/chrome/policies/managed
       sudo cp weft-hard-mode.json /etc/opt/chrome/policies/managed/

     For Chromium, use /etc/chromium/policies/managed/ instead.
  3. Restart Chrome and check chrome://policy.

To remove it
  This is written into the file as well, so it is there when you come looking.

       sudo rm /etc/opt/chrome/policies/managed/weft-hard-mode.json

  or, for Chromium,

       sudo rm /etc/chromium/policies/managed/weft-hard-mode.json

  Then restart the browser.

Extension id: ${id}
`;

  // Chrome reads a managed-policy file with JSON_PARSE_CHROMIUM_EXTENSIONS,
  // which allows comments (components/policy/core/common/
  // config_dir_policy_loader.cc, the same at Chrome 116, Weft's floor), so
  // the way out can travel in the file it undoes.
  const contents = `${commented(instructions, '//')}
${policy}
`;

  return { filename: 'weft-hard-mode.json', contents, instructions };
}

/**
 * The file for this platform, in the policy of the browser running Weft,
 * written only where that browser obeys it.
 *
 * The settings page offers it only there too (`hardModeHere()`); this refuses
 * on its own as well, so a page that one day offers the button in the wrong
 * place still hands nobody a file that looks like Hard Mode and holds nothing.
 * The build is read as the constant esbuild inlines rather than `ENGINE`, so
 * the tests can ask each build in one process, and the brands and the store
 * this copy came from are the worker's own unless a test names them.
 */
export function profileFor(
  platform: Platform,
  brands: readonly string[] = uaBrands(),
  update: string | undefined = updateUrl(),
): PolicyProfile {
  const here = hardModeHere(__WEFT_TARGET__, brands, update);
  if (here.file === null) throw new Error(noPolicyHere(here));
  if (!HARD_MODE_PLATFORMS[here.file].includes(platform)) {
    throw new Error(MISSING_PLATFORMS[here.file] ?? `Weft writes no ${platform} file for ${here.file}.`);
  }
  switch (platform) {
    case 'macos':
      return macosProfile(BROWSERS[here.file]);
    case 'windows':
      return windowsProfile(BROWSERS[here.file]);
    case 'linux':
      return linuxProfile();
  }
}
