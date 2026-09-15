# Changelog

## 1.0.0

First release.

**Reading.** Weaves a proportion of the words on a page into a language you
are learning, using the diglot-weave method, and raises that proportion with
measured attention on the page. Point at a word to get the English back, with
part of speech, gender, pronunciation and — for the historical languages —
the English word it became.

**Seven languages.** French, Spanish, German, Italian, Portuguese, Latin and
Old English. 356 checked English lemmas per language, 584–588 surface forms,
664 KB for all seven. Latin and Old English carry etymological descent, IPA
derived from the orthography, and the false-friend notes.

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

**Built with** 449 tests: 379 unit, 71 in jsdom, 24 end-to-end in a real
Chromium with the extension loaded.
