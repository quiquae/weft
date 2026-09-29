# TODO: weft

<!-- The running state of this project. Any session, on any account, in any
     tool, reads this to find out where things stand. Newest notes at the top
     of Notes; the list itself stays in the order work should happen. -->

**State on 2026-09-29:** every automatable check is green, measured at the end
of this session — typecheck clean, **486** unit / 122 suites, **98** jsdom / 22
suites, **35** tool tests / 11 suites, **36** e2e passing
with 3 asset-generator specs skipped by design, compat clean, all three
packages built at 979 KB and passing `npm run validate`, `packs:verify` 0
errors / 4 warnings, **711** site pages with **16 087** links all resolving.
`npm run test:all` exits 0 end to end. **The store-asset generator was never
broken and the listing art was stale, as of 2026-09-29** — the recorded
failure was a *production* `dist/chrome` on disk, the generator passes in
~45 s, and run by hand it reported that three of the fifteen shots showed
pre-PR-#12 copy that does not ship; those three are regenerated and the
fixtures now refuse a production build in 5 ms rather than blaming the
renderer for 20 s. **And as of 2026-09-29 the generator is genuinely
reproducible** — two consecutive runs produce all **18** files in
`docs/store/` byte-identical, hashed and diffed. That sentence was in this
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
byte of content. **Now and Next are both empty.** The code is not what is
holding the release up. The critical path is now **B0 step 2 — cut 1.0.1** (a
version bump, landable by any session on a branch; the *tag push* is B2 and is
outward-facing), and then **B1 — the domain `weft.study` is not registered**,
which only Creagh can do.

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

- [ ] **An export carries three stores that an import silently drops.**
      Found 2026-09-29 while looking for a way to seed attention for the
      progress screenshot, which is how the asymmetry surfaced: there is no
      way. `exportAll()` (`src/background/storage.ts:322`) writes `settings`,
      `cards`, **`attention`**, **`introduced`** and **`lock`**.
      `importAll()` (`:359`) reads `settings` and `cards` and ignores the
      other three without comment or warning — it returns
      `{ ok: true, message: 'Imported settings and N vocabulary records.' }`,
      which is true about what it did and silent about what it discarded.

      Why it matters beyond tidiness: data export is on the never-gated list
      (`tests/core/entitlements.test.ts`), and the reason that list exists is
      that a user must always be able to leave with their data. Someone
      moving machines gets their vocabulary and settings and loses their
      whole attention history, their streak, and the cooldown state — and
      the last of those is the interesting one, because `lock` is what makes
      a commitment stick. Restoring it is not obviously right (importing a
      *shorter* cooldown would be a difficulty reduction, which the lock
      path exists to refuse) and neither is dropping it in silence.

      Three shapes, no preference recorded because this is a judgement about
      what an import *means*: (1) import `attention` and `introduced`, leave
      `lock` alone, and say so in the result message; (2) import all three,
      running `lock` through the same cooldown path as any other change so a
      forged easier state cannot land — `importAll`'s own doc comment
      already claims this is how settings work, so the machinery exists;
      (3) keep the behaviour and make `exportAll` stop writing fields
      nothing reads. Shape 3 is the cheapest and the worst — the export is
      also what a user attaches to a bug report, and attention history is
      the most diagnostic thing in it. Guard belongs in `tests/core/`, which
      can round-trip `exportAll` → `importAll` with no browser.

      **Check the existing coverage before assuming it is uncovered by
      accident.** `tests/e2e/friction.spec.ts:344`, "a round trip keeps the
      vocabulary and re-signs it", is under the heading *taking your data
      with you* and looks like the test that would catch this. It seeds two
      cards, exports, and asserts the **cards** survive and are re-signed.
      It never writes attention, `introduced` or `lock` before exporting, so
      the three fields that get dropped are never in the payload it checks —
      the same shape as PR #14's guard, which could not see `novem` because
      it filtered on notes that exist. The name is the only thing that
      overpromises; widen the seed, not the heading.

Otherwise empty. Everything remaining lives in Blocked: B0 step 2 does not
need Creagh and is the next thing any session should pick up; B1 onwards do.

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

**B0 — Step 1 is done: the stack is on `main`. Step 2, cut 1.0.1, is not.**
*Blocks the version bump, and nothing else.* **Step 2 does not need Creagh and
is the next thing any session should pick up.**

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

Remaining, in order:

1. **Cut 1.0.1.** `npm run release -- --version=1.0.1` refuses a dirty tree,
   runs the tests first, bumps `VERSION` in `manifest.config.mjs`, keeps
   `package.json` in step, rebuilds, packages all three targets and writes
   `RELEASE-1.0.1.md`. It stops before committing and prints the `git tag` /
   `git push --tags` lines. **This does not need Creagh** — it is a commit that
   edits two tracked files, so a session can do it on a branch and open a PR.
   What needs Creagh is the *tag push*, which is step 3 below and lives in B2.
2. Re-run the whole gate on the bumped tree: `npm run test:all`, **plus**
   `npm run packs:verify` and `npm run site:check`, which `test:all` does not
   include. Paste the result into the Journal in `CLAUDE.md`. That is the gate
   `docs/SUBMIT.md` names as the thing nothing below should be attempted
   without.
3. Do **not** push the tag. That fires `.github/workflows/release.yml`, which
   publishes outward. The tag push belongs to **B2**, which is where the
   repository also becomes public — a release whose download button 404s is
   worse than no release.

*Step 1 took ~40 minutes, most of it the gate. Steps 1–2 above, ~30 minutes.
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
