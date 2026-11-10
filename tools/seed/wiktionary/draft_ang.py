"""Draft Old English rows from English Wiktionary's translation tables, held to the checked rows' ledgers.

usage: draft_ang.py <en-extract.jsonl> <kaikki Old English dump> <seed-dir>
                    [--limit=n] [--exclude=word,...] [--singular=word,...] [--write] [--sample=seed:n]

For each English word english-core.tsv carries and the Old English pack does
not yet teach, most frequent first, the Old English words the first two
translation tables of its English Wiktionary entry name, read as draft_la.py
reads the Latin ones. A word is drafted only where English Wiktionary's own
Old English entry bears it out, so that every ledger a checked row is held to
holds the draft too:

- one entry, of one etymology, spells the headword as the table does, marks
  and all, and one of its first two definition lines holds the English word
  outside any parenthesis: that line is the quote ang-glosses.tsv carries,
  citing wikt:ang:<title>;
- a noun has one gender, the canonical form's, and the table's where it gives
  one (ang-genders.tsv); its woven plural is the first form of the table's
  nominative plural cell, and the cell is quoted whole (ang-plurals.tsv,
  tests/tools/ang-forms.test.ts);
- a verb's woven form is the table's present participle (ang-verb-forms.tsv);
- the headword is one tests/tools/old-english-stress.test.ts can read with no
  list beside it: no letter it does not know, no particle of Wright's at its
  start, which would want reading in Wright and a line in COMPOUNDED or
  SIMPLE, and no undotted g where Wright makes it palatal;
- the pack does not already teach it, under any part of speech, its marks
  dropped and ð read as þ: a second card for one word is a homograph nobody
  numbered.

Rows carry no etymon: whether a drafted word became the English word it is
woven for is a claim about the English word, which ang-etymons.tsv checks
against its own entry, and nothing here reads one.

The pack writes the doubled palatal cg where Wiktionary writes ċġ (the
pronunciation key's "cg is dg"), so a draft does too. --limit caps the
drafts, most frequent English word first; --exclude names Old English
headwords to pass over; --singular names nouns woven in the singular only.
Every row is status proposed: woven, labelled "Wiktionary, unreviewed", not
yet read by a person. Without --write it prints what it would draft and why
it skipped the rest.
"""
import gzip
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

EN, DUMP, SEED = sys.argv[1], sys.argv[2], Path(sys.argv[3])
WRITE = '--write' in sys.argv


def option(name, default=None):
    return next((a.split('=', 1)[1] for a in sys.argv if a.startswith(f'--{name}=')), default)


LIMIT = int(option('limit', '0')) or None
EXCLUDE = set(filter(None, option('exclude', '').split(',')))
SINGULAR = set(filter(None, option('singular', '').split(',')))


def read_tsv(path):
    return [line.split('\t') for line in path.read_text().split('\n') if line.strip() and not line.startswith('#')]


def nfc(w):
    return unicodedata.normalize('NFC', w)


def bare(w):
    """A Wiktionary title: macrons and the dots of ċ and ġ dropped."""
    return nfc(''.join(c for c in unicodedata.normalize('NFD', w) if not unicodedata.combining(c)))


def same(w):
    """One word however a teaching edition spells it: marks dropped, ð read as þ."""
    return bare(re.sub('[²³⁴⁵⁶⁷⁸⁹]$', '', w)).replace('ð', 'þ')


def holds(text, word):
    return re.search(rf'(?<![A-Za-z]){re.escape(word)}(?![A-Za-z])', text, re.I) is not None


# ---------------------------------------------------------------- the pack as it stands
core_rows = read_tsv(SEED / 'english-core.tsv')
core = {(r[0], r[1]) for r in core_rows}
zipf = {(r[0], r[1]): float(r[2]) for r in core_rows}
lex = read_tsv(SEED / 'lex-ang.tsv')
taken = {(r[0], r[1]) for r in lex}
in_use = defaultdict(set)
for r in lex:
    if len(r) > 2 and r[2]:
        in_use[same(r[2])].add(r[1])

