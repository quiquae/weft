# TODO: weft

<!-- The running state of this project. Any session, on any account, in any
     tool, reads this to find out where things stand. Newest notes at the top
     of Notes; the list itself stays in the order work should happen. -->

**State on 2026-09-27:** every automatable check is green — typecheck clean,
484 unit, 97 jsdom, 36 e2e passing (3 asset-generator specs skipped by
design), compat clean, all three packages built at 979 KB and passing
`npm run validate`, **711** site pages with **16 087** links all resolving.
The code is not what is holding the release up. The critical path runs through
**B1 — the domain `weft.study` is not registered**, which only Creagh can fix.
Everything in Now is work that can land before that and does not depend on it.

## Now

- [x] **Generate `/privacy` and `/support` pages in `tools/build-site.mjs`.**
      Done 2026-09-27. Both are rendered from Markdown through the same
      template as every other page, so the published page and the document in
      `docs/` cannot drift. `npm run site:check` now also *fails the build*
      if `SUPPORT_URL`, `PRICING_URL` or `/privacy` has no page behind it.
      See the note at the top of Notes for what changed and what it turned up.

- [ ] **Correct the test counts in three documents.** They disagree with each
      other and all three are wrong. `README.md` says "427 unit + 81 jsdom"
      and "24 tests"; `docs/SUBMIT.md` says "427 unit tests, 81 jsdom tests"
      and "24 end-to-end"; `CHANGELOG.md` says "449 tests: 379 unit, 71 in
      jsdom, 24 end-to-end". Measured today: **484 unit, 97 jsdom, 39 e2e
      defined of which 36 run** (the other three are the `WEFT_STORE` /
      `WEFT_SCREENS` / `WEFT_FIRSTRUN` asset generators). While in there:
      README and CHANGELOG both say "584–588 surface forms", but
      `npm run packs:verify` reports 584–588 *entries* across **579–583**
      surface forms. *~15 minutes.*

- [ ] **Add a CHANGELOG entry for the five commits after the `v1.0.0` tag.**
      `5f1922f` `verify:release`, `0d9910e` redrawn toolbar icons, `7f7faaa`
      the help page and the diagnostics support path, `d1d545a` French
      etymologies, `3060d93` French leading everywhere plus a two-column fix
      in the lexicon verifier. The published 2026-09-19 release has none of
      them, so a reader comparing the tag to `main` currently finds five
      undocumented commits. Head it `1.0.1` to match the bump below.
      *~30 minutes.*

## Next

- [ ] **Regenerate the five `docs/store/chrome-*.png`.** They were captured in
      `d1d545a`, one commit before `3060d93` changed `tools/seed/lex-fr.tsv`
      and `fr-cousins.tsv` and rebuilt `en-fr.json` — so the French words in
      the listing screenshots are not guaranteed to be the ones that ship.
      `WEFT_STORE=1 npx playwright test store-assets` rewrites all fifteen
      (chrome, edge, apple). Re-measure afterwards: Chrome requires exactly
      1280×800 and the store rejects anything else. *~10 minutes.*

- [ ] **Cut 1.0.1.** `npm run release -- --version=1.0.1` bumps `VERSION` in
      `manifest.config.mjs`, keeps `package.json` in step, rebuilds, packages
      all three targets and writes `RELEASE-1.0.1.md`. It refuses a dirty tree
      and runs the tests first, so land everything above first. It stops
      before committing and prints the `git tag` / `git push --tags` lines —
      pushing the tag fires `.github/workflows/release.yml`, which is an
      outward-facing publish, so that is **B2**, not this. *~20 minutes.*

- [ ] **Re-run `npm run test:all` on the bumped tree** and paste the result
      into the Journal in `CLAUDE.md`. That is the gate `docs/SUBMIT.md` names
      as the thing nothing below should be attempted without.

## Blocked

Each of these needs Creagh: an identity, a payment method, or a decision that
is not reversible the way a commit is. Ordered by what blocks what.

**B1 — Register `weft.study`.** *Everything else waits on this.* `dig` returns
NXDOMAIN from both 8.8.8.8 and 1.1.1.1 while the `.study` TLD itself resolves,
so the domain is simply not registered. Three things are compiled into the
shipped extension or the store copy and point at it: `PRICING_URL` and
`SUPPORT_URL` in `src/core/pricing.ts:82,91`, and the privacy policy URL the
Chrome Web Store requires. *Unblocks: B2, B3, and the whole of B5.*
If a different domain is chosen instead, note that
`browser_specific_settings.gecko.id` is `weft@weft.study` and **must not
change** — it orphans every Firefox install — so the id will simply outlive
the domain name. Change `src/core/pricing.ts` and `WEFT_SITE_URL` in
`.github/workflows/site.yml` and nothing else.

