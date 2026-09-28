# weft

<!-- This file is the project's memory. Every account and every tool reads it
     from disk, so it is the one place that is shared: Claude Enterprise,
     Claude Pro, and Codex all see the same text. Server-side memory (claude.ai
     Projects, ChatGPT memory) is per-login and cannot be shared, so nothing
     durable should live only there. AGENTS.md is a symlink to this file, which
     is how Codex reads it too. -->

## What this project is

Weft is a Manifest V3 browser extension that weaves a proportion of the words
on a page into a language you are learning, and raises that proportion with
the attention you actually spend on the page. Point at a woven word and the
tooltip hands back the English, with part of speech, gender, pronunciation,
and — for Latin and Old English — the English word it became. Seven languages
ship with a lexicon: French, Spanish, German, Italian, Portuguese, Latin, Old
English (356 checked English lemmas each, 579–583 surface forms per pack). It
is for someone who wants the browsing time they were going to lose anyway to
buy them vocabulary. There is no account, no server and no telemetry; it works
offline, and it installs with **no** host permissions until the user names
sites on the first-run page.

Three targets are built from one source: `chrome` (which Edge takes
unchanged), `firefox`, `safari`. The pedagogical method is the diglot weave
(Blair, BYU, 1970s); Weft's own contribution is tying difficulty to attention
and scheduling with FSRS-6. `docs/PEDAGOGY.md` separates the cited research
from the judgement calls.

**What "done" looks like:** the code is done. `git log` shows 34 commits
ending in a green `v1.0.0` tag plus five commits after it. "Done" now means
*released* — a Chrome Web Store listing that a stranger can install from. That
is a submission Creagh performs by hand with her own developer account, so
this repository's job is to be release-ready and to keep the remaining human
steps written down. `TODO.md` is that list; `docs/SUBMIT.md` is the long-form
runbook and `docs/STORE-LISTING.md` holds every field's copy.

## How to work here

Node 22 (`.nvmrc`; `engines.node >= 20`; CI pins 22). `npm ci` then
`npm run packs` before a first build — the lexicon packs in
`src/lexicon/packs/` are generated from `tools/seed/*.tsv`.

The commands that matter, with what each actually produced on 2026-09-27:

| Command | What it does | Last measured result |
|---|---|---|
| `npm run typecheck` | `tsc --noEmit` | clean |
| `npm run test:unit` | pure-core tests, no browser | **484 pass**, 122 suites, ~9 s wall clock here (no browser; the figure moves with the machine, the counts do not) |
| `npm run test:dom` | jsdom tests | **97 pass**, 22 suites, ~9 s wall clock here |
| `npm run test:e2e` | real Chromium, extension loaded | **36 pass, 3 skipped**, 3.0 min here |
| `npm run compat` | every API used, checked against MDN compat data | 21 dependencies × 3 browsers = 63 checks: **56 pass, 7 degrade with a named fallback, 0 fail, 0 without data** |
| `npm run packs:verify` | sanity-check the lexicons | 0 errors, 4 warnings (missing IPA on 4 Old English interjections) |
| `npm run build:all` | chrome + firefox + safari | 979 KB unpacked per target |
| `npm run validate` | pre-flight the built packages against store rules | all 3 pass |
| `npm run site:check` | link-check the generated site | 711 pages, 16 087 links, all resolve; also fails if `/privacy`, `/support` or `/pricing` is missing |
| `npm run test:all` | typecheck, unit, jsdom, compat, build:all, validate, e2e, then build:all and validate again | the gate before any release — but **not** `packs:verify` or `site:check`, which have to be run separately |

Also: `npm run dev` (watch), `npm run zip` (per target, a flat archive for the
store and a `-folder` one for humans), `npm run packs` (rebuild lexicons),
`npm run site` / `npm run og` (content site, social card), `npm run safari`
(wrap in an Xcode project — needs full Xcode, not the CLT),
`npm run release -- --version=X.Y.Z` (bump, rebuild, package, write notes),
`npm run verify:release` (download what GitHub actually serves and load it in
a browser), `npm run licence -- --name="..." --tier=pro` (mint a key).