# ---------------------------------------------------------------- what the stress test can read
# tests/tools/old-english-stress.test.ts: its letters, Wright's particles, and the
# positions §§313–324 give the guttural g.
VOWELS = 'aāæǣeēiīoōuūyȳ'
LETTERS = re.compile(f'[{VOWELS}bcċdfgġhklmnprstwxþð]+')
PARTICLES = ['ā', 'ǣ', 'æf', 'æfter', 'æt', 'an', 'and', 'be', 'bi', 'ed', 'for', 'fore', 'fram', 'ful',
             'ġe', 'in', 'mid', 'mis', 'of', 'ofer', 'on', 'or', 'oþ', 'sam', 'sin', 'tō', 'þri', 'þurh',
             'un', 'under', 'wiþ', 'wiþer', 'ymb']
BACK, FRONT = 'aāoōuū', 'iīeēæǣyȳ'
VOICED = set(VOWELS + 'bdgġlmnrw')


def particle(word):
    return next((p for p in PARTICLES if word.startswith(p) and word != p), None)


def unkeyed(word):
    """Why the pronunciation key or the stress test would read `word` otherwise than the generator
    writes it, or None. ċċ is one long sound under two letters the key counts as two "ch"; the
    generator writes nġ /ndʒ/ where the key says ġ is "y"; and an h inside a word before a vowel,
    w, l, r or n begins an element of a compound, lǣċe-hūs, bōc-hūs, which the generator and the
    stress test both write as the spirant x, where it is the h a word begins with."""
    if 'ċċ' in word:
        return 'a doubled ċ, one sound under two letters'
    if 'nġ' in word:
        return 'an nġ, which the generator writes /ndʒ/'
    if re.search(f'(?<=.)h[{VOWELS}wlrn]', word):
        return 'an h beginning a second element'
    return None


def palatal_g(word, pos):
    """Why an undotted g of `word` is not the guttural one Wright gives where it stands, or None:
    gsOf() in the stress test, for a word with no division."""
    for i, ch in enumerate(word):
        if ch != 'g':
            continue
        prev, nxt = word[i - 1] if i else '', word[i + 1] if i + 1 < len(word) else ''
        if prev == 'c':
            continue
        if prev == 'g' or nxt == 'g':
            return 'a doubled g'
        if i == 0 or prev == 'n':
            continue
        if not nxt:
            if prev in FRONT:
                return 'a final g after a palatal vowel, undotted'
            if prev not in 'lr' and prev not in BACK:
                return f'a final g after {prev}'
            continue
        if nxt not in VOWELS and nxt in VOICED and (prev in BACK or prev in 'lr'):
            continue
        if nxt not in VOWELS or not (prev in VOWELS or prev in 'lr'):
            return f'a g between {prev} and {nxt}'
        weak = pos == 'verb' and re.match(r'i(an|end)', word[i + 1:])
        if not weak and prev in FRONT and nxt in FRONT:
            return 'a g between palatal vowels, undotted'
    return None


# ---------------------------------------------------------------- English Wiktionary's Old English entries
english = defaultdict(list)
for line in open(EN, encoding='utf-8'):
    e = json.loads(line)
    english[(e['word'], e['pos'])].append(e)
named = {bare(t['word']) for group in english.values() for e in group for t in e['translations'] if t['code'] == 'ang'}

POS = {'noun', 'verb', 'adj', 'adv'}
wikt = defaultdict(list)
with gzip.open(DUMP, 'rt', encoding='utf-8') as f:
    for line in f:
        d = json.loads(line)
        if d.get('lang_code') == 'ang' and d.get('pos') in POS and d.get('word') in named:
            wikt[(d['word'], d['pos'])].append(d)


