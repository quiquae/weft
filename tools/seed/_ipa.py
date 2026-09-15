"""
Grapheme-to-phoneme for Latin and Old English.

Neither language has a speech-synthesis voice, so the tooltip shows IPA
instead of offering audio. Hand-typing 700 transcriptions would be slow and
would drift; both orthographies are close to deterministic once vowel length
is marked, so the transcription is derived and the derivation is tested.

Values are the standard teaching reconstructions: Classical Latin as in
Allen's *Vox Latina*, Old English as in Hogg / Campbell.
"""

# --------------------------------------------------------------- Latin ----

LA_VOWELS = {
    'a': 'a', 'ā': 'aː', 'e': 'ɛ', 'ē': 'eː', 'i': 'ɪ', 'ī': 'iː',
    'o': 'ɔ', 'ō': 'oː', 'u': 'ʊ', 'ū': 'uː', 'y': 'y', 'ȳ': 'yː',
}
LA_DIPHTHONGS = {'ae': 'ae̯', 'oe': 'oe̯', 'au': 'au̯', 'eu': 'eu̯'}
LA_CONSONANTS = {
    'b': 'b', 'c': 'k', 'd': 'd', 'f': 'f', 'g': 'ɡ', 'h': 'h', 'k': 'k',
    'l': 'l', 'm': 'm', 'n': 'n', 'p': 'p', 'r': 'r', 's': 's', 't': 't',
    'v': 'w', 'x': 'ks', 'z': 'z', 'j': 'j', 'q': 'k',
}
# A stop plus a liquid belongs to the following syllable, so it leaves the
# preceding syllable open: te-ne-brae, stressed on the antepenult.
STOP_LIQUID = {'pl', 'pr', 'bl', 'br', 'tr', 'dr', 'cl', 'cr', 'gl', 'gr', 'fl', 'fr'}


LA_LONG = set('āēīōūȳ')


def _la_units(word):
    """
    Split into (kind, text) units: 'v' for a vowel nucleus, 'c' otherwise.

    Must apply the same i -> /j/ rule as the transcriber. "ianua" has three
    syllables, not four, and getting that wrong moves the stress.
    """
    units = []
    i = 0
    w = word
    while i < len(w):
        two = w[i:i + 2]
        if two in LA_DIPHTHONGS:
            units.append(('v', two))
            i += 2
            continue
        ch = w[i]
        if ch == 'i' and i + 1 < len(w) and w[i + 1] in LA_VOWELS and (i == 0 or w[i - 1] in LA_VOWELS):
            units.append(('c', 'j'))
            i += 1
            continue
        if ch in LA_VOWELS:
            units.append(('v', ch))
            i += 1
            continue
        units.append(('c', ch))
        i += 1
    return units


def la_syllable_count_and_stress(word):
    """Return (number of nuclei, index of the stressed nucleus)."""
    units = _la_units(word)
    nuclei = [i for i, (k, _) in enumerate(units) if k == 'v']
    n = len(nuclei)
    if n <= 1:
        return n, 0
    if n == 2:
        return n, 0
    # Weight of the penult decides between penult and antepenult stress.
    penult_pos = nuclei[-2]
    penult_text = units[penult_pos][1]
    # The units carry orthography, so heaviness is tested against macrons and
    # orthographic diphthongs, not against IPA length marks.
    heavy = penult_text in LA_DIPHTHONGS or penult_text in LA_LONG
    if not heavy:
        cluster = ''.join(t for k, t in units[penult_pos + 1:nuclei[-1]] if k == 'c')
        if 'x' in cluster or 'z' in cluster:
            heavy = True
        elif len(cluster) >= 2 and cluster[:2] not in STOP_LIQUID:
            heavy = True
    return n, (n - 2 if heavy else n - 3)


FRONT = set('eēiīæǣyȳ')


