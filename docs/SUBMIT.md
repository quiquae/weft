# Getting Weft into the stores

Four stores, four different processes. This is the operational runbook;
`STORE-LISTING.md` has the copy to paste into the fields. **To submit, work
down `READY-TO-SUBMIT.md` instead**: one page, every field's copy inline in
the form the store's box takes, and what is not ready said plainly. This file
is the reasoning behind it.

Everything a machine can check has been checked:

```
npm run test:all
```

runs typecheck, 683 unit tests, 138 jsdom tests, 642 tool tests, the
compatibility audit, all three builds, the package validator, and 49 end-to-end
tests in real Chromium. Nothing below should be attempted until that is
green.

Three further end-to-end specs are defined and deliberately skipped — they
generate assets rather than assert anything, and run only behind
`WEFT_STORE=1`, `WEFT_SCREENS=1` and `WEFT_FIRSTRUN=1`. Playwright reports
them as "3 skipped" beside the passes, and that is the green result, not a
partial one.

`test:all` does **not** include `npm run packs:verify`, `npm run site:check`
or `npm run artefacts:check`. Run all three as well before a submission —
`site:check` after `npm run site`, because it reads `dist/site` and does not
build it:

```bash
npm run packs:verify
npm run site && npm run site:check
npm run artefacts:check
```

`packs:verify` is the only thing that reads the lexicons; `site:check` is the
only thing that proves the site this repository builds has a page at the
privacy policy path Chrome requires and at the support path compiled into
the shipped extension; and `artefacts:check` is the only thing that looks at
the generated files this runbook tells you to upload, which go stale whenever
`src/` moves and do not change when they do.

**None of them can tell whether `https://weft.study` serves those pages.**
`site:check` reads files and skips every absolute URL, so it passes whether
or not the domain resolves — and on 2026-10-24 `weft.study` did not resolve
at all.
The last full run of this gate, every figure in it and the live-URL
measurements beside it, is in `SUBMIT-STATUS.md`.

After tagging a release, check what GitHub actually serves:

```bash
npm run verify:release        # or: npm run verify:release -- v1.0.1
```

It downloads the published `-folder.zip`, loads it in a real browser and
checks the first-run page renders, the worker answers, and no test seam
shipped. Everything else in the repository tests what the build produces;
this tests what a person downloads.

---

## What this costs, and what is verified

| Store | Fee | Verified |
|---|---|---|
| Chrome Web Store | One-time registration fee | Chrome's docs confirm **one-time, not recurring**, but do not print the amount. It has been $5 for years; the figure is shown at registration. |
| Microsoft Edge Add-ons | **None** | Verified 2026-10-24: "There is no registration fee for submitting extensions to the Microsoft Edge program" ([Microsoft](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account)). |
| Firefox (addons.mozilla.org) | Free | Long-standing; no account fee. |
| Safari / Mac App Store | **99 USD per year, recurring** | Verified against Apple's enrolment page. A paid membership is **required** to distribute; without it you can only run Weft on your own machine. |

Safari is therefore the only one with an ongoing cost, and the only one that
needs a 7 GB Xcode install and a native app wrapper. If you want to ship
somewhere this week, ship Chrome and Firefox; Safari is a project in itself.

---

## Order of operations

These block each other, so the order matters.

1. **Publish the privacy policy and support URLs.** Every store requires a
   public privacy policy URL before it will accept a submission, and Weft has
   to declare one even though it transmits nothing. `npm run site` renders
   `docs/PRIVACY.md` to `/privacy` and `docs/SUPPORT.md` to `/support`; the
   second is the URL `SUPPORT_URL` already sends the extension's own help
   button to. `npm run site:check` fails if either page is missing.

   This means putting the site up, which is deliberately **not** automatic.
   The `Site` workflow builds and link-checks all 714 pages on every push,
   but only deploys when told:

   ```bash
   # Settings -> Pages -> Source: GitHub Actions, then:
   gh variable set WEFT_PAGES --body true
   ```

   **Fix these two before flipping it**, because publishing is not reversible
   the way a commit is — once indexed, taking the site down leaves search
   results pointing at nothing:

   - The install page's download button points at
     `<repo>/releases/latest`, and the support page's issue-tracker link at
     `<repo>/issues`. Both **404 while the repository is private**. Either
     `gh repo edit quiquae/weft --visibility public --accept-visibility-change-consequences`
     (gh 2.98 refuses `--visibility` without the second flag), or host the zips
     elsewhere and set `WEFT_REPO` — and if issues are not going to be the
     support channel, change `docs/SUPPORT.md`, which is the only place that
     link is written.
   - The pricing page's checkout URLs point at a placeholder Lemon Squeezy
     store. A live pricing page with a dead buy button is worse than no
     pricing page.
