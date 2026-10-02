# TODO: weft

<!-- The running state of this project. Any session, on any account, in any
     tool, reads this to find out where things stand. Newest notes at the top
     of Notes; the list itself stays in the order work should happen. -->

**State on 2026-10-02:** every automatable check is green, measured at the end
of this session — typecheck clean, **540** unit / 133 suites, **98** jsdom / 22
suites, **158** tool tests / 45 suites, **37** e2e passing
with 3 asset-generator specs skipped by design, compat clean, all three
packages built at 986 KB and passing `npm run validate`. The package grew
983 → 984 KB on 2026-10-01 by exactly the French pack's 1 028 bytes, which
crossed a rounding boundary, 984 → 985 KB the same evening by the Old
English pack's 1 541, its notes having grown longer than its etymons shrank,
and 985 → 986 KB on 2026-10-02 by 652 bytes, the shared lookup below —
measured by building `main`'s two callers and this branch's in turn.
`npm run test:all` exits 0 end to end.

**And as of 2026-10-02 the feed tells a word's story wherever the pack keeps
it.** A card is a target word and the pack has a row per English gloss, so
`fr:argent` is *silver* and *money*; three readers built their own lookup and
kept the first row, so the feed said nothing about *argent* and *fille*,
whose claims sit on their money and daughter rows. One lookup now,
`entriesByTarget()`, read by the dashboard, the quiz builder and the site:
the gloss stays on the first row and the story comes from a row of the same
part of speech. **Measuring it found the item's "eleven" was two**, and found
three words that are two words each — Old English `hund`, `earm` and `rīċe` —
for which the feed states one word's etymology to a reader who met the other.
See the ticked item there and the note at the top of Notes.

**And as of 2026-10-02 those three are two words each in the product too.**
The seed writes the second word with a homograph number — `hund²`, the
hundred beside `hund`, the dog — which is part of `tgtLemma` and so of the
card's id, and is printed nowhere. Each word now has its own card, schedule,
feed line, vocabulary row, quiz question and page (`/old-english/hund-hundred`
beside `/old-english/hund-dog`), and the quiz never offers one word of a
spelling as a wrong answer to the other; `rīċe` → *rich* reaches a page and the
descent hub for the first time. A new guard refuses a target shared across
parts of speech that is neither numbered nor listed as one word, and **it
found a fourth pair**: French `mort`, death and dead, to which English
Wiktionary gives two etymologies too. It is still one card, deliberately, and
is queued in `Next`. See the ticked item there and the note at the top of
Notes.

**The three gates `test:all` leaves out, re-measured on 2026-10-02, each with
npm's own exit status captured rather than a pipe's:**

| Gate | Exit | Result |
|---|---|---|
| `npm run packs:verify` | **0** | 0 errors, 4 warnings — the four Old English interjections with no IPA, unchanged. 356 rows per seed; built packs 584–588 entries across 579–583 surface forms |
| `npm run site:check` | **0** | **716** pages, **16 178** internal links, all resolve, all 3 externally-referenced pages exist. Needs `npm run site` first — it reads `dist/site` and does not build it |
| `npm run artefacts:check` | **1** | **8** groups, **1** stale: the release notes, which is **B2a** and cannot be fresh before the tag, because its `inputs` are `.`. Was 5 groups; the icon sheet, the shipped icons and the social card were added 2026-09-30, and **every committed image is now inside a group** |

**`artefacts:check` exits 1 on a correct tree and nothing said so before
now.** The release-notes group is stale by design until B2a, so a non-zero
exit is this tool's *normal* state, not a failure. Anything that chains it
with `&&` — `docs/SUBMIT.md`'s pre-flight block is a numbered list, not a
chain, so it is fine — would stop dead on a healthy repository. It is also
the reason this gate is deliberately outside `test:all`.

**And as of 2026-10-01 everything that draws the mark draws the same one.**
The icon was redrawn on 2026-09-22 so that the weft crosses every warp
thread but the last, and only the four rasters moved: both Chrome Web Store
tiles, the Edge store logo, the social card, the favicon and the header of
all 713 site pages went on drawing a weft that crosses two of four, because
each drew the mark from its own hand-written copy. All four generators
reproduced their committed output byte for byte and `artefacts:check` called
the tiles and the card `ok` — the stale fact was *inside* each generator,
and provenance cannot see a copy. The mark is `tools/brand.ts` now, the art
is regenerated and read, and `tests/tools/brand.test.ts` reads the mark back
out of every committed image of it. The marquee was stale a second way —
it still led with *hūs*, *cyning* and *vacca*, five days after French was
made to lead everywhere — and now shares the social card's four French
pairs. See the last ticked item in `Next`, "One decision a human may want to
look at" below it, and the note at the top of Notes.

**And as of 2026-10-01 the shipped icons are held to that geometry pixel
for pixel.** `tests/tools/brand.test.ts` draws each icon again and requires
the committed PNG to hold exactly those pixels, and each committed SVG to be
exactly that text, so an edit to `tools/brand.ts` that nobody rebuilt fails
`npm test` by name. It is a test rather than the CI rebuild-and-diff once
queued here, because that step would have failed on a correct tree: the
128px icon is 431 bytes under one zlib and 432 under another, every pixel
equal. See the ticked pixel-check item in `Next`.

**And re-measuring `site:check` found a live defect in published copy: two
Latin words had no page, and four links pointed at the wrong word.** The
sitemap declared **713** URLs where **711** HTML files existed, and the two
missing were an exact duplicate `<loc>` each. `slugify()` strips diacritics
so URLs stay ASCII — and in Latin vowel length is the *whole* distinction
between two different words, so `ōs` (mouth → *oral*) and `os` (bone →
*ossify*) both became `/latin/os`, and `liber` (book → *library*) and `līber`
(free → *liberty*) both became `/latin/liber`. The second page written
overwrote the first. **The lexicon knew**: the note on `os` reads "distinct
from “ōs”, mouth, only by vowel length". Both hub pages printed two rows, one
labelled `os` and one `ōs`, pointing at one URL — so a reader clicking
"ōs — mouth" read *"This is the Latin word your English **ossify** was
borrowed from"*. A false etymology, which is worse than the 404
`check-links.mjs` was written to prevent. Fixed by assigning slugs over the
whole entry set instead of per word; see the note at the top of Notes.

