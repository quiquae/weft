"""Draft lexicon rows for one modern language from English Wiktionary.

usage: import_wiktionary.py <lang> <en-extract.jsonl> <target-extract.jsonl> <seed-dir> <lemmas> [--write]

Reads the extracts kaikki.org's dumps were cut down to (the English entries
of wordfreq's most frequent English words, and the target-language entries
they translate into) and drafts up to <lemmas> new rows, most frequent
English word first. Every row is decided_by=wiktionary, status=proposed, and
carries the ledger lines a checked row carries, each read off the target
word's own English Wiktionary entry:

- the gloss: the first definition line of the word's own part of speech that
  holds the English word. A translation with no such line is not drafted,
  which is what keeps a translation table's wrong sense out;
- a noun's gender, from its headword line, agreeing with the translation's
  gender tag where that has one;
- a noun's plural, the headword line's "plural X" clause, or "invariable";
- a verb's -ing form, its table's present participle or gerund.

Without --write it prints what it would draft and why it skipped the rest.
"""
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import orjson
import wordfreq

LANG, EN, TARGET, SEED, WANT = sys.argv[1], sys.argv[2], sys.argv[3], Path(sys.argv[4]), int(sys.argv[5])
WRITE = '--write' in sys.argv
# English headwords that also exist capitalized, from the same dump (extract_proper).
PROPER = set(Path(EN).with_name('en-proper.txt').read_text().split())
MODERN = ('fr', 'es', 'de', 'it', 'pt')
CONTENT = ('noun', 'verb', 'adj', 'adv')
GENDERS = {'fr': 'mf', 'es': 'mf', 'it': 'mf', 'pt': 'mf', 'de': 'mfn'}
SLOT = {  # the -ing form each language weaves, by the label its table prints
    'fr': ({'participle', 'present'}, 'present participle or gerund'),
    'de': ({'participle', 'present'}, 'present participle'),
    'es': ({'gerund'}, 'gerund'),
    'it': ({'gerund'}, 'gerund'),
    'pt': ({'gerund'}, 'Gerund'),
}
BAD_TAGS = {
    'archaic', 'obsolete', 'rare', 'dialectal', 'slang', 'vulgar', 'colloquial', 'informal',
    'regional', 'dated', 'poetic', 'literary', 'humorous', 'derogatory', 'offensive', 'figuratively',
    'abbreviation', 'diminutive', 'augmentative', 'nonstandard', 'proscribed', 'misspelling',
}
FUNCTION = set("""
a about above across after against all almost along also although always am among an and another any anybody
anyone anything are around as at be because been before being below beside between both but by can cannot could
did do does doing done down during each either else enough even ever every everybody everyone everything few for
from further had has have having he her here hers herself him himself his how however i if in into is it its
itself just least less let like many may me might mine more most much must my myself neither never no nobody none
nor not nothing now of off often on once one only onto or other others otherwise our ours ourselves out over own
perhaps please quite rather same several shall she should since so some somebody someone something sometimes
somewhat still such than that the their theirs them themselves then there these they this those though through
thus till to too toward towards under unless until up upon us very via was we well were what whatever when
whenever where whereas wherever whether which while who whoever whom whose why will with within without would yes
yet you your yours yourself yourselves get got gets getting okay ok yeah oh hey
""".split())


def read_tsv(path):
    rows = []
    for line in path.read_text().split('\n'):
        if line.strip() and not line.startswith('#'):
            rows.append(line.split('\t'))
    return rows


def clean(t):
    tags = set(t.get('tags', []))
    # One word, in the language's own letters: packs:verify warns on an
    # apostrophe, and "d'ici" was hence's archaic "from here".
    return not (tags & BAD_TAGS) and not any(tag[:1].isupper() for tag in tags) and ' ' not in t['word'] and "'" not in t['word']


def sense_index(d, label):
    want = set(re.findall(r'[a-z]{3,}', (label or '').lower()))
    best, best_i = 0, len(d['senses'])
    for i, s in enumerate(d['senses']):
        overlap = len(want & set(re.findall(r'[a-z]{3,}', s['gloss'].lower())))
        if overlap > best:
            best, best_i = overlap, i
    return best_i


