# Changelog

## 1.0.1

Cut 2026-09-29: `VERSION` in `manifest.config.mjs` is 1.0.1 and `package.json`
is in step. **Not tagged and not published** — pushing `v1.0.1` fires
`.github/workflows/release.yml`, which publishes outward, and it waits on the
repository becoming public (B2 in `TODO.md`), because a release whose download
button 404s is worse than no release. This is everything on `main` after the
`v1.0.0` tag of 2026-09-19, which the published release does not contain.

**An import kept half of what an export carried, and let the other half
through a door that was supposed to be locked.** `exportAll` writes settings,
vocabulary, attention, today's introduced words and the cooldown state;
`importAll` read the first two, discarded the rest without a word, and
reported success. Moving to a new machine therefore cost you your whole
reading history, your streak and every progress tile, and nothing said so.
Attention now merges in — by the larger of each day rather than the sum, so
importing the same file twice is importing it once — along with today's
introduced words. Cooldowns, panic passes and tamper history deliberately do
not travel: every one of them is a difficulty *reduction* when it arrives
from a file you can edit. The import now says which of those it did.

The larger fix is in the same function. Imported settings were written
straight to storage, though the code claimed in writing that they "still
[had] to pass the cooldown". They did not, so an exported JSON file with one
number changed could switch the attention tax off, drop the maximum density
or shorten the cooldown that governs both — a complete bypass of the
commitment layer. An imported file is now split the way the options page
already splits a change: harder and cosmetic settings apply at once, anything
easier waits out the cooldown you configured.

**Silence was the failure state.** `boot()` has six early returns and three
of them were failures a reader could not see: the worker did not answer, the
page was already in the language they are learning, or the lexicon would not
load. In each case they switched Weft on, the page looked entirely normal,
and nothing said why — indistinguishable from a broken extension. The
content script now records why it declined and the popup shows it.

**A support path that transmits nothing.** Settings gained a Help section
that assembles version, browser, renderer, density, cooldown and counts into
a diagnostic report: counts and settings, never content — how many sites,
not which; how many words, not which; which tier, never the key. Built
locally, shown in full before it can be copied, and sent nowhere. The leak
test asserts against real secret values planted in the input rather than
against a list of field names, so a future field whose contents happen to
include a key fails immediately.

**French has etymologies.** It had none — 0 etymons and 0 notes across 587
entries, against Old English's 544 and 126 — which is why the tooltip's
"you already know this" line and the discoveries feed were blank for the
most mass-market language in the product. `tools/seed/fr-cousins.tsv` adds
18 descents and 99 notes, keeping descent (English took the word from
French) apart from cousinhood (the two share a root, almost always Latin,
and the English relative is a different word) rather than letting the feed
state falsehoods.

Its first version stated twenty-nine. Checked line by line against
etymonline and Wiktionary, twelve of its thirty descents paired an English
word with its French translation and called the translation its source:
*money* is Old French *monoie*, not *argent*; *answer* is Old English and
*gift* Old Norse; *rich* was never borrowed at all. Eight notes named the
wrong root — *tête* is from *testa*, not *caput* — and nine said a French
word was "the root of" an English one that English took straight from
Latin or Italian, *cheval* and *cavalry* among them, which the landing page,
the README and the store listing all quoted in the paragraph warning against
exactly that confusion. A descent also tells the word selector the word is a
cognate, so the false ones doubled *argent*'s cognate score and took
*cadeau*'s from nothing to 0.7 — and the first time a reader met *argent*,
the tooltip introduced it as "ancestor of English “money”". Every claim now
names the dictionary entries it was checked against, and the merge refuses
one that does not.

