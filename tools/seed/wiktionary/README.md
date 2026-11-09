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