def tables(d, code):
    """This language's translations, grouped by the sense they translate, earliest sense first."""
    out = defaultdict(list)
    for t in d['translations']:
        if t['code'] == code:
            out[t['si'] if t.get('si') is not None else sense_index(d, t.get('sense'))].append(t)
    return [out[i] for i in sorted(out)]


def distinct(d, code):
    return len({t['word'] for table in tables(d, code) for t in table if clean(t)})


def english_forms(d):
    """Wiktionary's plural and -ing form for an English entry, standard spellings only."""
    plural = gerund = ''
    for f in d['forms']:
        tags = set(f['tags'])
        if tags & BAD_TAGS or not f['form'] or not f['form'].isalpha():
            continue
        if not plural and tags == {'plural'}:
            plural = f['form']
        if not gerund and {'participle', 'present'} <= tags:
            gerund = f['form']
    return plural, gerund


# Port of englishPlural / englishGerund in tools/build-pack.mjs, so a drafted
# row names a form only where the builder's rule would get it wrong.
def rule_plural(lemma):
    if re.search(r'(?:s|x|z|ch|sh)$', lemma):
        return f'{lemma}es'
    if re.search(r'[^aeiou]y$', lemma):
        return f'{lemma[:-1]}ies'
    return f'{lemma}s'


def rule_gerund(lemma):
    if lemma.endswith('ie'):
        return f'{lemma[:-2]}ying'
    if re.search(r'[^aeiou]e$', lemma):
        return f'{lemma[:-1]}ing'
    if len(lemma) <= 4 and re.fullmatch(r'[^aeiou]*[aeiou][^aeiouwxy]', lemma):
        return f'{lemma}{lemma[-1]}ing'
    return f'{lemma}ing'


# ---------------------------------------------------------------- inputs
core_rows = read_tsv(SEED / 'english-core.tsv')
core = {(r[0], r[1]): r for r in core_rows}
lex_rows = read_tsv(SEED / f'lex-{LANG}.tsv')
taken = {(r[0], r[1]) for r in lex_rows}
targets_in_use = defaultdict(set)  # tgt -> parts of speech it already stands for
for r in lex_rows:
    if len(r) > 2 and r[2]:
        targets_in_use[r[2]].add(r[1])

# Band thresholds fitted to the checked core: a drafted word gets the band
# whose median zipf it is nearest.
by_band = defaultdict(list)
for r in core_rows:
    by_band[int(r[3])].append(float(r[2]))