def usable(d):
    return any(not ({'form-of', 'alt-of'} & set(s.get('tags') or [])) for s in (d.get('senses') or []))


def headword(d):
    """The headword as Wiktionary prints it: the canonical form, where it differs from the title."""
    can = next((f for f in (d.get('forms') or []) if 'canonical' in (f.get('tags') or [])), None)
    return nfc(can['form']) if can and can.get('form') else nfc(d['word'])


GENDER_TAG = {'masculine': 'm', 'feminine': 'f', 'neuter': 'n'}


def genders(d):
    can = next((f for f in (d.get('forms') or []) if 'canonical' in (f.get('tags') or [])), None)
    tags = {GENDER_TAG[t] for t in ((can or {}).get('tags') or []) if t in GENDER_TAG}
    args = {v for h in (d.get('head_templates') or []) for k, v in (h.get('args') or {}).items()
            if k in ('1', 'g', 'g2') and v in ('m', 'f', 'n')}
    return tags | args


def cell(d, tags, source):
    """Every form one cell of the table prints, in its order."""
    out = []
    for f in d.get('forms') or []:
        form = nfc(f.get('form') or '')
        if tags <= set(f.get('tags') or []) and f.get('source') == source and LETTERS.fullmatch(form) and form not in out:
            out.append(form)
    return out


def senses(d):
    """The entry's definition lines, a form-of line or an obsolete one aside."""
    return [(s.get('glosses') or [''])[0] for s in (d.get('senses') or [])
            if not ({'form-of', 'alt-of', 'obsolete', 'rare'} & set(s.get('tags') or [])) and s.get('glosses')]


def palatal_cg(w):
    return w.replace('ċġ', 'cg')


def check(head, eng, pos, hint=None):
    """The row English Wiktionary bears out for `head` standing for `eng`, or None and why not."""
    word = palatal_cg(head)
    if head in EXCLUDE or word in EXCLUDE:
        return None, 'excluded by name'
    if not LETTERS.fullmatch(word):
        return None, 'a letter the stress test does not read'
    if bare(word) == eng:
        return None, 'the same word in English'
    if particle(word):
        return None, f'it begins with Wright’s particle {particle(word)}-'
    # Wiktionary writes the unstressed verbal prefix a- short, alibban "to survive" beside
    # Wright's ābīdan, so the particle list cannot see it, and the generator would stress it.
    if pos == 'verb' and re.match(f'a[^{VOWELS}]', word):
        return None, 'a verb beginning a-, which may be Wright’s unstressed ā-'
    why = palatal_g(word, pos) or unkeyed(word)
    if why:
        return None, why
    entries = [e for e in wikt.get((bare(head), pos), []) if usable(e) and headword(e) == head]
    if len(entries) != 1:
        return None, 'not one Wiktionary entry spelling the headword so'
    w = entries[0]
    lines = senses(w)[:2]
    quote = next((g for g in lines if holds(re.sub(r'\([^)]*\)', '', g), eng)), None)
    if not quote:
        return None, 'neither of its first two definition lines holds the English word'
    if re.search(r'\[\[|\]\]|\{\{|\}\}|<[a-z/]', quote, re.I):
        return None, 'a definition line with markup in it'
    tgt2, gender, forms = '', '', []
    if pos == 'noun':
        tags = genders(w)
        if len(tags) != 1 or (hint and tags != {hint}):
            return None, 'a noun without one gender its sources agree on'
        gender = next(iter(tags))
        forms = [palatal_cg(f) for f in cell(w, {'nominative', 'plural'}, 'declension')]
        if forms and head not in SINGULAR:
            tgt2 = forms[0]
    elif pos == 'verb':
        # kaikki.org tags the participle row of an Old English table as the row above it,
        # the imperative: berende is ['imperative', 'present'] and boren ['imperative', 'past'].
        # A row's own imperatives carry a number, and a present participle ends in -ende.
        forms = [palatal_cg(nfc(f['form'])) for f in (w.get('forms') or [])
                 if set(f.get('tags') or []) == {'imperative', 'present'} and f.get('source') == 'conjugation'
                 and LETTERS.fullmatch(nfc(f.get('form') or '')) and nfc(f['form']).endswith('ende')]
        forms = list(dict.fromkeys(forms))
        if forms:
            tgt2 = forms[0]
    if tgt2:
        if not LETTERS.fullmatch(tgt2):
            return None, 'a second form with a letter the stress test does not read'
        why = palatal_g(tgt2, pos) or unkeyed(tgt2)
        if why:
            return None, f'its second form has {why}'
    if same(word) in in_use:
        return None, 'a word the pack already teaches, or a homograph of one'
    return {'lemma': eng, 'pos': pos, 'tgt': word, 'tgt2': tgt2, 'gender': gender, 'quote': quote,
            'leads': quote == lines[0], 'title': bare(head), 'forms': forms}, None