def latin_ipa(word):
    w = word.strip().lower()
    if not w or ' ' in w:
        return ''
    n, stress_index = la_syllable_count_and_stress(w)

    out = []
    nucleus_seen = -1
    i = 0
    while i < len(w):
        rest = w[i:]

        # Digraphs and conditioned consonants first.
        if rest.startswith('qu'):
            out.append(('c', 'kʷ'))
            i += 2
            continue
        if rest.startswith('ngu') and len(rest) > 3 and rest[3] in LA_VOWELS:
            out.append(('c', 'ŋɡʷ'))
            i += 3
            continue
        for digraph, ipa in (('ch', 'kʰ'), ('ph', 'pʰ'), ('th', 'tʰ'), ('rh', 'r')):
            if rest.startswith(digraph):
                out.append(('c', ipa))
                i += 2
                break
        else:
            two = rest[:2]
            if two in LA_DIPHTHONGS:
                nucleus_seen += 1
                out.append(('v', LA_DIPHTHONGS[two], nucleus_seen))
                i += 2
                continue
            ch = rest[0]
            if ch == 'i' and len(rest) > 1 and rest[1] in LA_VOWELS and (i == 0 or w[i - 1] in LA_VOWELS):
                out.append(('c', 'j'))
                i += 1
                continue
            if ch in LA_VOWELS:
                nucleus_seen += 1
                out.append(('v', LA_VOWELS[ch], nucleus_seen))
                i += 1
                continue
            if ch == 'n' and len(rest) > 1 and rest[1] in 'cgq':
                out.append(('c', 'ŋ'))
                i += 1
                continue
            if ch == 'u' and i > 0 and w[i - 1] in 'qg':
                out.append(('c', 'w'))
                i += 1
                continue
            out.append(('c', LA_CONSONANTS.get(ch, ch)))
            i += 1
            continue
        continue

    # Geminates become length marks.
    phones = []
    for unit in out:
        if unit[0] == 'c' and phones and phones[-1][0] == 'c' and phones[-1][1] == unit[1]:
            phones[-1] = ('c', unit[1] + 'ː')
        else:
            phones.append(unit)

    # Place the stress mark at the onset of the stressed syllable.
    result = []
    stress_done = n <= 1 and False
    for idx, unit in enumerate(phones):
        if unit[0] == 'v' and unit[2] == stress_index and not stress_done:
            # Walk back over this syllable's onset consonants.
            onset = []
            while result and result[-1] not in ('ˈ',) and _is_consonant(result[-1]):
                onset.insert(0, result.pop())
            result.append('ˈ')
            result.extend(onset)
            stress_done = True
        result.append(unit[1])
    if not stress_done:
        result.insert(0, 'ˈ')
    return '/' + ''.join(result) + '/'


CONSONANT_PHONES = set(
    'bdfɡhklmnprstwjzŋ' 
) | {'kʷ', 'ŋɡʷ', 'kʰ', 'pʰ', 'tʰ', 'ks', 'θ', 'ð', 'v', 'ʃ', 'tʃ', 'ddʒ', 'x', 'ɣ', 'ç'}


def _is_consonant(phone):
    base = phone.rstrip('ː')
    return base in CONSONANT_PHONES or (base and base[0] in 'bdfɡhklmnprstwjzŋθðvʃxɣ')


# ---------------------------------------------------------- Old English ----

ANG_VOWELS = {
    'a': 'ɑ', 'ā': 'ɑː', 'æ': 'æ', 'ǣ': 'æː', 'e': 'e', 'ē': 'eː',
    'i': 'i', 'ī': 'iː', 'o': 'o', 'ō': 'oː', 'u': 'u', 'ū': 'uː',
    'y': 'y', 'ȳ': 'yː',
}
ANG_DIPHTHONGS = {
    'ēa': 'æːɑ', 'ea': 'æɑ', 'ēo': 'eːo', 'eo': 'eo',
    'īe': 'iːe', 'ie': 'ie', 'īo': 'iːo', 'io': 'io',
}
VOICED_CONTEXT = set(ANG_VOWELS) | set('lmnrwbdgðþæāēīōūȳǣ')

"""
Verbs whose first syllable is an unstressed prefix.

Listed explicitly rather than detected, because nothing in the orthography
distinguishes prefixed be-ginnan from unprefixed beran, or prefixed ge-munan
from the diphthong in geong. For a curated lexicon an explicit list is both
correct and auditable; a rule would be neither.
"""
ANG_PREFIXED = {
    'ābīdan': 'ā', 'ābīdende': 'ā',
    'beginnan': 'be', 'beginnende': 'be',
    'forġietan': 'for', 'forġietende': 'for',
    'ġemunan': 'ġe', 'ġemunende': 'ġe',
    'ondrǣdan': 'on', 'ondrǣdende': 'on',
}


