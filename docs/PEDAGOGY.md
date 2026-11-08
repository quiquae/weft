# Why Weft works the way it does

Every default in Weft is a pedagogical claim. This document states them, and
says which are well supported and which are judgement.

## The method has a name

The **diglot weave** keeps a text in the reader's first language and weaves
the target language into it a little at a time, just above what they can
already read, so meaning arrives from context rather than from a dictionary.
It goes back to the linguist Robbins Burling, who in 1968 wove French into
English texts by degrees: "Some Outlandish Proposals for the Teaching of
Foreign Languages", *Language Learning*, 18, 61–76. The first study below
calls the diglot method "originally conceived by Burling". Robert Blair, whose
Power-Glide courses were built on it, tells its history in his 1991 chapter
"Innovative Approaches", as
[an account in *Humanising Language Teaching*](https://old.hltmag.co.uk/jan03/mart3.htm)
relays it. It is the same principle as Krashen's *i+1*.

The evidence is good rather than overwhelming, and it is checkable:

- **Christensen, E., Merrill, P., & Yanchar, S. (2007).** "Second language
  vocabulary acquisition using a diglot reader or a computer-based drill and
  practice program." *Computer Assisted Language Learning*, 20(1), 67–77.
  [doi:10.1080/09588220601118511](https://doi.org/10.1080/09588220601118511) ·
  [ERIC EJ764047](https://eric.ed.gov/?id=EJ764047)

  A computer-based diglot reader was, in the abstract's words, "equally as
  effective as the drill and practice program in facilitating vocabulary
  acquisition", against a sophisticated computer drill, and the study
  "reaffirmed the positive affective benefit of the diglot method". ERIC
  indexes the learners as college students of Spanish. The headline is not
  that the weave wins. It is that it ties, and Weft's bet is that a tie
  bought with reading you were doing anyway is worth having.

- **Nemati, A., & Maleki, E. (2014).** "The Effect of Teaching Vocabulary
  through the Diglot-Weave Technique on Vocabulary Learning of Iranian High
  School Students." *Procedia — Social and Behavioral Sciences*, 98,
  1340–1345.
  [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S1877042814026421)

  Sixty high-school students in two groups of thirty, five 45-minute
  sessions. ANCOVA found a statistically significant difference between the
  groups, which the authors read as the diglot weave reinforcing vocabulary
  learning against conventional teaching. Small, short, one population, and
  by its abstract not randomised — but a comparison against a control group
  taught the usual way.

- **LoomVue Browser: Supporting Language Learning with a Dynamic Diglot
  Weave.** IES SBIR Phase II, 2021–2023, King's Peak Technology, after a
  Phase I in 2020.
  [ies.ed.gov award](https://ies.ed.gov/use-work/awards/loomvue-browser-supporting-language-learning-dynamic-diglot-weave-0)

  The closest prior art: passages blending English and Spanish for middle-
  and high-school English learners, "with a machine learning engine
  continually adjusting the words as readers gain skill", and a browser
  extension planned in Phase II. The award page reports the Phase I pilot,
  thirteen middle-school English learners and four teachers, as "nearly 20%
  improvement from pre- to post- test on a researcher developed measure" of
  their self-perceived knowledge of the words.

Note what the last one does **not** do, because it is the honest statement of
Weft's contribution: LoomVue adapts the words to *the reader's growing
skill*, for English learners in school. Weft adapts difficulty to *measured
attention*, for adults on the open web. The pedagogy is borrowed and credited. Tying it to
the time you were going to lose anyway is the new part, and it is untested.

Weft's contribution is not the method. It is tying the difficulty to
**attention**, so the time you were going to lose anyway is what buys the
vocabulary.

## Function words are never woven

This is the most important default in the product.

Replacing "the", "of", "and", "in" destroys the grammatical scaffolding the
reader is using to decode everything else. The gain is negligible: those words
are learned in the first week of any course. Content words — and concrete
nouns above all — are where comprehensible input lives, because a concrete
noun in a full sentence can be recovered from its surroundings.

The default preference order is nouns, adjectives, verbs, adverbs, numbers,
interjections. Settings offers articles, prepositions, conjunctions and
pronouns too, marked "not recommended", but today those four switches weave
nothing: no pack Weft ships has a single one of them, and a translation
service is only ever asked for a noun, a verb, an adjective or an adverb.

## Only number is inflected, and that is a structural insight

The target word lands in an **English** sentence. There is no French article
in front of it and no Latin verb after it. Nothing in the surrounding text can
disagree with it.

That collapses the entire inflection problem to one axis:

- **Nouns** inflect for number, because English marks number and a mismatch is
  visible. "three chat" reads as a bug; "three chats" reads as a lesson. Both
  forms are authored wherever English's plural can be woven. A mass noun such
  as *milk* or *gold* weaves its singular only, and so does a noun whose
  dictionary refuses it a plural or gives the plural another gender.
- **Adjectives and adverbs** use the citation form only. Romance gender and
  number agreement has no English trigger, and comparatives are skipped rather
  than guessed.
- **Verbs** are woven in the base form, mapped to the target infinitive, plus
  the `-ing` form, mapped to the form its language uses there: the present
  participle in French, German, Latin and Old English, and the gerund in
  Spanish, Portuguese and Italian, where the present participle is another
  word. Third-person `-s` and past forms are in **no** pack, and a translation
  service is never sent a word ending in `-ed`, `-ing` or `-s` as a verb. "he
  couru" teaches a form that does not exist, and teaching a wrong form is
  worse than teaching nothing.

"He wants to **courir**" is not grammatical French and is not meant to be. The
reader is decoding a French word inside an English clause, and the infinitive
is the form they will meet in a dictionary.

## Why Latin and Old English work at all

English marks case by word order rather than by endings, so a nominative
headword slots into an English frame unambiguously. "The **rēx** was angry" is
clear. "The **rēgis** was angry" is wrong in both languages.

That is why both weave a noun only in the nominative, singular or plural, and
a verb in its infinitive or present participle — `morphology: 'citation'`,
which also asks a translation service for the nominative singular and the
infinitive — and why the approach that would fail for a Latin-to-Latin
sentence works for a Latin word in an English one.

### The etymon is the point

For Old English, the target is usually the literal ancestor of the word it
replaced. `hūs` → house. `stān` → stone. `cyning` → king. `hlāford` → lord,
and it means *loaf-keeper*. The tooltip says so, which changes the task from
"memorise this foreign word" to "here is where your word came from" — a far
stickier framing, and a true one.

For Latin it is the learned descendant rather than the ancestor: `vacca` gave
us *vaccine* (named after the cowpox Jenner used), `mīlle passūs` gave us
*mile*, `paene īnsula` gave us *peninsula*, `pecūnia`, money — from *pecus*,
cattle, the original wealth — gave us *pecuniary*. Every Latin note names the
entries it was checked against in `tools/seed/la-notes.tsv`: Lewis & Short's
for its headword, and etymonline's for the English word whenever the note
names it.

The false friends are marked deliberately, because they are the most memorable
thing in the language:

| Old English | Means | Became |
|---|---|---|
| `mete` | food of any kind | *meat* |
| `steorfan` | to die | *starve* |
| `sellan` | to give | *sell* |
| `wīf` | woman, and neuter | *wife* |
| `cwic` | alive | *quick*, as in "the quick and the dead" |
| `grēat` | thick, massive | *great* |

`sōþ` used to close it, as the ancestor of *sooth*, but *sooth* still means
truth, which is what `sōþ` meant: a word that survived, as in "forsooth" and
"soothsayer", rather than one that moved.

`drēam` used to head this table, as the ancestor of *dream*. It meant joy and
music, which makes it a false friend still, but etymonline says that "much
study has failed to prove that Old English dream is the source of the modern
word", so Weft no longer says it became one. Every Old English etymon names
the dictionary entry it was checked against, in `tools/seed/ang-etymons.tsv`.

### Orthography is a difficulty axis of its own

`þēod` is not hard because of the word. It is hard because of the thorn and
the macron. Most historical-language tools collapse orthographic difficulty
into vocabulary difficulty, which is why they feel impossible on day one.

Weft separates them. Thorn, eth, ash, wynn, yogh, long s and macrons each have
a switch. A beginner reads `thēod` and graduates to `þēod` when they want to
read an edition. Macrons default **on**, because vowel length is information
rather than decoration; the exotic letterforms default off.

## Which words, in which order

The selector scores each candidate on:

- **Due** — how far its retrievability has decayed. An unseen word scores 1.
- **Cognate** — orthographic similarity on a folded skeleton, plus a bonus for
  a known suffix correspondence, floored by the etymon when there is one.
  `music`/`música` needs almost no work and delivers comprehension plus the
  insight that the languages are related. That is the right place to start.
- **Frequency** — distance from the Zipf value a learner at this level should
  mostly be meeting, which falls from about 6.2 at A1 to 3.2 at C2.
- **Band fit** — proximity to the current level, in a window of one band below
  for consolidation and one above for stretch. Widening it further mixes A1
  and C2 vocabulary, which reads as noise. The window never runs past the
  highest band the pack has: every pack tops out at band 4, roughly B2, so at
  B2, C1 and C2 it slides down to bands 2 to 4, the rarest words Weft has, put
  first by the frequency and band-fit scores. Until 2026-11-08 it slid past
  them, and those three levels wove nothing on ordinary prose, even at the
  ceiling.
- **Guessability** — sentence length, saturating at twelve words. A longer
  sentence carries more context to recover the word from.
- **Part of speech** — the order the learner put the parts of speech in,
  nouns first by default.
- **Confidence** — a multiplicative gate on how sure the pack is of the
  mapping, so a doubtful translation cannot be rescued by being a cognate.
- **Ambiguity** — a multiplicative penalty, and by default a limit: a word
  with more than four senses is not woven at all. "light" with eight senses
  is a bad swap however good everything else about it looks.
- **Repetition** — a multiplicative gate: a word may be woven three times on
  a page at full score, and after that it scores a fraction as much, because
  past that point it is wallpaper rather than practice.
- **Position** — a slight penalty on a capitalised word, usually the first of
  its sentence, in a sentence longer than three words: swapped, it loses the
  capital that marked where the sentence began.

And the layout constraints: a minimum gap of two words so two woven words
never touch, a cap of three per sentence, a daily limit on words met for the
first time, and short sentences left alone entirely because a sentence of
three words or fewer has no spare context.

## Difficulty never rises mid-word

A word you have just decoded must not flip back to English as the page gets
harder around it. If it did, the reader would never build on anything.

Selection is prefix-monotone for fixed inputs, and where the inputs drift the
words on screen are explicitly pinned. Rising difficulty only appends. See
[ARCHITECTURE.md](ARCHITECTURE.md#selection).

## Words you learn stop costing you

Once a word is genuinely internalised — three or more reviews, stability past
the threshold, and currently well recalled — it is left in the target language
**permanently** and no longer counts against the page's difficulty budget.

This matters more than it sounds. It means the visible density of the page
keeps rising while the *effort* stays constant, because a growing share of
what you are reading is simply readable. The retirement test is deliberately
conservative: retiring a word too early makes the page harder than the
learner's level, which is the single failure mode that makes people uninstall.

## Grading without a review session

Weft never asks you to sit down and study, so grades are inferred:

| Signal | Grade |
|---|---|
| You revealed the English | Again (1) |
| Tooltip: "Not sure" | Hard (2) |
| A quiz answer, correct | Good (3) |
| A quiz answer, wrong | Again (1) |
| Tooltip: "I knew it" | Easy (4) |

Needing the English is the honest signal that a word is not known, and it is
the one signal that arrives for free. Exposures are counted separately from
reviews, and only for words that were actually on screen.

The scheduler is **FSRS-6**, ported from the reference implementation and
verified by asserting that R(S, S) = 0.9 exactly — which is the definition of
stability, and the thing that would silently drift if the port were wrong.

## The unlock quiz

Questions are drawn **only** from words Weft has already shown you. It is
never a test of unseen material; it is a check that the exposure did something.
Grading is generous on purpose — accents, articles and Old English letterform
choices are all forgiven, and a single-character slip in a typed answer of
five letters or more passes —
because the quiz is retrieval practice, not a spelling bee. Being strict would
turn a productive gate into a wall, and a wall gets uninstalled.

The answers feed the scheduler whether or not you pass.

## What is judgement rather than evidence

Stated plainly, because a product that dresses up its guesses as findings does
not deserve trust:

- The **shape of the escalation curve** is a design choice. There is no
  literature on optimal difficulty ramps tied to browsing attention, because
  nobody has built this before.
- The **specific scoring weights** are tuned by reading the output, not fitted
  to learning outcomes.
- **One band per 200 retired words** as a progression rate is a conservative
  guess, chosen because levelling a user up too fast is indistinguishable from
  breaking the product.
- Whether **attention-linked difficulty** teaches more than a fixed dose is
  untested. It is a reasonable bet, and it is the bet the product makes.
