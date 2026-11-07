# Hard Mode

Everything else in Weft is friction you could walk past by opening
`chrome://extensions` and clicking Remove. That is an honest limit of a
browser extension, and no amount of client-side cleverness changes it.

Rather than pretend otherwise, Weft generates the one mechanism that does
work: a browser **managed-policy profile** that marks the extension
`force_installed`. The browser then refuses to let a non-administrator
disable or uninstall it. The Remove button goes away.

## Read this before you install it

Hard Mode is genuinely hard to undo without the administrator password for the
machine. **That is the point.** It is a bad idea on a computer you do not
control, and a bad idea if you are not certain you want it.

Three things make it defensible rather than malware behaviour:

1. **You install it yourself**, deliberately, on your own machine, with an
   administrator password you type.
2. **The removal procedure ships inside the generated file**, in plain words,
   alongside the instructions for installing it, as comments the file's own
   reader skips — and on macOS in the profile's description too, which
   Apple's profile reference says is "shown on the Detail screen for the
   profile". Nothing is hidden. The page that generates the file is closed
   the moment you save it; the file is what you find again, months later, on
   the day you want out.
3. **Weft touches neither the default search engine nor the new tab page**,
   which is the specific abuse Chrome began blocking for policy-installed
   extensions on unmanaged devices in 2026. A policy that pins only this
   extension is unaffected by that change.

On macOS the generated profile sets `PayloadRemovalDisallowed` to `false`,
which means you can always take it off with your own admin password. Weft will
not ship a profile you cannot remove.

## Which browsers

The file is the running browser's own managed policy, and Weft writes two:
Google Chrome's, which holds in Google Chrome and in Chromium on Linux, which
reads the directory the Linux steps name; and Microsoft Edge's, which holds
in Edge for the copy of Weft from Edge Add-ons. Everywhere else Weft offers
no file, and the settings page says so on either tier: a file nothing obeys
would look like Hard Mode and hold nothing, and you would find out on the
day you tried to remove Weft and could. The worker that writes the file
refuses there as well.

- **Microsoft Edge** runs the same package as Chrome and reads its own
  policy, under `com.microsoft.Edge` and `HKLM\SOFTWARE\Policies\Microsoft\Edge`,
  never Chrome's, so it has a file of its own ([below](#microsoft-edge)).
  Microsoft's page for `ExtensionSettings`, read on 2026-11-07, says Edge
  force-installs an extension from outside Edge Add-ons only on a machine
  joined to a domain or managed by MDM, so on a machine nobody manages the
  file holds for Weft's Edge Add-ons copy alone. Each store writes its own
  update address into the copy it serves, which is how Weft tells them
  apart, and a copy from the Chrome Web Store running in Edge is told why it
  has no file. Microsoft lists the policy for Windows and macOS only, so
  there is no Linux file for Edge.
- **Firefox** has policies of its own, in `policies.json`, and they
  force-install an add-on from an `install_url`, which for Weft would be its
  addons.mozilla.org listing.
- **Safari** reads no Chrome policy, and Weft writes none of Safari's.

Which Chromium browser is running is read from the brands it names itself by
(`navigator.userAgentData`), because Edge runs the Chrome package unchanged
and only the browser can tell the two apart.

## Generating it

Settings → Commitment → Hard Mode. Pick your platform, click Generate, read
the file — it is short, these instructions are written into it, and it names
exactly one extension id — then download and install it.

## macOS

```
1. Save the file as weft-hard-mode.mobileconfig, and open it.
2. Open System Settings > General > Device Management
   (Privacy & Security > Profiles on older macOS).
3. Double-click the profile under Downloaded, then click Install.
   Enter your administrator password.
4. Quit Chrome completely (Cmd-Q) and reopen it.
5. Check chrome://policy — ExtensionSettings should be listed.
```

