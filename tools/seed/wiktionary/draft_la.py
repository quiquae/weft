"""Draft Latin rows from the DCC Latin Core Vocabulary, Lewis & Short and English Wiktionary.

usage: draft_la.py <dcc-latin-core.html> <lat.ls.perseus-eng1.xml> <target-la.jsonl> <seed-dir> [--write] [--sample=seed:n]

The candidate list is Dickinson College Commentaries' Latin Core Vocabulary,
the thousand most frequent Latin lemmas, each with a short English
definition (dcc.dickinson.edu/latin-core-list1, CC BY-SA). A word is drafted
for an English word english-core.tsv carries and the Latin pack does not yet
teach, and only where every source agrees:

- DCC's definition names the English word in its first two senses, in DCC's
  part of speech;
- the word's Lewis & Short entry glosses it: an italic run of the entry holds
  the English word outside any parenthesis, and that run is the quote
  la-glosses.tsv carries. A noun's gender is the entry's first <gen> outside
  a parenthesis, as la-genders.tsv was read on 2026-10-06, and it must be
  DCC's;
- its English Wiktionary entry, one etymology only, spells the headword as
  DCC does, macrons and all, agrees on the gender, and its table gives the
  form the row weaves: a noun's one nominative plural, a verb's present
  active infinitive and present active participle;
- the transcription tools/seed/_ipa.py writes for it is the Classical one
  Wiktionary prints, which keeps out a hidden quantity, a consonant i after a
  prefix and a diphthong the spelling cannot show.

Every row is status proposed: woven, labelled unreviewed, not yet read by a
person. Without --write it prints what it would draft and why it skipped the
rest.
"""
import html
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

DCC, LS, TARGET, SEED = sys.argv[1], sys.argv[2], sys.argv[3], Path(sys.argv[4])
WRITE = '--write' in sys.argv
sys.path.insert(0, str(SEED))
from _ipa import latin_ipa  # noqa: E402


def read_tsv(path):
    return [line.split('\t') for line in path.read_text().split('\n') if line.strip() and not line.startswith('#')]


def nfc(w):
    return unicodedata.normalize('NFC', w)


def bare(w):
    """A Wiktionary title: the marks dropped."""
    return nfc(''.join(c for c in unicodedata.normalize('NFD', w) if not unicodedata.combining(c)))


def holds(text, word):
    return re.search(rf'(?<![A-Za-z]){re.escape(word)}(?![A-Za-z])', text, re.I) is not None


# ---------------------------------------------------------------- the pack as it stands
core = {(r[0], r[1]) for r in read_tsv(SEED / 'english-core.tsv')}
lex = read_tsv(SEED / 'lex-la.tsv')
taken = {(r[0], r[1]) for r in lex}
# A Latin headword, its marks dropped, -> the parts of speech it already stands for: the
# pack teaches "tell" as nārrāre, and a draft of narrāre beside it would be a second card
# for one word, told apart by a macron the two dictionaries dispute.
in_use = defaultdict(set)
for r in lex:
    if len(r) > 2 and r[2]:
        in_use[bare(re.sub('[²³⁴⁵⁶⁷⁸⁹]$', '', r[2]))].add(r[1])

