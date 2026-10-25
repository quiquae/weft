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

**Thirty Latin pronunciations were wrong.** The tooltip, each word page and
its meta description print IPA for every Latin word, derived from the
spelling, and no test checked the derivation. Seven words spelled
with *qu* were stressed on the wrong syllable — *quīnque*, a word of two, on
its last — because the stress was counted on a reading of the word that took
the *u* of *qu* for a vowel. *cāseus*, *calceus* and *caeruleus* were each a
syllable short, given an *eu* diphthong where Lewis & Short marks the *e*
short, and *iūsiūrandum* a syllable long, its second *i* being the consonant
that begins *jūrandum*. Nineteen more put the stress mark before every
consonant since the last vowel: *persōna* was /pɛˈrsoːna/, and is
/pɛrˈsoːna/. All thirty are regenerated, and the tests now work out every
Latin word's syllables and stress from its spelling, by Allen & Greenough's
rules, and refuse a transcription that disagrees.

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

**And it said nothing about two words whose story it had.** A card is a
target word and the pack has a row per English gloss, so *argent* is *silver*
and *money* and *fille* is *girl* and *daughter* — and their claims sit on the
money and daughter rows, while the progress page read every word from its
first row. The feed, the vocabulary list, the quiz and the site now read a
card back through one lookup, which takes a word's story from another of its
rows when its own carries none, and leaves the gloss where it was. Only from a
row of the same part of speech: Old English *hund* is a dog and a hundred, and
a claim about one is false of the other.

**And three of those words were two words each.** Old English *hund* is a dog
and a hundred, *earm* an arm and poor and *rīċe* a realm and rich, and each
pair shared one memory card, because a card was keyed by the spelling alone.
So a reader who met *hund* as "hundred" was told it survived into English as
*hound*, was asked "dog" for it in the unlock quiz, and was scheduled as though
meeting the number had been meeting the animal — and *rīċe* → *rich*, a checked
descent, was on no page of the site. The second word of each is now a word of
its own, with its own card, gloss, quiz question and page, and the quiz never
offers one word of a spelling as a wrong answer to the other. Nothing on
screen marks them apart but the gloss. A card you already have for one of the
three stays with the first word, which is the one it was always shown as.

**And Latin was told as though English descended from it.** The feed chose its
verbs by whether a language is still spoken, so Latin, being dead, was told in
the ones written for Old English — "rēx survived into English as regal",
"English aquatic comes straight from aqua", "camera has not changed in a
thousand years" — on 232 of the 314 lines its pack can print. English borrowed
those words, often through a derivative or through French, which is what the
Latin pages of the site have always said. The verbs now follow whether English
descends from the language: Old English keeps them, and Latin is told the way
French is, in the verbs of borrowing.

**Twenty-seven Latin etymologies were not true as stated.** Every Latin word
page names the English word borrowed from it, and so do the tooltip and the
feed, and nothing recorded that any of the 319 had been looked up. All were
read against etymonline, English Wiktionary where it has no entry, and Lewis
& Short. Fourteen named a cousin or no English word at all — *ludicrous* is
from *lūdere*, beside *lūdus*; *very* is from the adjective *vērus*, not the
adverb *vērē*; *capricious* is of uncertain origin; *semper fidelis* is a
motto — and now name nothing. Thirteen now name the word that did come from
the headword: the door *iānua* gave *janitor*, where *January* is from
*Janus*; *flūmen* gave *flume*, *gaudium* *joy*, *ruber* *rubric* and
*meminisse* *memento*. Each claim names the dictionary entry it was checked
against, and one that names none fails the build.

**And the tooltip still called Latin an ancestor.** The badge under a woven
word chose its noun the way the feed once chose its verbs, by whether the
language is dead, so each of 300 Latin words was "Ancestor of English"
something English borrowed — "Ancestor of English vaccine". The line above
it, which says why the word was chosen, called every language's etymon an
ancestor, so the Edge listing's own screenshot showed French *rivière* as
"New to you, and ancestor of English “river”" over a badge reading "Related
to English river". Both now say "ancestor of" only of Old English, and
"source of" of every language English borrowed from.

**And the note under *iānua* still talked about January.** Once the door
*iānua* named *janitor* rather than *January*, its note — "Janus, god of
doorways, gave January its name", which is true — read as an aside beside
it, in the tooltip, on its word page and in the site's table of Latin words
in English. It now names the word in between: "a iānitor kept the iānua",
the *iānitor* being Latin's doorkeeper and the source of the English word.

