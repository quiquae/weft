# TODO: weft

<!-- The running state of this project. Any session, on any account, in any
     tool, reads this to find out where things stand. Newest notes at the top
     of Notes; the list itself stays in the order work should happen. -->

**State on 2026-09-28:** every automatable check is green — typecheck clean,
484 unit, 97 jsdom, 36 e2e passing (3 asset-generator specs skipped by
design), compat clean, all three packages built at 979 KB and passing
`npm run validate`, `packs:verify` 0 errors / 4 warnings, **711** site pages
with **16 087** links all resolving. The fifteen store screenshots were
regenerated on 2026-09-28, twice over — fourteen come back byte-identical
every time, confirming the listing art shows the lexicon that ships. The
fifteenth, the progress dashboard, bakes in its capture time and so is never
byte-stable; that is a property of that one scene, not a sign anything is
wrong. The code is not what is holding the release up. The critical path runs through **B1 — the domain `weft.study` is
not registered**, which only Creagh can fix. Everything in Now is work that
can land before that and does not depend on it.

## Now

- [x] **Generate `/privacy` and `/support` pages in `tools/build-site.mjs`.**
      Done 2026-09-27. Both are rendered from Markdown through the same
      template as every other page, so the published page and the document in
      `docs/` cannot drift. `npm run site:check` now also *fails the build*
      if `SUPPORT_URL`, `PRICING_URL` or `/privacy` has no page behind it.
      See the note at the top of Notes for what changed and what it turned up.

- [x] **Correct the test counts in three documents.** Done 2026-09-27, and it
      was **four** — `docs/LAUNCH.md:215` had "449 tests" inside an HN comment
      draft, where a wrong number goes out in public. Every count in the
      repository is now a measured one; `git grep` for the old values returns
      nothing. See the note at the top of Notes for what was measured and for
      the one judgement call (what the 1.0.0 changelog entry should say).

- [x] **Add a CHANGELOG entry for the five commits after the `v1.0.0` tag.**
      Done 2026-09-27, headed `1.0.1` and stating plainly that it is not cut
      yet. It covers seven paragraphs rather than five commits: the two
      documentation commits on this branch stack are in it too, because
      `/privacy` and `/support` change where a *shipped* button lands and so
      belong in the release notes a user reads.

- [x] **Regenerate the five `docs/store/chrome-*.png`.** Done 2026-09-28,
      redone independently later the same day when a queued task re-requested
      it without knowing this branch already existed. Fourteen of fifteen
      shots are byte-identical again; the fifteenth, `apple-04-progress.png`,
      genuinely differs and the regenerated file is committed here. Re-measured
      with `sips` (actual pixel metadata, not the viewport config): chrome
      1280×800, edge 1366×768, apple 1440×900, tiles 440×280 and 1400×560,
      logo 300×300 — all exact. The premise of the original item was half
      wrong and the worry behind it was sound; both write-ups are in Notes.

## Next

- [ ] **Cut 1.0.1.** *Topmost unchecked item as of 2026-09-28.*
      `npm run release -- --version=1.0.1` bumps `VERSION` in
      `manifest.config.mjs`, keeps `package.json` in step, rebuilds, packages
      all three targets and writes `RELEASE-1.0.1.md`. It refuses a dirty tree
      and runs the tests first, so land everything above first. It stops
      before committing and prints the `git tag` / `git push --tags` lines —
      pushing the tag fires `.github/workflows/release.yml`, which is an
      outward-facing publish, so that is **B2**, not this. *~20 minutes.*
      **Not from a feature branch.** Four documentation branches are stacked
      and unmerged as of 2026-09-28 — PRs #1, #2, #3 and the screenshot
      verification on top of them — and a version bump belongs on `main`
      once they land, or `VERSION` moves on a branch that may never merge.

- [ ] **Re-run `npm run test:all` on the bumped tree**, plus
      `npm run packs:verify` and `npm run site:check`, and paste the result
      into the Journal in `CLAUDE.md`. That is the gate `docs/SUBMIT.md` names
      as the thing nothing below should be attempted without. The two extra
      commands are there because `test:all` does **not** include them — found
      2026-09-27, when the command table in `CLAUDE.md` claimed it did.
      `packs:verify` is the only thing that reads the lexicons and
      `site:check` is the only thing that proves the privacy policy URL has a
      page behind it.

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
   three must be green on the exact bytes you are about to upload. If
   `validate` dies with `Unknown system error -11`, that is iCloud conflict
   copies inside `dist/`, not the package — see the 2026-09-28 note below.
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

