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

**What "done" looks like:** the code is done and, as of 2026-09-29, so is the
version. `VERSION` is **1.0.1**, `RELEASE-1.0.1.md` is written and the six
packages build; the whole documentation stack that used to sit unmerged is on
`main`. The `v1.0.1` **tag is deliberately not pushed** — that fires
`.github/workflows/release.yml` and publishes outward, and it waits on the
repository becoming public (**B2** in `TODO.md`), because a release whose
download button 404s is worse than no release. "Done" now means *released* —
a Chrome Web Store listing that a stranger can install from. That is a
submission Creagh performs by hand with her own developer account, so this
repository's job is to be release-ready and to keep the remaining human steps
written down. Every one of those steps now needs her: `TODO.md` is that list,
headed by **B1**, registering `weft.study`. `docs/SUBMIT.md` is the long-form
runbook and `docs/STORE-LISTING.md` holds every field's copy.

## How to work here

Node 22 (`.nvmrc`; `engines.node >= 20`; CI pins 22). `npm ci`, then
`npm run packs` if you have touched `tools/seed/*.tsv` — the lexicon packs in
`src/lexicon/packs/` are generated from those and committed, so a fresh clone
already has them. Running it anyway is a no-op: since 2026-09-28 it keeps each
pack's `builtAt` when nothing else about that pack has changed, so it no longer
leaves a clean tree dirty.

The commands that matter, with what each actually produced on 2026-09-27:

| Command | What it does | Last measured result |
|---|---|---|
| `npm run typecheck` | `tsc --noEmit` | clean |
| `npm run test:unit` | pure-core tests, no browser | **527 pass**, 130 suites, ~9 s wall clock here (no browser; the figure moves with the machine, the counts do not) |
| `npm run test:dom` | jsdom tests | **98 pass**, 22 suites, ~9 s wall clock here |
| `npm run test:tools` | the generators that produce shipped artefacts, run against a temp directory | **73 pass**, 21 suites, ~5 s here |
| `npm run test:e2e` | real Chromium, extension loaded | **36 pass, 3 skipped**, 3.0 min here |
| `npm run compat` | every API used, checked against MDN compat data | 21 dependencies × 3 browsers = 63 checks: **56 pass, 7 degrade with a named fallback, 0 fail, 0 without data** |
| `npm run packs:verify` | sanity-check the lexicons | 0 errors, 4 warnings (missing IPA on 4 Old English interjections) |
| `npm run build:all` | chrome + firefox + safari | 983 KB unpacked per target |
| `npm run validate` | pre-flight the built packages against store rules | all 3 pass |
| `npm run site:check` | link-check the generated site | 711 pages, 16 087 links, all resolve; also fails if `/privacy`, `/support` or `/pricing` is missing |
| `npm run artefacts:check` | which committed generated files the tree has moved past | 4 groups; on 2026-09-29 (latest) **1 stale, 3 fresh** — the one is the release notes, which is B2a and cannot be fresh before the tag. Mark a group verified with `npm run artefacts:verify -- "<name>"` **after actually regenerating and reading it** |
| `npm run test:all` | typecheck, unit, jsdom, tools, compat, build:all, validate, e2e, then build:all and validate again | the gate before any release — but **not** `packs:verify`, `site:check` or `artefacts:check`, which have to be run separately |

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

**Generated files record when their content was built, not when the build
ran.** `tools/build-pack.mjs` keeps the `builtAt` a pack already carries when
everything else about that pack is byte-identical, and only stamps today when
the content genuinely changed. Do not simplify that back to
`new Date()`: it made all eight files under `src/lexicon/packs/` change on
every `npm run packs`, which left a fresh clone dirty and `npm run release`
— which refuses a dirty tree — refusing. Reproducibility is also what the
`Committed packs match the seed lexicons` step in CI rests on; that step
rebuilds the packs and diffs them, and is the only thing that catches a
`tools/seed/*.tsv` edit nobody rebuilt. `tests/tools/build-pack.test.ts`
fails if the stamp starts tracking the wall clock again.

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

### 2026-09-30 — the item named one stale shot among five orphans; three of them were stale

The queue sent this session at the two clipped listing screenshots again —
the same text, verbatim, that PR #32 landed and PR #33 extended. Done twice
over: `store-assets.spec.ts` calls `frameOn` at `:263` and `:271`, the only
`scrollIntoViewIfNeeded` left in it is scene 3's word-level call that is
deliberately untouched, and `tests/tools/shot-framing.test.ts` has been
policing the rule since `20acde9`, **HEAD**. Eleventh completed item the
queue has handed over in thirteen sessions; a minute of `grep` settled it.

So the work was `TODO.md`'s one remaining unchecked item, **five files inside
`docs/screens/` that no generator writes**. The premise was exact and the
staleness was three times what it recorded.

**The census is derivable, and deriving it is what made it exact.** Reading
`screenshots.spec.ts` for single-quoted `*.png` literals returns **14**
names; `git ls-files docs/screens` returns **19**; and the set difference is
**zero in the other direction** — every derived name has a committed file. So
the two sets line up exactly and the five offenders are precisely the ones
the item named, rather than a superset a looser match would have produced.
All five are captures of the **content site**, which no spec can make because
nothing serves `dist/site`, and `git grep` finds no document or page
referencing any of them.

**Reading all five found two more stale shots than the item knew about, and
each is a copy fix a previous session spent a whole PR making.** The item had
`landing.png`: "48% — 1 word in 2", the unqualified phrasing **PR #8**
replaced with "of content words", at a density the demo can no longer reach
since #8 turned its ceiling to 35% — and its caption predates #8 too, naming
no preset. Opening the rest added `word-latin.png`, which renders
`/latin/vacca` as "This is the Latin word your English borrowed from
**vaccine**" — the **backwards descent sentence PR #17 fixed on 312 published
pages**; and `hub-descent.png`, whose note column reads `"gangende" survives
in "gangway"` in straight quotes, which **PR #20** unified to curly across all
59 Latin and Old English notes. Verified against the seed rather than
remembered: `lex-ang.tsv:263` now carries the curly form.

**A fourth staleness in the same shot was chased down rather than assumed,
and it is the one that could have been a live defect.** `word-latin.png`'s
"Other Latin nouns" list renders `miles` bare where `rēx`, `rēgīna`,
`vīcīnus` and `dēns` beside it all carry macrons — and
`tools/build-site.mjs:358` renders that list from `e.tgt`, the inflected
*surface form*, not from `tgtLemma`, so a surface form missing a macron
would be published on every Latin word page. It is not: `git log -L` on the
seed row shows `mīles` has carried its macron since `89cdfda`, the original
lexicon commit, and the built pack has `"tgt": "mīles"` today. So the shot
was rendered by a site builder old enough to predate that, and the product
has been right throughout. Recorded so nobody re-opens it: **a stale
screenshot showing a defect is not evidence the defect exists**, and the
cheap way to tell is `git log -L` on the seed row rather than reading the
renderer.

`word-page.png` and `pricing.png` read current — the Old English descent
sentence was never backwards, and the three prices still match
`src/core/pricing.ts`.

**Three of five, and that is the argument for the shape taken.** Shape 1,
delete them. `TODO.md` had recorded that preference and also recorded that a
deletion of committed files "wants a human's assent rather than an agent's";
the run's own instructions say to assume the answer is yes and record it, so
that is what happened, with the restore command written into `TODO.md` beside
the item. The grounds got stronger between the queuing and the doing: an
unreferenced screenshot is merely unread, but an unreferenced screenshot
displaying copy the product deliberately removed is a liability. Shape 3, a
site-screenshot generator, was refused on cost against value — it needs
`dist/site` built and served, and it would be new machinery maintained for
five binaries no reader has.

**The pathspec stays `docs/screens`, and that is the opposite of the call PR
#30 made for `docs/firstrun`.** The reason is that the two cases differ:
`docs/firstrun` and `docs/store` legitimately contain hand-made files that
must stay — the icon sheet, the tiles — so a glob has something to exclude.
Once the five are gone `docs/screens` has nothing to exclude, and no glob
could pick out the fourteen anyway, since they share no prefix. **A whole-
directory pathspec is the accurate declaration exactly when every file in the
directory is generated, and what keeps that true is a test rather than a
pattern.**

**So PR #30's guard is generalised to all three groups, which is what
`TODO.md` asked for and what the guard's own comment said could not be
done.** That comment was right about the obstacle and wrong about it being
fatal: `store-assets.spec.ts` composes `${frame}-${slug}.png` from a frame
table and the slug it is called with, so none of its fifteen names exists in
the file as a whole string — but multiplying the frames by the slugs, both
read out of the spec by regex, reconstructs all fifteen. Two derivations
rather than one hand-typed list, because the three specs name files two ways.
Single quotes rather than any quote, because this repository writes filenames
in prose inside backticks and **a comment naming a file is not a generator
writing it**. This is the fourth sighting in four sessions of the same shape:
a guard whose coverage was hand-picked, policing the file somebody remembered.

Done test-first: red on `docs/screens/hub-descent.png is inside the artefact
pathspec but tests/e2e/screenshots.spec.ts does not write it` before anything
was deleted. 71 → **73** tools tests, 21 suites unchanged — one hand-picked
test replaced by three derived ones.

**Three vacuity probes, each shown to fire rather than assumed, and the
middle one is the one that mattered.** A hand-made file copied into
`docs/screens` and staged names itself. A pathspec typo'd to
`docs/screens-typo` hits the `matches nothing` floor. And **breaking the
composed derivation turns the *store* group red**, naming
`docs/store/apple-01-woven.png` — which is what proves the store test was not
passing vacuously on an empty derived set, the exact silent skip a derived
list invites. Each probe was undone by copying a backup back and checking
md5, not by asking git.

**The verify stamp for this group was deleted rather than rewritten.** Its
note read "no change to commit" and this commit changes the group's file set,
so `artefacts:check` dates the group from this commit on its own. Same call
PRs #30, #31 and #32 each made, and the one thing the stamp must never mean.
The store and first-run stamps are untouched and still true — nothing here
moves a byte in either group.

Counts moved 732 → **734** and tools 71 → **73** in six documents, with
`docs/LAUNCH.md:221` swept **by name and first** for the twelfth session
running. Unit, jsdom and e2e did not move, and `src/` was not touched at all,
so sizes could not.

Measured at the end, on Node 26.7, on the final tree, with npm's own exit
status captured rather than a pipe's: `npm run test:all` **exit 0** —
typecheck clean, 527 unit / 130 suites, 98 jsdom / 22 suites, **73 tools / 21
suites**, compat 21 dependencies × 3 browsers, 56 pass / 7 degrade / 0 fail /
0 without data, **983 KB × 3** passing `validate` (unchanged, and it has to
be — nothing here touches shipped code), **36 e2e passed and 3 skipped in
2.5 min**, then build and validate again. `packs:verify` and `site:check`
were **not** re-run, for the reason this file already states: no pack moved,
no seed moved, and `src/` was not touched. `artefacts:check` reports the same
1 stale group — the release notes, B2a, whose `inputs` are `.` — with all
three screenshot groups `ok`. No generator was run at all this session, which
is itself the point: the five files were unreachable by any of them. Zero
iCloud conflict copies in `dist/`, `src/` or `test-results/`, the xattr
working for the eighth session running — re-set on `test-results/` again.

What needs a human: unchanged, still everything below **B1**, register
`weft.study`. `TODO.md`'s `Now` and `Next` are both **empty** and there is no
agent-shaped work left in the file. One thing a human may want to look at
rather than do: this session deleted five committed binaries, which is the
only removal in this repository nobody asked for in person. The restore
command is written into `TODO.md` beside the item, and the guard will name
any file put back until either a generator writes it or the pathspec says it
is hand-made.

### 2026-09-29 — the fix was one-sided across files, and the guard was hand-picking the file

The queue sent this session at the two clipped listing screenshots. That is
`b5f0686`, **HEAD**, merged as PR #32 the same day: `frameOn` replaces both
`scrollIntoViewIfNeeded` calls, `artefacts:check` reports all three
screenshot groups `ok`, and `docs/STORE-LISTING.md:180` already says
"scrolled to the discoveries feed". Tenth completed item the queue has handed
over in twelve sessions. Verified by **opening all six scrolled captures**
rather than by trusting the commit subject — which is the only check that
can speak here, and the one that found the defect in the first place. All six
read clean: the 05 shots open on the Density title with the whole
`Taster Standard Committed Monastic` row intact, the 04 shots on "What you
have found out" with the 19-row feed in folded-alphabetical order, `père`
before `pierre`.

**So the work was the half of PR #32 that PR #32 could not see.**
`firstrun.spec.ts:107` had the identical `scrollIntoViewIfNeeded()` call on
the identical kind of selector, `.section:has(.help__report)`, and it was
never touched — PR #30 *added* that line two commits before PR #32 proved the
call unsafe. `screenshots.spec.ts` does no scrolling at all, which was
checked rather than assumed.

**Its shot happens to land correctly at 1000x900, and that is the trap
rather than a reprieve.** The four clipped store captures were byte-stable
too; `artefacts:check` called that group `ok`, and two consecutive
regenerations agreed with themselves, for the whole month they were wrong.
A call whose correctness is a coincidence of the viewport height — Blink
picks the landing point from the element's position and the frame height, so
the *sign* of the error is not a property of the call — is one options-page
edit away from being silently wrong in documentation a stranger reads.

**The reason it was missed is the guard, not the reviewer, and that is the
transferable half.** `tests/tools/store-assets.test.ts` already derives its
selector list from the spec rather than typing it out, and says why in as
many words: "a hand-written list of the things to check cannot police the
thing that was forgotten." But the *file* it reads is hand-picked. The
derivation was **within-file**, and the thing forgotten was a different
file — the same lesson one level up. Third sighting of this shape in three
sessions, after PR #31's mislabelled `oe.close()` and PR #30's pathspec
claiming a whole directory was generated.

So `frameOn` moved to `tests/e2e/fixtures.ts` and is exported: one
implementation, so the two-sided assertion cannot be present in one generator
and absent in another. The two-sidedness test moved out of
`store-assets.test.ts` rather than being duplicated there. The new guard,
`tests/tools/shot-framing.test.ts`, **derives the spec list too** — from the
one thing every generator has and no other e2e spec does, `const OUT = … '../../docs/…'`.
A fourth generator is covered without an edit. It is a fourth `tests/tools/`
suite rather than a third `describe` in `store-assets.test.ts`, on the seam
argument this file already uses for `build-site.test.ts`: the rule is not a
property of the store listing, and a file named for one spec policing three
is how the blind spot got built.

The rule is "framed by `frameOn` and nothing else" rather than "not
`scrollIntoViewIfNeeded`": naming the one mechanism already known to have
gone wrong is the same one-sidedness one more level down, and would leave
`scrollIntoView({ block: 'start' })` and a raw `scrollTo` silently skipped.
Proved by injecting exactly that and watching the guard fire.

**Zero committed bytes changed, measured rather than assumed.**
`scrollIntoViewIfNeeded` happened to land exactly where `frameOn` computes.
All three groups were regenerated **twice each**, with npm's own exit status
captured per run and the mtimes checked every time: **45 files** — 8
first-run, 18 store, 19 screens — byte-identical run to run *and* to what was
committed. The store set is the free control: relocating `frameOn` was shown
not to move a byte rather than argued to be safe.

**The runtime assertion was proved live in the new spec, not merely
satisfied**, which is the difference between "the generator passed" and "the
generator would have caught it". Injecting a 40px mis-landing makes it fail
with `.section:has(.help__report) sits 40px below the top of the viewport`
and write nothing. The three static guards were each shown to fail too:
reverting the fix names the selector, dropping the lower bound names the
`edge-05` class, and renaming `OUT` makes the store-assets test **vanish
from the run entirely** — caught only by the non-vacuity floor, which is
exactly the silent skip a derived list invites. Probed by copying backups
back and checking md5, not by asking git.

**All three verify stamps were written this time rather than deleted, and
the distinction is the whole point of the stamp.** Its note reads "no change
to commit"; PRs #30, #31 and #32 each changed real content, so for them it
would have been false and each correctly deleted it. Here nothing changed and
it is true. `artefacts:check` stays at 1 stale — the release notes, B2a,
whose `inputs` are `.` — with all three screenshot groups `ok`. Note for the
next session: all three groups declare `tests/e2e/fixtures.ts` as an input, so
**any** edit to the fixtures stales all three at once.

**Verifying the third group found the next defect, and mtimes are what
found it.** `documentation screenshots` declares `paths: ['docs/screens']`,
a whole directory — the exact shape PR #30 found wrong for `docs/firstrun`
and narrowed, with the precedent sitting one group above it in
`tools/artefacts.ts`. `screenshots.spec.ts` writes **14** of the 19; the
other five are captures of the **content site**, which no spec can produce
because nothing serves `dist/site`. All five were last committed 2026-09-15
and none is referenced anywhere. **`landing.png` reads "48% — 1 word in 2"**
— the unqualified phrasing PR #8 replaced everywhere, at a reading the demo
can no longer produce, since PR #8 turned its ceiling down to 35%. So it
shows a number nobody gets, which is the thing PR #8 existed to remove.
Queued rather than fixed: the honest options include deleting five
unreferenced committed binaries, which wants a human's assent. `git status`
could not have found this and neither could `artefacts:check`, which asks
provenance rather than content; **comparing mtimes after a regeneration is
what separates "reproduced exactly" from "never written"**, and this file
already records that the two look identical from outside.

One process note worth keeping: a probe run exited 1 with
`Unknown system error -11 … scandir 'test-results/.playwright-artifacts-0'`
— the iCloud trap, not the assertion — and was nearly read as the guard
firing. **A generator's exit 1 has to be read before it is believed, in both
directions**, the mirror of this file's existing note that exit 0 with no
changed file is indistinguishable from a run that died early.

Counts moved 727 → **732** and tools 66 → **71** / 19 → **21 suites** in six
documents, with `docs/LAUNCH.md:221` swept **by name and first** for the
eleventh session running. Worth naming: **`README.md:267` was two sessions
stale at `64`** — PR #32 moved tools 64 → 66 across "five documents" and
missed it, the same class as the CLAUDE.md command table PR #32 itself caught
at 63. Unit, jsdom and e2e did not move, `src/` was not touched at all, so
sizes could not.

