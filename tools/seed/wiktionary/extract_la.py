"""Cut kaikki.org's Latin dump down to the entries whose title is a DCC core headword."""
import gzip, html, json, re, sys, unicodedata

DCC, DUMP, OUT = sys.argv[1], sys.argv[2], sys.argv[3]

def bare(w):
    return ''.join(c for c in unicodedata.normalize('NFD', w) if not unicodedata.combining(c))

text = open(DCC, encoding='utf-8').read()
titles = set()
for r in re.findall(r'<tr[^>]*>(.*?)</tr>', text, re.S)[1:]:
    cells = [html.unescape(re.sub(r'<[^>]+>', '', c)).strip() for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.S)]
    if cells:
        titles.add(bare(cells[0].split()[0]))
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