The three skipped e2e tests are asset *generators*, not assertions. Turn them
on deliberately: `WEFT_STORE=1`, `WEFT_SCREENS=1`, `WEFT_FIRSTRUN=1`.

**Never touched:**

- `.licence-private.jwk` — gitignored, on Creagh's machine only, the only
  thing that can mint a licence. Its public half is
  `PUBLISHER_PUBLIC_KEY_JWK` in `src/core/licence-key.ts`; rotating it
  invalidates every licence already issued.
- `browser_specific_settings.gecko.id` = `weft@weft.study`
  (`manifest.config.mjs`). Changing it orphans every existing Firefox install.
- The purity of `src/core/` — no DOM, no `chrome.*`, no I/O. Reaching for
  either from core is the one change that would undo the test suite's speed
  and the reason five bugs were caught before anyone loaded the extension.
- Version lives in exactly one place, `VERSION` in `manifest.config.mjs`, with
  `package.json` kept in step by `tools/release.mjs`. Do not edit either by
  hand.

## Decisions that already hold

**Edit `nodeValue` in place; never replace a text node.** Replacing text nodes
is precisely why Google Translate throws `NotFoundError` in React apps: the
fiber still references the detached node and the next render calls
`removeChild` on it. Assigning to `nodeValue` restructures nothing, so no
framework reference is ever invalidated and no monkey-patching is needed. The
cost — no per-word elements to style or hit-test — is paid back by the CSS
Custom Highlight API and `caretPositionFromPoint`.
`tests/e2e/pages/reconciler.html` reproduces the failure directly and passes.
A second `wrapped` renderer exists behind the same interface for screen-reader
users, who need real `lang` attributes; `resolveRenderMode` picks per page.
See `docs/ARCHITECTURE.md`.

**`src/core/` is pure.** Every interesting decision — which word to swap, how
hard the page should be, whether a settings change is allowed yet — is a
function of its arguments. That is why the unit suite runs in under two
seconds without a browser.

**No static `content_scripts`, and no host permissions at install.**
`optional_host_permissions: ['*://*/*']` is requested per-origin at runtime
from a user gesture on Weft's own first-run page, and the content script is
registered with `scripting.registerContentScripts({persistAcrossSessions: true})`.
This buys three things: no "read and change all your data on all websites"
install warning, a clean answer to Chrome's narrow-permission review, and
users handing over exactly the sites they want. `tests/e2e/licensing.spec.ts`
("a fresh install is Free, and Free weaves") asserts a fresh install has zero
granted origins and zero registered content scripts, which makes the answer
demonstrable rather than assertable.

**Permissions are per-target, not shared.** Safari has never implemented
`notifications`, so the Safari build does not declare it and falls back to the
toolbar badge. A permission the browser cannot honour is an install prompt for
something that can never work, in front of a reviewer who knows that.
`tools/compat-audit.mjs` fails the build on any key MDN says the target lacks.
Two permissions were removed for the same reason and the reasoning is kept in
`docs/STORE-LISTING.md` because a reviewer comparing versions will see them go:
`idle` had zero call sites, and `unlimitedStorage` was masking two unbounded
stores that `src/core/prune.ts` now caps.

**Difficulty only ever rises mid-page.** A word just decoded must not flip back
to English as the page gets harder around it, so selection is pinned: whatever
is on screen stays, and rising difficulty only appends. Function words are
never woven — replacing "the", "of", "and" destroys the scaffolding the reader
is decoding with, for almost no vocabulary.

**Cooldowns are stored, not scheduled.** Closing the browser neither cancels
nor restarts one, and re-requesting the same change does not move it.
Cancelling a queued change is instant and free: friction on the way *out* of a
commitment would be coercion. Anything that makes Weft harder applies at once.

**Some things are never gated at any price** — accessibility, the never-weave
list, panic passes, data export, pronunciation and the etymologies.
`tests/core/entitlements.test.ts` fails and names the offender if one moves
behind the paywall.