Measured at the end, on Node 26.7, on the final tree, with npm's own exit
status captured rather than a pipe's: `npm run test:all` **exit 0** —
typecheck clean, 527 unit / 130 suites, 98 jsdom / 22 suites, **71 tools / 21
suites**, compat 21 dependencies x 3 browsers, 56 pass / 7 degrade / 0 fail /
0 without data, **983 KB x 3** passing `validate` (unchanged, and it has to
be — nothing here touches shipped code), **36 e2e passed and 3 skipped in
2.0 min**, then build and validate again. `packs:verify` and `site:check`
were **not** re-run, for the reason this file already states: no pack moved,
no seed moved, and `src/` was not touched. The three generators were run
**nine** times across the session in total, each with its exit status
captured and its hashes diffed before anything was believed. Zero iCloud
conflict copies in `dist/`, `src/` or `test-results/`, the xattr working for
the seventh session running — re-set on `test-results/` again, which does not
survive being deleted.

What needs a human: unchanged, still everything below **B1**, register
`weft.study`. `TODO.md`'s `Now` and `Next` are both **empty** and there is no
agent-shaped work left in the file.

### 2026-09-29 — the item named two clipped shots; it was four, and two failed the other way

The queue sent this session at `TODO.md`'s only unchecked item, the two
listing screenshots that clip a row at the top edge. **The premise was true
and the census was half of it.** `apple-04-progress.png` really does cut the
tops off all four progress tiles' digits and `apple-05-settings.png` really
does halve the preset row, exactly as described. Opening the other four found
two more — and neither is the defect the item diagnosed.
`chrome-05-settings.png` sliced the "Resting density" heading through the
middle, and `edge-05-settings.png` lost it altogether, opening mid-sentence
on "What a page looks like the moment you arrive". That is not the row above
bleeding in. It is the scene cutting the head off the row it exists to show,
which is the worse of the two and the one a reviewer reads as a broken upload.
Four of six, and the errors point in opposite directions.

**So the mechanism is not "the scroll is minimal".** It is that
`scrollIntoViewIfNeeded` states no alignment at all: Blink picks one from the
element's position and the viewport height, so the landing point was a
function of the frame size and the *sign* of the error was not a property of
the call. The 04 scene erred only at 900 px; the 05 scene erred in all three
frames, both ways. **The transferable half: a "make it visible" call is not a
framing operation, and a fix derived only from the cases somebody happened to
open comes out one-sided.** A guard asserting just "nothing above the target
is in shot" passes `edge-05`, the worst of the four. Same class as PR #31's
mislabelled `oe.close()` message one step earlier — there the guard named the
wrong variable, here the item named the wrong half of the census.

`frameOn(page, selector)` replaces both calls. It puts the section's own top
edge at the top of the shot with an integer `window.scrollTo` and then
**asserts two-sidedly** that it landed there, so the generator fails rather
than writing a clipped shot. Integer because a fractional scroll offset
shifts subpixel text rendering in files diffed byte for byte; `Math.ceil`
rather than `Math.round` so the rounding error is spent on the section's own
top padding rather than on a sliver of the row above. Scene 3's word-level
`scrollIntoViewIfNeeded()` is deliberately untouched: it makes a word
hoverable rather than framing a shot, and a partly visible line of prose at
the top of an article screenshot is what reading an article looks like.

**The result is better than "not clipped", and the reason is a DOM fact worth
knowing: `.section:has(.band)` is the whole Density section, not one row.**
All three 05 shots now open on its title — "Density / How much of a page is
woven, and how fast that rises while you stay on it" — followed by the
complete `Taster Standard Committed Monastic` preset row, which no committed
shot had ever shown intact. All three 04 shots open on "What you have found
out" with the whole 19-row feed. Each scene is one composition in all three
frames now, differing only in how much fits below the fold.
`docs/STORE-LISTING.md` records the framing rule beside the table a human
uploads from.

**Measured: all 15 files byte-identical across two consecutive runs**, hashed,
with npm's exit status captured per run and all 15 mtimes checked each time —
a generator that dies early writes nothing, and this file already records
that "no file changed" is indistinguishable from a clean idempotent run from
outside. The nine unscrolled 01/02/03 captures came back byte-identical to
what was committed, which is a free control: the change is confined to the two
framed scenes. All six changed files were opened and read.

**One consequence measured rather than reasoned: the seeded attention no
longer affects a single committed byte.** Aligning scene 4 on the feed scrolls
the tile row out of every frame, so `SEEDED_ATTENTION_SECONDS` and the four
tests guarding it now defend a property of the seeding rather than a shipped
pixel — proved by generating at 60 s instead of 1800 s and finding all fifteen
hashes unmoved. **Kept rather than deleted**, with the spec and
`tests/tools/store-assets.test.ts` both saying plainly that it is insurance
now: the drift returns the moment anyone reframes the scene to include the
tiles, and that is a reasonable thing to want, since those four tiles are the
only place scene 4 shows a number. Deleting a reproducibility seed because
the current crop happens to hide it is how a session pays twice for the same
finding.

Done test-first: 2 tests in a new `describe`, red on `'.section:has(.finds)'
is scrolled into shot by something other than frameOn()` before anything was
edited. The selector list is **derived** from the spec rather than typed out,
so a fourth framed scene is covered without an edit there. All three guards
were shown to fail rather than assumed: reverting one call names that
selector, dropping the lower bound names the `edge-05` class by filename, and
renaming the selector literals fires the non-vacuity floor at "found 0 framed
sections". Probed by copying a backup file back and checking its md5
afterwards, not by asking git — the process note PR #31 paid for.

**The verify stamp was deleted rather than rewritten.** Its note read "no
change to commit", and this commit changes six of the fifteen files;
`artefacts:check` dates the group from this commit on its own. Same call PR
#30 and PR #31 each made for the group they genuinely changed, and the one
thing the stamp must never mean.

Counts moved 725 → **727** and tools 64 → **66** / 18 → **19 suites** in five
documents, with `docs/LAUNCH.md:221` swept **by name and first** for the tenth
session running. Worth naming: **this file's own command table was stale at
`63 pass, 18 suites`** — PR #31 moved tools 63 → 64 and swept its journal
line, `TODO.md`, `CHANGELOG.md` and `docs/SUBMIT.md`, but not the table eight
lines below the setup paragraph. Unit, jsdom and e2e did not move, and `src/`
was not touched at all, so sizes could not.

Measured at the end, on Node 26.7, on the final tree, with npm's own exit
status captured rather than a pipe's: `npm run test:all` **exit 0** —
typecheck clean, 527 unit / 130 suites, 98 jsdom / 22 suites, **66 tools / 19
suites**, compat 21 dependencies × 3 browsers, 56 pass / 7 degrade / 0 fail /
0 without data, **983 KB × 3** passing `validate` (unchanged, and it has to
be — nothing here touches shipped code), **36 e2e passed and 3 skipped in
2.0 min**, then build and validate again. `packs:verify` and `site:check` were
**not** re-run, for the reason this file already states: no pack moved, no
seed moved, and `src/` was not touched. `artefacts:check` reports the same 1
stale group — the release notes, B2a, whose `inputs` are `.` — with all three
screenshot groups `ok`. The store generator was run **four** times across the
session, each with its exit status captured and its hashes diffed before
anything was believed. Zero iCloud conflict copies in `dist/`, `src/` or
`test-results/`, the xattr working for the sixth session running — it had to
be re-set on `test-results/` again, which does not survive being deleted.

What needs a human: unchanged, still everything below **B1**, register
`weft.study`. `TODO.md`'s `Now` and `Next` are both **empty** and there is no
agent-shaped work left in the file.

### 2026-09-29 — the guard named two pages, mislabelled one, and could not see the third

The queue asked for `artefacts:check` to gain a verify stamp —
`docs/artefacts.json`, per group, so `docs/firstrun/` could stop reporting
stale forever, test-first, including a test that a stamp with no content
change flips a group from stale to fresh. **All of it exists**, two sessions
back in `e02b915`, and built better than asked: per-group
`docs/artefacts/<slug>.json` rather than one shared file, because a shared
file's `paths` entry is declared by every group and verifying one would have
silently freshened the rest. The test the queue specified is in the tree
verbatim — `a verify commit with no content change flips a stale artefact to
fresh` — and `artefacts:check` now reports `first-run walkthrough shots`
**ok**. Ninth of the last eleven sessions handed a completed item; a minute
of `grep` and one `artefacts:check` settled it.

So the work was `TODO.md`'s topmost unchecked item, **the onboarding preview
writing to the learner's real vocabulary**. It does not. It never did, and
the three shapes the item offered needed no choosing.

**The premise is refutable by reading two files.**
`src/ui/onboarding/preview.tsx` sends no message at all — `selectSwaps`
inside a `useMemo` against `cards: new Map()`, rendered into spans. The whole
onboarding page sends exactly two message types: `get-pack`, which
`src/background/index.ts:179` answers by `fetch`ing a JSON file off disk, and
`complete-onboarding`, which only `finish()` sends and which the screenshot
loop never reaches — it opens the page, waits 1200 ms, shoots and closes
without pressing anything. The page is structurally incapable of creating a
card.

**The real cause was a page the harness left open, and the evidence was
already in the file that got it wrong.** `screenshots.spec.ts` opens three
taxed pages on `${origin}/article.html`. `reader` and `oe` are closed before
the vocabulary reset; `wrapped`, opened for `page-tooltip.png`, never is — so
it kept weaving and reporting exposures through the reset and every shot after
it. A comment forty lines above the wrong one already lists six words read off
`article.html`, and **six of the seven residuals are exactly those six**. The
transferable form: when two comments in one file disagree about a cause,
prefer the one that names a mechanism over the one that names a culprit.

**The more useful finding is where the guard admitted its own gap.**
`tests/tools/screenshots.test.ts` had
`assert.notEqual(spec.indexOf('oe.close()'), -1, 'the wrapped-mode page is
never closed')` — but `oe` is the *Old English* page, and the wrapped-mode
page is the variable literally named `wrapped`, the one it had missed. **A
guard's mislabelled failure message is the fingerprint of the case that was
overlooked when it was written**, and it is cheaper to read than the code it
guards. Same class as PR #14's note guard skipping `novem` and PR #30's
pathspec claiming a whole directory was generated: a hand-typed list of the
things to check cannot police the thing that was forgotten.

