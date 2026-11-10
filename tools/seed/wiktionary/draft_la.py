"""Draft Latin rows from two candidate sources, held to one set of checks.

usage: draft_la.py <dcc-latin-core.html> <lat.ls.perseus-eng1.xml> <target-la.jsonl> <seed-dir>
                   [--translations=<en-extract.jsonl>] [--limit=n] [--exclude=word,...] [--write] [--sample=seed:n]

The candidates come from Dickinson College Commentaries' Latin Core
Vocabulary, the thousand most frequent Latin lemmas, each with a short
English definition (dcc.dickinson.edu/latin-core-list1, CC BY-SA); and, given
--translations, from English Wiktionary's translation tables as extract_en.py
cuts them out of kaikki.org's English dump: for each English word, most
frequent first, the Latin words the tables of its first two senses name. A
word is drafted for an English word english-core.tsv carries and the Latin
pack does not yet teach, and only where every source agrees:

- DCC's definition names the English word in its first two senses, in DCC's
  part of speech; or a translation table of the English word's first two
  senses names the Latin word, untagged by period, register or number;
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

Where a translation table names several Latin words that pass, the one whose
Lewis & Short entry leads with the English word wins, then the one the table
lists first: "build" names mūniō, to wall, before aedificō, to build.
--limit caps the translation drafts, and --exclude names Latin headwords to
pass over, for a word a check downstream refuses.

Every row is status proposed: woven, labelled unreviewed, not yet read by a
person. A row is decided_by dcc or wiktionary, the source that named it.
Without --write it prints what it would draft and why it skipped the rest.
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


def option(name, default=None):
    return next((a.split('=', 1)[1] for a in sys.argv if a.startswith(f'--{name}=')), default)


TRANSLATIONS = option('translations')
LIMIT = int(option('limit', '0')) or None
EXCLUDE = set(filter(None, option('exclude', '').split(',')))
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
core_rows = read_tsv(SEED / 'english-core.tsv')
core = {(r[0], r[1]) for r in core_rows}
zipf = {(r[0], r[1]): float(r[2]) for r in core_rows}
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


def headline(d):
    """The headword line, "verbum n (genitive verbī); second declension", up to its parenthesis."""
    exp = next((h['expansion'] for h in (d.get('head_templates') or []) if h.get('expansion')), '')
    return exp.split('(')[0].split()


def headword(d):
    """The headword as Wiktionary prints it. kaikki writes a canonical form only where it differs
    from the page's title, mēnsis on the page mensis; verbum, cattus and magnus print the title."""
    can = canonical(d)
    if can and can.get('form'):
        return nfc(can['form'])
    line = headline(d)
    return nfc(d['word']) if line and nfc(line[0]) == nfc(d['word']) else None


def genders(d):
    """A noun's genders as its headword line prints them, or None for a noun used only in the
    plural: "verbum n", "cīvis m or f", "castra n pl"."""
    line = headline(d)[1:]
    if 'pl' in line:
        return None
    marks = {t for t in line if t in ('m', 'f', 'n')}
    can = canonical(d)
    tags = {GENDER_TAG[t] for t in ((can or {}).get('tags') or []) if t in GENDER_TAG}
    return marks if not tags or tags == marks else tags | marks


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

# ---------------------------------------------------------------- the checks, one copy for both sources
LETTERS = re.compile(r'[a-zāēīōūȳ]+')
IRREGULAR = re.compile(r'irregular|suppletive')


def irregular(w):
    """Wiktionary's headword line names an irregular or suppletive conjugation: eō, ferō, volō."""
    return any(IRREGULAR.search(h.get('expansion') or '') for h in (w.get('head_templates') or []))


def ls_leads(xml, english):
    """Whether the entry's leading gloss, its first italic run outside a parenthesis, holds the English word."""
    for m in re.finditer(r'<hi rend="ital">(.*?)</hi>', xml, re.S):
        if depth(xml[:m.start()]) <= 0:
            return holds(re.sub(r'\([^)]*\)', '', plain(m.group(1))), english)
    return False


