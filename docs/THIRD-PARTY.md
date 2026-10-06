# Third-party sources and attribution

Weft carries no runtime dependencies. Preact is used only in the four
extension pages; the content script and service worker bundle nothing but
Weft's own code.

## Algorithms ported rather than imported

**FSRS-6** (Free Spaced Repetition Scheduler), by the Open Spaced Repetition
community. Ported directly from the reference TypeScript implementation
(<https://github.com/open-spaced-repetition/ts-fsrs>, MIT) into
`src/core/fsrs.ts`, with the reference default weights. Ported rather than
imported because the content script pays for every kilobyte on every page
load. The port is verified by asserting R(S, S) = 0.9 exactly, which is the
definition of stability.

## Lexicon data

The packs in `src/lexicon/packs/` are generated from `tools/seed/` and
licensed **CC BY-SA 4.0**. Attribution is carried inside each pack's
`meta.attribution` so it travels with the data.

### English frequency bands

Derived from **SUBTLEX-US** (Brysbaert, New & Keuleers) by way of the
**wordfreq** project (Robyn Speer). SUBTLEX is distributed under terms
equivalent to CC BY-SA; wordfreq's code is MIT and its data notes explicit
permission to redistribute the SUBTLEX word lists for any purpose.

- <http://crr.ugent.be/programs-data/subtitle-frequencies>
- <https://github.com/rspeer/wordfreq>

### Latin

Glosses checked against:

- **Lewis & Short**, *A Latin Dictionary* (Oxford, 1879) — public domain
- **Whitaker's Words** — public domain

Every gloss quotes the Lewis & Short entry that gives it, from the Perseus
text, in `tools/seed/la-glosses.tsv`, and `tests/tools/la-glosses.test.ts`
fails on a row that quotes none.

Classical pronunciation follows the standard reconstruction as set out in
W. Sidney Allen, *Vox Latina* (Cambridge, 1965). Transcriptions are derived
from the orthography by `tools/seed/_ipa.py`, which is near-deterministic once
vowel length is marked and checks itself against forms worked out by hand.
Syllables and stress follow *Allen and Greenough's New Latin Grammar* (Ginn,
1903; public domain), §§7, 11 and 12, and `tests/tools/latin-stress.test.ts`
holds every Latin transcription to those rules.

The **DCC Core Latin Vocabulary** (Dickinson College Commentaries, CC BY-SA)
informed which Latin words belong in a core list.

### Old English

Glosses checked against:

- **Bosworth–Toller**, *An Anglo-Saxon Dictionary* (1898) — public domain
- **J. R. Clark Hall**, *A Concise Anglo-Saxon Dictionary* (1894) — public
  domain

Every noun's gender was read against English Wiktionary's Old English entry
and, where Wiktionary has none or disagrees with itself, against
Bosworth–Toller in the online edition of Charles University, Prague
(<https://bosworthtoller.com>), whose data are "free for any purpose";
`tools/seed/ang-genders.tsv` names the entry for each. Every gloss but the
adverbs' quotes the entry that gives it in `tools/seed/ang-glosses.tsv` — a
noun's citing beside it the entry its gender was read in, a phrase's the
entry `tools/seed/ang-phrases.tsv` read its text in — and
`tests/tools/ang-glosses.test.ts` fails on a row with none; the 22 adverbs
are not yet read.

Orthography follows the normalised Early West Saxon of teaching editions.
Phonology follows Richard Hogg, *A Grammar of Old English*, and Alistair
Campbell, *Old English Grammar*. Stress, the voicing of *f*, *s* and *þ*,
and the sound of an undotted *g* follow Joseph and Elizabeth Mary Wright,
*Old English Grammar* (Oxford, 2nd ed., 1914), §§7–15, 261 and 313–324, and
`tests/tools/old-english-stress.test.ts` holds every Old English
transcription to those rules. Where a fricative ends a compound's first
element, which Wright's examples leave open, the voicing follows Karl
Bülbring, *Altenglisches Elementarbuch* (Heidelberg, 1902), §474, with
Eduard Sievers, *An Old English Grammar* (tr. Albert S. Cook, 3rd ed.,
Boston, 1903), §193, and Karl Luick, *Historische Grammatik der englischen
Sprache*, §639, for the two words it decides. Wright, Bülbring and Sievers
are public domain; Luick's chapter on the consonants was edited from his
notes by Friedrich Wild and Herbert Koziol and published in 1940, and one
sentence of it is quoted. Vowel length follows the dictionaries and, where
they disagree, the grammar: *ǣġ*, egg, is long in Wiktionary and in Sievers
§175, where Bosworth–Toller prints it short.

Public-domain sources impose no conditions. They are listed for scholarly
honesty rather than for compliance.

### Extending coverage

`npm run packs` builds from the curated seed files only. To go beyond the
core, **wiktextract** (Tatu Ylönen, MIT) produces machine-readable data from
Wiktionary at <https://kaikki.org/dictionary/>. That data is **CC BY-SA and
GFDL**, and anything built from it inherits those terms — which is why the
packs are share-alike rather than MIT even though nothing from Wiktionary
ships today.

## Development dependencies

`esbuild` (MIT), `typescript` (Apache-2.0), `@playwright/test` (Apache-2.0),
`jsdom` (MIT), `preact` (MIT), `@types/*` (MIT). None ship in the extension
except Preact.

## Prior art

Acknowledged because it is real and because pretending otherwise would be
dishonest:

**Word-replacement extensions.** **Toucan** is the best known, acquired by
Babbel in 2022. **Vocabo**, **Fluent**, **Immersive Translate**, **Language
Reactor**, **Readlang** and **Migaku** all do some form of in-page
translation or click-to-translate.

**Diglot-weave products specifically.** The method is not obscure and several
people sell it: **Prismatext** prints woven books, **Quilingo** and
**joindiglot.com** are web readers, **LingoWeave** teaches the method
directly, and **LoomVue** — the IES-funded tool above — is a browser
extension doing dynamic weaving for English learners in schools.

So the honest positioning is narrow and it is this: Weft is the only one that
makes difficulty a function of **attention** rather than of measured skill or
a fixed setting, and the only one that treats **Latin and Old English** as
first-class targets with etymological descent surfaced as the teaching
device. The method is borrowed and credited. Those two things are the
product.
