# Why Weft works the way it does

Every default in Weft is a pedagogical claim. This document states them, and
says which are well supported and which are judgement.

## The method has a name

The **diglot weave** was developed by Robert Blair at Brigham Young University
in the 1970s. A text is kept 95–98% comprehensible in the reader's first
language and the target language is woven in just above their threshold, so
meaning arrives from context rather than from a dictionary. It is the same
principle as Krashen's *i+1* and the same mechanism as a "sandwich story" or
an interlinear edition.

The evidence is good rather than overwhelming, and it is checkable:

- **Christensen, E., Merrill, P., & Yanchar, S. (2007).** "Second language
  vocabulary acquisition using a diglot reader or a computer-based drill and
  practice program." *Computer Assisted Language Learning*, 20(1), 67–77.
  [doi:10.1080/09588220601118511](https://doi.org/10.1080/09588220601118511) ·
  [ERIC EJ764047](https://eric.ed.gov/?id=EJ764047)

  College learners of Spanish using a diglot reader acquired *as much*
  vocabulary as those using a sophisticated computer drill-and-practice
  program — and did so incidentally, from context, while reporting that they
  enjoyed it more. The headline is not that the weave wins. It is that it
  ties, for free, on time you were spending anyway.

- **Nemati, A., & Maleki, E. (2014).** "The Effect of Teaching Vocabulary
  through the Diglot-Weave Technique on Vocabulary Learning of Iranian High
  School Students." *Procedia — Social and Behavioral Sciences*, 98,
  1340–1345.
  [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S1877042814026421)

  Sixty first-year students, randomly assigned, five 45-minute sessions.
  ANCOVA found a statistically significant advantage for the diglot-weave
  group over conventional vocabulary teaching. Small, short, and one
  population — but a real experiment with a real control group.

- **LoomVue Browser: Supporting Language Learning with a Dynamic Diglot
  Weave.** IES SBIR Phase I.
  [ies.ed.gov award](https://ies.ed.gov/use-work/awards/loomvue-browser-supporting-language-learning-dynamic-diglot-weave-0)

  The closest prior art, and a browser extension: it flips words between
  English and Spanish as a machine-learning model judges the reader's skill.
  Reported nearly 20% improvement pre- to post-test on a researcher-developed
  vocabulary measure, and an external evaluation by WestEd found middle-school
  English learners significantly increased vocabulary knowledge after a week.

Note what the last one does **not** do, because it is the honest statement of
Weft's contribution: LoomVue adapts difficulty to *measured skill*, for
English learners in classrooms. Weft adapts it to *measured attention*, for
adults on the open web. The pedagogy is borrowed and credited. Tying it to
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
interjections. Function words are available in settings, marked "not
recommended", because someone drilling articles may genuinely want them.

## Only number is inflected, and that is a structural insight

The target word lands in an **English** sentence. There is no French article
in front of it and no Latin verb after it. Nothing in the surrounding text can
disagree with it.

That collapses the entire inflection problem to one axis:

- **Nouns** inflect for number, because English marks number and a mismatch is
  visible. "three chat" reads as a bug; "three chats" reads as a lesson. Both
  forms are authored for every noun.
- **Adjectives and adverbs** use the citation form only. Romance gender and
  number agreement has no English trigger, and comparatives are skipped rather
  than guessed.
- **Verbs** are woven in the base form, mapped to the target infinitive, plus
  the `-ing` form mapped to an authored present participle. Third-person `-s`
  and past forms are **never** woven. "he couru" teaches a form that does not
  exist, and teaching a wrong form is worse than teaching nothing.

"He wants to **courir**" is not grammatical French and is not meant to be. The
reader is decoding a French word inside an English clause, and the infinitive
is the form they will meet in a dictionary.

## Why Latin and Old English work at all

English marks case by word order rather than by endings, so a nominative
headword slots into an English frame unambiguously. "The **rēx** was angry" is
clear. "The **rēgis** was angry" is wrong in both languages.

That is why both use `morphology: 'citation'` — nominative singular for nouns,
infinitive for verbs — and why the approach that would fail for a
Latin-to-Latin sentence works perfectly for a Latin word in an English one.

### The etymon is the point

For Old English, the target is usually the literal ancestor of the word it
replaced. `hūs` → house. `stān` → stone. `cyning` → king. `hlāford` → lord,
and it means *loaf-keeper*. The tooltip says so, which changes the task from
"memorise this foreign word" to "here is where your word came from" — a far
stickier framing, and a true one.

For Latin it is the learned descendant rather than the ancestor: `vacca` gave
us *vaccine* (Jenner named it after the cowpox he used), `mīlle passūs` gave us
*mile*, `paene īnsula` gave us *peninsula*, `pecus` — cattle, the original
wealth — gave us *pecuniary*.

The false friends are marked deliberately, because they are the most memorable
thing in the language:

| Old English | Means | Became |
|---|---|---|
| `drēam` | joy, music | *dream* (the sleeping sense is Norse) |
| `steorfan` | to die | *starve* |
| `sellan` | to give | *sell* |
| `wīf` | woman, and neuter | *wife* |
| `cwic` | alive | *quick*, as in "the quick and the dead" |
| `grēat` | thick, massive | *great* |
| `sōþ` | true | *sooth*, as in "forsooth" |

### Orthography is a difficulty axis of its own

`þēod` is not hard because of the word. It is hard because of the thorn and
the macron. Most historical-language tools collapse orthographic difficulty
into vocabulary difficulty, which is why they feel impossible on day one.

Weft separates them. Thorn, eth, ash, wynn, yogh, long s and macrons each have
a switch. A beginner reads `theod` and graduates to `þēod` when they want to
read an edition. Macrons default **on**, because vowel length is information
rather than decoration; the exotic letterforms default off.

## Which words, in which order

The selector scores each candidate on:

- **Due** — how far its retrievability has decayed. An unseen word scores 1.
- **Cognate** — orthographic similarity on a folded skeleton, plus a bonus for
  a known suffix correspondence, floored by the etymon when there is one.
  `nation`/`nación` needs almost no work and delivers comprehension plus the
  insight that the languages are related. That is the right place to start.
- **Frequency** — distance from the Zipf value a learner at this level should
  mostly be meeting, which falls from about 6.2 at A1 to 3.2 at C2.
- **Band fit** — proximity to the current level, in a window of one band below
  for consolidation and one above for stretch. Widening it further mixes A1
  and C2 vocabulary, which reads as noise.
- **Guessability** — sentence length, saturating at twelve words. A longer
  sentence carries more context to recover the word from.
- **Ambiguity** — a multiplicative penalty. "light" with eight senses is a bad
  swap however good everything else about it looks.

And the layout constraints: a minimum gap so two woven words never touch, a
hard cap per sentence, and short sentences left alone entirely because a
four-word sentence has no spare context.

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
choices are all forgiven, and a single-character slip on a longer word passes —
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