def check(head, english, pos, gender_hint=None):
    """The row every source agrees on for `head` standing for `english`, or None and why not."""
    if head in EXCLUDE:
        return None, 'excluded by name'
    if not LETTERS.fullmatch(head):
        return None, 'a headword with letters the pack does not write'
    if bare(head) == english:
        return None, 'the same word in English'
    entries = [e for e in wikt.get((bare(head), pos), []) if usable(e) and headword(e) == head]
    if len(entries) != 1:
        return None, 'not one Wiktionary entry spelling the headword so'
    w = entries[0]
    tgt, tgt2, gender, ledgers = head, '', '', {}
    if pos == 'noun':
        tags = genders(w)
        if tags is None:
            return None, 'a noun Wiktionary gives only in the plural'
        if len(tags) != 1 or (gender_hint and tags != {gender_hint}):
            return None, 'a noun without one gender its sources agree on'
        gender = next(iter(tags))
        plural = cell(w, {'nominative', 'plural'})
        if len(plural) == 1:
            tgt2, ledgers['plural'] = plural[0], f'nominative plural {plural[0]}'
    elif pos == 'verb':
        if head.endswith('or') or irregular(w):
            return None, 'an irregular or deponent verb'
        infinitive = cell(w, {'infinitive', 'present', 'active'})
        participle = cell(w, {'participle', 'present', 'active'})
        if len(infinitive) != 1:
            return None, 'a verb without one present active infinitive'
        tgt = infinitive[0]
        if len(participle) == 1:
            tgt2, ledgers['verb'] = participle[0], f'present active participle {participle[0]}'
    if bare(tgt) in in_use:
        return None, 'a word the pack already teaches, or a homograph of one'
    # Lewis & Short: the entry that glosses the English word, of the noun's gender.
    found = None
    for key, xml in ls_by_base.get(ls_base(head), []):
        if pos == 'noun' and ls_gender(xml) != gender:
            continue
        quote = ls_gloss(xml, english)
        if quote:
            found = (key, quote, ls_leads(xml, english))
            break
    if not found:
        return None, 'no Lewis & Short entry glossing it'
    # Its sounds, as the generator writes them and as Wiktionary prints them.
    want = classical_ipa(w)
    if not want or not any(agrees(latin_ipa(head), x) for x in want):
        return None, 'a transcription Wiktionary does not print'
    if re.search(r'ei|eu|ui|su[aeiouāēīōū]|z', tgt + tgt2):
        return None, 'a spelling the stress test cannot read'
    return {'lemma': english, 'pos': pos, 'tgt': tgt, 'tgt2': tgt2, 'gender': gender, 'ls': found[0],
            'quote': found[1], 'leads': found[2], 'title': bare(head), **ledgers}, None


skipped = Counter()  # per candidate: a DCC lemma, or an English word the tables are read for
tried = Counter()  # per Latin word a translation table names, why it did not pass
drafted = []
served = set()  # English words already drafted this run


def accept(row, source):
    served.add(row['lemma'])
    in_use[bare(row['tgt'])].add(row['pos'])
    drafted.append({**row, 'source': source})


# ---------------------------------------------------------------- source 1: DCC
for d in dcc:
    pos = d['pos']
    if pos is None:
        skipped['dcc: not a content word'] += 1
        continue
    if pos == 'verb' and ('Irregular' in d['pos_field'] or 'Deponent' in d['pos_field'] or d['head'].endswith('or')):
        skipped['dcc: an irregular or deponent verb'] += 1
        continue
    if pos == 'noun' and re.search(r'\bpl\.', d['field']):
        skipped['dcc: a noun DCC gives only in the plural'] += 1
        continue
    named = [w for w in english_for(d) if (w, pos) in core]
    english = next((w for w in named if (w, pos) not in taken and w not in served), None)
    if english is None:
        skipped['dcc: every English word it names is taught already' if named else 'dcc: no English word english-core carries'] += 1
        continue
    hint = dcc_gender(d['field']) if pos == 'noun' else None
    if pos == 'noun' and not hint:
        skipped['dcc: a noun without one gender its sources agree on'] += 1
        continue
    row, why = check(d['head'], english, pos, hint)
    if row is None:
        skipped[f'dcc: {why}'] += 1
        continue
    accept({**row, 'rank': d['rank']}, 'dcc')