# ---------------------------------------------------------------- the tables, read as draft_la.py reads them
BAD_TAGS = {
    'archaic', 'obsolete', 'rare', 'dialectal', 'slang', 'vulgar', 'colloquial', 'informal',
    'regional', 'dated', 'poetic', 'literary', 'humorous', 'derogatory', 'offensive', 'figuratively',
    'abbreviation', 'diminutive', 'augmentative', 'nonstandard', 'proscribed', 'misspelling', 'plural',
}
MODERN = ('fr', 'es', 'de', 'it', 'pt')


def clean(t):
    """Untagged by register, dialect or number, and one word: a capitalized tag is a dialect, Anglian or Northumbrian."""
    tags = set(t.get('tags') or [])
    return not (tags & BAD_TAGS) and not any(x[:1].isupper() for x in tags) and ' ' not in t['word']


def sense_index(e, label):
    want = set(re.findall(r'[a-z]{3,}', (label or '').lower()))
    best, best_i = 0, len(e['senses'])
    for i, sense in enumerate(e['senses']):
        overlap = len(want & set(re.findall(r'[a-z]{3,}', sense['gloss'].lower())))
        if overlap > best:
            best, best_i = overlap, i
    return best_i


def tables(e, code):
    out = defaultdict(list)
    for t in e['translations']:
        if t['code'] == code:
            out[t['si'] if t.get('si') is not None else sense_index(e, t.get('sense'))].append(t)
    return [out[i] for i in sorted(out)]


def plain_word(t):
    tags = set(t.get('tags') or [])
    return not (tags & BAD_TAGS) and not any(x[:1].isupper() for x in tags) and ' ' not in t['word'] and "'" not in t['word']


def distinct(e, code):
    return len({t['word'] for table in tables(e, code) for t in table if plain_word(t)})


skipped, tried, drafted = Counter(), Counter(), []
wanted = sorted((k for k in core if k not in taken and re.fullmatch(r'[a-z]+', k[0]) and k[1] in POS),
                key=lambda k: (-zipf[k], k))
for lemma, pos in wanted:
    if LIMIT and len(drafted) >= LIMIT:
        break
    group = english.get((lemma, pos))
    if not group:
        skipped['no English Wiktionary entry of this part of speech'] += 1
        continue
    counts = sorted((len(g['translations']) for g in group), reverse=True)
    if len(counts) > 1 and counts[1] >= max(10, counts[0] / 2):
        skipped['two etymologies, both translated'] += 1
        continue
    e = max(group, key=lambda g: len(g['translations']))
    if max(1, round(sum(distinct(e, c) for c in MODERN) / len(MODERN))) > 3:
        skipped['ambiguous, more than 3 distinct translations'] += 1
        continue
    heads = []
    for table in tables(e, 'ang')[:2]:
        for t in table:
            word = nfc(t['word'])
            if clean(t) and word not in [h for h, _ in heads]:
                marked = {GENDER_TAG[x] for x in (t.get('tags') or []) if x in GENDER_TAG}
                heads.append((word, marked.pop() if len(marked) == 1 else None))
    if not heads:
        skipped['no clean Old English translation in its first two senses'] += 1
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
        skipped[f'no translation passed, the first because {first_why}'] += 1
        continue
    row = min(passed, key=lambda x: (x[0], x[1]))[2]
    in_use[same(row['tgt'])].add(pos)
    drafted.append(row)