**Twenty-seven Old English descents were not true as stated.** The word
pages, the tooltip badge and the feed say an Old English word "became" an
English one, and all 330 such claims were then read against etymonline.
Sixteen paired the English word with its Old English translation: *window*
is Old Norse *vindauga*, which replaced *ēagþȳrel*; *egg*, *gift*, *weak* and
*wassail* are Norse too; *lion* and *ire* came from French; *sad* is *sæd*,
"sated", not *unrōt*. Eleven named a compound or a derivative as though it
were the word itself — *gospel* for *spell*, *bishopric* for *rīċe*,
*hundred* for *hund*. Twenty-one are gone and six now name the real
descendant: *spell*, *shadow*, *morn*, *numb*, *former* and *lich*. *drēam*,
which the landing page led with, still meant joy and music, but "much study
has failed to prove" it became *dream*, so Weft no longer says it did. Notes
a dictionary contradicted were rewritten with them: *warden* and *guard* are
cousins of *weardian*, not its descendants, *bleak* is Norse, and "many a
mickle makes a muckle" is a corruption of "many a little makes a mickle".
Every Old English etymon now names the entry it was checked against, and the
tests refuse one that names none.

**Five Latin notes did not survive a dictionary.** A note is the sentence
under a woven word, and all 28 Latin ones were read against Lewis & Short,
Allen & Greenough and etymonline. The first row of the pack called *virī* a
"third-person plural" — person is a verb's, and *virī* is the plural of a
noun — and now says what the word is: a man as opposed to a woman, and often
a husband, where a human being is *homō*. The collarbone was "named for its
key-like shape", where etymonline has it "so called supposedly from its
function" and the bone is medieval Latin's *clāvicula*, a little key, which
is all the note says now. Jenner "named the vaccine", where the dictionaries
credit him with *vaccination* and with the Latin for cowpox, so the vaccine
is simply named after the cowpox he used — on the landing page too, which
quoted it. Latin had "no bare word for yes", where the grammar says no one
word in common use and Lewis & Short gives *ita* as yes in replies. And "a
little shade" under *umbra* described *umbella*: with the etymon line
switched off, it glossed the wrong word. *ita* was also listed as the
ancestor of an English "ita vero", which is Latin: the tooltip badge, the
word page's sentence and a cognate score of 0.96, which told the word
selector a reader half knew it already, are gone. Every Latin note now names
the entries it was checked against, and the tests refuse one that names
none, or that gives a noun a verb's grammar.

French now leads the landing page, the README, the social card and the store
listing; the Latin and Old English section stayed, reframed. The Chrome
marquee tile kept the four words the social card had dropped — one French,
two Old English, one Latin — because it kept a list of its own; it shows the
card's four French pairs now, and both read them from one place.

**A toolbar icon drawn per size.** At 16px the warp threads were 1.36px of
pale blue at 85% opacity on fractional coordinates, so the mark dissolved
into four smudges and a bar at the only size it actually lives at. The
geometry is now a function of size, and the 128px artwork sits inside the
16px of transparent padding Chrome documents rather than bleeding to the
edge. The same redraw made the weft cross every warp thread but the last,
where it had crossed two of the four — and that reached only the rasters at
first. The mark was also written out by hand as SVG in
four tools and the landing page, so the vector icon, the favicon, the header
of every site page, the social card, both Chrome tiles and the Edge store
logo went on showing the old one, with every generator reproducing its
committed output exactly. All of it is drawn from one geometry now,
`tools/brand.ts`, and `tests/tools/brand.test.ts` reads the mark back out of
every committed image of it and fails on one whose weft crosses the wrong
number of threads. The shipped icons are held more tightly still: the test
draws each one again and requires the committed file to hold exactly those
pixels, and each vector exactly that text, so a geometry edit nobody rebuilt
fails by name. Decoded rather than diffed, because a PNG's bytes depend on
the zlib Node was built against and its pixels do not.

**`/privacy` and `/support` exist.** `SUPPORT_URL` is compiled into the
shipped extension and rendered as a button on the help page, and it pointed
at a page nobody had written; the Chrome Web Store will not accept a
submission without a live privacy policy. Both are now rendered from
`docs/PRIVACY.md` and `docs/SUPPORT.md` through the same template as every
other page, so the published page and the document in the repository cannot
drift. `npm run site:check` now fails the build if `SUPPORT_URL`,
`PRICING_URL` or `/privacy` has no page behind it. Writing the page found
the policy wrong: its permission table still listed `idle` and
`unlimitedStorage`, neither of which the manifest declares.