**The pronunciation keys said what the transcriptions above them did not.**
A historical language has no voice to play, so the tooltip shows a short key
to its spelling instead, and every Latin and Old English word page on the
site printed one too. The Old English key gave rules for bare letters — *c
before front vowels is "ch"*, *g before front vowels is "y"*, *sc is "sh"* —
over transcriptions that did otherwise: *cyning* /ˈkyniŋɡ/, *beginnan*,
*fisc* /ˈfisk/. What the transcriptions follow, without an exception, is the
dots printed on the word, and the key never mentioned them; it says now that
ċ is “ch”, ġ is “y”, sċ is “sh” and cg is “dg”. The Latin key said *ae* was
/ai̯/ above ten words transcribed /ae̯/, and says /ae̯/. The site printed its
own copy of each key, which had drifted from the extension's; it prints the
extension's now, and both are tested against the lexicon they describe.

**And the line saying why a word was chosen did not always parse.** It
gives its reasons as "Chosen because …", and every reason is a clause — "it
is due for review" — except the one about English: a word's likeness to its
English was a phrase, written for the line that greets a new word, so the
tooltip said "Chosen because ancestor of English “house”, and it is due for
review". It says "Chosen because it is the ancestor of English “house”"
now, and "it is the source of English “vaccine”", "it is near-identical to
the English word" and so on; the greeting, "New to you, and source of
English “vaccine”", keeps the phrase it was written for.

**And French *mort* is two words too.** It is death, from Latin *mors*,
and dead, from *mortuus*, and English Wiktionary gives the two separate
etymologies, as it does Old English *hund*'s. They shared one card, so a
reader who met *mort* only as "dead" saw "mort — death" in the vocabulary
list, was asked "death" in the quiz, and was scheduled as though meeting the
adjective were meeting the noun. Dead is a card of its own now, with its own
schedule and question; every card a reader already had for *mort* stays
death.

**Six Old English pronunciations were wrong.** Old English stresses the
first syllable of a word's root, so its transcriptions can only go wrong
where a word begins with a particle the language left unstressed, and nothing
had checked them. *tōdæġ*, *tōmorgen* and *tōgædere* were stressed on *tō*,
where Wright's *Old English Grammar* (§15) gives "tōgǽdere, together" its
stress on the noun, and *tōgædere*'s *g* had the sound it has between two
vowels, where it begins *gædere* and is hard, as in *good*. *andswaru*,
*onsīen* and *ēagþȳrel* voiced the *s* or *þ* that begins their second
element — /ˈɑndzwɑru/ — where that voicing "only took place in simple words,
but not in compounds" (§261). All six are corrected, *tōdæġ* to /toːˈdæj/
and *andswaru* to /ˈɑndswɑru/, and the tests now read every Old English
word's stress and voicing from its spelling by Wright's rules, refusing a
word that begins with a particle when nothing says whether it is compounded
of it.

**And six gave a *g* the sound of the *g* in *good* where the grammar has a
spirant.** An Old English *g* written without a dot is the guttural one, and
it was transcribed as a stop wherever it did not stand between two vowels.
Wright makes it the voiced spirant inside a word after *l* or *r* as well —
"beorgan … folgian, to follow … swelgan" (§320) — and voiceless at the end of
one after them, where late Old English writes "beorh, hill; burh, city"
(§323). So *folgian*, *morgen* and *tōmorgen* are /ˈfolɣiɑn/, /ˈmorɣen/ and
/toːˈmorɣen/, *beorg* and *burg* /ˈbeorx/ and /ˈburx/, and the *g* that ends
*ēagþȳrel*'s first element, before its *þ*, is /x/. The tests now read every
undotted *g* by Wright's rules, and refuse one the grammar makes palatal;
the four the pack had are dotted now, below.