To remove: System Settings → General → Device Management (Privacy & Security
→ Profiles on older macOS), select "Weft — Hard Mode", click Remove, enter
your administrator password, restart Chrome. The path is
[Apple's](https://support.apple.com/guide/mac-help/configuration-profiles-standardize-settings-mh35561/mac),
read on 2026-11-06 at its macOS 27 version; until then this page named
Privacy & Security alone, which macOS has since moved.

## Windows

```
1. Save the file as weft-hard-mode.reg
2. Right-click it and choose Merge. Approve the administrator prompt.
3. Close Chrome completely and reopen it.
4. Check chrome://policy.
```

To remove, merge this as administrator:

```
Windows Registry Editor Version 5.00

[-HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome\ExtensionSettings\<id>]
```

Or delete the key by hand in `regedit`. Then restart Chrome. The same lines
are in the file you downloaded, as comments: leave out the semicolons.

## Linux

```
sudo mkdir -p /etc/opt/chrome/policies/managed
sudo cp weft-hard-mode.json /etc/opt/chrome/policies/managed/
```

For Chromium, use `/etc/chromium/policies/managed/` instead. Restart Chrome
and check `chrome://policy`.

To remove: `sudo rm /etc/opt/chrome/policies/managed/weft-hard-mode.json`,
or `sudo rm /etc/chromium/policies/managed/weft-hard-mode.json` for Chromium.
Both are written into the file as `//` comments, which Chrome reads past: it
parses a managed-policy file with comments allowed, and has since before
Chrome 116.

## Microsoft Edge

Edge's file is named `weft-hard-mode-edge`, so it can sit beside Chrome's,
and its macOS profile carries an identifier of its own, so installing one
never replaces the other. Its steps are Chrome's, in Edge's pages:

```
macOS
1. Save the file as weft-hard-mode-edge.mobileconfig, and open it.
2. Open System Settings > General > Device Management
   (Privacy & Security > Profiles on older macOS).
3. Double-click the profile under Downloaded, then click Install.
   Enter your administrator password.
4. Quit Edge completely (Cmd-Q) and reopen it.
5. Check edge://policy — ExtensionSettings should be listed.

Windows
1. Save the file as weft-hard-mode-edge.reg
2. Right-click it and choose Merge. Approve the administrator prompt.
3. Close Edge completely and reopen it.
4. Check edge://policy.
```

To remove on macOS, select "Weft — Hard Mode (Edge)" in the same pane, click
Remove, enter your administrator password and restart Edge. On Windows,
merge this as administrator, then restart Edge:

```
Windows Registry Editor Version 5.00

[-HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Edge\ExtensionSettings\<id>]
```

Both ways out are in the file, as they are in Chrome's. The policy is the
same `ExtensionSettings`, naming Edge Add-ons' update address and keeping
the icon on the toolbar with Edge's own `toolbar_state`, where Chrome's is
`toolbar_pin`. Microsoft documents it on Windows as one string value holding
JSON; the file writes the extension's own subkey instead, as Chrome's does,
which Chromium's registry reader, the one Edge builds on, reads as the same
policy, and removing it then deletes Weft's key and no other extension's
settings. No record yet shows either browser's file installed on a real
machine.

## What it does not do

It does not change your search engine, your homepage or your new tab page. It
does not install anything else. It does not send anything anywhere. It does
not prevent you from using a different browser — if you want that, you want a
different class of tool than a browser extension.

It also does not change what Weft does to your pages. Density, cooldowns and
panic passes are all still your settings. Hard Mode only stops you from
removing the extension to escape them.

## The system clock, which is the honest weak point

A cooldown is a stored timestamp compared against `Date.now()`. So winding
your system clock forward ends the wait on every change you have queued,
immediately — though a vocabulary check, if you turned one on, still has to
be passed. Weft does not prevent this, and this section exists because you
should hear it here rather than work it out yourself.

**Why it is not fixed.** Telling "the clock says next week" apart from "the
browser was closed for a week" needs a time source you cannot edit — which
means asking a server what time it is. Weft has no server to ask, and asks
none of its own: with lookups off it makes no network request at all, which
`tests/e2e/privacy.spec.ts` asserts, and with them on it talks only to the
translation service you gave it a key for. Trading that for a screen-time
tool that can be beaten by holding down the power button is a bad trade.

The other candidate fix is worse. Weft could require the wait to elapse in
*observed* time — counting alarm ticks rather than comparing timestamps — but
that would break a property it deliberately promises: that closing the
browser neither cancels a wait nor restarts it. A cooldown you can pause by
quitting the browser is not a cooldown.

**What is detected.** Defeating a cooldown this way takes two moves, not
one: forward to unlock, then back to the real time, because leaving a machine
a week in the future breaks mail, calendars and certificates. Time does not
run backwards on its own, so the second move is unambiguous. Weft notices it,
counts it with the other tampering events, and applies whatever response you
chose for tampering — including `ignore`, which exists because a genuinely
wrong clock being corrected looks identical.

So the bypass is not blocked. It is made to cost something: either a
permanently wrong clock, or an entry in a log you asked to be kept.

**If you want to actually be stopped**, that is what the policy file is for.
It is administrator-enforced, and someone who is not you holds the password.
An extension cannot be more committed than the person who installed it.

## The switch in settings

The Hard Mode switch in settings records your *intent*. Enforcement comes
entirely from the policy file. The two are separate because the extension
cannot install a system policy for you, and should not be able to.
