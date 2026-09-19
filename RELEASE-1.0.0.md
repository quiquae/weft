# Weft 1.0.0

## Install

Take the file ending **`-folder.zip`**. The plain `.zip` is the one the
stores want: it has no folder inside and will empty itself into your Downloads.

**Chrome, Edge, Brave** — download `weft-chrome-1.0.0-folder.zip`, unzip it,
open `chrome://extensions`, turn on Developer mode, then **Load unpacked** and
pick the `weft-chrome-1.0.0` folder itself, not the `manifest.json` inside it.

**Firefox** — download `weft-firefox-1.0.0-folder.zip`, unzip it, open
`about:debugging` → This Firefox → **Load Temporary Add-on**, and pick the
`manifest.json` inside the folder. Firefox unloads temporary add-ons when it
closes, so this is for trying Weft rather than living with it.

**Safari** — needs the extension wrapped in a signed app, which needs Xcode.
See `docs/SUBMIT.md`.

Weft opens its first-run page and asks three questions. It has access to no
website until you answer the third one.

## Packages

- weft-chrome-1.0.0.zip — 211 KB
- weft-firefox-1.0.0.zip — 211 KB

## Changes since the beginning

e91c228 Release notes told Firefox users to pick the zip
32cc7be The release workflow looked for notes under a filename nothing writes
dda741e "Part of Pro" was rendering as a narrow column on every locked row
96f2772 Unzipping the download emptied nineteen files into Downloads
d237501 The progress page met new users with a wall of zeros
c36ca63 The popup could not turn on the site you were looking at
e60437f Two accessibility settings that did nothing, and a test of mine that did nothing either
30f77a2 The never-send list could not match half of what it listed
142995c Import could reset a word you had learned
6156052 What actually leaves the machine when you bring your own API key
d6dacc4 The privacy test watched one page; the claim covers the whole browser
6156dd6 The system clock defeats a cooldown, and that is now written down
1d2b73b The badge I added for Safari never came off again
34687ec CI was red for two reasons, and one of them was the fixture, not the tests
e525849 Build the site on every push; deploy it only when asked
5c32642 The licence tests needed a secret CI will never have
144cb30 Store-ready: exact-size assets, a runbook, and a gate that leaves clean bytes
4a68345 Safari is a third target, and two permissions we never used
06e7afb Regenerate the screenshots after the discoveries fixes
f43048b Something to sell, somewhere to be found, and reasons to be believed

---

Free for one language, forever. [Pro](https://weft.study/pricing) adds every
language at once, a different one per site, Hard Mode, and your own
translation key.