**So the fix is the derivation, not the close.** The guard now finds every
`const X = await context.newPage()` whose block contains
``await X.goto(`${origin}`` and requires each closed before
`reset-vocabulary`, so a fourth page added later is covered for free.
Anchored on `.goto(` rather than on `${origin}` appearing in the block,
because the popup passes `${origin}/article.html` into an init script as a
stubbed tab URL while navigating to `popup.html` — a block-level match would
have called it taxed. A second test cross-counts the `${origin}` navigations
against what the derivation found, which is the failure the loop invites:
rename `context.newPage()` and it runs over an empty list and passes.
`chrome-extension://` pages are deliberately not matched — the content script
is registered per granted origin, so an extension surface cannot weave.

Done test-first: red on `` `wrapped` loads a taxed page over HTTP and is never
closed `` before anything was edited. Both guards were shown to fail rather
than assumed non-vacuous — removing the close names `wrapped`, renaming
`newPage` names the silent skip. 63 → 64 tools, 18 suites unchanged (one
hand-listed test replaced by two derived ones). One process note: a
`git checkout tests/e2e/screenshots.spec.ts` used to undo a vacuity probe
reverted the *whole* file including the fix; caught by `git diff --stat`
immediately after, and re-applied from the same deterministic script. Probe
by writing a backup and copying it back, not by asking git.

**`docs/screens/` regenerated, and the arithmetic is the receipt rather than
the hashes.** Six shots changed, all six opened and read.
`dashboard-vocabulary.png` holds exactly the 19 seeded rows with no `seen 1×`
strays; the progress tiles read 19 met and **393** read, and 393 is exactly
the sum of the plan's own `exposures` column (61 + 54 + 48 + … + 3 + 2), so
the store is the plan and nothing else; the band reads Learning 8 + Familiar
3 + Known 5 against "3 seen but not yet reviewed", which is 19.
`dashboard-transparency.png` still reads "0 network requests, ever" and has
lost the half-cropped "Settings" link it used to bleed. All **19** files
byte-identical across two consecutive runs, npm's exit status captured per
run and mtimes checked every time — 14 of the 19 are written by this spec and
all 14 moved, which is what distinguishes a clean idempotent run from a
generator that died early and wrote nothing.

**No verify stamp was written and that is deliberate.** This group earned a
real content change, so its `lastWrote` moves on its own and a stamp meaning
"checked, nothing to commit" would have been false — the same call PR #30
made for the first-run group, and the one thing the stamp must never mean.

**The product was telling the truth the whole time**, which is the part to
keep. The item's objection — that a user who only reads the onboarding page
"starts with seven words met and a non-zero words-read total" — described a
harness artefact. Those 26 words really had been read, off `article.html`, by
a page nobody closed. Nothing in `src/` was touched, which is also why the
package size is unchanged.

Counts moved 724 → **725** and tools 63 → **64** in five documents, with
`docs/LAUNCH.md:221` swept **by name and first** for the ninth session
running. Unit, jsdom and e2e did not move, and `src/` was not touched at all,
so sizes could not.

Measured at the end, on Node 26.7, on the final tree, with npm's own exit
status captured rather than a pipe's: `npm run test:all` **exit 0** —
typecheck clean, 527 unit / 130 suites, 98 jsdom / 22 suites, **64 tools / 18
suites**, compat 21 dependencies × 3 browsers, 56 pass / 7 degrade / 0 fail /
0 without data, **983 KB × 3** passing `validate` (unchanged, and it has to be
— nothing here touches shipped code), **36 e2e passed and 3 skipped in 2.0
min**, then build and validate again. `packs:verify` and `site:check` were
**not** re-run, and the reason is the rule this file already states: no pack
moved, no seed moved, and `src/` was not touched at all. Separately
`artefacts:check` reports the same 1 stale group it did before — the release
notes, B2a, whose `inputs` are `.` — with all three screenshot groups `ok`.
The screens generator was run **twice**, each with npm's exit status captured
and all 19 hashes diffed before anything was believed, and the gate was
confirmed not to have moved a byte of `docs/screens/` afterwards. Zero iCloud
conflict copies in `dist/`, `src/` or `test-results/`, the xattr working for
the fifth session running — it had to be re-set on `test-results/`, which
does not survive being deleted.

What needs a human: unchanged, still everything below **B1**, register
`weft.study`. `TODO.md`'s `Next` now holds exactly one item, the two listing
screenshots that clip a row at the top edge — which does want its own pass,
because it rewrites 6 binaries and invalidates the store group's verify stamp.

### 2026-09-29 — both sets reproduced exactly, and the defect was in the file neither run touched

The queue asked for `docs/screens/` and `docs/firstrun/` to be regenerated,
named the five `dashboard*.png` date churn as the known caveat, and offered
seeding the dashboard clock as the better item. **All three were settled
already**, one session back in `d0b2263`: `artefacts:check` reports
`documentation screenshots` **ok**, no date was ever involved (the churn was
an unstable comparator, the run's own attention, and a cooldown banner the
harness queued for itself), and the two date sites at
`src/ui/dashboard/index.tsx:299,429` were measured stable. Sixth of the last
nine sessions handed a completed item; a minute of `artefacts:check` settled
it before anything moved.

**PR #29 was open, mergeable and unmerged**, carrying the topmost unchecked
item — the manifest mechanism. Merged first rather than stacked on, because
the remaining work is *stamping*, which is not expressible until
`artefacts:verify` is on `main`.

So the real work was the item below it: regenerate the two genuinely stale
groups, read them, stamp whichever reproduce. Both did. `store listing
screenshots`, all 15 captures, and `first-run walkthrough shots`, all 6
generated ones, byte-identical across **two consecutive runs each**, hashed
rather than eyeballed, with npm's exit status captured per run and the mtimes
checked every time — a generator that dies early writes nothing, and "no file
changed" is indistinguishable from a clean idempotent run from outside.

**Then reading the images found the one thing two clean regenerations could
not.** `docs/firstrun/07-help.png` renders the diagnostic block, the block
carries the version, and it read **`Weft 1.0.0`** on a tree at 1.0.1. It is
written by **no generator** — a manual capture orphaned inside the group's
pathspec — so both runs left it untouched, `git status` stayed clean, and the
STALE report was pointing at a real defect that no amount of regenerating
could ever clear. Same class as `options.png` carrying 1.0.0 two sessions ago,
and the same reason: a bump invalidates *artefacts*, and the count sweep greps
past them.

**The transferable half is the pathspec, not the shot.** `paths:
['docs/firstrun']` claims everything in that directory is generated. Two files
there are not. The precedent for the fix was **one group above in the same
file** — `store listing screenshots` already declares `docs/store/*-0*.png`
rather than `docs/store`, in as many words, "because the tiles beside the
captures are drawn by hand and are not generated from anything." The first-run
group simply had not had that line drawn for it. Now `docs/firstrun/0*.png`,
with `icons.png` outside it, `07-help.png` generated for real by a new spec
step that presses "Gather the details" first, and a guard that fails if any
file in the pathspec has no generator writing it. Only this group can be
guarded that way and the test says so: `store-assets.spec.ts` composes
filenames from a frame × slug template, so no literal name exists to search
for.

**Writing the first real verify stamp turned an existing test red, and that
is the more useful finding.** `the store pathspec takes the fifteen captures`
counts `git ls-files` over `paths`; `artefactsFor` folds the manifest into
`paths`; so it matched 15 for exactly as long as nobody had ever run
`artefacts:verify`, and 16 the moment somebody did. **A guard that passes
because the feature it guards is unused, and fails on first use, is the
vacuity this suite polices everywhere else** — PR #14's note guard skipping
`novem` for the same shape. Both pathspec tests now share a `captures()`
helper that excludes the stamp. Expect the same from the other three
manifests the first time each is written.

Done test-first: the red run named both defects separately and by filename,
`docs/firstrun/icons.png is not a generated shot` and `docs/firstrun/07-help.png
is inside the artefact pathspec but no generator writes it`, before anything
was edited. 61 → 63 tests, 18 suites unchanged (both went into an existing
`describe`).

**Byte-equality proves reproducibility and not correctness, which is the
argument for opening the files at all.** A regeneration reproduces a wrong
committed image exactly as faithfully as a right one — which is literally how
the listing art carried pre-PR-#12 copy for a month while every run agreed
with itself. What reading confirmed: scene 5 states "28% of content words —
1 word in 4", the qualified phrasing that ships; scene 4's feed is in stable
folded-alphabetical order with `père` before `pierre`, PR #24's `orderKey`
visible in the art; the first-run set states the honest "a third of the
content words" and the no-host-permissions story. All 26 files were opened,
including the two orphans, which is how the 1.0.0 was found.

**One thing found by reading and deliberately not fixed**, queued instead:
`apple-04-progress.png` cuts the tops off all four tile digits and
`apple-05-settings.png` halves the preset button row, a byproduct of
`scrollIntoViewIfNeeded` scrolling minimally so whatever sits just above the
target section bleeds in. Cosmetic, pre-existing, byte-stable — and B5 step 7
uploads these. Not folded in here because **changing bytes in the same commit
that stamps them unchanged is the one thing the stamp must never mean.**

`artefacts:check` went from 3 stale to **1**, and the one left is the release
notes, which is B2a and cannot be fresh before the tag: its `inputs` are `.`,
so any commit stales it by design. The first-run stamp was **deleted** rather
than kept — that group earned a real content change, so the stamp's own note,
"no change to commit", would have been false.

Counts moved 716 → **724** and tools 55 → **63** in five documents, with
`docs/LAUNCH.md:221` swept **by name and first** for the eighth session
running. Worth naming: PR #29 moved tools 55 → 61 and swept **only its own
journal** — `README.md`, `CHANGELOG.md`, `docs/SUBMIT.md` and `docs/LAUNCH.md`
were all two sessions stale, so this sweep covers both sessions' drift.

Measured at the end, on Node 26.7, on the final tree, with npm's own exit
status captured rather than a pipe's: `npm run test:all` **exit 0** —
typecheck clean, 527 unit / 130 suites, 98 jsdom / 22 suites, **63 tools / 18
suites**, compat 21 dependencies × 3 browsers, 56 pass / 7 degrade / 0 fail /
0 without data, **983 KB × 3** passing `validate` (unchanged — nothing here
touches shipped code), **36 e2e passed and 3 skipped in 1.8 min**, then build
and validate again. `site:check` and `packs:verify` were **not** re-run and
the reason is the rule this file already states: no pack moved, no seed moved,
and `src/` was not touched at all. The two generators were run **five** times
across the session, each with its exit status captured and its hashes diffed
before anything was believed. Zero iCloud conflict copies in `dist/`, `src/`
or `test-results/`, the xattr working for the fourth session running — it had
to be re-set on `test-results/`, which does not survive being deleted.

What needs a human: unchanged, still everything below **B1**, register
`weft.study`. `TODO.md`'s `Next` holds two agent-shaped items: the onboarding
preview judgement call, and the clipped-row framing above.

### 2026-09-29 — the queued task was already merged; the real gap was two items down

The queue named the exportAll/importAll gap directly, line numbers and all —
`src/background/storage.ts:322` and `:359`. Already done: `6425461`, three
commits back on `main`, had built `splitImportedSettings` and `mergeAttention`
and made the lock state's refusal deliberate, and TODO.md's own Next section
already showed the item checked off. The line numbers were the tell before
either check ran — `exportAll` is at line 336 in the current file, not 322 —
which is this session's own version of a pattern this file's Journal already
names in five of the last eight entries: the queue can hand over completed
work, and a minute of reading settles it before any code moves.

So the real work was `TODO.md`'s next unchecked item: `artefacts:check`
cannot tell a byte-identical regeneration from silence, first hit for real
two sessions ago on `docs/firstrun/`, with a fix already sketched in the same
file — one shared manifest, `docs/artefacts.json`, added to every group's
`paths`.

**The sketched fix had a bug, and it is the shape this tool's own tests
already refuse for the missing/fresh case.** `checkArtefacts` reads *paths*,
never content, so a change to one group's entry in a shared file touches a
path every other group also declares — verifying the store screenshots would
have silently moved `lastWrote` for the documentation screenshots too, on a
commit that never looked at them. Not a hypothetical: a new test constructs
exactly that scene, commits a verify stamp for one of two groups, and asserts
the other is exactly as stale as before. Built instead as one file per group,
`docs/artefacts/<slug>.json`, with a new `artefactManifestPath()` deriving the
slug from the artefact's own name. This needed **zero** changes to
`checkArtefacts` itself — `paths` already unions several pathspecs, so a
per-group manifest just gives that union a second way to move forward.

**The four real manifest files are not pre-seeded, on purpose.** An early
version of the "every declared path has history" test would have forced
creating all four right now — but two of the four groups were genuinely
stale at that moment (`store listing screenshots`, 1 commit since `8d2cbbb`,
`first-run walkthrough shots`, 9 since `7f7faaa`, both measured live before
writing this), and `checkArtefacts` cannot distinguish an honest "I checked"
from a fabricated one; only the person running it can. Stamping them
speculatively would have been the exact false "fresh" this fix exists to
prevent. The test now exempts the manifest path by name — it is derived, not
hand-typed, so it cannot be the typo that test exists to catch — and the path
earns real history the first time `npm run artefacts:verify -- "<name>"`
(`tools/verify-artefact.mjs`, new) actually runs for that group. The CLI's
argument-handling paths were smoke-tested directly; its write path was run
once by hand against `documentation screenshots` (the one group already
fresh, so no claim was at stake) and the scratch output deleted before
anything was committed, rather than left standing as an unearned stamp.

Done test-first: 6 new tests in `tests/tools/artefacts.test.ts`, red on
`does not provide an export named 'artefactManifestPath'` before anything
existed — 13 → 19 tests, 6 → 8 suites in that file. One process note: the
edits were made directly on `main` before a branch existed, caught before
anything was committed by checking `git status` — `git fetch` confirmed
`origin/main` had not moved, so `git checkout -b` carried the uncommitted
work over cleanly rather than needing a stash.

Measured at the end, on Node 26.7, with npm's own exit status captured rather
than a pipe's: `npm run test:all` **exit 0** — typecheck clean, 527 unit /
130 suites, 98 jsdom / 22 suites, **61 tools / 18 suites** (55 / 16 before),
compat 56 pass / 7 degrade / 0 fail / 0 without data, 983 KB × 3 passing
`validate` (unchanged — this change touches no shipped code), 36 e2e passed
and 3 skipped in 1.9 min, then build and validate again. `npm run
artefacts:check` itself still reports the same three groups stale that it
reported before this session touched anything: this gives the tool a way to
*record* a check, it does not perform one.

What needs a human: unchanged, still everything below B1. `TODO.md`'s Next
now holds exactly one item, the onboarding-preview judgement call, queued for
a future run via `cq add` rather than attempted here. Also queued: actually
regenerating and diffing `store listing screenshots` and `first-run
walkthrough shots`, and running `artefacts:verify` for real on whichever come
back byte-identical — genuine follow-up, not attempted this session because
verifying content neither generator was asked to touch is a different task
from the tool that now lets someone record having done it.

### 2026-09-29 — the item named a date, and none of the three causes was one

The queue sent this session at `TODO.md`'s only unchecked item, the two
screenshot sets `artefacts:check` had reported stale the session before.
Premise confirmed in a minute — `docs/screens/` 5 commits behind `src/`,
`docs/firstrun/` 8 — and then the diagnosis in it turned out to be wrong,
which is the fourth session running where what settled a queued item was
measuring rather than reasoning.

**`docs/firstrun/` came back byte-identical.** All eight files, unchanged
against what was committed, twice in a row. Stale by provenance and current
in content, which is `artefacts:check`'s own "stale does not mean wrong"
caveat earning its keep on its first real use. Reading the spec first is what
predicted it: `firstrun.spec.ts` has no `Date.now()`, no seeding and no
import — it captures a fresh install, so there is nothing for a clock to get
into. Two of its eight files, `07-help.png` and `icons.png`, are written by
**no generator at all**; they sit inside the tracked pathspec as orphans of a
manual capture, so a regeneration will never touch them and nobody should
expect it to.

**The item said the cause was five `dashboard*.png` rendering an absolute
calendar date from `Date.now()`. It was none of that.** Measured first: two
runs a minute apart moved `dashboard.png`, `dashboard-dark.png`,
`dashboard-milestones.png`, `dashboard-vocabulary.png` and **`popup.png`** —
which is not a `dashboard*.png` — while `dashboard-transparency.png`, the one
panel that renders a date a reader can see, never moved at all. The churn set
was not even stable between checks; `dashboard.png` and `popup.png` took
turns. A set that changes membership is a counter crossing a format boundary,
not a clock. Three real causes:

**One was in the product, and it is the unguarded sibling of a fix already
made.** Cropping `dashboard-vocabulary.png`'s differing region — 5305 pixels,
286 rows — showed the same rows in a different order. Three of the four
columns at `src/ui/dashboard/index.tsx:137` returned 0 for distinct cards:
`exposures` ties for everything unseen, `stability` for everything
unreviewed, `cardRetrievability` for every new card. So `Array.sort`'s
stability handed the order to whatever the storage round-trip returned.
**This is `buildDiscoveries` before `06cd2e9`, three files away and four
weeks later** — the same comparator-returns-0 defect, and this file already
records the rule it breaks in as many words. Not a test concern: a real
learner's list reshuffles between visits. Extracted to `src/core/stats.ts`
as `sortVocabulary`, which is what makes it unit-testable at all, with the
tiebreak `buildDiscoveries` already uses. `orderKey` is new in
`similarity.ts` and is deliberately *not* the exported `fold` beside it —
`fold` collapses doubled consonants, which is right for "are these the same
word?" and would file "pomme" and "pome" at one key for sorting.

**One was the run's own attention**, fixed with the idiom
`store-assets.spec.ts` already proved: seed 1800 s, which `formatDuration`
floors to a stable "30 min".

**One was a cooldown banner the harness queued for itself, and it is
`6425461` biting the session after it landed.** `splitImportedSettings` means
an import no longer overwrites settings: anything *easier* becomes a pending
change. The spec's payload carries no settings, `validateSettings` supplies
the shipped defaults, and those are easier than the density this spec
configures — so the seeding queued "starting density → 6%; maximum density →
35%" and both options shots grew a red "One change is waiting" banner about
200 px tall. The commitment layer working correctly on a payload only the
harness would ever send. Cancelled by **id** rather than by matching
settings, so it survives a future default changing which field is the easier
one.

**Two attempts made it worse first, and the order is the lesson.**
`reset-vocabulary` is necessary — probed, 12 cards before, 0 after, 19 after
the import — but it is not sufficient while a taxed page is open, because the
content script keeps writing. Closing those pages *without* waiting was
worse than leaving them open: a close flushes pending exposures
asynchronously, that flush raced the reset, and **five** shots drifted where
one had, including `dashboard-transparency.png`, stable until then. A 2500 ms
settle between the closes and the reset is what actually worked.

**Reading the images found the one real cost, and `git status` could not
have.** Half an hour saturates the site ceiling, so the popup now prints "You
have reached the ceiling for this site" where the committed shot printed "40%
after another 7 min" — the sentence that shows escalation happening. It
cannot be had *and* reproducibility, and the reason is arithmetic rather than
taste: `formatDuration` floors to whole minutes and the projection counts
**down** by exactly the seconds the run accrues, so it is stable only where
the value sits 59 s above a boundary. Written beside the constant, because
that is where someone goes to lower it. Two shots got better from being read:
`options-dark.png` matches its committed bytes again once the banner is gone,
and `dashboard-transparency.png` no longer has a half-cropped "Settings" link
bleeding into the bottom of its clip. And `options.png` was carrying "Weft
1.0.0" in its version line — the bump's stale artefact, caught only because
the shot was opened.

**What is left is measured, not waved at.** 18 of 19 shots byte-identical
across consecutive runs. `options-density.png` is *bistable* — run 1 and run
3 agreed exactly, run 2 differed by **17 pixels across 4 rows** (y 275, 278,
418, 421) in the two density slider tracks. Not a shift, not a clip offset,
the same "1-pixel slider ticks" residue this file already records for the
store shots, and not reachable by seeding anything. `page-woven.png` drifted
once in five checks; it is captured at line 59, before every edit in this
work, so that is pre-existing renderer nondeterminism.

**One methodological trap, nearly paid for twice.** A failing generator
writes nothing, and "no file changed" looks exactly like a clean idempotent
run — this file records that already, and it still nearly produced a false
result here: a 16-minute run failed under contention because other work was
running alongside it, and the drift check it fed reported zero drift. Every
claim above comes from a check that captured npm's own exit status *per run*
and was read before its diff was believed. Do not run anything heavy
alongside the generator.

Done test-first: 7 tests in a new `sortVocabulary` describe in
`tests/core/stats.test.ts`, red on `does not provide an export named
'sortVocabulary'` before anything existed, and 6 in a new
`tests/tools/screenshots.test.ts`. Both checked for vacuity rather than
assumed: restoring the old comparator turns 4 of the 7 red and the 3 that
stay green are the right 3 (`alpha`, which is already total on distinct
lemmas, plus the non-vacuity and primary-key assertions); removing both
halves of the spec fix turns 3 of the guard's tests red. One guard was
**brittle on its first write** and worth naming — it anchored on the string
`onboarding.png`, which matches a comment 60 lines above the code, so it
failed for the wrong reason; it now anchors on `['onboarding.html'`, which
only the shots table contains.

Counts moved 702 → 716, unit 520 → 527 / 129 → 130 suites and tools 48 → 55 /
15 → 16 in six documents, with `docs/LAUNCH.md:221` swept **by name and
first** for the seventh session running. jsdom and e2e did not move.

One environment finding: `.worktrees/lexicon-curly-note-quotes/` is still on
disk from the 2026-09-28 session and is full of iCloud conflict copies
(`dist/chrome/popup 2.html` and dozens more). It is gitignored and harmless,
but it is dead weight and `git worktree list` will show it as stale.

**`artefacts:check` cannot ever call `docs/firstrun/` fresh, and finding that
out is the first real use of the tool built last session.** It asks
provenance, and a byte-identical regeneration commits nothing, so `lastWrote`
never moves: the group reports "8 commits since" on a tree where somebody has
just checked it, and it will do so forever. Verified rather than assumed —
`git status docs/firstrun/` empty after two full regenerations, and the group
still listed as stale afterwards. Queued in `TODO.md` with the fix that fits
the design: a committed per-group manifest recording the commit an artefact
was last *verified* at, included in that group's own `paths`, so "I checked
and it was identical" becomes a commit the tool can see.

Measured at the end, on Node 26.7, on the final tree, with npm's own exit
status captured rather than a pipe's: `npm run test:all` **exit 0** —
typecheck clean, **527** unit / **130** suites, **98** jsdom / 22 suites,
**55 tools / 16 suites**, compat 21 dependencies × 3 browsers, 56 pass / 7
degrade / 0 fail / 0 without data, **983 KB × 3** passing `validate`, **36
e2e passed and 3 skipped in 1.8 min**, then build and validate again.
Separately `packs:verify` **0 errors / 4 warnings**, unchanged and expected —
nothing here touched a seed — and `site:check` **711 pages / 16 087 links**
all resolving, run because `src/core/` moved and the site imports from it.

**The package grew 982 → 983 KB and that is this change**, `sortVocabulary`
and `orderKey` being the only additions to shipped code. Two live mentions
swept (`CLAUDE.md`'s command table and `TODO.md`'s state line); the four
others are journal history and stay. Worth naming for the second session
running: a `src/` edit invalidates **sizes**, which the count sweep greps
straight past.

The screenshot generator was run **eleven** times across the session, in
checks that each captured npm's exit status per run. Zero iCloud conflict
copies appeared in `dist/`, `src/` or `test-results/`, which is the xattr
working for the third session running.

What needs a human: unchanged, and it is still everything. **B1**, register
`weft.study`, is the critical path. Then **B2**, make the repository public
and push the `v1.0.1` tag — with **B2a** immediately before it, which
`artefacts:check` still names correctly; **B3**, Pages; **B4**, the Lemon
Squeezy URLs; **B5**, the store submission. `Next` has two agent-shaped
items, both found by this work: the `artefacts:check` provenance gap above,
and whether the onboarding preview should be writing to the learner's real
vocabulary at all.

### 2026-09-29 — three sessions had named the class and none had built the sweep

The queue sent this session at the store-asset generator, "broken, dies at
`:88` in 28 s". It was fixed two sessions ago, ticked in `TODO.md`, and
`TODO.md` had **zero** unchecked items — the seventh completed item the queue
has handed over in nine sessions. Confirmed in a minute: the `requireTestBuild`
guard is at `tests/e2e/fixtures.ts:92`, and `WEFT_STORE=1 npx playwright test
store-assets` passes in **31.3 s**.

**Verifying it is what found the next thing, and the previous session's own
rule is why it was worth verifying at all.** Three of the fifteen shots no
longer matched what the generator produces — one commit after a session
regenerated them and wrote "byte-identical" into three documents.
`git status` after a run is the whole check here, and nobody had run one
since `6425461`.

**One variable at a time, because "the shots differ" is not a result.** Run
to run: identical, twice. Against committed: three differ. Then, a build and
a 30 s run per hypothesis — reverting `src/ui/options/data.tsx`, the *only*
copy change in `6425461`, did **not** restore them; `VERSION` back to 1.0.0
did **not** either; `git checkout 06cd2e9 -- src/` **did**, byte for byte,
all fifteen. Two things follow, and the second is the one that was in doubt:
the cause is in `src/`, and **the generator is deterministic across
sessions**, not merely within one.

**What the difference is, and the honest end of it.** The canvas-diff method
this file recorded two sessions ago — no image tooling on this machine, so
the Chromium the e2e suite already installs is the decoder — says 19 368
pixels differ and, extended to test for a shift, that **149 of the 156
differing rows are reproduced exactly by moving one row**; the remaining 7
are 1-pixel slider ticks. The page is one pixel lower and no text changed.
Then two independent measurements of the options page under the full scene
sequence — `scrollY` 1774, every `.section` box identical to two decimal
places, in both builds — found **no layout difference that explains it**.
That is written down as unexplained rather than given a plausible cause,
which is the difference between this entry and the one that blamed a day
rollover for an unstable sort. It does not block anything: content identical,
determinism proved. The case that would matter is the shots differing
*between runs*, and they do not.

**The transferable half is the class, and this is its third sighting in
three sessions.** 1.0.1 found `docs/SUBMIT.md` naming five zip filenames a
bump had deleted. The session below found `RELEASE-1.0.1.md` going stale on
its own and filed it as B2a. This one found the listing art stale. Each was
found by a person noticing, and the reason is structural: **the count sweep
this file has done for seven sessions greps for test totals, so it cannot
see an artefact at all**, and CI's one artefact check rebuilds the lexicon
packs and diffs them — right for the only artefact that is
platform-independent, and available for none of these.

So `npm run artefacts:check` (`tools/artefacts.ts`, `tools/check-artefacts.mjs`)
is that sweep. **It asks provenance, not content: has anything this was
generated from been committed since it was last written.** The content
question cannot be asked here and that is the whole design constraint — PNGs
rendered on macOS will not byte-match `ubuntu-latest`, which is the reason
this file already records for refusing a pixel-equality gate; and release
notes listing a `git log` can **never** match their own tree, because the
squash commit that lands them does not exist until after the merge. Asking
git instead costs milliseconds and is platform-independent.

**On a fresh `main` it reported four stale groups and two were unknown.**
The listing art (1 commit), the release notes (1, which is B2a), and then
`docs/screens/` **5 commits behind `src/`** and `docs/firstrun/` **8** —
both embedded in documentation a stranger reads, neither of which any
session had looked at. Queued rather than regenerated, and the reason is a
decision already on record rather than the cost: five `dashboard*.png`
render an absolute date from `Date.now()`, so they churn on every capture
whatever the code does, and PR #12's session reverted exactly those five for
exactly that reason. Twenty binaries of which five carry known churn, in a
session where nobody looks at them, is not an improvement.

**Deliberately not in `test:all`.** Almost every PR touches `src/`, so it
would be red almost always, and this file already records that a gate firing
for more than one reason gets ignored — the argument that kept the
sitemap-date check out of `check-links.mjs`. It is wired into
`docs/SUBMIT.md`'s pre-flight block and into `TODO.md`'s B2a and B5 step 7,
which are the two moments before something irreversible. `release.yml` was
**left alone on purpose**: it is the one workflow that publishes outward, it
fires once, and it cannot be rehearsed — changing it unattended is the wrong
risk, and it would need `fetch-depth: 0` first, because `actions/checkout`
is shallow and the module correctly answers `unknown` there rather than
calling everything fresh.

Done test-first: 13 tests in a new `tests/tools/artefacts.test.ts`, red on
`ERR_MODULE_NOT_FOUND` before anything existed, against throwaway git
repositories the way `sitemap.test.ts` already does. Three are worth naming.
"A commit touching neither the artefact nor its sources leaves it fresh" is
the non-vacuity floor — without it the check is "has anything happened
lately", which fires on every commit and so is ignored on every commit.
"An artefact nobody has committed is **missing**, not fresh" pins the
failure a typo'd pathspec produces, which is silent success forever; two
further tests assert every pathspec in the real list actually matches
something in this repository, so the guard cannot go quietly vacuous. And
the shallow-clone case clones itself at `--depth=1` rather than mocking the
condition.

Counts moved 689 → 702 and tools 35 → 48 / 11 → 15 suites in six documents,
with `docs/LAUNCH.md:221` swept **by name and first** for the sixth session
running. Unit, jsdom and e2e did not move.

Measured at the end, on Node 26.7, on the final tree, with npm's own exit
status captured rather than a pipe's — and re-run from scratch after a
thirteenth test was added late, because the first green run had predated it:
`npm run test:all` **exit 0** — typecheck clean, **520** unit / 129 suites,
**98** jsdom / 22 suites, **48 tools / 15 suites**, compat 21 dependencies ×
3 browsers, 56 pass / 7 degrade / 0 fail / 0 without data, **982 KB × 3**
passing `validate`, **36 e2e passed and 3 skipped in 2.0 min**, then build
and validate again. Separately `packs:verify` **0 errors / 4 warnings**,
unchanged and expected — nothing here touched a seed — and `site:check`
**711 pages / 16 087 links** all resolving. The store generator itself was
run **five** times across the session, and the three `*-05-settings.png` it
writes are the only binaries in the diff. Zero iCloud conflict copies in
`dist/`, `src/` or `test-results/`, which is the attribute working for the
second session running.

What needs a human: unchanged, and it is still everything. **B1**, register
`weft.study`, is the critical path. Then **B2**, make the repository public
and push the `v1.0.1` tag — with **B2a** immediately before it, which
`artefacts:check` now names for you; **B3**, Pages; **B4**, the Lemon
Squeezy URLs; **B5**, the store submission. `Next` has one agent-shaped
item, the two stale screenshot sets above.

### 2026-09-29 — the item's open judgement was already decided, and the real hole was one line up

The queue sent this session at **B0 step 2**, which is done: `main` is
`d2e834f`, `VERSION` is 1.0.1, `package.json` is in step, `RELEASE-1.0.1.md`
exists, and `git ls-remote --tags` shows only `v1.0.0`, so the tag is
correctly unpushed. Verified in a minute rather than believed; the queue has
now handed a completed item to six of the last eight sessions. So the work
was `TODO.md`'s only unchecked item, **the three stores an export writes and
an import dropped**.

**The judgement the item deliberately left open had already been taken, in a
test the item had not read.** It offered three shapes and recorded no
preference, on the grounds that importing `lock` "is not obviously right".
But `tests/e2e/friction.spec.ts:407` — "importing a file cannot clear a
cooldown" — already answers it, and in as many words: importing lock means
"export before requesting an easier setting, wait nothing, import the old
file, and the pending change and its clock are gone", and the test exists
"to fail when" a future change tidies export/import into a full round trip.
Shape 2 was not an open option; it was a guarded-against regression, and
building it would have turned that test red. **The transferable form: before
costing out the options a queued item lists, grep the suite for a test that
has already decided one of them.** This is the third session running where
what settled a queued item was reading something already in the repository
rather than reasoning about the code.

**The reason to refuse `lock` is also stronger than the item recorded, and
it is the design rule rather than a preference: every field of the lock
state is a difficulty reduction when it arrives from a file.** A `pending`
change whose `unlocksAt` has already passed is a reduction that applies on
arrival; a `panic` day with `used: 0` refills a spent budget; a lower
`tamperCount` launders a history; an older `lastSeenAt` re-arms the
clock-rewind trick `noteClock` exists to catch. There is no harder direction
to take safely. And the one field with genuine user value, the audit `log`,
is **already truncated to the last 50 entries on the way out** — which says
what the export thinks `lock` is for: diagnosis, not restoration.

Attention is the mirror image, which is why it can come in at once and
needs no gate. `weaveRatio` is monotone increasing in `attentionSeconds`, so
more attention is a *harder* page, and "anything that makes Weft harder
applies at once" is already this file's rule. **`mergeCards` had also
already written down the merge rule, for the other half of the same export.**
Its comment on `exposures` reads: "Max rather than sum: the same word read
on two machines is not twice as familiar, and summing would let a round trip
through export inflate it." Attention seconds are the identical kind of
quantity and nothing merged them — the unguarded half of a decision already
taken, the same shape as PR #14's guard that could not see `novem`. So
`mergeAttention` folds both machines into a day → seconds map and takes the
max per day. Max is also what makes the import idempotent, which matters
because nothing stops anyone importing the same file twice and the dashboard
calls that panel "facts about reading you have actually done".

**The bigger defect was one line above the one the item named, and its doc
comment claimed it was already fixed.** `importAll` promised that an import
"is not a way to install a forged difficulty setting", because "any
reduction in difficulty relative to the current state still has to pass the
cooldown, because settings are applied through the same lock path as any
other change". It never went near that path — it called `saveSettings`
directly. The governed path is `requestChange`, reached only from the
`request-change` handler (`src/background/index.ts:329`). So while the
queued item was weighing whether importing `lock` might hand someone an
easier state, **settings — the thing cooldowns actually govern — walked
straight past**, and one edited number in an exported JSON file disabled the
attention tax, dropped the ceiling, or shortened the cooldown that governs
the cooldown. This is scope this session added rather than found queued, and
the case for adding it is that the behaviour was already specified *in the
codebase*: the comment states it as fact. Fixing it closes a gap between a
written decision and the code, and the alternative was to rewrite that
comment into a description of a hole in the commitment layer.

`splitImportedSettings` (`src/core/lock.ts`) now splits an imported file the
way the rest of the product already works: harder and cosmetic values land
at once, anything easier becomes a patch handed to `requestChange`, which
queues it against the user's own cooldown. An import is then exactly as
fast, and exactly as slow, as making the same change by hand on the options
page. **Direction comes from `assessPatch` rather than `directionOf`**, and
that is not interchangeable: `learning.activeTarget` scores `neutral` on
direction because it is non-numeric, and only `assessPatch` knows to treat a
target switch as easier because it resets vocabulary exposure. One test
pins exactly that, with the `directionOf` call in it so the distinction
cannot be optimised away by someone who does not know why it is there.

**The round-trip guard is the first test anywhere to import
`src/background/storage.ts`**, and where it went was decided by the seam
rather than the directory name. `tests/core/` is documented as pure and no
browser; a Map-backed `chrome.storage.local` is neither I/O nor a browser,
and `tests/core/providers.test.ts` already imports a `src/background/`
module and stubs a global to do it. The one thing worth copying: **each
machine is a separate module instance**, imported through a cache-busting
query string, so each mints its own install id and an import genuinely
crosses between installs rather than meeting the key that signed it.

Done test-first throughout, and the guards were **checked for vacuity rather
than assumed non-vacuous**. Restoring the old direct write turns 4 of the 6
settings-bypass tests red; the 2 that stay green are the over-correction
guards — a *harder* setting and a contrast setting must still land at once —
which is what they are for. The three attention/introduced/message tests
were red before the merge was written.

One thing found and left alone as correct: `validateSettings` clamps
`ceilingRatio` up to `baseRatio` (`src/core/settings.ts:277`), so a test
expecting a forged `0.01` ceiling to reach the lock was wrong about the
code, not the other way round. The two gates compose — validation fixes the
range, the lock judges the direction — and the test now says so.

**Found on the way, and it is a standing trap rather than an incident:
`RELEASE-1.0.1.md` goes stale on its own.** It is *generated* — a
`Changes since v1.0.0` list from `git log`, plus six package sizes — and B0
step 2 generated it on a tree that is no longer the tree the tag will point
at, because the version was cut days before the tag can be pushed (that
waits on B2). Every commit landing on `main` in between makes the release
notes wronger, and nothing detects it: the file is not derived at tag time.
It is already one commit out of date, from this session. **The fix cannot go
in the PR that causes it** — the squash-merge hash does not exist until
after the merge, so regenerating inside the branch writes a list that is
wrong the moment it lands. Filed as **B2a**, a step immediately before
`git push origin v1.0.1`. Same class as the 1.0.1 session's finding that
`docs/SUBMIT.md` named five zip filenames that no longer existed: a cut
invalidates *artefacts*, and no count sweep looks at artefacts.

**The iCloud trap has a fourth location, and it is the dangerous one:
`src/`.** This file records it in `dist/`, `dist/site` and `test-results/`,
all three of them gitignored, which is why the standing advice has been
`rm -rf` and an xattr. Here it landed on **tracked source** — `storage 2.ts`,
`escalation 2.ts`, `lock 2.ts`, `data 2.tsx`, one per file this session
edited, all four unreadable stubs that answer `Resource deadlock avoided` to
`md5` and make `tsc` fail with `TS6053: File ... not found. The file is in
the program because: Matched by include pattern 'src/**/*'`. They appeared
during a `git stash push -- src/` / `git stash pop` round-trip, which
rewrites several watched files in seconds. **`src/` is not gitignored, so
`git add -A` would have committed four duplicate modules** — a far worse
outcome than a broken build, and the reason this is worth its own note. The
give-away that they are not real content is that `diff` reports them as
differing from the originals while `ls` shows identical byte counts: the
tool cannot read them, not the bytes disagreeing. `com.apple.fileprovider.ignore#P`
is now set on `src/` as well as `dist/` and `test-results/`.

**One count that no test-count sweep would have looked at: the package grew.**
`npm run build:all` has reported 979 KB per target for eight sessions and now
reports **982**. Verified rather than assumed to be this change — `git stash
push -- src/`, rebuild, 979 KB; restore, rebuild, 982 KB — so the +3 KB is
exactly this work. Two live mentions swept (`CLAUDE.md`'s command table and
`TODO.md`'s state line); the sixteen others are journal history and stay.
Worth naming alongside the 1.0.1 entry's finding about stale *artefact
names*: a change to `src/` invalidates **sizes**, which the count sweep this
file has done for six sessions running looks straight past because it greps
for test totals.

Counts moved 655 → 689 and unit 486 → 520 / 122 → 129 suites in five
documents, with `docs/LAUNCH.md:221` swept **by name and first** for the
fifth session running. jsdom and tools did not move.

Measured at the end, on Node 26.7, on the final tree, with npm's own exit
status captured rather than a pipe's — and re-run clean after a late
code-move in `lock.ts`, because the first run had partly predated it:
`npm run test:all` **exit 0** — typecheck clean, **520** unit / **129**
suites, 98 jsdom / 22 suites, 35 tools / 11 suites, compat 21 dependencies ×
3 browsers, 56 pass / 7 degrade / 0 fail / 0 without data, **982 KB × 3**
passing `validate`, **36 e2e passed and 3 skipped in 3.0 min**, then build
and validate again. Separately `packs:verify` **0 errors / 4 warnings**,
unchanged and expected — nothing here touched a seed, so no pack moved and no
`builtAt` advanced — and `site:check` **711 pages / 16 087 links** all
resolving, run because `src/core/` moved and the site imports from it. Three
full gates created **zero** iCloud conflict copies in `dist/` and
`test-results/`, which is the attribute working; the four that did appear
came from a `git stash` round-trip in `src/`, which had never been guarded
and now is. The fast suites were re-run after clearing them — 520 / 98 / 35,
0 failures — to prove the stash had restored the tree exactly.

What needs a human: unchanged, and now it is everything. **B1**, register
`weft.study`, is the critical path and the first thing no session can do.
Then **B2**, make the repository public and push the `v1.0.1` tag; **B3**,
Pages; **B4**, the Lemon Squeezy URLs; **B5**, the store submission. `Now`
and `Next` are both empty and there is no agent-shaped work left in
`TODO.md`.

### 2026-09-29 — 1.0.1 is cut, and the runbook named five files that would not exist

**B0 step 2 is done.** `npm run release -- --version=1.0.1` on a branch,
merged through a green PR. `VERSION` in `manifest.config.mjs` is 1.0.1,
`package.json` is in step, `RELEASE-1.0.1.md` is written, and six packages
built at 213/215 KB. The tag is **not** pushed and must not be: that fires
`.github/workflows/release.yml`, which publishes outward, and it waits on
**B2**, where the repository also becomes public — a release whose download
button 404s is worse than no release.

Three files is what the bump itself touched, exactly as B0 predicted, and the
zips are gitignored. The rest of this entry is the two documents that went
stale the moment it landed, neither of which the release script knows about.

**`docs/SUBMIT.md` named `weft-chrome-1.0.0.zip` in five places, and it is
the runbook a human follows by hand at a store console.** Not a stale count
this time — a stale *filename*, and after the bump there is no such file in
the tree, so step 2 of the Chrome submission would have asked Creagh to
upload something that does not exist while six 1.0.1 zips sat beside it.
Worth naming as its own class: this repository has been careful about
numbers in prose for five sessions running, and a version bump invalidates
**artefact names**, which no count sweep looks at. `git grep '1\.0\.0'`
across the documents, and read each hit for whether it means "the release
that shipped in September" (leave it) or "the file you are about to upload"
(bump it).

**`CHANGELOG.md`'s 1.0.1 entry opened "Not cut yet — `VERSION` … is still
1.0.0", which the commit that cut it made false.** Now says cut, dated, and
explicitly not tagged, with the reason and the blocking item. That sentence
existed because a previous session was careful enough to write down that the
entry described an uncut release; the same care is what makes it wrong now.

Measured on the bumped tree, on Node 26.7, with npm's own exit status
captured rather than a pipe's: `npm run test:all` **exit 0** — typecheck
clean, 486 unit / 122 suites, 98 jsdom / 22 suites, 35 tools / 11 suites,
compat 56 pass / 7 degrade / 0 fail / 0 without data, 979 KB × 3 passing
`validate`, **36 e2e passed and 3 skipped in 2.8 min**, then build and
validate again. Plus the two `test:all` leaves out, which B0 step 2 asks for
by name: `packs:verify` **0 errors / 4 warnings** and `site:check` **711
pages / 16 087 links** all resolving. The packaged `weft-chrome-1.0.1.zip`
was opened and its `manifest.json` read rather than assumed: `"version":
"1.0.1"`, at the root of a flat archive, which is the shape the store
requires.

What needs a human: **B1**, register `weft.study` — now the head of the
critical path, and the first item on the list that genuinely cannot be done
by a session. Then **B2**, make the repository public and push the `v1.0.1`
tag; **B3**, Pages; **B4**, the Lemon Squeezy URLs; **B5**, the store
submission.

### 2026-09-29 — the seeded clock was not the drift, and re-measuring is what said so

The queued item was the note corpus's two quote conventions, with the
direction left open. It is **done** — PR #20 on 2026-09-28 unified on curly,
`tests/tools/lexicon-orthography.test.ts:185` is the guard, and the only
straight `"` left in `tools/seed/*.tsv` are in the `#` header comments the
guard does not scan and should not. Confirmed in a minute, which is what
`TODO.md` is for. The queue has now handed a completed item to five of the
last six sessions.

So the real work was the *uncommitted* tree the previous session left: the
`requireTestBuild()` fixture guard, the seeded attention tile, the three
regenerated `*-05-settings.png`, and a `CLAUDE.md` still holding a literal
`MEASUREMENT_PLACEHOLDER`. All of it good, and one sentence of it false.

**"Two consecutive runs now produce all fifteen shots byte-identical" was not
true when it was written, and the only way to find that out was to run it.**
Re-running the generator twice, a minute apart, on one day, moved all three
`*-04-progress.png` — and moved `chrome-04` and `edge-04`, which the entry
below predicts cannot drift, because the attention tile is cropped out at 800
and 768 px. That prediction is correct and is exactly why the two files were
worth looking at: something *other* than the tile had to be moving. The
recorded caveat blamed the day rollover; both runs were at 00:35.

**No image tooling on this machine, so the diff was done in the browser
already installed for the e2e suite** — a scratch script loading both PNGs
into a canvas and reporting the bounding box of differing pixels. 4416 pixels
at x 389–703, y 135–185, which cropped and rendered is two lines of the
discoveries feed with *montagne* and *forêt* swapped. Not the clock, not
antialiasing, not the day: an **unstable sort**. Worth keeping as a method —
"the shots differ" is not a finding, "these 4416 pixels differ and here they
are" is, and the distance between the two was about four minutes.

`buildDiscoveries` (`src/core/discoveries.ts:227`) sorted on kind, then
recency, and stopped. All nineteen seeded cards carry
`firstSeen: now - 30 * day`, so every pair of the same kind tied on both keys,
the comparator returned 0, and `Array.sort`'s stability handed the result
over to **input order** — whatever the storage round-trip gave back. **A
comparator that can return 0 for two distinct items has not defined an order;
it has delegated one.** That is the transferable half, and it is not a test
concern: a bulk import ties, and so do two words woven into a single render,
so a real user's feed could reshuffle between visits.

**The file had already written this rule down for the other half of the same
feed.** `:118` — descent phrasings varied "by a stable hash of the word. Not
random: the same word always reads the same way, so the feed does not
reshuffle its own wording between visits." The wording was pinned and the
order was not, which is the same shape as PR #14's guard that could not see
`novem`: the unguarded half of a decision already taken. So this is a third
sort key rather than a new policy.

**The third key is `fold(id)`, and the two rejected options are the
interesting part.** Raw code units are deterministic everywhere and put
*pierre* before *père* — `i` is U+0069, `è` is U+00E8 — which is correct and
reads like a bug in a feed of French. `localeCompare` reads correctly and
reintroduces the defect one layer down, since its answer depends on the ICU
data the runtime was built with, so this machine and CI could disagree.
`fold()` was already in the file, is pure string work, and gives
`pere < pierre`. The raw id follows it so the order is total even when two
ids fold alike.

Done test-first, in `tests/core/delight.test.ts` rather than a new file,
because the sibling test three lines up — "descent phrasing varies but is
stable per word" — is the one that should have caught this and cannot: **it
calls `buildDiscoveries` twice on the same array**, so input order is
identical both times and only the wording can drift. The new test permutes
the input. Both new tests were red first, and the accent one is non-vacuous
by construction: code-unit and folded order genuinely disagree on this pair.

**Measured, and this time the sentence is earned:** two consecutive runs of
`WEFT_STORE=1 npx playwright test store-assets` produce all **18** files in
`docs/store/` byte-identical, hashed and diffed rather than eyeballed. Six
shots differ from `main` — the three `*-05-settings.png` from the previous
session, and now all three `*-04-progress.png`: `apple-04` for the 30-minute
tile *and* the ordering, `chrome-04` and `edge-04` for the ordering alone,
which is why they moved 14 and 3 bytes against `apple-04`'s 1022.

**One environment finding, and it is the fourth sighting of the same trap.**
The iCloud conflict copy that has killed `dist/`, `dist/site` and
`test-results/` in previous sessions killed a run here again, as
`test-results/.playwright-artifacts-0 2` and `Unknown system error -11`. The
`com.apple.fileprovider.ignore#P` attribute was set on `dist/` three sessions
ago and **never on `test-results/`**, which is where Playwright now writes.
Set it there too; both are gitignored, local and reversible with `xattr -d`.
`rm -rf test-results` between runs is not enough on its own, because the copy
appears *during* the run.

Counts moved 653 → 655 and unit 484 → 486 in five documents, with
`docs/LAUNCH.md:221` swept **by name and first** for the fourth session
running. Suites did not move: both tests went into an existing `describe`.

Measured at the end, on Node 26.7, with npm's own exit status captured rather
than a pipe's: `npm run test:all` **exit 0** — typecheck clean, **486** unit /
122 suites, 98 jsdom / 22 suites, 35 tools / 11 suites, compat 56 pass / 7
degrade / 0 fail / 0 without data, 979 KB × 3 passing `validate`, **36 e2e
passed and 3 skipped in 2.6 min**, then build and validate again. Separately
`packs:verify` **0 errors / 4 warnings**, unchanged — no pack moved and no
`builtAt` advanced, since nothing here touched a seed — and `site:check`
**711 pages / 16 087 links** all resolving, run because `src/core/` moved and
the site imports from it. The `com.apple.fileprovider.ignore#P` attribute is
now set on `test-results/` as well as `dist/`, and the full gate created
**zero** iCloud conflict copies.

What needs a human: unchanged. **B0 step 2** is the critical path and still
does not need Creagh — `npm run release -- --version=1.0.1` on a branch. Then
**B1**, register `weft.study`; **B2**, make the repository public and push the
`v1.0.1` tag; **B3**, Pages; **B4**, the Lemon Squeezy URLs; **B5**, the store
submission.

### 2026-09-29 — three hypotheses about the source, and the answer was on disk

The queued task was "land the remaining open PRs, three of them blocked by
real merge conflicts". There are **none**: `gh pr list --state open` returns
`[]`, all 23 are merged or closed, and the premise describes the repository
before #22 and #23. Verified rather than reported, because "do not close a PR
to make the list shorter" deserves proof that nothing was lost: #5's and #14's
heads are **ancestors of `main`**, and #3's head carries one commit whose only
content `main` lacks is one screenshot — dealt with below. Written into
`TODO.md` with the commands, so the next session spends a minute rather than
an hour.

So the work was the topmost real item, which `TODO.md` had queued as **the
store-asset generator is broken**. It is not, and the way that was established
is the transferable part.

**The recorded observations were all accurate and the conclusion was wrong.**
`WEFT_STORE=1 npx playwright test store-assets` really did fail in 28 s at
`store-assets.spec.ts:88` waiting for `weft-w`, and really did write nothing.
The entry eliminated three hypotheses — the wrapped renderer, a renamed
settings key, the cooldown layer — and every one of them came back clean,
because every one of them was a question about `src/`. **The variable was
which build of the extension was on disk.** `npm run test:e2e` is
`build:test && playwright test && build`; that trailing `build` deliberately
restores the production extension, and `npm run test:all` ends in `build:all`
for the same reason. A production manifest adds no localhost host permission
(`manifest.config.mjs:107` grants it only under `opts.test`), so
`configure()`'s `origins: []` registers no content script, nothing is woven,
and the spec waits out its 20 s. Confirmed in both directions: production
build → the recorded failure exactly, `:88`, "element(s) not found", 22.1 s;
test build → pass in 35 s.

**The general rule worth keeping: when the three most likely causes all read
clean in the source, stop generating hypotheses about the source and ask what
artefact on disk the test is running against.** Reading `src/` could never
have answered this, however long anyone read it. The guard is in
`tests/e2e/fixtures.ts` rather than in a spec, because the specs that meet
this are the three run by hand — `WEFT_STORE`, `WEFT_SCREENS`, `WEFT_FIRSTRUN`
— and it now throws in **5 ms** naming the cause and `npm run build:test`.

**Believing the generator is what found the real defect.** It reports that
**four of the fifteen** committed shots are stale. Three are
`*-05-settings.png` in all three frames, reading **"60% — 1 word in 2"** —
the unqualified phrasing PR #12 replaced with "60% of content words". #12
regenerated the `docs/` screenshots and not the store ones, and the only
check that could have caught it was the one written off as broken. B5 step 7
uploads these, so the listing art was misquoting the product. Regenerated.

**The fourth was scene 4, and it was photographing the clock.** Four of its
five tiles are seeded through the real import path; "taxed attention today"
was not seeded at all and read whatever the run accrued — `9s` once, `6s`
another time. That also settles a second `TODO.md` note: the 126 711-byte
`apple-04-progress.png` filed as an abandoned stray on one ref, with **do not
"restore" it** against it, is blob `9a935872` — **exactly** what the
generator produced here before the fix. Both variants are legitimate output
of the same code. Nothing was abandoned; the scene was unreproducible, so
"the shots came back byte-identical" could not have meant anything for it.

Seeded at **1800 s** through `record-attention`, chosen because
`formatDuration` prints whole minutes above 60 s, so the run's own seconds are
absorbed below the next boundary — not a frozen clock, a coarser unit. Thirty
minutes is also the figure the listing copy uses for half an hour on a feed.
Done test-first; `tests/tools/store-assets.test.ts` was red on the missing
constant before the spec was touched, and it re-derives the rendered string
across the whole 0-59 s accrual range rather than trusting the two clauses,
with a non-vacuity case that fails for `9s`.

**Measured: two consecutive runs now produce all fifteen shots
byte-identical.** ~~One honest caveat: a run that crosses the day rollover
*mid-run* still differs.~~ **Both sentences were wrong, and the entry above
this one is where that was run down** — scene 4 was still unreproducible
between two runs a minute apart, for a reason that has nothing to do with the
clock. The rest of this entry stands. And a geometry fact that did hold, and
that explains the shape of the evidence here: the tiles are only in shot at
1440×900, so chrome (800 px) and edge (768 px) crop them, which is why the
*attention* drift only ever showed in `apple-04`.

Found on the way and queued rather than fixed, because it is a judgement
about what an import means: **`exportAll()` writes `attention`, `introduced`
and `lock`; `importAll()` reads none of them** and says nothing. Data export
is on the never-gated list precisely so a user can leave with their data, and
a user moving machines currently loses their attention history, their streak
and their cooldown state in silence. Three shapes in `TODO.md`, no preference
recorded — restoring `lock` from a file is not obviously right, since a
shorter cooldown is a difficulty reduction.

Counts moved 649 → 653 and tools 31 → 35 / 10 → 11 suites in five documents,
with `docs/LAUNCH.md:221` swept **by name and first** for the third session
running.

Measured at the end: **nothing.** This session ended before it ran the gate
and before it committed anything — the literal string `MEASUREMENT_PLACEHOLDER`
stood here, and the whole of the work above sat uncommitted in the working
tree until the session above picked it up. The measurement that covers it is
that one's, taken on the combined tree. Two things follow. Write the entry
after the gate rather than before it, so the placeholder can never be the
thing that ships; and an uncommitted tree is the one state no other session
can see, which is why this nearly cost the fix twice over.

What needs a human: **B0 step 2** is still the critical path and still does
not need Creagh — `npm run release -- --version=1.0.1` on a branch. Then
**B1**, register `weft.study`; **B2**, make the repository public and push the
`v1.0.1` tag; **B3**, Pages; **B4**, the Lemon Squeezy URLs; **B5**, the store
submission.

### 2026-09-28 — nineteen commits nobody had merged, and a conflict that was arithmetic

The topmost open item was **B0 step 1: land the stack on `main`**. It is done.
`main` had exactly one of the twenty merged PRs; #2 through #21 had each merged
into the previous PR's *head*, so everything from `/privacy` and `/support`
through the sitemap `lastmod`, the reproducible packs, the honest density copy,
the Latin orthography guard, the descent direction fix and the curly-quote
unification had accumulated on `lexicon/proper-noun-notes` and no commit on
`main` carried any of it. Two of those — the privacy and support pages — are
pages the Chrome Web Store listing is required to point at, so the release was
blocked on work that had already been written, reviewed and CI-passed.

Why it sat: each session read B0's "merging is a human step here, as is
committing to `main`" as covering its own PR as well, stacked onto the previous
head and stopped. That is the failure mode worth naming in `TODO.md`, and it is
named there now. The step that genuinely needs Creagh is the *tag* push, which
fires `release.yml` and publishes outward, plus all of B1–B5. A merge into
`main` through a green PR is not that.

**The conflict turned out to be arithmetic rather than judgement, and that is
the transferable part.** B0 predicted four conflicts and got four:
`.github/workflows/site.yml`, `CLAUDE.md`, `TODO.md`, `tools/build-site.mjs`.
Its advice was to take the two documents from the stack side and read the two
code hunks. Instead: `git rev-parse origin/main^{tree}` returned `cbf3f4ae`,
**byte-identical to `02fc7d8`'s tree**, and `02fc7d8` is an ancestor of the
stack. `main` therefore contributed nothing to any path; the correct merge
result was the stack's tree exactly. Resolving all four to `--ours` and
comparing `git write-tree` to `f4e4753`'s tree — both `02c281a4` — proved the
merge changes not one byte of content and only joins the histories. Before
hand-resolving a conflicted merge, compare tree SHAs first.

One assumption the old B0 text got wrong and this corrected: `main`'s
`CLAUDE.md` was called "#1's first draft", but `main` is #1 **and #2**
squashed, because #2 merged into #1's branch nine seconds before #1 merged to
`main`. Taking the stack side was still right, for a stronger reason.

Assumed, because nobody was available to ask: that landing the stack is within
a session's remit even though `TODO.md` filed it under Blocked, on the grounds
that the run's own instructions say work parked in an unmerged PR is work
nobody has, and that the outward-facing step B0 protects is the tag push, which
was not touched. That the version bump (B0 step 2) is likewise a branch-and-PR
job and not Creagh's, and it is re-filed that way. PR #14 was closed as
superseded and its branch deleted; its content is in `main`.

**Measured on the merged tree before merging, Node 26.7 (`.nvmrc` pins 22, CI
pins 22, and it passed on both):** `npm run test:all` exit 0 end to end —
typecheck clean, unit/dom/tools green, compat clean, all three targets built at
979 KB, `validate` passing on all three, **36 e2e passed and 3 skipped by
design in 3.4 min**. Plus the two the gate does not include: `packs:verify`
**0 errors, 4 warnings** (the four Old English interjections with no IPA, as
always), and `site:check` **711 pages, 16 087 internal links, all resolve, and
all 3 externally-referenced pages exist**. CI on GitHub ran the same gate on
Node 22 and passed in 2 min 57 s (run 36498343742).

One thing found and run down far enough to be worth acting on, written up in
`TODO.md`: **the store-asset generator is broken.** `WEFT_STORE=1 npx
playwright test store-assets` fails in **28 seconds** on a clean serial run and
writes nothing — every file in `docs/store/` keeps its checkout mtime. An
earlier run in this session took 35 minutes, but that was contention; the
failure reproduces immediately on an idle machine. It dies at
`store-assets.spec.ts:88` waiting for `weft-w`, the wrapped renderer's per-word
element, on `showcase.html`.

Three hypotheses were eliminated, and the order matters because the scariest
one went first: **the wrapped renderer is not broken.** It is the screen-reader
path and the one Safari 16.4–17.1 takes, so "it regressed with no coverage"
would have been serious — but `friction.spec.ts:28,75` assert `weft-w` visible
in wrapped mode and pass in the gate, as do the wrapped cases in
`weaving.spec.ts` and `privacy.spec.ts`. Nor was any settings key renamed, and
nor is it contention. The cooldown layer looks like a candidate — `baseRatio`
and `ceilingRatio` are governed paths in `src/core/lock.ts:34–35` — but this
spec *raises* both, and raising is the harder direction, which applies at once.

**What is at stake is not a screenshot.** This file and `TODO.md` both record
that all fifteen shots were regenerated on 2026-09-28 and "came back
byte-identical", which is what retired the worry that the listing art might
show a pre-`3060d93` French lexicon. A failing generator writes nothing, and
"no file changed" is exactly what a run that never reaches its writes looks
like from outside — indistinguishable from a successful idempotent one. So
treat that reassurance as withdrawn until the generator runs. B5 step 7 uploads
the committed files and is not blocked; they exist at the exact required sizes.
At 28 s a run, bisecting #5–#21 is about five builds, and #4 is the last point
measured working. Queued.

Still needs a human, unchanged: **B1**, register `weft.study`; **B2**, make the
repository public and push the `v1.0.1` tag; **B3**, turn on Pages; **B4**, the
Lemon Squeezy checkout URLs; **B5**, the Chrome Web Store submission itself.

### 2026-09-28 — the queued task was already done; the item after it was not

The queue handed this session the lowercase-note fix by name — "247 of 318
notes begin lowercase" — but `TODO.md` showed it already `[x]`, closed by
PR #19 the same day, and `70c2db9` was already this branch's tip before a
single tool call ran. Nothing to redo. `TODO.md`'s own convention is to work
the topmost unchecked item, and there was exactly one: the quote-mark item
this file's `Next` section had already measured and left as an open
judgement call, with no stated preference.

**Reading the full 59 rather than the handful this file had already quoted
is what decided it.** The recorded argument for leaving Latin/Old English's
straight quotes and French's curly ones as two conventions was that the
packs quote different kinds of thing — target-language citation forms versus
English words. It is a reasonable argument and every example this file had
quoted for it (`"mann"`, `"mālum"`, `"ne ǣfre"`) was consistent with it. It
is also wrong: a third of the 59 straight-quoted notes cite **English**
words, not target-language forms — `"muscle"` (mūs), `"despair"` (spēs),
`"hopeless"` (lēas), `"warden"` (weardian), `"hale"` (hāl), `"bank teller"`
(tellan) — the identical job French does in curly. The split tracks which
pack a note was typed into, not what kind of word it names. **The general
form, worth keeping alongside this file's other "measure before choosing"
entries: when a queued item states an argument *for* its own recorded
preference, check whether that argument was verified against the whole set
it describes, or only the examples that happened to be quoted alongside it.**
A handful of confirming examples reads as evidence; here it was a sample of
convenience.

Unified on curly — the only option `TODO.md` had costed out (~30 minutes)
and the convention the site's own prose already uses everywhere else (24
curly quotes, zero straight, in `site/index.html`). The third option it
named, `<em>` for cited forms, was ruled out on inspection rather than
cost: `src/content/tooltip.ts`'s `el()` sets `textContent`, never
`innerHTML`, so the tooltip note is plain text with nothing to render
markup into — that option would need new rendering support on a surface
nowhere budgeted for it.

Converted all 59 notes in `tools/seed/lex-la.tsv` (12) and `lex-ang.tsv`
(47), pairing each straight quote with curly open/close in sequence after
confirming every note carries a balanced, even quote count. A scratch script
did the mechanical pairing; the diff was read line by line afterward to
confirm only the note column moved (the `"wend one’s way"` note, which
already mixed a curly apostrophe with straight double quotes, came through
with the apostrophe untouched). Guarded in
`tests/tools/lexicon-orthography.test.ts`, the suite this file named as
already policing pack spelling conventions: no note in any of the seven
packs may contain a straight double quote, derived from `src/lexicon/packs/`
directly rather than a hand-maintained language list, so an eighth pack
needs no edit here. Done test-first; the red run named all 59 distinct
notes as more instances (a note shared by `door`/`doors` counts once per
surface form) before any seed file was touched.

Rebuilt both packs. `en-ang.json`'s `builtAt` advanced 09-26 → 09-28, its
first edit today; `en-la.json`'s stayed 09-28, already stamped today by
earlier sessions' edits to the same seed file. `index.json` untouched, since
no count moved. Verified by rendering, the house rule this file keeps
proving right: `/old-english/mann`'s descent sentence and the
`old-english-words-that-became-english` hub's note column both now read
`“mann” meant a human being of either sex` with curly marks, on both
surfaces at once.

**Environment finding, worth recording alongside the iCloud entries this
file already keeps.** Partway through, `git rev-parse HEAD` returned `main`'s
commit rather than this branch's tip, with no command from this session
responsible. `git reflog --date=iso` on the primary working directory named
it precisely: a `checkout: moving from lexicon/proper-noun-notes to main`
and a `merge origin/main: Fast-forward`, both timestamped about four minutes
into the session — most likely Creagh, working in the same checkout this
file's own instructions run in, picking up B0 live. `ListAgents` showed no
other `weft`-named session to account for it. **The response, worth reusing:
stop, and move the actual work into an isolated `git worktree`
(`.worktrees/`, now gitignored) branched from `origin/lexicon/proper-noun-notes`
rather than the primary directory's checkout, and land by pushing a new
branch and opening a PR against the stack head rather than committing in
place.** Nothing in this session touched `main` or the primary directory's
working tree at any point after that discovery. The fix (PR #20) landed the
same way PRs #15–19 did: opened against `lexicon/proper-noun-notes`, CI
green in 2m58s, squash-merged, branch deleted. `main` and B0 are untouched.

Measured at the end, inside the isolated worktree, on Node 26.7, with npm's
own exit status captured rather than a pipe's: `npm run test:all` **exit
0** — typecheck clean, 484 unit / 122 suites, 98 jsdom / 22 suites, **31
tools / 10 suites** (one new `describe`, two new tests), compat 56 pass / 7
degrade / 0 fail / 0 without data, 979 KB × 3 passing `validate`, 36 e2e
passed and 3 skipped in 3.1 min, then build and validate again. Separately
`packs:verify` 0 errors / 4 warnings, unchanged, and `site:check` 711 pages
/ 16 087 links all resolving — run here because two shipped packs moved and
the pages they feed are published copy. `<lastmod>` moved to today on 705 of
713 sitemap entries, because `en-ang.json` had not been touched today before
this edit and most Old English word pages take their pack's `builtAt` — the
same pack-granular coarseness this file already records, not a new defect.

What needs a human: **B0**, unchanged — one conflicted merge into `main`,
four files named there, and — per the finding above — quite possibly already
in progress on Creagh's own machine as this session ran. `Now` and `Next`
are both empty. Nothing here is agent-actionable until B0 or B1 move.

### 2026-09-28 — the exception list the item asked for was a fifth of the corpus

`TODO.md`'s only item was the lowercase note the previous session found by
rendering `/latin/mille`: `tools/build-site.mjs` put the note in the *same*
`<p>` as the descent sentence, after that sentence's full stop, so **55** word
pages opened a second sentence in lower case — "…your English *mile* was
borrowed from. a mile was mīlle passūs, a thousand paces." The item offered
three shapes and preferred the second, capitalising the first letter at render
time, "with a measured exception list", and asked for the list to be measured
before choosing.

**Measuring it is what disqualified the shape, and that is the transferable
half.** Of the **99** notes that reach a word page, **39** open with a
quotation mark around a cited target-language form (`"mann" meant a human
being of either sex`) and **5** open with a proper noun. So
`charAt(0).toUpperCase()` is a **silent no-op on 44 of the 99** — and on the
one un-quoted citation, `paene īnsula, almost an island`, it is not a no-op but
a mistake, capitalising a Latin phrase that is being quoted rather than used.
Shape 1, the dash, needs no list, and the reason is the finding: **every
capital already in the corpus is required by a name — Jenner, Janus,
Argentina, September, November — rather than by sentence position**, so a dash
can never produce a spurious one. The general rule: *before writing an
exception list for a transform, check whether the set needing the exception is
the same set the transform silently misses. If it is, the transform is the
wrong tool.* `descentSentence()` now takes the note and joins it with ` — `,
one sentence with one full stop at the end.

**Three of the item's numbers were larger than the job, all for structural
reasons worth knowing.** "247 of 318 notes begin lowercase" counts *instances*
across all seven packs; the transform acts on strings, of which there are
**185** distinct — `door`/`doors` share `iānua`'s — and only **99** reach a
word page, because French carries 85 notes and `DEEP = ['la','ang']` gives it
no word page. "71 notes begin with a capital" is **5** once quotation marks are
separated from letters. And the "Worth knowing" branch the item named as a
second site renders on **0** of the 711 pages: every Latin and Old English
entry with a note also has an `etymonOf`. Left alone, and it is not the same
defect anyway — a bare note under a heading is the *caption* frame, which is
what these fragments are written for and what the tooltip's `<div
class="note">` and the hub's `<td>` already give them. **Four sessions running
the queued item's premise, remedy or arithmetic has been partly wrong, and all
four times what settled it was rendering the page and reading it.**

**The rule is about the paragraph, not the letter.** One sentence, one full
stop, and it comes last — `/\.\s*\S/` over the `after` half of the split the
previous session's guard already computes, which is exactly where the note
lands. That is strictly stronger than "no sentence starts in lower case", which
would have waved all 39 quoted notes and all 5 named ones through. Done
test-first; the red run named **99** pages and reported only **1** note already
joined — `wes hāl` → wassail, whose note contains a dash of its own, and which
renders as a clean parenthetical. Two tests in the existing
`tests/tools/build-site.test.ts` rather than a tenth file, same seam argument as
last session: it already renders every word page into `mktemp -d`. Nine pages
read one per class: `mille`, `paene`, `vacca`, `novem`, `mann`, `wes-hal`,
`micel`, `vir`, `malum`.

One thing to know before touching this again: **the diff is six times wider
than the fix and that is correct.** Dropping the note's own interpolation
removed a blank line inside the descent `<p>`, so **637** word pages changed
bytes where only the **99** changed visibly; HTML whitespace collapse makes the
rest invisible. `sitemap.xml` is byte-identical, so nothing was redated. And
**shape 3 is now strictly worse than it was**: capitalising the seed notes would
make three surfaces worse and none better, since the word page no longer needs
the capital. Recorded in `TODO.md` Notes so it is not revisited.

Counts moved 645 → 647 and tool suites 8 → 9 in **six** documents, with
`docs/LAUNCH.md:221` swept **by name and first** for the second session
running — the cheap fix for the structural reason it kept being missed.

Measured at the end, on Node 26.7, with npm's own exit status captured rather
than a pipe's: `npm run test:all` **exit 0** — typecheck clean, 484 unit / 122
suites, 98 jsdom / 22 suites, **29 tools / 9 suites**, compat 56 pass / 7
degrade / 0 fail / 0 without data, 979 KB × 3 passing `validate`, 36 e2e passed
and 3 skipped in 1.9 min, then build and validate again. Separately
`site:check` 711 pages / 16 087 links all resolving — run here because the
change is *to* published
copy on 99 pages — and `packs:verify` not re-run, because no pack moved and no
`builtAt` advanced. The `com.apple.fileprovider.ignore#P` attribute is still
set on `dist/` and the full gate created **zero** iCloud conflict copies for the
fifth session running.

**Measuring the corpus found the next item, as rendering it has every session
this week.** The notes disagree with themselves about quote marks and the split
is exactly along pack lines: **59** distinct notes use straight `"` (en-ang 47
of 72, en-la 12 of 28), **84** use curly `“ ”` (all of en-fr), and **zero mix
the two**. So it is two conventions rather than 59 typos — and the site's own
prose is curly-only, 24 to nothing in `site/index.html`. It lands hardest on
the deep packs, because they are the ones with word pages, so all 59 are on a
published page *and* in the tooltip *and* in the hub's note column. Queued with
the judgement stated rather than decided: Latin and Old English quote
*target-language citation forms*, where straight quotes are a linguistic
convention, and French quotes *English words* in prose, where curly is simply
correct — so "unify on curly" and "two different jobs, leave both" are both
defensible, and it is a seed edit either way, which rebuilds two packs and
redates ~637 sitemap entries.

What needs a human: **B0**, unchanged from the last two sessions — one
conflicted merge into `main`, four files named there. `Now` is empty; `Next`
has the quote-mark item above, which is agent-shaped and does not wait on B0.

### 2026-09-28 — the queued item named the fix, and the fix was one word wrong

`TODO.md`'s only item was the backwards Latin descent sentence the previous
session found by rendering `/latin/novem`: `META.la.descent`
(`tools/build-site.mjs:62`) ended in a preposition and `:286` appended the
descendant after it, so **312** published pages read "This is the Latin word
your English borrowed from **November**" — English took *novem* **from**
*November*, the descent stated backwards. The item offered two shapes and
preferred the second, a prefix/suffix split keeping *borrowed*, because
*borrowed* is accurate for a learned borrowing where the Old English sibling's
*became* is not: `vaccine` did not become anything.

**The split is right and the sentence it proposed is not, which is the
transferable half.** "The Latin word your English *November* borrowed from"
puts *November* in the subject slot of *borrowed* and so makes the English
word the **borrower**. The borrower is English the language, and the codebase
already had the idiom written down — `src/core/discoveries.ts:145`, "English
borrowed ${descendant} from ${target}". One word of passive settles it:
`{ before: 'This is the Latin word your English', after: 'was borrowed from' }`,
rendering **"This is the Latin word your English *November* was borrowed
from."** Old English keeps an empty `after` and its 325 pages came out
byte-identical. **Two sessions running found the queued *premise* wrong
(`iānua`, then `/latin/novem`'s heading); this one found the queued *remedy*
wrong. In all three the thing that settled it was building the page and
reading it** — a queued item that names its own fix has usually had that fix
reasoned about rather than rendered.

**The guard is one word, chosen by measurement.** The general rule — a
descendant must not be the object of a preposition — is wrong, because most
prepositions take it correctly ("the ancestor **of** November"). *From* is the
one that cannot: in a descent sentence it names the source, and the source is
the page's own headword. `/\bfrom$/` over the text preceding the `<strong>`
fired on **312** Latin pages and **zero** of the 325 Old English ones, so the
rule separates the two frames with no curated exclusion list — the same
derive-it-from-the-data move PR #14 made with capitalisation. Done test-first;
the red run named all 312 before anything was edited.

**It went into `tests/tools/build-site.test.ts` rather than an eighth file,
and the reason is the seam rather than the clock.** A test of this tool must
render into `mktemp -d` and never into `dist/site`, which `npm run site:check`
reads; a second suite would duplicate that setup to re-derive the same 711
pages. The build is **0.6 s**, so cost was not what decided it. Three tests:
the rule, a check that the descendant is actually in the sentence (the cheap
way out of the rule is to delete it rather than move it), and a non-vacuity
floor. Note for the next count sweep: **`suites` counts `describe` blocks, not
files** — one new `describe` in an existing file moved `test:tools` from 7
suites to 8 across the same six files.

**Rendering the fix found the next item, as it has every session this week.**
`/latin/mille` now reads "…your English *mile* was borrowed from. a mile was
mīlle passūs" — the note joins the descent sentence's full stop in lowercase.
That is not this fix's doing and it is not rare: **247 of the 318** notes
across the seven packs begin lowercase, because they are written as appositive
fragments for the tooltip, where `src/content/tooltip.ts` gives each one its
own `<div class="note">` and it lands correctly as a caption. The word page is
the only surface that joins a note to a finished sentence. Queued as the one
item in `Next` with three candidate shapes and a preference, because which
corpus to move — 1 template, 1 render-time transform, or 247 seed rows — is a
judgement about the note corpus rather than a defect with one answer.

Counts moved 642 → 645 and suites 7 → 8 in **six** documents, with
`docs/LAUNCH.md:221` swept **by name and first** — the Journal entry below
records it being missed three times, always because it is the only count
sitting inside a blockquote of copy rather than a command table. Taking it
first rather than last is the cheap fix for that.

One small thing worth knowing rather than fixing: the install page's
`<lastmod>` will now say today, because `tools/build-site.mjs` is one of the
two files `contentDate()` reads for it — that page's prose lives in
`installPage()` — so editing the *word-page* template in the same file redates
a page whose text did not change. Same coarseness class as the pack-granular
dates, and nothing is indexed yet (B3).

Measured at the end, on Node 26.7, with npm's own exit status captured rather
than a pipe's: `npm run test:all` **exit 0** — typecheck clean, 484 unit / 122
suites, 98 jsdom / 22 suites, **27 tools / 8 suites**, compat 56 pass / 7
degrade / 0 fail / 0 without data, 979 KB × 3 passing `validate`, 36 e2e
passed and 3 skipped in 2.9 min, then build and validate again. Separately
`site:check` 711 pages / 16 087 links all resolving — run here because the
change is *to* published copy on 312 pages — and `packs:verify` 0 errors / 4
warnings, unchanged, since no pack moved and no `builtAt` advanced. The
`com.apple.fileprovider.ignore#P` attribute is still set on `dist/` and the
full gate created **zero** iCloud conflict copies for the fourth session
running.

What needs a human: **B0**, unchanged from the last session — one conflicted
merge into `main`, four files named there. `Now` is empty; `Next` has the
lowercase-note item above, which is agent-shaped and does not wait on B0.
Nothing else moved.

### 2026-09-28 — the guard could not see the gap the same session left

`TODO.md`'s top item was one seed field: give `novem` → November the note
`septem` → September had just gained. The last run had written the note out
in full and then declined to apply it, on the grounds that writing lexicon
*content* is a different decision from fixing a defect. The queue asked for it
in as many words, so that reservation is lifted and the proposed sentence went
in unchanged — `tools/seed/lex-la.tsv:373`, "November was the ninth month of
the old Roman year". Both surfaces were checked **by rendering**, which is the
house rule for this file and which the previous two sessions also paid for:
`/latin/novem` and `/latin/septem` are now the same shape sentence for
sentence, and the hub table's note column is full where it rendered empty
directly under September's.

**The transferable half is why PR #14's guard was silent on a defect PR #14's
own session had found.** `tests/tools/lexicon-notes.test.ts` derives a rule
from the data — a note whose descendant is a proper noun must *name* it,
because a proper noun cannot be alluded to — and its loop opens
`if (!note || !etymonOf || !isProperNoun(etymonOf)) continue`. `novem` had no
note, so it was skipped, correctly and uselessly. **The general form is worth
keeping: a guard that filters on the presence of a field can never police that
field's absence, so absence has to be asked about separately.** Here it was
also a defect, and the answer is one more test in the same file rather than a
new suite — an eighth suite would have implied a new rule where this is the
unguarded half of an existing one, exactly as #14's note-versus-badge finding
was the unguarded half of `tooltip.ts:320`.

**Narrow for a measured reason.** The obvious rule — an entry with an
`etymonOf` should explain it — is wrong **962 times out of 1131** across the
seven packs, and rightly: an ordinary descendant is inferable from the
headword printed beside it, *octō* under "Ancestor of English octave"
explaining itself. A name is not; *novem* under "Ancestor of English November"
tells the reader nothing about why nine became a month. Capitalisation
separates the two — the same derivation #14 used, and the same reason it beats
the curated `UNDEFINED` list PR #13 needed — leaving **5 rows** to police, four
distinct entries because `door`/`doors` share `iānua`'s note. Done test-first;
the red run named exactly one offender,
`en-la nine → novem: nothing says why it became "November"`, with no false
positives.

The rebuild behaved as the reproducibility fix promises: **1 field of 7088**
in `en-la.json`, `index.json` untouched because a note is not a count
(`packs:verify` still reports en-la at 584 entries / 579 surface forms), and
`builtAt` stayed 2026-09-28, so **zero** sitemap entries were redated.

**The count sweep found the public document stale again, and that is now a
pattern rather than an incident.** Counts moved 641 → 642 in **six**
documents, one more than the usual five, because `docs/LAUNCH.md:221` still
said "638 tests" inside the Show HN draft — precisely the pre-#14 total
(484 + 97 + 21 + 36). #14 added one jsdom test and two tool tests, moved five
documents to 641, and missed that one. This file's Journal already records
"449 tests" in the same draft on 2026-09-27 and the same draft wrong again at
the 617 → 620 sweep. The reason it keeps being missed looks structural: it is
the only count that sits inside a blockquote of copy rather than in a command
table or a test-count sentence, so a reader sweeping "the documents that state
test counts" does not see it as one. Re-sweep it by name.

**B0 was re-measured and is stale in the one way that matters: `main` has
moved.** Its text says "`main` did not move", which was true when written.
Creagh merged **#1 into `main`** at 15:26:13 UTC and #2 into #1's branch at
15:26:04, after the nine top-down merges at 15:18–15:19. `main` is `f6733af`;
#3 and #5 are **closed**, #1/#2/#4 merged, and #14 was the only open PR before
this session's. So B0's "close #1, #2 and #3 as superseded" step is already
done and the drifted-screenshot hazard it warned about is gone — #3 cannot be
merged first because it cannot be merged at all. **What replaced it is a
conflict.** #1 was *squash*-merged, so `main` holds a new commit carrying #1's
content while the stack still carries #1's original `ee277d2`; the merge base
falls back to `3060d93` and git sees two independent creations of the same
files. Trial-merged in memory with `git merge-tree --write-tree origin/main
HEAD`: **four conflicts** — `.github/workflows/site.yml`, `CLAUDE.md`,
`TODO.md`, `tools/build-site.mjs`. The two Markdown ones take the stack's side
wholesale; the two code ones are #6's `fetch-depth: 0` and eight sessions of
site-builder edits against #1's copies, which is the same squash artefact
rather than a disagreement. Written into B0.

**Rendering the fix found a bigger defect than the fix, which is the argument
for the house rule.** `/latin/novem` reads "This is the Latin word your
English borrowed from **November**." Subject "your English", verb "borrowed",
"from November" the source — it states the descent **backwards**, that English
took *novem* from *November*. `META.la.descent`
(`tools/build-site.mjs:62`) ends in the preposition and `:286` appends
`<strong>${entry.etymonOf}</strong>` after it, so the construction the wording
was written for — "the Latin word your English *November* borrowed from",
descendant before the preposition, "word" elided — is broken by where the
builder puts the descendant. Its sibling four lines down,
`META.ang.descent` = "This is the Old English word that became", takes its
object at the end and is correct on all **325** Old English pages. The Latin
sentence is on **312**. Queued as the only item in `Next`, with the two
candidate shapes and a preference, because *borrowed* is the accurate verb for
a learned borrowing and *became* is not — `vaccine` did not become anything.
Not a lexicon edit and no pack rebuild.

Measured at the end, on Node 26.7, with npm's own exit status captured rather
than a pipe's: `npm run test:all` **exit 0** — typecheck clean, 484 unit / 122
suites, 98 jsdom / 22 suites, **24 tools / 7 suites**, compat 56 pass / 7
degrade / 0 fail / 0 without data, 979 KB × 3 passing `validate`, 36 e2e
passed and 3 skipped in 2.2 min, then build and validate again. Separately
`packs:verify` 0 errors / 4 warnings and `site:check` 711 pages / 16 087 links
all resolving — both run here because a shipped pack moved and the two pages
it feeds are published copy. The `com.apple.fileprovider.ignore#P` attribute
is still set on `dist/` and the full gate created **zero** iCloud conflict
copies for the third session running.

This session's own PR was **#15**, and it is merged: squashed into #14's head
(`lexicon/proper-noun-notes`) at 18:54 UTC with CI green end to end, including
the `Committed packs match the seed lexicons` step that rebuilds the packs on
Node 22 and diffs them. So the stack is back to a single open PR, #14, now
carrying both.

What needs a human: **B0**, rewritten again this session — still one merge to
`main`, but a conflicted one, with the four files named. `Now` is empty;
`Next` has the backwards Latin descent sentence above, which is agent-shaped
and does not wait on B0. Nothing else moved.

### 2026-09-28 — the note leaned on a line the reader can switch off

`TODO.md`'s queued item said the tooltip under `iānua` "never says *which*
month". It does, on every surface the item named: the tooltip prints
`Ancestor of English **January**` immediately above the note
(`src/content/tooltip.ts:327`), `/latin/ianua` makes it the `<h2>`, and the
descent hub puts it in the adjacent `<td>`. So the premise was wrong and the
proposed edit was redundant — but only because of a **default**.

`reveal.showEtymon` is a user switch (`src/ui/options/sections.tsx:463`,
default true at `src/core/settings.ts:196`). Turn it off and the badge goes;
the note does not, because `tooltip.ts:336` appends it unconditionally. "Gave
the month its name" then has no antecedent anywhere on the card. **The file
had already written the rule down for the note's sibling** — the "why"
sentence is handed `allowEtymon: reveal.showEtymon` with the comment "must not
reinstate a fact they hid" (`tooltip.ts:320`) — so this was an unguarded half
of an existing decision rather than a new one.

**The class is derivable, and that is the transferable part.** Sweeping for
"notes that never name their etymon" fires **62 times of 99** and is almost
all false positives: `persōna`'s "originally an actor's mask" and `bōc`'s "a
beech-wood tablet" describe the *target* and read perfectly alone. What
separates the real cases is that their descendant is a **proper noun**, and a
proper noun cannot be alluded to, only named — "the month" and "the country"
are placeholders, not descriptions. Every `etymonOf` across all seven packs is
an ordinary English word stored lowercase except four, so capitalisation
derives the rule straight from the data, with **zero** false positives. No
hand-curated table, unlike the `UNDEFINED` list PR #13 had to fall back on
when its own derivation could not see `īnsula`.

Three offenders, all Latin, all fixed in `tools/seed/lex-la.tsv`:
`iānua` → January, `argentum` → Argentina, and `septem` → September. The last
is the worst: with the badge off, "the seventh month of the old Roman year"
does not merely dangle, it reads as a *gloss*, and *septem* means seven. The
fourth capitalised etymon, `novem` → November, carries no note at all, which
the rule correctly skips — and which is now the top item in `TODO.md`, because
the hub table renders its empty note cell directly under September's full one.

Done test-first; the red run named all three before anything was edited (four
lines, because `door` and `doors` share one note). Two guards, because the
finding has two halves. `tests/tools/lexicon-notes.test.ts` is the rule, a
**seventh** tools suite; it also asserts the rule has something to police, so
it cannot go quietly vacuous the way a scan over an empty set does. And one
jsdom test pins the premise — that the note survives when the badge is hidden
— which nothing asserted before, so if the note ever becomes conditional too
the guard will be policing a problem that no longer exists and the test says
so.

The repetition the fix creates on the word page ("Where *January* comes from
… borrowed from **January**. … gave January its name") was **checked by
rendering, not reasoned about**: it is the house pattern already shipping
under `mīlle` ("Where *mile* comes from … A mile was mīlle passūs") and
`vacca`. Rebuilt: **4 fields of 7087** in `en-la.json`, `index.json` untouched
because no count moved, and `builtAt` stayed 2026-09-28 — so unlike PR #9 this
edit redated **zero** sitemap entries.

**The stack is not thirteen PRs any more, and `TODO.md`'s B0 would have done
the wrong thing.** Creagh merged nine of them at 15:18–15:19 UTC, top-down,
each squash cascading the accumulated work one step further down and GitHub
deleting the head branch behind it. `main` never moved. #5 was *closed* rather
than merged, which broke the chain and left **all** the work on its head
branch, `tools/reproducible-lexicon-packs`. #1 and #2 are strict ancestors of
it; #3's head moved to `51503a7` and is not, but the only thing it carries
that the stack lacks is `docs/store/apple-04-progress.png` — the date-drifted
dashboard capture PR #12 reverted five siblings of. So B0 is now one merge,
and merging #3 first would reintroduce exactly what #12 removed.

One environment note, confirming the last session's fix: the
`com.apple.fileprovider.ignore#P` attribute is still set on `dist/`, and the
full gate created **zero** iCloud conflict copies again. `rm -rf test-results`
beforehand is still worth it.

Measured at the end, on Node 26.7, with npm's own exit status captured rather
than a pipe's: `npm run test:all` **exit 0** —
typecheck clean, 484 unit / 122 suites, **98** jsdom / 22 suites, **23 tools /
7 suites**, compat 56 pass / 7 degrade / 0 fail / 0 without data, 979 KB × 3
passing `validate`, 36 e2e passed and 3 skipped in 2.5 min, then build and
validate again. Separately `packs:verify` 0 errors / 4 warnings and
`site:check` 711 pages / 16 087 links all resolving — both run here because a
shipped pack moved and the three word pages it feeds are published copy. Counts
moved in five documents; `README.md` was the odd one out, see `TODO.md` Notes.

What needs a human: **B0**, rewritten this session — it is one merge now, not
thirteen, and this session's PR is #14 on top of the same branch. `Now` is
empty; `Next` has the `novem` note. Nothing else moved.

### 2026-09-28 — the card was stable; the guard could not see the word it was missing

`TODO.md`'s queued item was `npm run og` byte-stability, and it had already
been closed by PR #10 earlier the same day. So this pass reproduced it instead
of believing it: three fresh runs wrote `6f2ef13f…eb6f3e66`, byte-identical to
the committed `site/og.png`, to each other and to PR #10's recorded hash, with
`git status` clean each time. Worth recording *why*, because it is not the
pack builder's reason or the sitemap's: **`tools/make-og.mjs` has no
`new Date()` in it at all.** It screenshots a static HTML string, so there was
never a logical clock to remove and the only wobble available to it was the
renderer's own — font fallback, Chromium's PNG encoder, antialiasing. On this
machine there is none. That closes the trio: `packs`, `site` and `og` are all
measured byte-stable, and nothing in either pipeline can hand `npm run release`
the dirty tree it refuses.

**The substantive half is what the re-check found on the way, and PR #10 had
already found it and declined to fix it as out of scope for a docs sweep.** Its
commit message calls it "one adjacent pack-note inconsistency": `paene`'s note
spells `insula` bare. It is **six** sites, and three of them are copy a
stranger reads — the tooltip that ships in the extension, the "Where
*peninsula* comes from" section of `/latin/paene`, and the note column of
`latin-words-in-everyday-english`, which is the descent hub `docs/LAUNCH.md`'s
r/latin draft exists to link to. The rest: `README.md:93`,
`docs/PEDAGOGY.md:117`, and the seed comment at `tools/seed/lex-la.tsv:21`.
Four files to edit rather than six, because the first three are one pack note
rendered three ways.
Two places already had `īnsula` (`docs/LAUNCH.md:140`, `site/index.html:222`),
so this was the repository disagreeing with itself rather than a call about how
to spell a word — and `īnsula` is what vowel-lengthening before `ns` gives
anyway, the rule behind `cōnsul` and `mēnsa`.

**Why PR #9's guard could not see any of it is structural, not an oversight.**
`tests/tools/lexicon-orthography.test.ts` builds its vocabulary by walking
`tgtLemma` across the packs, so every word it can police is a word the lexicon
*defines*. Prose is under no such limit — it explains `peninsula` with a Latin
word the lexicon never glosses — and `īnsula` was therefore invisible by
construction, including inside the two documents the guard was already
scanning. The fix is a second, hand-curated vocabulary, `UNDEFINED`: the Latin
Weft writes down but does not carry. It is checked against *every* note in both
packs, where the headword rule is deliberately narrowed to the entry that owns
it, and that asymmetry is the point — the headword list contains English
homographs nobody chose (`an`, `is`, `dead`, `ham`, the 14 false positives #9
measured), and this one contains only words somebody checked.

**Two more documents joined the prose guard, and finding them is the
transferable part.** #9 excluded `docs/LAUNCH.md` and `docs/PRIVACY.md` for
named homographs and stopped at three files, which had quietly come to read as
"every other document is excluded". Only those two had ever been measured.
Adding `site/index.html`, `docs/STORE-LISTING.md` and `docs/LAUNCH.md` together
fires **exactly one** offender — the known `dies`/`diēs` — so the first two are
clean and are now in `PROSE`. The landing page and the copy that goes to Google
were the last two places a misspelling should have been able to survive. The
rule: when a gate excludes something, check whether the exclusion was measured
or inherited.

**Read, not grepped, and grep could not have worked.** 27 distinct Latin notes
and 72 Old English, 99 in all, read in full — a grep needs a pattern and the
pattern here is "a Latin word that should carry a macron", which is undecidable
without a macronizer. **Old English came back clean**, which is worth recording
so nobody pays for it twice: every OE word quoted in a note already carries its
macrons and palatal diacritics. Latin had exactly the one defect. Left alone on
purpose: the note under `iānua` says "Janus, god of doorways" — the English
name of the god in English prose, the same register as the adjacent note's
"Jenner", not a failure to write `Iānus`.

**The audit covers all seven packs, which was checked rather than assumed.**
`es`, `de`, `it` and `pt` carry **no notes at all**; French carries 85, and
every one of them is one of two templates — "shares a root with English *X*"
and "the root of English *X*" — which quote an **English** word, never a French
one. Not one French note contains an accented character, and that is the
templates working, not a defect hiding. The class is structurally absent
outside Latin and Old English, and would only appear if a note began quoting
the target language.

Done test-first, and the red run named all three scanned sites at once
(`en-la almost → paene`, `README.md`, `docs/PEDAGOGY.md`) before anything was
edited. The rebuild then demonstrated PR #5's fix again: **1 field changed out
of 7087**, `index.json` did not move because no count did, and `builtAt` stayed
2026-09-28 — so unlike #9 this edit redated **no** sitemap entries.

**Two environment findings, and the first one invalidated this session's own
first two measurements.** `npm run test:all | grep ...` reports **grep's** exit
code, not npm's — so a run that died reads as `[exited with code 0]`, and the
journal's convention is to quote exactly that. Two runs here looked green that
way; run with `> log 2>&1; echo $?` instead, and one of them turns out to have
exited **1**. Anything claiming `test:all` passed should have captured npm's
own status. Second: the iCloud trap this file records three times is worse than
recorded. Cleaning `dist/` beforehand is **necessary but not sufficient** —
both failures here were conflict copies that appeared *during* the run
(`dist/chrome/_locales 2` at `validate`, `dist/chrome/assets 2` at the rebuild
after e2e), as unreadable directories with 65535 links. What actually holds is
telling macOS File Provider to leave the directory alone, once:
`rm -rf dist && mkdir dist && xattr -w 'com.apple.fileprovider.ignore#P' 1 dist`.
Done on this machine; the next full run created **zero** conflict copies and
exited 0. It is local, gitignored and reversible with `xattr -d`.

Measured at the end, on Node 26.7, with npm's own exit status captured rather
than a pipe's: `npm run test:all` **exit 0** — typecheck clean, 484 unit / 122
suites, 97 jsdom / 22 suites, 21 tools / 6 suites, compat 56 pass / 7 degrade /
0 fail / 0 without data, 979 KB × 3 passing `validate`, 36 e2e passed and 3
skipped in 1.8 min, then build and validate again. Separately `packs:verify` 0 errors /
4 warnings and `site:check` 711 pages / 16 087 links all resolving — run here
because a shipped pack and published copy both moved. Tool-test counts did not
change (the guard was widened, not added to), so no count sweep across the five
documents was needed this time.

What needs a human: **B0** is now *thirteen* stacked PRs, this being #13, and
it is the second of the thirteen to rebuild a shipped pack. `Now` and `Next`
are both empty again; nothing here is agent-actionable until B0 or B1 move.

### 2026-09-28 — the demo learned to say "content words"; two more surfaces had not

`TODO.md`'s top item asked only whether the popup's density line wanted the
qualifier the demo gained back in PR #8. It did, and so did a surface the
item never named: `oneWordIn()` (`src/ui/components/pieces.tsx:277`) has four
call sites, and two of them — the popup and the two options-page density rows
— built the exact unqualified `"1 word in N"` string the demo used to.

The argument the item recorded against changing it was the demo's own
argument, aimed at the wrong target. "The user watching their own page can
see the density directly, which a visitor to the landing page cannot" is
true, but the demo visitor could see the passage directly too, and a number
that did not match what was visibly on screen is exactly what made the old
demo readout "read as a broken counter" back then. Being able to check
a claim against reality does not make an unqualified claim safe — it is what
turns a mismatch into a noticed one. Fixed: the popup
(`src/ui/popup/index.tsx:261`, "...you could read is in French" → "...of the
content words is in French") and the options page's Resting-density and
Ceiling rows (`src/ui/options/sections.tsx:276,294`, "6% — 1 word in 16" →
"6% of content words — 1 word in 16"). Left alone: onboarding's two call
sites (`src/ui/onboarding/index.tsx:219,227`), which already say "of the
words Weft knows" — a different, already-adequate framing of the same
*eligible* set (lexicon coverage rather than part of speech), not a gap.

Verified in a real Chromium build rather than assumed safe. `.row__value` is
`white-space: nowrap` (`src/ui/theme.css:311`) and the popup is a genuine
340×330px surface, so a scratch Playwright script (not committed) built
`dist/chrome` in test mode, drove both surfaces, and compared `scrollWidth`
to `clientWidth` on the affected rows at ratios from 6% to 60%. No overflow
anywhere; the popup's longer sentence wraps the way the original did.

Regenerating the screenshots that show the new text
(`WEFT_SCREENS=1 npx playwright test screenshots`) surfaced an unrelated kind
of drift: it also rewrote five `dashboard*.png` files that render nothing
this session touched, because `tests/e2e/screenshots.spec.ts` seeds
vocabulary progress relative to `Date.now()` and
`src/ui/dashboard/index.tsx:299,429` renders that as an absolute calendar
date. Every future capture of those five will differ from today's by a few
bytes of date text regardless of what changed in the code — not a
regression, and not something to build a determinism gate around the way
`docs/store/*` earned one. Reverted those five with `git checkout --` and
kept only the three whose diff is real: `options-density.png` (embedded in
`README.md`) and `popup.png` (tracked but unreferenced), plus `options.png`,
the full-page shot containing the same rows.

`TODO.md`'s own PR count had drifted before this session added to it: B0 said
"ten stacked PRs" and an instruction to merge only "#1 … #9", but PR #11 — a
same-day bookkeeping commit with no code, unlisted — was already open.
Corrected to twelve, covering this session's own PR as #12, and the merge
instruction now covers the full range instead of stopping two short of it.

Measured at the end, on Node 26.7: `npm run test:all` **exit 0**, run twice —
typecheck clean, 484 unit / 122 suites, 97 jsdom / 22 suites, 21 tools / 6
suites, compat 56 pass / 7 degrade / 0 fail, 979 KB × 3 passing `validate`,
36 e2e passed and 3 skipped in 1.8 min, then build and validate again.
Separately `packs:verify` 0 errors / 4 warnings and `site:check` 711 pages /
16 087 links all resolving — both unchanged from the last measurement, as
expected, since nothing here touched a lexicon or the site generator.

What needs a human: **B0** is now *twelve* stacked PRs, this being #12.
`Now` and `Next` are both empty; nothing here is agent-actionable until B0
or B1 move. Nothing else moved.

### 2026-09-28 — the item named one misspelling; writing the check found three

`TODO.md`'s top item was "spell `mīlle` with its macron in the three places
that do not" — a fifteen-minute copy fix, and the cheapest item on the list.
It was six places, and **two of them were a different word**, which is the
whole argument for writing the guard before the fix: a grep for *mille* cannot
find `spēs`.

What the guard found beyond the item: **`spēs` in shipped tooltip copy** — the
note under *hope* read `"despair" is to be out of spes`, the identical defect
in the identical place; **`rēx` and `rēgis` at `docs/PEDAGOGY.md:100`**, in the
sentence arguing that a nominative headword drops cleanly into an English
frame, which is the paragraph explaining why the pack is spelled the way it is;
and **`README.md:92`**, a fourth site of *mille* the item had not listed. Eight
edits in five files, each verified to match exactly once before it was applied.

**The two clauses that keep `tests/tools/lexicon-orthography.test.ts` from
being noise were measured, not guessed.** The obvious rule — no note may spell
any macron-bearing headword bare — **fires 14 times on Old English**, because
headwords collide with ordinary English words the notes legitimately use
(`an`, `is`, `dead`, `ham`). So the rule checks only the entry's **own**
`tgtLemma` (not `tgt`: the inflected form is often the macron-bearing one,
`manus` → `manūs`, and the singular in the note is then right), and allows the
bare form when the note also shows the macron form. That second clause is not
a loophole — it is the `mālum` apple / `malum` evil note, whose entire subject
is that the two differ only in vowel length. Saying that requires writing both.

The prose half stops at the three documents that quote headwords at a reader
for the same reason, also measured: sweeping every document was tried and
rejected because `docs/LAUNCH.md` says a Show HN post "dies" and
`docs/PRIVACY.md` says "your OS", which collide with `diēs` and `ōs`. Latin
and English share too many homographs, and a gate that fires for two different
reasons gets ignored — the reasoning this file already records against the
sitemap-date gate. The seed TSV is out for a third reason: scanned as text it
hits its own singular/plural pairs (`manus`/`manūs`, `domus`/`domūs`).

**The reproducibility fix held, and beat the item's own prediction.** The item
warned that more than two files moving meant a regression. **One** moved:
`en-la.json`, `builtAt` 2026-09-26 → 09-28, and a field-level diff puts the
whole change at **4 fields out of 7087** — the stamp and the three notes.
`index.json` did not move and should not have: it records `entryCount`,
`lemmaCount` and `bands` per pack, none of which a prose edit touches, so
`writeStamped()` rightly kept its 2026-09-26 date. The previous session's
`lion` experiment moved it because changing a mapping changes a count.

Two things worth knowing before touching this again. `npm run site` still
writes the slug `/latin/mille`, and a grep of `dist/site` finds four pages
with a bare *mille* in them — **all four are the URL**, and the visible link
text is `mīlle` in every one. Leave them: 16 087 internal links resolve
against that address. And `<lastmod>` is pack-granular, so three edited notes
redated **703 of 711** pages to 09-28. That is PR #6's rule working as
designed rather than its bug returning — a page may say it changed today when
its pack really did — but it is coarse, and this is the first edit to exercise
it.

One environment note: **the iCloud trap has a third location.** `test:all`
exited 1 before a single e2e test ran, with `Unknown system error -11 ...
scandir 'test-results/.playwright-artifacts-0'`; `ls` on that directory says
`fts_read: Resource deadlock avoided`. `test-results/` is gitignored and
Playwright regenerates it, so `rm -rf test-results` alongside the `dist/`
clean is free. Worth doing before every `test:all` on this machine.

Measured at the end, on Node 26.7: `npm run test:all` **exit 0** — typecheck
clean, 484 unit / 122 suites, 97 jsdom / 22 suites, **21 tools / 6 suites**,
compat 56 pass / 7 degrade / 0 fail, 979 KB × 3 passing `validate`, 36 e2e
passed and 3 skipped in 2.0 min, then build and validate again. Separately
`packs:verify` 0 errors and the same 4 IPA warnings, and `site:check` 711
pages / 16 087 links all resolving — run here because the change is to a
published meta description and to a shipped pack. Packs still 653 KB; counts
moved 636 → 638 in five documents.

What needs a human: **B0** is now *nine* stacked PRs, this being #9, and it is
the only one of the nine that rebuilds a shipped lexicon pack. `TODO.md`'s Now
section has one item left, `npm run og` byte-stability, promoted from Next.
Nothing else moved.

### 2026-09-28 — the demo was not a product decision, it was a misdiagnosis

`TODO.md`'s top item reserved this one for a human: the live demo reached
59.7% at forty minutes where the shipped default ceilings at 35%, and turning
the demo down, turning the default up, or labelling the demo were offered as
three options for Creagh to choose between. It stopped being a choice once the
one recorded argument for keeping the demo high was measured.

That argument is the comment at `site/index.html:343`, which records that the
demo had been tuned *up* because an earlier version "saturated at 35% and
stopped responding". The item read the 35% as the escalation ceiling. **It was
`MIN_APART`.** With candidates at nearly every word, a two-word minimum gap
admits at most every third one — about 33%, which reads as 35% and is
indistinguishable from the ceiling unless you go looking. The repair applied at
the time was two changes at once: the passage was rewritten so the candidates
are spread out, which removed the real cap, *and* the constants were raised,
which was unnecessary. On the passage as it stands, **20 of 23 candidates are
takeable under `MIN_APART`** — 87% headroom, so spacing cannot be mistaken for
a 35% ceiling any more. So turning the constants back down to the Standard
preset changes no shipped behaviour, forecloses nothing, and was done:
`BASE = 0.06, CEILING = 0.35, GAIN = 0.02`, reading 13% at five minutes and
35% at forty. Eight distinct readings across the drag; the old constants gave
fourteen and Taster gives three, which is what a dead slider looks like.

Done test-first, and TDD paid for itself twice. The red run printed the whole
curve side by side — `4 min: demo says 22%, the default gives 13%` and so on —
which exposed that **the test's own arithmetic was wrong**: it counted
candidates across the whole file, and the doc comment above `PASSAGE` writes
`{english|french}` to explain the notation, so it found 24 where the demo uses
23. Every expected percentage was one step out. A test written after the fix
would have been calibrated against the fixed page and would have agreed with
itself. Second, the saturation assertion passes on the current page, so it
proves nothing until you watch it fail: set the constants to Taster's and it
says `only 3 distinct readouts, so the demo has saturated and stopped
responding`, which is the failure the comment describes and which had never
been checked.

The guard is a **fourth thing in `tests/tools/`** rather than `tests/dom/`,
although it uses jsdom: it reads a shipped artefact off disk, which
`tests/core/` forbids outright and which no `tests/dom/` test does — those
build their HTML in memory. `runScripts: 'dangerously'` is safe on this page
because every other `<script>` in it is `application/ld+json`, which jsdom
does not execute. Counts moved 633 → 636 in five documents; the three
remaining mentions of 633 are journal and Notes history and were left, on the
same reasoning that corrected the 1.0.0 changelog entry to 1.0.0.

Two things were folded in on the assumption they were in scope. The readout
said `35% — 1 word in 3`, but the denominator is *candidates* — the same units
the extension's own ratio uses (`selector.ts:38`, "proportion of *eligible*
words") — so next to a passage visibly showing 8 French words in 148 it read
as a broken counter, and turning the demo down makes that starker rather than
better. It now says `35% of content words — 1 in 3`, which is the phrase
`src/core/settings.ts:64` was already using. And the caption names the preset
on show, which is the "label the demo" option and true whichever way the
numbers later go.

Measured at the end, on Node 26.7: `npm run test:all` exit 0 — typecheck
clean, 484 unit / 122 suites, 97 jsdom / 22 suites, **19 tools / 5 suites**,
compat clean, 979 KB × 3 passing `validate`, 36 e2e passed and 3 skipped in
3.9 min, then build and validate again. Separately `packs:verify` 0 errors and
the same 4 IPA warnings, and `site:check` 711 pages / 16 087 links all
resolving — worth running here because the change is *to* the site, and the
one page it touches is the one every other page links back to.

What needs a human: **B0** is now *eight* stacked PRs, this being #8. Whether
the *default* should be higher is still entirely open and nothing here argues
it either way — but it is no longer urgent, because no surface now promises a
number the default cannot reach. If it is ever raised, `demo-curve.test.ts`
fails and names the new figures, so the demo follows for free.

### 2026-09-28 — the marketing promised half and the default ships a third

`TODO.md` asked for a read-through of `docs/LAUNCH.md` rather than a grep,
on the reasoning that the same sentence had been wrong three times and each
correction had come from grepping for a number. The reasoning was right in a
way that is worth recording: **not one of the six errors found was a number,
and the single number in the file — "633 tests" — was correct.** A grep-shaped
pass would have returned clean.

The one that matters is the product's headline promise. "Forty minutes on an
infinite feed and you are reading half in French" is false on the extension
people will install. `weaveRatio` is an exponential approach to a ceiling, and
the shipped default is the **Standard** preset: base 0.06, ceiling **0.35**,
gain 0.02. That is 14.5% at five minutes and **33.2% at forty**, and because
the ceiling is 0.35 the page cannot reach half at any attention whatsoever.
Half needs **Committed** (53% at forty), which is opt-in. The sentence had
spread from the doc comment at `src/core/escalation.ts:8` into `README.md`,
`docs/STORE-LISTING.md` and twice into `docs/LAUNCH.md`, so it was corrected
in all four — the store listing because that copy goes to Google, and the
comment because it is where the other three were copied from and would have
re-seeded them.

**Where "half" actually comes from is the demo, and that is now the top item in
`TODO.md`.** `site/index.html:404` runs `BASE = 0.06, CEILING = 0.62, GAIN =
0.045`, which is not any shipped preset; it reaches 59.7% at forty minutes. So
a visitor drags the slider, watches the passage go 60% French, installs, and
gets a third. The copy is now honest about the default, so nothing *claims*
half any more — but demo and default still disagree, and which one should move
is a product decision, not an agent's. The comment at `site/index.html:342`
is the piece of evidence to read first: it records that the demo was tuned
*up* once already because an earlier version "saturated at 35% and stopped
responding", which is the same 35% ceiling, and suggests the constants were
chosen for slider feel and never reconciled with the preset.

Second, and cheaper to fix than to find: `[latin-words-in-everyday-english]`
was an **undefined Markdown reference**. There is no link definition anywhere
in the file, so the r/latin draft's one pointer to the resource the whole post
exists to share would have pasted into Reddit as literal brackets. The general
rule this file needed and now follows: **reference-style links are wrong in a
document of copy-paste drafts**, because the definition stays behind when the
blockquote is copied out. Inline only, as the Christensen citation already
was.

Then the r/latin draft, which is the one aimed at readers who check. Two
grammar claims were contradicted by the lexicon it describes. "Nouns are woven
in the nominative singular" — 149 of 327 noun surface forms are nominative
*plural*; nominative singular is the **headword** convention
(`morphology: 'citation'`), not what lands on the page, and
`tools/seed/lex-la.tsv:12` says "nominative singular and plural" outright.
"Inflected English forms are skipped entirely rather than guessed" — 86 of 160
verb forms are present participles matched to English *-ing* (*going* →
*iēns*, *giving* → *dāns*); what is genuinely absent is past tense and third
person. And `pecus` → pecuniary skips a link: the pack has *pecūnia* →
pecuniary, *pecus* is not in it, and *pecuniary* descends from *pecūnia* which
descends from *pecus*. `mille` gained the macron the pack's headword carries,
in the draft whose own preamble says the macrons will be checked.

The ~30 claims that were **right** are listed in `TODO.md`'s Notes rather than
here, because that is the expensive half of a pass like this and it should
only be paid for once: every Old English example and its gloss, all six cited
dictionaries and grammars, the Christensen finding, *v* as /w/ and *c* always
hard (148 Latin *c*-words, zero palatal), the 78 surface forms with palatal
diacritics, the letterform switch, the retirement-is-free rule at
`selector.ts:82`, the reconciler page, and the permission story.

What needs a human: **B0** is now *seven* stacked PRs, this being #7. The new
top item in `TODO.md` is the demo-versus-default decision above. Nothing else
moved.

### 2026-09-28 — the sitemap said 711 pages changed today, and said it daily

Same bug class as the pack builder, one file along and with worse
consequences, so it was the top item in `TODO.md`. `tools/build-site.mjs`
computed one `new Date()` and wrote it into the `<lastmod>` of all 713 `<url>`
entries. `.github/workflows/site.yml` rebuilds on every push to `main`, so the
claim would have been made repeatedly and been false every time — and search
engines use `lastmod` only while it is verifiably accurate, which means the
one field the 711-page asset has for saying *this page is new* would have been
discarded for the whole domain.

**The replacement rule is: a page is dated by the content behind it.** Word
pages take the `builtAt` of the pack they are generated from — which is only
an honest date because of the previous session's fix, so this item was cheap
by construction. The language indexes and descent hubs take their own pack's
date; the word pages take the newer of the two deep packs, because every Latin
page links to its Old English counterpart and back, so both lexicons really
are content for both sets of pages. The five hand-written pages take the
commit date of the document that holds *their* prose: `site/index.html`,
`docs/PRIVACY.md`, `docs/SUPPORT.md`, `src/core/pricing.ts` +
`src/core/entitlements.ts` for pricing, and — the one that names the generator
— `tools/build-site.mjs` + `package.json` for install, whose text genuinely
lives in `installPage()` rather than in a document of its own. Measured after
the change: 708 URLs at 2026-09-26, three at 09-27, one at 09-22, one at
09-28. Before it, 713 at today's date.

**Where no date can be established, the element is left out.** `<lastmod>` is
optional in the sitemap protocol, so absence is a legal answer and today's
date is a false one. The case that matters is a shallow clone: `actions/
checkout` fetches depth 1 by default, and there every file's last commit *is*
HEAD, so `git log` hands back the same recent date for all of them — this bug
again, wearing a disguise. `tools/sitemap.ts` detects that with `git rev-parse
--is-shallow-repository` and declines to answer, and `site.yml` now checks out
with `fetch-depth: 0`. Note the failure mode of removing that line again: the
dates go quietly missing, they do not come back wrong.

The new module is **TypeScript, not another `tools/*.mjs`**, for one reason
worth recording because it is not obvious: `tsc` rejects a `.mjs` import from
a `.ts` test with TS7016, so a `.mjs` module here could only have been tested
through a whole site build. Verified by trying it. Node strips the types at
run time exactly as `tools/build-site.mjs` already does when it imports
`src/core/pricing.ts`.

Done test-first, and the failing run named the bug better than this entry
does: `all 711 URLs share one <lastmod> (2026-09-28), which is the wall clock,
not their content`. `--out=<dir>` was added to the site builder first and
alone, the same seam as `build-pack.mjs` and for the same reason — otherwise
testing this tool means deleting and rewriting the `dist/site` that
`npm run site:check` reads. Counts moved 620 → 633 in five documents again.

**A second result, free:** `npm run site` is now byte-stable. Two builds into
separate temporary directories diff identical, where before the sitemap
differed whenever the clock crossed midnight. That was the open question in
`TODO.md`'s Next item; `npm run og` is the one still unchecked.

Considered and rejected: a `check-links.mjs` gate that fails when every URL in
the sitemap shares one date. It runs in the site workflow, where the test
suite does not — but in a shallow checkout it would fire for a reason
unrelated to this bug (the doc dates are absent and all packs were built the
same day), and a gate whose failure means two different things gets ignored.
The guard is `tests/tools/build-site.test.ts` instead, which CI runs on the
same push via `npm run test:tools`.

One more sighting of the iCloud trap, this time on `npm run site` rather than
`npm run validate`: a conflict copy of the `old-english/` directory inside
`dist/site` killed the build with `Unknown system error -11 ... syscall:
'scandir'`. Same fix, `rm -rf dist/site` first.

What needs a human: **B0** is now *six* stacked PRs, this one being #6.
Nothing else moved.

### 2026-09-28 — a generator that was not reproducible, and the guard it buys

`npm run packs` stamped `builtAt` with today's date, so it rewrote all eight
files under `src/lexicon/packs/` on every run whether or not a seed lexicon had
moved. The previous session found that and reverted the churn; this one fixed
it. `writeStamped()` in `tools/build-pack.mjs` compares the pack it is about to
write against the one already on disk, ignoring the stamp, and keeps the old
date when the rest is byte-identical. `builtAt` therefore now says what it
always claimed to: when the *content* was built.

The reason to care is not tidiness. `npm run release` refuses a dirty tree, and
the setup line in this file told a new contributor to run `npm run packs`
before a first build — so following the documented setup produced a tree the
documented release command would not accept. That line now says the packs are
committed and the command is a no-op unless `tools/seed/*.tsv` has changed.

**What reproducibility buys, and is the point of the change:** CI can now
rebuild the packs and diff them. The new `Committed packs match the seed
lexicons` step is the only thing in the repository that catches a
`tools/seed/*.tsv` edit nobody rebuilt — which until today would have shipped
the old words with every other check green, because nothing else reads the
seeds. Verified the way a guard has to be: changed `lion` in `lex-fr.tsv`, ran
the build, watched `git diff --exit-code` exit 1. It touched `en-fr.json` and
`index.json` only, leaving the other six packs' dates alone, which is what
makes the CI diff legible rather than eight files wide.

Done test-first. The test has to simulate a day boundary — two runs on the same
day cannot expose a wall-clock stamp, since they agree — so it builds, rewrites
the stamp to `2020-01-01` as though committed then, builds again, and asserts
the date and the bytes survived. It failed with `actual: '2026-09-28', expected:
'2020-01-01'` before the fix. `--out=<dir>` was added first and alone, as a
seam: without it any test of this tool would have written into the tracked
packs, which is the bug under test.

That test is a **third suite**, `npm run test:tools`, not a file in
`tests/core/`. The core glob would have picked it up with no wiring, and that is
the reason to keep it out: that suite's documented virtue is no I/O and no
browser, and this one spawns a child process. `npm test` runs all three, so the
gate picks it up without `test:all` changing. Counts moved 617 → 620 in five
documents, `docs/LAUNCH.md:215` among them — the Hacker News draft, wrong about
the same sentence for the second session running. Both times a grep for a
number found it, which is why `TODO.md` now asks for a read-through instead.

Found and deliberately left: `tools/build-site.mjs:1237` stamps today on all
711 sitemap `<lastmod>` entries, so every deploy claims ~700 word pages changed
today. Same bug class, and worse, because a wrong date that has been indexed
has to be re-crawled to correct. It is the top item in `TODO.md` rather than
fixed here, because the fix wants a decision — the pack's honest `builtAt` is
the right date for the word pages, but a per-file git date would need
`fetch-depth: 0` in `site.yml` — and the site is not published yet (B3), so
nothing is indexed and there is no hurry that justifies guessing.

Measured at the end, on Node 26.7: `npm run test:all` exit 0 — typecheck clean,
484 unit / 122 suites, 97 jsdom / 22 suites, 3 tools / 1 suite, compat clean,
979 KB × 3 passing `validate`, 36 e2e passed and 3 skipped in 2.5 min, then
build and validate again. Separately `packs:verify` 0 errors and the same 4 IPA
warnings, `site:check` 711 pages and 16 087 links all resolving. The tracked
tree was clean of `src/lexicon/packs/` after all of it, which is the fix
demonstrating itself.

What needs a human: **B0** in `TODO.md` is new — five stacked PRs
(#1 → #2 → #3 → #4 → #5, this one being #5) have to be merged before `VERSION`
can move, since a version bump on a branch that may never merge is worse than
no bump. Then B1,
the unregistered domain, as before.

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
