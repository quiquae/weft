#!/usr/bin/env python3
"""
Fill the `ipa` column of the historical-language seed files.

Run after editing lex-la.tsv or lex-ang.tsv:

    python3 tools/seed/fill_ipa.py

The generated values are committed with the data rather than produced at
build time, so the npm build stays node-only and the shipped transcriptions
are reviewable in a diff. Existing non-empty values are never overwritten:
a hand-corrected transcription always wins.
"""
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from _ipa import latin_ipa, old_english_ipa  # noqa: E402

SEED = pathlib.Path(__file__).parent
TRANSCRIBERS = {
    'la': lambda w, pos: latin_ipa(w),
    'ang': old_english_ipa,
}


def fill(lang):
    path = SEED / f'lex-{lang}.tsv'
    transcribe = TRANSCRIBERS[lang]
    lines = path.read_text().split('\n')
    filled = kept = skipped = 0

    for i, line in enumerate(lines):
        if not line or line.startswith('#'):
            continue
        cols = line.split('\t')
        while len(cols) < 8:
            cols.append('')
        # 0=lemma 1=pos 2=tgt 3=tgt2 4=gender 5=ipa 6=etymon 7=note
        pos, tgt, ipa = cols[1], cols[2], cols[5]
        if not tgt:
            continue
        if ipa:
            kept += 1
            continue
        # hund² is the second word spelled hund; the number is not spoken.
        # One number, as spelling() in src/core/lexicon.ts takes it off.
        value = transcribe(re.sub('[²³⁴⁵⁶⁷⁸⁹]$', '', tgt), pos)
        if not value:
            skipped += 1
            continue
        cols[5] = value
        filled += 1
        lines[i] = '\t'.join(cols)

    path.write_text('\n'.join(lines))
    print(f'lex-{lang}.tsv: {filled} transcriptions written, {kept} kept, {skipped} skipped (phrases)')


if __name__ == '__main__':
    for lang in sys.argv[1:] or ['la', 'ang']:
        fill(lang)