**`npm run packs` no longer rewrites every lexicon it reads.** It stamped
`builtAt` with today's date, so all eight files under `src/lexicon/packs/`
changed on every run whether or not a seed lexicon had moved — which left a
fresh clone dirty after the setup step the README prints, and `npm run
release` refuses a dirty tree. The stamp is now kept when nothing else about
a pack has changed, so it says when the content was built rather than when the
command last ran. That makes the generator reproducible, which in turn lets CI
rebuild the packs and diff them: a `tools/seed/*.tsv` edit that was never
rebuilt used to ship the old words with every check green.

**The sitemap dated all 711 pages by the clock.** `<lastmod>` was `new Date()`
for every URL, so each deploy announced that all ~700 word pages had changed
that morning — and the site workflow rebuilds on every push. Search engines
use the field only while it is verifiably accurate and otherwise ignore it, so
the effect was to throw away the signal the 711-page lexicon exists to earn.
Each page is now dated by the content behind it: the word pages by the
`builtAt` of the lexicon pack they are generated from, the five hand-written
pages by the commit date of the document holding their prose. Where no date
can be established the element is left out rather than filled in, because
`<lastmod>` is optional and an absent date is honest where today's is not.

**The listing said half and the extension does a third.** "Forty minutes on
an infinite feed and you are reading half in French" was the product's
headline promise, in the README, the store listing, the launch drafts and the
doc comment the other three were copied from. It is not what ships: the
default is the Standard preset, whose ceiling is 0.35, so forty minutes of
attention gives 33.2% and half is unreachable at any attention at all. Half is
the **Committed** preset, which is opt-in. Every copy now says a third.

**And the live demo said sixty.** Its curve was base 0.06, ceiling 0.62, gain
0.045 — not any shipped preset — so a visitor dragged the slider to forty
minutes, watched the passage go 60% French, installed, and got a third. It now
runs the Standard preset's own constants and reads 35% at the ceiling, which is
what a fresh install does. The reason it had been turned up does not survive
measurement: an earlier, denser passage saturated because the minimum-gap rule
capped it near 35%, which is also the escalation ceiling, and the two were
confused — spreading the candidates out had already removed the cap, and 20 of
this passage's 23 are takeable. `tests/tools/demo-curve.test.ts` drives the
slider in jsdom and compares every readout against `weaveRatio` on
`defaultSettings`, so a static page with no build step cannot drift from the
product again. The readout said "1 word in 3" where it meant one *content* word
in three, which is the denominator the extension's own ratio uses; it now says
so, and the caption names the preset on show.

**The launch drafts were read against the code instead of grepped.** The one
file in the repository whose errors leave it had six of them, and not one was
a number: an undefined Markdown reference where the r/latin draft links to the
Latin descent table, so it would have pasted into Reddit as literal brackets;
two claims about Latin morphology that the shipped lexicon contradicts — 149
of 327 noun forms are nominative plural, and 86 of 160 verb forms are
participles matched to English *-ing*, where the draft said singular-only and
inflections-skipped; `pecus` given as the etymon of *pecuniary*, which
descends from *pecūnia*; a missing macron on *mīlle*, in the draft whose own
preamble says the macrons will be checked; and two file paths that do not
exist.

**Two more fixes to the tools rather than the product.** The lexicon verifier
had destructured six of its eight columns, so Old English's 544 etymons and 126
notes had never been checked by anything at all. And `npm run verify:release`
downloads what GitHub actually serves, loads it in a real browser, and checks
the first-run page renders, the worker answers and no test seam shipped —
everything else in the repository tests what the build produces.