**2026-09-28 — a queued task re-requested this branch's work, and a second
look found one screenshot that is not byte-stable.** An automated queue asked,
independently of this branch, to regenerate the five `chrome-*.png` and verify
their dimensions, citing the same `d1d545a`/`3060d93` lexicon concern the entry
below already closed. It did not know `store/regenerate-listing-screenshots`
existed. Rather than open a second PR stacked on the same base, this pass
checked out this branch and re-verified its finding independently instead of
trusting the write-up.

- **Running the spec directly instead of through `npm run test:e2e` fails, and
  the error names nothing useful.** `WEFT_STORE=1 npx playwright test
  store-assets`, run standalone, timed out waiting for `weft-w` to appear on a
  page whose article text had rendered completely fine — the content script
  never ran at all. `"test:e2e": "npm run build:test && playwright test &&
  npm run build"` — run standalone, the spec used whatever `dist/chrome`
  happened to be on disk, which after any `npm run test:all` run is a
  **production** build. Production builds intentionally carry no
  `host_permissions` — that is the entire point of the runtime-permission
  design — so a production `dist/chrome` has no way to attach a content script
  to the test server's `http://localhost` origin. `manifest.config.mjs:107-109`
  adds a static `host_permissions: ['http://localhost/*', 'http://127.0.0.1/*']`
  only when built with `--test`, for exactly this reason. Fix: `npm run
  build:test` before running any e2e spec directly; `npm run test:e2e` already
  does this for the whole suite. Reproduced twice before finding this (same
  failure both times, ruling out a flake), then confirmed the rebuild fixed it.
- **Re-verified by regenerating four times, not by re-reading the claim
  below.** Two runs failed for the reason above; the two that followed, after
  `npm run build:test`, agree byte-for-byte with each other on all fifteen
  files, and fourteen of the fifteen also agree with what this branch already
  committed — independent confirmation, not repetition.
- **The fifteenth, `apple-04-progress.png`, is genuinely not byte-stable, and
  it is not the lexicon.** It differs from the committed version by 303 bytes,
  despite two fresh captures a minute apart matching each other exactly —
  which rules out per-run animation jitter and points instead at
  `tests/e2e/store-assets.spec.ts`'s progress scene, which seeds imported
  review cards as `now - ago * day` relative to `Date.now()` at capture time
  rather than a fixed instant. The freshly-regenerated file is committed here
  rather than the older one, since it is the verified output of the documented
  command against the code and lexicon as they stand today.
  `chrome-04-progress.png` and `edge-04-progress.png` render the identical
  scene at different frame sizes and came back byte-identical both times — the
  same time-dependence is presumably present in them too, just not enough to
  move a pixel at those crops. Not fixed here: pinning the seed to a fixed
  instant is a real design decision (which instant, and does a fixed date
  itself start to read as stale?), and this pass's job was regenerating and
  verifying, not redesigning a fixture. Worth folding into whichever session
  next touches the "check the remaining artefact generators for byte-stability"
  work, wherever that lands once this stack is reconciled — this is the same
  class of bug as the pack builder and the sitemap `lastmod`, just lower
  stakes, since a screenshot is neither indexed content nor a release artefact.
- No new branch or PR: the change lives on this branch, where the work already
  belonged. Pushed as a fast-forward — no force, no rebase, no new commits from
  anyone else on this branch to lose.

**2026-09-28 — the store screenshots already ship the current lexicon.** All
fifteen regenerate byte-for-byte, so there was nothing to commit.

- **The item's premise was half wrong.** It said all five were captured at
  `d1d545a`. `git log -1 -- <file>` says `chrome-03/04/05` were, but
  `chrome-01-woven.png` and `chrome-02-reveal.png` had not changed since
  `144cb30` on 2026-09-15 — eleven days and twenty-two commits earlier,
  across the toolbar-icon redraw and the help/diagnostics work among others.
  Both are current anyway.
- **Which is the interesting part: the capture is deterministic.** The same
  lexicon and the same page give the same woven words, so a regeneration that
  returns identical bytes is a result rather than an absence of one. Checked
  that the files really were rewritten by looking at mtimes — all fifteen at
  00:24 on 2026-09-28 — because an empty diff otherwise cannot be told apart
  from a capture that never ran, and the two look the same in `git status`.
