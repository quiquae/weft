"""
Grapheme-to-phoneme for Latin and Old English.

Neither language has a speech-synthesis voice, so the tooltip shows IPA
instead of offering audio. Hand-typing 700 transcriptions would be slow and
would drift; both orthographies are close to deterministic once vowel length
is marked, so the transcription is derived. Run this file to check the
derivation against forms worked out by hand; every Latin value it has written
into `lex-la.tsv` is also held to the classical rules of syllable and stress
by `tests/tools/latin-stress.test.ts`, and every Old English value in
`lex-ang.tsv` to Wright's rules of stress, voicing and the guttural g by
`tests/tools/old-english-stress.test.ts`, each of which reads the spelling on
its own.

Values are the standard teaching reconstructions: Classical Latin as in
Allen's *Vox Latina*, Old English as in Hogg / Campbell. Latin syllables and
stress follow Allen & Greenough's *New Latin Grammar*, §§7, 11 and 12; Old
English stress, voicing and the guttural g Joseph and Elizabeth Mary Wright's
*Old English Grammar* (1914), §§7–15, 261 and 313–324, and a fricative ending
a compound's first element Bülbring's *Altenglisches Elementarbuch* (1902),
§474.
"""

# --------------------------------------------------------------- Latin ----

LA_VOWELS = {
    'a': 'a', 'ā': 'aː', 'e': 'ɛ', 'ē': 'eː', 'i': 'ɪ', 'ī': 'iː',
    'o': 'ɔ', 'ō': 'oː', 'u': 'ʊ', 'ū': 'uː', 'y': 'y', 'ȳ': 'yː',
    # A breve is written only by LA_RESPELT: a short vowel, never the consonant.
    'ă': 'a', 'ĕ': 'ɛ', 'ĭ': 'ɪ', 'ŏ': 'ɔ', 'ŭ': 'ʊ',
}
LA_DIPHTHONGS = {'ae': 'ae̯', 'oe': 'oe̯', 'au': 'au̯'}
"""
eu is a diphthong in a handful of particles — ceu, "contr. from ce-ve, like
neu and seu, from neve and sive" (Lewis & Short), and heu — and two vowels in
most words that spell it, which Lewis & Short marks: cāsĕus, calcĕus,
caerŭlĕus. A vowel before a vowel is short (A&G §10a), so it is a syllable of
its own. Listed rather than detected, for the reason ANG_PREFIXED is.
"""
LA_EU_DIPHTHONG = {'ceu', 'heu', 'neu', 'seu'}
"""
Words whose spelling hides which i is the consonant, respelled as Lewis &
Short prints them. An i between a consonant and a vowel is otherwise a vowel,
fī-li-us; a compound whose second part begins with the consonant cannot say
so in this spelling, and iūsiūrandum came out with a syllable too many. And
an i before a vowel at the start of a word is otherwise the consonant, iānua,
but iēns, the participle of īre, begins with the verb's stem vowel —
Wiktionary writes {{la-IPA|ïēns}} — short before a vowel (A&G §10a), so it is
respelled with a breve.
"""
LA_RESPELT = {'iūsiūrandum': 'iūsjūrandum', 'iēns': 'ĭēns'}
LA_CONSONANTS = {
    'b': 'b', 'c': 'k', 'd': 'd', 'f': 'f', 'g': 'ɡ', 'h': 'h', 'k': 'k',
    'l': 'l', 'm': 'm', 'n': 'n', 'p': 'p', 'r': 'r', 's': 's', 't': 't',
    'v': 'w', 'x': 'ks', 'z': 'z', 'j': 'j', 'q': 'k',
}
# A stop plus a liquid belongs to the following syllable, so it leaves the
# preceding syllable open: te-ne-brae, stressed on the antepenult.
STOP_LIQUID = {'pl', 'pr', 'bl', 'br', 'tr', 'dr', 'cl', 'cr', 'gl', 'gr', 'fl', 'fr'}


LA_LONG = set('āēīōūȳ')