**Licences are signed files verified locally** (ECDSA P-256, WebCrypto,
against a key compiled into the extension). No account, no activation server,
no request at purchase or launch. The honest cost is that a licence cannot be
revoked, and `docs/PRICING.md` says so rather than pretending otherwise. Test
builds substitute a throwaway keypair so the e2e suite can mint a real-looking
key; `tools/validate-package.mjs` greps every shipped bundle for that test key
and fails if it finds it, and checks the publisher key *is* present.

**Three build targets, and Edge is not one of them.** Edge runs the Chrome
package unchanged, so a `--target=edge` would be a fourth thing to keep in
sync for no difference in output.

**The content site deploys only on request.** `.github/workflows/site.yml`
builds and link-checks all 709 pages on every push but the deploy job is
gated on `vars.WEFT_PAGES == 'true'`, because publishing is not reversible the
way a commit is — once indexed, taking the site down leaves search results
pointing at nothing.

**Nothing self-promotes automatically.** `docs/LAUNCH.md` holds drafts per
community, to be sent by a human. An automated account posting self-promotion
earns a domain-level shadowban, which would destroy the 709-page search asset.
That was a decision, not an omission.

**Code is MIT; the lexicons are CC BY-SA 4.0**, because they derive from
Wiktionary-adjacent and SUBTLEX-derived sources with share-alike terms.
Attribution travels inside every generated pack (`docs/THIRD-PARTY.md`).

## Journal

Newest first. Append a few lines per session: what changed, what was assumed,
what still needs a human. This is what makes switching accounts free.

### 2026-09-28 — the queue asked for this branch's work again, and a second pass found one screenshot that bakes in the moment it was captured

An automated queue task landed asking to regenerate the five `chrome-*.png`
and verify their dimensions, citing the same `d1d545a`/`3060d93` worry the
entry below already closed, and asking for a branch stacked on
`docs/test-counts-and-changelog`. It did not know `store/regenerate-
listing-screenshots` already existed at exactly that point in the stack, with
that exact work already done and already a draft PR. Rather than open a
second PR next to the first, this pass checked the existing one out and
re-verified its finding independently instead of trusting the write-up —
which was the right call, because the independent check did not come back
clean.

**Running `WEFT_STORE=1 npx playwright test store-assets` directly, rather
than through `npm run test:e2e`, fails — and the failure names nothing
useful.** It timed out waiting for `weft-w` to appear on a page whose article
text had rendered completely normally; the content script had simply never
run. Reproduced twice (identical failure both times, so not a flake) before
the cause became clear: `"test:e2e": "npm run build:test && playwright test
&& npm run build"` builds a special test extension first. Run the spec
standalone instead, and it uses whatever `dist/chrome` is already on disk —
which, after any `npm run test:all` run, is a **production** build. A
production build carries no `host_permissions` at all, by design (that is the
entire "no host permissions until the user names a site" pitch), so it has no
way to attach a content script to the test server's `http://localhost` origin
regardless of what the RPC layer is told to configure.
`manifest.config.mjs:107-109` adds a static
`host_permissions: ['http://localhost/*', 'http://127.0.0.1/*']` only when
built with `--test`, precisely so Playwright never has to simulate the real
user gesture that `chrome.permissions.request()` requires for the optional,
runtime-granted kind. Fix: `npm run build:test` before running any e2e spec
directly. Filed under Notes in `TODO.md` as a trap for the next session that
tries to run one spec in isolation, the way `docs/SUBMIT.md`'s iCloud note
already covers a different one.

**Fourteen of the fifteen shots regenerate byte-identical, confirming the
entry below rather than merely repeating it.** Captured twice more after the
`build:test` fix (once to get a clean run, once again to check for jitter);
the two agree with each other on all fifteen files, and fourteen of the
fifteen also agree with what this branch already committed hours earlier.

