"""Lowercase forms of English headwords that also exist capitalized: German, Martin, Trump.

usage: extract_proper.py <english-dump.jsonl.gz> <out.txt>
"""
import gzip
import sys

import orjson

proper = set()
with gzip.open(sys.argv[1], 'rb') as f:
    for line in f:
        if b'"lang_code": "en"' not in line and b'"lang_code":"en"' not in line:
            continue
        d = orjson.loads(line)
        word = d.get('word', '')
        if d.get('lang_code') == 'en' and word[:1].isupper() and word[1:].islower() and word.isalpha():
            proper.add(word.lower())
open(sys.argv[2], 'w').write('\n'.join(sorted(proper)))
print(f'{len(proper):,} capitalized headwords')