def _la_tokens(word):
    """
    Read a lowercase headword into ('v' | 'c', spelling, ipa) tokens: one per
    syllable's vowel or diphthong, one per consonant.

    The stress and the transcription both read these, and reading the word
    once is the point. The stress used to be counted on a walk of its own
    that took the u of qu for a vowel, so quīnque had four syllables to it
    and was stressed on its last, while the transcription knew qu is one
    consonant and nothing compared the two. In qu and gu the u is "reckoned
    neither as a vowel nor as a consonant" (A&G §5 note 2).
    """
    w = LA_RESPELT.get(word, word)
    tokens = []
    i = 0
    while i < len(w):
        rest = w[i:]
        if rest.startswith('qu'):
            tokens.append(('c', 'qu', 'kʷ'))
            i += 2
            continue
        if rest.startswith('ngu') and len(rest) > 3 and rest[3] in LA_VOWELS:
            # Two consonants, and the syllable boundary falls between them.
            tokens += [('c', 'n', 'ŋ'), ('c', 'gu', 'ɡʷ')]
            i += 3
            continue
        digraph = next((d for d in ('ch', 'ph', 'th', 'rh') if rest.startswith(d)), None)
        if digraph:
            tokens.append(('c', digraph, {'ch': 'kʰ', 'ph': 'pʰ', 'th': 'tʰ', 'rh': 'r'}[digraph]))
            i += 2
            continue
        two = rest[:2]
        if two in LA_DIPHTHONGS or (two == 'eu' and w in LA_EU_DIPHTHONG):
            tokens.append(('v', two, LA_DIPHTHONGS.get(two, 'eu̯')))
            i += 2
            continue
        ch = rest[0]
        if ch == 'i' and len(rest) > 1 and rest[1] in LA_VOWELS and (i == 0 or w[i - 1] in LA_VOWELS):
            tokens.append(('c', 'i', 'j'))
        elif ch in LA_VOWELS:
            tokens.append(('v', ch, LA_VOWELS[ch]))
        elif ch == 'n' and len(rest) > 1 and rest[1] in 'cgq':
            tokens.append(('c', ch, 'ŋ'))
        else:
            tokens.append(('c', ch, LA_CONSONANTS.get(ch, ch)))
        i += 1
    return tokens


def _la_nuclei(tokens):
    return [i for i, t in enumerate(tokens) if t[0] == 'v']


def _la_stressed(tokens, nuclei):
    """
    Which syllable is stressed (A&G §12): the first of two, otherwise the
    penult if it is long and the antepenult if not.

    A penult is long by nature, with a long vowel or a diphthong, or by
    position, before two consonants or x or z, except a stop before a liquid
    (A&G §11). h is not counted, nor the u of qu and gu, which is why tokens
    carry their spelling: the transcription's length marks would mislead.
    """
    n = len(nuclei)
    if n <= 2:
        return 0
    penult = tokens[nuclei[-2]][1]
    if penult in LA_LONG or len(penult) == 2:
        return n - 2
    after = [t[1] for t in tokens[nuclei[-2] + 1:nuclei[-1]] if t[1] != 'h']
    count = sum(2 if c in ('x', 'z') else 1 for c in after)
    # A vowel before consonant i makes a long syllable, mâ-ior (A&G §11d).
    long = (count >= 2 and ''.join(after) not in STOP_LIQUID) or after[:1] in (['i'], ['j'])
    return n - 2 if long else n - 3


def _la_onset(tokens, nuclei, k):
    """
    The token syllable k begins with, which is where its stress mark goes.

    A syllable takes the one consonant before its vowel, or a stop and the
    liquid after it, and leaves the rest to the syllable before: per-sō-na,
    nār-rā-re, ec-clē-si-a, mōns-trā-re (A&G §7a and note 1, §11c). The mark
    used to go before every consonant since the last vowel, which printed
    persōna as /pɛˈrsoːna/.
    """
    if k == 0:
        return 0
    start, end = nuclei[k - 1] + 1, nuclei[k]
    if end - start >= 2 and tokens[end - 2][1] + tokens[end - 1][1] in STOP_LIQUID:
        return end - 2
    return end - 1 if end > start else end