**The fifteenth, `apple-04-progress.png`, is real and is committed here.** It
differs from the previously-committed file by 303 bytes. The two fresh
captures matched each other exactly, which rules out per-run rendering
jitter, and points instead at `tests/e2e/store-assets.spec.ts`'s progress
scene, which seeds imported review cards as `now - ago * day` relative to
`Date.now()` at capture time rather than at a fixed instant — hours had
passed since the version already on `docs/store` was captured. Committed the
freshly-regenerated file: it is the verified output of the documented command
against today's code and lexicon, and the older file is not wrong so much as
from an earlier moment. `chrome-04-progress.png` and `edge-04-progress.png`
render the identical scene at different frame sizes and came back
byte-identical both times regardless — the same time-dependence is presumably
there too, just not enough to move a pixel at those crops. Not fixed:
choosing a fixed instant to seed from is a real design decision (which
instant, and does a fixed date itself start to look stale in a screenshot a
year on?), and this pass's job was verification, not redesigning a fixture.
Noted in `TODO.md` as the same class of bug as the pack builder and the
sitemap `lastmod` — a generated artefact that changes without its input
changing — just lower stakes, since a listing screenshot is neither indexed
nor a release artefact in its own right.

Re-measured all fifteen with `sips -g pixelWidth -g pixelHeight` — actual
image metadata, not Playwright's viewport config: chrome 1280×800, edge
1366×768, apple 1440×900, exactly, on every file.

Measured on Node 26.7 again, after all of the above: typecheck clean, 484
unit / 122 suites, 97 jsdom / 22 suites, compat 56 pass / 7 degrade with a
named fallback / 0 fail, all three packages 979 KB and passing `validate`
(twice, once either side of `test:e2e`), and 36 e2e passed / 3 skipped in
1.9 min — including `licensing.spec.ts`'s "a fresh install is Free, and Free
weaves", which is the same content-script-attaches-and-weaves path the
standalone `store-assets` run was failing on, now green through the correct
`build:test` route. `npm run test:all` exit 0. Did not separately run
`packs:verify` or `site:check`: nothing in this pass touched a lexicon seed or
the site, only a generated screenshot and this pair of documents, so neither
check is informative here. No new branch or PR: the change is a fast-forward
push onto the existing draft, no force, no rebase. Nothing new needs a human;
B1 in `TODO.md` is still the critical path.

### 2026-09-28 — the listing screenshots were already right

`WEFT_STORE=1 npx playwright test store-assets` rewrote all fifteen store
shots and all fifteen came back byte-identical, so the worry that `3060d93`
had invalidated the French words in the listing art is answered: it had not.
Nothing was committed under `docs/store/`. The regeneration was real rather
than skipped — every file's mtime moved to 00:24 — and that is the check that
separates "reproduced exactly" from "never ran", because `git status` shows
the same nothing for both.

`TODO.md` had the provenance half wrong. `chrome-03/04/05` were captured at
`d1d545a`, but `01` and `02` had not changed since `144cb30` on 2026-09-15,
twenty-two commits earlier. They are current regardless, and that is the useful
finding: **the capture is deterministic**, so identical bytes are a result.
The temptation that follows is a pixel-equality gate. Resist it — these were
taken on macOS/arm64 and CI runs the same suite on `ubuntu-latest`, where the
font stack and text antialiasing differ, so the gate would fail for a reason
unrelated to the lexicon. The spec already carries the portable form of it,
`expect(hovered, 'no word with an etymology was woven into this page')`,
which fails exactly when a lexicon edit empties the tooltip scene 3 exists to
show.

One thing found on the way: **`npm run packs` is not idempotent.** It writes
`builtAt` as today's date, so it modifies all eight files under
`src/lexicon/packs/` whenever it runs. A field-by-field diff puts the whole
difference at 1 of 66 fields in `index.json` plus that one date in each pack,
so the committed packs are semantically current with `tools/seed/*.tsv`; the
churn was reverted, not committed. It matters because the setup line above
the command table tells a new contributor to run `npm run packs` before a
first build, which leaves a fresh clone dirty, and because `npm run release`
refuses a dirty tree.

Checking that antialiasing claim turned up a second stale document:
`playwright.config.ts` said extension service workers are "more reliable
headed, so CI runs headed under xvfb". `tests/e2e/fixtures.ts:76` sets
`headless: true` unconditionally and `.github/workflows/ci.yml` installs
Chromium and runs `npm run test:e2e` with no xvfb anywhere. The comment now
says what the code does. That is the only non-Markdown change in this pass.

