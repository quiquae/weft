import { api, uaBrands } from '../shared/browser.ts';
import { hardModeHere, noPolicyHere } from '../core/hard-mode.ts';

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
 */

export interface PolicyProfile {
  filename: string;
  contents: string;
  instructions: string;
}

function extensionId(): string {
  return api.runtime.id;
}

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

export function macosProfile(): PolicyProfile {
  const id = extensionId();
  const uuid = `weft-${id.slice(0, 8)}`;

  const instructions = `Hard Mode for macOS

What this does
  Installs a Chrome managed-policy profile that marks Weft as force-installed.
  Chrome will then refuse to disable or remove the extension from
  chrome://extensions. The Remove button goes away.

To install
  1. Save the downloaded file as weft-hard-mode.mobileconfig, and open it.
  2. Open ${MACOS_PROFILES}.
  3. Double-click the profile under Downloaded, then click Install. Enter your
     administrator password.
  4. Quit Chrome completely (Cmd-Q) and reopen it.
  5. Check chrome://policy. You should see ExtensionSettings listed.

To remove it
  This is deliberately not hidden from you, and it is written into the file
  as well, so it is there when you come looking.
  1. Open ${MACOS_PROFILES}.
  2. Select "Weft — Hard Mode" and click Remove.
  3. Enter your administrator password.
  4. Restart Chrome. The extension becomes removable again.

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
    'Stops Weft being disabled or removed in Chrome without an administrator password. ' +
    `To take it off: open ${MACOS_PROFILES}, select Weft — Hard Mode, click Remove, ` +
    'enter your administrator password, then restart Chrome.';

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
      <string>com.google.Chrome</string>
      <key>PayloadIdentifier</key>
      <string>study.weft.hardmode.chrome</string>
      <key>PayloadUUID</key>
      <string>${uuid}-0001-0000-0000-000000000001</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadDisplayName</key>
      <string>Weft — Hard Mode (Chrome)</string>
      <key>ExtensionSettings</key>
      <dict>
        <key>${id}</key>
        <dict>
          <key>installation_mode</key>
          <string>force_installed</string>
          <key>update_url</key>
          <string>https://clients2.google.com/service/update2/crx</string>
          <key>toolbar_pin</key>
          <string>force_pinned</string>
        </dict>
      </dict>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>${xmlText(description)}</string>
  <key>PayloadDisplayName</key>
  <string>Weft — Hard Mode</string>
  <key>PayloadIdentifier</key>
  <string>study.weft.hardmode</string>
  <key>PayloadOrganization</key>
  <string>Installed by the user, for the user</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadScope</key>
  <string>System</string>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${uuid}-0001-0000-0000-000000000000</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>
`;

  return { filename: 'weft-hard-mode.mobileconfig', contents, instructions };
}

export function windowsProfile(): PolicyProfile {
  const id = extensionId();
  const key = `HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome\\ExtensionSettings\\${id}`;

  // ASCII only: regedit reads a version 5 file as UTF-16 or the ANSI code
  // page, never as the UTF-8 a Blob writes.
  const instructions = `Hard Mode for Windows

What this does
  Adds a Chrome policy marking Weft as force-installed. Chrome will then
  refuse to disable or remove it from chrome://extensions.

To install
  1. Save the downloaded file as weft-hard-mode.reg.
  2. Right-click it and choose Merge. Approve the administrator prompt.
  3. Close Chrome completely and reopen it.
  4. Check chrome://policy to confirm ExtensionSettings is listed.

To remove it
  Save these lines as weft-hard-mode-remove.reg and merge it, as
  administrator. Inside weft-hard-mode.reg they are comments: leave out the
  semicolons that start them.

    Windows Registry Editor Version 5.00

    [-${key}]

  Then restart Chrome. Or open regedit and delete the key by hand.

Extension id: ${id}
`;

  const contents = `Windows Registry Editor Version 5.00

${commented(instructions, ';')}

[${key}]
"installation_mode"="force_installed"
"update_url"="https://clients2.google.com/service/update2/crx"
"toolbar_pin"="force_pinned"
`;

  return { filename: 'weft-hard-mode.reg', contents, instructions };
}

export function linuxProfile(): PolicyProfile {
  const id = extensionId();
  const policy = JSON.stringify(
    {
      ExtensionSettings: {
        [id]: {
          installation_mode: 'force_installed',
          update_url: 'https://clients2.google.com/service/update2/crx',
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
 * The file for this platform, written only where the browser obeys it.
 *
 * The settings page offers it only there too (`hardModeHere()`); this refuses
 * on its own as well, so a page that one day offers the button in the wrong
 * place still hands nobody a file that looks like Hard Mode and holds nothing.
 * The build is read as the constant esbuild inlines rather than `ENGINE`, so
 * the tests can ask each build in one process.
 */
export function profileFor(
  platform: 'macos' | 'windows' | 'linux',
  brands: readonly string[] = uaBrands(),
): PolicyProfile {
  const here = hardModeHere(__WEFT_TARGET__, brands);
  if (here.file === null) throw new Error(noPolicyHere(here.browser));
  switch (platform) {
    case 'macos':
      return macosProfile();
    case 'windows':
      return windowsProfile();
    case 'linux':
      return linuxProfile();
  }
}