**Eleven Old English words take the dot the grammar gives them, and the
cards for them move with them.** The Old English pack dots a palatal *c*,
*g* and *sc* and pronounces what it dots, and eleven words it wrote bare have
the palatal sound in Wright's grammar and English Wiktionary alike: *sēċan*,
*tǣċan*, *þenċan* and *wyrċan* (§311), *fisċ* and *flǣsċ* (§312), and
*twēġen*, *wīġ*, *huniġ* and *ǣġhwǣr* (§§320, 324), with *nēahġebūr*, whose
*gebūr* is the prefix *ġe-*. So *sēċan* is /ˈseːtʃɑn/, not /ˈseːkɑn/, and
*wīġ* /ˈwiːj/. A word's spelling is its card's identity, so the dots alone
would have stranded every review a learner had for these words under a
spelling nothing reads any more; the extension now records the old
spellings and moves those cards, their whole history with them, when it
next loads them and when an export written before the change is imported.
*āscian* and *āscung*, which a literal reading of §312 would dot too, stay
as they were: Wright's own note gives *axian* beside *ascian*, Wiktionary
writes them undotted, and English kept *ask*.

**And *hūsbonda*'s *s* is not voiced.** The voicing of *f*, *s* and *þ*
between voiced sounds stops at a compound's seam, and nothing had decided
which side of the seam a fricative that *ends* the first element falls on.
Bülbring's *Altenglisches Elementarbuch* (§474) voices it only in a compound
that has grown into one word, and Luick's *Historische Grammatik der
englischen Sprache* (§639) names *husband* as a word taken in during the
tenth or eleventh century, after that voicing had run its course, whose *z*
arrived later by assimilation. So *hūsbonda* is /ˈhuːsbondɑ/, not
/ˈhuːzbondɑ/. *wīfmann* keeps its /v/: it grew into late Old English
*wimman*, and Sievers counts that among the changes only a voiced *f* makes.

**And *wīfmann* is masculine.** The Old English for *woman* was marked
feminine, in the tooltip and on its page. It is a compound of *mann* and is
declined as *mann* is: Bosworth–Toller has "wíf-mann … es; m. (but seó
wífman occurs)", and Sievers and Wright list it among the masculines. Nothing
had checked an Old English gender before; every noun's has now been read
against English Wiktionary and, where Wiktionary was not enough,
Bosworth–Toller, and *wīfmann* was the only one of 178 that was wrong. The
tests now hold each to the entry it was read in.

**And three Old English plurals spell their headword's stem the way the
headword does.** The pack dots a palatal *c* and *g* and pronounces what it
dots, and three plurals dropped a dot their headword carries: "children"
was woven as *cildru* under *ċild*, "babies" as *cildclāðas* under
*ċildclāð*, and "eggs" as *ǣgru* under *æġ*. They are *ċildru*,
*ċildclāðas* and *ǣġru* now, as English Wiktionary declines them. The egg
itself is *ǣġ*, with the long vowel Wiktionary and Sievers give it, so its
card moves to the new spelling with its whole history, as the eleven dotted
words' did. A plural may still drop a dot where a back vowel follows, which
is the guttural sound coming back — *fisċ*, *fiscas* — and the tests now
refuse one that drops it anywhere else.

**And a woven plural or participle sounds like itself.** The tooltip prints
a pronunciation under the word it wove, and every word had one, its
headword's, so it printed *mann*'s /ˈmɑnː/ under *menn*, *ċild*'s /ˈtʃild/
under *ċildru*, and *vir*'s /ˈwɪr/ under Latin *virī* — 206 Old English
forms and 223 Latin ones. Each Old English plural and participle now has a
transcription of its own, divided where its headword is, so *hūsbondan*
keeps the voiceless *s* of *hūsbonda* and *beginnende* the unstressed *be-*
of *beginnan*; and Wright's §313 gives *fuglas* and *morgnas* the spirant
their headwords have, where a lost vowel left the *g* before a consonant.

**And so does a Latin one.** Each of the 223 Latin plurals and participles
that showed no pronunciation shows its own, held to Allen & Greenough's rules
of syllable and stress beside its headword. The stress moves on 47 of them,
where the grammar moves it: *amāre* is stressed on its second syllable and
*amāns* on its first, *labor* on its first and *labōrēs* on its second. And
*iēns*, the participle of *īre*, has two syllables, its *i* the verb's own
vowel rather than the consonant that begins *iānua*.

**And the Latin for "oaths" is no longer a Medieval word.** It was woven as
*iūsiūranda*, declining only the second of the two words *iūsiūrandum* is
made of, which English Wiktionary's declension note calls Medieval; Classical
Latin declines both, as in the genitive *iūrisiūrandī*. Lewis & Short gives
the plural only as bare *iūra*, which is also the plural of *iūs*, rights and
laws, and the Classical plural the rule would give, *iūraiūranda*, is in no
text found. So "oaths" now stays in English, as "milk" and "gold" do, and
"oath" is woven as before.