# ---------------------------------------------------------------- source 2: English Wiktionary's translation tables
# Read the way draft.py reads them, so a Latin draft and a modern one take a table's
# first two senses alike.
BAD_TAGS = {
    'archaic', 'obsolete', 'rare', 'dialectal', 'slang', 'vulgar', 'colloquial', 'informal',
    'regional', 'dated', 'poetic', 'literary', 'humorous', 'derogatory', 'offensive', 'figuratively',
    'abbreviation', 'diminutive', 'augmentative', 'nonstandard', 'proscribed', 'misspelling',
    'plural',  # aedēs f pl, a house: a noun Latin uses only in the plural for this sense
}
MODERN = ('fr', 'es', 'de', 'it', 'pt')


def clean(t):
    """Untagged by period, register or number, and one word in the pack's letters: Medieval
    Latin, Late Latin and New Latin come tagged, and a capitalized word is a name."""
    tags = set(t.get('tags') or [])
    return (not (tags & BAD_TAGS) and not any(x[:1].isupper() and not x.startswith('Classical') for x in tags)
            and LETTERS.fullmatch(nfc(t['word'])) is not None)


def sense_index(e, label):
    want = set(re.findall(r'[a-z]{3,}', (label or '').lower()))
    best, best_i = 0, len(e['senses'])
    for i, sense in enumerate(e['senses']):
        overlap = len(want & set(re.findall(r'[a-z]{3,}', sense['gloss'].lower())))
        if overlap > best:
            best, best_i = overlap, i
    return best_i


def sense_key(e, t):
    """The English sense a translation translates: the sense kaikki matched its table to, or the
    one whose gloss its table's label overlaps most."""
    return t['si'] if t.get('si') is not None else sense_index(e, t.get('sense'))


def tables(e, code):
    """One language's translations, grouped by the English sense they translate, earliest sense first."""
    out = defaultdict(list)
    for t in e['translations']:
        if t['code'] == code:
            out[sense_key(e, t)].append(t)
    return [out[i] for i in sorted(out)]


def plain_word(t):
    """draft.py's reading of a modern translation: untagged, and one word."""
    tags = set(t.get('tags') or [])
    return not (tags & BAD_TAGS) and not any(x[:1].isupper() for x in tags) and ' ' not in t['word'] and "'" not in t['word']


def distinct(e, code):
    return len({t['word'] for table in tables(e, code) for t in table if plain_word(t)})


translated = 0
if TRANSLATIONS:
    english_entries = defaultdict(list)
    for line in open(TRANSLATIONS, encoding='utf-8'):
        e = json.loads(line)
        english_entries[(e['word'], e['pos'])].append(e)
    wanted = sorted((k for k in core if k not in taken and re.fullmatch(r'[a-z]+', k[0]) and k[1] in POS.values()),
                    key=lambda k: (-zipf[k], k))
    for lemma, pos in wanted:
        if LIMIT and translated >= LIMIT:
            break
        if lemma in served:
            skipped['tables: an English word drafted already this run'] += 1
            continue
        group = english_entries.get((lemma, pos))
        if not group:
            skipped['tables: no English Wiktionary entry of this part of speech'] += 1
            continue
        # draft.py's two etymologies, both translated: "temple", building and brow.
        counts = sorted((len(g['translations']) for g in group), reverse=True)
        if len(counts) > 1 and counts[1] >= max(10, counts[0] / 2):
            skipped['tables: two etymologies, both translated'] += 1
            continue
        e = max(group, key=lambda g: len(g['translations']))
        # draft.py's measure of an English word's spread of senses, which a spot check fitted:
        # more than three distinct translations in the modern languages, on average, is a guess.
        if max(1, round(sum(distinct(e, c) for c in MODERN) / len(MODERN))) > 3:
            skipped['tables: ambiguous, more than 3 distinct translations'] += 1
            continue
        # draft.py's first two tables. Where Latin has no table for the English word's first
        # sense they are a lesser sense's, traffic's commerce and foil's fencing: those are
        # excluded by name, and see TODO.md's Notes for the two narrower rules that cost more
        # right words than they saved.
        heads = []
        for table in tables(e, 'la')[:2]:
            for t in table:
                word = nfc(t['word'])
                if clean(t) and word not in [h for h, _ in heads]:
                    marked = {GENDER_TAG[x] for x in (t.get('tags') or []) if x in GENDER_TAG}
                    heads.append((word, marked.pop() if len(marked) == 1 else None))
        if not heads:
            skipped['tables: no clean Latin translation in its first two senses'] += 1
            continue
        passed, first_why = [], None
        for i, (head, hint) in enumerate(heads):
            row, why = check(head, lemma, pos, hint)
            if row is None:
                tried[why] += 1
                first_why = first_why or why
            else:
                passed.append((not row['leads'], i, row))
        if not passed:
            skipped[f'tables: no translation passed, the first because {first_why}'] += 1
            continue
        accept(min(passed, key=lambda x: (x[0], x[1]))[2], 'wiktionary')
        translated += 1

