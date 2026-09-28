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
| `npm run test:dom` | jsdom tests | **97 pass**, 22 suites, ~9 s wall clock here |
| `npm run test:tools` | the generators that produce shipped artefacts, run against a temp directory | **21 pass**, 6 suites, ~2 s here |
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