**And the Old English for "goodbye" is one an Old English text has.** It was
*far wel*, which no text has: English Wiktionary gives it only as the
reconstruction *\*far wel!*, and *farewell* is first found in Middle English.
"goodbye" is now *wes hāl*, the greeting already woven for "hello", which
was said on parting too — Bosworth–Toller cites its plural, *wesaþ hāle*,
glossing Latin *valete*, farewell. A learner's card for *far wel* is kept,
and an export still carries it, but it is a different word from *wes hāl*,
so its reviews do not move there, and the progress page no longer lists or
counts it.

**And the Old English for "sorry" says regret, not loathing.** It was
*mē is lāþ*, "it is hateful to me": Bosworth–Toller has the construction
only as loathing — *mé láð wæs* glosses Latin *multum detestatus sum*, "I
greatly detested". "sorry" is now *mē hrēoweþ*, "it rues me", which
Bosworth–Toller quotes from Genesis, *þæt mé on mínum hyge hreóweð*, and
whose verb became English *rue*. A learner's *mē is lāþ* card is kept and
no longer listed, as *far wel*'s was. Of the four Old English phrases Weft
taught for a greeting, a farewell, a request and an apology, one was in no
text and one meant something else, so every Old English interjection and
phrase now names the text it was read in, and the build fails on one that
names none.

**And the Latin for "room" is a word Classical Latin used for one.** It was
*camera*, which Lewis & Short gives only as "a vault, an arched roof, an
arch"; the room is Late Latin, the *camera* that gave French *chambre*,
whence English *chamber*. "room" is now *conclāve*, "a room, chamber … that
may be locked up", from *clāvis*, a key — the word English took as
*conclave*. A learner's *camera* card is kept and no longer listed, as
*far wel*'s was. Read in the same dictionary, *īnfāns* is of common gender,
not masculine, and *audāx*, *fuscus* and *cānus* keep their glosses, each
with a note saying what the word covers: *audāx* daring, and oftener in a
bad sense than a good one; *fuscus* dark, dusky or tawny; *cānus* the white
of snow and frost, and above all the grey hair of age.

**And every Latin noun's gender is the one Lewis & Short gives it.** Nothing
had checked one, and the tooltip and the word pages print them. All 178 were
read, and seven were wrong: *hostis*, *mīles*, *canis* (as dog and as hound),
*mūs* and *bōs* are of common gender, not masculine, and *locus* is
masculine, not neuter — neuter is its plural *loca*, which Weft wove under
the same label. A row carries one gender for both its forms, so "places" is
now *locī*, the plural Lewis & Short gives for "single places", and neither
form is labelled with a gender it does not have. Every Latin noun's gender
now names the entry it was read in, and the build fails on one that does
not, as it does for Old English.

**And no Latin plural is one the dictionary says Latin does not use.**
Reading every noun's entry for what it says about the plural found two.
"evenings" was *vesperēs*, and Lewis & Short says of *vesper* "the plur.
not used"; "skies" was *caela*, and its only plural for *caelum* is *caeli*,
masculine and "only poet.". Both now stay English in the plural, as "oaths"
does, and the build fails if either plural comes back.

**And *familia* says what it was first of all.** Lewis & Short gives it as
"the slaves in a household … (not = family, i. e. wife and children)", and
the household Weft weaves it for as a rare sense. Its note said "in Latin it
includes the household slaves", which was true and said less than that; it
now says the word meant first of all a household's slaves, and that a man's
wife and children were his *domus*, so the discoveries feed tells it as the
false friend it is. Every Latin gloss now quotes the entry that gives it,
and where the English word is not there — "gray", "neighbor", "physician"
for doctor — names the word that stands for it.

**And the Latin for "coat" is a garment worn over others.** It was
*tunica*, which Lewis & Short gives as "an under-garment of the Romans worn
by both sexes, a tunic". "coat" is now *paenula*, "a woollen outer garment
covering the whole body, a kind of cloak or mantle, worn on journeys, and
also in the city in rainy weather" — the Latin beside the Old English
*mentel*, a mantle, that Weft already weaves for the same word. A learner's
*tunica* card is kept and no longer listed, as *camera*'s was.