# ---------------------------------------------------------------- writing
NOTES = {
    'dcc': '# ---- drafted from the DCC Latin Core Vocabulary, Lewis & Short and English Wiktionary '
           '(kaikki.org dump of 2026-11-10), status=proposed: woven, labelled, not yet read by a person ----',
    'wiktionary': "# ---- drafted from English Wiktionary's translation tables, Lewis & Short and English Wiktionary's "
                  'Latin entries (kaikki.org dumps downloaded 2026-11-10), status=proposed: woven, labelled, '
                  'not yet read by a person ----',
}


def append(name, rows, note):
    if not rows:
        return
    p = SEED / name
    text = p.read_text()
    if not text.endswith('\n'):
        text += '\n'
    notes = [line for line in text.split('\n') if line.startswith('# ---- drafted from')]
    if not notes or notes[-1] != note:
        text += f'{note}\n'
    text += ''.join('\t'.join(r) + '\n' for r in rows)
    p.write_text(text)


if WRITE and drafted:
    for source, note in NOTES.items():
        rows = [r for r in drafted if r['source'] == source]
        append('lex-la.tsv', [[r['lemma'], r['pos'], r['tgt'], r['tgt2'], r['gender'], '', '', '', '', source, 'proposed']
                              for r in rows], note)
        append('la-glosses.tsv', [[r['lemma'], r['pos'], r['tgt'], f"ls:{r['ls']}", r['quote'], ''] for r in rows], note)
        append('la-genders.tsv', [[r['lemma'], r['tgt'], r['gender'], f"ls:{r['ls']}"] for r in rows if r['pos'] == 'noun'],
               note)
        append('la-plurals.tsv', [[r['lemma'], r['tgt'], r['tgt2'], f"wikt:la:{r['title']}", r['plural']]
                                  for r in rows if r['pos'] == 'noun' and r['tgt2']], note)
        append('la-verb-forms.tsv', [[r['lemma'], r['tgt'], r['tgt2'],
                                      f"wikt:la:{re.sub(r'[0-9]$', '', r['ls']).replace('j', 'i')}", r['verb']]
                                     for r in rows if r['pos'] == 'verb' and r['tgt2']], note)
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

print(f'la: {len(dcc)} DCC lemmas read, {len(drafted)} drafted: {dict(Counter(r["source"] for r in drafted))}')
for why, n in sorted(skipped.items(), key=lambda kv: -kv[1]):
    print(f'  skipped {n:5}  {why}')
for why, n in sorted(tried.items(), key=lambda kv: -kv[1]):
    print(f'  a table word failed {n:5}  {why}')
print('  by part of speech:', dict(Counter(r['pos'] for r in drafted)))
print('  leading with the English word:', sum(1 for r in drafted if r['leads']), 'of', len(drafted))
seed_n = option('sample', '9:40').split(':')
for r in random.Random(int(seed_n[0])).sample(drafted, min(int(seed_n[1]), len(drafted))):
    print(f"  {r['source'][:4]} {r['lemma']:12} {r['pos']:5} {r['tgt']:14} {r['tgt2']:14} {r['gender']:1} {'L' if r['leads'] else ' '} "
          f"ls:{r['ls']:10} | {r['quote'][:70]}")