2. **Decide the publisher name.** It appears on every listing, and changing it
   later is awkward on Chrome and painful on Apple.
3. **Chrome Web Store first.** It is the largest audience, the fastest review,
   and Edge's forms ask for the same copy, so doing Chrome first halves
   the Edge work.
4. **Firefox in parallel.** Independent of everything else.
5. **Safari last**, because of the Apple membership and the Xcode build.
6. **Only then post anywhere.** `LAUNCH.md` says this too and it is worth
   repeating: a good post sends traffic to a "load unpacked" instruction and
   most of it does not survive the encounter.

---

## Chrome Web Store

```bash
npm run test:all          # must be green
npm run artefacts:check   # what the tree has moved past since it was generated
npm run zip               # writes two archives per target
npm run validate          # re-check the exact bytes being uploaded
curl -sS -o /dev/null -w '%{http_code}\n' https://weft.study/privacy   # must print 200
```

The last line is the only one that asks the internet rather than this
repository, and it checks the URL the store refuses a submission without.
Load the page in a logged-out browser as well.

`artefacts:check` is the one of those five that is about *this document*.
The screenshots below and the release notes are generated files, and an
ordinary change to `src/` invalidates them without changing them — so they
go stale silently, and a version bump invalidates filenames the same way.
It lists what is behind, names the commits that did it, and prints the
command that regenerates each. It exits 1 whenever anything is stale, which
before a first submission it will be; read the list rather than the code.

**Upload the plain `weft-chrome-1.0.1.zip`, not the `-folder` one.** The
store requires `manifest.json` at the root of the archive and rejects one
wrapped in a directory. The `-folder` variant exists for humans installing
by hand: the flat archive unzips nineteen loose files into whatever
directory it is opened in, which is a poor first thirty seconds and no
folder to point "Load unpacked" at.

1. Register at <https://chrome.google.com/webstore/devconsole> and pay the
   one-time fee.
2. **Upload** `weft-chrome-1.0.1.zip`.
3. **Store listing** — paste from `STORE-LISTING.md`: name, short description
   (112 chars, under the 132 limit), detailed description, category
   *Education*, language English.
4. **Graphics** — all at the exact required sizes already:
   - Icon: `assets/icon-128.png`
   - Screenshots: the five `docs/store/chrome-*.png`, in numbered order
   - Small tile: `docs/store/tile-small-440x280.png`
   - Marquee: `docs/store/tile-marquee-1400x560.png`

   If `artefacts:check` above called the listing screenshots stale, run
   `npm run build:test && WEFT_STORE=1 npx playwright test store-assets`
   and commit what moves, *before* uploading. The generator is
   reproducible — identical sources give identical bytes — so anything that
   does move is a real difference between the art and the product.
5. **Privacy practices** — this is the tab that gets submissions rejected.
   Paste the per-permission justifications from `STORE-LISTING.md`
   individually; reviewers read each one and reject vague answers. Then the
   single-purpose statement, the data-usage disclosures, and the three
   certifications.
6. **Submit for review.**