def la_syllable_count_and_stress(word):
    """Return (number of syllables, index of the stressed one)."""
    tokens = _la_tokens(word)
    nuclei = _la_nuclei(tokens)
    return len(nuclei), _la_stressed(tokens, nuclei)


FRONT = set('eēiīæǣyȳ')


def latin_ipa(word):
    w = word.strip().lower()
    if not w or ' ' in w:
        return ''
    tokens = _la_tokens(w)
    nuclei = _la_nuclei(tokens)
    mark = _la_onset(tokens, nuclei, _la_stressed(tokens, nuclei)) if nuclei else 0

    units = []
    for idx, (kind, spelling, ipa) in enumerate(tokens):
        if idx == mark and mark > 0 and spelling == 'x':
            # x is two consonants, "probably dīc-sit, sac-sum" (A&G §7 note
            # 1): the syllable takes the second.
            units += [('c', 'k'), ('ˈ', 'ˈ'), ('c', 's')]
            continue
        if idx == mark:
            units.append(('ˈ', 'ˈ'))
        units.append((kind, ipa))

    # Geminates become length marks, except where the stress mark falls
    # between the two, since each belongs to its own syllable: nār-rā-re.
    phones = []
    for unit in units:
        if unit[0] == 'c' and phones and phones[-1][0] == 'c' and phones[-1][1] == unit[1]:
            phones[-1] = ('c', unit[1] + 'ː')
        else:
            phones.append(unit)
    return '/' + ''.join(p[1] for p in phones) + '/'


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
Words whose first syllable is an unstressed particle: verbs with an
inseparable prefix (Wright, *Old English Grammar*, §14), and the adverbs made
of tō and the noun it governs, which are stressed on the noun (§15: "onwég,
away; tōgǽdere, together").

Listed explicitly rather than detected, because nothing in the orthography
distinguishes prefixed be-ġinnan from unprefixed beran, or prefixed ge-munan
from the diphthong in geong. For a curated lexicon an explicit list is both
correct and auditable; a rule would be neither.
"""
ANG_PREFIXED = {
    'ābīdan': 'ā', 'beġinnan': 'be', 'forġietan': 'for', 'ġemunan': 'ġe', 'ondrǣdan': 'on',
    'tōdæġ': 'tō', 'tōgædere': 'tō',
}

"""
Compounds stressed on their first element (§11) whose second element begins
with f, s or þ. That sound keeps the value it has at the start of a word:
"this voicing of f, þ, s only took place in simple words, but not in
compounds, such as āþwēan, to wash; ġefeoht, battle; ġesendan, to send;
wynsum, pleasant" (§261 note). Listed for the reason ANG_PREFIXED is.

And those whose first element ends with one, which keeps the value it has at
the end of the simple word: Bülbring, *Altenglisches Elementarbuch* (1902),
§474, voices it only in a compound grown into one word. hūsbonda is a
compound of hūs, and Luick, *Historische Grammatik der englischen Sprache*,
§639 Anm. 3 (edited from his notes, 1940), names it — taken in in the tenth
or eleventh century, after the voicing had run its course, its [z] arising
later "nur durch Assimilation". wīfmann is left to the simple-word rule on
purpose: it grew into late Old English wimman, and Sievers (tr. Cook, 1903),
§193.2, puts that among the changes of a sonant f.
"""
ANG_COMPOUNDED = {'andswaru': 'and', 'onsīen': 'on', 'ēagþȳrel': 'ēag', 'hūsbonda': 'hūs'}


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
            # Undotted g is the guttural one (Wright §§313–324). It is the
            # explosive where a root begins — the g of tō-gædere — and after
            # n; the voiced spirant inside a word after a vowel, l or r (§320,
            # "beorgan … folgian … swelgan"), before a voiced consonant too,
            # since it "remained a spirant in all other positions" (§313) —
            # the g of fuglas and morgnas, where a vowel was lost after it;
            # and voiceless at the end of one after l, r or a guttural vowel,
            # where "the restoration of the g was merely orthographical"
            # (§323: "beorh, hill; burh, city").
            # `prev and ...` for the reason `nxt and ...` is written below.
            after = bool(prev) and (prev in 'lr' or prev in 'aāoōuū')
            before = bool(nxt) and (nxt in ANG_VOWELS or (after and nxt in 'lmnrw'))
            if not at_start and not nxt and after:
                phones.append('x')
            elif not at_start and before and (prev in ANG_VOWELS or after):
                phones.append('ɣ')
            else:
                phones.append('ɡ')
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


def _division(table, key, head):
    """
    A word's entry in one of the two tables above. A second form — the plural
    of a noun, the participle of a verb — divides where its headword does, so
    it takes the headword's entry when it begins with the same element:
    beġinnende as beġinnan, wīfmenn as wīfmann.
    """
    if key in table:
        return table[key]
    first = table.get(head.strip().lower())
    return first if first and key.startswith(first) else None


def old_english_ipa(word, pos='', head=''):
    """
    Old English stresses the first syllable of the root, always. That makes
    the stress mark trivial to place — position zero — once any unstressed
    prefix has been separated off. Each element of a word that divides is
    transcribed on its own, so a root begins with the sound a word begins
    with: the g of tō-gædere is a stop, the s of and-swaru voiceless. `head`
    is the headword of a second form, which divides where it does.
    """
    w = word.strip()
    if not w or ' ' in w:
        return ''
    key = w.lower()
    prefix = _division(ANG_PREFIXED, key, head)
    if prefix:
        head = _ang_phones(prefix, initial=True)
        root = _ang_phones(w[len(prefix):], initial=True)
        return '/' + ''.join(head) + 'ˈ' + ''.join(root) + '/'
    first = _division(ANG_COMPOUNDED, key, head)
    if first:
        head = _ang_phones(first, initial=True)
        rest = _ang_phones(w[len(first):], initial=True)
        return '/ˈ' + ''.join(head) + ''.join(rest) + '/'
    return '/ˈ' + ''.join(_ang_phones(w, initial=True)) + '/'


IPA_FOR = {'la': lambda w, pos, head='': latin_ipa(w), 'ang': old_english_ipa}


if __name__ == '__main__':
    checks_la = [
        ('aqua', '/ˈakʷa/'), ('rēx', '/ˈreːks/'), ('amīcus', '/aˈmiːkʊs/'),
        ('dominus', '/ˈdɔmɪnʊs/'), ('magister', '/maˈɡɪstɛr/'), ('agricola', '/aˈɡrɪkɔla/'),
        ('terra', '/ˈtɛrːa/'), ('caelum', '/ˈkae̯lʊm/'), ('vīta', '/ˈwiːta/'),
        ('nauta', '/ˈnau̯ta/'), ('sanguis', '/ˈsaŋɡʷɪs/'), ('iānua', '/ˈjaːnʊa/'),
        ('oculus', '/ˈɔkʊlʊs/'), ('pāx', '/ˈpaːks/'),
        # qu is one consonant, so these are stressed by the right count.
        ('quīnque', '/ˈkʷiːŋkʷɛ/'), ('quattuor', '/ˈkʷatːʊɔr/'), ('relinquere', '/rɛˈlɪŋkʷɛrɛ/'),
        # -eus is two syllables outside the listed particles.
        ('cāseus', '/ˈkaːsɛʊs/'), ('caeruleus', '/kae̯ˈrʊlɛʊs/'), ('seu', '/ˈseu̯/'),
        # The mark goes where the stressed syllable begins.
        ('persōna', '/pɛrˈsoːna/'), ('mōnstrāre', '/moːnsˈtraːrɛ/'), ('nārrāre', '/naːrˈraːrɛ/'),
        ('ecclēsia', '/ɛkˈkleːsɪa/'), ('relaxāre', '/rɛlakˈsaːrɛ/'),
        # A stop before a liquid leaves the penult short: no headword has one.
        ('tenebrae', '/ˈtɛnɛbrae̯/'),
        ('iūsiūrandum', '/juːsjuːˈrandʊm/'),
        # A second form is stressed by its own syllables, not its headword's:
        # amāre on its second, amāns on its first of two.
        ('amāns', '/ˈamaːns/'), ('aedificāns', '/ae̯ˈdɪfɪkaːns/'), ('capiēns', '/ˈkapɪeːns/'),
        ('quaestiōnēs', '/kʷae̯stɪˈoːneːs/'), ('uxōrēs', '/ʊkˈsoːreːs/'),
        # And the i of iēns is the verb's stem vowel, not the consonant.
        ('iēns', '/ˈɪeːns/'),
    ]
    checks_ang = [
        ('hūs', '/ˈhuːs/'), ('stān', '/ˈstɑːn/'), ('cyning', '/ˈkyniŋɡ/'),
        ('wīf', '/ˈwiːf/'), ('þēod', '/ˈθeːod/'), ('brōðor', '/ˈbroːðor/'),
        ('sċip', '/ˈʃip/'), ('brycg', '/ˈbryddʒ/'), ('ēage', '/ˈæːɑɣe/'),
        ('wæter', '/ˈwæter/'), ('nigon', '/ˈniɣon/'), ('dagas', '/ˈdɑɣɑs/'),
        ('dæġ', '/ˈdæj/'), ('ċild', '/ˈtʃild/'),  ('cwēn', '/ˈkweːn/'),
        # An adverb of tō and a noun is stressed on the noun, whose g is a stop.
        ('tōdæġ', '/toːˈdæj/'), ('tōgædere', '/toːˈɡædere/'),
        # A compound's second element begins with the sound a word begins with.
        ('andswaru', '/ˈɑndswɑru/'), ('onsīen', '/ˈonsiːen/'), ('ēagþȳrel', '/ˈæːɑxθyːrel/'),
        # And its first element ends with the sound the simple word ends with,
        # unless the compound has grown into one word, as wīfmann had.
        ('hūsbonda', '/ˈhuːsbondɑ/'), ('wīfmann', '/ˈwiːvmɑnː/'),
        # Undotted g is a spirant inside a word after l or r, and voiceless at
        # its end after one or a guttural vowel: no headword has the last.
        ('folgian', '/ˈfolɣiɑn/'), ('morgen', '/ˈmorɣen/'), ('beorg', '/ˈbeorx/'),
        ('plōg', '/ˈploːx/'), ('lang', '/ˈlɑŋɡ/'),
    ]
    bad = 0
    for word, want in checks_la:
        got = latin_ipa(word)
        flag = 'ok  ' if got == want else 'FAIL'
        if got != want:
            bad += 1
        print(f'  la  {flag} {word:12s} {got:22s} want {want}')
    checks_ang_verbs = [
        ('ābīdan', '/ɑːˈbiːdɑn/'), ('beġinnan', '/beˈjinːɑn/'),
        ('forġietan', '/forˈjietɑn/'), ('ġemunan', '/jeˈmunɑn/'),
    ]
    # A second form divides where its headword does: the participle keeps the
    # infinitive's unstressed particle, the plural the compound's boundary.
    checks_ang_second = [
        ('beġinnende', 'beġinnan', '/beˈjinːende/'), ('ābīdende', 'ābīdan', '/ɑːˈbiːdende/'),
        ('hūsbondan', 'hūsbonda', '/ˈhuːsbondɑn/'), ('andswara', 'andswaru', '/ˈɑndswɑrɑ/'),
        ('wīfmenn', 'wīfmann', '/ˈwiːvmenː/'), ('menn', 'mann', '/ˈmenː/'),
        # And its fricatives are read where they now stand: between vowels, voiced.
        ('stafas', 'stæf', '/ˈstɑvɑs/'), ('āþas', 'āþ', '/ˈɑːðɑs/'),
        # A g a lost vowel left before a voiced consonant is still the spirant.
        ('fuglas', 'fugol', '/ˈfuɣlɑs/'), ('morgnas', 'morgen', '/ˈmorɣnɑs/'),
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
    for word, head, want in checks_ang_second:
        got = old_english_ipa(word, 'noun', head)
        flag = 'ok  ' if got == want else 'FAIL'
        if got != want:
            bad += 1
        print(f'  ang {flag} {word:12s} {got:22s} want {want}  (second form of {head})')
    print(f'\n{bad} mismatches')
    raise SystemExit(1 if bad else 0)