**B2 — Make the repository public, or set `WEFT_REPO`.** The install page's
download button points at `<repo>/releases/latest`
(`tools/build-site.mjs:613`), which 404s for everyone but the owner while the
repo is private. `gh repo edit quiquae/weft --visibility public`, or host the
zips elsewhere and set `WEFT_REPO`. Then push the `v1.0.1` tag so the release
workflow attaches the packages. *Needs: B1 decided.*

**B3 — Turn on Pages and set `WEFT_PAGES=true`.** Settings → Pages → Source:
GitHub Actions, then `gh variable set WEFT_PAGES --body true`. Deliberately
opt-in: publishing is not reversible the way a commit is, and once indexed,
taking the site down leaves search results pointing at nothing. *Needs: B1
and B2* — the privacy and support pages now exist and `site:check` fails
without them, but the install page's download button and the support page's
issue-tracker link both still 404 while the repository is private.

**B4 — Replace the placeholder checkout URLs.** `CHECKOUT_BASE` in
`src/core/pricing.ts:31` is `https://weft.lemonsqueezy.com/checkout/buy`,
which is a placeholder store. A live pricing page with a dead buy button is
worse than no pricing page. Not a blocker for the *free* tier or for the store
submission itself — Weft is free for one language forever — so it can follow
B3 if the Pro purchase is not ready. *Needs: a Lemon Squeezy account.*

**B5 — Submit to the Chrome Web Store.** Everything a machine can check has
been checked. The remaining steps, in order:

1. Register at <https://chrome.google.com/webstore/devconsole> and pay the
   one-time fee. Chrome's docs confirm it is one-time, not recurring, and do
   not print the amount; it has been $5 for years and is shown at
   registration. Use an account you will still control in five years.
2. Decide the publisher name. It appears on every listing and is awkward to
   change on Chrome, painful on Apple.
3. Publish the privacy policy at `https://<domain>/privacy` and confirm it
   loads in a logged-out browser. Have the support URL ready too.
4. Run `npm run test:all`, then `npm run zip`, then `npm run validate`. All
   three must be green on the exact bytes you are about to upload.
5. Upload **`weft-chrome-1.0.1.zip`** — the plain one. The `-folder.zip` is
   for humans loading unpacked; the store rejects an archive with
   `manifest.json` inside a directory.
6. Paste the listing fields from `docs/STORE-LISTING.md`: name, the 129-char
   short description, the detailed description, category **Education**,
   language English.
7. Upload the graphics, all already at the exact required sizes and verified
   by measurement: icon `assets/icon-128.png` (128×128); the five
   `docs/store/chrome-*.png` in numbered order (1280×800);
   `docs/store/tile-small-440x280.png` (440×280, required);
   `docs/store/tile-marquee-1400x560.png` (1400×560, optional but required to
   ever be featured).
8. Fill the **Privacy practices** tab. This is the one that gets submissions
   rejected. Paste the six permission justifications from
   `docs/STORE-LISTING.md` *individually* — storage, alarms, scripting, tabs,
   contextMenus, notifications — plus the separate one for
   `optional_host_permissions`. Reviewers read each and reject vague answers.
   Then the single-purpose statement, the data-usage disclosures, and the
   three certifications.
9. Submit. Expect a question about `optional_host_permissions: ["*://*/*"]`.
   The answer: Weft requests per-origin at runtime from a user gesture on its
   own first-run page, never at install, the manifest declares no
   `content_scripts` at all, and a fresh install reports zero granted origins
   and zero registered content scripts — asserted by
   `tests/e2e/licensing.spec.ts`, "a fresh install is Free, and Free weaves".
10. After it goes live, run `npm run verify:release` against the published
    tag. It downloads what GitHub actually serves, loads it in a real browser,
    and checks the first-run page renders, the worker answers, and no test
    seam shipped.

Review takes hours to a couple of weeks; a first submission is slower.

**B6 — Firefox and Safari.** Out of scope for this pass and fully written up
in `docs/SUBMIT.md`. Firefox is free and independent of everything above, and
needs reviewable source because the bundle is minified. Safari needs a 99
USD/year Apple Developer membership, a 7 GB Xcode install, and a hand check on
Safari 16.4–17.1 specifically, where the wrapped renderer is the path taken
and no automated test can reach it.

