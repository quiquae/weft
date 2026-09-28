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

**What "done" looks like:** the code is done. `git log` shows 29 commits
ending in a green `v1.0.0` tag, five more on `main` after it, and an unmerged
documentation stack on top of that (**B0** in `TODO.md`), which is why `VERSION`
has not moved. "Done" now means *released* — a Chrome Web Store listing that a
stranger can install from. That is a submission Creagh performs by hand with
her own developer account, so this repository's job is to be release-ready and
to keep the remaining human steps written down. `TODO.md` is that list;
`docs/SUBMIT.md` is the long-form runbook and `docs/STORE-LISTING.md` holds
every field's copy.

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
| `npm run test:unit` | pure-core tests, no browser | **484 pass**, 122 suites, ~9 s wall clock here (no browser; the figure moves with the machine, the counts do not) |
| `npm run test:dom` | jsdom tests | **98 pass**, 22 suites, ~9 s wall clock here |
| `npm run test:tools` | the generators that produce shipped artefacts, run against a temp directory | **27 pass**, 8 suites, ~2 s here |
| `npm run test:e2e` | real Chromium, extension loaded | **36 pass, 3 skipped**, 3.0 min here |
| `npm run compat` | every API used, checked against MDN compat data | 21 dependencies × 3 browsers = 63 checks: **56 pass, 7 degrade with a named fallback, 0 fail, 0 without data** |
| `npm run packs:verify` | sanity-check the lexicons | 0 errors, 4 warnings (missing IPA on 4 Old English interjections) |
| `npm run build:all` | chrome + firefox + safari | 979 KB unpacked per target |
| `npm run validate` | pre-flight the built packages against store rules | all 3 pass |
| `npm run site:check` | link-check the generated site | 711 pages, 16 087 links, all resolve; also fails if `/privacy`, `/support` or `/pricing` is missing |
| `npm run test:all` | typecheck, unit, jsdom, tools, compat, build:all, validate, e2e, then build:all and validate again | the gate before any release — but **not** `packs:verify` or `site:check`, which have to be run separately |

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