def _ang_phones(word, initial=True):
    """Transcribe without stress. `initial` marks a root-initial position."""
    lower = word.strip().lower()
    phones = []
    i = 0
    while i < len(lower):
        rest = lower[i:]
        at_start = initial and i == 0

        if rest.startswith('sċ'):
            phones.append('ʃ')
            i += 2
            continue
        if rest.startswith('cg'):
            phones.append('ddʒ')
            i += 2
            continue
        if rest.startswith('ċ'):
            phones.append('tʃ')
            i += 1
            continue
        if rest.startswith('ġ'):
            prev = lower[i - 1] if i else ''
            # Dotted g is the palatal one: /j/, or /dʒ/ after n.
            phones.append('dʒ' if prev == 'n' else 'j')
            i += 1
            continue
        if rest.startswith('cw'):
            phones.append('kw')
            i += 2
            continue
        if rest.startswith('hw'):
            phones.append('hw')
            i += 2
            continue

        three, two = rest[:3], rest[:2]
        if three in ANG_DIPHTHONGS:
            phones.append(ANG_DIPHTHONGS[three])
            i += 3
            continue
        if two in ANG_DIPHTHONGS:
            phones.append(ANG_DIPHTHONGS[two])
            i += 2
            continue

        ch = rest[0]
        if ch in ANG_VOWELS:
            phones.append(ANG_VOWELS[ch])
            i += 1
            continue

        prev = lower[i - 1] if i else ''
        nxt = rest[1] if len(rest) > 1 else ''
        voiced_between = bool(prev) and bool(nxt) and prev in VOICED_CONTEXT and nxt in VOICED_CONTEXT

        if ch in 'þð':
            phones.append('ð' if voiced_between else 'θ')
        elif ch == 'f':
            phones.append('v' if voiced_between else 'f')
        elif ch == 's':
            phones.append('z' if voiced_between else 's')
        elif ch == 'h':
            phones.append('h' if at_start else 'x')
        elif ch == 'c':
            phones.append('k')
        # `nxt and ...` matters: an empty string is a substring of every
        # string in Python, so a word-final n would otherwise become /ŋ/.
        elif ch == 'n' and nxt and nxt in 'gckġ':
            phones.append('ŋ')
        elif ch == 'g':
            # Velar g lenites between vowels, but not root-initially: the g of
            # be-ginnan is a stop because the root begins there.
            between_vowels = prev in ANG_VOWELS and nxt in ANG_VOWELS
            phones.append('ɣ' if between_vowels and not at_start else 'ɡ')
        elif ch == 'ƿ':
            phones.append('w')
        elif ch in 'bdklmnprtwxz':
            phones.append({'x': 'ks'}.get(ch, ch))
        else:
            phones.append(ch)
        i += 1

    merged = []
    for ph in phones:
        if merged and merged[-1] == ph and _is_consonant(ph):
            merged[-1] = ph + 'ː'
        else:
            merged.append(ph)
    return merged


def old_english_ipa(word, pos=''):
    """
    Old English stresses the first syllable of the root, always. That makes
    the stress mark trivial to place — position zero — once any unstressed
    verbal prefix has been separated off.
    """
    w = word.strip()
    if not w or ' ' in w:
        return ''
    key = w.lower()
    prefix = ANG_PREFIXED.get(key) if pos == 'verb' or key in ANG_PREFIXED else None
    if prefix:
        head = _ang_phones(prefix, initial=True)
        root = _ang_phones(w[len(prefix):], initial=True)
        return '/' + ''.join(head) + 'ˈ' + ''.join(root) + '/'
    return '/ˈ' + ''.join(_ang_phones(w, initial=True)) + '/'


IPA_FOR = {'la': lambda w, pos: latin_ipa(w), 'ang': old_english_ipa}


if __name__ == '__main__':
    checks_la = [
        ('aqua', '/ˈakʷa/'), ('rēx', '/ˈreːks/'), ('amīcus', '/aˈmiːkʊs/'),
        ('dominus', '/ˈdɔmɪnʊs/'), ('magister', '/maˈɡɪstɛr/'), ('agricola', '/aˈɡrɪkɔla/'),
        ('terra', '/ˈtɛrːa/'), ('caelum', '/ˈkae̯lʊm/'), ('vīta', '/ˈwiːta/'),
        ('nauta', '/ˈnau̯ta/'), ('sanguis', '/ˈsaŋɡʷɪs/'), ('iānua', '/ˈjaːnʊa/'),
        ('oculus', '/ˈɔkʊlʊs/'), ('pāx', '/ˈpaːks/'),
    ]
    checks_ang = [
        ('hūs', '/ˈhuːs/'), ('stān', '/ˈstɑːn/'), ('cyning', '/ˈkyniŋɡ/'),
        ('wīf', '/ˈwiːf/'), ('þēod', '/ˈθeːod/'), ('brōðor', '/ˈbroːðor/'),
        ('sċip', '/ˈʃip/'), ('brycg', '/ˈbryddʒ/'), ('ēage', '/ˈæːɑɣe/'),
        ('wæter', '/ˈwæter/'), ('nigon', '/ˈniɣon/'), ('dagas', '/ˈdɑɣɑs/'),
        ('dæġ', '/ˈdæj/'), ('ċild', '/ˈtʃild/'),  ('cwēn', '/ˈkweːn/'),
    ]
    bad = 0
    for word, want in checks_la:
        got = latin_ipa(word)
        flag = 'ok  ' if got == want else 'FAIL'
        if got != want:
            bad += 1
        print(f'  la  {flag} {word:12s} {got:22s} want {want}')
    checks_ang_verbs = [
        ('ābīdan', '/ɑːˈbiːdɑn/'), ('beginnan', '/beˈɡinːɑn/'),
        ('forġietan', '/forˈjietɑn/'), ('ġemunan', '/jeˈmunɑn/'),
    ]
    for word, want in checks_ang:
        got = old_english_ipa(word)
        flag = 'ok  ' if got == want else 'FAIL'
        if got != want:
            bad += 1
        print(f'  ang {flag} {word:12s} {got:22s} want {want}')
    for word, want in checks_ang_verbs:
        got = old_english_ipa(word, 'verb')
        flag = 'ok  ' if got == want else 'FAIL'
        if got != want:
            bad += 1
        print(f'  ang {flag} {word:12s} {got:22s} want {want}  (verb: prefix unstressed)')
    print(f'\n{bad} mismatches')