**One Latin word, spelled two ways.** The lexicon marks vowel length, because
the IPA is generated from the orthography and is only deterministic once it is
marked: the headword for a thousand is `mīlle`. But the tooltip note sitting
under it read "a mile was mille passūs" — the same word, one line apart,
without its macron — and that bare spelling had also reached the Latin landing
page's published meta description, `README.md` and `docs/PEDAGOGY.md`. Nothing
generates that prose from the lexicon, so nothing could notice.
`tests/tools/lexicon-orthography.test.ts` now checks both halves: a pack note
may not spell its own headword without the macron, and the three documents
that quote Latin headwords at a reader must spell them the way the pack does.
Writing the guard before the fix found two more instances that a search for
*mille* could not have — `spēs` in the note under *hope*, and `rēx` in the
sentence explaining why a nominative headword drops cleanly into an English
frame.

**Two more surfaces said "1 word in N" with no unit.** The demo's readout
did too, until "And the live demo said sixty" above; the popup and the
options page's density rows still did, because both build that string from
the same `oneWordIn()` function. The ratio behind it is a proportion of
*content* words, not of everything on the page, and the popup's own
sentence — "1 word in 3 you could read is in French" — read as a claim about
all of it. Both now say "of the content words", matching the demo and the
phrase `src/core/settings.ts` already used for the Standard preset. Checked
in a real Chromium build rather than assumed safe, since the popup is a
genuine 340×330px surface and the options page's value badges do not wrap:
no overflow at any ratio from 6% to 60%.

**312 Latin word pages stated their descent backwards.** Every Latin page
carrying an etymology opened "This is the Latin word your English borrowed
from **November**" — which says English took *novem* from *November*, the
descent the wrong way round, in the one sentence a reader arriving from a
search result reads first. The frame ended in a preposition and the builder
appended the descendant after it, where "from" captured it and gave it the
source's role; the Old English sibling, "the Old English word that became
X", takes its object at the end and was right on all 325 of its pages. The
Latin frame is now split around the descendant — "This is the Latin word your
English **November** was borrowed from" — keeping *borrowed*, which is the
accurate verb for a learned borrowing where *became* is not. A guard reads all
637 rendered word pages and fails on any frame that hands the English word to
"from".

**Three listing screenshots showed copy that does not ship.** The
`*-05-settings.png` the store submission uploads still read "60% — 1 word in
2", the unqualified phrasing "Two more surfaces said '1 word in N'" above
replaced; the options page a visitor installs says "60% of content words — 1
word in 2". That change regenerated the documentation screenshots and not the
store ones, and the check that would have caught it was itself broken: the
generator had been recorded as failing, so its report that four of the fifteen
shots were stale was never read. It was not failing. Run by hand rather than
through `npm run test:e2e`, it drove a *production* build of the extension —
which grants no localhost origin, so no content script registers and nothing
is ever woven — and spent twenty seconds waiting for a woven word before
blaming the renderer. The fixtures now refuse a production build in five
milliseconds and name `npm run build:test`, which is the whole of the fix for
all three hand-run generator specs.

**The progress screenshot was photographing the clock.** Four of its five
tiles are seeded through the real import path; "taxed attention today" was
not, and read whatever attention the run itself accrued — `9s` once and `6s`
another time, two legitimate outputs of the same code 303 bytes apart. So
"the shots came back byte-identical" could not mean anything for that scene,
and a stray 126 711-byte `apple-04-progress.png` on an abandoned branch had
been written up as work nobody could account for when it was simply the `6s`
render. Attention is now seeded at thirty minutes — the figure the listing's
own copy uses for half an hour on a feed — which `formatDuration` prints as
whole minutes, so anything the run adds on top is absorbed.

