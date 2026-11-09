"""Stream kaikki's English Wiktionary dump once and keep what the lexicon importer needs.

usage: extract_en.py <dump.jsonl.gz> <out.jsonl> [top_n]

Keeps English entries whose headword is among wordfreq's top_n English forms
(lowercase, letters only) and whose part of speech the packs weave. For each:
senses (gloss + tags), inflected forms, translations into the seven Weft
languages, and the etymology templates naming an Old English, Latin, French or
Old French source.
"""
import gzip
import sys

import orjson
import wordfreq

LANGS = {'fr', 'es', 'de', 'it', 'pt', 'la', 'ang'}
POS = {'noun', 'verb', 'adj', 'adv', 'num', 'intj', 'phrase'}
ETYM = {'inh', 'inh+', 'der', 'der+', 'bor', 'bor+'}
SOURCES = {'ang', 'la', 'fr', 'fro', 'xno', 'enm', 'LL.', 'ML.'}

dump, out_path = sys.argv[1], sys.argv[2]
top_n = int(sys.argv[3]) if len(sys.argv) > 3 else 12000
wanted = {w for w in wordfreq.top_n_list('en', top_n) if w.isalpha() and w.isascii() and len(w) > 1}

kept = seen = 0
with gzip.open(dump, 'rb') as f, open(out_path, 'wb') as out:
    for line in f:
        seen += 1
        d = orjson.loads(line)
        if d.get('lang_code') != 'en' or d.get('pos') not in POS or d.get('word') not in wanted:
            continue
        rec = {
            'word': d['word'],
            'pos': d['pos'],
            'etymology_number': d.get('etymology_number'),
            'senses': [
                {'gloss': (s.get('glosses') or [''])[0][:160], 'tags': s.get('tags', [])}
                for s in d.get('senses', [])
            ],
            'forms': [{'form': x.get('form'), 'tags': x.get('tags', [])} for x in d.get('forms', [])],
            # A table Wiktionary matched to a sense sits inside that sense; the
            # rest sit at the top. `si` is the sense's index, or None.
            'translations': [
                {**{k: t.get(k) for k in ('code', 'word', 'sense', 'tags', 'roman') if t.get(k)}, 'si': si}
                for si, table in [(None, d.get('translations', []))]
                + [(i, s.get('translations', [])) for i, s in enumerate(d.get('senses', []))]
                for t in table
                if t.get('code') in LANGS and t.get('word')
            ],
            'etymology': [
                e.get('args', {})
                for e in d.get('etymology_templates', [])
                if e.get('name') in ETYM and e.get('args', {}).get('2') in SOURCES
            ],
        }
        out.write(orjson.dumps(rec) + b'\n')
        kept += 1

print(f'read {seen:,} entries, kept {kept:,} for {len(wanted):,} wanted words')