# ---------------------------------------------------------------- writing
NOTE = ("# ---- drafted from English Wiktionary's translation tables and its Old English entries "
        '(kaikki.org dumps downloaded 2026-11-10), status=proposed: woven, labelled, not yet read by a person ----')


def append(name, rows):
    if not rows:
        return
    p = SEED / name
    text = p.read_text()
    if not text.endswith('\n'):
        text += '\n'
    notes = [line for line in text.split('\n') if line.startswith('# ---- drafted from')]
    if not notes or notes[-1] != NOTE:
        text += f'{NOTE}\n'
    text += ''.join('\t'.join(r) + '\n' for r in rows)
    p.write_text(text)


if WRITE and drafted:
    append('lex-ang.tsv', [[r['lemma'], r['pos'], r['tgt'], r['tgt2'], r['gender'], '', '', '', '', 'wiktionary', 'proposed']
                           for r in drafted])
    append('ang-glosses.tsv', [[r['lemma'], r['pos'], r['tgt'], f"wikt:ang:{r['title']}", r['quote']] for r in drafted])
    append('ang-genders.tsv', [[r['lemma'], r['tgt'], r['gender'], f"wikt:ang:{r['title']}"] for r in drafted if r['pos'] == 'noun'])
    append('ang-plurals.tsv', [[r['lemma'], r['tgt'], r['tgt2'], f"wikt:ang:{r['title']}", 'nominative plural ' + ', '.join(r['forms'])]
                               for r in drafted if r['pos'] == 'noun' and r['tgt2']])
    append('ang-verb-forms.tsv', [[r['lemma'], r['tgt'], r['tgt2'], f"wikt:ang:{r['title']}", 'present participle ' + ', '.join(r['forms'])]
                                  for r in drafted if r['pos'] == 'verb' and r['tgt2']])
    ids_path = SEED / 'card-ids.tsv'
    lines = ids_path.read_text().split('\n')
    header = [line for line in lines if line.startswith('#')]
    ids = {tuple(line.split('\t')) for line in lines if line.strip() and not line.startswith('#')}
    ids |= {('ang', r['tgt']) for r in drafted}
    body = sorted(ids, key=lambda i: f'{i[0]}\t{i[1]}'.encode('utf-16-be'))
    ids_path.write_text('\n'.join(header + [''] + ['\t'.join(i) for i in body]) + '\n')
    print(f'wrote {len(drafted)} rows into {SEED}')

# ---------------------------------------------------------------- report
import random  # noqa: E402

print(f'ang: {len(wanted)} English words the pack lacks, {len(drafted)} drafted')
for why, n in sorted(skipped.items(), key=lambda kv: -kv[1]):
    print(f'  skipped {n:5}  {why}')
for why, n in sorted(tried.items(), key=lambda kv: -kv[1]):
    print(f'  a table word failed {n:5}  {why}')
print('  by part of speech:', dict(Counter(r['pos'] for r in drafted)))
print('  leading with the English word:', sum(1 for r in drafted if r['leads']), 'of', len(drafted))
seed_n = option('sample', '9:40').split(':')
rows = drafted if seed_n[1] == 'all' else random.Random(int(seed_n[0])).sample(drafted, min(int(seed_n[1]), len(drafted)))
for r in rows:
    print(f"  {r['lemma']:12} {r['pos']:5} {r['tgt']:14} {r['tgt2']:14} {r['gender']:1} {'L' if r['leads'] else ' '} | {r['quote'][:80]}")