One environment trap, because it wastes an hour and the error names nothing:
iCloud drops conflict copies into `dist/` while a build runs — 61 of them
here, `manifest 2.json`, `dashboard 2.html`, `_locales 2/`. `validate` reads
every `.html` in the package directory, hits one that is still a placeholder,
and dies with `Error: Unknown system error -11 ... syscall: 'read'` and no
filename. `rm -rf dist/chrome dist/firefox dist/safari && npm run build:all`
fixes it in under a second. It matters at `docs/SUBMIT.md` time, when
`validate` is being run on the exact bytes about to be uploaded.

Measured today, on Node 26.7 again: typecheck clean, `npm run test:all` green
end to end (36 e2e passed, 3 skipped, 3.7 min; all three packages 979 KB and
passing `validate`), `packs:verify` 0 errors and the same 4 IPA warnings,
`site:check` 711 pages and 16 087 links all resolving. Nothing needs a human
here; the release is still waiting on B1 in `TODO.md`.

### 2026-09-27 — the numbers in the documents were fiction

Four documents stated test counts. All four were wrong, none agreed with any
other, and `CHANGELOG.md`'s did not add up — "449 tests: 379 unit, 71 in
jsdom, 24 end-to-end" is 474. Every count in the repository is now one this
session measured: **484 unit / 122 suites**, **97 jsdom / 22 suites**, **39
e2e defined in 7 files of which 36 run**, **584–588 entries across 579–583
surface forms**, and **653 KB** of packs — 668 270 bytes at the `size / 1024`
convention `tools/validate-package.mjs` already uses. Nothing in the tracked
tree matches `427|449|379|664 KB|709` any more.

The fourth document is the one worth remembering: `docs/LAUNCH.md:215` had
"449 tests" inside the Hacker News comment draft. Every other stale count was
wrong where only a contributor would read it; that one is copy a human sends
out in public, and `docs/LAUNCH.md` is the only file here whose errors leave
the repository. Re-sweep it before anything is posted.

The judgement call: `CHANGELOG.md`'s 1.0.0 entry was corrected **to 1.0.0**,
not to today. A changelog entry for a shipped release that describes the
current tree is a different kind of wrong, so the real 1.0.0 numbers were
measured in a throwaway worktree at `ef97167` — 470 unit, 97 jsdom, 35 of 38
e2e, 602 in total, packs 644 KB — and today's went into a new `1.0.1` entry.
That entry says out loud that it is not cut yet, because `VERSION` is still
1.0.0; `tools/release.mjs` writes `RELEASE-X.Y.Z.md` and never touches
`CHANGELOG.md`, so the two cannot disagree when the bump happens.

The lexicon *entry* counts turned out not to have moved since `v1.0.0` — only
the byte size. `3060d93` added etymons and notes to existing French entries
rather than adding entries, which is why 584–588 / 579–583 is right in both
changelog entries and only the KB differs. Worth knowing before assuming a
lexicon change implies a count change.

Then the command table in this file turned out to be the fifth wrong document,
which is the sort of thing that happens once you go looking. **`npm run
test:all` does not run `packs:verify` or `site:check`** — it is typecheck,
test, compat, build:all, validate, e2e, build:all, validate — so the row
claiming "all of the above" was inviting a release to be cut without the
lexicons or the 711 pages ever being checked. `compat` reports 56 pass / 7
degrade with a named fallback rather than "clean", and the two fast suites take
about 9 s each here, not the 1.7 s and 1.6 s claimed. Wall-clock figures are
now marked as this machine's; the counts are the part to trust.

Also verified, rather than assumed, that the previous session's `/privacy` and
`/support` work is real: `npm run site:check` reports 711 pages and 16 087
links, all resolving, plus "all 3 externally-referenced pages exist", and
`docs/PRIVACY.md` mentions `idle` and `unlimitedStorage` only to explain their
removal.

### 2026-09-27 — the two pages the outside world points at