- **Do not turn this into a pixel-equality gate.** It is the obvious next
  thought now that determinism is established, and it would fail in CI for a
  reason that has nothing to do with the lexicon: these were captured on
  macOS/arm64 and CI runs the same suite on `ubuntu-latest`, where the font
  stack and text antialiasing differ. The portable version of that check
  already exists
  inside the spec — `expect(hovered, 'no word with an etymology was woven
  into this page')` — and it catches the failure that actually matters, a
  lexicon edit emptying the tooltip that scene exists to demonstrate.
- **`npm run packs` is not idempotent.** It stamps `builtAt` with *today's*
  date, so it modifies all eight files in `src/lexicon/packs/` on every run
  even when no lexicon has changed. Diffed field by field: 1 of 66 fields in
  `index.json`, and the seven packs differ in that date and nothing else, so
  the committed packs are semantically current with `tools/seed/*.tsv`. It
  was reverted here rather than committed — a stamp saying when the content
  was built is the honest value, and 186 KB of date churn on the eve of a
  release is not. Worth knowing twice over: `CLAUDE.md` tells a new
  contributor to run `npm run packs` "before a first build", which leaves a
  fresh clone dirty, and `npm run release` **refuses a dirty tree**.
- **`playwright.config.ts` described a CI that does not exist**, found while
  checking the claim above. Its header said extension service workers are
  "more reliable headed, so CI runs headed under xvfb"; `fixtures.ts:76` sets
  `headless: true` unconditionally and `.github/workflows/ci.yml` has no xvfb
  step and no headed path. Comment corrected — it is the only change to a
  non-Markdown file in this pass, and it changes no behaviour.
- **iCloud can make `npm run validate` crash, and the error says nothing.**
  This checkout lives under `~/Documents`, which iCloud syncs, and iCloud
  drops conflict copies (`manifest 2.json`, `dashboard 2.html`, `_locales 2/`)
  into `dist/` while a build is running — 61 of them here. `validate` reads
  every `.html` in the package directory, hits a duplicate that is still a
  placeholder, and dies with `Error: Unknown system error -11 ... syscall:
  'read'` and no filename. It is not a packaging fault: `rm -rf dist/chrome
  dist/firefox dist/safari && npm run build:all` takes under a second and
  `validate` then passes all three. Worth knowing at **B5 step 4**, which is
  where someone runs `validate` on the exact bytes they are about to upload.

**2026-09-27 — every count in the repository is now a measured one.** The three
documents named in the item were four, and `git grep -nE '427|449|379|664 KB'`
now returns nothing.

- **Measured, not copied.** `npm run test:unit` → 484 pass / 122 suites.
  `npm run test:dom` → 97 pass / 22 suites. `npx playwright test --list` →
  39 defined in 7 files, of which 3 are the `WEFT_STORE` / `WEFT_SCREENS` /
  `WEFT_FIRSTRUN` asset generators, so **36 run**. `npm run packs:verify` →
  584–588 entries across 579–583 surface forms. The packs are 668 270 bytes,
  which is **653 KB** at the `size / 1024` convention
  `tools/validate-package.mjs:281` uses — not the 664 KB three documents
  claimed, which matches no measurement under either convention.
- **`docs/LAUNCH.md:215` was the fourth document.** "449 tests" sat inside
  the Hacker News comment draft, which is copy a human sends out in public.
  Worth re-sweeping the whole of `docs/LAUNCH.md` before anything is posted:
  it is the only file here whose errors leave the repository.
- **The 1.0.0 changelog entry was wrong even for 1.0.0, so it was corrected
  to 1.0.0, not to today.** Its "449 tests: 379 unit, 71 in jsdom, 24
  end-to-end" does not even add up (379 + 71 + 24 = 474). Measured in a
  throwaway worktree at `ef97167`: **470 unit, 97 jsdom, 38 e2e defined of
  which 35 run** — 602 in total — and packs of 659 451 bytes = 644 KB. The
  entry now says that. A changelog entry for a shipped release describing
  today's tree would be a second kind of wrong. Today's numbers went into the
  new 1.0.1 entry instead.
- **The lexicon entry counts did not change between `v1.0.0` and now**, only
  the byte size: `3060d93` added etymons and notes to existing French
  entries rather than new entries. So 584–588 / 579–583 is correct in both
  changelog entries and only the KB differs.
- **The 1.0.1 entry says out loud that it is not cut.** `VERSION` in
  `manifest.config.mjs` is still 1.0.0 and `tools/release.mjs` does not touch
  `CHANGELOG.md` — it writes `RELEASE-X.Y.Z.md` — so the two will not fight
  when the bump happens.

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