band_medians = {b: sorted(v)[len(v) // 2] for b, v in by_band.items()}


def band_for(zipf):
    return min(band_medians, key=lambda b: abs(band_medians[b] - zipf))


english = defaultdict(list)
for line in open(EN, 'rb'):
    d = orjson.loads(line)
    english[(d['word'], d['pos'])].append(d)

target = defaultdict(list)
for line in open(TARGET, 'rb'):
    d = orjson.loads(line)
    target[(d['word'], d['pos'])].append(d)


def primary(group):
    return max(group, key=lambda d: len(d['translations']))


def usable(d):
    return any(not ({'form-of', 'alt-of'} & set(s['tags'])) for s in d['senses'])


# One part of speech per English word: the one Wiktionary translates most,
# and only where it leads clearly. "back" is a noun and an adverb, "want" a
# noun and a verb: the selector guesses a word's part of speech from its
# neighbours, and a near tie is a guess this pack should not need.
by_word = defaultdict(list)
inflected = set()  # words one of whose entries is only a form of another word: "lighter"
compared = set()  # comparatives and superlatives: "greater" is not grand
homonyms = set()  # two etymologies both well translated: "temple", building and brow
for (word, pos), group in english.items():
    # Any entry that is only a form of another word: "found" is find's past
    # as well as a verb of its own, and the text means find nearly always.
    if any(not usable(e) for e in group):
        inflected.add(word)
    if any({'comparative', 'superlative'} & set(s['tags']) for e in group for s in e['senses']):
        compared.add(word)
    if pos not in CONTENT or word in FUNCTION or len(word) < 3 or not word.isalpha():
        continue
    d = primary(group)
    if usable(d):
        by_word[word].append((len(d['translations']), pos))
    counts = sorted((len(e['translations']) for e in group), reverse=True)
    if len(counts) > 1 and counts[1] >= max(10, counts[0] / 2):
        homonyms.add((word, pos))
best_pos = {}
for word, counts in by_word.items():
    counts.sort(reverse=True)
    if counts[0][0] and (len(counts) == 1 or counts[1][0] < counts[0][0] / 2):
        best_pos[word] = counts[0][1]
    else:
        skipped_pos = True
def a_plural_of_another(word):
    """'rings' beside 'ring': a plural is woven through its singular's row."""
    stems = [word[:-1]] if word.endswith('s') else []
    if word.endswith('es'):
        stems.append(word[:-2])
    if word.endswith('ies'):
        stems.append(word[:-3] + 'y')
    return any(s in best_pos or (s, 'noun') in core for s in stems)


# A word the checked core already has, under any part of speech, keeps the
# core's reading: "two" the numeral is zwei, and a drafted noun Zwei beside it
# would leave the part-of-speech guess to choose between them.
core_words = {w for w, _ in core}
candidates = sorted(
    ((w, p) for w, p in best_pos.items() if w not in core_words and not a_plural_of_another(w)),
    key=lambda k: -wordfreq.zipf_frequency(k[0], 'en'),
)

# ---------------------------------------------------------------- drafting
GENDER_HEAD = re.compile(r'^\s*(m|f|n)(?:\b|\s)')
PLURAL_CLAUSE = re.compile(r'plural ([^,()]+?)(?=,|\)|$)')
skipped = Counter()
drafted = []


def spellings(lemma):
    """The word and its British spellings, which Wiktionary's glosses often use."""
    out = [lemma]
    for a, b in (('or', 'our'), ('ize', 'ise'), ('yze', 'yse'), ('er', 're'), ('og', 'ogue'), ('eled', 'elled')):
        if a in lemma:
            out.append(lemma.replace(a, b))
    return out


def definition(gloss):
    """A definition line without the dated quotation Wiktionary sometimes runs on into it."""
    return re.split(r'\.\s+\d{3,4}\b', gloss)[0].strip()


def gloss_line(entries, lemma):
    """The first definition line holding the English word, the spelling that stood for it,
    and whether it is its entry's first sense."""
    for spelled in spellings(lemma):
        pattern = re.compile(rf'(?<![A-Za-z]){re.escape(spelled)}(?![A-Za-z])', re.I)
        for e in entries:
            for i, s in enumerate(e['senses']):
                line = definition(s['gloss'])
                # The word must be what the line says, not inside its explanation:
                # "knot (unit of speed, one nautical mile per hour)" is not mile.
                said = re.sub(r'\([^)]*\)', '', line)
                if not (set(s['tags']) & BAD_TAGS) and pattern.search(said):
                    return e, line, ('' if spelled == lemma else spelled), i == 0
    return None, None, None, False


def target_zipf(word):
    return wordfreq.zipf_frequency(word, LANG) if LANG in MODERN else 0.0


for lemma, pos in candidates:
    if len(drafted) >= WANT:
        break
    if pos in ('noun', 'verb') and lemma in inflected:
        skipped['a noun or verb that is also an inflected form'] += 1
        continue
    if (lemma, pos) in homonyms:
        skipped['two etymologies, both translated'] += 1
        continue
    d = primary(english[(lemma, pos)])
    senses = max(1, round(sum(distinct(d, c) for c in MODERN) / len(MODERN)))
    # Stricter than the selector's maxSenses of 4: a spot check of 40 French
    # drafts found 3 of its 4 wrong rows at exactly 4 (assume -> assumer).
    if senses > 3:
        skipped['ambiguous: more than 3 distinct translations'] += 1
        continue
    if pos in ('adj', 'adv') and lemma in compared:
        skipped['a comparative or superlative'] += 1
        continue
    # A word English also capitalizes may owe its frequency to the name:
    # german to German, trump to Trump. An adjective goes; a noun goes when
    # its plural is rare beside it, which a name's is and summer's is not.
    if lemma in PROPER:
        if pos == 'adj':
            skipped["frequency may be a name's: English capitalizes it"] += 1
            continue
        if pos == 'noun':
            plural = english_forms(d)[0] or rule_plural(lemma)
            if wordfreq.zipf_frequency(lemma, 'en') - wordfreq.zipf_frequency(plural, 'en') >= 1.5:
                skipped["frequency is a name's: the plural is rare"] += 1
                continue
    ordered = tables(d, LANG)
    first = next((t for table in ordered for t in table if clean(t)), None)
    if first and first['word'].lower() == lemma:
        skipped['the same word in this language'] += 1
        continue
    # Every clean translation in the first two senses whose own entry glosses
    # it; the one the language uses most wins, as prison beats geôle.
    valid = []
    for table in ordered[:2]:
        masculine = [t['word'] for t in table if 'masculine' in t.get('tags', [])]
        for t in table:
            if not clean(t) or t['word'].lower() == lemma:
                continue
            if 'feminine' in t.get('tags', []) and any(m[:4] == t['word'][:4] for m in masculine):
                continue  # porteuse beside porteur: the pair's masculine is the citation form
            if targets_in_use.get(t['word'], {pos}) != {pos} and pos not in targets_in_use.get(t['word'], set()):
                continue  # a homograph of another part of speech needs a dictionary's number
            if LANG in MODERN and target_zipf(t['word']) < 3.0:
                continue  # a word the language barely uses: geôle for jail, keuf for cop
            entry, quote, stands, first_sense = gloss_line(target.get((t['word'], pos), []), lemma)
            if entry:
                valid.append((first_sense, target_zipf(t['word']), -len(valid), t, entry, quote, stands))
    if not valid:
        skipped['no translation whose own entry glosses it'] += 1
        continue
    # A word whose first sense is the English word beats one that means it
    # only further down (soutenu is formal only as a register).
    *_, t, entry, quote, stands = max(valid, key=lambda v: (v[0], v[1], v[2]))
    tgt, head = t['word'], (entry['head'] or [''])[0]
    row = {'lemma': lemma, 'pos': pos, 'tgt': tgt, 'tgt2': '', 'gender': ''}
    ledgers = {'gloss': quote, 'stands': stands}
    if pos == 'noun':
        rest = head[len(tgt):] if head.startswith(tgt) else ''
        m = GENDER_HEAD.match(rest)
        tag = next((g[0] for g in t.get('tags', []) if g in ('masculine', 'feminine', 'neuter')), None)
        if not m or m.group(1) not in GENDERS[LANG] or (tag and tag != m.group(1)):
            skipped['noun without one gender its headword line and tag agree on'] += 1
            continue
        row['gender'] = m.group(1)
        if 'invariable' in rest.split(')')[0]:
            row['tgt2'], ledgers['plural'] = tgt, 'invariable'
        else:
            pm = PLURAL_CLAUSE.search(rest)
            plurals = {f['form'] for f in entry['forms'] if 'plural' in f['tags']}
            if pm:
                form = pm.group(1).split(' or ')[0].strip()
                if form in plurals:
                    row['tgt2'], ledgers['plural'] = form, f'plural {pm.group(1).strip()}'
    elif pos == 'verb':
        # A pronominal verb (se promener, avventurarsi) weaves its gerund
        # without the pronoun, and its ledger line cites two entries: a
        # hand-made form this importer leaves alone.
        if tgt.startswith(('se ', "s'")) or tgt.endswith(('rsi', 'rse', '-se')):
            skipped['a pronominal verb'] += 1
            continue
        want_tags, label = SLOT[LANG]
        form = next((f['form'] for f in entry['forms'] if want_tags <= set(f['tags']) and 'past' not in f['tags']
                     and f['form'] and f['form'].isalpha()), '')
        if form:
            # Italian's table marks the stressed vowel, "scoprèndo": the
            # quote keeps the table's mark, the woven form is the word's.
            woven = re.sub(r'[àèéìòóù](?=.)', lambda m: 'aeeioou'['àèéìòóù'.index(m.group(0))], form) if LANG == 'it' else form
            row['tgt2'], ledgers['verb'] = woven, f'{label} {form}'
    en_plural, en_gerund = english_forms(d)
    zipf = round(wordfreq.zipf_frequency(lemma, 'en'), 1)
    core_row = [
        lemma, pos, f'{zipf:.1f}', str(band_for(zipf)), str(min(senses, 9)),
        en_plural if pos == 'noun' and en_plural and en_plural != rule_plural(lemma) else '',
        en_gerund if pos == 'verb' and en_gerund and en_gerund != rule_gerund(lemma) else '',
        'wiktionary', 'proposed',
    ]
    targets_in_use[tgt].add(pos)
    drafted.append((row, ledgers, core_row))

# ---------------------------------------------------------------- writing
SOURCE_NOTE = (
    '# ---- drafted from English Wiktionary via kaikki.org (dump of 2026-11-09), '
    'decided_by=wiktionary, status=proposed: woven, labelled, not yet read by a person ----'
)


def append(name, rows):
    """Append rows under the drafted section's header, written once per file."""
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
    cite = lambda w: f"wikt:{LANG}:{w.replace(' ', '_')}"
    core_new = [c for _, _, c in drafted if (c[0], c[1]) not in core]
    seen_core = set()
    append('english-core.tsv', [c for c in core_new if not ((c[0], c[1]) in seen_core or seen_core.add((c[0], c[1])))])
    append(f'lex-{LANG}.tsv', [
        [r['lemma'], r['pos'], r['tgt'], r['tgt2'], r['gender'], '', '', '', '', 'wiktionary', 'proposed']
        for r, _, _ in drafted
    ])
    append(f'{LANG}-glosses.tsv', [
        [r['lemma'], r['pos'], r['tgt'], cite(r['tgt']), led['gloss'], led['stands']] for r, led, _ in drafted
    ])
    append(f'{LANG}-genders.tsv', [
        [r['lemma'], r['tgt'], r['gender'], cite(r['tgt'])] for r, _, _ in drafted if r['pos'] == 'noun'
    ])
    append(f'{LANG}-plurals.tsv', [
        [r['lemma'], r['tgt'], r['tgt2'], cite(r['tgt']), led['plural']]
        for r, led, _ in drafted if r['pos'] == 'noun' and r['tgt2']
    ])
    append(f'{LANG}-verb-forms.tsv', [
        [r['lemma'], r['tgt'], r['tgt2'], cite(r['tgt']), led['verb']]
        for r, led, _ in drafted if r['pos'] == 'verb' and r['tgt2']
    ])
    # card-ids.tsv is sorted and holds each id once.
    ids_path = SEED / 'card-ids.tsv'
    lines = ids_path.read_text().split('\n')
    header = [line for line in lines if line.startswith('#')]
    ids = {tuple(line.split('\t')) for line in lines if line.strip() and not line.startswith('#')}
    ids |= {(LANG, r['tgt']) for r, _, _ in drafted}
    # Sorted by code unit, as JavaScript sorts the ledger's ids.
    body = sorted(ids, key=lambda i: f'{i[0]}\t{i[1]}'.encode('utf-16-be'))
    ids_path.write_text('\n'.join(header + [''] + ['\t'.join(i) for i in body]) + '\n')
    print(f'wrote {len(drafted)} rows into {SEED}')

# ---------------------------------------------------------------- report
import random

print(f'{LANG}: {len(candidates):,} candidates ranked, {len(drafted):,} drafted, skipped {dict(skipped)}')
print('  by part of speech:', dict(Counter(row['pos'] for row, _, _ in drafted)))
print(f"  lowest zipf drafted: {drafted[-1][2][2] if drafted else '-'}")
SEED_N = next((a.split('=')[1] for a in sys.argv if a.startswith('--sample=')), '9:40').split(':')
for row, ledgers, core_row in random.Random(int(SEED_N[0])).sample(drafted, min(int(SEED_N[1]), len(drafted))):
    print(f"  {row['lemma']:12} {row['pos']:5} {row['tgt']:16} {row['tgt2']:16} {row['gender']:1}  "
          f"zipf {core_row[2]} band {core_row[3]} senses {core_row[4]}  | {ledgers['gloss'][:50]}")
