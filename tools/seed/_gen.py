"""
Shared generator for lex-<lang>.tsv files.

Each language module supplies a dict keyed on "lemma|pos" whose value is
"tgt|tgt2|gender|ipa|etymon|note" (trailing fields optional). This module
emits the TSV in english-core order, so a missing translation is visible as a
gap in the same place every time rather than as a silently shorter file.

Plural rules exist for the Romance languages because their nominal
pluralisation is regular enough to encode and the exceptions are enumerable.
German, Latin and Old English get no rules at all: their plurals are
lexically determined, and a rule that is right 70% of the time would teach a
wrong form 30% of the time, which is worse than weaving nothing.
"""
import pathlib
import sys

CORE = pathlib.Path(__file__).parent / 'english-core.tsv'
FIELDS = ('tgt', 'tgt2', 'gender', 'ipa', 'etymon', 'note')


def read_core():
    order = []
    for line in CORE.read_text().splitlines():
        if not line.strip() or line.startswith('#'):
            continue
        parts = line.split('\t')
        order.append((parts[0], parts[1]))
    return order


# --------------------------------------------------------------- French ----

FR_PLURAL_OVERRIDE = {
    'travail': 'travaux', 'œil': 'yeux', 'oeil': 'yeux', 'ciel': 'cieux',
    'bijou': 'bijoux', 'caillou': 'cailloux', 'chou': 'choux', 'genou': 'genoux',
    'hibou': 'hiboux', 'pou': 'poux', 'bal': 'bals', 'festival': 'festivals',
    'monsieur': 'messieurs', 'madame': 'mesdames', 'bétail': 'bestiaux',
}
FR_AL_KEEPS_S = {'bal', 'carnaval', 'festival', 'récital', 'chacal', 'régal'}
FR_AIL_TO_AUX = {'travail', 'corail', 'émail', 'vitrail', 'bail', 'soupirail'}


def fr_plural(w):
    if w in FR_PLURAL_OVERRIDE:
        return FR_PLURAL_OVERRIDE[w]
    if w.endswith(('s', 'x', 'z')):
        return w
    if w.endswith(('eau', 'au', 'eu')):
        return w + 'x'
    if w.endswith('al') and w not in FR_AL_KEEPS_S:
        return w[:-2] + 'aux'
    if w.endswith('ail'):
        return w[:-3] + 'aux' if w in FR_AIL_TO_AUX else w + 's'
    return w + 's'


# -------------------------------------------------------------- Spanish ----

ES_PLURAL_OVERRIDE = {}


def es_plural(w):
    if w in ES_PLURAL_OVERRIDE:
        return ES_PLURAL_OVERRIDE[w]
    if w.endswith('z'):
        return w[:-1] + 'ces'
    # Words ending in a stressed -ón/-án/-én/-ín/-ún lose the written accent
    # when the syllable stops being final.
    for acc, plain in (('ón', 'on'), ('án', 'an'), ('én', 'en'), ('ín', 'in'), ('ún', 'un')):
        if w.endswith(acc):
            return w[: -len(acc)] + plain + 'es'
    if w.endswith(('a', 'e', 'i', 'o', 'u')):
        return w + 's'
    if w.endswith(('á', 'é', 'ó')):
        return w + 's'
    if w.endswith('í') or w.endswith('ú'):
        return w + 'es'
    if w.endswith('s'):
        return w
    return w + 'es'


# -------------------------------------------------------------- Italian ----

IT_PLURAL_OVERRIDE = {
    'uomo': 'uomini', 'amico': 'amici', 'nemico': 'nemici', 'medico': 'medici',
    'greco': 'greci', 'porco': 'porci', 'braccio': 'braccia', 'osso': 'ossa',
    'uovo': 'uova', 'dito': 'dita', 'labbro': 'labbra', 'ginocchio': 'ginocchia',
    'mano': 'mani', 'ala': 'ali', 'arma': 'armi', 'moglie': 'mogli',
    'bue': 'buoi', 'dio': 'dei', 'tempio': 'templi', 're': 're', 'città': 'città',
    'caffè': 'caffè', 'virtù': 'virtù', 'crisi': 'crisi', 'specie': 'specie',
    'pesce': 'pesci', 'sorella': 'sorelle', 'figlio': 'figli', 'figlia': 'figlie',
}