**The discoveries feed reshuffled itself between renders.** Seeding the clock
was not enough, and the claim that followed it — two consecutive runs produce
all fifteen shots byte-identical — was not true when it was made. Re-measured,
all three `*-04-progress.png` still differed run to run: 4416 pixels, in which
*montagne* and *forêt* had swapped places. `buildDiscoveries` sorted by kind
and then by recency, and words first met in the same millisecond — which is
what a bulk import gives, and what two words woven into one render give — tie
on both, so the order fell through to however the storage round-trip happened
to hand the cards back. One vocabulary could render twice and disagree with
itself. The feed already refused to reshuffle its *wording* between visits;
the sort now finishes with the word itself, compared with accents folded away
so that *père* sorts before *pierre* without asking the runtime's locale data
what it thinks. Measured after the fix: two consecutive runs produce all
fifteen shots byte-identical, which is the first time that sentence has been
true.

**Nothing looked at generated artefacts, so they went stale in silence.**
Three times running, a session found a committed generated file the tree had
moved past: a version bump left `docs/SUBMIT.md` naming five zip filenames
that no longer existed, `RELEASE-1.0.1.md` lists a `git log` that every later
commit makes wronger, and the listing screenshots stopped matching the
options page one commit after being declared current. Each was found by
somebody noticing, because the sweep this repository does every session
greps for test totals and an artefact has no total. `npm run artefacts:check`
is that sweep. It asks provenance rather than content — has anything this was
generated from been committed since it was last written — because the content
question is unanswerable here: screenshots rendered on macOS will not
byte-match ones rendered on `ubuntu-latest`, and release notes listing a
`git log` cannot match their own tree, since the commit that lands them does
not exist until after the merge. It found four stale groups on a clean
`main`, two of which nobody knew about: the documentation screenshots were
five commits behind `src/` and the first-run walkthrough eight. Deliberately
outside `test:all`, because nearly every change touches `src/` and a gate
that is usually red is a gate nobody reads; it is wired into the submission
runbook instead, at the two steps before something irreversible.

**Built with** 800 tests: 527 unit, 98 in jsdom, 139 over the build tools, and
36 end-to-end in a real Chromium with the extension loaded. Three further
end-to-end specs are defined and deliberately skipped; they generate assets
rather than assert anything and run behind `WEFT_STORE=1`, `WEFT_SCREENS=1` and
`WEFT_FIRSTRUN=1`. The lexicons are 584–588 entries across 579–583 surface
forms per language, 654 KB for all seven.

## 1.0.0

First release.

**Reading.** Weaves a proportion of the words on a page into a language you
are learning, using the diglot-weave method, and raises that proportion with
measured attention on the page. Point at a word to get the English back, with
part of speech, gender, pronunciation and — for the historical languages —
the English word it became.

**Seven languages.** French, Spanish, German, Italian, Portuguese, Latin and
Old English. 356 checked English lemmas per language, 584–588 entries across
579–583 surface forms, 644 KB for all seven. Latin and Old English carry
etymological descent, IPA derived from the orthography, and the false-friend
notes.

**Difficulty.** An exponential-approach curve from a resting density to a
ceiling, driven by attention counted only while the page is visible, focused
and being interacted with. Words already on screen are pinned, so rising
difficulty only ever adds.

**Memory.** FSRS-6, ported from the reference implementation. Words about to
be forgotten come back; words genuinely learned are left in the target
language permanently and stop counting against the page's difficulty.

**Commitment.** Anything that makes Weft easier waits out a cooldown that is
stored rather than scheduled. Optional quiz gating drawn only from words
already seen. A rate-limited panic pass. An optional Hard Mode that generates
a browser managed-policy profile.

**Privacy.** No account, no server, no telemetry. Works offline. Installs with
no host permissions at all; site access is granted per-origin from the
first-run page. A shipped never-weave list covering money, mail, credentials
and health, checked before anything else.

**Pro.** Every language at once, a different language per site, Hard Mode,
bring-your-own-key translation for unlimited vocabulary, phrases, the full
history, quiz gating and custom word lists. Licences are signed files verified
locally — no activation server.

**Built with** 602 tests: 470 unit, 97 in jsdom, 35 end-to-end in a real
Chromium with the extension loaded.
