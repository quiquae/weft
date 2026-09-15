# Seed lexicons

Weft ships a curated core lexicon so the extension works offline, on first
run, with no download and no API key. The pipeline in `tools/build-pack.mjs`
joins these files into the packs the extension loads.

## Why the source side is authored once

`english-core.tsv` holds the English side: lemma, part of speech, Zipf
frequency, difficulty band, sense count, and any irregular inflections. Every
`lex-<lang>.tsv` file then supplies only translations, keyed on that same
lemma **and part of speech** — "work" the noun and "work" the verb are
different words, and conflating them would weave *travail* where
*travailler* belongs. One source of truth for "how common and how hard is this word" means
a level-2 learner meets consistent difficulty whether they are studying
French or Old English, and a misaligned row is a build error rather than a
silent inconsistency.

## Target-side morphology: only number matters

The target word is dropped into an **English** sentence, so there is nothing
in the surrounding text for it to agree with. There is no French article
before it and no Latin verb after it. That collapses the inflection problem
to one axis:

- **Nouns** inflect for number, because English marks it and a mismatch is
  visible: "three chat" reads as a bug, "three chats" reads as a lesson.
  Both forms are authored (`tgt`, `tgt2`).
- **Adjectives and adverbs** use the citation form only. Romance gender and
  number agreement has no English trigger, and comparatives are skipped
  rather than guessed.
- **Verbs** are woven in the base form, mapped to the target infinitive, plus
  the `-ing` form mapped to the present participle where one is authored.
  Third-person `-s` and past forms are deliberately not woven: "he couru"
  teaches a wrong form, and teaching a wrong form is worse than teaching
  nothing.

For the historical languages this is why `morphology: 'citation'` works at
all. English marks case by word order, so a Latin nominative headword slots
into an English frame unambiguously: "the **rex** was angry" is clear where
"the **regis** was angry" is wrong in both languages.

## File formats

### english-core.tsv

```
lemma <TAB> pos <TAB> zipf <TAB> band <TAB> senses <TAB> plural <TAB> gerund
```

- `pos` — noun | verb | adj | adv | num | intj
- `zipf` — 1..7, Zipf frequency of the lemma in English (log10 per billion
  words). Sourced from the SUBTLEX-derived tables distributed with `wordfreq`.
- `band` — 1..6, roughly CEFR A1..C2. Drives the level window.
- `senses` — count of distinct common senses. High values are penalised at
  selection time because an out-of-context swap teaches the wrong sense.
- `plural` / `gerund` — only for irregular forms. Leave empty to let the
  builder apply English inflection rules.

### lex-&lt;lang&gt;.tsv

```
lemma <TAB> pos <TAB> tgt <TAB> tgt2 <TAB> gender <TAB> ipa <TAB> etymon <TAB> note
```

- `tgt` — citation form: singular noun, infinitive verb, masculine singular
  adjective, Latin/Old English nominative singular.
- `tgt2` — plural for nouns, present participle for verbs, otherwise empty.
- `gender` — m | f | n | c. Shown in the tooltip; empty where not applicable.
- `ipa` — optional. Required in practice for historical languages, which have
  no speech-synthesis voice and therefore no audio.
- `etymon` — set when this word is the actual ancestor of an English word,
  e.g. Old English `hūs` for "house". Powers the etymon badge.
- `note` — one short line shown in the tooltip.

Blank `tgt` skips the row, which is how a language legitimately declines to
translate a lemma (Old English has no word for "computer").

## Extending beyond the core

`npm run packs:extend` documents how to fold in
[wiktextract](https://github.com/tatuylonen/wiktextract) dumps from
[kaikki.org](https://kaikki.org/dictionary/) for long-tail coverage. That data
is CC BY-SA / GFDL and its attribution is carried into every generated pack's
metadata; see `docs/THIRD-PARTY.md`.