**And the Old English for "baby" is a child, not its swaddling.** It was
*ċildclāð*, and "babies" *ċildclāðas*, which both dictionaries give as a
swaddling-cloth: English Wiktionary's "swaddling cloth; (in the plural),
swaddling clothes", Bosworth–Toller's "a child-cloth, a swaddling-cloth".
"baby" is now *ċild*, which Bosworth–Toller gives as "a child, infant" and
Wiktionary as "child" and "baby", and "babies" *ċildru* — the same word,
and the same card, Weft already weaves for "child". A learner's *ċildclāð*
card is kept and no longer listed. Every Old English noun now quotes the
entry that gives its gloss, which is how this one was found.

**And the Old English for "low" is Old English.** It was *lāh*, which is
early Middle English, taken from Old Norse *lágr*: English Wiktionary has
Old English *lah* only as a past tense of *lēon*, to lend, and
Bosworth–Toller only as a noun, "law". "low" is now *hēan*, "low, mean,
abject, humble" — the Old English beside the Latin *humilis* Weft already
weaves for the same word. A learner's *lāh* card is kept and no longer
listed. Every Old English verb, adjective, numeral and interjection now
quotes the entry that gives its gloss too.

**And the Old English for "tomorrow" is written as its texts write it.** It
was *tōmorgen*, one word, which neither dictionary prints. Bosworth–Toller's
*morgen* gives "the morning of the next day, morrow" and quotes the phrase
in two words: "Tó morgen cras" from Exodus and the West Saxon Gospels, and
"Gá and cum tó morgenne", "go, and come to-morrow", from the Pastoral Care.
"tomorrow" is now *tō morgen*. Its letters are the ones it had, so a
learner's card follows the new spelling and keeps its reviews. Like the
other Old English phrases, it shows no pronunciation for now. Every Old
English adverb now quotes the entry that gives its gloss, so every row of
the pack does.

**And the Italian tooltip prints no gender Italian does not have.** *Orecchio*,
ear, was marked neuter; it is masculine, and its plural *orecchie* feminine.
Four more words were woven in a plural of the other gender and
printed with their singular's: *ossa*, *braccia*, *dita* and *uova* are
feminine, the plurals of masculine *osso*, *braccio*, *dito* and *uovo*, and
the tooltip called them masculine. All five are now woven in the singular
only, so "ears", "bones", "arms", "fingers" and "eggs" stay English: the
masculine plurals English Wiktionary gives four of them — *orecchi*, *ossi*,
*bracci*, *diti* — are figurative or count the parts one at a time, which is
not what English usually means by the word.

**And two plurals were spelled wrong.** Spanish wove "countries" as *país*,
the singular, where the plural is *países*, and Portuguese wove "floors" as
*chões*, a form English Wiktionary has no page for: a noun in *-ão* takes
*-ãos*, *-ães* or *-ões* by its history, and *chão* takes *-ãos*, as *mão* is
*mãos*. Both are
corrected, and every plural the five modern packs weave, 868 of them, now
names the English Wiktionary entry that prints it.

**And the French for "stand" is what a person does.** It was *tenir
debout*, which English Wiktionary gives as "to hold water, to be valid, to
make sense" — what an argument does, as in *ça ne tient pas debout*, that
doesn't hold water. "stand" is now *être debout*, "stand (be upright,
support oneself on the feet in an erect position)", the shape Spanish,
Italian and Portuguese already weave: *estar de pie*, *stare in piedi*,
*estar de pé*. A learner's *tenir debout* card is kept and no longer
listed. Every French word now quotes the definition that gives its gloss,
which is how this one was found.

**And the Portuguese for "evening" is the evening.** It was *tarde*, which
English Wiktionary gives only as "afternoon". "evening" is now *serão*, the
word whose entry is "evening", masculine, plural *serões*. A learner's
*tarde* card is kept and no longer listed. Every Spanish and Portuguese
word now quotes the definition that gives its gloss too.

**And the Old English for "roads" is spelled as it sounds.** It was
*weġas*, a dot before a back vowel, and the tooltip printed it /ˈwejɑs/; the
*g* of a plural in *-as* is the guttural, as in *dagas*, "days", and Wright's
*Old English Grammar* prints the pair together, "pl. dagas, days; wegas,
ways" (§320). It is *wegas* now, /ˈweɣɑs/.