## Notes

Anything a later run would be sorry not to know. Assumptions made, dead ends
already tried, decisions that should not be revisited.

**2026-09-27 — `/privacy` and `/support` now exist.** `npm run site` writes
711 pages; `npm run site:check` reports 16 087 links, all resolving.

- **They are rendered, not hand-written.** `tools/build-site.mjs` gained a
  ~110-line Markdown renderer and a `docPage()` that runs a `docs/*.md` file
  through the same `page()` template as everything else. Two copies of a
  privacy policy is a guarantee they diverge, and the document also has to
  stay readable on GitHub. **Do not** add a Markdown dependency to undo this:
  the renderer handles exactly the subset these documents use, and if a
  document needs more, rewriting the document is the cheaper fix.
- **`docs/SUPPORT.md` is new.** There was no such document; the support URL
  had been compiled into the extension for a page nobody had written. It
  covers the popup's own explanations, the five things most likely to look
  broken, how to produce a diagnostic report, and what Weft will never ask
  for. Every claim in it was checked against the code, not the docs.
- **The privacy policy was wrong about permissions.** Its table still listed
  `idle` and `unlimitedStorage`, which `manifest.config.mjs:25` has not
  declared for some time. Publishing that at `/privacy` would have handed a
  Chrome reviewer a policy claiming two permissions the package never
  requests — a mismatch on exactly the tab that gets submissions rejected.
  Corrected, with the removals explained and pointed at the fuller account
  in `docs/STORE-LISTING.md`.
- **`npm run site:check` now fails the build** if `SUPPORT_URL`,
  `PRICING_URL` (both read from `src/core/pricing.ts`) or `/privacy` has no
  page behind it. That is the class of bug this item was: a URL compiled
  into a *shipped extension*, which cannot be fixed by rebuilding the site.
  Verified by deleting each page and watching it exit 1.
- **The site workflow now rebuilds on `docs/PRIVACY.md` and
  `docs/SUPPORT.md`.** Without that, editing the published privacy policy
  would not have reached the site.
- **The footer of every page now links Install · Pricing · Support ·
  Privacy.** That is where the ~2 900 extra checked links came from.
- **Still 404 while the repository is private:** the install page's download
  button *and* the new support page's link to the issue tracker. Both clear
  together at **B2**; neither is fixable here. If issues are never going to
  be the support channel, `docs/SUPPORT.md` is the one place to change.
- No email address exists anywhere in this repository, so the support page
  does not invent one. If a contact address is wanted it needs B1 first.

**2026-09-27 — survey pass.** Wrote `CLAUDE.md` from the repository and
rewrote this file. Changed nothing else; read-mostly by instruction.

- **Assumed 1.0.1 rather than re-cutting `v1.0.0`.** The `v1.0.0` tag and its
  GitHub release have been downloadable since 2026-09-19 and are five commits
  stale. Moving a published tag breaks anyone who already has the zips.
  Reverse this only if it is certain nobody has downloaded them.
- **Assumed `weft.study` is still the intended domain.** It is unregistered,
  but it is baked into the Firefox extension id, which cannot change, so it is
  the path of least surprise. B1 says what to do if not.
- **Assumed the Chrome Web Store is the only store in scope.** Firefox and
  Safari are B6.
- Ran on Node 26.7 although `.nvmrc` pins 22 and CI pins 22. Everything passed
  regardless, including `--experimental-strip-types`, which Node 26 still
  accepts. Not a reason to change the pin; just a reason not to be surprised.
- `npm run release` does **not** tag or push. It writes the version, rebuilds,
  packages, writes `RELEASE-X.Y.Z.md`, and prints the git commands for you.
- The three "skipped" e2e tests are not broken. They are asset generators
  behind `WEFT_STORE=1`, `WEFT_SCREENS=1` and `WEFT_FIRSTRUN=1`.
- `npm run packs:verify` reports 4 warnings, and they are expected: four Old
  English interjections (`hello`, `goodbye`, `please`, `sorry`) have no IPA
  because they are multi-word phrases and Old English has no speech-synthesis
  voice on any platform. Not a bug to chase.
- The loose `weft-*.zip` files and the `dist/` tree in the working directory
  are build output and are gitignored. Several carry iCloud duplicate suffixes
  (`... 2.zip`, `.last-run 4.json`); they are safe to delete and are not
  tracked.
