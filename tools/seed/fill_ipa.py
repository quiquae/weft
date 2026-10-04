#!/usr/bin/env python3
"""
Fill the `ipa` column of the historical-language seed files, and `ipa2`, the
transcription of the second form, where a language's second forms are read.

Run after editing lex-la.tsv or lex-ang.tsv:

    python3 tools/seed/fill_ipa.py

The generated values are committed with the data rather than produced at
build time, so the npm build stays node-only and the shipped transcriptions
are reviewable in a diff. Existing non-empty values are never overwritten:
a hand-corrected transcription always wins.

The tooltip prints a row's transcription under the form it wove, so a plural
or a participle needs one of its own: /ˈmenː/ under menn, never mann's
/ˈmɑnː/. Old English's are written, and tests/tools/old-english-stress.test.ts
reads them. Latin's wait until tests/tools/latin-stress.test.ts reads second
forms too, and until then a Latin second form prints no transcription.
"""
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from _ipa import latin_ipa, old_english_ipa  # noqa: E402

SEED = pathlib.Path(__file__).parent
TRANSCRIBERS = {
    'la': lambda w, pos, head='': latin_ipa(w),
    'ang': old_english_ipa,
}
# The languages whose second forms are transcribed, in the ninth column.
SECOND_FORMS = {'ang'}
# hund² is the second word spelled hund; the number is not spoken.
# One number, as spelling() in src/core/lexicon.ts takes it off.
NUMBER = re.compile('[²³⁴⁵⁶⁷⁸⁹]$')


def fill(lang):
    path = SEED / f'lex-{lang}.tsv'
    transcribe = TRANSCRIBERS[lang]
    lines = path.read_text().split('\n')
    filled = kept = skipped = 0
    width = 9 if lang in SECOND_FORMS else 8

    for i, line in enumerate(lines):
        if not line or line.startswith('#'):
            continue
        cols = line.split('\t')
        while len(cols) < width:
            cols.append('')
        # 0=lemma 1=pos 2=tgt 3=tgt2 4=gender 5=ipa 6=etymon 7=note 8=ipa2
        pos, tgt, tgt2 = cols[1], cols[2], cols[3]
        if not tgt:
            continue
        head = NUMBER.sub('', tgt)
        # A second form divides where its headword does, so it is read with it.
        cells = [(5, head, '')] + ([(8, tgt2, head)] if tgt2 and width == 9 else [])
        for at, word, of in cells:
            if cols[at]:
                kept += 1
                continue
            value = transcribe(word, pos, of)
            if not value:
                skipped += 1
                continue
            cols[at] = value
            filled += 1
        lines[i] = '\t'.join(cols)

    path.write_text('\n'.join(lines))
    print(f'lex-{lang}.tsv: {filled} transcriptions written, {kept} kept, {skipped} skipped (phrases)')


if __name__ == '__main__':
    for lang in sys.argv[1:] or ['la', 'ang']:
        fill(lang)
