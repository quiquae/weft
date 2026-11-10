"""Cut kaikki.org's Latin dump down to the entries draft_la.py may draft from.

usage: extract_la.py <dcc-latin-core.html> <kaikki Latin dump> <out.jsonl> [en-extract.jsonl]

The titles kept are the DCC core headwords and, given extract_en.py's cut of
the English dump, every Latin word its translation tables name.
"""
import gzip, html, json, re, sys, unicodedata

DCC, DUMP, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
EN = sys.argv[4] if len(sys.argv) > 4 else None

def bare(w):
    return ''.join(c for c in unicodedata.normalize('NFD', w) if not unicodedata.combining(c))

text = open(DCC, encoding='utf-8').read()
titles = set()
for r in re.findall(r'<tr[^>]*>(.*?)</tr>', text, re.S)[1:]:
    cells = [html.unescape(re.sub(r'<[^>]+>', '', c)).strip() for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.S)]
    if cells:
        titles.add(bare(cells[0].split()[0]))
if EN:
    for line in open(EN, encoding='utf-8'):
        for t in json.loads(line)['translations']:
            if t['code'] == 'la' and re.fullmatch(r'[^\W\d_]+', t['word']):
                titles.add(bare(t['word']))
WORD = re.compile(r'"word": "([^"]*)"')
kept = 0
with gzip.open(DUMP, 'rt', encoding='utf-8') as f, open(OUT, 'w', encoding='utf-8') as out:
    for line in f:
        if not any(w in titles for w in WORD.findall(line)):
            continue
        d = json.loads(line)
        if d.get('lang_code') != 'la' or d.get('word') not in titles:
            continue
        keep = {k: d.get(k) for k in ('word', 'pos', 'forms', 'senses', 'head_templates', 'etymology_number', 'etymology_text', 'sounds')}
        out.write(json.dumps(keep, ensure_ascii=False) + '\n')
        kept += 1
print(f'{len(titles)} titles, {kept} entries kept')