# ---------------------------------------------------------------- DCC
POS = {'Noun': 'noun', 'Verb': 'verb', 'Adjective': 'adj', 'Adverb': 'adv'}
dcc = []
page = Path(DCC).read_text(encoding='utf-8')
for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', page, re.S)[1:]:
    cells = [html.unescape(re.sub(r'<[^>]+>', '', c)).strip() for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', tr, re.S)]
    if len(cells) >= 5:
        head_field, definition, pos_field, _group, rank = cells[:5]
        dcc.append({'head': nfc(head_field.split()[0].rstrip(',')), 'field': head_field, 'definition': definition,
                    'pos_field': pos_field, 'pos': POS.get(pos_field.split(':')[0].strip()),
                    'rank': int(rank) if rank.isdigit() else 9999})
dcc.sort(key=lambda d: d['rank'])


def english_for(d):
    """The English words DCC's definition names, in its first two senses."""
    first = re.sub(r'\([^)]*\)', '', d['definition'].split(';')[0])
    out = []
    for chunk in first.split(',')[:2]:
        w = chunk.strip().lower()
        if d['pos'] == 'verb':
            w = re.sub(r'^to ', '', w)
        if d['pos'] == 'noun':
            w = re.sub(r'^(a|an|the) ', '', w)
        if re.fullmatch(r'[a-z]+', w):
            out.append(w)
    return out


def dcc_gender(field):
    marks = {t for t in field.split()[1:] if t in ('m.', 'f.', 'n.', 'c.')}
    return {'m.': 'm', 'f.': 'f', 'n.': 'n', 'c.': 'c'}[marks.pop()] if len(marks) == 1 else None


# ---------------------------------------------------------------- Lewis & Short
ls_by_base = defaultdict(list)  # key without its homograph number -> [(key, xml)]
for m in re.finditer(r'<entryFree[^>]*?key="([^"]+)"[^>]*>.*?</entryFree>', Path(LS).read_text(encoding='utf-8'), re.S):
    key = m.group(1)
    if key[:1].islower() and re.fullmatch(r'[a-z]+\d?', key):
        ls_by_base[re.sub(r'\d$', '', key)].append((key, m.group(0)))


def ls_base(head):
    """Lewis & Short's key for a headword: marks dropped, a consonant i written j."""
    w = bare(head).lower()
    w = re.sub(r'^i(?=[aeiou])', 'j', w)
    return re.sub(r'(?<=[aeiou])i(?=[aeiou])', 'j', w)


def plain(xml):
    return ' '.join(html.unescape(re.sub(r'<[^>]+>', '', xml)).split())


def depth(xml_before):
    text = plain(xml_before)
    return text.count('(') - text.count(')')


LS_GENDER = {'m.': 'm', 'f.': 'f', 'n.': 'n', 'comm.': 'c'}


def ls_gender(xml):
    for m in re.finditer(r'<gen>(.*?)</gen>', xml):
        if depth(xml[:m.start()]) <= 0:
            return LS_GENDER.get(m.group(1).strip())
    return None


def ls_gloss(xml, english):
    """The first italic run of the entry holding the English word outside a parenthesis."""
    for m in re.finditer(r'<hi rend="ital">(.*?)</hi>', xml, re.S):
        run = plain(m.group(1))
        if depth(xml[:m.start()]) <= 0 and holds(re.sub(r'\([^)]*\)', '', run), english):
            return run
    return None


# ---------------------------------------------------------------- English Wiktionary
wikt = defaultdict(list)
for line in open(TARGET, encoding='utf-8'):
    d = json.loads(line)
    wikt[(d['word'], d['pos'])].append(d)


def usable(d):
    return any(not ({'form-of', 'alt-of'} & set((s.get('tags') or []))) for s in (d.get('senses') or []))


def canonical(d):
    return next((f for f in (d.get('forms') or []) if 'canonical' in (f.get('tags') or [])), None)


def cell(d, tags):
    """Every form the table prints in one cell."""
    return [nfc(f['form']) for f in (d.get('forms') or [])
            if tags <= set((f.get('tags') or [])) and f.get('source') in ('declension', 'conjugation')
            and re.fullmatch(r'[a-zāēīōūȳ]+', nfc(f['form']))]


def classical_ipa(d):
    return [s['ipa'] for s in (d.get('sounds') or []) if s.get('ipa') and 'Classical-Latin' in (s.get('tags') or [])]


QUALITY = {'a': 'a', 'ä': 'a', 'e': 'e', 'ɛ': 'e', 'i': 'i', 'ɪ': 'i', 'o': 'o', 'ɔ': 'o', 'u': 'u', 'ʊ': 'u',
           'y': 'y', 'ʏ': 'y'}


def skeleton(ipa):
    """What tests/tools/latin-stress.test.ts holds a transcription to: its syllables' vowels,
    long or short, and which is stressed. kaikki.org's dump carries only Wiktionary's
    phonetic transcription, [ˈfaː.tʊ̃ː], whose nasal vowels and dark l the phonemic one
    the pack writes, /ˈfaːtʊm/, does not show; a nasal vowel's length is therefore not
    compared, and a consonant never is."""
    s = unicodedata.normalize('NFD', ipa.strip('/[]'))
    nuclei, stressed, i = [], None, 0
    while i < len(s):
        ch = s[i]
        if ch == 'ˈ':
            stressed = len(nuclei)
        elif ch in QUALITY:
            j, long, nasal, glide = i + 1, False, False, False
            while j < len(s) and (unicodedata.combining(s[j]) or s[j] == 'ː'):
                long |= s[j] == 'ː'
                nasal |= s[j] == '̃'
                glide |= s[j] == '̯'
                j += 1
            if not glide:
                nuclei.append((QUALITY[ch], None if nasal else long))
            i = j
            continue
        i += 1
    return nuclei, stressed


def agrees(ours, theirs):
    (a, sa), (b, sb) = skeleton(ours), skeleton(theirs)
    return (len(a) == len(b) and (sa or 0) == (sb or 0)
            and all(x[0] == y[0] and (x[1] is None or y[1] is None or x[1] == y[1]) for x, y in zip(a, b)))


GENDER_TAG = {'masculine': 'm', 'feminine': 'f', 'neuter': 'n'}

# ---------------------------------------------------------------- drafting
LETTERS = re.compile(r'[a-zāēīōūȳ]+')
skipped = Counter()
drafted = []
served = set()  # English words already drafted this run

for d in dcc:
    pos = d['pos']
    if pos is None:
        skipped['not a content word'] += 1
        continue
    if pos == 'verb' and ('Irregular' in d['pos_field'] or 'Deponent' in d['pos_field'] or d['head'].endswith('or')):
        skipped['an irregular or deponent verb'] += 1
        continue
    head = d['head']
    if not LETTERS.fullmatch(head):
        skipped['a headword with letters the pack does not write'] += 1
        continue
    if pos == 'noun' and re.search(r'\bpl\.', d['field']):
        skipped['a noun DCC gives only in the plural'] += 1
        continue
    named = [w for w in english_for(d) if (w, pos) in core]
    english = next((w for w in named if (w, pos) not in taken and w not in served), None)
    if english is None:
        skipped['every English word it names is taught already' if named else 'no English word english-core carries'] += 1
        continue
    if bare(head) == english:
        skipped['the same word in English'] += 1
        continue
    entries = [e for e in wikt.get((bare(head), pos), []) if usable(e)]
    entries = [e for e in entries if (canonical(e) or {}).get('form') and nfc(canonical(e)['form']) == head]
    if len(entries) != 1:
        skipped['not one Wiktionary entry spelling the headword as DCC does'] += 1
        continue
    w = entries[0]
    tgt, tgt2, gender, ledgers = head, '', '', {}
    if pos == 'noun':
        tags = {GENDER_TAG[t] for t in canonical(w)['tags'] if t in GENDER_TAG}
        gender = dcc_gender(d['field'])
        if not gender or tags != {gender}:
            skipped['a noun without one gender DCC and Wiktionary agree on'] += 1
            continue
        plural = cell(w, {'nominative', 'plural'})
        if len(plural) == 1:
            tgt2, ledgers['plural'] = plural[0], f'nominative plural {plural[0]}'
    elif pos == 'verb':
        infinitive = cell(w, {'infinitive', 'present', 'active'})
        participle = cell(w, {'participle', 'present', 'active'})
        if len(infinitive) != 1:
            skipped['a verb without one present active infinitive'] += 1
            continue
        tgt = infinitive[0]
        if len(participle) == 1:
            tgt2, ledgers['verb'] = participle[0], f'present active participle {participle[0]}'
    if bare(tgt) in in_use:
        skipped['a word the pack already teaches, or a homograph of one'] += 1
        continue
    # Lewis & Short: the entry that glosses the English word, of DCC's gender for a noun.
    base = ls_base(head)
    found = None
    for key, xml in ls_by_base.get(base, []):
        if pos == 'noun' and ls_gender(xml) != gender:
            continue
        quote = ls_gloss(xml, english)
        if quote:
            found = (key, quote)
            break
    if not found:
        skipped['no Lewis & Short entry glossing it'] += 1
        continue
    # Its sounds, as the generator writes them and as Wiktionary prints them.
    want = classical_ipa(w)
    if not want or not any(agrees(latin_ipa(head), x) for x in want):
        skipped['a transcription Wiktionary does not print'] += 1
        continue
    if re.search(r'ei|eu|ui|su[aeiouāēīōū]|z', tgt + tgt2):
        skipped['a spelling the stress test cannot read'] += 1
        continue
    served.add(english)
    in_use[bare(tgt)].add(pos)
    drafted.append({'lemma': english, 'pos': pos, 'tgt': tgt, 'tgt2': tgt2, 'gender': gender,
                    'ls': found[0], 'quote': found[1], 'title': bare(head), 'rank': d['rank'], **ledgers})

# ---------------------------------------------------------------- writing
SOURCE_NOTE = (
    '# ---- drafted from the DCC Latin Core Vocabulary, Lewis & Short and English Wiktionary '
    '(kaikki.org dump of 2026-11-10), status=proposed: woven, labelled, not yet read by a person ----'
)


def append(name, rows):
    if not rows:
        return
    p = SEED / name
    text = p.read_text()
    if not text.endswith('\n'):
        text += '\n'
    if SOURCE_NOTE not in text:
        text += f'{SOURCE_NOTE}\n'
    text += ''.join('\t'.join(r) + '\n' for r in rows)
    p.write_text(text)


if WRITE and drafted:
    append('lex-la.tsv', [[r['lemma'], r['pos'], r['tgt'], r['tgt2'], r['gender'], '', '', '', '', 'dcc', 'proposed']
                          for r in drafted])
    append('la-glosses.tsv', [[r['lemma'], r['pos'], r['tgt'], f"ls:{r['ls']}", r['quote'], ''] for r in drafted])
    append('la-genders.tsv', [[r['lemma'], r['tgt'], r['gender'], f"ls:{r['ls']}"] for r in drafted if r['pos'] == 'noun'])
    append('la-plurals.tsv', [[r['lemma'], r['tgt'], r['tgt2'], f"wikt:la:{r['title']}", r['plural']]
                              for r in drafted if r['pos'] == 'noun' and r['tgt2']])
    append('la-verb-forms.tsv', [[r['lemma'], r['tgt'], r['tgt2'], f"wikt:la:{re.sub(r'[0-9]$', '', r['ls']).replace('j', 'i')}",
                                  r['verb']] for r in drafted if r['pos'] == 'verb' and r['tgt2']])
    ids_path = SEED / 'card-ids.tsv'
    lines = ids_path.read_text().split('\n')
    header = [line for line in lines if line.startswith('#')]
    ids = {tuple(line.split('\t')) for line in lines if line.strip() and not line.startswith('#')}
    ids |= {('la', r['tgt']) for r in drafted}
    body = sorted(ids, key=lambda i: f'{i[0]}\t{i[1]}'.encode('utf-16-be'))
    ids_path.write_text('\n'.join(header + [''] + ['\t'.join(i) for i in body]) + '\n')
    print(f'wrote {len(drafted)} rows into {SEED}')

# ---------------------------------------------------------------- report
import random  # noqa: E402

print(f'la: {len(dcc)} DCC lemmas read, {len(drafted)} drafted, skipped {dict(skipped)}')
print('  by part of speech:', dict(Counter(r['pos'] for r in drafted)))
seed_n = next((a.split('=')[1] for a in sys.argv if a.startswith('--sample=')), '9:40').split(':')
for r in random.Random(int(seed_n[0])).sample(drafted, min(int(seed_n[1]), len(drafted))):
    print(f"  {r['lemma']:12} {r['pos']:5} {r['tgt']:14} {r['tgt2']:14} {r['gender']:1} ls:{r['ls']:10} | {r['quote'][:60]}")
