# Drafting lexicon rows from English Wiktionary

These scripts grow a pack from English Wiktionary, as extracted by
[kaikki.org](https://kaikki.org) (wiktextract). Every row they write is
`decided_by` wiktionary and `status` proposed: woven, labelled "Wiktionary,
unreviewed" in the tooltip, and not yet read by a person. A person who reads a
row and agrees sets its status to `confirmed`.

## Data

Not in this repository, because it is large. The run of 2026-11-09 used
kaikki.org's dumps downloaded that day:

| File | SHA-256 |
| --- | --- |
| `kaikki.org-dictionary-English.jsonl.gz` | `4d03b6cba283744756c57ff661c2c6cbfe34fcf8ff513a966576cf7d97e91a99` |
| `kaikki.org-dictionary-French.jsonl.gz` and the other six | recorded beside the files in `sha256.txt` |

Python 3.14 with `wordfreq` and `orjson`.

## Run

```sh
python3 -I extract_en.py     kaikki.org-dictionary-English.jsonl.gz en-extract.jsonl 12000
python3 -I extract_proper.py kaikki.org-dictionary-English.jsonl.gz en-proper.txt
python3 -I extract_target.py en-extract.jsonl fr kaikki.org-dictionary-French.jsonl.gz target-fr.jsonl
python3 -I draft.py fr en-extract.jsonl target-fr.jsonl ../ 2200          # report only
python3 -I draft.py fr en-extract.jsonl target-fr.jsonl ../ 2200 --write  # append the rows
npm run packs
```

`en-proper.txt` has to sit beside `en-extract.jsonl`.

## What a drafted row has to pass

The same ledgers a checked row does: the gloss quotes the target word's own
definition line, holding the English word outside any parenthesis; a noun's
gender and plural come from its headword line; a verb's -ing form from its
table. On top of that `draft.py` skips a word that is ambiguous (more than
three distinct translations), spelled the same in the language, a name's
frequency, a comparative, a form of another word, two etymologies, a
pronominal verb, or already in the checked core, and prefers a translation
whose first sense is the word and which the language uses most.

Spot check on 2026-11-09, French: 100 random rows read, 2 wrong
(incentive → incitant, vintage → cru) and 3 debatable.

## Latin: `draft_la.py`

`draft.py` cannot do Latin: a Latin gloss quotes Lewis & Short and a noun's
gender cites it, by the ledgers' rules, where a modern row cites only
Wiktionary. `draft_la.py` drafts a Latin row only where three sources agree:
the [DCC Latin Core Vocabulary](https://dcc.dickinson.edu/latin-core-list1)
(CC BY-SA) names the English word in its definition's first two senses, in
DCC's part of speech; an italic run of the word's Lewis & Short entry holds
that English word, and its first `<gen>` outside a parenthesis is DCC's
gender; and its one English Wiktionary entry spells the headword as DCC does,
macrons and all, agrees on the gender, and gives the woven form in its
table. The transcription `_ipa.py` writes must also agree with Wiktionary's
Classical one in its syllables, vowel lengths and stress, which keeps out a
hidden quantity and a consonant *i* the spelling cannot show. Only English
words already in `english-core.tsv` are drafted for, so no English row is
added. Rows are `decided_by` dcc, `status` proposed; the tooltip labels them
"Lewis & Short, unreviewed" (`draftedFrom` in `src/core/languages.ts`), and
the site builds no page from a drafted row.

Data, downloaded 2026-11-10:

| File | Source | SHA-256 |
| --- | --- | --- |
| `dcc-latin-core.html` | `https://dcc.dickinson.edu/latin-core-list1` | `665cd47bf672b3557f69cd35025e7488768e18e98b865958489a0d276916a19e` |
| `lat.ls.perseus-eng1.xml` | `https://raw.githubusercontent.com/PerseusDL/lexica/master/CTS_XML_TEI/perseus/pdllex/lat/ls/lat.ls.perseus-eng1.xml` | `421782f2b444f2705077745e7b0455314bb0ebaee3d66acf0110f88e4b5a121c` |
| `kaikki.org-dictionary-Latin.jsonl.gz` | `https://kaikki.org/dictionary/Latin/kaikki.org-dictionary-Latin.jsonl.gz` | `621efbea7ffcec747aa39d03fbf54eb316de47a9af9cf7fa5a0a95a9fbf19b1a` |

```sh
python3 -I extract_la.py dcc-latin-core.html kaikki.org-dictionary-Latin.jsonl.gz target-la.jsonl
python3 -I draft_la.py dcc-latin-core.html lat.ls.perseus-eng1.xml target-la.jsonl ../ --sample=9:60   # report
python3 -I draft_la.py dcc-latin-core.html lat.ls.perseus-eng1.xml target-la.jsonl ../ --write
python3 ../fill_ipa.py && npm run packs
```

Run of 2026-11-10: 997 DCC lemmas, **82 drafted** (36 verbs, 32 nouns, 7
adjectives, 7 adverbs). The rest: 412 name no English word `english-core.tsv`
carries, 225 only words the pack already teaches, 83 are not content words,
62 irregular or deponent verbs, 87 have no one Wiktionary entry spelling them
as DCC does. So DCC's thousand lemmas are nearly spent; the next source is
English Wiktionary's translation tables, as `draft.py` reads them. All 82
were read: none wrong, and debatable where DCC's own definition leads —
*crīmen* "verdict" (DCC: "verdict, accusation"), *praecipere* "anticipate",
*prōdere* "publish", *sēnsus* "emotion", *quīn* "indeed".
