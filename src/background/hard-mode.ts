import { api } from '../shared/browser.ts';

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
 *  - The removal procedure is generated alongside it, in the same file, and
 *    documented in docs/HARD-MODE.md. Nothing is hidden.
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

export function macosProfile(): PolicyProfile {
  const id = extensionId();
  const uuid = `weft-${id.slice(0, 8)}`;
  const contents = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
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

  const instructions = `Hard Mode for macOS

What this does
  Installs a Chrome managed-policy profile that marks Weft as force-installed.
  Chrome will then refuse to disable or remove the extension from
  chrome://extensions. The Remove button goes away.

To install
  1. Save the downloaded file as weft-hard-mode.mobileconfig.
  2. Double-click it. System Settings opens to Privacy & Security > Profiles.
  3. Click the profile, then Install. Enter your administrator password.
  4. Quit Chrome completely (Cmd-Q) and reopen it.
  5. Check chrome://policy — you should see ExtensionSettings listed.

To remove it
  This is deliberately not hidden from you.
  1. Open System Settings > Privacy & Security > Profiles.
  2. Select "Weft — Hard Mode" and click the minus button.
  3. Enter your administrator password.
  4. Restart Chrome. The extension becomes removable again.

  Note that PayloadRemovalDisallowed is set to false in this profile, which
  means you can always take it off with your own admin password. Weft will not
  ship a profile you cannot remove.

What it does not do
  It does not change your search engine, your homepage or your new tab page,
  it does not install anything else, and it does not send anything anywhere.
  You can read the whole file: it is 40 lines of XML naming one extension id.

Extension id: ${id}
`;

  return { filename: 'weft-hard-mode.mobileconfig', contents, instructions };
}

export function windowsProfile(): PolicyProfile {
  const id = extensionId();
  const contents = `Windows Registry Editor Version 5.00

; Weft - Hard Mode
; Marks the Weft extension as force-installed so Chrome will not allow it to
; be disabled or removed without administrator rights.
;
; To undo: run weft-hard-mode-remove.reg, or delete the key below with regedit.

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome\\ExtensionSettings\\${id}]
"installation_mode"="force_installed"
"update_url"="https://clients2.google.com/service/update2/crx"
"toolbar_pin"="force_pinned"
`;

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
  Save this as weft-hard-mode-remove.reg and merge it, as administrator:

    Windows Registry Editor Version 5.00

    [-HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome\\ExtensionSettings\\${id}]

  Then restart Chrome. Or open regedit and delete the key by hand.

Extension id: ${id}
`;

  return { filename: 'weft-hard-mode.reg', contents, instructions };
}

export function linuxProfile(): PolicyProfile {
  const id = extensionId();
  const contents = `${JSON.stringify(
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
  )}
`;

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
       sudo rm /etc/opt/chrome/policies/managed/weft-hard-mode.json

  Then restart Chrome.

Extension id: ${id}
`;

  return { filename: 'weft-hard-mode.json', contents, instructions };
}

export function profileFor(platform: 'macos' | 'windows' | 'linux'): PolicyProfile {
  switch (platform) {
    case 'macos':
      return macosProfile();
    case 'windows':
      return windowsProfile();
    case 'linux':
      return linuxProfile();
  }
}
