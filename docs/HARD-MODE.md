# Hard Mode

Everything else in Weft is friction you could walk past by opening
`chrome://extensions` and clicking Remove. That is an honest limit of a
browser extension, and no amount of client-side cleverness changes it.

Rather than pretend otherwise, Weft generates the one mechanism that does
work: a browser **managed-policy profile** that marks the extension
`force_installed`. Chrome then refuses to let a non-administrator disable or
uninstall it. The Remove button goes away.

## Read this before you install it

Hard Mode is genuinely hard to undo without the administrator password for the
machine. **That is the point.** It is a bad idea on a computer you do not
control, and a bad idea if you are not certain you want it.

Three things make it defensible rather than malware behaviour:

1. **You install it yourself**, deliberately, on your own machine, with an
   administrator password you type.
2. **The removal procedure ships inside the generated file**, in plain words,
   alongside the instructions for installing it. Nothing is hidden.
3. **Weft touches neither the default search engine nor the new tab page**,
   which is the specific abuse Chrome began blocking for policy-installed
   extensions on unmanaged devices in 2026. A policy that pins only this
   extension is unaffected by that change.

On macOS the generated profile sets `PayloadRemovalDisallowed` to `false`,
which means you can always take it off with your own admin password. Weft will
not ship a profile you cannot remove.

## Generating it

Settings → Commitment → Hard Mode. Pick your platform, click Generate, read
the file — it is about forty lines and it names exactly one extension id —
then download and install it.

## macOS

```
1. Save the file as weft-hard-mode.mobileconfig
2. Double-click it. System Settings opens to Privacy & Security > Profiles.
3. Click the profile, then Install. Enter your administrator password.
4. Quit Chrome completely (Cmd-Q) and reopen it.
5. Check chrome://policy — ExtensionSettings should be listed.
```

To remove: System Settings → Privacy & Security → Profiles, select "Weft —
Hard Mode", click the minus button, enter your administrator password, restart
Chrome.

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

Or delete the key by hand in `regedit`. Then restart Chrome.

## Linux

```
sudo mkdir -p /etc/opt/chrome/policies/managed
sudo cp weft-hard-mode.json /etc/opt/chrome/policies/managed/
```

For Chromium, use `/etc/chromium/policies/managed/` instead. Restart Chrome
and check `chrome://policy`.

To remove: `sudo rm /etc/opt/chrome/policies/managed/weft-hard-mode.json`.

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
your system clock forward clears any change you have queued, immediately.
Weft does not prevent this, and this section exists because you should hear
it here rather than work it out yourself.

**Why it is not fixed.** Telling "the clock says next week" apart from "the
browser was closed for a week" needs a time source you cannot edit — which
means asking a server what time it is. Weft makes no network requests, at
all, and there is a test asserting it; trading that for a screen-time tool
that can be beaten by holding down the power button is a bad trade.

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