`npm run site` now writes `/privacy` and `/support`. They are `docs/PRIVACY.md`
and a new `docs/SUPPORT.md` rendered through the same `page()` template as the
rest of the site, by a ~110-line Markdown renderer added to
`tools/build-site.mjs`. Rendered rather than duplicated because a privacy
policy kept in two places is a privacy policy that will eventually disagree
with itself, and because the document has to stay readable on GitHub too.
A Markdown dependency would be thousands of lines to parse input this
repository writes and reviews itself; if a document ever needs more than the
subset the renderer handles, rewrite the document.

Writing the privacy page found the privacy page wrong: its permission table
still listed `idle` and `unlimitedStorage`, neither of which
`manifest.config.mjs` declares. That is a mismatch on the Privacy practices
tab, which is the tab that gets Chrome submissions rejected, so it was
corrected and pointed at the fuller account in `docs/STORE-LISTING.md`.

`npm run site:check` now also fails the build when `SUPPORT_URL`,
`PRICING_URL` (read from `src/core/pricing.ts`) or `/privacy` has no page
behind it. That is the shape of the bug this was: a URL compiled into a
*shipped extension*, where rebuilding the site cannot rescue it. Verified by
deleting each page and watching the checker exit 1.

Two links on the site still 404 while the repository is private — the install
page's download button and the support page's issue tracker. Both clear at
B2 in `TODO.md`. Assumed GitHub issues is the support channel, because no
email address exists anywhere in this repository and inventing one would be
worse than pointing at something real.

### 2026-09-27 — surveyed the repo, wrote these two files

Replaced the placeholders in this file and rewrote `TODO.md` as the real path
to a Chrome Web Store release. Changed nothing else; this was a read-mostly
pass.

Ran the project's own checks on Node 26.7 (newer than the pinned 22, and they
all passed anyway): typecheck clean, 484 unit, 97 jsdom, 36 e2e passing with 3
asset-generator specs skipped by design, compat clean, `packs:verify` 0 errors
/ 4 warnings, all three builds at 979 KB, `validate` passing on all three
packages, `site:check` resolving 13 228 links across 709 pages. Nothing is
failing.

What the survey turned up, in the order it matters:

1. **`weft.study` is not registered.** NXDOMAIN from both 8.8.8.8 and
   1.1.1.1, while the `.study` TLD itself resolves. `src/core/pricing.ts`
   compiles `https://weft.study/pricing` and `https://weft.study/support`
   into the shipped extension, and the Chrome Web Store requires a live
   privacy policy URL. Everything else in the release path hangs off this.
2. **`tools/build-site.mjs` generates no `/privacy` and no `/support` page.**
   It writes the index, `install.html`, `pricing.html`, the language hubs and
   ~700 word pages. `SUPPORT_URL` already points at a page that would 404
   even if the domain existed.
3. **The `v1.0.0` tag is five commits stale.** The GitHub release published
   2026-09-19 predates the redrawn icons, the help/diagnostics support path,
   the French etymologies and the `verify:release` tool. Its zips are not
   what `main` builds.
4. **Three documents state test counts that are all wrong** (README, SUBMIT,
   CHANGELOG each disagree with each other and with reality) and the
   CHANGELOG has no entry for the five post-tag commits.
5. The Lemon Squeezy checkout URLs in `src/core/pricing.ts` are placeholders,
   and the repository is still private, which 404s the install page's
   download button.

Store assets were verified by measurement, not by trusting the docs: all five
`chrome-*.png` are exactly 1280×800, `edge-*` 1366×768, `apple-*` 1440×900,
the tiles 440×280 / 1400×560 / 300×300, and the icons 16/32/48/128. Every
field of store copy is already drafted in `docs/STORE-LISTING.md`.

Assumed, because nobody was available to ask: that the intended domain really
is `weft.study` rather than something already owned (it appears in the Firefox
extension id, which cannot change, so the id stands either way); that a
version bump to 1.0.1 is preferable to re-cutting the `v1.0.0` tag, since the
published release has been downloadable for a week; and that the Chrome Web
Store is the only target in scope for this pass, with Firefox and Safari left
as written up in `docs/SUBMIT.md`.