**And three more Old English plurals are ones a source prints.** "sisters"
was woven *sweostru*, which neither English Wiktionary's table nor Wright's
grammar prints: his paradigm gives the plural as *sweostor*, like the
singular, where *brōþor*, *mōdor* and *dohtor* take *-ru* beside theirs
(§415). It is *sweostor* now. And "floors" was woven *flōras*, a masculine
plural, under a word the tooltip calls feminine, as Wiktionary does and
Bosworth–Toller first; it is the feminine *flōra* now. And "dreams" was
woven *swefn*, like its singular, where the table prints *swefnu* and
Bosworth–Toller quotes "Swefnu gefremminge habbaþ", "dreams will have
accomplishment"; it is *swefnu* now.

**And two Old English words are spelt with the *c* they had.** *cempa*, a
soldier, and *cǣġ*, a key, were written *ċempa* and *ċǣġ* and pronounced
with a *ch*, /ˈtʃempɑ/ and /ˈtʃæːj/. Wright's *Old English Grammar* keeps
Germanic *k* guttural before the umlauts of the back vowels, which came
after the palatalisation (§309), and lists *cempa* beside *cēpan* and
*cyning* (§310); the words became English *kemp* and *key*. They are
*cempa* and *cǣġ* now, /ˈkempɑ/ and /ˈkæːj/, with the plurals their tables
print, *cempan* and *cǣġa*, and a learner's cards for either follow the new
spelling. And *hliehhan*, to laugh, was written with a long *ī*, where
Wright prints it with the short *ie* of *a* broken before *h* (§69), beside
*mieht* and *nieht*; it is *hliehhan* now, /ˈhliexːɑn/, and *laughing* is
*hliehhende*, as its table prints. And *beginnan*, to begin, was written
with a hard *g*, /beˈɡinːɑn/, where the *g* stood before an original *i*
and Wright gives such a *g* its palatal (§316), as the pack already did in
*forġietan*; it is *beġinnan* now, /beˈjinːɑn/, and *beginning* is
*beġinnende*, as its table prints. And two plurals are now the ones their
sources print: *books* was woven *bēc*, /ˈbeːk/, where Wright lists "bēc from
\*bōkiz, books" under the palatal *c* (§311), so it is *bēċ*, /ˈbeːtʃ/, as
its table prints; and *hats* was woven *hattas*, which no source prints,
where Bosworth–Toller's Supplement quotes "Eówre hættas mitrę", so it is
*hættas*, /ˈhætːɑs/. And *churches* was woven *ċirican*, its second *c*
hard, /ˈtʃirikɑn/, where the table prints *ċiriċan* and Bülbring's
*Altenglisches Elementarbuch* (§499) prints the West Saxon "ćirićean
'Kirchen'", both *c* soft; it is *ċiriċan* now, /ˈtʃiritʃɑn/. Every woven
Old English plural and participle but seven names the declension or
conjugation table that prints it, the section of Wright's grammar or of
Moore and Knott's, or the Bosworth–Toller entry that quotes it. And the note
under *clȳsan*, woven for *close*, said "“close” came from French", where
English Wiktionary and etymonline both have the verb partly from Old English
*clȳsan* and partly from Old French *clos*; it says so now. The note under
*setl*, woven for *chair*, said "the high-backed bench", which is what
English *settle* came to mean in the 1550s, where *setl* was any seat; and
*stōw*'s "as in Walthamstow" was printed in no dictionary read. Both say
what their entries do now, and every Old English note names the dictionary
entries it was checked against.

**And the dashboard counted the night the clocks went back twice.** Its
daily chart, the week's total, yesterday's figure and the streak each stepped
back from the present 24 hours at a time, and a day is 25 hours long when the
clocks go back and 23 when they go forward. So for an hour of every day
while the changed day was on the chart — a week on Free, two months on Pro;
the hour before the 4 a.m. rollover after the autumn change, the hour after
it after the spring one — the chart drew the
long day twice and the week and the streak counted it twice, or the short day
went missing altogether. Days are counted on the calendar now. A test found
it, failing at 03:29 GMT on 25 October 2026, two and a half hours after the
clocks went back.

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

**Built with** 1172 tests: 571 unit, 102 in jsdom, 459 over the build tools, and
40 end-to-end in a real Chromium with the extension loaded. Three further
end-to-end specs are defined and deliberately skipped; they generate assets
rather than assert anything and run behind `WEFT_STORE=1`, `WEFT_SCREENS=1` and
`WEFT_FIRSTRUN=1`. The lexicons are 581–588 entries across 576–583 surface
forms per language, 653 KB for all seven.

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