**And the four hand-made assets are three: the tiles have a generator.**
`tools/make-store-tiles.mjs` renders all three from HTML exactly as
`make-og.mjs` renders the social card. It was in no `npm run` and in no
artefact group, and `tools/artefacts.ts` asserted the opposite in as many
words — "drawn by hand and are not generated from anything" — which is what
the item below was built on. Run on 2026-09-30, all three came back
**byte-identical** to what was committed, mtimes moved. There is now
`npm run tiles`, a `store promo tiles` artefact group reporting **ok**, and a
guard that asks the converse question the other three could not. **`docs/screens/` holds 14 files and
all 14 are generated, as of 2026-09-30** — five captures of the content site
that no generator wrote were deleted, three of them displaying copy PRs #8,
#17 and #20 had each removed from the product, and the pathspec guard that
catches this now derives its filenames for all three image groups instead of
one. **The store-asset generator was never
broken and the listing art was stale, as of 2026-09-29** — the recorded
failure was a *production* `dist/chrome` on disk, the generator passes in
~45 s, and run by hand it reported that three of the fifteen shots showed
pre-PR-#12 copy that does not ship; those three are regenerated and the
fixtures now refuse a production build in 5 ms rather than blaming the
renderer for 20 s. **And as of 2026-09-29 the generator is genuinely
reproducible** — two consecutive runs produce all **18** files in
`docs/store/` byte-identical, hashed and diffed. **The listing art then went
stale again within one commit, and now something looks, as of 2026-09-29** —
`6425461` moved `src/` and the three `*-05-settings.png` stopped matching
what the generator produces; they are regenerated, and `npm run
artefacts:check` reports every committed generated file the tree has moved
past, which on a fresh `main` is four groups and two of them nobody knew
about. **And all three screenshot groups now report `ok`, as of 2026-09-29** —
`store listing screenshots` and `first-run walkthrough shots` were each
regenerated twice, every one of the 26 files was opened and read, and the
generated ones all reproduced byte-identically; the store set is stamped via
`npm run artefacts:verify`. Reading them found what two clean regenerations
could not: `docs/firstrun/07-help.png` said **`Weft 1.0.0`** on a tree at
1.0.1, because no generator wrote it — a manual capture orphaned inside a
pathspec declared as a whole directory. It is generated now, the pathspec is
narrowed to `docs/firstrun/0*.png`, and a guard fails if any file in it has
no generator. **`artefacts:check` is down to 1 stale from 4**, and the one
left is the release notes, which is B2a and cannot be fresh before the tag.
**And the listing art no longer cuts across a row of content, as of
2026-09-29** — it was **four** of the six scrolled captures, not the two this
file recorded, and two of the four erred the opposite way from the recorded
diagnosis: `edge-05-settings.png` opened mid-sentence with the target row's
heading gone entirely. `scrollIntoViewIfNeeded` states no alignment, so the
landing point was a function of the viewport height. The two scenes are now
framed on the section's own top edge and the capture *asserts* it landed
there, two-sided, so the generator fails rather than writing a clipped shot.
**And the same call was live in a second generator, as of 2026-09-29** —
`firstrun.spec.ts` framed `.section:has(.help__report)` the same unsafe way
and the guard could not see it, because it derived its selectors from one
hand-picked file. `frameOn` is now exported from `tests/e2e/fixtures.ts` so
there is one implementation, and `tests/tools/shot-framing.test.ts` derives
the *spec list* from the `OUT` directory every generator has. No committed
byte moved: all 45 files across the three groups came back byte-identical
twice, and all three groups now carry a verify stamp that is true.
**Both stale documentation sets are regenerated and the screens set
is now reproducible, as of 2026-09-29** — `docs/firstrun/` came back
byte-identical to what was committed, and `docs/screens/` needed three
separate fixes before two consecutive runs agreed. The cause was *not* the
absolute calendar date this file recorded: it was an unstable sort in the
product, attention accrued by the run, and a cooldown banner the harness
queued for itself. 18 of the 19 screens shots are byte-identical run to run;
`options-density.png` alternates between two variants that differ by 17
pixels of slider-track antialiasing. See the note at the top of Notes. **And
all 19 now agree across consecutive runs, as of 2026-09-29** — a *third*
taxed page, `wrapped`, was opened for `page-tooltip.png` and never closed, so
it kept weaving and recording exposures through the vocabulary reset and put
seven words the run itself had read into art whose whole job is to show the
seeded plan. The guard that should have caught it named `reader` and `oe` as
literals and mislabelled `oe` as "the wrapped-mode page", which is the
variable named `wrapped` that it had missed; it now derives the list of taxed
pages from the spec. Six dashboard shots regenerated, all six read. That sentence was in this
file yesterday and was not true: scene 4 still drifted, because
`buildDiscoveries` sorted on kind and recency only and nineteen cards
imported in one millisecond tie on both, so the feed's order came from
whatever the storage round-trip handed back. Fixed in `src/core/`, not in the
spec, because a real user's feed could reshuffle the same way — see the note
at the top of Notes. `npm run packs` is idempotent, so running
the whole gate leaves the tracked tree clean; and `npm run site` is now
byte-stable too, so a second build of the site changes nothing. The copy is
honest about the shipped default as of 2026-09-28, which it had not been: see
the `docs/LAUNCH.md` item below. **So is the live demo, as of 2026-09-28** — it
now runs the Standard preset's own constants and a test fails if it stops
doing so, which was the last place in the product claiming a number nobody
gets. **And the Latin it shows is spelled one way, as of 2026-09-28** — a
guard now holds the tooltip notes and the three documents that quote
headwords to the pack's own orthography. **And the launch drafts and the OG
card both hold up under a second look, as of 2026-09-28** — `docs/LAUNCH.md`
was independently re-swept claim by claim against the code a second time and
nothing new was wrong, and `npm run og` joins `npm run packs` and `npm run
site` as measured byte-stable. **And the popup and the options page now say
what the demo says, as of 2026-09-28** — both rendered the weave ratio as
"1 word in N" with no unit, the exact ambiguity the demo's own fix (PR #8,
below) had already corrected to "N% of content words"; neither surface was
named by that item, because it named only the demo. **And `npm run og` is
byte-stable under an independent second measurement, as of 2026-09-28** —
three fresh runs reproduced the committed card's SHA-256 exactly, which
closes the reproducibility trio (`packs`, `site`, `og`); the re-check's real
yield was elsewhere, in six places that spelled `paene insula` without the
macron on `īnsula`, three of them published copy, none of them visible to
the orthography guard because `īnsula` is not a lexicon headword.
**And every proper-noun etymon now
explains itself, as of 2026-09-28** — `novem` → November was the last numeral
with a descendant and no note, and the guard PR #14 wrote could not see it,
because that guard polices notes that exist and `novem` had none; the missing
half is now a test too. **And the 312 Latin word pages now state their descent
forwards, as of 2026-09-28** — they said English borrowed *novem* **from**
*November*, because the frame ended in a preposition and the builder appended
the descendant after it; `descent` is a before/after pair now, and a guard
reads all 637 rendered pages and fails on any frame that hands the English
word to "from". **And a word page's note is now part of that sentence rather
than a fragment after it, as of 2026-09-28** — 55 pages opened a second
sentence in lower case ("…was borrowed from. a mile was mīlle passūs"), and
the note is now dash-joined into the one sentence; a render-time capital was
measured and rejected, because it is a no-op on the 44 of 99 notes that open
with a quotation mark or a proper noun. **And Latin and Old English notes now
quote with the same marks the site's own prose does, as of 2026-09-28** — 59
of 185 distinct notes quoted with straight `"` while French and the site quote
with curly `“ ”`; the recorded argument for leaving both stood on a premise
that reading all 59 disproved. **And as of 2026-09-28 all of it is on
`main`** — the nineteen-commit stack that had accumulated since 2026-09-27 was
merged in one PR (#22), which is **B0 step 1, now done**: `main` is `e01ce27`
and its tree is `028bdec8`. The four conflicts B0
predicted were all squash artefact and the resolution was *proved* rather than
judged: `main`'s tree SHA was byte-identical to `02fc7d8`'s, an ancestor of the
stack, so `main` contributed nothing to any path and the merge changed not one
byte of content. **And B0 step 2 is done as of 2026-09-29: 1.0.1 is cut.**
`VERSION` is 1.0.1, `package.json` is in step, `RELEASE-1.0.1.md` is written,
six packages are built, and the whole gate plus `packs:verify` and
`site:check` re-ran green on the bumped tree. The tag is deliberately **not**
pushed; that is outward-facing and belongs to B2.

**And as of 2026-09-29 an import keeps what an export carried.** `exportAll`
wrote five stores and `importAll` read two, dropping `attention`,
`introduced` and `lock` while reporting `ok: true` — so moving machines cost
a user their whole history, their streak and every progress tile, silently.
Attention and today's introduced words now merge in; `lock` deliberately
does not, and the message says so. **The larger find was one line above it**:
`importAll` wrote the imported *settings* object straight to storage while
its own doc comment promised they went "through the same lock path as any
other change". They did not, so an exported JSON file with one number edited
was a complete bypass of every cooldown in `GOVERNED_PATHS` — the commitment
layer the product is built around. Both are fixed and guarded; see the note
at the top of Notes.

**And as of 2026-09-29 a byte-identical regeneration can be recorded as
checked instead of read as silence forever.** `artefacts:check` dated a
group by the last commit touching its own committed paths, so a
regeneration reproducing the same bytes — which had already happened once,
for `docs/firstrun/` — committed nothing and left the group reporting the
same staleness on every future run, however many times it was confirmed
correct. Each group now also carries its own manifest path,
`docs/artefacts/<slug>.json` — one file per group, not the single shared
file this section first sketched, which would have let verifying one group
silently freshen another nobody had checked. `npm run artefacts:verify --
"<name>"` writes the stamp; none was written speculatively, because two of
the four real groups were genuinely stale at the moment this landed and the
tool cannot tell an honest stamp from a fabricated one. See `Next` and the
note at the top of Notes.

**And as of 2026-09-30 an edit to the French etymology file cannot fail to
reach the pack in silence.** `merge-cousins.mjs` printed the same line and
exited 0 whether a corrected claim had landed or not, and a deleted claim
kept shipping; the merge now names every field that is not what
`fr-cousins.tsv` says, and a test fails if the committed lexicon is not a
fixed point of it. **Reading that file whole to guard it found eighteen of
its 116 claims false** — eleven "English borrowed X from Y" descents where
the English word came from a different French word or was never French,
and seven cousin notes naming the wrong Latin root. **And on 2026-10-01
every line was checked against a dictionary, and it was twenty-nine**: all
corrected or removed, the landing page, README and store listing with them,
and every claim now names the entries it was checked against, so one that
names none cannot ship. See the ticked item in `Next`.

**And as of 2026-10-01 the same is true of Old English, where it was
twenty-seven of 330.** Sixteen descents paired the English word with its
translation — *window* is Old Norse *vindauga*, *lion* and *ire* French,
*sad* is *sæd* not *unrōt* — and eleven named a compound or derivative as
the word itself, *gospel* for *spell*. 21 are gone, 6 name the real
descendant, and the landing page no longer leads with *drēam → dream*,
which nobody has proved. Every Old English etymon names the entry it was
checked against in `tools/seed/ang-etymons.tsv`, and a test refuses one that
names none. See the ticked item in `Next`.

**And as of 2026-10-02 the Latin notes are held the same way, where it was
five of 28.** The queued item was one note calling a noun's plural
"third-person". Reading the other 27 against Lewis & Short, Allen &
Greenough and etymonline found four more that did not stand: the collarbone
"named for its key-like shape", Jenner having "named the vaccine" — that one
on the landing page — Latin having "no bare word for yes", and "a little
shade" under *umbra*, which is *umbella*. And *ita* was listed as the
ancestor of an English "ita vero", which is Latin, and scored a cognate at
0.96 on the strength of it. Every Latin note names the entries it was
checked against in `tools/seed/la-notes.tsv`, and a test refuses one that
names none, has been reworded since, or gives a noun a verb's grammar. See
the ticked item in `Next`.

**And as of 2026-10-02 every word page's address spells its whole
headword.** `slugify()` spelled æ before it took a word apart, so the
precomposed `ǣ` slipped past and became a hyphen: `sǣ`, sea, was published
as `/old-english/s` and `ǣfen`, evening, as `/old-english/fen`, 22 Old
English headwords in all. It decomposes first now, and
`tests/tools/build-site.test.ts` folds every headword itself and fails on
an address that drops a letter. See the ticked item in `Next`.

**And as of 2026-10-02 every Latin transcription is stressed where the
classical rule puts it.** Thirty were not — seven words with *qu* stressed
on the wrong syllable, three *-eus* words a syllable short, `iūsiūrandum` a
syllable long, and nineteen with the mark a consonant early, /pɛˈrsoːna/ —
from three defects in `tools/seed/_ipa.py`, all fixed, and
`tests/tools/latin-stress.test.ts` now works out every headword's syllables
and stress from its spelling by Allen & Greenough's rules and refuses a
transcription that disagrees. See the ticked item in `Next`.

**So the whole of B0 is closed and `Now` is empty. `Next` holds nine
agent-shaped items, and two of them — the Latin descents nobody has looked
up, and an Old English word stressed on the wrong syllable — should land
before B3 indexes the pages they are on.** The
code is not
otherwise what is holding the release up, and neither is the version any
more. **Every remaining item besides those nine needs Creagh.** The critical
path is **B1 — the domain `weft.study` is not registered**, and nothing
below it can move until it is.

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

- [x] **Regenerate the five `docs/store/chrome-*.png`.** Done 2026-09-28, and
      the result is that **nothing changed**. All fifteen shots were rewritten
      by `WEFT_STORE=1 npx playwright test store-assets` (1 passed, 31 s) and
      all fifteen came back byte-identical to the committed ones, so no asset
      was committed. The three tiles are not generated by that spec and were
      not touched. Re-measured anyway: chrome 1280×800, edge 1366×768, apple
      1440×900, tiles 440×280 and 1400×560, logo 300×300. The premise of the
      item was half wrong and the worry behind it was sound; both are written
      up at the top of Notes.

      **Superseded 2026-09-29, and the dates are the whole explanation.** That
      run was real and "byte-identical" was true when measured — but it
      predates PR #12 the same day, which changed the options page's density
      copy and regenerated only the `docs/` screenshots. The three
      `*-05-settings.png` were stale from that moment until 2026-09-29. The
      lesson is not that the measurement was wrong; it is that a regeneration
      is only evidence about the tree it ran on, and nothing re-ran it.

- [x] **Make `npm run packs` reproducible.** Done 2026-09-28. It stamped
      `builtAt` with today's date, so every run rewrote all eight files under
      `src/lexicon/packs/` whether or not a seed lexicon had moved — which left
      a fresh clone dirty and `npm run release`, which refuses a dirty tree,
      refusing. The stamp is now kept when nothing else about that pack has
      changed, so it says when the content was built rather than when the
      command last ran. Three things came with it: a new `npm run test:tools`
      suite (`tests/tools/build-pack.test.ts`, 3 tests, inside `npm test` and
      so inside `test:all`); a CI step that rebuilds the packs and diffs them,
      which is the only thing that catches a `tools/seed/*.tsv` edit nobody
      rebuilt; and five documents' counts moved 617 → 620. See the note at the
      top of Notes.

- [x] **Give the sitemap a `lastmod` that means something.** Done 2026-09-28,
      before **B3** as the item asked. Every page is now dated by the content
      behind it — word pages by the `builtAt` of the pack they are generated
      from, the five hand-written pages by the commit date of the document
      that holds their prose — and where no date can be established the
      element is left out, because `<lastmod>` is optional and an absent date
      is honest where today's is not. The shallow-checkout trap the item
      warned about is handled twice over: `.github/workflows/site.yml` now
      checks out with `fetch-depth: 0`, and `tools/sitemap.ts` detects a
      shallow clone and emits nothing rather than HEAD's date. Measured after:
      708 URLs at 2026-09-26, three at 09-27, one at 09-22, one at 09-28;
      before, 713 at today. See the note at the top of Notes.

- [x] **Re-sweep every factual claim in `docs/LAUNCH.md`.** Done 2026-09-28,
      claim by claim against the code rather than by grep — and the item's
      premise held exactly: **none of the six errors found was a number, and
      the one number in the file ("633 tests") was correct.** Ten corrections
      across four files. The two that matter: "forty minutes on a feed and you
      are reading **half** in French" is false on the shipped default, which
      ceilings at 35% and reaches 33.2% at forty minutes, so half is not
      merely unmet but unreachable — and that sentence had spread to
      `README.md`, to `docs/STORE-LISTING.md`, which is the copy that goes to
      Google, and to the doc comment in `src/core/escalation.ts` that seeded
      it; and `[latin-words-in-everyday-english]` was an **undefined Markdown
      reference**, so the r/latin draft's one link to the resource the post
      exists to share would have pasted into Reddit as literal brackets. Also
      corrected: two grammar claims the lexicon contradicts, a missing macron
      and a wrong etymon in the draft that warns macrons will be checked, and
      two file paths that do not exist. What was checked and found **right**
      is listed in the note at the top of Notes, so the next session need not
      re-check it.

- [x] **Decide whether the demo or the default is telling the truth about
      "half".** Done 2026-09-28. **The demo was turned down to the default**,
      and the decision stopped being a product judgement once the one recorded
      argument against it was measured. That argument was the comment at
      `site/index.html:343`: the demo had been tuned *up* because an earlier
      version "saturated at 35% and stopped responding", which the item read as
      the 35% ceiling. It was not. It was `MIN_APART` — the minimum-gap rule —
      binding on a passage where almost every word was a candidate, and it
      landed near 35% by coincidence. The passage rewrite that came with the
      retune had already removed that cap: on the passage in the file, **20 of
      23 candidates are takeable**, an 87% headroom, so there is no room left
      for spacing to be mistaken for the ceiling. Raising the constants was
      treating a symptom that had already gone. Turning them back down
      therefore changes no shipped behaviour, forecloses nothing, and makes
      the demo show the extension a visitor installs: `BASE = 0.06, CEILING =
      0.35, GAIN = 0.02`, reading 13% at five minutes and **35% at forty**.
      The slider still has 8 distinct readings across its range, which is now
      asserted rather than recalled. See the note at the top of Notes for the
      measurement, the two things folded in, and what was left for later.

- [x] **Spell `mīlle` with its macron in the places that do not.** Done
      2026-09-28, and it was **six** places rather than three, of which
      **two were a different word**. Written as a guard first, which is the
      only reason the extra three were found: a search for *mille* cannot find
      `spēs` or `rēx`. `tests/tools/lexicon-orthography.test.ts` (2 tests)
      checks the two halves separately — a pack note may not spell **its own**
      entry's headword without the macron, and the three documents that quote
      Latin headwords at a reader (`README.md`, `docs/PEDAGOGY.md`,
      `tools/build-site.mjs`) must spell them the way the pack does. Fixed:
      `mille` → `mīlle` in the seed note, in `README.md:92` (which the item
      did not list), in `docs/PEDAGOGY.md:116` and in the published meta
      description at `tools/build-site.mjs:442`; `spes` → `spēs` in the
      tooltip note under *hope*; `rex`/`regis` → `rēx`/`rēgis` in
      `docs/PEDAGOGY.md:100`, plus the same two examples in the `lex-la.tsv`
      header comment. **The reproducibility fix held, and did better than this
      item predicted:** exactly *one* file moved, `en-la.json`, whose `builtAt`
      advanced 2026-09-26 → 09-28 while the other six kept theirs. A
      field-level diff puts the whole change at **4 fields out of 7087** — the
      stamp and the three notes. `index.json` did *not* move, and should not
      have: it records only `entryCount`, `lemmaCount` and `bands` per pack,
      none of which a prose edit touches, so its own stamp correctly stayed at
      2026-09-26. The previous session's `lion` experiment moved it because
      that edit changed a count. `packs:verify` still 0 errors / 4 warnings,
      packs still 653 KB. Counts moved 636 → 638 in five documents.

- [x] **Check `npm run og` for byte-stability.** Done 2026-09-28: three
      separate runs on this machine produced the identical SHA-256
      (`6f2ef13f…eb6f3e66`) as the `site/og.png` already committed, so there
      was nothing to stage. That closes out the reproducibility work this
      stack has been doing since the pack builder: `npm run packs`, `npm run
      site` and now `npm run og` are all measured byte-stable, so nothing left
      in the site or lexicon pipeline stamps a tracked file with the wall
      clock. One correction along the way, found while re-checking rather than
      taken on faith: this item's own account of the `new Date()` audit was
      loose. The literal command it names, `grep -n 'new Date()' tools/*.mjs
      build.mjs`, matches only `build-pack.mjs` (×2) and `build.mjs` (×1) —
      not `tools/make-licence.mjs`, which uses `Date.now()` rather than the
      literal string `new Date()`, and not the sitemap, which is `tools/
      sitemap.ts` and was never inside a `.mjs` glob to begin with. The
      conclusion was still right (`make-licence.mjs`'s `issued`/`expires` are
      genuinely wall-clock by design; `build.mjs`'s two calls are console
      timing output nothing diffs; the sitemap has zero live `Date` calls
      left, only a comment describing the bug it used to have) — only the
      mechanics of how that was found were retold slightly wrong.

- [x] **Decide whether the popup's density label wants the same qualifier the
      demo just gained.** Done 2026-09-28. **Yes**, and the one recorded
      argument against it does not survive the comparison it invites: "the
      user watching their own page can see the density directly" is exactly
      the argument that was already rejected for the demo, where the visitor
      could also see the passage directly, and a claim that did not match what
      was visibly on screen was what made the old demo readout "read as a
      broken counter". A user who glances from "1 word in 3" at their own page
      and sees nothing like one word in three is looking at the same failure,
      not a smaller one. Fixed both unqualified call sites of `oneWordIn()`
      (`src/ui/components/pieces.tsx:277`): the popup
      (`src/ui/popup/index.tsx:261`, "...you could read is in French" →
      "...of the content words is in French") and the two options-page rows
      that share its exact `value` pattern (`src/ui/options/sections.tsx:276,294`,
      "6% — 1 word in 16" → "6% of content words — 1 word in 16"). Left alone:
      onboarding's two call sites (`src/ui/onboarding/index.tsx:219,227`),
      which already carry their own qualifier ("of the words Weft knows") —
      wording that describes the same *eligible* set from the lexicon-coverage
      angle rather than the part-of-speech angle, not a gap to close.
      Verified in a real Chromium build rather than assumed: a scratch
      Playwright script (not committed) drove both the 340×330 popup and the
      900-wide options page and checked `scrollWidth` against `clientWidth` on
      the affected rows, because `.row__value` is `white-space: nowrap` in
      `src/ui/theme.css:311` and a longer string could in principle have
      overflowed a narrow row — it did not, at ratios from 6% to 60%. The two
      committed screenshots that show this text were regenerated and kept:
      `docs/screens/options-density.png` (embedded in `README.md`) and
      `docs/screens/popup.png` (tracked but not embedded); `docs/screens/options.png`
      changed for the same reason and was kept too. Five other regenerated
      screenshots (`dashboard*.png`) were reverted — they drift on any day the
      whole `WEFT_SCREENS=1` suite reruns, for a reason unconnected to this fix;
      see Notes.

- [x] **Re-measure `npm run og` byte-stability, independently of the item
      above.** Done 2026-09-28. The item above was closed by PR #10 earlier
      the same day, so this run's job was to reproduce it rather than believe
      it — and it reproduces exactly: three fresh runs wrote
      `6f2ef13ff4583ea47b81f642e3bfb43a61b412dff835117e3a524dddeb6f3e66`,
      byte-identical to the committed `site/og.png`, to each other, and to
      the hash PR #10 recorded, leaving `git status` clean each time. Worth
      recording *why* it is stable, because it is a different reason from the
      pack builder's and the sitemap's: `tools/make-og.mjs` contains no
      `new Date()` at all. It screenshots a static HTML string, so there was
      never a logical clock in it to remove, and the only wobble available to
      it is the renderer's own — font fallback, Chromium's PNG encoder,
      antialiasing. On this machine there is none. **That closes the
      reproducibility trio**: `npm run packs`, `npm run site` and `npm run og`
      are all measured byte-stable, so nothing in the lexicon or site
      pipeline stamps a tracked file with the wall clock, and `npm run
      release` cannot be refused by a dirty tree one of them created.

      **The re-check's real yield was the thing it found on the way.** PR
      #10's commit message recorded, and deliberately declined to fix as
      out of scope, "one adjacent pack-note inconsistency": `paene`'s tooltip
      note spells `insula` bare where `docs/LAUNCH.md` has `īnsula`. It was
      **six** sites, not one, and three of them are copy a stranger reads —
      the tooltip that ships in the extension, the "Where *peninsula* comes
      from" section of `/latin/paene`, and the note column of
      `latin-words-in-everyday-english`, which is the descent hub the r/latin
      launch draft exists to link to. The other three are
      `README.md:93`, `docs/PEDAGOGY.md:117` and the seed comment at
      `tools/seed/lex-la.tsv:21`. Four files to edit, not six: the first three
      are one pack note rendered three ways. Two places already had it right
      (`docs/LAUNCH.md:140`, `site/index.html:222`), so this was the repo
      disagreeing with itself about a word rather than a judgement call about
      how to spell it; `īnsula` is also what the lengthening-before-`ns` rule
      gives, the same rule behind `cōnsul` and `mēnsa`.

      **Why #9's guard could not see any of it, and what now covers it.**
      That guard derives its whole vocabulary from the packs, so it can only
      police a word the lexicon defines — and `īnsula` is not an entry. Prose
      is free to reach for Latin the lexicon never glosses, and that Latin
      was invisible by construction, including in the two documents the guard
      already scanned. Fixed with a second, hand-curated vocabulary in
      `tests/tools/lexicon-orthography.test.ts`: `UNDEFINED`, the Latin that
      Weft writes down but the lexicon does not carry, currently one word.
      Unlike the headword list it is applied across *every* note rather than
      only the entry that owns it, and that is safe precisely because it is
      hand-picked — the 14 false positives that rule out a pack-wide headword
      scan are English homographs (`an`, `is`, `dead`, `ham`), and nothing
      enters this table until someone has checked it is not one.

      **Two more documents joined the prose guard, by measurement.** #9 drew
      its boundary at three files because `docs/LAUNCH.md` says "dies" and
      `docs/PRIVACY.md` says "your OS" — but only those two had ever been
      measured, and the exclusion had quietly been read as "every other
      document". Adding `site/index.html`, `docs/STORE-LISTING.md` and
      `docs/LAUNCH.md` together fires **exactly one** offender, the known
      `dies`/`diēs`. So the first two are clean and are now in the list: the
      landing page and the copy that goes to Google are the last two places a
      misspelling should survive. `docs/LAUNCH.md` stays out, for the reason
      #9 gave.

      **The whole note corpus was read rather than grepped**, which is the
      only way this class is findable: 27 distinct Latin notes and 72 Old
      English ones, 99 in total, which is small enough to be cheap and is
      worth redoing rather than trusting if a lexicon gains notes. Old
      English came back **clean** — every OE word quoted in a note carries
      its macrons and palatal diacritics. Latin had exactly the one defect.
      One thing was looked at and deliberately left: the note under
      `iānua` says "Janus, god of doorways", using the English name of the
      god in English prose the way the adjacent note says "Jenner", not the
      classical `Iānus`. That is a different convention, not a lapse in this
      one.

      Measured after: `en-la.json` moved by **1 field out of 7087** and
      `index.json` did not move at all, since no count changed — PR #5's
      stamp-preservation behaving exactly as designed. `builtAt` stayed
      2026-09-28, so unlike #9 this edit redated **no** sitemap entries.
      `packs:verify` 0 errors / 4 warnings and `site:check` 711 pages /
      16 087 links, both unchanged. Test counts did not move either (21 tool
      tests, 6 suites): the guard was widened, not added to, so no
      count sweep across the five documents was needed.

- [x] **The tooltip under `iānua` never says *which* month.** Done
      2026-09-28, and the item's premise was wrong in the way that mattered:
      *January* **is** in front of the reader, on all three surfaces the item
      named. The tooltip prints an `Ancestor of English **January**` badge
      directly above the note (`src/content/tooltip.ts:327`), `/latin/ianua`
      makes it the `<h2>` ("Where *January* comes from"), and the descent hub
      puts it in the adjacent `<td>`. So "gave the month its name" resolves
      fine, and the item's proposed edit looked redundant.

      **What is actually wrong is one level down, and it is structural rather
      than editorial.** The badge is behind a user switch —
      `reveal.showEtymon`, default on, toggled on the options page under
      "Where your English word came from" (`src/ui/options/sections.tsx:463`).
      The note is not: `tooltip.ts:336` appends it unconditionally. Turn the
      badge off and "the month" has no antecedent anywhere on the card. The
      codebase already knows this worry for the note's sibling — the "why"
      sentence is handed `allowEtymon: reveal.showEtymon` with the comment
      "must not reinstate a fact they hid" (`tooltip.ts:320`) — so the note
      was the unguarded half of a rule the file had already written down.

      **And it was three notes, not one.** The class is derivable rather than
      curated, which is the part worth keeping: every `etymonOf` in all seven
      packs is an ordinary English word stored lowercase except four, and a
      **proper noun cannot be alluded to, only named**. Scanning for a
      capitalised etymon whose note never says it fires on exactly
      `iānua` → January ("gave the month its name"),
      `argentum` → Argentina ("the country is named for the metal") and
      `septem` → September ("the seventh month of the old Roman year"), with
      zero false positives — no hand-curated table needed, unlike the
      `UNDEFINED` list PR #13 had to fall back on. `septem` is the worst of
      the three: with the badge off it does not merely dangle, it reads as a
      gloss, and *septem* means seven, not September.

      Fixed in `tools/seed/lex-la.tsv` (rows 108, 130, 371) and rebuilt:
      "Janus, god of doorways, gave January its name", "Argentina is named
      for the metal", "September was the seventh month of the old Roman
      year". The repetition this creates on the word page ("Where *January*
      comes from … borrowed from **January**. … gave January its name") is
      the house pattern already shipping under `mīlle` and `vacca`, and was
      checked by rendering all three pages rather than reasoned about.
      Guarded by a new suite, `tests/tools/lexicon-notes.test.ts`, plus one
      jsdom test pinning the premise it rests on — that the note survives
      when the badge is hidden, which nothing asserted before.

- [x] **`novem` → November is the only numeral with an etymon and no note.**
      Done 2026-09-28. The content decision the last run reserved was taken
      by the queue, which asked for the note in as many words, so the
      parallel the item had already written out went in unchanged:
      `tools/seed/lex-la.tsv:373` now reads "November was the ninth month of
      the old Roman year". Both surfaces checked by rendering, not reasoned
      about — `/latin/novem` and `/latin/septem` are now the same shape
      sentence for sentence, and the hub table's note column is full where it
      was empty.

      **The guard that came with it is the transferable half, and it is the
      other half of PR #14's rule rather than a new one.**
      `tests/tools/lexicon-notes.test.ts` polices notes that *exist* — a note
      whose descendant is a proper noun must name it. It cannot see a
      descendant with no note at all, which is the state `novem` was in, so
      the defect the last run described was invisible to the guard written in
      the same session. One more test closes it: a proper-noun descendant
      must carry a note. Red run named exactly one offender
      (`en-la nine → novem: nothing says why it became "November"`) before
      anything was edited.

      **Narrow for a measured reason, not a guessed one.** "An etymon implies
      a note" is nonsense — **962 of the 1131** entries carrying an `etymonOf`
      across the seven packs have no note and are right not to, because an
      ordinary descendant is inferable from the headword beside it (*octō*
      under "Ancestor of English octave" explains itself). A name is not:
      *novem* under "Ancestor of English November" tells the reader nothing
      about why nine became a month. Capitalisation separates the two, the
      same derivation PR #14 used, and it leaves **5 rows** to police — four
      distinct entries, because `door`/`doors` share `iānua`'s note.

      One field of **7088** moved in `en-la.json`; `index.json` did not,
      because a note is not a count, and `builtAt` stayed 2026-09-28, so
      **zero** sitemap entries were redated. Counts moved 641 → 642 across
      six documents, one more than the usual five — see the Notes entry for
      the stale one.

- [x] **The Latin word pages say English borrowed the Latin word *from* the
      English one.** Done 2026-09-28. `META.la.descent` is a `{ before, after }`
      pair now and `descentSentence()` sets the descendant *inside* the frame:
      **"This is the Latin word your English *November* was borrowed from."**
      312 pages changed; the 325 Old English pages are byte-identical, because
      that language's `after` is empty and its frame already took its object
      at the end.

      **The queue's preferred shape was right about where the descendant goes
      and one word short of correct.** The item reconstructed the sentence the
      template was written for as "the Latin word your English *November*
      borrowed from" — which puts *November* in the subject slot of *borrowed*
      and so makes the English word the **borrower**. It is not: English
      borrowed *November*, and the idiom the codebase already uses says so
      (`src/core/discoveries.ts:145`, "English borrowed ${descendant} from
      ${target}"). The passive fixes the role without giving up the verb —
      *was* borrowed from — and keeps the "This is the Latin word …" opening
      that makes the two languages parallel. Rendered and read on seven pages
      rather than reasoned about: `novem`, `vacca`, `mīlle`, `iānua`,
      `argentum`, `ābīdan`, `bōc`.

      **The guard is one word, and the word is "from".** The general rule — a
      descendant must not be the object of a preposition — is wrong, because
      most prepositions take it correctly ("the ancestor **of** November"). In
      a descent sentence *from* names the source, and the source is the page's
      own headword, so a frame ending in "from" captures whatever is appended
      and hands the descendant the Latin word's role. The red run named **312**
      offenders and **zero** of the 325 Old English pages, so the rule
      separates the two frames with no curated exclusion list. Three tests in
      `tests/tools/build-site.test.ts` rather than a new suite: the file is
      already the one that renders the site into a temp directory, and a
      second suite would have duplicated that seam to re-derive the same
      output for a 0.6 s build. Counts moved 642 → 645 and suites 7 → 8 across
      six documents — `docs/LAUNCH.md:221` swept **by name**, as this file now
      asks.

      Not a lexicon edit: no pack moved, no `builtAt` moved, `packs:verify`
      untouched. `site:check` still 711 pages / 16 087 links, all resolving.

- [x] **A word page's note started mid-sentence after a full stop.** Done
      2026-09-28. `tools/build-site.mjs` put the note in the same `<p>` as the
      descent sentence, *after* that sentence's full stop, so on **55** pages a
      lowercase appositive opened a second sentence: "…your English *mile* was
      borrowed from. a mile was mīlle passūs, a thousand paces." `descentSentence()`
      now takes the note and joins it into the one sentence with a dash — "…was
      borrowed from **—** a mile was mīlle passūs, a thousand paces." One
      template, no lexicon edit, no pack rebuild, no sitemap redating.

      **Option 1, and the measurement is what chose it over the item's own
      preference.** The item preferred 2 (capitalise at render time) "with a
      measured exception list", and the exception list turns out to be a fifth
      of the corpus. Of the **99** notes that reach a word page — the item's
      "247 of 318" counted all seven packs, and French has no word pages —
      **39** open with a quotation mark around a cited target-language form
      (`"mann" meant a human being of either sex`) and **5** open with a proper
      noun (Jenner, Janus, Argentina, September, November). So
      `charAt(0).toUpperCase()` would have been a silent **no-op on 44 of the
      99**, and on `paene īnsula, almost an island` it would have capitalised a
      cited Latin phrase. The dash needs no exception list, because **every
      capital already in the corpus is required by a name rather than by
      sentence position** — so the dash can never produce a spurious one. Also
      relevant to the counts: there are **185** distinct notes, not 318; a note
      shared by `door`/`doors` is one string to transform but two instances.

      **The item's second site does not exist.** It said the defect is "also
      visible in the 'Worth knowing' branch". That branch renders on **0** of
      the 711 pages: every Latin and Old English entry that carries a note also
      carries an `etymonOf`, and the 85 note-bearing entries without one are all
      French, which gets no word page. Left alone rather than fixed — and it is
      arguably not broken anyway, because a bare note under a heading *is* the
      caption frame the fragments are written for, the same frame the tooltip
      and the hub `<td>` give them.

      Done test-first; the red run named **99** pages and reported only 1 note
      already joined (`wes hāl` → wassail, whose note contains a dash of its
      own — rendered and read, it comes out as a clean parenthetical). The rule
      is about the paragraph rather than the letter: one sentence, one full
      stop, and it comes last. That is strictly stronger than "no sentence
      starts in lower case", which would have waved all 39 quoted notes and all
      5 named ones straight through. Two tests in the existing
      `tests/tools/build-site.test.ts`, which already renders every word page —
      counts 645 → 647 and tool suites 8 → 9 across six documents,
      `docs/LAUNCH.md:221` swept **by name and first**.

      Nine pages rendered and read rather than reasoned about — `mille`,
      `paene`, `vacca`, `novem`, `mann`, `wes-hal`, `micel`, `vir`, `malum` —
      one per class. `site:check` 711 pages / 16 087 links, all resolving.
      A diff of the whole site before and after shows **637** word pages
      changed, of which only the 99 change visibly: dropping the note's own
      interpolation removed one blank line inside the `<p>` on the other 538,
      which HTML whitespace collapse makes invisible. The sitemap did not move.

- [x] **The note corpus disagrees with itself about quote marks.** Done
      2026-09-28. Reading all **59** straight-quoted notes — rather than
      deciding from the premise recorded in this file — is what settled it:
      the "two different jobs" argument for leaving both conventions does not
      survive contact with the data. A third of the 59 quote **English**
      words, not target-language citation forms — `"muscle"`, `"despair"`,
      `"hopeless"`, `"warden"`, `"hale"`, `"bank teller"` — the identical job
      French does in curly. The split tracks which pack a note was typed into,
      not what kind of word it names. Unified on curly, the only option this
      file had costed out and the convention the site's own prose already
      uses (24 curly quotes, zero straight, in `site/index.html`).

      **Option 3 (`<em>` for cited forms) was ruled out on inspection, not
      just cost.** The tooltip note is plain text —
      `src/content/tooltip.ts`'s `el()` sets `textContent`, never
      `innerHTML` — so semantic markup inside a note would need new rendering
      support on that surface, nowhere budgeted in this file's ~30-minute
      estimate for the curly option.

      Converted all 59 notes in `tools/seed/lex-la.tsv` (12) and
      `lex-ang.tsv` (47), pairing each straight quote with curly open/close in
      sequence; every note has a balanced, even quote count, checked before
      converting. Diffed line by line: only the note column changed, nothing
      else. Guarded in `tests/tools/lexicon-orthography.test.ts`, the suite
      this file named: no note in any of the seven packs may contain a
      straight double quote. Done test-first; the red run named all 59 (as
      more instances, since a shared note like `door`/`doors` counts once per
      surface form).

      Rebuilt both packs: `en-ang.json`'s `builtAt` advances 09-26 → 09-28,
      its first edit today; `en-la.json`'s stays 09-28, already stamped today
      by earlier sessions' edits to the same file. `index.json` untouched, no
      count moved. `packs:verify` still 0 errors / 4 warnings. Verified by
      rendering, the house rule: `/old-english/mann`'s descent sentence and
      the `old-english-words-that-became-english` hub's note column both show
      `"mann" meant a human being of either sex` with curly marks.
      `site:check` still 711 pages / 16 087 links, all resolving; redated
      **705 of 713** sitemap entries to today, the same pack-granular
      coarseness this file already records, because `en-ang.json` had not
      moved today before this edit and most Old English word pages take their
      `builtAt`. Tool suites moved 9 → 10 (one new `describe`, two new tests).

      Done in an isolated git worktree — see the Journal in `CLAUDE.md` for
      why — as PR #20, opened against `lexicon/proper-noun-notes` and
      squash-merged into it after CI passed, the same pattern PRs #15–19
      used. Not touched: `main`, or any part of B0.

- [x] **Run down the store-asset generator failure.** Done 2026-09-29, and
      the generator was never broken: the recorded 28-second failure was a
      **production** `dist/chrome` on disk, left there by the trailing
      `npm run build` in `test:e2e` (and by `build:all` at the end of
      `test:all`), which grants no localhost origin and so registers no
      content script. Confirmed both ways — production build reproduces
      `:88` "element(s) not found" in 22.1 s, test build passes in 35 s. The
      queued next step, bisecting #5–#21, would have found nothing, because
      no commit in that range is responsible.

      `tests/e2e/fixtures.ts` now refuses a production build in **5 ms** with
      a message naming `npm run build:test`, which covers all three hand-run
      generator specs rather than just this one.

      **Believing the generator is what found the defect underneath it:**
      four of the fifteen shots were stale. Three `*-05-settings.png` showed
      "60% — 1 word in 2", the copy PR #12 replaced — listing art misquoting
      the product, and B5 step 7 uploads it. The fourth was scene 4's
      "taxed attention today" tile reading the wall clock; attention is now
      seeded at 1800 s so `formatDuration` prints a stable "30 min".
      Guarded by `tests/tools/store-assets.test.ts`, 4 tests in a new suite,
      written test-first. **Two consecutive runs now produce all fifteen
      shots byte-identical** — the claim `TODO.md` had been making since
      2026-09-28 and could not support. See the two notes at the top of
      Notes, which replace the entries they contradict.

## Next

- [x] **An export carries three stores that an import silently drops.**
      Done 2026-09-29, as shape 1 — `attention` and `introduced` merge in,
      `lock` does not, and the result message names both halves instead of
      being silent about the second.

      **The judgement the item left open had already been taken, in a test
      the item had not read.** It offered shape 2, "import all three,
      running `lock` through the same cooldown path", and recorded no
      preference. But `tests/e2e/friction.spec.ts:407`, "importing a file
      cannot clear a cooldown", already spells the answer out: importing
      lock means "export before requesting an easier setting, wait nothing,
      import the old file, and the pending change and its clock are gone",
      and that test says in as many words that it exists "to fail when" a
      future change tidies export/import into a full round trip. Shape 2 was
      not an open option; it was a guarded-against regression. **Before
      costing out the options a queued item lists, grep the suite for a test
      that already decided one of them.**

      The reason to refuse `lock` is also stronger than "not obviously
      right", and it is worth keeping because it is the whole design rule:
      **every field of the lock state is a difficulty reduction when it
      comes from a file.** A `pending` change whose `unlocksAt` has already
      passed arrives ready to apply; a `panic` day with `used: 0` refills a
      spent budget; a lower `tamperCount` launders a history; an older
      `lastSeenAt` re-arms the clock-rewind trick `noteClock` exists to
      catch. The one field with genuine user value, the audit `log`, is
      already truncated to 50 entries on the way out — which tells you what
      the export thinks `lock` is for: diagnosis, not restoration.

      Attention is the mirror image and that is why it can come in at once.
      `weaveRatio` is monotone increasing in attention, so more of it is a
      *harder* page, and "anything that makes Weft harder applies at once"
      is already the rule. `mergeAttention` (`src/core/escalation.ts`) folds
      both machines into a day → seconds map and takes the **max per day,
      never the sum** — the reason `mergeCards` already gives for
      `exposures`, one line of which could have been written for this:
      "the same word read on two machines is not twice as familiar, and
      summing would let a round trip through export inflate it." Max also
      makes the import idempotent, which matters because nothing stops
      anyone importing the same file twice and the dashboard calls that
      panel "facts about reading you have actually done".

      **The bigger defect was one line above the one the item named.**
      `importAll`'s doc comment promised that an import "is not a way to
      install a forged difficulty setting", because "any reduction in
      difficulty relative to the current state still has to pass the
      cooldown, because settings are applied through the same lock path as
      any other change". It never went near that path: it called
      `saveSettings` directly. So while the item was weighing whether
      importing `lock` might hand someone an easier state, *settings* — the
      thing cooldowns actually govern — walked straight past, and one edited
      number in an exported JSON file disabled the attention tax, dropped
      the ceiling or shortened the cooldown that governs the cooldown.
      `splitImportedSettings` (`src/core/lock.ts`) now splits an imported
      file the way the rest of the product already works: harder and
      cosmetic values land at once, anything easier becomes a patch for
      `requestChange` and waits out the user's own cooldown. Direction comes
      from `assessPatch` rather than `directionOf`, which is the difference
      that matters for `learning.activeTarget` — it scores `neutral` on
      direction but resets vocabulary exposure, and only `assessPatch` knows
      that.

      Done test-first throughout, and the guards were checked for vacuity
      rather than assumed non-vacuous: restoring the old direct write turns
      4 of the 6 settings-bypass tests red, and the 2 that stay green are
      the over-correction guards (a *harder* setting, and a contrast
      setting, must still land at once). 34 tests in three files —
      `tests/core/escalation.test.ts` (9, `mergeAttention`),
      `tests/core/lock.test.ts` (9, `splitImportedSettings`) and a new
      `tests/core/storage-export.test.ts` (16, the round trip). The last is
      the first test anywhere to import `src/background/storage.ts`: it runs
      against a Map-backed `chrome.storage.local`, no browser and no I/O,
      the same bargain `providers.test.ts` makes when it stubs `fetch`, and
      each machine is a separate module instance with its own install id so
      an import really does cross between installs. The e2e test the item
      named was widened rather than renamed, as it asked.

      One thing found and left as correct: `validateSettings` clamps
      `ceilingRatio` up to `baseRatio` (`src/core/settings.ts:277`), so the
      two gates compose — validation fixes the range before the lock judges
      the direction. A test expecting `0.01` to survive was wrong about the
      code, not the other way round.

- [x] **Two committed screenshot sets are stale against `src/`, and the
      amount is now measurable.** Done 2026-09-29. Both regenerated, every
      changed shot read rather than trusted, and `docs/screens/` made
      reproducible — which took three fixes, none of them the one this item
      predicted. `docs/firstrun/` came back **byte-identical** to what was
      committed: stale by provenance, unchanged in content, which is the
      tool's own "stale does not mean wrong" caveat earning its keep. See the
      note at the top of Notes for the three causes and the one residue left.

      **The recorded cause was wrong.** This item said five `dashboard*.png`
      render an absolute calendar date from `Date.now()`. Measured, the churn
      set was `dashboard.png`, `dashboard-dark.png`,
      `dashboard-milestones.png`, `dashboard-vocabulary.png` and
      `popup.png` — `popup.png` is not a `dashboard*.png` at all, and
      `dashboard-transparency.png`, which holds the only visible rendered
      date on the page, was stable throughout. No date was involved.
      `src/ui/dashboard/index.tsx:299,429` are still the two date sites and
      still not a problem. Found 2026-09-29 by the new
      `npm run artefacts:check`, which is the first thing in this repository
      that looks at generated artefacts at all. `docs/screens/` was last
      written at `0e41950` and `src/` has moved **5 commits** since;
      `docs/firstrun/` was last written at `7f7faaa` and `src/` has moved
      **8**. Both are embedded in documentation a stranger reads —
      `README.md` uses `docs/screens/options-density.png`, and the first-run
      set is the walkthrough. Regenerate with
      `npm run build:test && WEFT_SCREENS=1 npx playwright test screenshots`
      and the `WEFT_FIRSTRUN=1` equivalent.

      **Not done in the session that found it, deliberately, and the reason
      is a decision already on record rather than the cost.** Regenerating
      `docs/screens/` rewrites five `dashboard*.png` that render an absolute
      calendar date computed from `Date.now()`
      (`src/ui/dashboard/index.tsx:299,429` against the seeding in
      `tests/e2e/screenshots.spec.ts`), so every future capture of those
      five differs from today's by a few bytes of date text whatever the
      code does — PR #12's session reverted exactly those five for exactly
      that reason. So this is ~20 binaries of which 5 carry known churn, in
      an unattended session where nobody looks at them. Worth doing, worth
      doing with someone reading the images: regenerate, then **read each
      changed shot** rather than trusting `git status`, the way the store
      shots were handled on 2026-09-29.

      ~~The deeper question underneath it: the dashboard's date rendering
      makes five documentation shots permanently unreproducible, and seeding
      the dashboard's clock would fix it.~~ **Resolved, and the premise was
      wrong on both counts.** No date was involved, and the fix was not
      confined to the spec: one of the three causes was an unstable
      comparator in `src/ui/dashboard/index.tsx`, which is why
      `sortVocabulary` now lives in `src/core/stats.ts`. The two date sites
      (`:299`, `:429`) were measured and are stable. `docs/screens/` is now
      reproducible for 18 of its 19 files; the nineteenth,
      `options-density.png`, is bistable by 17 pixels of slider-track
      antialiasing, which no amount of seeding reaches.

- [x] **`artefacts:check` can never report a byte-identical regeneration as
      fresh.** Done 2026-09-29. `lastWrote` dates a group by the last commit
      touching its own committed paths, so a regeneration reproducing the
      same bytes commits nothing and that date never moves — a group already
      confirmed correct reports the same staleness forever, which is exactly
      what happened to `docs/firstrun/` the session before this one.

      **The fix this file had already sketched had a bug, and it is the same
      shape this tool's own tests already refuse for the missing/fresh
      case.** The plan was one shared manifest, `docs/artefacts.json`, added
      to every group's `paths`. `checkArtefacts` reads paths, not JSON
      content, so committing a change to *one* group's entry in a shared
      file touches a path every *other* group also declares — silently
      moving their `lastWrote` too, on a commit that never looked at them.
      Built instead as one file per group, `docs/artefacts/<slug>.json` via
      a new `artefactManifestPath()`, which needed zero changes to
      `checkArtefacts` itself: `paths` already unions multiple pathspecs, so
      a per-group manifest just gives that union a second way to move
      forward. Proven rather than assumed: a new test verifies one of two
      groups and asserts the other is exactly as stale as before.

      **Not pre-seeded.** Creating all four real manifest files now, so an
      existing test could assert they have history, would have stamped
      "somebody checked" on two groups nobody had actually re-checked this
      session — `store listing screenshots` (2 commits since `8d2cbbb` by
      the time this landed) and `first-run walkthrough shots` (9 since
      `7f7faaa`), both genuinely stale as this was written. The tool cannot
      tell an honest stamp from a fabricated one, only the person running it
      can, so the manifest path is declared in every group's `paths` but the
      file itself is written lazily: `npm run artefacts:verify --
      "<name>"` (`tools/verify-artefact.mjs`) writes the stamp and says to
      commit it, and checks nothing itself. The pre-existing "every declared
      path has history" test now exempts the manifest path by name — it is
      derived, not hand-typed, so it cannot be the typo that test exists to
      catch.

      Done test-first: 6 new tests in `tests/tools/artefacts.test.ts`
      (13 → 19 tests, 6 → 8 suites; repo-wide tools total 55 → 61 / 16 → 18),
      red on the missing `artefactManifestPath` export before anything
      existed. `npm run test:all` exit 0 on the combined tree — see the
      measurement at the top of Notes.

      **Left stale on purpose, as real follow-up now that there is somewhere
      to record it:** regenerate and actually diff `store listing
      screenshots` and `first-run walkthrough shots`, then
      `artefacts:verify` whichever come back byte-identical. Queued as the
      item directly below.

- [x] **Two of the four real artefact groups are genuinely stale, and now
      there is somewhere to record checking them.** Done 2026-09-29. Both
      regenerated **twice each**, every image read rather than trusted, and
      `npm run artefacts:check` now reports all three screenshot groups
      `ok`. The store set came back byte-identical in all 15 captures and is
      stamped; the first-run set came back byte-identical in its 6 generated
      shots and then reading found a seventh that no generator writes at
      all. See the note at the top of Notes.

      **The stamp mechanism works, and this was its first real use.** Three
      groups went STALE → ok. Only `release notes for 1.0.1` is left, which
      is **B2a** and cannot be made fresh before the tag: its `inputs` are
      `.`, so any commit stales it, which is the design.

      **Byte-equality proves reproducibility, not correctness, and that is
      why the images had to be opened.** A regeneration reproduces a wrong
      committed image exactly as faithfully as a right one — which is
      literally how the listing art carried pre-PR-#12 copy for a month
      while every run agreed with itself. What reading confirmed: scene 5
      states "28% of content words — 1 word in 4", the qualified phrasing
      that ships; scene 4's feed is in stable folded-alphabetical order with
      `père` before `pierre`, which is PR #24's `orderKey` visible in the
      art; the first-run set states the honest "a third of the content
      words" and the no-host-permissions story.

      **And reading is the only thing that could have found the real
      defect.** `docs/firstrun/07-help.png` renders the diagnostic block,
      the block carries the version, and it had read `Weft 1.0.0` since the
      bump. It was written by **no generator** — an orphan of a manual
      capture inside the group's pathspec — so both regenerations left it
      untouched and `git status` stayed clean over a file the STALE report
      was correctly complaining about. Fixed three ways: the pathspec
      narrowed to `docs/firstrun/0*.png` (the precedent is one group above,
      where `store listing screenshots` already excludes the hand-drawn
      tiles); `07-help.png` generated for real by a new step in
      `firstrun.spec.ts`; and a guard that fails if any file in that
      pathspec has no generator writing it.

      **Writing the first verify stamp turned an existing test red**, and
      that is worth keeping: `the store pathspec takes the fifteen captures`
      counts `git ls-files` over `paths`, and `artefactsFor` folds the
      manifest into `paths` — so it matched 15 for exactly as long as the
      mechanism went unused. A guard that passes because its feature has
      never been exercised is the vacuity this suite polices elsewhere.
      Both pathspec tests now share a `captures()` helper that excludes the
      stamp.

- [x] **The onboarding preview writes to the learner's real vocabulary.**
      **It does not, and it never did.** Closed 2026-09-29 by refutation
      rather than by the judgement it asked for. `src/ui/onboarding/preview.tsx`
      sends no message at all: it runs `selectSwaps` inside a `useMemo`
      against `cards: new Map()` and renders the result into spans. The whole
      onboarding page sends exactly two message types — `get-pack`, which
      `src/background/index.ts:179` answers by `fetch`ing a JSON file off
      disk, and `complete-onboarding`, which only `finish()` sends and which
      the screenshot loop never reaches because it opens the page, waits
      1200 ms, shoots and closes without pressing a button. The page is
      structurally incapable of creating a card, so none of the three shapes
      needed choosing.

      **The seven words were a page the harness left open, and the guard that
      should have caught it named the pages by hand.**
      `tests/e2e/screenshots.spec.ts` opens three taxed pages on
      `${origin}/article.html`; `reader` and `oe` were closed before the
      vocabulary reset and `wrapped` — opened for `page-tooltip.png` — never
      was. It went on weaving and reporting exposures through the reset and
      every shot after it. The tell was in the spec already: six of the seven
      residual words are exactly the six a comment forty lines above
      attributes to `article.html`. And the tell in the guard was its own
      failure message — `assert.notEqual(spec.indexOf('oe.close()'), -1, 'the
      wrapped-mode page is never closed')` mislabels `oe` as the wrapped-mode
      page, which is the variable literally named `wrapped`, the one it had
      missed.

      Fixed by closing it alongside the other two, before the 2500 ms settle
      the spec already waits for its flushes. The guard is now **derived**:
      it finds every `const X = await context.newPage()` whose block contains
      ``await X.goto(`${origin}`` and requires each to be closed before
      `reset-vocabulary`, so a fourth page added later is covered for free.
      A second test cross-counts the `${origin}` navigations against the
      pages the derivation found, which is what fires if `context.newPage()`
      is ever renamed or wrapped in a helper and the loop silently runs over
      an empty list. Both were shown to fail: removing the close names
      `wrapped`, and renaming `newPage` names the silent skip. 63 → 64 tool
      tests, 18 suites unchanged.

      **`docs/screens/` regenerated, and the arithmetic is the proof.** Six
      shots changed, all six opened and read. `dashboard-vocabulary.png` now
      holds exactly the 19 seeded rows and no `seen 1×` strays; the
      milestone and progress figures read **393 / 1,000**, which is exactly
      the sum of the plan's own `exposures` column (61 + 54 + 48 + … + 3 + 2),
      so nothing from the run's own reading is left in the store; and the
      band reads Learning 8 + Familiar 3 + Known 5 against "3 seen but not
      yet reviewed", which is 19. All 19 files byte-identical across two
      consecutive runs, each with npm's exit status captured. No verify stamp
      was written and none should be: this group earned a real content change,
      so a stamp reading "no change to commit" would be false — the same call
      PR #30 made for the first-run group.

      **The product was telling the truth the whole time**, which is the part
      worth keeping. The item's objection — a user who only reads the
      onboarding page "starts with seven words met and a non-zero words-read
      total" — described a harness artefact. Those 26 words really had been
      read, off `article.html`, by a page nobody closed. There is nothing in
      `src/` to change and the milestones panel's "facts about reading you
      have actually done" was never overstating anything.

- [x] **Two listing screenshots clip a row of content at the top edge.**
      Found 2026-09-29 by opening them, which is the only way it could have
      been found: the files are byte-stable and byte-identical to what is
      committed, so every automated check in the repository is happy with
      them. `apple-04-progress.png` cuts the tops off the digits of all four
      progress tiles (`20`, `5`, `97%`, `30 min`), and
      `apple-05-settings.png` cuts the preset button row (`Taster`,
      `Standard`, `Committed`, `Monastic`) in half. It is a byproduct of
      `scrollIntoViewIfNeeded()` in `tests/e2e/store-assets.spec.ts:250,259`
      — the scroll is minimal, so whatever sits just above the target
      section bleeds in partially rather than being either fully in shot or
      fully out.

      Cosmetic, pre-existing, and **not** a staleness: these are the bytes
      that were committed and they reproduce exactly. But B5 step 7 uploads
      them to the Chrome Web Store, where a half-row of clipped text is the
      kind of thing a reviewer reads as unfinished. The fix is a deliberate
      scroll offset rather than `scrollIntoViewIfNeeded` — scroll the
      section to the top of the viewport, or far enough that the row above
      is cleanly excluded. Doing it rewrites 6 binaries and invalidates the
      verify stamp written on 2026-09-29, so it wants its own pass with the
      images read afterwards. ~20 min. Deliberately not folded into the
      session that found it: changing bytes in the same commit that claims
      they did not change is the one thing the stamp must never mean.

      **Done 2026-09-29, and it was four captures rather than two — with two
      of the four wrong in the opposite direction from the diagnosis above.**
      The item's account of `apple-04-progress.png` and
      `apple-05-settings.png` is exactly right: the row above the target
      bleeds in, the tiles' digits are topless and the preset row is halved.
      But opening the other four found `chrome-05-settings.png` with the
      "Resting density" heading sliced through the middle and
      `edge-05-settings.png` with it **gone altogether**, the shot opening
      mid-sentence on "What a page looks like the moment you arrive". That is
      not the row above bleeding in; it is the scene cutting the head off the
      row it exists to show, which is the worse of the two and the one a
      reviewer would read as a broken upload.

      **So the cause is not that the scroll is minimal. It is that
      `scrollIntoViewIfNeeded` states no alignment at all**, and Blink
      chooses one from the element's position and the viewport height — so
      the landing point was a function of the frame size and could err either
      way. The `04` scene erred only in the 900px apple frame; the `05` scene
      erred in all three, in both directions. **The transferable form: a
      "make it visible" call is not a framing operation, and a fix derived
      from only the cases somebody happened to open will be one-sided.** A
      guard asking only "is anything above the target in shot" would have
      passed `edge-05`, the worst of the four.

      `frameOn(page, selector)` (`tests/e2e/store-assets.spec.ts`) replaces
      both calls: it puts the section's own top edge at the top of the shot
      with an integer `window.scrollTo` — `Math.ceil`, so the rounding error
      is spent on the section's top padding rather than a sliver of the row
      above, and integer because a fractional scroll shifts subpixel text
      rendering in files that are diffed byte for byte — and then **asserts
      two-sidedly** that it landed there, so the generator fails rather than
      writing a clipped shot. The word-level `scrollIntoViewIfNeeded()` in
      scene 3 is deliberately untouched: it makes a word hoverable rather
      than framing a shot, and a partly visible line of prose at the top of
      an article screenshot is what reading an article looks like.

      **The result is better than "not clipped", because `.section:has(.band)`
      turned out to be the whole Density section rather than one row.** All
      three `05` shots now open on its title — "Density / How much of a page
      is woven, and how fast that rises while you stay on it" — followed by
      the complete preset row, `Taster Standard Committed Monastic`, which no
      committed shot had ever shown intact. All three `04` shots open on
      "What you have found out" and carry the whole 19-row feed. Each scene
      is now the same composition in all three frames, differing only in how
      much fits below the fold.

      Measured: **all 15 files byte-identical across two consecutive runs**,
      hashed, with npm's exit status captured per run and all 15 mtimes
      checked each time — and the nine unscrolled `01`/`02`/`03` captures
      came back byte-identical to what was committed, which is a free control
      showing the change is confined to the two framed scenes. All six
      changed files were opened and read.

      **One consequence, measured rather than reasoned: the seeded attention
      no longer affects a single committed byte.** Aligning scene 4 on the
      feed scrolls the tile row out of all three frames, so
      `SEEDED_ATTENTION_SECONDS` and the four tests guarding it now defend a
      property of the seeding rather than a shipped pixel — proved by running
      the generator at 60s instead of 1800s and finding all fifteen hashes
      unmoved. Both the spec comment and `tests/tools/store-assets.test.ts`
      now say so in as many words. **Kept, not deleted**: the drift returns
      the moment anyone reframes this scene to include the tiles, which is a
      plausible thing to want, and rediscovering why `9s` and `6s` were both
      legitimate output of the same code cost a session once already.

      The verify stamp was **deleted** rather than rewritten, for the reason
      the item itself gives: its note read "no change to commit", and this
      commit changes six of the fifteen files. `artefacts:check` will date the
      group from this commit on its own.

      Done test-first: 2 tests in a new `describe` in
      `tests/tools/store-assets.test.ts`, red on `'.section:has(.finds)' is
      scrolled into shot by something other than frameOn()` before anything
      was edited. The selector list is **derived** from the spec rather than
      typed out, so a fourth framed scene is covered without an edit there,
      and all three guards were shown to fail rather than assumed: reverting
      one call names that selector, dropping the lower bound names the
      `edge-05` class by filename, and renaming the selector literals fires
      the non-vacuity floor at "found 0 framed sections". The probes were run
      by copying a backup file back, not by asking git — the process note
      from PR #31, where a `git checkout` of one file reverted the fix along
      with the probe.

- [x] **The same framing defect was live in a second generator, and the
      guard could not see it.** Done 2026-09-29. The item above fixed
      `store-assets.spec.ts`; `firstrun.spec.ts:107` had the identical
      `scrollIntoViewIfNeeded()` call on the identical kind of selector,
      `.section:has(.help__report)`, and nothing caught it. **Its shot
      happens to land correctly at 1000x900, which is the trap rather than a
      reprieve** — the four clipped store captures were byte-stable too, and
      `artefacts:check` called that group `ok` for as long as they were
      wrong. A call whose correctness is a coincidence of the viewport height
      is one options-page edit away from being silently wrong in
      documentation a stranger reads.

      **The reason it was missed is the guard, not the reviewer.**
      `tests/tools/store-assets.test.ts` already derives its selector list
      from the spec rather than typing it out, and says why in as many words:
      "a hand-written list of the things to check cannot police the thing
      that was forgotten." But the *file* it reads is hand-picked. The
      derivation was within-file and the thing forgotten was a different
      file — the same lesson one level up, and the third sighting of this
      shape in three sessions (PR #31's mislabelled `oe.close()`, PR #30's
      pathspec claiming a whole directory).

      `frameOn` now lives in `tests/e2e/fixtures.ts` and is exported, so
      there is one implementation and the two-sided assertion cannot be
      present in one generator and absent in another. The new guard,
      `tests/tools/shot-framing.test.ts`, **derives the spec list too** —
      from the one thing every generator has and no other e2e spec does, an
      `OUT` directory under `docs/`. A fourth generator is covered without an
      edit. The two-sidedness assertion moved out of
      `store-assets.test.ts` rather than being duplicated there.

      The guard matches **any** scroll call on a `.section`, not
      `scrollIntoViewIfNeeded` by name — naming the one mechanism that has
      already gone wrong is the same one-sidedness, and leaves
      `scrollIntoView({ block: 'start' })` silently skipped. Proved by
      injecting exactly that and watching it fire.

      **Zero committed bytes changed, and that is measured rather than
      assumed.** `scrollIntoViewIfNeeded` happened to land exactly where
      `frameOn` computes, so all 8 first-run files came back byte-identical.
      All three groups were regenerated **twice each** with npm's exit status
      captured per run and the mtimes checked every time: **45 files** (8
      first-run, 18 store, 19 screens) byte-identical run-to-run *and* to
      what was committed. Relocating `frameOn` was confirmed not to move a
      store byte, rather than argued to be safe.

      **The runtime assertion was proved live in the new spec, not merely
      satisfied.** Injecting a 40px mis-landing makes the generator *fail*
      with `.section:has(.help__report) sits 40px below the top of the
      viewport` and write nothing, which is the difference between "the
      generator passed" and "the generator would have caught it". The three
      static guards were each shown to fail too: reverting the fix names the
      selector, dropping the lower bound names the `edge-05` class, and
      renaming `OUT` makes the store-assets test *vanish from the run
      entirely* and is caught only by the non-vacuity floor.

      All three verify stamps were **written** this time, not deleted, and
      the distinction is the whole point of the stamp: PRs #30-#32 each
      changed real content, so their stamps' note ("no change to commit")
      would have been false. Here nothing changed and it is true. One process
      note: a probe run failed with `Unknown system error -11 ... scandir
      'test-results/.playwright-artifacts-0'` — the iCloud trap, not the
      assertion — so **exit 1 from a generator has to be read before it is
      believed**, in both directions.

- [x] **`docs/screens/` declared 19 files generated and 5 of them had no
      generator, and three of the five were stale.** Done 2026-09-30, as
      **shape 1**: the five are deleted and the guard is generalised to all
      three image groups. The premise was exact and the staleness was worse
      than recorded.

      **The census, measured rather than trusted.** 19 committed, and the
      derivation of what `screenshots.spec.ts` actually writes returns
      **14** — with **zero** derived names that have no committed file, so
      the two sets line up exactly and the five offenders are precisely the
      ones the item named: `landing.png`, `pricing.png`, `word-latin.png`,
      `word-page.png`, `hub-descent.png`. All five were captures of the
      **content site**, which no spec can produce because nothing serves
      `dist/site`, and none was referenced by any document or page.

      **All five were opened and read, and that found two more stale shots
      the item had not.** Each is a copy fix a previous session spent a
      whole PR making, still on display in a committed binary that
      `artefacts:check` reported fresh:

      1. `landing.png` — "48% — 1 word in 2", the unqualified phrasing
         **PR #8** replaced with "of content words", at a density the demo
         can no longer reach since #8 turned its ceiling to 35%. Its caption
         predates #8 too: it does not name the preset on show.
      2. `word-latin.png` (`/latin/vacca`) — "This is the Latin word your
         English borrowed from **vaccine**", the **backwards descent
         sentence PR #17 fixed on 312 published pages**. The site now reads
         "your English *vaccine* was borrowed from".
      3. `hub-descent.png` — the note column in **straight** double quotes,
         `"gangende" survives in "gangway"`, which **PR #20** unified to
         curly across all 59 Latin and Old English notes. The seed now reads
         `“gangende” survives in “gangway”`.

      A fourth staleness in `word-latin.png` was chased down rather than
      assumed, because it could have been a live defect: its "Other Latin
      nouns" list shows `miles` bare beside `rēx` and `dēns`, and
      `tools/build-site.mjs:358` renders that list from `e.tgt`, the
      inflected surface form, so a missing macron there would be on every
      Latin word page. It is not. `git log -L` on the seed row shows `mīles`
      has carried its macron since `89cdfda`, and the built pack reads
      `"tgt": "mīles"` today. **A stale screenshot showing a defect is not
      evidence the defect exists.**

      `word-page.png` (`/old-english/hūs`) and `pricing.png` read current —
      the OE descent sentence was never backwards, and the three prices
      still match `src/core/pricing.ts`. So three of five, not one.

      **Shape 1 was taken and the deletion is the part a human may want to
      reverse.** It is recoverable: `git show <sha>^:docs/screens/landing.png`
      restores any of them. The grounds are the ones this file recorded —
      nothing links to them, and the repository refuses to keep artefacts
      nothing can check — strengthened by the three stale ones above, which
      make them a liability rather than merely unread. Shape 3, a
      site-screenshot generator, was rejected on cost against value: it
      needs `dist/site` built and served, and it would be new machinery
      maintained for five binaries no reader has.

      **The pathspec stays `docs/screens`, and that is now the accurate
      declaration rather than a line nobody drew.** Every remaining file is
      generated, so there is nothing to exclude; and no glob can pick out
      the fourteen anyway, since they share no prefix. What keeps it honest
      is a test rather than a pattern.

      **PR #30's guard is generalised to all three groups, and the names are
      derived in both shapes.** `firstrun.spec.ts` and `screenshots.spec.ts`
      name each file as a single-quoted literal; `store-assets.spec.ts`
      composes `${frame}-${slug}.png` from a frame table and the slug it is
      called with, so none of its fifteen names exists in the file as a
      whole string — which is exactly the reason the guard had been left
      applying to one group only, and the reason the other two went
      unchecked for two weeks. Multiplying the frames by the slugs covers
      it. Single quotes rather than any quote, because this repository
      writes filenames in prose inside backticks and a comment naming a file
      is not a generator writing it.

      Done test-first: red on
      `docs/screens/hub-descent.png is inside the artefact pathspec but
      tests/e2e/screenshots.spec.ts does not write it` before anything was
      deleted. 71 → **73** tools tests, 21 suites unchanged (one hand-picked
      test replaced by three derived ones). Three vacuity probes, each shown
      to fire rather than assumed, and restored by copying a backup back and
      checking md5: a hand-made file added inside `docs/screens` names it;
      **breaking the composed derivation turns the *store* group red**,
      which is what proves that group was not passing vacuously; and a
      pathspec matching nothing hits the `matches nothing` floor.

      **The verify stamp for this group was deleted rather than rewritten.**
      Its note read "no change to commit" and this commit changes the
      group's file set, so `artefacts:check` dates the group from this
      commit on its own. Same call PRs #30, #31 and #32 each made for the
      group they genuinely changed, and the one thing the stamp must never
      mean. `artefacts:check` still reports **1 stale** — the release notes,
      B2a, whose `inputs` are `.` — with all three screenshot groups `ok`.

      Note that `artefacts:check` could never have caught any of this: it
      asks provenance, not content, and `tools/artefacts.ts:22` says so.
      The stamp written for this group on 2026-09-29 was literally true —
      all 19 files were regenerated twice and compared, with no change to
      commit — but the regeneration was a no-op for five of them, so "no
      change" vouched for nothing there. **That is the sense in which a
      whole-directory pathspec launders a hand-made file into a generated
      one**, and it is now a test failure rather than a thing somebody has
      to notice.

- [x] **Four hand-made assets sit outside every artefact pathspec, nothing
      has ever checked them, and B5 step 7 uploads three of them to the
      Chrome Web Store.** Done 2026-09-30, and **three of the four were not
      hand-made**. `tools/make-store-tiles.mjs` renders all three tiles from
      HTML, the same way `tools/make-og.mjs` renders the social card — so the
      remedy this item called impossible ("there is no spec to re-run") was a
      forty-second measurement. Run on the current tree, all three came back
      **byte-identical** to what was committed, with mtimes moved, so they are
      current as well as reproducible. Read anyway, because byte-equality
      proves reproducibility and not correctness: neither tile states a
      density number at all, which is the class that killed `landing.png`, and
      all four word pairs on the marquee — `rivière`/river, `hūs`/house,
      `cyning`/king, `vacca`/cow — are in the packs with exactly those forms.
      The generator is now `npm run tiles` and a `store promo tiles` artefact
      group reporting **ok**, on `inputs: ['tools/make-store-tiles.mjs']` and
      not `src`, because it imports nothing from `src/`.

      **`docs/firstrun/icons.png` is the one that really is hand-made, and it
      is broken.** See the new item below. Confirmed by derivation rather than
      by the old comment: `tools/make-icons.mjs` writes `assets/icon-*.png`,
      the shipped icons, and nothing anywhere writes the sheet.

      **Why nobody found the generator is the transferable half, and it is the
      fifth sighting of one shape in five sessions.** `tools/artefacts.ts`
      stated it as fact — "the three tiles and the logo beside them are drawn
      by hand and are not generated from anything" — and the test beside it
      repeated it. The guard that should have caught it asks *one direction*:
      every file **inside** a pathspec must be written by a generator, which
      is how `07-help.png` and `landing.png` were found. It cannot ask the
      converse, where output sits **outside** every pathspec and so is in no
      group to be reported on. And its generator list was a hand-typed table
      of three *specs*, while the fifth generator is not a spec at all — PR
      #33 generalised that table from one spec to all specs and stopped at the
      directory. The new guard derives generators from anything under
      `tools/` or `tests/e2e/` that declares an `OUT` inside `docs/`, so a
      sixth needs no edit. Two floors, because the regression that would
      restore the blind spot is the derivation quietly matching specs only.
      `ls tools/*.mjs` against `package.json` found **three** unlisted tools
      in one command: `make-store-tiles.mjs`, `make-icons.mjs` and
      `merge-cousins.mjs`. Only the first writes a committed artefact.

      **And `docs/STORE-LISTING.md:205` had named the generator the whole
      time** — "`node tools/make-store-tiles.mjs` writes, into `docs/store/`"
      — in the document `docs/SUBMIT.md` sends a human to for the listing
      copy. The repository disagreed with itself and the guard believed the
      wrong half. Before writing "generated from nothing" about any file,
      `git grep` the tool name; it costs one command. That page now names
      `npm run tiles` and the artefact group.

- [x] **`docs/firstrun/icons.png` has 134 blank rows where its own label
      promises the magnified comparison, and no generator can fix it.**
      Done 2026-09-30, by **shape 2** of the three the item offered: there is
      a generator now, `tools/make-icon-sheet.mjs`, reachable as
      `npm run icons:sheet`.

      **The premise was exact.** Measured before anything moved, by decoding
      the PNG and counting non-background pixels per row: 1180×700, rows
      y 530–663 entirely blank, 134 of them, and the only ink below at
      y 664–699. The item had not named *why*, and the fragment's position
      is the answer — it sits at **x 933–1029**, so the row was laid out at a
      literal 8×, which turns 16/32/48/128 into 128/256/384/**1024** and
      needs 1792px of artwork inside a 1180px frame. It overflowed sideways
      and was clipped from below. A framing fix alone would not have been
      enough; the geometry had to change.

      **Shape 2 was chosen over shape 3 (delete) on a stronger argument than
      the item recorded, and the argument is a committed input.** The sheet
      has to show the *shipped rasters*, because `tools/make-icons.mjs` draws
      each size with its own geometry — two warp threads at 16px, three at
      32, four at 48 and 128 — while `assets/icon.svg` beside them carries
      four at every size. A sheet rendered from the SVG would look entirely
      plausible and would misreport the one thing the sheet exists to show.
      So its inputs are files that can move, which is recurring staleness a
      generator closes for good. PR #34 refused a site-screenshot generator
      as "new machinery for one binary no reader has"; that argument does not
      transfer, because those five had no committed input at all.

      The sheet is now 880×1537: the same three toolbar bands, then a 2×2
      grid magnifying each icon to **384px**. 384 because it is the least
      common multiple of the four sizes, so every factor is a whole number
      (24×, 12×, 8×, 3×) — nearest neighbour is only truthful at an integer
      factor, and at 5.33× some source columns are duplicated five times and
      others six, which puts a stagger into a thread that is actually
      uniform and reports a defect the icon does not have.

      **The generator asserts its content fits before writing**, the bargain
      `frameOn` makes in `tests/e2e/fixtures.ts`: it throws rather than
      writing a clipped asset that two consecutive runs would then agree with
      each other about. Proved by narrowing the frame — it exits 1 with
      `the sheet is 844px wide inside a 456px frame` and writes nothing,
      confirmed by md5.

      Guarded in a new `tests/tools/icon-sheet.test.ts`, 4 tests, all four
      red first against the committed sheet. Two read the pixels — no band
      blank enough to be a section that rendered nothing, and no ink on any
      frame edge — and two are derived: the sheet must show every size
      `make-icons.mjs` writes, and every magnification factor must divide.
      Deliberately **not** widened to the other forty committed PNGs, because
      those are screenshots of scrolled pages where a partly visible line of
      prose at the top edge is what reading an article looks like.

- [x] **Four committed images were in no artefact group, and the guard built
      last session to catch exactly that could not see three of them.**
      Found and fixed 2026-09-30 while declaring the icon sheet's inputs.

      `assets/icon-{16,32,48,128}.png`, `assets/icon.svg`, `site/icon.svg`
      and `site/og.png` were outside every pathspec. Two independent reasons,
      and both are the same shape one level up from the bug they hid:

      1. PR #36's converse guard derives generators from anything under
         `tools/` or `tests/e2e/` declaring an `OUT` **inside `docs/`** — and
         `make-icons.mjs` writes into `assets/`. The check built to find
         generators outside the system had the system's own blind spot
         compiled into its predicate.
      2. `tools/make-og.mjs` declares no `const OUT` at all; it writes
         `join(ROOT, 'site/og.png')` inline. So `site/og.png` was
         unreachable by *any* directory predicate, however written.

      Three new groups — `icon comparison sheet`, `shipped extension icons`,
      `social card` — take it from 5 to **8**, and the measured gap is now
      **zero**: 47 committed images, 47 declared.

      **The guard that settles this class asks from the other end.** Every
      test in `artefacts.test.ts` had started from something hand-drawn — a
      table of three specs, then a predicate scoped to `docs/`, then an `OUT`
      convention — and each was wrong in turn, three fixes to one derivation
      in three sessions, each making it cleverer and leaving it a derivation.
      `every committed image is inside an artefact pathspec` enumerates from
      `git ls-files` instead. There is no list to forget to extend: a new
      image is covered the moment it is committed or it fails by name.

      **The exception list is empty and keeping it empty is the point.**
      Neither stray needed one. `site/og.png` got the group it should always
      have had. `site/icon.svg` turned out to be a **hand-made copy** of the
      exact string `make-icons.mjs` already generates — byte-identical when
      found, which is the only reason it was not yet a lie — so the generator
      now writes both destinations. Editing the mark would otherwise have
      updated the extension and the store listing and left the landing page
      showing the old one, with `git status` clean. Regenerating moved **zero
      bytes**, verified by md5.

      If a genuinely hand-made image is ever added, the honest move is a
      group whose `regenerate` names who to ask, not an entry on an
      exception list.


- [x] **`tools/seed/lex-fr.tsv` is partly generated and nothing said so.**
      Found 2026-09-30 while checking a claim in a draft journal entry;
      done the same day. `merge-cousins.mjs` writes the `etymon` and `note`
      columns of `lex-fr.tsv` from `fr-cousins.tsv`, and both are tracked.
      Measured before anything moved: all **118** values in those two
      columns came from the 116 claims (`love` and `work` each have a noun
      row and a verb row), **none** was written by hand, and the two files
      agreed exactly. So nothing was wrong *yet* — the defect was that the
      tool could not have told anyone if it had been.

      **It had three silent failures, not the one the item named**, each an
      edit to the review file that never reaches the pack. Run against temp
      copies with node's own exit status captured:

      1. **A correction** printed `118 left alone (already had a value)` and
         exited 0 — byte-identical to an untouched tree — and the old value
         kept shipping. The item's case.
      2. **A retraction** — deleting a claim — printed `117 left alone`,
         exited 0, and the deleted etymology stayed in the pack. The merge
         only ever wrote. This is the one that matters most right now: see
         the item below, which needs eighteen corrections and retractions.
      3. **A line that cannot ship as written** was skipped (a space for a
         tab), never applied and never reported (a misspelt kind), or
         silently replaced (a second claim for one word).

      Neither shape the item offered, and the reason is the cause: the tool
      counted *in step* and *disagrees* together, so no exit code could
      separate them — shape 2's `--dry` would have exited 0 on a correction
      too. The merge is now a pure function, `tools/cousins.ts`, that sorts
      every field into in step, added, disagree or unclaimed; the CLI names
      every field in the last two with both values and exits 1, `--force`
      settles them in `fr-cousins.tsv`'s favour and lists what it changed,
      and `--dry` exits 1 on anything a merge would change. Only lines that
      change are rewritten. `npm run cousins` is new, which closes the last
      of the three unlisted tools.

      Guarded in a new `tests/tools/cousins.test.ts`, 11 tests in 2 suites.
      Nine pin the merge against hand-written fixtures and the CLI against
      a copy of itself in a temp directory, so no run can reach the tracked
      lexicon. Two check the **committed** lexicon is a fixed point of the
      merge — the packs step's rebuild-and-compare one layer upstream, and
      a content check rather than a provenance one, because this is text.
      Red first against a no-op stub, and against the *old* CLI, which
      failed with `a dry run called a lexicon that disagrees with its claims
      in step`. Six probes each shown to fire, restored by md5: the old
      counting (3 tests red, the right 3), rewriting unchanged lines (7), a
      real correction to `die` (names `lex-fr.tsv:279`), a real retraction,
      a space for a tab (names `fr-cousins.tsv:164`), and exit code 0
      forced.

- [x] **Read the four hand-made store and first-run assets for staleness.**
      Queued by PR #35 and handed over again on 2026-10-01, by which time
      PRs #36 and #37 had given all four a generator — so the premise ("no
      regeneration is possible, these are hand-drawn") was two PRs stale.
      **The worry under it was right: three of the four showed a mark the
      icon had replaced nine days earlier**, and so did four other surfaces
      nobody had named. `docs/firstrun/icons.png` is the one that was
      current.

      **Measured before anything moved.** All four generators were run and
      all eleven files they write came back byte-identical to what was
      committed, mtimes moved; `artefacts:check` said `ok` for the tiles and
      the card. Then the images were opened, and the mark was read back out
      of every rendering of it — warp threads counted, and how many the weft
      covers:

      | Rendering | Weft crosses |
      |---|---|
      | `assets/icon-16.png` / `-32` / `-48` / `-128` | 1 of 2 / 2 of 3 / 3 of 4 / 3 of 4 |
      | `docs/store/logo-edge-300x300.png` | **2 of 4** |
      | `docs/store/tile-small-440x280.png` | **2 of 4** |
      | `docs/store/tile-marquee-1400x560.png` | **2 of 4** |
      | `site/og.png` | **2 of 4** |
      | `assets/icon.svg`, `site/icon.svg` | **2 of 4** |
      | the header of all 713 site pages | **2 of 4** |

      `0d9910e` (2026-09-22) redrew the mark because crossing two of four
      "read as an H with a stray stroke beside it rather than as one woven
      thing", and set the rule that the weft reaches every thread but the
      last. It changed the rasters. The mark was also written out by hand as
      SVG in **five** other places — a string in `make-icons.mjs` that became
      both `icon.svg` files, the tile generator, the card generator, the
      site builder's template and `site/index.html` — and none of them
      moved. `git grep '76\.3'`, the old weft's end, found all seven files
      holding it in one command.

      **Why every check was green.** The generators reproduced their output
      exactly because the stale fact was inside them. `artefacts:check`
      called the tiles fresh because their group's one input, the tile
      generator, had not moved; the mark had, in a file the group did not
      name. **Provenance cannot see a copy.** And PR #36's reading of the
      tiles asked two questions — a density number, the word pairs — and
      not this one.

      **The marquee was stale a second way.** It led with *rivière*, *hūs*,
      *cyning*, *vacca* — the four pairs `3060d93` removed from the social
      card on 2026-09-26, when French was made to lead everywhere, because
      Old English beside Latin "reads as a tool for medievalists rather than
      as a way to learn a language someone is actually planning to speak".
      That commit could not reach the marquee: its generator was in no
      `npm run` and nobody knew it existed. It now shows the card's four,
      *rivière*, *cheval*, *matin*, *forêt*. **This is a decision taken on
      Creagh's behalf** — see "One decision a human may want to look at"
      below for how to reverse it.

      **Fixed as one source rather than five corrected copies.**
      `tools/brand.ts` holds the geometry and the four lead pairs.
      `make-icons.mjs` fills the geometry as rasters — all four PNGs
      byte-identical before and after, by md5 — and the vector icon, the
      site header, the card and the tiles embed `markSvg()`. Regenerated:
      both `icon.svg` files, all three tiles, the card. Every one was
      opened and read, and a pixel diff against the old bytes puts each
      change inside the mark and nowhere else — plus the column of pairs on
      the marquee. `site/index.html` still carries the markup inline,
      because it is hand-written and cannot import; it is read back off the
      built page by a test.

      **Guarded by reading the drawing, not the bytes.** 17 tests, 16 in a
      new `tests/tools/brand.test.ts` and 1 in `build-site.test.ts`, each
      red first for its own reason:

      1. Every committed image drawn from the mark is decoded and the weft
         must cross every thread but the last. Red on the three tiles and
         the card by name, `the weft crosses 2 of 4 threads`, while the four
         icons passed — which is what shows it discriminates.
      2. Every committed SVG must draw what `icon-128.png` draws, within a
         pixel. Red on both, each thread and the weft named.
      3. The header of every rendered page must draw what `icon.svg` draws.
         Red at `713 of 713`, then `1 of 713` — `/index.html` — once the
         template was fixed.
      4. No tool writes an `<svg>` of its own. Red naming `make-og.mjs` and
         `make-store-tiles.mjs`.
      5. A tool that imports `brand.ts` must have its artefact group declare
         it as an input. Red naming all three groups; this is the provenance
         hole itself.
      6. The rule on the geometry at all four sizes, and each lead pair
         against the French pack.

      Seven probes, each shown to fire and restored by md5 — the pre-redraw
      crossing, a full crossing, a misspelt pair, a pair the pack lacks, a
      group dropping its input, the palette moved with the art left alone,
      and oversized pairs against the tile generator's new fit check, which
      exits 1 and writes none of the three files.

      **One verify stamp deleted, and it is worth knowing what it had been
      vouching for.** `docs/artefacts/shipped-extension-icons.json` read
      "regenerated and compared against the committed files; no change to
      commit", written 2026-09-30. True — of an `icon.svg` that had been the
      superseded mark for eight days. This commit changes two of that
      group's six files, so the note would now be false and
      `artefacts:check` dates the group from this commit on its own. **A
      stamp records that a regeneration agreed with itself**, which is all
      it was ever defined to mean; the sheet's stamp stays, because its
      inputs are the rasters and they did not move.

- [x] **Twenty-nine of the 116 French etymology claims were false, and the
      discoveries feed stated them as fact.** Done 2026-10-01, by checking
      every line against a source rather than the nineteen this item had
      checked, and by making a claim that names no source impossible to
      ship. Queued as eighteen; it was twenty-nine.

      **The pass, and what it read.** Every English word a claim names was
      looked up on etymonline (280 entries) and every French word on English
      Wiktionary, with French Wiktionary as a second reading (155 words
      each). Extracted by `curl` as verbatim text rather than through a
      summarising fetch, and held outside the repository; nothing in the
      tree depends on that cache. Every one of the 115 lines that survive
      now carries the entries it was read against — see the fourth column
      of `tools/seed/fr-cousins.tsv` and the header that explains it.

      **What was false, measured:**

      | Kind | Count | Examples |
      |---|---|---|
      | Descents whose English word came from elsewhere | **12** of 30 | the eleven in this item's old table, and `rich`: etymonline has Old English *rīce*, whose form Old French *riche* only "influenced" — this item had filed it as "defensible and should stay" |
      | Notes naming the wrong root or sense | **8** | the seven in the old table, and `arbre` → *arbour*, from *herba* |
      | "the root of English X" where X came straight from Latin or Italian | **9** | `cheval` (*cavalry* is Italian, *chivalry* Medieval Latin *caballarius*), `chien`, `main`, `roi`, `terre`, `porte`, `fenêtre`, `pont`, and `jour` (*journey* yes, *journal* no) |

      This item had named four of the nine. And four more were true but
      weak, and moved for the reason the guard below exists: `queen` quoted
      “regina”, which is not an English word (now *regal*); `walk` quoted
      “marching”, an inflection etymonline has no entry for, and English
      *march* descends from *marcher* (now "the root of"); `find` quoted
      “treasure trove”, which etymonline files under *trove*; and `light`
      shared only an Indo-European root with *lucid* (now *luminous*, from
      *lūmen* like *lumière*).

      **Each French word with a false descent got a true relative instead,
      checked the same way**, so the twelve are notes now rather than
      blanks: *argent* → *argentine*; *ville* → *village*, *villain*;
      *pays* → the root of *peasant*; *réponse* → *response*; *cadeau* →
      *cadet* (both from *capitellum*, "little head"); *visage* → *visor*;
      *soldat* → *soldier*, both named for a gold coin; *porter* →
      *portable*, *transport*; *fermer* → *firm*, *confirm*; *attraper* →
      *entrap*; *facile* → *facility*; *riche* → *rich*, as a cousin. The
      seven wrong roots are now *testy* (from Old French *teste*, which is
      *tête*), *denigrate*, *feeble* and *foible*, *intend*, *deplore* and
      *implore*, *moribund*, *arboreal*. **`heavy` was deleted**: Wiktionary
      has *lourd* "probably" from *lūridus*, and the file leaves out what is
      arguable. 18 descents and 97 notes remain, landing in 117 fields.

      **Then a second reader checked the result**, independently and against
      the same cached text: all 32 new or changed claims and all 13
      removals. It found none false and two arguable, both taken. *terre*
      had said "terrain and territory", and etymonline brings *territory*
      from *territorium* only "probably" — the word that removed *lourd* —
      so it says *terrain* alone. And *villain* was glossed "once a
      farmhand", which is the Medieval Latin word's meaning, not the English
      one's; it is "once a peasant" now. It also asked for *cavalier* and
      *Regina* among the sources, so that *cavalry* reaches *caballus* and
      *reine* reaches *rēx* in text actually read.

      **The public copy was not clear of it.** This item checked the
      nineteen French words and called the copy clean, which it was of
      those. The "the root of" claims were the landing page's lead table —
      `cheval`, `fenêtre`, `jour`, `main`, `chien` — its FAQ structured data,
      the README's table and the store listing's description, each in the
      paragraph explaining that cheval *shares a root* with cavalry. All
      four now say "shares a root with".

      **It reached more than the copy, measured with the real modules.** A
      descent floors the selector's cognate score, so the false ones doubled
      `argent`'s (0.411 → 0.823) and took `cadeau` and `pays` from 0 to
      0.700; and on a first meeting the tooltip's reason line read "New to
      you, and ancestor of English “money”". Both are gone with the claims.

      **The guard, built test-first.** A claim's fourth field lists the
      entries it was checked against — `etym:<english>`, `wikt:fr:<french>`
      and two optional kinds — and `tools/cousins.ts` derives what it must
      cite from the claim itself: the etymonline entry for every English
      word it names, and the Wiktionary entry for its French word on every
      row its lemma has (`love` and `work` each have two). A claim short of
      any is refused before anything is applied, `--force` included,
      because force decides which of two files is right and this is a
      question neither can answer. Six tests in a new `describe` in
      `tests/tools/cousins.test.ts`: five red on the first run for the
      rule's absence, and the sixth green for the wrong reason — the old
      parser refused every four-field line, so a test that the parser
      refuses bad tokens passed against a parser that refused good ones. A
      control made it fail for the right reason. The two committed-file
      tests then went red naming all 116 lines, until the sources went in.

      **The tool did what PR #38 built it to.** Without `--force` the merge
      named exactly the 45 fields edited — 12 added, 20 disagreeing, 13
      retracted — and exited 1; with it, it landed them and a dry run
      reported 117 in step. `lex-fr.tsv` moved on 33 rows and in no column
      but etymon and note; `en-fr.json` moved on 21 `etymonOf` and 59 notes
      and nothing else, and `index.json` not at all.

      **Six listing and documentation images changed, and only those.**
      All three generators were run, twice each for the two that changed:
      the three `*-04-progress.png` and `dashboard.png`,
      `dashboard-dark.png`, `dashboard-discoveries.png`, every one opened
      and read line by line; the other 30 came back byte-identical, the
      first-run set included, whose stamp was renewed. The store stamp was
      deleted, because its note says "no change to commit". Read the
      dashboard note in Notes before trusting `dashboard.png` to reproduce.

- [x] **The Old English pack makes the claim the French one did, and on
      published pages.** Found 2026-10-01, by asking whether the French
      flaw was particular to French. It is not. 242 of the 356 rows in
      `tools/seed/lex-ang.tsv` say their Old English word *became* the very
      English word it translates, and that is false wherever modern English
      took the word from somewhere else — the shape of all twelve false
      French descents. The etymonline entries already fetched for the French
      pass happened to cover 80 of the 242, and three of those fail:

      | Row | The pack says | etymonline says |
      |---|---|---|
      | window | `ēagþȳrel` became *window* | from Old Norse *vindauga*, "wind eye"; ēagþȳrel is the word it replaced |
      | egg | `æġ` became *egg* | from Old Norse *egg*; the Old English cognate survived as *ey* and then died out |
      | close | `clȳsan` became *close* | from Old French *clos-*, "also partly from Old English beclysan" |

      Likely and not yet checked: `lion` ← `lēo`, whose modern form
      etymonline gives from Anglo-French *liun*. Three in 80 suggests six
      to ten more among the 162 unchecked. The 88 rows whose etymon is a
      *different* English word (`steorfan` → *starve*) have a safer shape
      and have not been checked either.

      **This is worse than the French case in one way: Old English has a
      page per word.** `/old-english/eagthyrel` reads "This is the Old
      English word that became **window** — literally “eye-hole”", and
      `/old-english/aeg` says the same of *egg*. Nothing is indexed until
      **B3**, so it lands free before then; after, every correction strands
      a published sentence. The selector's cognate floor and the tooltip's
      "ancestor of English" line apply here too.

      How to land it:

      1. Fetch etymonline for the 162 unchecked lemmas, and for the 88
         differing etymons. `curl` with a User-Agent carrying no personal
         detail; add `?ref=etymonline_crossreference` to the URL, without
         which some entries (`march`, `argentine`) come back as an
         unrendered React payload rather than HTML.
      2. For each whose entry does not run back to Old English, delete the
         etymon or replace it with a true descendant, in `lex-ang.tsv`
         directly — Old English has no review file. Keep what etymonline
         calls "partly from", or drop it, by the French file's rule: the
         arguable is left out.
      3. `npm run packs`, `npm run site`, and read every word page that
         changed; `tests/tools/build-site.test.ts` will hold the sentence
         shape but cannot hold the fact.
      4. Separately, decide whether Latin and Old English etymology should
         move into review files that carry sources, as French now does, so
         the guard covers them. That splits two seed files and wants its own
         pass.

      About 90 minutes for steps 1–3.

      **Done 2026-10-01, all four steps, and it was twenty-seven claims, not
      six to ten.** Every one of the 330 was read against etymonline — the 79
      entries the French pass had already fetched and 279 more, the etymons
      and the words their notes name — and against English Wiktionary where
      etymonline has no entry, 24 pages in all. The sample above had found
      three in 80, all one shape. The whole file held two:

      | Shape | Count | Examples |
      |---|---|---|
      | The English word came from somewhere else | **16** | *window*, *egg*, *gift*, *weak*, *wassail* (Norse); *lion*, *ire*, *close* (French); *fee* ("the merger … of two words"); *sad* (from *sæd*, not *unrōt*); *asking*, which "replaced" *āscung*; *dream* ("much study has failed to prove"); *somnolent*, a Latin cousin of *swefn*; *knave*, from *cnafa* not *cnapa*; *farewell*, whose Old English form Wiktionary gives only as "possibly"; *shade*, mainly from *scead* |
      | A compound or derivative standing in for the word | **11** | *gospel* for *spell*, *bishopric* for *rīċe*, *lychgate* for *līċ*, *hundred* for *hund*, *one* for *āna* (it is *all āna* that became *alone*), *mind* (from *gemynd*), *fang* (a noun made from *fōn*'s participle), *nimble*, *foremost*, *morning*, *full nigh* |

      **Compounds count as false here and inflections do not, and the
      product's own wording is why.** The word page says "became", its
      description "the direct ancestor of", the feed "comes straight from".
      *bishopric* contains *rīċe* and is not what *rīċe* became. But *shadow*
      is the oblique case of *sċeadu*, *numb* the past participle of *niman*
      ("literally 'taken, seized'"), *former* the comparative of *forma* —
      the word itself, inflected — so six rows name the real descendant now:
      *spell*, *shadow*, *morn*, *numb*, *former*, *lich*. A cognate reshaping
      the word does not break a descent either: *sister*, *give* and *carve*
      took a Norse form and are still the Old English words. "Partly from"
      does, by the French file's rule. 21 removed, 6 corrected, and two
      renamed to the headword actually read, *thorpe* → *thorp* and *swithe*
      → *swith*. 309 claims remain.

      **The notes were read against the same entries, and forty moved.**
      Fourteen rows that lost or changed their etymon gained a true note
      rather than a blank — *ēagþȳrel*'s is now "literally “eye-hole”;
      “window”, “wind-eye”, is Norse". Twenty-six were rewritten, sixteen of
      them on claims that stand, where a fetched entry contradicted, hedged or
      did not support the wording: *weardian* "whence warden and guard" (both
      French, cousins through Frankish); *blæc* "whence bleak" (Old Norse
      *bleikr*); *gān* "gangende survives in gangway" (*gang* is "not
      considered to be related to go"); *lǣċe* "whence the bloodletting worm"
      ("according to OED … a distinct word"); *miċel*'s proverb, which
      Wiktionary calls a corruption of "many a little makes a mickle"; and
      "every" place-name in -ham, -bury and -ton, where the sources say
      "many". Notes the fetched text did not address were left, and are not
      thereby checked — Walthamstow under *stōw* is one.

      **Step 4 is taken, lighter than this item imagined: a sidecar, not a
      split.** `tools/seed/ang-etymons.tsv` holds one line per claim naming the
      entries read, and `tests/tools/ang-etymons.test.ts` — 5 tests, a new
      suite — fails on an etymon with no line, a line citing some other word,
      an unreadable token, or a line outliving its claim. Not French's review
      file and merge: French etymology was authored in a file of its own and
      merged in, Old English's always lived in the seed, and a sidecar kept
      the content diff of `lex-ang.tsv` to the 45 rows that changed. The
      claims taken out are listed at the foot of the ledger with what the
      dictionary says. Red first, naming all 309; then each rule shown to
      fire on its own break, restored by md5. Latin is not done, and is
      queued below.

      **Public copy moved with it.** The landing page's Old English table led
      with *drēam → dream*; it shows *sellan → sell* now, and the descent hub's
      intro and `docs/PEDAGOGY.md`'s table use *mete → meat* where they had
      *drēam*, which `PEDAGOGY.md` now explains. The README and the launch
      draft only ever said what *drēam* meant, and stand.

      Rendered and read: all 44 word pages that changed, the hub (325 rows →
      305) and the index. All 36 generated screenshots regenerated
      byte-identical — `page-old-english.png` hovers *ēa*, which carries no
      etymon — and their three groups are stamped. `en-ang.json` moved in 46
      `etymonOf` and 66 `note` fields and nothing else; `index.json` did not
      move.

- [x] **One Latin note puts a verb's grammar on a noun.** `lex-la.tsv`,
      the very first row: man → `vir`, note "third-person plural “virī” also
      means “men” collectively". *virī* is the nominative plural of a noun,
      and person belongs to verbs. Seen while reading the file's header for
      the item above, and not checked further — the rest of the Latin notes
      have not been read for this. Five minutes and a pack rebuild; the
      sentence also stands on `/latin/vir`.

      **Done 2026-10-02, and reading the rest found four more notes and an
      etymon.** All 28 Latin notes were read against Lewis & Short for every
      Latin word a note uses (47 entries), Allen & Greenough for the two
      that state a rule of grammar (§42 and §336), and etymonline for every
      English word a note explains (23 entries), with English Wiktionary
      beside them for five. 23 stand as written. Five do not:

      | Row | The note said | The dictionary says | It says now |
      |---|---|---|---|
      | man → `vir` | third-person plural “virī” also means “men” collectively | *virī* is a nominative plural. Lewis & Short: "a male person, a man (opp. femina)"; "a husband … (very freq.)"; human beings only "poet." | a man as opposed to a woman, and often a husband; a human being is “homō” |
      | key → `clāvis` | the collarbone was named for its key-like shape | etymonline: "So called supposedly from its function as the 'fastener' of the shoulder", and the bone is "Medieval Latin clavicula", c. 980 — Lewis & Short's *clāvicula* is a small key, a tendril, a door-bolt | medieval Latin called the collarbone “clāvicula”, a little key |
      | cow → `vacca` | Jenner named the vaccine after the cowpox he used | etymonline credits Jenner with *vaccination*, "for the technique he publicized", and dates the noun *vaccine* to 1846, "from French vaccin"; Wiktionary credits him with *variolae vaccinae*, his name for cowpox | the vaccine is named after the cowpox Jenner used |
      | yes → `ita` | classical Latin has no bare word for yes; “ita” means “thus” | Allen & Greenough §336: "no one Latin word in common use meaning simply yes or no"; Lewis & Short on *ita*: "In affirmations, esp. in replies, yes" | Latin has no one common word for yes; “ita” means “thus”, said in reply |
      | shadow → `umbra` | a little shade | that is *umbella*, "dim. umbra (a little shadow …), a sunshade, parasol" — and the tooltip prints a note with the etymon badge off, where this one glossed *umbra* itself | “umbrella” is a little shade |

      **The last two, and the second row's "medieval", came from a second
      reader**, given the same extracts and told to prove the first reading
      wrong. The "medieval" overturned the first reading's own rewrite of
      `clāvis`, "the collarbone is “clāvicula”" — true of medieval Latin, on a
      page headed "Classical, c. 75 BC – AD 200". It also failed `vacca`,
      which the first reading had left as "supported in substance" and then
      rewritten itself while the second reader was still working; the two
      verdicts were reached separately. The vaccine sentence
      was on the landing page and in `docs/PEDAGOGY.md` as "Jenner named it
      after the cowpox he used"; both say "named after the cowpox Jenner
      used" now. The hub's intro — "*Vaccine* is named after a cow, because
      Jenner used cowpox" — never made the claim and stands.

      **And `ita` was listed as the ancestor of an English "ita vero".** It
      is Latin: Allen & Greenough §336 gives *ita vērō* as one of the ways
      Latin says yes, etymonline has no such entry and Wiktionary no English
      section. The note is what found it — a note's wording picks the feed's
      sentence, "means" makes a false friend, and the feed read "ita became
      English ita vero, but classical Latin has no bare word for yes".
      `/latin/ita` said "your English **ita vero** was borrowed from", the
      tooltip "Ancestor of English ita vero", and the selector scored
      `yes → ita` a cognate at **0.960** on the strength of it, which is 0
      now. The etymon is removed; the note is the page's "Worth knowing".
      `vir`'s feed line was no sentence either — "vir became English virile,
      but third-person plural “virī” also means “men” collectively" — and is
      a plain descent now.

      **The guard is three things, each red first.**
      (1) `tools/seed/la-notes.tsv`, one line per note, repeating it and
      naming the entries read, with `tests/tools/la-notes.test.ts` — 6
      tests, a new suite — failing on a note with no line, a note reworded
      since its line was written, a line that does not cite Lewis & Short's
      entry for the note's own headword, a note naming its row's etymon
      without citing that word's etymonline entry, an unreadable token, or a
      line outliving its note. Red on an empty ledger, naming all 28. The
      five notes taken out are at the foot of the ledger with what the
      dictionary says.
      (2) A second `describe` in `tests/tools/lexicon-notes.test.ts`:
      person, tense and conjugation appear only in notes on verbs, derived
      from each entry's own `pos` across all seven packs. Red naming `vir`
      alone; `wīfmann`'s "woman-person" is not grammar and did not fire.
      (3) `homō` and `clāvicula` joined the orthography guard's table of
      Latin the lexicon does not carry.
      Nineteen probes across the three, each shown to fire or to stay green
      as it should, each restored by md5.

      Rendered and read against a baseline build: `/latin/vir`,
      `/latin/clavis`, `/latin/vacca`, `/latin/umbra`, `/latin/ita`, the hub
      (314 rows → 313), the Latin index and the landing page — nine files,
      the ninth the sitemap, where two dates moved. `en-la.json` moved in 9
      `note` fields, 1 `etymonOf` and its date, and nothing else; `index.json`
      did not move. All 36 generated screenshots came back byte-identical, the
      documentation set only with the date held (see Notes), and the three
      groups are stamped.

- [x] **Twenty-two Old English words are published at a URL that drops or
      mangles their ǣ.** Found 2026-10-01 in the list of pages the etymon
      pass changed: `lǣċe` is `/old-english/l-ce` and `tǣcan`
      `/old-english/t-can`. `slugify()` (`tools/build-site.mjs`) maps `æ` to
      `ae` *before* it normalises, so the precomposed `ǣ` (U+01E3) is not yet
      an `æ` when that rule runs; NFD then splits it into `æ` and a macron,
      the macron is stripped, and the bare `æ` falls to `[^a-z0-9]+` and
      becomes a hyphen. Counted from the pack: 22 of 350 headwords, none in
      Latin. The worst are not ugly but wrong — `sǣ`, sea, is `/old-english/s`;
      `ǣr` is `/old-english/r`; `ǣfen`, evening, is `/old-english/fen`, which
      is an English word for something else. Fix: normalise first, or map
      `ǣ` explicitly, and add a test that no slug drops a letter of its
      headword's ASCII fold. `assignSlugs()` will catch any collision the
      change creates. Every Latin page links its Old English counterpart by
      slug, so those links move too, and `site:check` will say so. Free before
      **B3**, a stranded URL each after. About 30 minutes.

      **Done 2026-10-02, and it was exactly as found: 22 of 350, and none
      anywhere else.** Measured over all seven packs before anything moved:
      Latin 0 of 349 and the five modern packs 0, which have no word pages
      in any case. `slugify()` now takes the word apart before it spells
      anything — one call moved ahead of the letter map — and the reorder
      creates no new collision in any pack, so `assignSlugs()` had nothing
      to do. `sǣ`
      is `/old-english/sae`, `ǣfen` `/old-english/aefen`, `ǣr`
      `/old-english/aer`, `lǣċe` `/old-english/laece`, `ǣghwǣr`
      `/old-english/aeghwaer`.

      **The guard is a new `describe` in `tests/tools/build-site.test.ts`**,
      read off the built pages like the rest of that file: every word page's
      address must spell its whole headword. The test folds the headword
      itself rather than borrowing the builder's function, because the defect
      was in the order of the builder's steps and a copy would have copied
      the order — so it decomposes first by construction, and it refuses a
      letter it has no spelling for instead of hyphenating it. Red first,
      naming all 22 by address and headword. A floor beside it wants more
      than 600 word pages read, more than 50 headwords that need a letter
      spelled out (66 do) and at least one whose spelled letter arrives
      precomposed (22 do). Five probes, each restored by md5: the builder
      forgetting þ and ð (25 pages named), the builder spelling þ as `t`
      (25), the test's own table forgetting ð (9, "nothing spells its ð"),
      an empty walk ("only 0 word pages were read"), and the test's fold
      forgetting to decompose, which fails loudly on 359 pages instead of
      passing.

      **What moved, proved rather than eyeballed.** Built before and after
      into temporary directories: 22 files renamed and 91 changed — 23 Latin
      pages, 66 Old English, the Old English descent hub and the sitemap —
      and every one of the 113 differs by the 22 addresses and nothing else,
      282 occurrences, checked by rewriting the old build's addresses and
      comparing the result byte for byte with the new one. `site:check` 713
      pages / 16 108 links, the same totals as before, because only targets
      moved. No tracked file linked any of the 22, and nothing needs a
      redirect, because nothing is published before **B3**. One date will
      move: the install page's `<lastmod>` is the commit date of
      `tools/build-site.mjs`, the coarseness Notes already records.

- [x] **Nineteen Latin pronunciations are wrong in the seed, and the
      generator that wrote them has three bugs.** Found 2026-10-02 from one
      row read for its note: `persōna` is printed `/pɛˈrsoːna/`. Measured
      over all 356 rows of `lex-la.tsv` with a scratch syllabifier:

      | What | Count | Examples |
      |---|---|---|
      | Stressed on the wrong syllable | **7** | `quīnque` `/kʷiːˈŋkʷɛ/`, a disyllable stressed on its last; `quaesō`, `quattuor`, `quaerere`, `coquere`, `relinquere`, `quaestiō` |
      | A diphthong the word does not have | **2** | `cāseus` `/ˈkaːseu̯s/`, `calceus` — *-e-us* is two syllables |
      | The stress mark a consonant early | **10** more | `/pɛˈrsoːna/`, `/aˈrɡɛntʊm/`, `/dɔˈrmiːrɛ/`, `/sɛˈntiːrɛ/`, `/moːˈnstraːrɛ/`, `/ɪˈntɛrdʊm/` — *rs*, *rg*, *nt* cannot begin a Latin syllable |

      All seven of the first kind contain *qu*, and that is the bug.
      `tools/seed/_ipa.py` walks the word twice, `_la_units` for the stress
      and `latin_ipa` for the phones, and only the second knows *qu* is one
      consonant: the first counts its *u* as a nucleus — `quīnque` comes out
      with four syllables — so the stress index is worked out against the
      wrong count. `eu` is in `LA_DIPHTHONGS` for every word, where Latin has
      it in a handful (*seu*, *neu*, *heu*). And the mark is placed by walking
      back over every consonant before the stressed vowel, so it takes the
      previous syllable's coda with it. Old English shows none of the third
      kind and was not checked for the others. The module's docstring says
      "the derivation is tested" and `docs/THIRD-PARTY.md` that it is "tested
      against known forms"; no test in the repository imports it, so the test
      this item adds is also what makes both sentences true.

      These print in the tooltip, on each word page and in its meta
      description — `/latin/quinque` says "pronounced /kʷiːˈŋkʷɛ/". Fix the
      three in `_ipa.py`; `fill_ipa.py` never overwrites a value, so clear
      the nineteen cells first or correct them by hand; then hold it with a
      test that recomputes the stressed syllable from the macronised
      headword, which is the classical rule and needs no dictionary. The
      scratch script is `/tmp/weft-la/stress.py` if `/tmp` has survived.
      While there: `tools/seed/__pycache__/_ipa.cpython-312.pyc` is tracked.
      About an hour, and free before **B3**.

      **Done 2026-10-02, and it was thirty, not nineteen.** The three bugs
      were exactly as diagnosed; the census was not, for two reasons. The
      scratch script compared stress counted from the end of the word, so
      `caeruleus` — three syllables stressed on the first where it has four
      stressed on the second — read as "antepenult" both ways and was missed:
      the *eu* rows are **3**, not 2. And the "consonant early" count took
      only clusters that cannot begin a word (*rs*, *nt*); Allen & Greenough
      §7 splits *sp*, *gn* and a doubled consonant too — "dīx-it, sax-um
      are preferred to dī-xit" — so `aspicere`, `pugnāre`, `difficilis` and
      `nārrāre` /naːˈrːaːrɛ/ were wrong as well: **19** onset-only rows, 4
      more inside the *qu* seven. Plus `iūsiūrandum`, a syllable long,
      because its second *i* is the consonant of *jūrandum* (Lewis & Short:
      "jus-jūrandum"). 7 + 3 + 19 + 1 = **30** headwords, 50 surface forms.

      **The rule was checked against the sources before it was written
      down.** A&G §§2–8 and 10–12 read from Perseus (§5 note 2: the *u* of
      *qu* and *gu* "is reckoned neither as a vowel nor as a consonant"; §7a
      and note 1; §11b–c and note 3; §12), Lewis & Short for the four
      respelt words, and Wiktionary's Classical transcriptions for 16 of the
      30 — 9 headwords, and 7 verbs by their first person — which agree with
      the A&G division on every one, compounds included (`respōnsum`
      [rɛsˈpõː.sũː]), except `mōnstrō` [ˈmõː.stroː], where Wiktionary
      nasalises the *n* and this generator does not. So
      `mōnstrāre` is /moːnsˈtraːrɛ/. A doubled consonant the mark falls
      inside is written out twice, `naːrˈraːrɛ`, and keeps `ː` elsewhere.

      **The fix is one tokenisation for both halves.** `_la_tokens()` reads
      the word once and the stress, the weight and the mark all read its
      tokens; *eu* is a diphthong only in `LA_EU_DIPHTHONG` (ceu, heu, neu,
      seu); `LA_RESPELT` holds `iūsiūrandum` as `iūsjūrandum`. Then every
      Latin IPA cell was blanked and `fill_ipa.py la` refilled all 356 —
      safe because all 356 had first been shown equal to the old generator's
      output, so none was a hand correction — and **exactly the 30 moved;
      the other 326 are byte-identical.** The self-check gained 13 forms
      worked by hand, 11 of which fail on the old generator (`seu` and
      `tenebrae` are guards against over-correcting), and now exits 1 on a
      mismatch where it printed a count and exited 0. `__pycache__/` is
      untracked and ignored.

      **The guard is `tests/tools/latin-stress.test.ts`, 5 tests**, which
      work every headword's syllables, stressed syllable and onset out of
      its spelling by A&G §§7, 11, 12 — without importing the generator —
      and hold the IPA column to them. Red first on exactly the 30. A
      spelling the rules cannot read (an untabled *eu*, *ei*, *ui*, *su*
      before a vowel, *z*) is refused with a message saying to read Lewis &
      Short, not guessed. Seven probes, each restored by md5: the test
      without the mute + liquid onset (names `agricola`, `ecclēsia`,
      `mōnstrāre`), without *qu* (14 rows), `cāseus` dropped from the table
      (refused), `persōna` and `quīnque` reverted in the seed (each named
      alone), the parser blind to the non-syllabic mark (19 unreadable).
      **The seventh passed, and that is a finding:** no headword has a short
      penult before a stop and a liquid (*te-ne-brae*), so the data cannot
      test that branch of the weight rule; `tenebrae` is in the generator's
      self-check instead.

      **What moved.** `en-la.json`: 50 `ipa` fields and `builtAt` 10-01 →
      10-02; no other pack. The site: 30 Latin word pages, each exactly the
      old page with its transcription rewritten (180 occurrences, checked
      by rewriting a build of `main` and comparing byte for byte), and the
      sitemap, where 701 of 713 `<lastmod>` moved to 10-02 — every Latin and
      Old English word page, because the date is per pack. All 36 generated
      screenshots came back byte-identical, the documentation set with
      `TZ=America/Los_Angeles` as before, and the three groups are stamped.
      `README.md` and `docs/THIRD-PARTY.md` said the derivation was "tested
      against known forms" and now say what is checked; THIRD-PARTY credits
      Allen & Greenough, which two ledgers already cite.

- [x] **Hold the committed icons to the geometry by their pixels — not by
      rebuilding and diffing them, which this item used to propose and which
      would fail on a correct tree.**
      Queued 2026-09-30 as "CI can rebuild the four shipped icons and diff
      them". **Its premise was measured false on 2026-10-01**, before anyone
      built on it. The comment in `tools/artefacts.ts` points here by name,
      so this item existing is part of that comment being true.

      The premise was that `tools/make-icons.mjs` is "byte-reproducible on
      any machine", verified by "two runs, md5 identical" — on one machine.
      It draws with no browser, no fonts and no clock, so its **pixels** are
      the same everywhere. Its **bytes** are not: a PNG's IDAT is
      `deflateSync` output, and that is whatever zlib the Node binary was
      built against. Measured by running a copy of the tool under both:

      | Node | zlib | `icon-128.png` |
      |---|---|---|
      | 26.7, Homebrew — this machine, which wrote the committed file | 1.2.12 | 431 bytes, IDAT 374 |
      | 22.23.3, official build — the kind CI installs | 1.3.1 fork | 432 bytes, IDAT 375 |

      All 65 536 decoded bytes of RGBA are equal. The 16, 32 and 48px icons
      and `icon.svg` came out identical under both. So
      `npm run icons && git diff --exit-code assets` in CI would exit 1 on a
      correct tree — the pixel-equality trap `CLAUDE.md` refuses for the
      screenshots, arriving through the compressor instead of the font
      stack. And the obvious repair, committing CI's bytes, would leave this
      machine rewriting the file on every `npm run icons`.

      **The check that works is a test, not a workflow step.** Decode the
      committed PNG and compare its pixels with what the geometry draws:

      1. Move the rasteriser — `fillRect` and the body of `icon()` up to the
         RGBA buffer — out of `make-icons.mjs` into `tools/brand.ts` as a
         pure function, leaving the tool with only the PNG encoder. Check by
         md5 that all four files still come out byte-identical here.
      2. In `tests/tools/brand.test.ts`, for each size: `decode()` the
         committed file with `tests/tools/png.ts` and assert its buffer
         equals the function's. Exact, independent of zlib, and inside
         `npm test`, so it needs no CI step and fires for one reason.
      3. Prove it the way the packs step was proved: change a geometry
         constant in `tools/brand.ts`, run the tests without regenerating,
         watch it fail by size.

      That closes the one gap left after 2026-10-01: an edit to
      `tools/brand.ts` that nobody rebuilt. Today that is caught only if it
      breaks the crossing rule, or by `artefacts:check` reporting the group
      stale — "nobody has checked", where this would say "these pixels are
      wrong". About 40 minutes.

      Still not covered, and deliberately: `docs/firstrun/icons.png`,
      `site/og.png` and the store tiles are rendered by Chromium, so they
      stay on provenance plus the crossing-rule reading.

      **Done 2026-10-01, as written, and the two vectors with it.** The queue
      sent the session at this item in its old wording — the CI step — so
      the premise was measured again before anything moved, with the same
      official Node 22.23.3 binary, npx's cache of the `node` package:
      `icon-128.png` 431 bytes here, 432 there, all 65 536 decoded bytes
      equal, the other three sizes and both SVGs identical.
      `iconPixels(size)` is in `tools/brand.ts` and `make-icons.mjs` keeps
      only the encoder; all six files it writes were rewritten, mtimes
      moved, md5-identical to what was committed. A new `describe` in
      `tests/tools/brand.test.ts` reads the files off the icons' artefact
      group, decodes each PNG and requires exactly the pixels `iconPixels`
      draws, and requires each committed SVG to be `iconSvg()` exactly. The
      vectors were not in the item. They are in because an SVG is a string,
      with no encoder in the way, and because the existing shape comparison
      holds each vector against the *committed* raster — so it passes when
      both go stale together. Measured rather than argued: with
      `CROSSING[4]` moved and nothing rebuilt, it still passed for both.

      Red first, twice: `does not provide an export named 'iconPixels'`,
      then a blank stub failing all four sizes by name, each with a pixel
      count and the box they fall in. Then the proof the item asked for, on
      the final test file, each probe restored by md5:

      | Edit, nothing rebuilt | Fails |
      |---|---|
      | `GEOMETRY[48].warpFrac` 0.095 → 0.105 | `icon-48.png` alone |
      | `CROSSING[4]` 0.72 → 0.70 | `icon-48.png`, `icon-128.png` — the two four-thread sizes — and both SVGs |
      | `GEOMETRY[128].alpha` 0.85 → 0.86 | `icon-128.png` and both SVGs, whose warp opacity is read off it |
      | one unit of blue in `WOAD_LIGHT` | all four icons and both SVGs; the other 17 tests pass, because a shape reading allows 6 per channel |
      | the `<title>` in `iconSvg()` | both SVGs alone |
      | one space appended to `site/icon.svg` | that file alone |

      And the point of the item in one probe: with the 432-byte Node 22
      encoding swapped in for the committed icon, `git diff --exit-code --
      assets` exits 1 and the test passes, 23 of 23. The whole file passes
      under that Node too. **No CI step was added**, and that is the
      design, not an omission: the check runs inside `npm run test:tools`,
      which CI already runs, and fires for one reason.

      Seven tests in one new suite: tools 117 → **124**, 33 → **34**
      suites. `tools/brand.ts` is also an input of the store tiles and the
      social card, so both were regenerated — blob-identical to `HEAD`,
      mtimes moved — opened and read, and stamped with `artefacts:verify`
      beside the icons, so this commit leaves no group stale but the
      release notes.

- [x] **The discoveries feed reads one pack entry per target word, and
      eleven true etymologies sit on the other one.** Found 2026-10-01 when
      a corrected French note would not appear in a rendered feed. Cards
      are keyed by the target word (`fr:argent`), and the dashboard and the
      quiz builder both build their lookup with the *first* pack entry for
      each target word (`src/ui/dashboard/index.tsx`'s `glosses`,
      `src/background/index.ts`'s `build-quiz`). Two English words often
      share one: *silver* and *money* are both `argent`, *girl* and
      *daughter* both `fille`, and when the first carries no story the feed
      shows nothing for the word. Measured over all seven packs: French 2
      (`fille` for daughter, `argent` for money), Latin 4 (`puer`, `domus`,
      `terra`, `magnus`), Old English 5 (`mann`, `rīċe`, `sōþ`, and `hund`
      twice) — and `hund` is two Old English words, "dog" and "hundred",
      sharing one card. The tooltip is unaffected: it shows the entry
      actually woven. Three shapes: prefer an entry that carries a story
      when building the lookup, which is smallest; key cards by English
      lemma as well, which `hund` argues is the honest one; or give every
      row sharing a target word the same claim, which is a data patch over
      a lookup bug. Measure first which surfaces besides the feed read that
      map.

      **Done 2026-10-02, and two were hidden, not eleven.** Measured first,
      over all seven packs, row by row. **Four surfaces built that lookup by
      hand, not two**: the feed and the vocabulary list beside it — its
      gloss, its "→ English" badge and its search box — from one map in the
      dashboard; the quiz builder; and the site builder, for every Latin
      and Old English word page and hub, which skipped plurals and otherwise
      did the same. 49 target words have more than one English gloss. Of
      the eleven claims counted above, the feed hid exactly two, `fille`
      and `argent`, whose first rows carry nothing. Three are a second true
      descent beside one the feed already tells (`domus` → *domicile*,
      `terra` → *territory*, `magnus` → *magnificent*); four say nothing
      the first row does not (`puer`'s boy row, `mann`'s person row,
      `sōþ`'s true row, `hund`'s hound row); and two are claims about a
      different word with the same spelling, `hund` "hundred" and `rīċe`
      "rich" — the item directly below.

      **Shape 1, taken at the level of the claim.** `entriesByTarget()` in
      `src/core/lexicon.ts` reads each word from its first singular row
      and, when that row carries no claim, takes the first claim — etymon
      and note together — that another row *of the same part of speech*
      carries. All three readers use it, and their hand copies are gone.
      Not the literal shape 1, "prefer an entry that carries a story":
      probe P3 picked the storied row whole and moved `fille`'s gloss from
      *girl* to *daughter* and `argent`'s from *silver* to *money*, in the
      vocabulary list and in the quiz — a change to what a learner is
      asked, made because of which row a claims file filed the claim under.
      Not shape 2: 46 of the 49 shared words are one word with two glosses,
      so keying cards by English lemma would schedule *fille* twice, and it
      needs a migration of every stored card and exported file. Not shape
      3: `fr-cousins.tsv` keys its claims by English lemma by design, and
      copying a claim to every row sharing a spelling would copy `rīċe`'s
      "rich" onto the noun.

      **The part-of-speech line is what stops shape 1 manufacturing a false
      claim, and it withholds nothing today.** Every row sharing a word and
      a part of speech in the seven packs is one word with two glosses —
      read through, all 49 — and no first row lacks a claim that only a row
      of another part of speech carries. It is there for `earm`: were
      *poor* listed before *arm*, shape 1 would tell every reader who met
      *earm* as "poor" that it survived into English as *arm*.

      Test-first. `tests/core/lexicon.test.ts`, 9 tests in 2 suites: red on
      the missing module, then 5 of 9 red against a stub that was the old
      loop moved into core, the 4 green being the three guards against
      over-correcting and the one-entry-per-word check.
      `tests/tools/lexicon-lookup.test.ts`, 6 tests in 2 suites: no source
      file under `src/` or `tools/` builds a map keyed by a row's
      `tgtLemma` — red naming exactly the three copies — and over the
      shipped packs the lookup tells every same-part-of-speech story,
      borrows none across parts of speech and moves no gloss, with floors
      on the files walked and the packs read. One e2e test in
      `friction.spec.ts` imports an `argent` card and reads the real
      dashboard: red against `main`'s dashboard, whose snapshot listed
      "argent silver seen 3×" and rendered no feed at all. Six probes, each
      restored by md5: without the part-of-speech condition only the unit
      test on `earm` fires, because the packs give it nothing to catch;
      first-row-only fails five, naming `fr:fille` and `fr:argent`; the
      storied row taken whole fails both gloss tests, naming the four
      fields it moved; writing onto the row fails the frozen-pack test; and
      both floors fire, "only 14 source files were read" and "read 0
      packs".

      **What moved: two lines of the feed**, "fille — shares a root with
      English “filial”." and "argent — shares a root with English
      “argentine”, silvery." The site, built before and after into
      temporary directories, is byte-identical in all 718 files. All 36
      generated screenshots came back byte-identical — none of the 19
      seeded words has two glosses — the documentation set with
      `TZ=Pacific/Pago_Pago` holding the date, and the three groups are
      stamped. The package grew 652 bytes, 985 → 986 KB.

- [x] **Three Old English target words are two words each, and every
      surface speaks for the first.** Found 2026-10-02 measuring the item
      above. A card is keyed by its target word alone, so `ang:hund` is
      the dog and the hundred, `ang:earm` the arm and poor, and `ang:rīċe`
      the realm and powerful: two words each, under one spelling, their
      rows told apart only by part of speech (noun and numeral, noun and
      adjective twice). What a reader who met only the second sees:

      | Met as | The feed says | The quiz asks | The vocabulary list |
      |---|---|---|---|
      | *hundred* → `hund` | "hund survived into English as hound." | *dog* | hund — dog, → English *hound* |
      | *poor* → `earm` | "earm survived into English as arm." | *arm* | earm — arm, → English *arm* |
      | *rich* → `rīċe` | "rīċe — a realm; it survives as the -ric of “bishopric”." | *country* | rīċe — country |

      The first two are false etymologies of the word the reader met. The
      schedule is shared as well — the card the selector consults for the
      hundred row is the dog's — so meeting one word counts as meeting the
      other. And the site prints one page per spelling, the first row's:
      the numeral and both adjectives have no page, and `rīċe` → *rich*, a
      checked descent in `tools/seed/ang-etymons.tsv`, is on no page at all
      and absent from the descent hub. No lookup can fix this, because a
      card does not record which word was met; the part-of-speech line in
      `entriesByTarget()` only stops it getting worse. Three shapes, none
      chosen:

      1. **A homograph number in the seed**, carried into `tgtLemma`, so
         the second word is a second card, a second page — `assignSlugs`
         already makes `hund-dog` and `hund-hundred` of a shared base — and
         a second ledger key. Honest and general. It touches everything
         that displays `tgtLemma` or keys on it: the site's headword and
         slug, the Old English ledger, the orthography guard’s vocabulary.
      2. **Teach the second word under a spelling that does not collide.**
         etymonline gives "Old English hundred “the number of 100, a
         counting of 100”", beside "simple hund" as the common word; for
         *poor*, a word Bosworth–Toller attests — unchecked candidates are
         *þearfende* and *unspēdiġ*. A content decision per row, and it
         cannot save *rīċe* → *rich*, the best of the three.
      3. **Drop the second rows.** Smallest, and loses the same descent.

      Under 1 or 2 an existing learner's card for these three stays with
      the first word, which is a small wrong for at most three cards. Free
      before **B3**, because 1 moves two addresses. About two hours for 1,
      with the ledgers.

      **Done 2026-10-02, shape 1 — and the guard it needed found a fourth
      pair.** Measured first, over all seven packs: **nine** targets share a
      headword across parts of speech, not three — these three, `sōþ` (true,
      truth), German `schnell` and `langsam` (an adjective and its adverb),
      Spanish `mañana` (morning, tomorrow) and French `mort` (death, dead).
      Part of speech cannot tell the two kinds apart; English Wiktionary
      can. `hund`, `earm` and `rice` — Wiktionary's title for `rīċe`, which
      404s — each have two etymology sections; `soþ`, `schnell`, `langsam`
      and `mañana` have one; `mort` has two, and is the item below.

      **Shape 1, because it is the only one that keeps `rīċe` → *rich*.**
      Shape 2 would choose a different Old English word for "poor" for a
      software reason and cannot save *rich*; shape 3 loses all three
      words. The number is a superscript after the citation form in the
      seed's `tgt` cell — `hund²`, `earm²`, `rīċe²` — in Wiktionary's order
      of etymologies, which is also the order the rows already had, so the
      first word (dog, arm, realm) keeps its bare id and every existing
      card. `tgtLemma` carries the number and `tgt` never does;
      `spelling()` in `src/core/lexicon.ts` takes it off for the one place
      the extension prints a `tgtLemma` — the dashboard's fallback — and
      for every tool that reads the cell as a spelling: the site's slugs
      and JSON-LD, `verify-packs`, which warned three times on `²` as a
      script character until it read the spelling, `fill_ipa.py`, and the
      orthography guard, which missed a planted bare `riċe` under the old
      reading and catches it now. The quiz compared distractors by
      identity, which let "dog" be a wrong answer to *hund²*; it compares
      spellings. The hundred's note said "the usual word for it", and the
      feed prints a note with no gloss beside it, so it says "for the
      number" — the same claim from the same entry.

      Test-first. `tests/core/lexicon.test.ts` +3 and `quiz.test.ts` +1:
      red on the missing export and on "seed 1 offered dog for hund²".
      `tests/tools/lexicon-homographs.test.ts`, 7 tests in 4 suites: red
      naming exactly `ang:earm`, `ang:hund` and `ang:rīċe` while the five
      listed one-word targets passed, then on the three missing entries,
      the feed and the floor; it fails on a target shared across parts of
      speech that is neither numbered nor in `ONE_WORD`, on a listed word
      that no longer spans two, on a `¹` or a number with no bare first,
      and checks each pair against hand-written glosses, claims and feed
      sentences. `tests/tools/build-site.test.ts` +1: red on three pages
      printing `hund²` through JSON-LD `alternateName`; its overwrite test
      now matches a page by headword *and* gloss, because two pages are
      headed hund. Five probes, each restored by md5: slugs without the
      collision suffix (named ōs, liber and the three pairs), the pack
      builder leaving the number in `tgt` (five tests, 22 pages), `sōþ` off
      the list and a bogus entry on it (both named), the lookup grouping
      by spelling (three tests), and the orthography reading above.

      **What moved: 5 of 7 154 fields** of `en-ang.json` — three
      `tgtLemma`s, the note, `builtAt` — and `index.json` did not. The
      site went 713 → **716** pages and 16 108 → **16 178** links: three
      renamed (`hund` → `hund-dog`, `earm` → `earm-arm`, `rice` →
      `rice-country`), three new. Main's build rewritten by those three
      addresses is byte-identical to this one in 698 of 718 files, 22
      occurrences; the other 20 differ only by the new words — the Latin
      pages for hundred, poor and rich now link an Old English
      counterpart, 14 adjective pages list one in "Other adjectives", the
      index counts 353 words and 306 descents, the hub gains `rīċe` →
      *rich*, and two sitemap dates move with the pack. `/old-english/hund-hundred`
      is the first page to render the "Worth knowing" branch, and reads as
      a caption. All 36 generated screenshots came back byte-identical
      under `TZ=Pacific/Pago_Pago` and the three groups are stamped; the
      package stayed 986 KB. No end-to-end test was added: the dashboard
      reads the same lookup as before, and that lookup is held over the
      shipped pack in the tools test.

- [ ] **The feed tells Latin borrowings in Old English's words.** Found
      2026-10-02 when a corrected note moved `vir` into the feed's plain
      frame and it read "vir survived into English as virile".
      `src/core/discoveries.ts` has two sets of frames chosen by one
      boolean, `historical`, and Latin is historical, so it takes the set
      written for Old English: "English X comes straight from Y", "X began
      as Y", "Y survived into English as X". Those are what the Old English
      ledger holds a claim to. The Latin site says something looser on
      purpose — `META.la`'s frame is "was borrowed from" — because *virile*
      is from *virīlis* and *clavicle* from *clāvicula*, through French. Run
      over the pack with the real module: of 314 Latin lines **304** are
      plain descents, and 226 of those take one of the three strong frames
      (73 "comes straight from", 82 "began as", 71 "survived into English
      as") — "English aquatic comes straight from aqua", "rēx survived into
      English as regal". Six more are the `unchanged` kind — `camera`,
      `duo`, `bonus`, `via`, `ōvum`, `rēgīna` — and read "camera has not
      changed in a thousand years — it is still camera", which is Old
      English's timescale on a word English took in 1708 for a vault. The
      false-friend frame says "became" too; no Latin row reaches it today.

      The borrowing frames French already uses say what happened — "English
      borrowed X from Y", "X came into English from Y" — so the smallest fix
      keys the frame set on whether English *descends* from the language
      rather than on whether it is still spoken: Old English descends, Latin
      and French lend. `historical` keeps its other job, ordering the feed,
      and `tests/core/delight.test.ts` holds the frames. Do it with or after
      the Latin descent pass below, which settles what a Latin claim may say.
      About 45 minutes.

- [ ] **The Latin pack's descent claims have never been checked against a
      source either.** Found 2026-10-01, by the question that found the Old
      English ones: was the flaw particular to the language? 312 Latin word
      pages say "This is the Latin word your English X was borrowed from",
      and nothing records that any X was looked up. The Latin frame is
      looser than the Old English one, on purpose — `META.la` says
      "borrowed", and a learned borrowing from a derivative is still a
      borrowing: *vaccine* is from *vaccīnus*, from *vacca*. So the standard
      is not Old English's. The English word must have come from Latin, from
      this word or one built on it; not merely share a root with it, and not
      have come through French from a different Latin word.

      1. The fetcher is `/tmp/weft-ang/fetch.py` (see Notes, 2026-10-01). It
         writes into `/tmp/weft-etym/cache/etym`, which held 560 English
         entries when the Old English pass ended — but `/tmp` does not survive
         a reboot, so check before relying on it.
      2. Read each etymon's entry for "from Latin <word>", and for a French
         route that names some other Latin word.
      3. Record the sources the Old English way: a `tools/seed/la-etymons.tsv`
         and `tests/tools/ang-etymons.test.ts` generalised over both packs.
      4. `npm run packs`, `npm run site`, and read every word page that moved.

      About two hours, and before **B3** for the same reason.

      **Six were found on 2026-10-02 without looking for them**, while the
      notes were being read, so "never been checked" is the right
      description and two hours may be low:

      | Row | The pack says | What was read |
      |---|---|---|
      | yes → `ita` | borrowed as "ita vero" | Latin, not English — **already removed**; see the ticked `vir` item |
      | always → `semper` | borrowed as "semper fidelis" | a Latin motto English quotes: no English section in Wiktionary, no etymonline entry. *sempiternal* is "from Latin sempiternus … from semper" |
      | truly → `vērē` | borrowed as *very* | etymonline: Old French *verai*, from Vulgar Latin *\*veracus*, from *verax*, from *verus* — the adjective, not this adverb. The row's own note says "descends from vērus", under a sentence saying it was borrowed from `vērē` |
      | hello → `salvē` | borrowed as *salvation* | etymonline: from *salvātiō*, from *salvāre*, "to save"; Lewis & Short derives *salvāre* from *salvus*, and `salvē`, the imperative of *salvēre*, from *salvus* too. Cousins |
      | farmer → `agricola` | borrowed as *agriculture* | *agricultura*, *ager* + *cultura*; `agricola` is *ager* + *colere*. Cousins |
      | door → `iānua` | borrowed as *January* | *Ianuarius*, "(the month) of Janus"; Lewis & Short derives `iānua` from *Janus* too. The row's own note says Janus gave January its name |

      The pack has 319 rows with an etymon and 313 word pages that print
      the sentence, one fewer of each than yesterday. Lewis & Short is one
      file now (see Notes, 2026-10-02), `/tmp/weft-la/ls.py` prints an entry
      by key, and `tools/seed/la-notes.tsv` already cites 23 etymonline
      entries for the notes — its token grammar is the one to reuse.

- [ ] **The landing page's descent table is a hand copy of eight pack
      claims, and nothing holds it to them.** Found 2026-10-02 when a
      corrected note had to be changed a second time, by hand, in
      `site/index.html`. The table repeats five Old English and three Latin
      rows — headword, English word, note — and the page cannot import, so
      each was typed. It has needed a hand edit twice in two days, *drēam →
      dream* when the pack stopped claiming it and "Jenner named it" when
      its note changed, and both were remembered rather than caught: no
      test reads the table, and `tests/tools/lexicon-orthography.test.ts`
      checks only how it spells. The guard is derivable. Every row's first
      word is a `tgtLemma` in a deep pack whose `etymonOf` is the row's
      English word — *mīlle passūs* and *paene īnsula* by their first word.
      Whether the fourth cell must equal the pack's note is the judgement: the
      table's "it meant simply “to die”" is the pack's "“steorfan” simply
      meant to die", reworded. All eight first words carry exactly the English
      word their row shows, checked against the packs on 2026-10-02. About
      20 minutes, in `tests/tools/build-site.test.ts`, which already reads
      the built page.

- [ ] **`dashboard.png` photographs the date, so it differs from its committed
      bytes on every day but the one it was taken.** In Notes since 2026-10-01
      as "not fixed"; queued 2026-10-02 because it cost this session a detour
      and will cost every later one that touches `src/`. The change-log row
      prints the calendar date of the run and the attention chart its last
      seven days (`src/ui/dashboard/index.tsx`, two `toLocaleDateString`
      calls). A plain regeneration on 2026-10-02 changed that one file of 36;
      run again with `TZ=America/Los_Angeles`, where it was still the 1st, all
      14 documentation shots matched their committed bytes. The fix is a held
      date in `tests/e2e/screenshots.spec.ts` and a line in
      `tests/tools/screenshots.test.ts` that fails if the spec stops holding
      it. Two things to know first. The change-log entry is stamped when the
      harness's import queues a change, which happens in the service worker
      rather than the dashboard page, so a clock held on the page alone may
      not reach it — check before relying on it. And the two dates are not the
      same day between midnight and 04:00: `dayKey` rolls over at four, so the
      chart read "Oct 1" beside a change log reading "Oct 2" — correct, and it
      looks like a bug. About 30 minutes.

- [ ] **The Old English pronunciation key quotes with straight marks, on 346
      word pages.** Found 2026-10-02 reading `/old-english/laece` after the
      slug fix. `META.ang.note` (`tools/build-site.mjs:82`) reads `þ and ð
      are both "th"; c before a front vowel is "ch"; sc is "sh"`, and
      `<p class="word__pronNote">` prints it on every Old English word page
      with a pronunciation — 346 of 350, the four phrases without IPA being
      the rest. It is the class PR #20 closed for the lexicon notes, which
      quote “ ” as the site's own prose does; the quote guard in
      `tests/tools/lexicon-orthography.test.ts` scans the packs and never
      sees the builder's strings. `META.la.note` has no quotes. The fix is
      three pairs of marks; the guard is a check in
      `tests/tools/build-site.test.ts` that no `word__pronNote` holds a
      straight `"`, which that file can read off the pages it already
      builds. Not the same decision as `/support`, `/privacy` and `/pricing`,
      which print straight quotes too, from `docs/SUPPORT.md`,
      `docs/PRIVACY.md` and the entitlement copy: those are documents a
      reader also opens on GitHub, where a Markdown smart-quote pass would
      change what they see there. About 10 minutes.

- [ ] **French `mort` is two words by Wiktionary's etymologies, and is one
      card.** Found 2026-10-02 by the homograph guard. `fr:mort` is death,
      the noun, from Latin *mors*, and dead, the adjective and the past
      participle of *mourir*, from *mortuus*; English Wiktionary gives the
      two separate etymologies, as it does `hund`. Unlike `hund`, nothing
      false is said: the one claim, "shares a root with English
      “mortal”", sits on the death row, is first, and is true of both. What
      is wrong is smaller — a reader who met *mort* only as "dead" sees
      "mort — death" in the vocabulary list, is asked "death" in the quiz,
      and shares a schedule with the noun. Two shapes: number the adjective
      `mort²` in `lex-fr.tsv`, which leaves the dead row with no claim of
      its own unless `fr-cousins.tsv` gains a cited one (*mortuary*, from
      *mortuarius*, from *mortuus*, is a candidate, unchecked); or keep one
      card and rewrite its `ONE_WORD` reason in
      `tests/tools/lexicon-homographs.test.ts` as the decision it then is.
      `tests/e2e/pages/showcase.html`, which the store listing art is shot
      from, contains "dead", so numbering may move a store screenshot:
      regenerate, read, and commit what moves. About 30 minutes.

- [ ] **Old English stress has never been checked against a source, and one
      word is stressed on the wrong syllable.** Found 2026-10-02 while the
      Latin pronunciations were fixed. Old English stresses the root's first
      syllable, so `old_english_ipa()` can only go wrong on an unstressed
      prefix it does not list. Measured over `lex-ang.tsv`: every prefixed
      verb is in `ANG_PREFIXED` (ābīdan, beginnan, forġietan, ġemunan,
      ondrǣdan), and the nominal prefixes (*un-*, *and-*, *on-*) take the
      stress, which is right. What is left is three adverbs built on *tō*:
      `tōdæġ` is /ˈtoːdæj/ where Wiktionary has /toːˈdæj/; `tōgædere` is
      /ˈtoːɣædere/ where Wiktionary has /ˈtoːˌɡæ.de.re/ — the stress right,
      but the *g* begins *gædere* and is a stop, as *be-ginnan*'s is; and
      `tōmorgen` has no Wiktionary entry at all. Read Campbell's *Old
      English Grammar* on the stress of particle compounds, or another
      grammar that states it, before choosing; then list the adverbs the way
      `ANG_PREFIXED` lists verbs, and hold the column with a test the way
      `tests/tools/latin-stress.test.ts` holds Latin's. While there:
      `andswaru` and `onsīen` voice their *s* to /z/ because it stands
      between voiced sounds, though it begins the second element. About an
      hour, and free before **B3**.

- [ ] **The lexicon teaches `far wel` as Old English for "goodbye", and it
      may not be Old English.** Found 2026-10-01 while checking its etymon.
      etymonline dates *farewell* to a Middle English phrase "attested by c.
      1200"; English Wiktionary derives it only "possibly" from Old English
      "*far wel!", with the asterisk that marks an unattested form. The
      etymon is gone, but `/old-english/far-wel` still presents the phrase as
      the Old English for goodbye. That is a question about the *target*,
      which nothing in the pass looked at, so it is a content decision: find
      a parting formula Bosworth–Toller attests, or mark the entry as a
      reconstruction. Ask the same of `iċ bidde` (please) and `mē is lāþ`
      (sorry), which are well-formed Old English but may be this lexicon's
      own phrasings rather than attested ones.

- [ ] **`camera` is taught as the Latin for "room", and Lewis & Short gives it
      as a vault.** Found 2026-10-02 reading the entry for its note: "a vault,
      an arched roof, an arch", and no room. The pack's attribution says
      "Latin glosses checked against Lewis & Short" and the seed's header says
      "Classical Latin"; the room is etymonline's "Late Latin camera 'a
      chamber, room'", which gave French *chambre*. The same question `far
      wel` asks, of the *target*. A crude first pass over all 356 rows — does
      the English lemma occur anywhere in the Lewis & Short entry for its
      headword — finds it in **328**. Of the other 28, five are verbs the
      script could not look up and most of the rest are a cross-reference stub
      (`serpēns`, "v. serpo") or a synonym (`magnus`, "great"); the ones worth
      a human eye are `camera`/room, `cānus`/grey ("white, hoary"),
      `fuscus`/brown ("dark, swarthy") and `audāx`/brave ("oftener in a bad
      sense"). The script is `/tmp/weft-la/glosscheck.py`. A content decision
      per row: a better headword (*conclāve*, *fortis*), or a note saying what
      the word really covers. `īnfāns` is also marked masculine where Lewis &
      Short has it of common gender.

`Now` is **empty** and `Next` holds **nine** unchecked items above, as of
2026-10-02, all agent-shaped and none waiting on B1. The order is the order
to work them. The feed's Latin frames first, which are overstatements in
it; then the Latin descent pass, the longest, which wants to land before
**B3** and has six known failures to start from; then the landing page's
table, the dashboard's date and the pronunciation key's quote marks, three
small guards; then French `mort`, one card or two, a decision with the
evidence written down; then Old English stress, one wrong word and a
grammar to read, also free before B3; then `far wel` and `camera`, content
questions. The Latin note on `vir`, the 22 Old English addresses, the thirty
Latin pronunciations, the feed's hidden etymologies and the Old English
homographs, which sat first, are done.
Everything in Blocked
needs Creagh — B1 an identity and a payment method, B2 onwards a decision that
is not reversible the way a commit is. A session picking this file up should
read the Blocked section and confirm B1 has not moved. Beyond the five items, the three gates `test:all`
leaves out were all re-measured on 2026-10-01 and the numbers are in the
state line at the top — so that particular piece of honest work is spent for
now. It was not idle: `site:check` was the one that found the slug collision,
and what found it was **counting**, not following links. The gate walks HTML
for `href`/`src` and never opens `sitemap.xml`, the file a crawler reads
first; and even checking that every `<loc>` resolves would have passed, since
a collision leaves every URL resolving. **713 declared against 711 written**
is the whole signal. If a future session wants the same class of finding
cheaply, compare what a generator says it produced against what it left on
disk, rather than asking whether the output is internally consistent.

**Four etymology calls a human may want to look at**, taken on 2026-10-01
without anyone to ask, each reversible in one line of
`tools/seed/fr-cousins.tsv` followed by `npm run cousins -- --force` and
`npm run packs`:

1. **The landing page's lead examples are weaker copy now, and true.**
   "cheval is the root of cavalry" became "shares a root with". If the
   stronger phrasing is wanted, the true ones checked this session are
   *pays* → *peasant*, *tête* → *testy*, *faible* → *feeble* and *foible*,
   *petit* → *petty*, *travailler* → *travel* and *entendre* → *intend* —
   English took each from that very French word. Changing the landing
   page, README and store listing to lead with them is a copy decision,
   and was not taken.
2. **Three descents were kept that etymonline traces to Old French "and
   directly from Latin"**: *person*, *music*, *story*. The file's own
   precedent, *famille*, was left out because English took *family* from
   Latin *alone*. Kept on the grounds that the Old French route is
   attested first in each; a stricter reading would demote all three to
   "shares a root with".
3. **`heavy` lost its note rather than gaining *lurid***, because English
   Wiktionary says "probably". French Wiktionary states it flatly, citing
   no hedge. If one dictionary's certainty is enough, the line is in the
   comment at the bottom of the file.
4. **Twelve French words gained a cousin note where they lost a false
   descent**, rather than going blank — so a reviewer reading the diff sees
   new claims, not only removed ones. Each was checked on both sides like
   every other line; *argent* → *argentine* is the thinnest of them.

**Four Latin calls a human may want to look at**, taken on 2026-10-02
without anyone to ask, each reversible in a line of `tools/seed/lex-la.tsv`
and the same line of `tools/seed/la-notes.tsv`, then `npm run packs`:

1. **The note under `vir` says something new rather than something
   smaller.** The smallest fix was "the plural “virī”…", which leaves a
   sentence saying the plural of *man* means *men*. It says instead what
   Lewis & Short says the word is, and names *homō*, which the pack does not
   teach. Old English's `mann` is "a human being of either sex": the two
   notes now make opposite points about the same English word, which is the
   interesting thing about it.
2. **`clāvis` lost its reason rather than gaining the other one.**
   etymonline's own account — the collarbone as the shoulder's fastener,
   after Greek *kleis* — sits behind a "supposedly", so the note gives
   neither reason and says only whose word it was.
3. **The landing page's vaccine row is weaker copy now, and true.** "Jenner
   named it after the cowpox he used" became "named after the cowpox Jenner
   used". If the agency is wanted back, what he did name was *variolae
   vaccinae*, cowpox, in 1798.
4. **`ita` has no descendant now, and `semper` still has "semper
   fidelis".** The first is not English anywhere. The second is a Latin
   motto English quotes, which the Latin frame's verb, "borrowed", arguably
   covers, so it is left for the descent pass, where it is in the table.

**Three Old English calls a human may want to look at**, taken on
2026-10-01 without anyone to ask, each reversible in a line:

1. **The landing page's Old English table shows *sellan → sell* where it
   showed *drēam → dream*,** and the descent hub's intro and
   `docs/PEDAGOGY.md` use *mete → meat*. Both are false friends the product
   already teaches, and etymonline supports each. *drēam* could have stayed
   with a note saying nobody has proved the descent, but a row under an
   arrow that means "became" which then denies it reads as a mistake.
2. **The line between a descent and not is drawn at inflection.** *shadow*
   (an oblique case of *sċeadu*), *numb* (the past participle of *niman*)
   and *former* (the comparative of *forma*) count; *gospel*, *bishopric*
   and *lychgate* (compounds) and *nimble* and *foremost* (derivatives) do
   not, and say so in their notes instead. A stricter reading would drop
   *numb* and *former* as well.
3. **Three of the new or renamed descendants are archaic**: *lich*,
   *thorp* and *swith*, beside the *whilom* and *welkin* already there. They
   are true, but a reader will not recognise them — and the selector's
   cognate floor treats any descendant as recognisable, so it will weave
   *līċ* early on the strength of a word few readers know. That is a
   question about the selector, not the lexicon, and is left alone.

**One decision a human may want to look at**, taken on 2026-10-01 without
anyone to ask: **the Chrome marquee now leads with four French words.** It
showed *rivière*, *hūs*, *cyning*, *vacca* — French, Old English, Old
English, Latin — and now shows *rivière*, *cheval*, *matin*, *forêt*, the
social card's four. The grounds are the ones `3060d93` gave for the card
when French was made to lead everywhere: Old English beside Latin "reads as a
tool for medievalists rather than as a way to learn a language someone is
actually planning to speak". But the listing also says "Latin and Old
English, which nobody else offers", and a marquee that showed them was
showing something no competitor's can. If the mixed set is wanted on the
marquee and not the card, `LEAD_PAIRS` in `tools/brand.ts` is the one list
both read; give `tools/make-store-tiles.mjs` a list of its own again, run
`npm run tiles`, and expect `tests/tools/brand.test.ts` to ask that each new
word is one a pack weaves. The old file is
`git show 9286f91:docs/store/tile-marquee-1400x560.png`, but do not restore
it as it stands: its mark is the superseded one.

**And one visible side effect of the same change:** the mark sits about 6%
smaller beside the wordmark on the tiles, the card and the site header. The
vector is now the 128px icon exactly, including the 16px of padding Chrome
asks for around a store icon, where the hand-written one had kept the older
10%. Chosen so that one geometry cannot drift from itself; read in every
regenerated image and it does not look wrong, but it is a change nobody
asked for.

**One deletion a human may want to look at**, recorded here because it is the
only thing this repository has removed that nobody asked for in person: five
committed PNGs under `docs/screens/` went on 2026-09-30, listed in the item
above with the commit that removed them. They were captures of the content
site, no generator wrote them, nothing referenced them, and three of the five
were displaying copy the product had deliberately changed. If any is wanted
back, `git show <sha>^:docs/screens/<name>.png > docs/screens/<name>.png` —
but the guard added alongside will then fail by name until either a generator
writes it or the pathspec says it is hand-made, which is the point.

One thing found and deliberately not queued, because it is a judgement about
the note corpus rather than a defect: **the descent hub's note column and the
tooltip are untouched by the above**, and should stay that way. Both give the
note its own box, which is the frame a lowercase fragment is written for. If
anyone is ever tempted to capitalise the notes in `tools/seed/*.tsv` to
"fix" them, `tests/tools/build-site.test.ts` no longer needs them capitalised
and the tooltip would get worse, not better.

## Blocked

Each of these needs Creagh: an identity, a payment method, or a decision that
is not reversible the way a commit is. Ordered by what blocks what.

**B0 — DONE 2026-09-29. Both steps. Nothing here blocks anything any more.**
*Kept because the conflict-resolution finding below recurs, and because step 3
is a standing prohibition rather than a task.*

**Step 2 landed 2026-09-29.** `npm run release -- --version=1.0.1` on a
branch, merged through a green PR. `VERSION` in `manifest.config.mjs` is
1.0.1, `package.json` is in step, `RELEASE-1.0.1.md` is written, six packages
built at 213/215 KB, and the whole gate plus `packs:verify` and `site:check`
re-run on the bumped tree. **The tag is not pushed and must not be** — that is
step 3, it fires `.github/workflows/release.yml`, and it belongs to B2.

Two documents went stale the moment the bump landed and were swept with it.
`docs/SUBMIT.md` named `weft-chrome-1.0.0.zip` in **five** places — the
runbook Creagh follows by hand, asking her to upload a file the tree no
longer contains. `CHANGELOG.md`'s 1.0.1 entry opened "Not cut yet". **A
version bump invalidates artefact *names*, which no test-count sweep looks
at**; `git grep '1\.0\.0'` over the documents and read each hit for whether
it means "the release that shipped in September" or "the file you are about
to upload".

**Step 1 landed 2026-09-28 as #22.** `main` is `e01ce27`, tree `028bdec8`. The nineteen commits that had accumulated on
`lexicon/proper-noun-notes` since 2026-09-27 — everything from `/privacy` and
`/support` through the curly-quote unification — are on `main` in one merge.
Only #1 had ever reached `main`; #2 through #21 merged into each other's heads,
so no commit on `main` carried any of it. `main` now does.

**The four conflicts were real, entirely squash artefact, and the resolution
was provable.** This is worth keeping, because the same shape will recur the
next time a stack's bottom PR is squash-merged. `main` held one squash commit
containing #1 *and* #2 — #2 went into #1's branch nine seconds before #1 went
to `main`, which is why `main`'s `CLAUDE.md` was *not* the first draft the
earlier text called it. The stack still carried their originals `ee277d2` and
`02fc7d8`, so the merge base was `3060d93`, behind both, and git reported
`add/add` on `CLAUDE.md` and `TODO.md` plus content conflicts in
`.github/workflows/site.yml` and `tools/build-site.mjs`.

The earlier instruction was to take the two documents from the stack side and
*read* the two code hunks. Right under uncertainty, but the uncertainty was
removable: **`git rev-parse origin/main^{tree}` returned `cbf3f4ae`, identical
to `02fc7d8`'s tree**, and `02fc7d8` is an ancestor of the stack. So `main`
contributed nothing to any path, the correct result was the stack's tree
exactly, and resolving all four to `--ours` and checking
`git write-tree` against `f4e4753`'s tree (`02c281a4`, equal) *proved* it
rather than arguing it. **The general form: before hand-resolving a conflicted
merge, compare tree SHAs — if one side's tree equals an ancestor of the other,
every conflict on it is artefact and the resolution is mechanical.**

Steps, all three now settled:

1. [x] **Cut 1.0.1.** Done 2026-09-29. `npm run release -- --version=1.0.1`
   refuses a dirty tree, runs the tests first, bumps `VERSION` in
   `manifest.config.mjs`, keeps `package.json` in step, rebuilds, packages all
   three targets and writes `RELEASE-1.0.1.md`. It stops before committing and
   only *prints* the `git tag` / `git push --tags` lines — it never runs them,
   which is what made this safe for a session to do unattended.
2. [x] **Re-run the whole gate on the bumped tree**, including the two
   `test:all` leaves out. Done; the figures are in the Journal entry in
   `CLAUDE.md`.
3. [ ] **Do not push the tag.** Standing prohibition, not a task. It fires
   `.github/workflows/release.yml`, which publishes outward. The tag push
   belongs to **B2**, which is where the repository also becomes public — a
   release whose download button 404s is worse than no release.

*Step 1 of B0 took ~40 minutes. Step 2 took ~35, most of it the gate, plus
the document sweep above that the release script does not do for you.
Numbered B0 rather than renumbering B1–B6, whose names are referenced from
Notes here and from the Journal in `CLAUDE.md`.*

**B1 — Register `weft.study`.** *Everything else waits on this.* `dig` returns
NXDOMAIN from both 8.8.8.8 and 1.1.1.1 while the `.study` TLD itself resolves,
so the domain is simply not registered. Three things are compiled into the
shipped extension or the store copy and point at it: `PRICING_URL` and
`SUPPORT_URL` in `src/core/pricing.ts:82,91`, and the privacy policy URL the
Chrome Web Store requires. *Unblocks: B2, B3, and the whole of B5.*
If a different domain is chosen instead, note that
`browser_specific_settings.gecko.id` is `weft@weft.study` and **must not
change** — it orphans every Firefox install — so the id will simply outlive
the domain name. Change `src/core/pricing.ts`, `WEFT_SITE_URL` in
`.github/workflows/site.yml` and the one URL in the r/latin draft at
`docs/LAUNCH.md` — added 2026-09-28, where an undefined Markdown reference had
been — and nothing else.

**B2 — Make the repository public, or set `WEFT_REPO`.** The install page's
download button points at `<repo>/releases/latest`
(`tools/build-site.mjs:613`), which 404s for everyone but the owner while the
repo is private. `gh repo edit quiquae/weft --visibility public`, or host the
zips elsewhere and set `WEFT_REPO`. Then push the `v1.0.1` tag so the release
workflow attaches the packages. *Needs: B1 decided, and B0 done — the tag
cannot be pushed before it exists.*

**B2a — regenerate `RELEASE-1.0.1.md` immediately before pushing the tag.**
*Detected automatically since 2026-09-29: `npm run artefacts:check` names this
one, with the commits that made it stale and the command that fixes it, so it
can no longer depend on somebody remembering it. It is still a human step,
because the regeneration has to happen on a clean `main` after the last merge.*
Found 2026-09-29, and it is structural rather than a one-off. `RELEASE-X.Y.Z.md`
is *generated*: it carries a `Changes since v1.0.0` list built from `git log`
and the six package sizes. B0 step 2 generated it on 2026-09-29 and **the
version was cut before the tag was pushed**, so every commit that lands on
`main` in between makes it staler, silently — the file is not derived at tag
time and nothing checks it. It is already one commit and ~1 KB of package
size out of date, from the export/import fix that landed the same day.

The fix cannot be done in the PR that causes it: the squash-merge hash does
not exist until after the merge, so regenerating inside the branch would
write a list that is wrong the moment it lands. So it belongs here, as the
step before `git push origin v1.0.1`: run `npm run release --
--version=1.0.1` on a clean `main`, confirm only `RELEASE-1.0.1.md` and the
gitignored zips moved, commit that through a PR, *then* tag. Same class as
the 1.0.1 session's finding that `docs/SUBMIT.md` named five zip filenames
that no longer existed — a version bump invalidates artefacts, and no count
sweep looks at artefacts.

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
   by measurement. **Run `npm run artefacts:check` first**: the fifteen shots
   are generated from `src/`, so an ordinary extension change makes them
   stale without changing them, and that has now happened twice. If it names
   them, run `npm run build:test && WEFT_STORE=1 npx playwright test
   store-assets` and commit what moves. Then: icon `assets/icon-128.png`
   (128×128); the five
   `docs/store/chrome-*.png` in numbered order (1280×800);
   `docs/store/tile-small-440x280.png` (440×280, required);
   `docs/store/tile-marquee-1400x560.png` (1400×560, optional but required to
   ever be featured). The icon and both tiles show one mark as of 2026-10-01
   — `npm test` reads it out of the pixels of all three and fails if they
   part company — and the marquee's four words changed the same day, so
   look at it once before it goes up (see "One decision a human may want to
   look at", above).
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

**2026-10-02 — the Old English homographs: three words were two each, and
the guard that holds them found a fourth in French.** Ticked in `Next`. Seven
things a later run would be sorry not to know:

1. **English Wiktionary titles an Old English page without macrons or
   overdots, and keeps the thorn.** `rīċe` and `sōþ` return 404 from
   `index.php?title=…&action=raw`; the entries are at `rice` and `soþ`, with
   the marked form only in the headword line. Read the `===Etymology N===`
   sections: two of them is the dictionary saying two words. The wikitext
   read this session is in `/tmp/weft-homo/wikt/`, which does not survive a
   reboot.
2. **Part of speech is a symptom, not the test.** Nine targets across the
   seven packs share a headword across parts of speech. Three are two words
   (numbered now), four are one word with one etymology (`sōþ`, `schnell`,
   `langsam`, `mañana`), and `mort` is two etymologies kept as one card —
   the item in `Next`. Do not "simplify" the guard into numbering every
   cross-part-of-speech target, or `entriesByTarget()` into a rule keyed on
   part of speech alone.
3. **Never number the first word.** `hund¹` would change the id of every
   `ang:hund` card a learner already has, and nothing migrates stored
   cards or exported files. The guard refuses a `¹`, and a number with no
   bare first.
4. **`node tools/build-pack.mjs --lang=ang` rewrites `index.json` with one
   language in it.** It writes the index from the packs it built. A probe
   that rebuilt one pack left a six-language hole in the index until it was
   copied back; build with `--all`, or restore the index after.
5. **A rename is proved by rewriting the old build, again.**
   `/tmp/weft-homo/rename-proof.mjs` rewrites the three old addresses in a
   build of `main` and compares: 698 of 718 files identical, and the 20 that
   are not were read line by line — every difference is one of the three
   new words. Build `main` from a `git worktree add --detach /tmp/… origin/main`
   rather than a stash; the worktree is outside iCloud and needs no
   `node_modules` for the site builder.
6. **`TZ=Pacific/Pago_Pago` held `dashboard.png`'s 1 October date at 07:50
   UTC on the 2nd.** Same window as the note below; it closes at 11:00 UTC.
7. **`tools/build-pack.mjs` now imports from `src/core/`**, as
   `build-site.mjs` and `verify-packs.mjs` do, so `npm run packs` needs a
   Node that strips types by default — 22.18 or later, which CI's `22` is.

**What was assumed, with nobody to ask.** That the design could be taken
without the approval the brainstorming process asks for, the run being
unattended, and is the one recorded in the ticked item; that the numbers
follow Wiktionary's order of etymologies, which is also the rows' order;
that the vocabulary list may show two rows reading "hund" told apart only by
their glosses, with no number on screen; that the hundred's note could be
reworded from "for it" to "for the number" as the same claim; that French
`mort` waits for its own decision rather than riding on an Old English item,
partly because numbering it may move the store art; and that no end-to-end
test was needed, the dashboard's code being unchanged but for one fallback.

**2026-10-02 — the feed's lookup: eleven hidden stories were two, and the
other nine were three different things.** Ticked in `Next`. Six things a
later run would be sorry not to know:

1. **Count rows, then classify each by what the feed would print.** The
   item's eleven were rows whose claim differs from the first row's; only
   the sentence the feed builds tells a hidden story from a duplicate one
   from a claim about another word. `/tmp/weft-feed/measure2.ts` runs the
   real `buildDiscoveries` over every row of every pack, and
   `/tmp/weft-feed/shared.ts` lists the 49 words with two glosses and their
   parts of speech. `/tmp` does not survive a reboot.
2. **A story travels between a word's rows; a gloss does not.** Probe P3
   took the storied row whole, which is the item's shape 1 read literally,
   and moved *fille* to *daughter* and *argent* to *money* in the
   vocabulary list and the quiz. `entriesByTarget()` copies the claim onto
   the first row instead. Do not simplify it back.
3. **The part-of-speech line is a proxy for "the same word"**, and it holds
   because all 49 shared words were read: every same-part-of-speech pair is
   one word with two glosses. A homograph sharing a part of speech would
   defeat it. The homograph item's first shape, a number in the seed, is
   what would make the line unnecessary.
4. **`TZ=Pacific/Pago_Pago` holds `dashboard.png`'s date until 11:00 UTC the
   day after it was taken.** `America/Los_Angeles` stopped working at 08:00
   BST. Run `TZ=… date` before the generator, not after. Queued in `Next`
   as a real fix.
5. **`perl -0pi` with a `\x{…}` in the replacement double-encodes the whole
   file**: it reads bytes, meets one wide character and writes everything
   out as UTF-8 again. `git diff --stat` showed +1017/−886 on a two-word
   edit. Reversed by decoding as UTF-8 and writing every code point at or
   below 0xFF back as one byte; then use the Edit tool, or `perl -CSD`.
6. **The source guard is a tripwire for the copy that was there, not a
   proof.** It catches `map.set(row.tgtLemma, …)`; a lookup keyed through
   a temporary variable would pass it.

**What was assumed, with nobody to ask.** That a claim belongs to the word,
so the feed may tell *argent*'s money-row note to a reader who met *argent*
as silver — the tooltip still shows only the woven row's claim; that the
vocabulary list and the quiz keep the first row's gloss rather than gain all
of a word's glosses, which would be more honest and would change what the
quiz asks; that the site reads through the same lookup although it changes
nothing there today; and that the homographs want their own item.

**2026-10-02 — the thirty Latin pronunciations: the census came from a
script that counted from the end of the word.** Ticked in `Next`. Six things
a later run would be sorry not to know:

1. **`fill_ipa.py` never overwrites, so regenerating means blanking the
   column — and blanking destroys any hand correction.** Prove first that
   every cell equals what the current generator writes (`python3 -B`, import
   `latin_ipa` from `tools/seed/`, compare row by row). On 2026-10-02 all
   356 did, so the whole column was blanked and refilled and the diff was
   the fix. If one ever differs, it is a hand correction: keep it.
2. **Compare syllable counts before stress positions.** The scratch script
   that sized this item compared stress counted from the end, and
   `caeruleus` — stressed on the first of three in the seed, the second of
   four by the rule — is "antepenult" both ways. The test checks the count
   first and judges stress only where the counts agree.
3. **The division rule is A&G §7 note 1's preference, for compounds too.**
   A group of consonants splits before its last, a stop and a liquid going
   with the next vowel together; §7b's separation of a compound's parts is
   not applied, which is Wiktionary's Classical practice (`respōnsum`
   [rɛsˈpõː.sũː]). The one word Wiktionary divides otherwise is `mōnstrō`,
   because it nasalises *n* before *s*. Add nasalisation to the generator and
   the onset of those words changes with it.
4. **The test refuses what it cannot read, and the table it reads from can
   only say "two vowels" or "consonant".** A new headword with *eu*, *ei*,
   *ui*, *su* before a vowel, or *z* fails by name until somebody reads
   Lewis & Short and respells it in `RESPELT`. A word whose *eu* really is
   a diphthong (*seu*) needs the test taught one more case, and the
   generator's `LA_EU_DIPHTHONG` already lists it.
5. **One branch of the weight rule has no data.** Probe P7 dropped the
   stop-before-liquid exception from the test's weight rule and nothing
   failed: no headword has a short penult before *pr*, *tr*, *cl* and the
   rest. `tenebrae` is in the generator's self-check so the branch is held
   somewhere.
6. **Playwright deletes `test-results/` and the iCloud attribute goes with
   it.** The first-run generator died with `Unknown system error -11 …
   .playwright-artifacts-0 2` after the store and documentation generators
   had passed. `rm -rf test-results && mkdir test-results && xattr -w
   'com.apple.fileprovider.ignore#P' 1 test-results`, then run it again;
   it passed in 11 s.

**What was assumed, with nobody to ask.** That A&G's preferred division
beats the convention it mentions, "any consonant group … that can begin a
word"; that a compound divides by the same rule, as Wiktionary does; that a
doubled consonant the mark falls inside is written out twice, `naːrˈraːrɛ`;
and that the Old English adverbs wait for their own item rather than riding
on a Latin one.

**2026-10-02 — the 22 Old English addresses: one call moved, and the proof
was a byte comparison of the whole site.** The queue named the `vir` note first;
PR #43 had landed it, so the topmost unchecked item was the slugs, now ticked
in `Next`. Five things a later run would be sorry not to know:

1. **Decompose before you spell, in any fold.** A letter precomposed with its
   mark is one code point (`ǣ` U+01E3, `ǽ` U+01FD), and a rule written for
   the bare letter cannot see it until `normalize('NFD')` has split it. That
   is the whole defect. The builder strips marks with the range
   U+0300–U+036F and the test with `\p{M}`; they agree on every mark the
   seven packs hold today — eight of them, all inside that range — and would
   part only on a mark from the extended blocks.
2. **A rename is checked by rewriting, not by reading the diff.** 113 files
   moved. `/tmp/weft-slug/verify.mjs` rewrites the 22 old addresses in a
   build of `main` and compares it byte for byte with the new build: 113 of
   113 identical, 282 occurrences, nothing else changed. Seconds to run, and
   it would have caught a template change riding along, which reading 113
   diffs would not. `/tmp/weft-slug/measure.mjs` counts the affected
   headwords per pack; neither survives a reboot.
3. **The test's spelling table mirrors all seven of the builder's letters,
   though the packs use three** (æ, þ, ð). ƿ, ȝ, ſ and œ are there so that a
   headword using one is spelled rather than refused — the refusal is for a
   letter the *builder* has no spelling for either, which it would turn into
   a hyphen. Add a letter to both or to neither.
4. **The straight quotes on `/support`, `/privacy` and `/pricing` are not the
   pronunciation key's problem.** The key is the builder's own string; those
   come from Markdown documents a reader also opens on GitHub and from the
   entitlement copy. The item in `Next` covers the key only, on purpose.
5. **A bare `cd` in a compound command moves the session's directory.** One
   loop ran `cd dist/site` without a subshell, and every later relative path
   resolved from there until it was noticed. Absolute paths, or `( cd … )`.
6. **Under `claude -p`, ending the turn ends the session, and kills whatever
   it left running.** The run that made this fix started `npm run test:all`
   in the background, ended its turn to wait for the notification, and was
   gone: the gate died halfway through e2e and every edit sat uncommitted
   until the next queued run found it by mtime and by the queue's log under
   `~/.claude-queue/log/`. That run re-verified and landed it. Commit before
   starting anything long, and wait on it in the foreground or under a
   monitor. A run that finds an uncommitted tree on a branch should read
   `~/.claude-queue/done/` for the job that left it before deciding whether
   the work is finished or abandoned.

**What was assumed, with nobody to ask.** That the addresses need no
redirects, because nothing is published before **B3**; that a `CHANGELOG.md`
paragraph is not wanted, following PR #36, the other fix that moved word-page
addresses, which added none — the site is not part of the 1.0.1 package; and
that the key's quote marks wait for their own item rather than riding on
this one.

**2026-10-02 — the queue's item was one PR stale, and the five-minute item
under it was five notes, an etymon and a ledger.** The queue sent this
session at the Old English etymons, which PR #42 landed on 2026-10-01; the
topmost unchecked item was the Latin note on `vir`, now ticked in `Next`.
Eight things a later run would be sorry not to know:

1. **Lewis & Short is one file.** `curl -sL` the Perseus text from
   `raw.githubusercontent.com/PerseusDL/lexica/master/CTS_XML_TEI/perseus/pdllex/lat/ls/lat.ls.perseus-eng2.xml`
   — 77 MB, no rate limit — and every entry is an `<entryFree key="…">`.
   Keys drop macrons, write consonantal *i* as *j* (`janua`) and number
   homographs (`os1` mouth, `os2` bone). An adverb or an imperative is often
   a one-line stub pointing at its headword (`vere` → `verus`, `salve2` →
   `salveo`), so read both. Allen & Greenough is on Perseus by section,
   `…/hopper/text?doc=Perseus:text:1999.04.0001:smythp=42`; the Dickinson
   edition's section addresses could not be guessed. `/tmp/weft-la/ls.py`
   prints an entry by key and `/tmp/weft-la/ls/` holds the 40-odd read.
2. **etymonline heads a proper noun without a part of speech**, so the
   fetcher's `word (n.)` pattern finds nothing on `/word/Argentina` or
   `/word/Janus` and writes the page's navigation into the cache instead of
   failing. Cut the raw page at "Origin and history of". The addresses are
   not case-sensitive.
3. **A note's wording picks the feed's sentence, so run the feed over every
   note, not only the new ones.** "means" and "meant" make a false friend,
   and that frame opens "X became English Y, but" — which is how a bad
   etymon (`ita vero`) and a bad note (`vir`) both surfaced as one line of
   nonsense. `/tmp/weft-la/feed.ts` runs the real module over a pack.
4. **A second reader told to prove the first one wrong changed three verdicts
   in sixteen minutes** — one of them the first reader's own rewrite. It was
   given the note list and the extracts on disk, forbidden
   the network and its own memory, and asked for a quotation per verdict.
   Cheap, and the only check here that is not the author rereading.
5. **A stamp wants the date held, not a pixel diff.** `dashboard.png` came
   back different because it was after midnight. `TZ=America/Los_Angeles
   WEFT_SCREENS=1 npx playwright test screenshots` put the clock back in the
   day the file was taken and all 14 matched their committed bytes — which
   shows the code draws the same picture, where a diff confined to two rows
   only suggests it. Queued in `Next` as a real fix.
6. **`test-results/` loses its iCloud attribute every time Playwright
   deletes it.** The second generator run died on `Unknown system error -11
   … scandir 'test-results/.playwright-artifacts-0'` straight after the
   first had passed. `rm -rf test-results && mkdir test-results && xattr -w
   'com.apple.fileprovider.ignore#P' 1 test-results` before *each* run.
7. **Four shell slips, all zsh.** `$PIPESTATUS` is empty — zsh spells it
   `$pipestatus` — so `npm … | tail; echo ${PIPESTATUS[0]}` printed nothing
   and looked like success; redirect to a file and read `$?`. An unquoted
   `--include=*.ts` is a glob zsh refuses ("no matches found") before grep
   runs. `process.argv[2] ?? fallback` keeps an empty string; `||` is the
   one that falls through. And a foreground `sleep` is refused by the
   harness, so a wait has to be work.
8. **The first verdict on `vacca` was too kind, and the standard was written
   down after it.** It was left as "supported in substance", and rewritten
   once the standard had been written — for the second reader's instructions,
   then the ledger's header: a source that contradicts a note, hedges what it
   states flatly, or says less than it does. Write the rule first, then read.

**2026-10-01 — the Old English etymons: the sample said six to ten more
false, and the file held twenty-seven.** The item is ticked in `Next`. Six
things a later run would be sorry not to know:

1. **Where the reading is, and that it will not last.** `/tmp/weft-etym/cache/etym`
   holds 560 etymonline entries as plain text, one file per English word;
   `enwikt-english/` and `enwikt-old-english/` hold the 24 Wiktionary
   sections read. The fetchers are `/tmp/weft-ang/fetch.py` and `wikt.py`,
   and `/tmp/weft-ang/decisions.md` is the row-by-row reading. `/tmp` does
   not survive a reboot. The durable record is `tools/seed/ang-etymons.tsv`,
   which names every entry read.
2. **Three etymonline traps beyond the two the French pass found.** British
   spellings have no entry of their own — `/word/neighbour` and `/word/grey`
   carry navigation only, and the entries are under *neighbor* and *gray*.
   Some pages (*wassail*) come back without their text even with
   `?ref=etymonline_crossreference`; the text is in the page's embedded
   payload, so search the HTML *before* stripping `<script>`. And a header
   regex is fooled by cross-references — "fly (v.1)." appears inside the
   noun's entry — so read the line that says "Old English", not the first
   line that looks like a header.
3. **Why the sample was low.** Three in 80 was measured on the entries the
   French pass happened to have cached, which are English words a *French*
   claim also named — a sample of one shape. And it only asked whether the
   English word came from elsewhere. Asking what "became" and "comes
   straight from" can survive found the second shape, eleven compounds and
   derivatives, which no sample in the first frame could contain.
4. **A note's wording sets the feed's kind.** `src/core/discoveries.ts`
   classifies by regex: a note with "literally" makes the line a literal
   gloss, one with "meant" or "not a" makes it a false friend, and either
   outranks the etymon. So rewriting a note can move a word between kinds;
   read the feed sentence it now produces, not only the word page.
5. **`grep -m1 x f >> f` writes nothing, silently.** This machine's grep
   is ugrep, which refuses to append to its own input file, so a probe built
   that way changes nothing and the guard "passes". Write to a temp file and
   append that. Caught because the probe that should have fired did not, and
   the message was read before it was believed.
6. **704 sitemap entries are dated today**, because `en-ang.json`'s
   `builtAt` moved and every Latin and Old English word page takes the
   newer of the two deep packs. The coarseness this file already records,
   not a new defect; nothing is indexed before **B3**.

**What was assumed, with nobody to ask.** That an inflected form of the
word is a descent and a compound is not (see "Three Old English calls"
above); that "partly from" drops a claim, by the French rule; that step 4
wanted a sidecar ledger rather than French's split-and-merge, because Old
English etymology was always authored in the seed; that the landing page
should swap *drēam* for another true false friend rather than keep a row
that denies its own arrow; and that `far wel`'s *target*, not only its
etymon, is a question for later.

**2026-10-01 — the queued CI step would have failed on a correct tree, and
the test that replaced it cannot.** The queue sent this session at the icon
check in its 2026-09-30 wording, `npm run icons && git diff --exit-code` in
CI. That wording was measured false earlier the same day and the item
rewritten; this session measured it again, then built the rewrite. Four
things a later run would be sorry not to know:

1. **An official Node 22 is already on this machine**, in npx's cache of
   the `node` package:
   `~/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node`, v22.23.3,
   zlib `1.3.1-e00f703`. Homebrew's Node 26.7
   links zlib 1.2.12, and CI installs official builds, so anything claimed
   to be reproducible across machines can be checked against both in a
   minute. To repeat the icon measurement, copy `tools/make-icons.mjs` and
   `tools/brand.ts` into a scratch `tools/` and create `site/` beside it:
   without that directory the copy writes all four PNGs and then exits 1
   on the SVG.
2. **A pixel-neutral edit to `tools/brand.ts` stales three artefact groups
   at once** — the icons, the store tiles and the social card all declare
   it. Clear them in the same PR: regenerate, compare against `HEAD`'s
   blobs (`git hash-object <file>` against `git rev-parse HEAD:<file>`),
   open the images, then `npm run artefacts:verify -- "<name>"` for each.
   The squash merge puts the input change and the stamps in one commit,
   and `checkArtefacts` reads that as fresh.
3. **`\b` does not work in `git grep -E` here.** The first count sweep used
   `'\b778\b|…|33 suites'` and returned only the `33 suites` lines, missing
   four of the six live counts, including `docs/LAUNCH.md:221`. Plain
   patterns found all six. A sweep that comes back short is a broken
   pattern before it is a clean tree.
4. **zsh does not split an unquoted `$VAR`.** `FILES="a b"; md5 $FILES`
   passes one argument, so a before-hash written that way records nothing
   while the generator after it still runs. Use an array or `${=FILES}`.

**2026-10-01 — the queue's item was four PRs stale, and the item under it
was twenty-nine claims rather than eighteen.** The queue sent this session at
`docs/firstrun/icons.png`, which PR #37 fixed on 2026-09-30; the topmost
unchecked item was the French etymologies, now ticked above. Six things a
later run would be sorry not to know:

1. **How to read a dictionary from this machine, and what does not work.**
   etymonline serves HTML to `curl`, but some entries (`march`, `argentine`)
   come back as an unrendered React payload unless the URL ends
   `?ref=etymonline_crossreference`. It has no page for an inflection
   (*marching*) and files most phrases under a headword (*treasure trove* is
   at `/word/trove`). CNRTL, the TLFi, is a JavaScript app now and returns an
   empty shell; French Wiktionary cites the TLFi and is the readable
   substitute. Wikimedia throttles an anonymous client to about one request
   per three seconds (`retry-after: 3`), and two clients at once made both
   fail. Some English Wiktionary entries build their etymology at render
   time from `{{etymon|…|text=++}}`, so the raw wikitext stops at Middle
   French; `action=parse&prop=text` returns the rendered tree. And keep the
   User-Agent free of personal detail: this session sent the account's email
   in one, once, by reflex from Wikimedia's contact-info policy, and should
   not have.
2. **A translation is not an ancestor, and the risk is wherever the etymon
   equals the lemma.** All twelve false French descents were rows whose
   descent named the row's own English word. Old English has 242 such rows,
   and three of the 80 checked fail — the first item in `Next`.
3. **"the root of" against "shares a root with" is the descent/cousin line
   again, one column over.** Nine notes had it backwards, the landing page's
   lead example among them, in the paragraph explaining the distinction. Of
   any "the root of English X", ask whether English took X from this French
   word or straight from Latin.
4. **A guard can pass because the old code refused everything.** The sixth
   new test — bad source tokens are refused — passed against a parser that
   refused every four-field line, good ones included. A control (the same
   claim, cited properly, is accepted) turned it red for the right reason.
5. **`dashboard.png` carries its capture date**, twice: the attention
   chart's axis and the change-log row. Committed, they read "Sep 23 … Sep
   29"; regenerated today, "Sep 25 … Oct 1". So the 2026-09-29 finding that
   no date was involved held for two runs on one day, not across days, and
   this shot will differ from its committed bytes every day after it is
   taken whatever the code does. A pixel diff put every difference in those
   two rows and the six reworded feed lines. Not fixed: a seeded clock in
   `tests/e2e/screenshots.spec.ts` would be the fix.
6. **`until ! pgrep -f 'fetch.py'` never exits**, because the loop's own
   command line contains `fetch.py`. Three such waits hung before that was
   noticed. Wait on a file the job writes last instead, or match the
   interpreter's path.

**2026-10-01 — every generator reproduced its output exactly, and the output
was nine days stale.** The item was the four "hand-made" assets, to be opened
and read. All four turned out to have generators already, all four
reproduced byte for byte, and three of the four showed the mark the icon had
replaced on 2026-09-22 — as did the social card, the favicon and the header
of every site page. Fixed by drawing the mark in one place,
`tools/brand.ts`; see the last ticked item in `Next`. Seven things a later
run would be sorry not to know:

1. **Provenance cannot see a copy.** `artefacts:check` called the tiles
   fresh, correctly by its own terms: their group named the generator as its
   only input and the generator had not moved. The mark inside it had, in
   another file. A fact pasted into a generator is an input no pathspec
   declares — so "regenerated, byte-identical" is evidence that a generator
   is deterministic and nothing more. Before trusting it, ask what the
   generator has typed into it that lives somewhere else too.

2. **Find copies by grepping for a value, not a name.** Nothing called the
   five hand-written marks by a shared name. `git grep '76\.3'` — one
   coordinate of the old weft — found all seven files in one command. The
   same works for a colour (`#2f4b7c`, five places, all agreeing) or a word.

3. **A recorded reading answers only the questions it asked.** PR #36 opened
   these same tiles and wrote that it had read them: no density number, word
   pairs all in the packs. Both true. The mark was not on its list. When a
   previous session says it read an image, find the sentence that says what
   it read it *for*.

4. **Two copies agreeing is evidence about the copies.** PR #37 found
   `site/icon.svg` byte-identical to `assets/icon.svg` and recorded that as
   the reason it was "not yet a lie". Both had been wrong for eight days,
   together.

5. **How to redraw the mark, now that there is one.** Edit `GEOMETRY` or
   `CROSSING` in `tools/brand.ts`, then `npm run icons`, `icons:sheet`,
   `tiles` and `og`, in that order — the sheet reads the rasters. Then paste
   the header markup into `site/index.html`, which is hand-written and the
   one place it cannot be imported:
   `node --experimental-strip-types -e "import('./tools/brand.ts').then(b => console.log(b.markSvg({ warp: 'currentColor', weft: 'currentColor', warpOpacity: 0.45 })))"`.
   `tests/tools/build-site.test.ts` names `/index.html` until that is done.
   Open every regenerated image. The tile generator refuses to write if
   anything runs off a frame, and writes none of the three in that case.

6. **Reading a mark out of pixels works, and here is what it rests on.**
   `tests/tools/mark-reading.ts` locates the mark by its warp colour, counts
   threads in the band above the weft, and reads the weft along the middle
   row between the mark's own edges. It needs the warp colour to appear
   nowhere else in the image, which was checked for the tiles and the card:
   no blend of the blue type, the ink or the grey with the paper comes within
   the tolerance on all three channels. It cannot read
   `docs/firstrun/icons.png`, which holds sixteen marks, and is not asked to.
   A null reading is a failure and not a skip — art in a superseded palette
   reads as "no mark".

7. **`make-icons.mjs` is not byte-reproducible across machines**, whatever
   this file said on 2026-09-30. Same pixels, but `icon-128.png` is 431
   bytes under this machine's Node (zlib 1.2.12) and 432 under an official
   Node 22 build. Do not add a CI step that rebuilds and diffs it. The
   item in `Next` was rewritten around that, and is now done: the icons are
   held to the geometry by a test that decodes them.

**What was assumed.** That the redraw's rule — the weft reaches every thread
but the last — covers the vector as well as the rasters, on the commit's own
wording and its account of the fault. That the vector should be the 128px
icon's geometry exactly, padding included, rather than keep the hand-written
one's proportions. That "French leads everywhere now" includes the Chrome
marquee. And that each surface's *paint* was a choice to leave alone: opaque
on the tiles and the card, the text colour at 45% on the site, 85% on the
icon.

**Found and left, each measured.** The woad `#2f4b7c` is typed in five
places — `site/weft.css`, `src/ui/theme.css`, both art generators and
`tools/brand.ts` — and all five agree, so it is not a defect; it is the next
copy that could drift. `tools/build-site.mjs:1368` prints `-> dist/site`
even when run with `--out`, which is only ever seen in a test's piped output.
And there are iCloud conflict copies outside the three directories that carry
the xattr: `.git/index 2`, and two gitignored `weft-*-1.0.0* 2.zip` at the
repository root. None is tracked, none affects a build, and none was touched.

**And the favicon has the fault `0d9910e` fixed for the toolbar, at 1×.**
`site/icon.svg` is the 128px geometry, four threads, and a browser rasterises
it at the tab's 16 device pixels: rendered that way in Chromium, it comes out
as four half-covered 2px threads with a grey halo round the weft, beside
`assets/icon-16.png`'s two crisp ones. Pre-existing — the old SVG had four
threads too — and fine at 2×, where it is 32 pixels. Not fixed here because
the site is unpublished (B3) and the remedy is a decision about favicon
selection rather than a geometry edit: copy the 16 and 32px rasters into
`site/` from `make-icons.mjs`, as it already does for `icon.svg`, and link
them with `sizes` beside the SVG. About 20 minutes plus reading it in a tab.

**One process error, caught by re-reading and worth keeping.** Three comments
in the first draft said the mark had "six" hand copies and that
`artefacts:check` had called the tiles fresh "for nine days". Seven files
held the old coordinates and five were written by hand; and the tiles have
only had an artefact group since 2026-09-30, so for eight of those nine days
they were in no group at all. Corrected before the commit. Count from the
command's output, not from the sentence written about it a minute earlier.

**2026-09-30 — the guard proves two files agree; it cannot prove either is
true.** The item was `merge-cousins.mjs`, which could not report a corrected
claim, a deleted one, or a malformed line. That is fixed and guarded (see the
ticked item in `Next`). Three things a later run would be sorry not to know:

1. **When a report counts two outcomes as one, no exit code can separate
   them.** The old tool's "left alone (already had a value)" held both "in
   step" and "disagrees", so the `--dry` exit code the item proposed as
   shape 2 would have exited 0 on a correction too. Fix the counting first;
   the exit code falls out of it.

2. **The fixed-point test passes on eighteen false etymologies**, because
   `fr-cousins.tsv` and `lex-fr.tsv` agree on every one of them. A
   consistency guard is necessary and says nothing about truth. What found
   the falsehoods was reading the file whole against a source, which no
   check in this repository does. Most of them share one cause worth knowing
   before any other language gets a cousins file: claims are keyed by
   **English** lemma, so a descent pairs an English word with its
   *translation* and asserts the translation is its ancestor. Check each
   descent against the English word's own etymology, not the French one's.

3. **To test a CLI without a test-only flag, copy it.** The CLI test copies
   `merge-cousins.mjs` and `cousins.ts` into a temp directory beside two
   fixture files, so the tool's own `ROOT` resolves there and no run can
   reach the tracked lexicon, even the red runs against the old tool,
   which ignores flags. It needed no `--lex=` seam in shipped tooling. If
   the tool ever imports a third module, the copy fails loudly with a
   missing module rather than quietly.

**2026-09-30 — the predicate was hand-drawn around the directory somebody
remembered, and that is the sixth sighting in six sessions.** The item was
`docs/firstrun/icons.png`, whose lower half had been blank for eight days
behind a label promising a magnified comparison. Fixed by writing the
generator the item offered as shape 2. What the item could not know is that
the same blind-spot shape was one level up, in the guard PR #36 had built the
session before to catch exactly this class.

Four things a later run would be sorry not to know:

1. **A fragment's position is a diagnosis.** The old sheet's only ink below
   the hole sat at x 933–1029, far right — which says the row was laid out at
   a literal 8× (16/32/48/128 → 128/256/384/**1024**, needing 1792px in a
   1180px frame) and overflowed sideways before being clipped from below. The
   item had called it a framing defect. Framing alone would not have fixed
   it. Decoding the PNG and counting ink per row took four minutes and there
   is now a decoder in `tests/tools/icon-sheet.test.ts` to reuse.

2. **Nearest neighbour is only truthful at a whole-number factor.** The cell
   is 384px because that is the least common multiple of 16/32/48/128, so the
   factors are 24×, 12×, 8× and 3×. At 5.33× some source columns duplicate
   five times and others six, so a thread of uniform width acquires a stagger
   and the sheet reports a defect the icon does not have. Do not round the
   cell to 400 to make it look tidier; a test fails and names the factor.

3. **The sheet must load the shipped rasters, never `assets/icon.svg`.** The
   SVG carries four warp threads at every size; the 16px raster carries two
   and the 32px three, because an antialiased 1.4px thread dissolved in the
   toolbar (`0d9910e`). A sheet scaled from the SVG would look plausible and
   would misreport the single thing the sheet exists to show.

4. **`site/icon.svg` was a hand-made copy of a generated string.**
   Byte-identical to `assets/icon.svg` when found, which is the only reason
   it was not yet wrong — editing the mark would have updated the extension
   and the store listing and left the landing page on the old one, with
   `git status` clean. `make-icons.mjs` writes both now. Regenerating moved
   zero bytes.

**The transferable half, and it is about guards rather than icons.** Every
generator-coverage test in `tests/tools/artefacts.test.ts` had started from
something hand-drawn, and each was wrong in turn: a table of three specs that
could not see a fifth generator (PR #35), then a predicate scoped to `docs/`
that could not see `assets/` (found here), and underneath both a `const OUT`
convention that `tools/make-og.mjs` does not follow at all, so `site/og.png`
was unreachable by any directory predicate however written. Three fixes to
one derivation in three sessions, each making it cleverer and leaving it a
derivation. The version that settles it asks from the other end —
`every committed image is inside an artefact pathspec`, enumerated from
`git ls-files`, with a floor at 40 so it cannot pass on an empty set. There
is no list to forget to extend. **Measured gap is now zero: 47 committed
images, 47 declared, and the exception list is empty on purpose.**

**One defect the fix introduced and the floor caught, worth knowing before
touching any of these derivations: in JavaScript `.` does not match a newline
but a negated character class does.** Unifying the two halves of the
generator derivation on one predicate put `[^']*` in the spec half, and it
ran past the end of the `const OUT` line to the next quote anywhere later in
the file — `docs/firstrun` came back as `");\n\ntest.describe("`. The
symptom was `only 3 generators were derived`, which reads as "there are no
generators" rather than "the pattern is broken". Both regexes now exclude
newlines and the spec one is lazy. **A floor that prints a count is how a
broken pattern announces itself as broken** rather than as an empty world.

**And the same class landed on this session's own guard, which is worth
knowing before editing the threshold.** `MAX_BLANK` was first written as 60
with a comment saying the sheet's real gaps measured 10 to 21 rows — true of
the **old** layout, false of the new one, whose widest legitimate gap is
**42** rows. It is now 90, and the honest window is (42, 134): above the
widest real gap, below the historical hole, so the test still fires on
`3ef9d63:docs/firstrun/icons.png`. **Re-measure both bounds if the layout
changes**, rather than trusting the comment; that is precisely the number
that went quietly wrong here.

**Process notes, both of which nearly produced a false result.** A `sed` probe
that mangled a regex literal made the whole test file fail to parse, and
`pass 0 / fail 1` reads at a glance exactly like the guard firing — it was a
syntax error. Read a probe's actual message, not its exit status; the same
rule this file already records for generators, in both directions. And probe
G caught a mislabelled assertion of my own making: the floor fired with
`declares an OUT under docs/ but names no image` *after* the predicate had
been widened past `docs/`, so the message described the world before the
change. Fixed, and worth naming because this repository's own rule is that a
mislabelled failure message is the fingerprint of the overlooked case.

**What was deliberately not done.** Shape 1 (redraw) needs whatever drew the
sheet, which is not in the repository. Shape 3 (delete) was refused for the
reason the item recorded — the top half was correct and somebody updated it
deliberately — and is now moot. The converse guard was **kept** rather than
replaced by the inverted one: it answers a different question, whether a file
*inside* a pathspec is one its generator actually writes, which is the
`07-help.png` and `landing.png` class. `tools/check-links.mjs` and
`tools/build-pack.mjs` are correctly excluded from it by a derived filter
rather than by name — they declare an `OUT` and write no committed image, one
into gitignored `dist/site` and one into JSON that CI already rebuilds and
diffs.

**2026-09-30 — the gate's own doc comment named the failure, and the gate
could not see it.** `tools/check-links.mjs` opens with "Seven hundred pages
cross-link each other by slug, and a slug is derived from a word with
diacritics stripped. **One collision** or one stale reference and a reader
hits a 404." The threat model was written down correctly and the check built
from it was the wrong check, because **a collision does not produce a 404 —
it produces the opposite.** The second page written overwrites the first and
is a perfectly valid file, so every link to either still resolves. That is
how `site:check` reported 16 087 links all resolving, for a month, while two
Latin words had no page.

What found it was arithmetic: the builder declared **713** sitemap URLs and
wrote **711** HTML files. Reuse that method rather than this instance — *what
a generator says it produced against what it left on disk*. Note too that the
existing sitemap test could not have found it either: `lastmods()` returns a
`Map` keyed by URL, so it silently deduplicated the two duplicates, and its
floor assertion is `dates.size > 700`.

**The fix moved where the slug is decided, and that is the point rather than
a detail.** `slugify(word)` is handed one word, so it cannot see a collision
however carefully it is written — uniqueness is a property of the *set*, and
the set is known only in `main()`. So `assignSlugs(entries)` runs once per
language over the completed entry list and writes `e.slug`, and the six call
sites read it. `slugify` is now called from one place.

**Every member of a collision takes a suffix; none keeps the bare slug.**
`/latin/os-mouth`, `/latin/os-bone`, `/latin/liber-book`, `/latin/liber-free`.
Two reasons, and the first is a defect this project has already paid for
twice: whichever member kept the bare slug would be decided by pack order,
which is `buildDiscoveries` before `06cd2e9` and the vocabulary list before
`sortVocabulary`. The second is that a bare `/latin/os` is a claim to be the
only `os`, and that is the thing which is not true.

**Two recorded decisions were checked rather than assumed, and both hold.**
The Notes entry below says "**The URL slugs stay ASCII, and must**" and warns
that changing an address after **B3** would strand indexed URLs — `os-mouth`
is ASCII, and B3 has not happened, so this is exactly the moment the change
is free. Nothing in the tree hardcoded either old URL; `git grep` was run
before anything moved.

**Verified by rendering and reading, not by the test passing.** All four
pages open on the right word, and `/latin/os-bone` now carries its own note
— "distinct from “ōs”, mouth, only by vowel length" — on the page that note
was written for, instead of on the page that *was* the `ōs` page. Both hub
tables now print four distinct links. `site:check` re-run: **713 pages, 16 129
links**, exit 0.

**One gate was deliberately not widened.** `check-links.mjs` gained nothing.
The new guard is in `tests/tools/build-site.test.ts`, which CI runs on the
same push, and the reason is a decision already in this file: a gate whose
failure means two different things gets ignored — the argument that kept the
sitemap-date check out of `check-links.mjs`. `check-links.mjs` also has no
test harness at all, so widening it would have been untested production code.

**2026-09-29 — the queued item described half the cases, and the other half
was wrong in the opposite direction.** It named two clipped listing shots and
one mechanism: `scrollIntoViewIfNeeded` scrolls minimally, so the row above
the target bleeds in. Both halves held for the two files it named, and both
were incomplete. Opening the other four found `chrome-05-settings.png` with
its target row's heading sliced through and `edge-05-settings.png` with the
heading gone, the shot opening mid-sentence. Four of six, erring both ways.

Three things worth keeping.

**The mechanism is "no stated alignment", not "minimal scroll".** Blink picks
an alignment from the element's position and the viewport height, so the same
call landed differently in 800, 768 and 900 pixels — and the direction of the
error is not a property of the call. **A fix derived only from the cases
somebody happened to open would have been one-sided, and a guard asserting
only "nothing above the target is in shot" passes `edge-05`, the worst of the
four.** Hence the two-sided assertion, and hence a tools test that asserts it
is two-sided. Same class as the mislabelled `oe.close()` guard from PR #31,
one step earlier: the census, not the fix, is where the omission lives.

**`artefacts:check` said `ok` about all of this, and was right to.** These
files were byte-stable, byte-identical to what was committed, and carried a
verify stamp. The group's whole question is provenance, and provenance was
sound; the defect was composition. **Byte-equality and freshness together
still do not add up to "the image is any good" — only opening it does.**
That is now three sessions running where reading the art found what no check
could.

**One measured side effect.** Aligning scene 4 on the discoveries feed
scrolls the progress tiles out of every frame, so `SEEDED_ATTENTION_SECONDS`
— the constant added to stop the shot photographing the clock — no longer
affects a committed byte. Proved by generating at 60s instead of 1800s and
finding all fifteen hashes unmoved, not by reasoning about the crop. Kept
rather than deleted, with both the spec and its guard file saying plainly
that it is insurance now: the drift comes straight back if anyone reframes
the scene to show the tiles, and that reframing is a reasonable thing to
want, since the four tiles are the only place scene 4 shows a number.

**2026-09-29 — a hand-written guard cannot police the case it forgot, and its
own error message said so.** The queued item blamed the onboarding page's
live preview for seven cards nobody asked for. The preview cannot write a
card: `preview.tsx` sends nothing, and the page's only two messages are a
`fetch` and a button handler the screenshot loop never triggers. The cause
was `wrapped`, the third taxed page in `screenshots.spec.ts`, opened for
`page-tooltip.png` and never closed.

Three things worth keeping. **First, the evidence was already in the file:**
a comment forty lines above the wrong one lists six words read off
`article.html`, and six of the seven residuals are exactly those six. When
two comments in one file disagree about a cause, the one that names a
mechanism beats the one that names a culprit. **Second, the guard's failure
message is where to look when a guard misses something:**
`assert.notEqual(spec.indexOf('oe.close()'), -1, 'the wrapped-mode page is
never closed')` — `oe` is the Old English page, and the wrapped-mode page is
the variable named `wrapped`. The mislabel is the fingerprint of the page
being overlooked when the guard was written, and it sat in the suite for a
commit. **Third, the fix is the derivation, not the close.** Naming the
pages is what failed; the guard now finds every
`const X = await context.newPage()` whose block holds
``await X.goto(`${origin}`` and requires it closed before `reset-vocabulary`,
with a second test cross-counting the `${origin}` navigations so a renamed
`newPage()` cannot leave the loop running over an empty list. Same move as
deriving proper nouns from capitalisation rather than curating a list.

Do not "simplify" the derived guard back to naming the three pages. That is
the state it was already in when it missed one.

**`docs/screens/` is regenerated and the arithmetic is the receipt.** Six
shots changed, all six opened. The progress tiles read 19 words met and
**393** read, and 393 is exactly the sum of the seeded plan's `exposures`
column — so the store is the plan and nothing else. All 19 files
byte-identical across two consecutive runs, npm's exit status captured per
run, mtimes checked (a generator that dies early writes nothing, and that
looks identical to a clean idempotent run from outside). No verify stamp was
written, deliberately: this group earned a real content change, so a stamp
meaning "checked, nothing to commit" would be false.

**2026-09-29 — both groups reproduced exactly, and the defect was in the file
neither run touched.** `store listing screenshots` and `first-run walkthrough
shots` were each regenerated twice, hashed rather than eyeballed, and every
generated file came back byte-identical to what was committed. The mtimes
were checked on every run, because a generator that dies early writes nothing
and "no file changed" looks identical to a clean idempotent run from outside —
this file has nearly paid for that twice.

Then reading the images found `docs/firstrun/07-help.png` saying **`Weft
1.0.0`** on a tree at 1.0.1. It is written by no generator: a manual capture
sitting inside the group's pathspec, so regenerating could never correct it,
and the group's STALE report was pointing at a real defect that no amount of
regenerating would have cleared. Three fixes — pathspec narrowed to
`docs/firstrun/0*.png` (`icons.png`, a hand-drawn icon comparison sheet, is
now outside it, matching what `store listing screenshots` already does for
its tiles), a real generator step for the help shot, and a guard that fails
if any file in that pathspec has no generator writing it. Only that group can
be guarded that way and the test says so: `store-assets.spec.ts` composes
filenames from a frame × slug template, so no literal name appears in it.

**The transferable half: a pathspec that names a directory claims everything
in it was generated.** Both hand-made files in `docs/firstrun/` got swept into
a generated-artefact group by a pathspec written as `docs/firstrun`, and one
of them was wrong for a week with a tool pointed straight at it.

**And the first real verify stamp turned an existing test red.** `the store
pathspec takes the fifteen captures` counted `git ls-files` over `paths`, and
`artefactsFor` folds the manifest path into `paths` — so it matched 15 for as
long as nobody ran `artefacts:verify`, and 16 the moment somebody did. Passing
because the feature is unused, failing on first use. Both pathspec tests now
share a `captures()` helper that excludes the stamp. Worth expecting the same
shape from the other three manifests the first time each is written.

**2026-09-29 — the manifest had to be one file per group, not the one this
file named.** Closing the `artefacts:check` item above found a bug in the fix
this file had already specified: a single shared `docs/artefacts.json`,
added to every group's `paths`, would let a verify commit for one group
silently move `lastWrote` for every other group too, since `checkArtefacts`
reads paths rather than content and a shared file is a path every group
would then share. Caught by a test before it was ever generalised into the
real artefact list: verify one of two groups, assert the other stays
exactly as stale as before. Built as `docs/artefacts/<slug>.json` instead,
one file per group, which needed no change to `checkArtefacts` at all —
`paths` already unions several pathspecs, so a per-group manifest just gives
that union a second way to move forward.

Also decided against pre-seeding the four real manifest files, though an
earlier draft of the "every declared path has history" test would have
forced exactly that. Two of the four groups were genuinely stale when this
landed (`store listing screenshots`, `first-run walkthrough shots`), and
`checkArtefacts` cannot distinguish an honest verify stamp from a fabricated
one — only the person writing it can — so stamping them now would have been
the identical false "fresh" this fix exists to prevent. The test now exempts
the manifest path by name instead: it is derived from the artefact's own
name, so it cannot be the typo that test exists to catch, and it earns real
history the first time `npm run artefacts:verify` actually runs for that
group.

Measured at the end, on Node 26.7, with npm's own exit status captured
rather than a pipe's: `npm run test:all` **exit 0** — typecheck clean, 527
unit / 130 suites, 98 jsdom / 22 suites, **61 tools / 18 suites** (55 / 16
before this work), compat 56 pass / 7 degrade / 0 fail / 0 without data,
983 KB × 3 passing `validate`, 36 e2e passed and 3 skipped in 1.9 min, then
build and validate again — every figure unchanged from the last measurement
except the tools count, which is exactly this change: nothing here touches
`src/`. `npm run artefacts:check` itself still reports the same three groups
stale it reported before this work started (`store listing screenshots`,
`first-run walkthrough shots`, `release notes for 1.0.1`) — this gives the
tool a way to *record* a check, it does not perform one, and none was
performed here.

**2026-09-29 — the documentation shots were not photographing a date, and
the first thing that made them diffable was a product fix.** The queued item
named the cause — five `dashboard*.png` rendering an absolute calendar date
from `Date.now()` — and named the wrong one. Measured before touching
anything, two runs a minute apart moved `dashboard.png`, `dashboard-dark.png`,
`dashboard-milestones.png`, `dashboard-vocabulary.png` and **`popup.png`**,
which is not a `dashboard*.png`; and `dashboard-transparency.png`, the one
panel that renders a date a reader can see, never moved at all. **The churn
set was not even stable between checks** — `dashboard.png` and `popup.png`
took turns — which is the signature of a counter accruing across a format
boundary, not of a clock. Three causes, in the order they were found:

1. **An unstable sort, in the product.** `dashboard-vocabulary.png` showed
   the same rows in a different order, and cropping the differing region
   (5305 pixels, 286 rows) showed why: every card tied on the sort key.
   Three of the four columns in `src/ui/dashboard/index.tsx:137` returned 0
   for distinct cards — `exposures` ties for everything unseen, `stability`
   for everything unreviewed, `cardRetrievability` for every new card — so
   `Array.sort`'s stability handed the order to the storage round-trip.
   Exactly `buildDiscoveries` before `06cd2e9`, and **the unguarded sibling
   of a decision already taken**: that fix is four weeks old and this
   comparator sat three files away. Not a test concern — a real learner's
   list reshuffles between visits. Moved into `src/core/stats.ts` as
   `sortVocabulary` so it is unit-testable at all, with the tiebreak
   `buildDiscoveries` already uses. `orderKey` is new in `similarity.ts` and
   is deliberately *not* the existing `fold`, which collapses doubled
   consonants and would file "pomme" and "pome" together.
2. **Attention accrued by the run itself.** The popup's attention line and
   the milestone bars read whatever the run earned while weaving a real page.
   Fixed with the idiom `store-assets.spec.ts` already proved: seed 1800s,
   which `formatDuration` floors to a stable "30 min".
3. **A cooldown banner the harness queued for itself.** Since
   `splitImportedSettings` landed in `6425461`, importing a payload with no
   settings means `validateSettings` supplies the shipped defaults, and those
   are *easier* than the density this spec configures — so the seeding import
   queued "starting density → 6%; maximum density → 35%" and both options
   shots grew a red "One change is waiting" banner about 200px tall. The
   commitment layer working exactly as designed, on a payload only the
   harness would ever send. Cancelled by id rather than by matching
   settings, so it stays correct whichever field a future default makes
   easier.

**Two things that made it worse before they made it better, both worth not
repeating.** Resetting the vocabulary store is necessary — probed, 12 cards
before, 0 after, 19 after the import — but `reset-vocabulary` alone is not
enough while a taxed page is still open, because the content script keeps
writing. Closing those pages *without* waiting was worse than leaving them
open: the close flushes pending exposures asynchronously, the flush raced the
reset, and **five** shots drifted where one had before, including
`dashboard-transparency.png`, which had been stable all session. A 2500 ms
settle between the closes and the reset is what actually fixed it.

**The list still holds 26 words, not the 19 in the plan, and that is
expected.** Probing each step pinned the extra seven to the *shots loop*:
the onboarding page's own live preview weaves a real passage through the real
selector and records real exposures. Deterministic, so it costs nothing here
— but it means a preview writes to the learner's vocabulary, which is queued
in `Next` as a judgement rather than fixed as a defect.

**What is left, measured rather than waved at.** 18 of 19 shots are
byte-identical across consecutive runs. `options-density.png` is *bistable*:
run 1 and run 3 agreed exactly and run 2 differed, by **17 pixels across 4
rows** (y 275, 278, 418, 421) in the two density slider tracks — the same
"1-pixel slider ticks" residue this file already records for the store
shots, and not a shift, not a clip offset, and not reachable by seeding
anything. `page-woven.png` drifted once in five checks and is captured at
line 59, before any edit in this work, so that drift is pre-existing
renderer nondeterminism rather than anything queued here.

**Reading the images is what found the one real cost, and `git status` could
never have.** Seeding half an hour saturates the site ceiling, so the popup
now prints "You have reached the ceiling for this site" where the committed
shot printed "40% after another 7 min" — the sentence that actually shows
escalation happening. That cannot be had *and* reproducibility:
`formatDuration` floors to whole minutes and the projection counts **down**
by exactly the seconds the run accrues, so it is stable only in the
knife-edge case where the value sits 59s above a boundary. Recorded in the
spec beside the constant, because that is where someone would go to lower it.
Two shots got *better* from being read: `options-dark.png` matches its
committed bytes again once the banner is gone, and
`dashboard-transparency.png` no longer has a half-cropped "Settings" link
bleeding into the bottom of the clip.

**`artefacts:check` cannot ever call `docs/firstrun/` fresh, and that is a
real limitation rather than a bug in this work.** It asks provenance — "has
anything this was generated from been committed since the artefact was last
written" — and the firstrun set regenerated **byte-identically**, so there is
nothing to commit and no commit to move its `lastWrote`. It will therefore
report stale on every future run until some unrelated change to those eight
files happens to land, and the next session will regenerate it, get identical
bytes again, and be puzzled. Verified, not assumed: `git status docs/firstrun/`
was empty after two full regenerations, and `artefacts:check` still listed the
group as 8 commits stale afterwards. Queued in `Next` as a fixable design gap:
a committed per-group manifest recording the commit an artefact was last
*verified* at, included in that group's own `paths`, would turn "I checked and
it was identical" into something the tool can see. `docs/screens/` does not
have this problem this time only because its bytes really did change.

**One methodological note.** A run of the generator that *fails* writes
nothing, and "no file changed" is indistinguishable from a clean idempotent
run — this file already records that, and it nearly cost this session a false
result: a 16-minute run failed under contention while other work ran
alongside it, and the drift check it fed reported zero drift. Every
reproducibility claim above comes from a check that captured npm's own exit
status per run and was read before its diff was believed. Do not run anything
else heavy alongside the generator.

**2026-09-29 — the listing art went stale one commit after it was declared
current, and the check that would notice did not exist.** The queued item
asked for the store-asset generator to be diagnosed and fixed. It was
already done, ticked, and correct: the generator runs in ~30 s and is
reproducible. Verifying that is what found the next thing — three of the
fifteen shots no longer matched what it produces, one commit after a session
had regenerated them and written "byte-identical" into this file.

**The evidence standard mattered more than the finding.** "The shots differ"
is not a result; the previous session's own note says so. Hashed run to run:
identical. Hashed against committed: three differ. Then, one variable at a
time, with a build and a 30 s generator run each: reverting
`src/ui/options/data.tsx` alone — the only *copy* change in `6425461` — did
not restore them; setting `VERSION` back to 1.0.0 alone did not either;
`git checkout 06cd2e9 -- src/` **did**, byte for byte, all fifteen. So the
cause is in `src/` and the generator is deterministic across sessions, which
is the claim that was actually in doubt.

**What the difference is, and what it is not.** A scratch canvas diff in the
Chromium the e2e suite already installs (no image tooling on this machine —
the method is in `CLAUDE.md`'s 2026-09-29 entry) says 19 368 pixels differ,
and that **149 of the 156 differing rows are reproduced exactly by shifting
one row**; the other 7 are 1-pixel slider ticks. The page is one pixel lower
and no text changed. Two independent measurements of the options page under
the full scene sequence — `scrollY` 1774, every `.section` box identical to
two decimal places, in both builds — found **no layout difference to
explain it**, and that is recorded as unexplained rather than given a
plausible-sounding cause. It does not matter for the listing: content is
identical and determinism is proved. Do not spend another session on the
mechanism unless the shots start differing *between runs*, which is the case
that would matter.

**The transferable half is the class, and this is its third sighting.** A
change to `src/` invalidates *artefacts*, and nothing looked at artefacts:
not the count sweep (it greps test totals), not CI (it rebuilds the packs
and diffs them, which is the right check for the one artefact that is
platform-independent). `npm run artefacts:check` is now that sweep. It asks
**provenance, not content** — has anything this was generated from been
committed since it was last written — because the content question cannot be
asked here: PNGs rendered on macOS will not byte-match `ubuntu-latest`, and
release notes listing a `git log` can never match their own tree, since the
squash commit that lands them does not exist yet. On a fresh `main` it
reported four stale groups, and **two of them nobody knew about**:
`docs/screens/` 5 commits behind and `docs/firstrun/` 8. It is deliberately
not in `test:all` — almost every PR touches `src/`, so it would be red
almost always, and this file already records that a gate which fires for
more than one reason gets ignored. It is wired into `docs/SUBMIT.md`'s
pre-flight and into B2a and B5 step 7, which are the two moments it has
teeth.

**2026-09-29 — "byte-identical" was wrong, and the culprit was an unstable
sort, not the clock.** The note below this one ends by claiming two
consecutive runs of the store generator produce all fifteen shots
byte-identical, with a caveat about the day rollover. Both halves were wrong.
Two runs a minute apart, at 00:35 on one day, moved all three
`*-04-progress.png` — including `chrome-04` and `edge-04`, which that note
correctly says *cannot* drift from the attention tile, because the tile is
cropped out below 1440 px. That contradiction is what made them worth
diffing.

- **How the diff was done, because there is no image tooling on this
  machine** (no ImageMagick, no PIL, no `pngjs`): a scratch script driving
  the Chromium that Playwright already installs, loading both PNGs into a
  canvas and printing the bounding box of differing pixels. 4416 pixels at
  x 389–703, y 135–185; cropped and rendered, two lines of the discoveries
  feed with *montagne* and *forêt* swapped. Four minutes, and it turned "the
  shots differ" into a finding. Reuse the method; the script was scratch and
  is not committed.

- **The cause.** `buildDiscoveries` (`src/core/discoveries.ts`) sorted on
  kind, then `b.metAt - a.metAt`, and stopped. The nineteen cards the spec
  seeds all carry `firstSeen: now - 30 * day`, so same-kind pairs tie on both
  keys, the comparator returns 0, and `Array.sort`'s stability defers to
  input order — which is whatever the storage round-trip produced. **A
  comparator that returns 0 for two distinct items has not defined an order,
  it has delegated one.**

- **Fixed in `src/core/`, not in the spec, and that was deliberate.** A bulk
  import ties, and so do two words woven into one render, so a real user's
  feed could reshuffle between visits — and `discoveries.ts:118` had already
  ruled that out for the feed's *wording* ("not random … so the feed does not
  reshuffle its own wording between visits"). Third sort key, not a new
  policy.

- **Why `fold(id)` and not the two obvious options.** Raw code units are
  deterministic and put *pierre* before *père* (`i` = U+0069, `è` = U+00E8),
  which reads like a bug in a feed of French. `localeCompare` reads correctly
  and depends on the runtime's ICU data, so this machine and CI could
  disagree — the same defect one layer down. `fold()` was already in the
  file. Raw id is the final key so the order stays total.

- **The guard that should have caught it, and why it could not.** The test
  three lines above the new one — "descent phrasing varies but is stable per
  word" — calls `buildDiscoveries` twice **on the same array**, so input
  order is identical both times and only the wording can drift. Same shape as
  PR #14's guard that could not see `novem`. The new test permutes the input.

- **Environment, fourth sighting.** The iCloud conflict copy killed a run as
  `test-results/.playwright-artifacts-0 2` / `Unknown system error -11`. The
  `com.apple.fileprovider.ignore#P` attribute was set on `dist/` three
  sessions ago and never on `test-results/`. Set it there too:
  `rm -rf test-results && mkdir test-results && xattr -w
  'com.apple.fileprovider.ignore#P' 1 test-results`. Deleting the directory
  between runs is *not* sufficient — the copy appears mid-run.

**2026-09-29 — the queued quote-convention item was already done.** The queue
handed this session the two-quote-conventions measurement with the direction
left open. PR #20 closed it on 2026-09-28: all 59 notes are curly, the guard
is `tests/tools/lexicon-orthography.test.ts:185`, and the only straight `"`
left in `tools/seed/*.tsv` are inside the `#` header comments, which the
guard does not scan and should not. **Five of the last six sessions have been
handed a completed item.** Checking costs a minute if `TODO.md` is read
first, which is what it is for.

**2026-09-29 — the store-asset generator was never broken; `dist/chrome` was.**
The entry this replaces recorded `WEFT_STORE=1 npx playwright test
store-assets` as failing reproducibly in 28 s at `store-assets.spec.ts:88`,
waiting for `weft-w`, writing nothing. All of that was accurately observed and
the conclusion was wrong. The generator passes in ~35 s and writes all fifteen
files.

**The variable was which build of the extension was on disk, which is why
three hypotheses about the extension's own code all came back clean.**
`npm run test:e2e` is `build:test && playwright test && build`. That trailing
`build` is deliberate — it stops a test-seamed extension lingering, and
`tools/validate-package.mjs` already fails any package whose manifest carries
`host_permissions` or whose name still says "test build". The cost is that
`dist/chrome` is a **production** build once the suite finishes, and also
after `npm run test:all`, which ends in `build:all`. A production manifest
grants no localhost origin (`manifest.config.mjs:107` adds it only under
`opts.test`), so `configure()`'s `origins: []` leaves the content script
unregistered, nothing is woven, and the spec waits 20 s for a word that can
never appear. Confirmed both ways rather than argued: production build →
the recorded failure exactly, `:88`, "element(s) not found", 22.1 s; test
build → pass.

**The general form, and it is the reusable part: when a failure's three most
likely causes all read clean in `src/`, the next question is not a fourth
hypothesis about `src/`. It is what artefact on disk the test is actually
running against.** Every eliminated hypothesis here — the wrapped renderer,
a renamed settings key, the cooldown layer — was a question about source that
no amount of reading source could answer.

Fixed so it cannot cost a session again: `tests/e2e/fixtures.ts` reads
`dist/chrome/manifest.json` before launching and throws in **5 ms** with a
message naming the cause and `npm run build:test`. It sits in the fixture
rather than in any one spec because it is the three hand-run generator specs
(`WEFT_STORE`, `WEFT_SCREENS`, `WEFT_FIRSTRUN`) that meet it — they are the
ones a human runs directly instead of through `npm run test:e2e`.

**What the working generator then reported is the substantive half: four of
the fifteen shots were stale.** Three are `*-05-settings.png`, in all three
frames, and they show **"60% — 1 word in 2"** — the unqualified phrasing PR
#12 replaced. The options page a visitor installs says "60% of content words
— 1 word in 2". #12 regenerated the `docs/` screenshots and not the store
ones, and the check that would have caught it was the one written off as
broken. Regenerated and committed. **B5 step 7 uploads these**, so this was
listing art misquoting the product.

**The fourth was the progress shot, and it was photographing the clock.**
Four of scene 4's five tiles come from cards seeded through the real import
path and are reproducible; "taxed attention today" was not seeded at all and
read whatever attention scenes 1-3 accrued — `9s` on one run, `6s` on
another. Attention is now seeded at **1800 s** before scene 4 via
`record-attention`, which `formatDuration` prints as "30 min", so the run's
own few seconds are absorbed below the next minute boundary. Thirty minutes
is also the figure the listing copy itself uses for half an hour on a feed,
so the tile no longer undercuts a progress panel with six seconds.
`tests/tools/store-assets.test.ts` guards it (4 tests, 1 new suite, written
test-first, red on a missing constant): it re-derives the rendered string
across the whole 0-59 s accrual range rather than trusting the two clauses
that make it work, and includes a non-vacuity case that fails for `9s`.

**Measured, and this is the claim that could not previously be made:** two
consecutive runs produce **all fifteen shots byte-identical**. One caveat,
recorded rather than gated — a run that crosses the day rollover *mid-run*
still differs, because the seeded plan is `Date.now()`-relative and the
dashboard renders a per-day chart. That is the same class as the five
`dashboard*.png` PR #12 declined to build a determinism gate around, and the
same decision applies. Runs on either side of midnight agree; only a run
straddling it does not.

**One frame-geometry fact worth knowing before re-reading any of this:** the
tiles are only in shot at 1440×900. The chrome (800 px) and edge (768 px)
frames scroll them off, which is why only `apple-04-progress.png` ever
drifted, and why `chrome-04` and `edge-04` came back byte-identical to `main`
even after the seeding changed the tile.

**2026-09-29 — the "abandoned" store screenshot was the generator's own
output.** The entry this replaces said `docs/store/apple-04-progress.png` is
**126 408** bytes "on `main`, on the whole stack, and as the generator
produces it", called the **126 711**-byte variant on
`origin/docs/test-counts-and-changelog` a stray, and said **do not "restore"
it**. The premise was wrong: run here before the seeding fix, the generator
produced blob `9a935872` — **exactly** the 126 711-byte variant, bit for bit.
Both blobs are legitimate output of the same code, one with the attention
tile reading `6s` and one `9s`. Nothing was ever abandoned and nothing needed
restoring; the scene was simply not reproducible, which it now is. The branch
fact still holds — `docs/test-counts-and-changelog` is the one ref that is
not an ancestor of `main` — and its single unique commit carries nothing else
that `main` lacks.

**2026-09-29 — there are no open pull requests, and the three closed ones
lost nothing.** Checked because a queued task asked for "the remaining open
PRs, three of them blocked by real merge conflicts" to be landed: `gh pr list
--state open` returns `[]`. All 23 are merged (20) or closed (3: #3, #5,
#14), and the premise describes the state before #22 and #23 landed the
stack. Proved rather than assumed, and the check is cheap to repeat:
`tools/reproducible-lexicon-packs` (#5's head, `0e41950`) and
`lexicon/proper-noun-notes` (#14's head, `f4e4753`) are both **ancestors of
`main`** by `git merge-base --is-ancestor`, so every commit on them is
landed. `docs/test-counts-and-changelog` (#3's head, `51503a7`) is not, and
carries exactly one commit `main` cannot reach; of the four paths it touches,
`playwright.config.ts` is byte-identical to `main`, `CLAUDE.md` and `TODO.md`
are superseded many times over, and `docs/store/apple-04-progress.png` is the
generator output described above. **Nothing is waiting to be merged.** The
critical path is B0 step 2.

**2026-09-28 — the tool-test count was right in two documents and stale in
three.** Measured on the merged tree: **484** unit / 122 suites, **98** jsdom /
22 suites, **31** tools / 10 suites, **36** e2e + 3 skipped. `CHANGELOG.md`
(649 = 484 + 98 + 31 + 36) and `CLAUDE.md`'s command table already said 31;
`TODO.md`'s own State line, `docs/SUBMIT.md:12` and `README.md:267` still said
**29 / 9 suites**. The +2 is PR #20's curly-quote guard — "no pack note
contains a straight double quote" and "the guard has something to police" — in
one new suite. All five now agree; the only surviving mention of the old
number is this note, which is why the check below greps for it rather than
asserting it is gone.

This is the same defect PR #3 and #4 were about, recurring in a smaller way,
and the pattern is worth naming: **the session that adds a test updates the
count where it is looking, and misses the documents it is not.** `docs/SUBMIT.md`
is the expensive one — it is the runbook that tells a human which numbers mean
green, so a wrong count there is read as a failing gate. The cheap check after
adding or removing any test is `git grep -n` for the *old* number across
`README.md`, `CHANGELOG.md`, `TODO.md`, `CLAUDE.md` and `docs/`, which is five
files and finds all of them.

**2026-09-28 — twenty PRs of work sat unlanded because every session read
"merging is a human step" as covering its own PR too.** The stack grew from #1
to #21 over two days and only #1 ever reached `main`; each session dutifully
stacked its branch on the previous head, opened a PR, and stopped. The result
was nineteen commits of finished, CI-green, reviewed work that `main` did not
have — including both pages the Chrome listing has to point at. **If a session
finds the topmost item is "land the stack", landing it *is* the task**, and a
PR merged into another PR's head is not landed. The narrow thing that genuinely
needs Creagh is the *tag push* (it fires `release.yml`, which publishes
outward) and everything in B1–B5; a merge into `main` through a green PR is
not that.

- **The conflict resolution is checkable, not a judgement call.** See B0: the
  two trees were equal, so the merge was content-neutral by construction. The
  `git write-tree` comparison against `f4e4753` is the check to repeat if this
  ever has to be re-done.
- **`main`'s `CLAUDE.md` was not #1's first draft**, which the earlier B0 text
  assumed. It was #1 *and* #2 squashed together, because #2 merged into #1's
  branch nine seconds before #1 merged to `main`. Taking the stack side was
  still correct, but for a stronger reason than the one written down, and the
  weaker reason would have been wrong if the timing had gone the other way.
  Checking `gh pr list --json mergedAt` is how that was settled.
- **PR #14 was left open by this session and closed as superseded**, along with
  its branch. Its content is in `main` via this merge. #3 and #5 were already
  closed; nothing else was open.
- **The `.worktrees/` hazard is already fixed on the stack, not on `main`.**
  If a future session reads `.gitignore` from a stale `main` checkout and sees
  no `.worktrees/` line, that is the staleness, not a regression.
- No `git stash` was used anywhere: the stash stack is shared across worktrees
  and another session could pop it. One `git merge --no-commit` printed
  `fatal: stash failed` in a freshly-created worktree and left no state; the
  same merge without `--no-commit` worked. Not worth chasing, worth not being
  alarmed by.

**2026-09-28 — a queued judgement call is still worth reading the data for,
not just reasoning from the premise already written down.** This file
recorded a real argument for leaving Latin/OE's straight quotes and French's
curly ones as two different conventions: the two packs quote different kinds
of thing, so they earn different punctuation. It was a reasonable-sounding
argument and it was wrong, and reading all 59 straight-quoted notes rather
than the ~6 examples already quoted in this file is what showed that: a third
of them quote English words, the same job French does in curly. **The
general form: when a queued item states an argument for its non-default
option, check whether that argument was checked against the *whole* set it
claims to describe, or only the handful of examples that fit it.** The
examples this file quoted for "Latin/OE quote target-language forms" —
`"mann"`, `"mālum"`, `"ne ǣfre"` — were all real and all consistent with the
claim; they just were not a sample, and the notes that did not fit
(`"muscle"`, `"despair"`, `"warden"`, `"hale"`, `"bank teller"`, and a dozen
more) were sitting in the same two files the whole time.

**Also worth recording: this session found concurrent git activity in the
primary working directory partway through** — a `checkout` to `main` and a
`fast-forward merge`, both timestamped roughly four minutes into the session
via `git reflog --date=iso`, matching neither this session's own commands.
Most likely explanation is Creagh picking up B0 live in the same checkout
this file's instructions run in. The response was to stop, and finish the
work in an isolated `git worktree` (`.worktrees/`, now gitignored) based on
`origin/lexicon/proper-noun-notes` rather than the primary directory's
checkout, and to land by pushing a new branch and opening a PR against the
stack head rather than committing in place. Nothing here touched `main` or
any part of B0. Worth the same caution again if a future session finds the
primary checkout's branch does not match what a session-start snapshot said.

**2026-09-28 — the exception list the item asked for was a fifth of the
corpus, so the other option won.** The queued item preferred shape 2,
capitalising a note's first letter at render time, "with a measured exception
list", and asked for the list to be measured before choosing. Measuring it is
what disqualified the shape. Of the **99** notes that reach a word page, **39**
open with a quotation mark around a cited target-language form and **5** open
with a proper noun, so `charAt(0).toUpperCase()` is a **silent no-op on 44 of
them** — and on the one un-quoted citation, `paene īnsula, almost an island`,
it is not a no-op but a mistake, capitalising a Latin phrase that is being
quoted rather than used. Shape 1, the dash, needs no list at all, and the
reason is worth keeping: **every capital already in the note corpus is required
by a name — Jenner, Janus, Argentina, September, November — rather than by
sentence position**, so a dash can never produce a spurious capital. The
general form: before writing an exception list for a transform, check whether
the set needing the exception is the same set the transform silently misses. If
it is, the transform is the wrong tool.

Three corrections to the item's own numbers, all in the direction of a smaller
job than it described. **"247 of 318 notes" counts instances across all seven
packs**; the transform acts on *strings*, of which there are **185** distinct,
and only **99** reach a word page at all, because French has 85 notes and no
word page. **"71 notes begin with a capital" is 5** once quotation marks are
separated out from letters. And **the "Worth knowing" branch the item named as
a second site renders on 0 of the 711 pages** — every la/ang entry with a note
also has an `etymonOf`, so that branch is unreachable on the current lexicon.
It was left alone, and on reflection it is not the same defect: a bare note
under a heading is the *caption* frame, which is the frame these fragments are
written for and the one the tooltip and the hub `<td>` already give them.

**Do not capitalise the notes in `tools/seed/*.tsv`.** Shape 3 is now strictly
worse than before this fix: the word page no longer needs a capital, and the
tooltip and the descent hub would both get worse, because in a `<div
class="note">` and a `<td>` the lowercase fragment is correct. 247 edits to
make three surfaces worse and none better.

The diff is wider than the fix. **637 word pages changed bytes; only 99 changed
visibly.** Dropping the note's own `${...}` interpolation removed one blank line
inside the descent `<p>` on the 538 note-less pages, which HTML whitespace
collapse makes invisible. No pack moved, no `builtAt` moved, and the sitemap is
byte-identical, so nothing was redated — the one date that will move is the
install page's, because `contentDate()` reads `tools/build-site.mjs` for it and
that file was edited. Same known coarseness the previous session recorded, and
nothing is indexed yet (B3).

**2026-09-28 — the queued fix was right about the slot and wrong about the
role.** The item reconstructed the sentence `META.la.descent` was written for
as "the Latin word your English *November* borrowed from", and asked for a
prefix/suffix split so the descendant could sit before the preposition. The
split is right. The sentence is not: it puts *November* in the subject slot of
*borrowed*, which makes the English word the **borrower**, and the borrower is
English the language. The codebase already had the idiom
(`src/core/discoveries.ts:145`, "English borrowed ${descendant} from
${target}") and it disagrees. One word of passive — *was* borrowed from —
fixes the role without giving up the verb, and *borrowed* was the whole reason
the item preferred this shape over copying the Old English sibling's *became*.
**The transferable half: a queued item that names the fix as well as the
defect has had its fix reasoned about but usually not rendered, so render it
before adopting it.** Two sessions running have now found the queued
*premise* wrong (`iānua`, `novem` heading) and this one found the queued
*remedy* wrong; in all three cases the thing that settled it was building the
page and reading it.

**A guard over prose direction can be one word, if the word is chosen by
measurement.** The obvious rule — the descendant must not be the object of a
preposition — is wrong, because most prepositions take it correctly: "the
ancestor **of** November", "the root **of** vaccine". *From* is the one that
cannot, because in a descent sentence it names the source and the source is
the page's own headword. `/\bfrom$/` over the text preceding the descendant
fired on **312** Latin pages and **zero** of the 325 Old English ones — the
defect exactly, with no curated exclusion list, which is the same
derive-it-from-the-data move PR #14 used with capitalisation.

**Where the guard went, and why not a new suite.** `tests/tools/build-site.test.ts`,
which already builds the site into a temp directory to check sitemap dates.
The two rules are unrelated, which normally argues for a new file, but the
expensive, delicate part here is the seam rather than the build: a test of
this tool must render into `mktemp -d` and never into `dist/site`, which
`npm run site:check` reads. A second suite would have duplicated that setup to
re-derive the same 711 pages. The file's docblock now names both claims. The
build itself is **0.6 s**, so cost was not the deciding factor — duplication
was.

**`suites` counts `describe` blocks, not files.** Adding one `describe` to an
existing file moved `npm run test:tools` from 7 suites to 8 with no new file,
which is worth knowing before a count sweep: six files, eight suites.

**The install page's `<lastmod>` now says today, and that is the known
coarseness rather than a new bug.** `tools/build-site.mjs` is one of the two
files `contentDate()` reads for the install page, because that page's prose
lives in `installPage()` rather than in a document of its own — so editing the
*word-page* template in the same file redates a page whose text did not
change. Same class as the pack-granular dates PR #9 exercised: a page may say
it changed today when the file behind it really did. Nothing is indexed yet
(B3), so there is nothing to re-crawl.

**2026-09-28 — a guard cannot see the absence of the thing it inspects.**
PR #14 derived a rule from the data — a note whose descendant is a proper noun
must name it — and shipped it the same session `novem` was found to have no
note at all. The guard was silent on `novem`, correctly and uselessly: its
loop begins `if (!note) continue`. **The general form, worth checking against
any scanning guard: a rule that filters on the presence of a field can never
police the field's absence, so ask separately whether absence is also a
defect.** Here it was, and the fix was one more test in the same file.

**The narrowing is the reusable part.** "Carries an `etymonOf` ⇒ must have a
note" fails **962 of 1131** times across the seven packs and is plainly wrong;
"carries a *capitalised* `etymonOf` ⇒ must have a note" leaves **5 rows** and
fired exactly once. Same derivation PR #14 used, and the same reason it beats
a curated list. The substantive difference between the two cases is that an
ordinary descendant is inferable from the headword sitting next to it — *octō*
under "Ancestor of English octave" — and a name is not.

**One count was two sessions stale, and it was the public one again.**
`docs/LAUNCH.md:221` said "638 tests" inside the Show HN draft, which is
exactly the pre-#14 total (484 + 97 + 21 + 36). PR #14 added one jsdom test
and two tool tests and moved **five** documents to 641; `docs/LAUNCH.md` was
not one of them. That makes it the third separate occasion this file's drafts
have carried a number nobody had re-measured — the Journal already records
"449 tests" here on 2026-09-27 and the same draft wrong again at the 617 → 620
sweep. (The 2026-09-28 launch re-sweep is the exception that proves it is
worth checking: the "633 tests" it found was *correct*.) Six documents now say
645, swept again on 2026-09-28 for the descent fix with `docs/LAUNCH.md`
taken by name first rather than last. `git grep -nE '\b(638|641|642)\b'`
returns nothing outside Journal history and one SHA-256.
**Re-sweep `docs/LAUNCH.md` by name whenever a count moves.** It is the only
file here whose errors leave the repository, and it is the one a
five-document sweep keeps omitting, because it is the only one where the
number sits inside a blockquote rather than in a command table.

**2026-09-28 — the item's premise was wrong, and the setting underneath it was
the real finding.** `iānua`'s note was queued as "never says which month". It
does — `January` is printed directly above it on all three surfaces. What is
not guaranteed is that the reader has left it switched on: `reveal.showEtymon`
hides the badge and the note is appended regardless. **The general rule this
gives, worth applying to any future tooltip copy: a note may not lean on
anything the reveal switches can hide.** `src/content/tooltip.ts:320` had
already applied it to the "why" sentence and only to that.

*What was checked and deliberately left.* A wider sweep of "notes that never
name their etymon" returns **62 of 99** and is mostly noise — those notes
describe the *target*, not the descendant, and read fine alone. Two are the
same shape as the three that were fixed but with a **common**-noun
descendant: `līċ` → lychgate, "the corpse-gate of a churchyard", and
`setl` → settle, "the high-backed bench". Read with the badge off these still
parse as a gloss of the Old English word, which is near enough true to be
harmless, and drawing the line at proper nouns is what keeps the guard from
needing a judgement call per entry. If that line is ever moved, it is
`tests/tools/lexicon-notes.test.ts:` `isProperNoun` that defines it.

*And a stale count found on the way.* `README.md:267` said `npm test` runs
"19 over the build tools" where `docs/SUBMIT.md`, `CHANGELOG.md` and
`CLAUDE.md` all said 21 — it had been missed in PR #9's sweep, which is the
first time one of the five documents has disagreed with the other four rather
than all five being stale together. Worth grepping all five for the *old*
number as well as the new one when counts move.

*On the stack.* Nine of the thirteen PRs were merged into each other on
2026-09-28 without `main` moving, and #5 was closed rather than merged, which
is what left everything on `tools/reproducible-lexicon-packs`. See B0 —
the old "merge #1 … #13 bottom-up" instruction is gone because most of those
branches no longer exist.

**2026-09-28 — a guard that reads the lexicon cannot see Latin the lexicon
does not define.** The queued item (`npm run og` byte-stability) had already
been closed the same day, so this pass re-measured it — it holds, three runs,
identical SHA-256 — and then went after the finding PR #10 had recorded and
skipped.

- **The blind spot has a precise shape, and it is structural rather than an
  oversight.** `tests/tools/lexicon-orthography.test.ts` builds its vocabulary
  by walking `tgtLemma` across the packs. Every word it can police is
  therefore a word the lexicon defines. Prose is under no such limit: it
  explains `peninsula` as `paene īnsula`, and `īnsula` is not an entry. Six
  sites spelled it bare, two of them inside documents the guard was already
  scanning, and it could not have flagged any of them. The fix is a second
  hand-curated vocabulary (`UNDEFINED`), not a wider automatic scan — the
  wider scan was already measured at 14 false positives in #9.
- **A hand-picked list may be applied globally where a derived one may not.**
  `UNDEFINED` is checked against every note in both packs, where the headword
  rule is deliberately narrowed to the entry that owns it. That asymmetry is
  the whole point: the headword list contains English homographs nobody chose
  (`an`, `is`, `dead`, `ham`), and this one contains only words somebody
  checked. Widening it is safe exactly as far as that checking goes.
- **The exclusion list was read as "everything else" when only two documents
  had been measured.** #9 kept `docs/LAUNCH.md` and `docs/PRIVACY.md` out for
  named homographs and stopped there, which left `site/index.html` and
  `docs/STORE-LISTING.md` — the landing page and the copy Google reads —
  unguarded for no measured reason at all. Adding all three at once fires one
  offender, the known `dies`/`diēs`, so the two clean ones are now in the
  list. **If a document is excluded from a gate, check whether that was
  measured or inherited.**
- **Reading 99 notes beat grepping them, and grep could not have worked.**
  27 Latin notes and 72 Old English, read in full. A grep needs a pattern, and
  the pattern here is "a Latin word that should carry a macron" — undecidable
  without a macronizer. Old English came back clean, which is itself worth
  recording so nobody re-reads it: every quoted OE word already carries its
  diacritics. Redo the read, not a grep, if the packs gain notes.
- **All seven packs are covered, not just the two with diacritics.** Checked
  afterwards rather than assumed: `es`, `de`, `it` and `pt` have **no notes at
  all**, and all 85 French notes are one of two templates — "shares a root
  with English *X*" and "the root of English *X*" — which quote an **English**
  word, never a French one. So not one French note contains an accented
  character, and that is correct rather than suspicious. The defect class is
  structurally absent outside Latin and Old English; it would only appear if a
  note started quoting the target language.
- **`npm run test:all | grep ...` reports grep's exit code, not npm's.** Two
  runs in this session read `[exited with code 0]` that way; run as
  `npm run test:all > log 2>&1; echo $?` and one of them had exited **1**.
  Every `test:all` result quoted in the Journal is quoted as an exit code, so
  capture npm's own, not a pipe's.
- **The iCloud trap: cleaning `dist/` first is necessary but not sufficient.**
  Both failures above were conflict copies created *during* the run — at
  `validate`, and at the rebuild after e2e — as unreadable directories with
  65535 links. The fix that holds is one command, run once on this machine
  and already applied: `rm -rf dist && mkdir dist &&
  xattr -w 'com.apple.fileprovider.ignore#P' 1 dist`, which tells macOS File
  Provider to skip the directory. The next full gate created zero conflict
  copies and exited 0. Local, gitignored, reversible with `xattr -d`. If a
  future session sees `Unknown system error -11` again, check the attribute
  survived — `build.mjs` recreating `dist/` from scratch would drop it.
- **Left alone on purpose:** the note under `iānua` reads "Janus, god of
  doorways", which is the English name of the god in English prose — the same
  register as the adjacent note's "Jenner" — not a failure to write `Iānus`.
  Changing it would be imposing classical orthography on an English sentence.
  Also left: that note's "gave the month its name" never says *which* month,
  which is a copy question and not an orthography one.

**2026-09-28 — the demo's fix had not reached the two surfaces that use the
same function.** The item asked only whether the popup wanted the demo's
qualifier; `oneWordIn()` turned out to have two unqualified call sites, not
one, and both got fixed together because they are the same string pattern
produced by the same function.

- **The "against" argument was the demo's own argument, aimed at the wrong
  target.** "The user watching their own page can see the density directly,
  which a visitor to the landing page cannot" is true, but it was already
  tried as a defence of the *demo's* old wording and lost: the demo visitor
  could also see the passage directly, and a number that did not match what
  was visibly on screen is precisely what made the old readout "read as a
  broken counter" (PR #8, further down). Seeing the page
  does not make an unqualified ratio safe to state; if anything it is what
  turns a mismatch into a noticed one.
- **The second call site was not named by the item.** `src/ui/options/sections.tsx:276,294`
  builds the identical `"${percent} — ${oneWordIn}"` string as the popup, for
  the Resting-density and Ceiling rows. Fixed both, for the same reason as
  the popup: leaving one of two identical patterns qualified and the other
  not would have been a worse inconsistency than the one being fixed.
  `src/ui/onboarding/index.tsx:219,227` was left alone on purpose — it already
  carries its own qualifier, "of the words Weft knows", which names the same
  *eligible* set from the lexicon-coverage side rather than the
  part-of-speech side. Two honest descriptions of one set is not the bug the
  demo had.
- **Checked in a browser, not assumed safe.** `.row__value` is
  `white-space: nowrap` (`src/ui/theme.css:311`), so a longer string could in
  principle have overflowed the options page's compact badge, and the popup
  is a genuine 340×330px surface where any added text has less room to hide
  in. A scratch Playwright script (not committed) built the real `dist/chrome`
  test target, drove both surfaces, and compared `scrollWidth` to
  `clientWidth` on the affected rows at ratios from 6% to 60%. No overflow at
  any of them; the popup's sentence wraps onto a second line the way the
  original did.
- **`docs/screens/*.png` is not byte-stable across days, and it has nothing
  to do with this fix.** Regenerating it to update the two screenshots that
  show the new text (`WEFT_SCREENS=1 npx playwright test screenshots`) also
  rewrote `dashboard.png`, `dashboard-dark.png`, `dashboard-discoveries.png`,
  `dashboard-milestones.png` and `dashboard-vocabulary.png` — none of which
  render `oneWordIn` at all. `tests/e2e/screenshots.spec.ts` seeds vocabulary
  progress with `lastReview: now - ago * day`, and
  `src/ui/dashboard/index.tsx:299,429` renders that as an absolute calendar
  date (`new Date(entry.at).toLocaleDateString(...)`), so every capture after
  today differs from today's by a few bytes of date text, on every dashboard
  screenshot, forever. Not a regression. Reverted those five with
  `git checkout --` and kept only the three whose diff is real —
  `options-density.png` and `popup.png`, both embedded or tracked and both
  showing the edited text directly, plus `options.png`, the full-page shot
  that contains the same rows. **Do not build a determinism gate around this
  directory the way `docs/store/*` earned one**: that gate's justification
  was OS/font antialiasing as the *only* source of drift on lexicon-fixed
  content; this directory has a second, calendar-shaped source on top, so a
  from-scratch diff would flag ordinary future sessions as often as it flags
  a real regression.
- **`TODO.md`'s own PR count was already wrong before this session added a
  PR to it.** B0 said "ten stacked PRs" and "Merge #1 … #9", but PR #11 (a
  same-day bookkeeping commit, no code) was already open. Corrected to twelve
  while adding this session's #12, and the merge instruction now covers the
  full range rather than stopping two short of it — worth knowing because
  that stale instruction would have told Creagh to stop merging before the
  most recent work.

**2026-09-28 — a queue entry asked for the macron fix `1fc81be` had already
shipped, same day.** The task named the same three sites `1fc81be` corrected
that morning, down to the line number: `tools/build-site.mjs:442`,
`docs/PEDAGOGY.md:116`, `tools/seed/lex-la.tsv:376`. All three still read
`mīlle passūs`. `git grep -n mille` across the three files returns nothing;
`git grep -n mīlle` finds exactly the three corrected spellings plus the
seed's own header-comment mention; `git blame -L 376,376 tools/seed/lex-la.tsv`
names `1fc81be` as line 376's last author. No edit was made.

- **Run anyway, since the task asked for it: `npm run packs` against an
  already-correct seed.** The tree came back completely clean — not the two
  files the task predicted (`en-la.json` + `index.json`), but zero, because an
  unchanged seed produces an unchanged pack once `writeStamped()` (PR #5) is
  doing its job. `npm run typecheck`, `npm run test:tools` (21/21, both
  `lexicon-orthography.test.ts` cases included) and `npm run packs:verify` (0
  errors, 4 warnings — the same four Old English interjections lacking IPA)
  all pass against the untouched tree.
- **The task's own prediction was also wrong, independent of whether the bug
  still existed.** "Only `en-la.json` + `index.json` should move" restates
  exactly what `1fc81be`'s own note already corrected: `index.json` records
  `entryCount`/`lemmaCount`/`bands` per pack, none of which a note's spelling
  touches, so it rightly does not move for this class of fix at all — only
  `en-la.json` does, and only when there is a real change to make. Worth
  restating since a new queue entry asserted the opposite.
- **Same shape as the duplicate `npm run og` queue entries two notes below.**
  Left the queue alone rather than prune it, same reasoning as then: pruning
  is outside what any one task asked for, and the queue already tolerates
  redundant re-verification by design. No code changed in this pass; this
  note is the only diff, and only `TODO.md` carries it — `CLAUDE.md`'s Journal
  stayed untouched here for the same reason it stayed untouched for the last
  bookkeeping-only pass (PR #10, immediately below): nothing about the shipped
  product moved.

**2026-09-28 — the launch drafts held up on a second, independent read; the
OG card is the third thing now confirmed byte-stable.** This session's task
named `docs/LAUNCH.md` as the item to work and pointed at "TODO.md > Now,
topmost unchecked" — but by the time it ran, a sibling session on
`docs/launch-copy-sweep` had already closed that item out (the ten
corrections recorded two entries below), and the topmost unchecked item was
actually the `npm run og` check. Swept `docs/LAUNCH.md` end to end anyway,
against the code rather than against the note, on the reasoning this file
itself already argues: a note is a claim, not a proof.

- **What was actually checked, category by category, the way the task asked.**
  *Permission list:* the r/chrome_extensions draft's exact code snippet,
  `chrome.scripting.registerContentScripts({ persistAcrossSessions: true })`,
  against `src/background/index.ts:719` — verbatim. *Free vs Pro:* "Free for
  one language forever" against `FREE_LANGUAGE_LIMIT = 1` and the free-tier
  list in `src/core/entitlements.ts` and `docs/PRICING.md`. *The renderer
  claim:* `nodeValue` assignment and the CSS Custom Highlight API against
  `src/content/render-highlight.ts` (`new Highlight()`), and the HN draft's
  "test page that stores text-node references and calls removeChild on each"
  against `tests/e2e/pages/reconciler.html` — verbatim. *Licence-revocation
  honesty:* "cannot be revoked, stated on the pricing page rather than
  hidden" against `docs/PRICING.md`'s own "A licence cannot be revoked. There
  is nowhere to publish a revocation." *Lexicon sizes / claims:* all four
  Latin etymology examples in the r/latin draft — `vacca`→vaccine,
  `mīlle`→mile, `paene`→peninsula, `pecūnia`→pecuniary — against
  `src/lexicon/packs/en-la.json` directly (the entries are keyed arrays, not
  flat objects; a first pass at querying the pack silently matched nothing
  until that was noticed). *Every URL:* the Christensen DOI against
  `docs/PEDAGOGY.md`, and the two lexicon-page slugs the document's own
  opening section claims (`/old-english-words-that-became-english`,
  `/latin-words-in-everyday-english`) against the literal string in
  `tools/build-site.mjs:430`. All of it matched.
- **One adjacent finding, not in `docs/LAUNCH.md` and not fixed.** The pack's
  own note on the `paene` entry reads `"paene insula, almost an island"` —
  without the macron that `docs/LAUNCH.md` correctly gives it (`paene
  īnsula`), and that "īnsula" is standardly long is not in question. This is
  the document being *more* correct than the lexicon note behind it, not the
  other way round, and it is invisible to `lexicon-orthography.test.ts` by
  design: that guard checks only an entry's own `tgtLemma`, and `insula` is
  not `paene`'s. Left for a session that wants to touch the lexicon rather
  than folded in here, on the same narrow-scope discipline every PR on this
  stack has kept. Recorded so it is not found twice.
- **The `npm run og` result belongs here too, since it was the actual
  topmost item.** Three runs on this machine produced the identical SHA-256
  (`6f2ef13f…eb6f3e66`) as the committed `site/og.png`. See the Now item
  above for the result and for one small correction to that item's own
  account of a `new Date()` grep.
- **Two of the six prompts sitting in the local `cq` queue for this repo
  turned out to be this exact `npm run og` check, queued a second and third
  time** (`q_20260928T093343_e59a`, `q_20260928T100248_4dce`). Left them
  alone rather than remove them — pruning another queued task is outside
  what this one asked for, the queue's own design already tolerates
  redundant re-verification (this very session is an instance of it, for
  `docs/LAUNCH.md`), and whoever drains them next will find this item
  already `[x]` and the SHA-256 written down.
- **`npm run test:all` hit the iCloud trap again — same location as before,
  but this time mid-build rather than before it.** `dist/` was cleaned before
  the run started, same as every
  prior session's precaution, but the *second* `build:all` (the one after
  `test:e2e`) still died on `Unknown system error -11 … scandir
  '.../dist/safari/_locales 2'` — a conflict copy iCloud dropped in *while
  the gate was running*, not one left over from before it. Everything through
  typecheck, 484 unit, 97 jsdom, 21 tools, compat, the first `build:all` and
  `validate`, and all 36 e2e tests had already passed by then. Cleaned
  `dist/` again and re-ran only the remaining `build:all && validate`, which
  passed. Worth knowing: the existing "clean before you run" advice is
  necessary but was not, this time, sufficient.

**2026-09-28 — the guard found three defects; the item named one.** The item
was "spell `mīlle` with its macron in the three places that do not". Writing
the check first turned three into six places and one word into three, and the
extra ones are the reason to write the check first rather than grep:

- **`spēs`, in shipped tooltip copy.** The note under *hope* read `"despair"
  is to be out of spes`. Identical defect to `mīlle`, in the same pack, and
  invisible to any search for *mille*.
- **`rēx` and `rēgis`, in `docs/PEDAGOGY.md:100`** — the sentence arguing
  that a nominative headword drops cleanly into an English frame, which is
  the paragraph explaining *why the Latin pack is spelled the way it is*.
- **`README.md:92`**, a fourth site of `mille` the item did not list.

**Two clauses are what keep the guard from being noise, and both were
measured rather than guessed.** The obvious rule — no note may spell any
macron-bearing headword bare — fires **14 times on Old English**, because
headwords collide with ordinary English words the notes legitimately use
(`an`, `is`, `dead`, `ham`). So: check only the entry's **own** `tgtLemma`,
and allow the bare form when the note also shows the macron form. The second
clause is not a loophole, it is the `mālum` apple / `malum` evil note, whose
whole subject is that the two differ only in vowel length — saying that
requires writing both.

**Why the prose half stops at three files.** `README.md`,
`docs/PEDAGOGY.md` and `tools/build-site.mjs` quote Latin headwords at a
reader. Sweeping every document instead was tried and rejected on
measurement: `docs/LAUNCH.md` says a Show HN post "dies" and
`docs/PRIVACY.md` says "your OS", which collide with `diēs` and `ōs` and
have nothing to do with the lexicon. Latin and English share too many
homographs for a general prose scan, and a gate that fires for two different
reasons gets ignored — the same reasoning that rejected the sitemap-date
gate. The seed TSV is excluded for a third reason: scanned as text it hits
its own singular/plural pairs (`manus`/`manūs`, `domus`/`domūs`), which are
not defects. Its two header-comment examples were fixed by hand.

**`index.json` not moving is correct, and the item expected otherwise.** It
records `entryCount`, `lemmaCount` and `bands` per pack and nothing else, so
a prose-only edit leaves it byte-identical and `writeStamped()` rightly keeps
its 2026-09-26 date. Only `en-la.json` moved, 2026-09-26 → 09-28, **4 fields
out of 7087**. The previous session's `lion` experiment moved `index.json`
because changing a mapping changes a count; a note does not. So "two files or
the fix regressed" should be read as "at most two".

**The URL slugs stay ASCII, and must.** `npm run site` still writes
`/latin/mille`, and a grep of `dist/site` for a bare *mille* finds four
pages. All four are the slug — `href="/latin/mille"`, the canonical URL, the
JSON-LD `url` — and in every one the *visible* link text is `mīlle`. Do not
"fix" these: the slug is the page's address, 16 087 internal links resolve
against it, and changing it after **B3** would strand indexed URLs.

**One consequence to know about, not a bug.** `<lastmod>` is pack-granular:
word pages take the `builtAt` of the pack behind them, so a three-note edit
to `en-la.json` redated **703 of 711** pages to 2026-09-28. This is the rule
PR #6 chose working as designed — a page whose pack genuinely changed today
may say so — and it is not the bug PR #6 fixed, which was every page claiming
today's date whether or not anything had changed. But it is coarse, and this
is the first edit to exercise it. If it ever matters, the finer date would be
per-entry and the pack does not carry one. Nothing to do before B3.

**The iCloud trap has a third location: `test-results/`.** `npm run test:all`
exited 1 with `Unknown system error -11 ... scandir
'test-results/.playwright-artifacts-0'` before a single e2e test ran; `ls`
on that directory returns `fts_read: Resource deadlock avoided`. Same fix as
`dist/`, same absence of a filename in the error when it is `dist/`.
`test-results/` is gitignored and Playwright regenerates it, so
`rm -rf test-results` is free. Worth adding to the pre-`test:all` clean.

**2026-09-28 — the demo was turned down to the default, because the argument
for keeping it up was a misdiagnosis.** The item called this a product
decision and reserved it for Creagh. It measured out as a fix, and the
measurement is the part worth keeping.

- **The "saturated at 35%" in the comment at `site/index.html:343` was not
  the ceiling. It was `MIN_APART`.** The two numbers coincide, which is how
  they came to be confused. With candidates at nearly every word, a
  two-word minimum gap lets you take at most every third one — about 33%,
  which reads as 35% and looks exactly like the escalation ceiling. The fix
  applied at the time was *two* changes at once: the passage was rewritten to
  spread the candidates out (which removed the real cap) and the constants
  were raised (which was unnecessary, and is what shipped the false promise).
  Measured on the passage as it stands: **23 candidates, 20 of them takeable
  under `MIN_APART = 2`** — an 87% headroom, so spacing cannot be mistaken for
  a 35% ceiling any more. Do not re-raise the constants for "slider feel"; the
  feel problem it was aimed at does not exist on this passage.
- **What the demo now reads,** against `weaveRatio` on `defaultSettings`:
  4% at rest, 13% at five minutes, 26% at twenty, **35% at forty and at the
  slider's maximum**. Eight distinct readings across the drag, so it is
  visibly live; the old constants gave fourteen. For comparison on the same
  passage, Taster gives three distinct readings — which is what a genuinely
  dead slider looks like, and is what the new saturation test was checked
  against to prove it can fail.
- **The guard is `tests/tools/demo-curve.test.ts`, and it is in
  `tests/tools/` on purpose.** It reads a file off disk, which `tests/core/`
  forbids, and `tests/dom/` builds its HTML in memory rather than loading a
  shipped artefact. It drives the real slider in jsdom — `runScripts:
  'dangerously'` is safe here because the only other `<script>` elements on
  the page are `application/ld+json`, which jsdom does not execute.
- **It counts candidates inside the `PASSAGE` declaration, not across the
  file.** The doc comment above it writes `{english|french}` to explain the
  notation, so a whole-file count returns 24 where the demo uses 23. That
  moved every expected percentage by one step and was caught only because the
  first (red) run printed them side by side. A later edit that "simplifies"
  that regex to scan the whole file will make the test wrong, not failing.
- **Folded in, and assumed to be in scope.** (1) The readout said `35% — 1
  word in 3`, where the denominator is *candidates*, not words on the page —
  the same units the extension's ratio uses (`selector.ts:38`, "proportion of
  *eligible* words"). Left alone it would have sat next to a passage visibly
  showing 8 French words in 148 and read as a broken counter, and the fix
  makes that starker rather than better, so it went in the same change: it now
  says `35% of content words — 1 in 3`, which is the phrase
  `src/core/settings.ts:64` already uses. (2) The caption now names the preset
  on show and says Committed and Monastic go further — the "label the demo"
  option from the item, which costs one sentence and is true either way.
- **Found and deliberately left.** `ORDER` in the demo lists 24 words but the
  passage has 23 candidates: `maison` is in the preference order and *house*
  is not marked in the passage (it sits next to `{old|vieux}`, so marking it
  would put two candidates adjacent). Harmless — an unused entry in a ranking
  — and deleting it would change a tracked file for no behavioural reason.
  Recorded so the next reader does not spend the twenty minutes working out
  why `maison` never appears.
- **Counts moved 633 → 636** (+3 tool tests, tool suites 4 → 5) in
  `CHANGELOG.md`, `CLAUDE.md`, `README.md`, `docs/SUBMIT.md` and
  `docs/LAUNCH.md`. The three surviving mentions of 633 — `CLAUDE.md:197`,
  and `TODO.md:88` and `:304` below — are **history and were left alone**: they
  record that the number was correct when it was checked, which it was. Same
  convention as the 1.0.0 changelog entry, which was corrected to 1.0.0 rather
  than to today.
- **What this does not settle.** Whether the *default* should be higher is
  still entirely open, and nothing here argues it either way. What has changed
  is that it is no longer urgent: no surface in the product now promises a
  number the default cannot reach, so raising the default would be a product
  improvement rather than the repair of a false claim. If it is ever raised,
  the demo follows for free — `demo-curve.test.ts` will fail and name the new
  figures.

**2026-09-28 — what `docs/LAUNCH.md` claims, and which claims were true.**
Every assertion in the file was taken one at a time and matched against the
file that would falsify it. Recorded here in full, because the expensive half
of this pass was the ~30 claims that turned out to be **right**, and nobody
should pay for that twice.

- **Verified correct, do not re-check unless the code moves.** All seven Old
  English examples, against `src/lexicon/packs/en-ang.json` — *hūs*, *cyning*,
  *hlāford* with its "loaf-keeper" note, and the four false friends *drēam*,
  *steorfan*, *sellan*, *cwic*, each of which carries the exact gloss the draft
  quotes. All six cited authorities, against `docs/THIRD-PARTY.md`: Lewis &
  Short, Whitaker's Words, Bosworth–Toller, Clark Hall, Hogg, Campbell. The
  Christensen 2007 citation, its DOI, and the draft's one-sentence summary of
  its finding, against `docs/PEDAGOGY.md:17`. Blair / BYU / 1970s. Latin *v*
  as /w/ and *c* always hard — 148 Latin surface forms contain a *c* and not
  one has a palatal or affricate IPA. Palatal diacritics do exist to be
  corrected: 78 Old English surface forms carry ċ or ġ. Letterforms really are
  a separate switch (`src/ui/options/sections.tsx:152`,
  `src/core/letterforms.ts:22`, which uses the draft's own *þēod*/*theod*
  example). The demo really is a paragraph and a slider
  (`site/index.html:109,112`). Retired words really are "woven for free and
  excluded from the budget" — that is `src/core/selector.ts:82` verbatim, and
  `:390`. Prefix-monotone selection, `src/core/selector.ts:21`. The reconciler
  page really does store text-node references and call `removeChild` on each
  (`tests/e2e/pages/reconciler.html:35,47`). Free tier is one language
  (`src/core/entitlements.ts:132`); seven packs ship. **633 tests** = 484 + 97
  + 16 + 36, which is the one number in the file and it was right.

- **The claim that cost the most to check is the one worth re-checking: the
  weave ratio.** `weaveRatio` is `base + (ceiling − base)·(1 − e^(−k·m))`,
  `k = gain/(ceiling − base)`. On the shipped default (Standard) that is 14.5%
  at five minutes, 31.3% at thirty, 33.2% at forty, hard ceiling 35%. Committed
  gives 53% at forty; Monastic 73.9%. Escalation only applies to *taxed* sites
  at all — `src/core/sites.ts:352`, `mode === 'taxed' && rule.escalate &&
  settings.attention.enabled` — which by default is the fifteen domains in the
  `social` preset, so "five minutes on an article costs you nothing" is about
  a page that never escalates and sits at the 6% base. That is why the
  correction was "almost nothing" and not a number.

- **Two Latin grammar claims were contradicted by the lexicon itself.** "Nouns
  are woven in the nominative singular" — 149 of 327 noun surface forms are
  nominative *plural* (*virī*, *fēminae*, *puerī*, *puellae*). Nominative
  singular is the **headword** convention (`src/core/types.ts:34`,
  `languages.ts:130`, `morphology: 'citation'`), not what lands on the page,
  and `tools/seed/lex-la.tsv:12` says "nominative singular **and plural**" in
  as many words. "Inflected English forms are skipped entirely rather than
  guessed" — 86 of 160 verb surface forms are present active participles
  matched to English *-ing* (*having* → *habēns*, *going* → *iēns*, *giving* →
  *dāns*). What *is* absent is past tense and third-person singular: `went`,
  `saw`, `gave`, `goes`, `says` are not keys in the pack. The "never guess"
  principle is real but lives on the provider path (`src/core/pos-guess.ts:11`
  — "silence is cheaper than that"), not in the shipped lexicon.

- **`pecus` → pecuniary was the wrong etymon.** The pack has *pecūnia*
  (money) → pecuniary; *pecus* is not in it at all. *Pecuniary* descends from
  *pecūnia*, which descends from *pecus*, so the draft skipped a link in the
  chain — in the post aimed at the one audience that would check. Replaced
  with the pack's own entry. *mille* gained its macron for the same reason: the
  pack's headword is *mīlle* and the draft's own preamble says the macrons will
  be checked.

- **Assumed, because nobody was available to ask.** (1) That correcting
  `README.md`, `docs/STORE-LISTING.md` and the `src/core/escalation.ts` doc
  comment was in scope, though the item named only `docs/LAUNCH.md`: it is one
  sentence with one defect in four places, the store listing is the copy that
  goes to Google, and the code comment is where the other three were copied
  from, so fixing the drafts alone would have left the error to be re-seeded.
  The `escalation.ts` change is a comment; no behaviour moved. (2) That the
  undefined reference should become the canonical `https://weft.study/...` URL
  rather than another placeholder — the sitemap already declares that URL and
  `src/core/pricing.ts` already compiles the domain into the shipped
  extension, so the repository has committed to it; **B1** now lists
  `docs/LAUNCH.md` among the files a domain change has to reach. (3) That
  reference-style Markdown links are simply wrong in this file, whatever the
  URL: every draft here is meant to be copied out of the document on its own,
  and a link definition left behind at the bottom is how this bug happened.
  Inline links only — which is what the Christensen citation already does.

- **Not done, deliberately.** The "costs about 150 lines more than declaring
  `<all_urls>`" estimate in the r/chrome_extensions draft was left alone: it is
  a counterfactual about code that was never written, it is hedged with
  "about", and there is nothing to measure it against. Lobsters' tag list and
  the community rules were left alone too — they are external, they change, and
  the document already tells the sender to re-check them.

**2026-09-28 — the sitemap dates pages by their content now, and omits the
date it cannot establish.** 713 URLs shared one `new Date()`; they now carry
four different dates, each read out of a file.

- **What each page is dated by.** Word pages: the newer of the two deep packs'
  `builtAt`, because every Latin page links to its Old English counterpart and
  back, so both lexicons are content for both sets of pages. Language indexes,
  descent hubs and the modern cognate hubs: their own pack. `/`:
  `site/index.html`. `/privacy`, `/support`: the Markdown behind them.
  `/pricing`: `src/core/pricing.ts` + `src/core/entitlements.ts`. `/install`:
  `tools/build-site.mjs` + `package.json` — the one page that names the
  generator, because its prose genuinely lives in `installPage()` rather than
  in a document of its own. An edit to a Latin gloss must not tell a crawler
  the privacy policy changed.
- **An unknown date is written as no `<lastmod>` at all.** The element is
  optional in the protocol, so absence is legal where today's date is a lie.
- **The shallow-clone trap is guarded twice.** `actions/checkout` fetches
  depth 1 by default and there every file's last commit *is* HEAD, so
  `git log` returns the same date for all of them — this bug with more steps.
  `site.yml` now sets `fetch-depth: 0`, and `tools/sitemap.ts` refuses to
  answer in a shallow clone (`git rev-parse --is-shallow-repository`). Note
  the failure mode if that line is ever removed: the five dates go *missing*,
  they do not come back wrong.
- **`tools/sitemap.ts` is TypeScript on purpose**, the only non-`.mjs` tool.
  `tsc` rejects a `.mjs` import from a `.ts` test with TS7016 — verified, not
  assumed — so a `.mjs` module could only have been tested through a whole
  site build. Node strips the types at run time, as it already does for
  `src/core/pricing.ts`, which `tools/build-site.mjs` imports.
- **`--out=<dir>` was added to the site builder first and alone**, the same
  seam as `build-pack.mjs`: without it, testing this tool means deleting and
  rewriting the `dist/site` that `npm run site:check` reads.
- **Considered and rejected: a `check-links.mjs` gate** failing when every URL
  shares one date. It would run in the site workflow, where the test suite
  does not — but in a shallow checkout it fires for an unrelated reason (doc
  dates absent, all packs built the same day), and a gate that means two
  things gets ignored. `tests/tools/build-site.test.ts` holds the guard, and
  CI runs it on the same push. Do not re-litigate without a reason that
  covers the shallow case.
- **The iCloud trap hit `npm run site` this time**, not `npm run validate`: a
  conflict copy of `dist/site/old-english 2/` killed the build with `Unknown
  system error -11 ... syscall: 'scandir'`. `rm -rf dist/site` first.

**2026-09-28 — `npm run packs` is reproducible, so CI can police the
lexicons now.** The stamp is kept when the content has not changed. A
`test:tools` suite and a CI diff step came with it.

- **The fix is a content comparison, not a deleted field.** `builtAt` still
  exists and still means what it says: `writeStamped()` in
  `tools/build-pack.mjs` parses the pack already on disk, compares everything
  *except* the stamp, and keeps the old date when the rest is identical.
  Deleting the field or freezing it to a constant would have been a smaller
  diff and would have thrown away the only record of when a lexicon was last
  touched.
- **Verified by watching it fail, in both directions.** The test has to
  simulate a day boundary, because two runs on the same day cannot expose a
  wall-clock stamp — they agree. So: build, rewrite the stamp to `2020-01-01`
  as though it had been committed then, build again, assert both the date and
  the bytes survived. Before the fix it failed with `actual: '2026-09-28',
  expected: '2020-01-01'`. The guard in the other direction — content really
  changed, so the stamp *must* move — passed before the fix as well as after,
  and is there to keep passing.
- **`--out=<dir>` is a seam, not a feature.** `tools/build-pack.mjs` wrote to a
  hardcoded `src/lexicon/packs/`, so any test of it would have dirtied the
  tracked packs — which is the bug under test. The flag was added on its own,
  before the fix, so the failing test could run against a temp directory.
- **The CI guard was verified by breaking a lexicon on purpose.** Changed
  `lion` in `tools/seed/lex-fr.tsv`, ran `npm run packs`, and
  `git diff --exit-code -- src/lexicon/packs` exited 1 — touching only
  `en-fr.json` and `index.json` and leaving the other six packs' dates alone.
  That per-file behaviour is what makes the CI diff readable: it names the
  language that moved instead of showing eight files every time.
- **One wrinkle: the comparison is against the file on disk, not against
  git.** Change a seed, rebuild, then revert the seed and rebuild again, and
  the stamp is left at today — because the file on disk really did change
  twice. `git checkout -- src/lexicon/packs/` is the fix, and is what was done
  here after the guard test above.
- **Deliberately not added: a line of output saying "nothing changed".** It was
  tempting, because the previous session had to compare mtimes to tell "ran and
  changed nothing" apart from "never ran". But the new CI step asserts exactly
  that and *fails* on it, which is the enforced version of the same signal; a
  second, unenforced copy in stdout would be surface without a guarantee. Do
  not re-litigate this without a reason the CI step does not cover.
- **`tests/tools/` is a third suite, deliberately not folded into
  `tests/core/`.** That glob would have picked the file up with no wiring at
  all, which is exactly why it does not live there: the core suite's documented
  virtue is that it does no I/O and needs no browser, and this test spawns a
  child process and writes files. `npm test` runs all three, so `test:all` —
  the gate — includes it without `test:all` itself changing.
- **Five documents' counts moved**, 617 → 620, `docs/LAUNCH.md:215` among them
  — inside the Hacker News draft, *again*. Twice in two sessions the same
  sentence has been wrong, both times caught by grepping for a number, which
  only finds the claims that are numbers. Hence the second item in Now: read
  it, do not grep it.
- **Found on the way, not fixed:** `tools/build-site.mjs:1237` stamps today on
  all 711 sitemap `<lastmod>` entries. Same bug class, worse consequence,
  first item in Now.

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
- **The 1.0.1 entry said out loud that it was not cut**, because `VERSION`
  was still 1.0.0 and `tools/release.mjs` does not touch `CHANGELOG.md` — it
  writes `RELEASE-X.Y.Z.md` — so the two could not fight when the bump
  happened. ~~Still 1.0.0.~~ **Superseded 2026-09-29: the bump landed, and
  the sentence written to be honest then was false the moment it did.** The
  entry now reads "cut, not tagged". Worth keeping as a shape: a caveat that
  records a temporary state is a thing to go back and delete, and the commit
  that makes it false is the one that has to.

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
