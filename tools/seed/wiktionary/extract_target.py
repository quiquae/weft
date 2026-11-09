"""Keep, from one language's Wiktionary dump, the entries the English extract translates into.

usage: extract_target.py <en-extract.jsonl> <code> <lang-dump.jsonl.gz> <out.jsonl>

For each entry whose headword some English entry translates into `code`: part
of speech, etymology number, the head line as Wiktionary prints it (gender and
plural live there), the inflected forms with their tags (plurals, participles,
gerunds), and each sense's first definition line with its tags.
"""
import gzip
import sys

import orjson

extract, code, dump, out_path = sys.argv[1:5]
POS = {'noun', 'verb', 'adj', 'adv', 'num', 'intj', 'phrase'}

wanted = set()
for line in open(extract, 'rb'):
    for t in orjson.loads(line)['translations']:
        if t['code'] == code:
            wanted.add(t['word'])

kept = 0
with gzip.open(dump, 'rb') as f, open(out_path, 'wb') as out:
    for line in f:
        d = orjson.loads(line)
        if d.get('word') not in wanted or d.get('pos') not in POS:
            continue
        rec = {
            'word': d['word'],
            'pos': d['pos'],
            'etymology_number': d.get('etymology_number'),
            'head': [h.get('expansion', '') for h in d.get('head_templates', [])],
            'tags': d.get('tags', []),
            'forms': [{'form': x.get('form'), 'tags': x.get('tags', [])} for x in d.get('forms', [])][:80],
            'senses': [
                {'gloss': (s.get('glosses') or [''])[0][:200], 'tags': s.get('tags', [])}
                for s in d.get('senses', [])
            ],
        }
        out.write(orjson.dumps(rec) + b'\n')
        kept += 1

print(f'{code}: {len(wanted):,} target words wanted, kept {kept:,} entries')
