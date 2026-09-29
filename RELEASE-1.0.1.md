# Weft 1.0.1

## Install

Take the file ending **`-folder.zip`**. The plain `.zip` is the one the
stores want: it has no folder inside and will empty itself into your Downloads.

**Chrome, Edge, Brave** — download `weft-chrome-1.0.1-folder.zip`, unzip it,
open `chrome://extensions`, turn on Developer mode, then **Load unpacked** and
pick the `weft-chrome-1.0.1` folder itself, not the `manifest.json` inside it.

**Firefox** — download `weft-firefox-1.0.1-folder.zip`, unzip it, open
`about:debugging` → This Firefox → **Load Temporary Add-on**, and pick the
`manifest.json` inside the folder. Firefox unloads temporary add-ons when it
closes, so this is for trying Weft rather than living with it.

**Safari** — needs the extension wrapped in a signed app, which needs Xcode.
See `docs/SUBMIT.md`.

Weft opens its first-run page and asks three questions. It has access to no
website until you answer the third one.

## Packages

- weft-chrome-1.0.1.zip — 213 KB
- weft-chrome-1.0.1-folder.zip — 215 KB
- weft-firefox-1.0.1.zip — 213 KB
- weft-firefox-1.0.1-folder.zip — 215 KB
- weft-safari-1.0.1.zip — 213 KB
- weft-safari-1.0.1-folder.zip — 215 KB

## Changes since v1.0.0

06cd2e9 The discoveries feed reshuffled itself, and the shots were never byte-identical (#24)
85bd327 Three documents said 29 tool tests, and one of them is the runbook (#23)
de0ec2a It was not contention: the store-asset generator fails in 28 seconds
9400ae9 Three documents said 29 tool tests, and one of them is the runbook
e01ce27 Twenty PRs of work, and only the first one was ever on main (#22)
a37a186 Record that the stack is landed, and why every session had left it
ddb7f86 Land the nineteen-commit stack on main, over a squash artefact
f4e4753 TODO.md and the Journal did not record the quote-unification fix (#21)
831c5ea Latin and Old English notes quoted straight marks; French and the site do not (#20)
70c2db9 The note was a fragment after the sentence's full stop, not part of it (#19)
00936ac B0 step 1 named only #15; #16 and #17 landed on the same head (#18)
d51d43f The page said English borrowed the Latin word from the English one (#17)
2fd4ab4 B0's step 1 still expected a PR stacked above #14; #15 is merged into it (#16)
7b70c47 The guard written to catch this could not see it, because the note was absent (#15)
aa9931b B0 said #14's work was already on the stack branch; it is stacked on top of it
2ab70cb `/latin/novem` does render its heading; the queued item said it did not
ecbc6bb A tooltip note leaned on a line the reader can switch off
f6733af The two files that tell the next session where things stand were templates (#1)
0e41950 The sitemap told search engines that 711 pages changed today, every day (#6)
21cc079 B0 counts five stacked PRs, not four
0c0c5ef `npm run packs` rewrote every lexicon it read, so nothing could diff them
77a5e33 iCloud makes `npm run validate` crash, and the error names nothing
2c21615 The listing screenshots were already right, and two documents were not
87f1303 `npm run test:all` was never the whole gate, and the table said it was
f5af392 The numbers in four documents were fiction, and one of them goes to HN
02fc7d8 The support button pointed at a page nobody had written
ee277d2 The two files that tell the next session where things stand were templates
3060d93 French leads everywhere now, and the lexicon verifier had never read two columns
d1d545a French had no etymologies, which is why the marketing led with Old English
7f7faaa Silence was the worst error state, and a support path that sends nothing
0d9910e The toolbar icon dissolved at the size it actually lives at
5f1922f Verify what GitHub serves, not what the build produces

---

Free for one language, forever. [Pro](https://weft.study/pricing) adds every
language at once, a different one per site, Hard Mode, and your own
translation key.