**The question to expect** is about `optional_host_permissions: ["*://*/*"]`,
which looks broad. The answer is that Weft requests per-origin at runtime from
a user gesture on one of its own pages — the first-run page, Settings →
**Sites** or the toolbar popup — and never at install time — and it is
demonstrable rather than assertable: a fresh install reports zero granted
origins and zero registered content scripts. `tests/tools/install-permissions.test.ts`
holds every target's manifest to declaring no `content_scripts` and no host
permission, and `tests/e2e/privacy.spec.ts` ("what a fresh install may
touch") reads a real install: granted exactly what it declares, and no
content script registered until the user names a site. Until 2026-11-02
this paragraph named `tests/e2e/licensing.spec.ts` instead, which asserts
neither.

Review takes hours to a couple of weeks. A first submission is slower.

---

## Microsoft Edge Add-ons

Edge runs the same MV3 package as Chrome. Use the **Chrome zip**, not a
separate build — there is no `--target=edge` because there is no difference.

1. Register at <https://partner.microsoft.com/dashboard/microsoftedge>.
2. Paste the same copy as Chrome. An earlier draft of this step said to
   "Import from Chrome Web Store"; Microsoft's
   [publishing guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)
   describes no such option, so do not count on one.
3. Screenshots: the five **`docs/store/chrome-*.png`** (1280×800). Microsoft
   accepts screenshots of 640×480 or 1280×800 only, so Edge has no set of its
   own.
4. Store logo: `docs/store/logo-edge-300x300.png` (300×300, required).

Edge review is usually slower than Chrome's and the feedback is terser.

---

## Firefox (addons.mozilla.org)

```bash
npm run zip               # also writes weft-firefox-1.0.1.zip
npm run lint:firefox      # AMO's own validator, on dist/firefox; read the warnings
```

`lint:firefox` exits 0 whether or not the key below is declared, because the
validator only warns about it; as built on 2026-10-25 it printed 0 errors and
5 warnings, the missing key and four in Preact (`SUBMIT-STATUS.md`).

**Not submittable yet.** Since 2025-11-03 AMO refuses a new extension whose
manifest does not declare `browser_specific_settings.gecko.data_collection_permissions`,
and the Firefox build does not. `READY-TO-SUBMIT.md` (F0) has the two calls
that needs, and `TODO.md`'s `Next` the change.

1. Create an account at <https://addons.mozilla.org/developers/>. No fee.
2. Submit `weft-firefox-1.0.1.zip`.
3. **Source code is required** because the bundle is minified. AMO wants a
   reproducible build: point them at this repository, `build.mjs`, and
   `npm run build:firefox`. There are no build-time secrets and no
   post-processing.
4. The Firefox build declares `browser_specific_settings.gecko.id` —
   `weft@weft.study`. Changing it later orphans every existing install.

**Worth knowing about Firefox specifically.** The compatibility audit turned
up that Firefox only gained `Highlight` in 140 and `::highlight()` in 149,
while Weft's declared floor is 128. So most Firefox users today run the
*wrapped* renderer, not the highlight one — the fallback is the primary path
on that browser. It is fully supported and tested; it just means Firefox
behaviour differs from Chrome by default, and a bug report from a Firefox user
is probably about `WrappedRenderer`.

---

## Safari

Safari needs the extension wrapped in a native macOS app. There is a script
for it:

```bash
npm run safari                 # or: npm run safari -- --macos-only
```

It checks for the full Xcode first and tells you exactly what to install if
it is missing, rebuilds `dist/safari` so the conversion cannot pick up stale
code, verifies each converter flag against the local `--help`, then runs
Apple's `safari-web-extension-converter`.

**Prerequisites:**

- Full **Xcode** from the Mac App Store, about 7 GB. The Command Line Tools
  are not enough — the converter ships inside Xcode.app.
- `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
- An **Apple Developer Program** membership (99 USD/year) to distribute.

After conversion, the script prints the remaining steps. The two that catch
people:

- **Set the signing team on both targets.** The app and the extension are
  separate targets and Xcode only nags about the first.
- **Lower the deployment target** to macOS 13 / Safari 16.4. The converter
  defaults to whatever SDK it shipped with, which excludes users Weft
  supports perfectly well.

### What is different on Safari, and why

The compatibility audit checked every API Weft uses against MDN's data. Three
things differ, all handled, none of them defects:

| | Safari | What Weft does |
|---|---|---|
| `notifications` | never implemented | Falls back to the toolbar badge (`action.setBadgeText`, Safari 15.4+). Less information than a notification, which is the honest trade. |
| `commands` (keyboard shortcuts) | Safari 26+ only | Optional-chained. Every command is also reachable from the popup, so nothing is unreachable below 26. |
| CSS Custom Highlight API | Safari 17.2+ | 16.4–17.1 runs the wrapped renderer, detected at load. |

So **verify by hand on Safari 16.4–17.1 specifically**: if the highlight path
were taken there, woven words would carry no styling at all. No automated test
covers Safari — Playwright cannot drive a Safari web extension — which is
precisely why that check is written down.

---

## What I could not do for you

- **Create any store account.** All four require identity verification and a
  payment method.
- **Pay any fee.**
- **Upload anything.** Each store's submission is a signed-in, human action.
- **Run the Safari conversion.** This machine has only the Command Line
  Tools, so `xcrun safari-web-extension-converter` does not exist here. The
  script is written and its Xcode guard is tested; the conversion itself has
  not been executed and will need a look the first time it runs.
- **Post to Reddit, Hacker News or anywhere else.** Drafts are in
  `LAUNCH.md`. An automated account posting self-promotion gets the domain
  shadowbanned, which would cost the 714-page search asset. That was a
  decision, not an omission.
