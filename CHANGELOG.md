# Changelog

## 1.0.1

Not cut yet — `VERSION` in `manifest.config.mjs` is still 1.0.0. This is
everything on `main` after the `v1.0.0` tag of 2026-09-19, which the
published release does not contain.

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
30 descents and 88 notes, keeping descent (English took the word from
French) apart from cousinhood (both inherit from Latin and the English
relative is a different word) rather than letting the feed state falsehoods.
French now leads the landing page, the README, the social card and the store
listing; the Latin and Old English section stayed, reframed.

**A toolbar icon drawn per size.** At 16px the warp threads were 1.36px of
pale blue at 85% opacity on fractional coordinates, so the mark dissolved
into four smudges and a bar at the only size it actually lives at. The
geometry is now a function of size, and the 128px artwork sits inside the
16px of transparent padding Chrome documents rather than bleeding to the
edge.

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

**Built with** 641 tests: 484 unit, 98 in jsdom, 23 over the build tools, and
36 end-to-end in a real Chromium with the extension loaded. Three further
end-to-end specs are defined and deliberately skipped; they generate assets
rather than assert anything and run behind `WEFT_STORE=1`, `WEFT_SCREENS=1` and
`WEFT_FIRSTRUN=1`. The lexicons are 584–588 entries across 579–583 surface
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