def it_plural(w):
    if w in IT_PLURAL_OVERRIDE:
        return IT_PLURAL_OVERRIDE[w]
    if w.endswith(('à', 'è', 'ì', 'ò', 'ù', 'i')):
        return w
    if w.endswith('cia') or w.endswith('gia'):
        stem = w[:-3]
        # -cia/-gia after a vowel keeps the i; after a consonant it drops.
        return w[:-1] + 'e' if (stem and stem[-1] in 'aeiou') else w[:-2] + 'e'
    if w.endswith('ca'):
        return w[:-1] + 'he'
    if w.endswith('ga'):
        return w[:-1] + 'he'
    if w.endswith('a'):
        return w[:-1] + 'e'
    if w.endswith('co'):
        return w[:-2] + 'chi'
    if w.endswith('go'):
        return w[:-2] + 'ghi'
    if w.endswith('io'):
        return w[:-2] + 'i'
    if w.endswith(('o', 'e')):
        return w[:-1] + 'i'
    return w


# ------------------------------------------------------------ Portuguese ----

PT_PLURAL_OVERRIDE = {
    'pão': 'pães', 'cão': 'cães', 'mão': 'mãos', 'irmão': 'irmãos',
    'alemão': 'alemães', 'capitão': 'capitães', 'cristão': 'cristãos',
    'qualquer': 'quaisquer', 'mal': 'males', 'cônsul': 'cônsules',
}


def pt_plural(w):
    if w in PT_PLURAL_OVERRIDE:
        return PT_PLURAL_OVERRIDE[w]
    if w.endswith('ão'):
        return w[:-2] + 'ões'
    if w.endswith('m'):
        return w[:-1] + 'ns'
    if w.endswith('al'):
        return w[:-2] + 'ais'
    if w.endswith('el'):
        return w[:-2] + 'éis'
    if w.endswith('ol'):
        return w[:-2] + 'óis'
    if w.endswith('ul'):
        return w[:-2] + 'uis'
    if w.endswith('il'):
        return w[:-2] + 'is'
    if w.endswith(('r', 'z')):
        return w + 'es'
    if w.endswith('s'):
        return w
    return w + 's'


PLURALIZERS = {'fr': fr_plural, 'es': es_plural, 'it': it_plural, 'pt': pt_plural}

HEADERS = {}


def write(lang, data, header_note=''):
    """Emit tools/seed/lex-<lang>.tsv from `data`, in english-core order."""
    order = read_core()
    pluralize = PLURALIZERS.get(lang)
    lines = [
        f'# Weft translations: English -> {lang}',
        '#',
        '# lemma | pos | tgt | tgt2 | gender | ipa | etymon | note',
        '#',
        '# tgt   citation form: singular noun, infinitive verb, masculine',
        '#       singular adjective, nominative singular for Latin/Old English.',
        '# tgt2  plural for nouns, present participle for verbs. A blank tgt2 on',
        '#       a noun means the English plural is never woven, which is the',
        '#       correct outcome: weaving a singular target under an English',
        '#       plural teaches a form that does not exist.',
    ]
    if header_note:
        lines += ['#'] + [f'# {l}' for l in header_note.strip().split('\n')]
    lines.append('#')

    written = 0
    missing = []
    generated_plurals = 0

    for lemma, pos in order:
        key = f'{lemma}|{pos}'
        raw = data.get(key)
        if raw is None:
            missing.append(key)
            continue
        parts = (raw.split('|') + [''] * 6)[:6]
        row = dict(zip(FIELDS, parts))
        if not row['tgt']:
            continue
        # Fill a missing noun plural from the language's rules where we have
        # them. Explicit values in the data always win.
        # Never apply single-word rules to a phrase: pluralising the last
        # word of "chien de chasse" produces "chien de chasses", which
        # inflects the wrong noun. Phrases must be authored explicitly.
        if pos == 'noun' and not row['tgt2'] and pluralize and ' ' not in row['tgt']:
            row['tgt2'] = pluralize(row['tgt'])
            generated_plurals += 1
        lines.append('\t'.join([lemma, pos] + [row[f] for f in FIELDS]))
        written += 1

    path = pathlib.Path(__file__).parent / f'lex-{lang}.tsv'
    path.write_text('\n'.join(lines) + '\n')

    extra = [k for k in data if k not in {f'{l}|{p}' for l, p in order}]
    print(f'lex-{lang}.tsv: {written} translations of {len(order)} core entries', end='')
    if pluralize:
        print(f', {generated_plurals} plurals from rules', end='')
    print()
    if missing:
        print(f'  {len(missing)} untranslated: {", ".join(missing[:8])}'
              + (' …' if len(missing) > 8 else ''))
    if extra:
        print(f'  WARNING {len(extra)} keys not in core: {", ".join(extra[:8])}', file=sys.stderr)
    return written
