/**
 * A Latin transcription is stressed where the classical rule puts it.
 *
 * Every Latin headword carries IPA, printed in the tooltip, on its word page
 * and in that page's meta description, and `tools/seed/_ipa.py` derives all of
 * it from the macronised spelling. On 2026-10-02 one row read for its note
 * showed that nothing had ever checked the derivation: `persōna` was printed
 * /pɛˈrsoːna/, the stress mark a consonant early. Read against the whole
 * column, the generator had three defects and each had reached the page:
 *
 *  - **It stressed every word with *qu* by the wrong count.** The stress was
 *    worked out on a walk of the word that took the *u* of *qu* for a vowel,
 *    so `quīnque` had four syllables to it, and came out /kʷiːˈŋkʷɛ/: a word
 *    of two stressed on its last. Seven rows.
 *  - **It made a diphthong of every *eu*.** `cāseus` was /ˈkaːseu̯s/, two
 *    syllables, where Lewis & Short prints *cāsĕus*: the *e* is short and a
 *    vowel of its own, as every vowel before a vowel is (A&G §10a). Three
 *    rows, and `caeruleus` was stressed on the wrong syllable for it.
 *  - **It put the mark before every consonant since the last vowel.** A
 *    syllable takes one of them, or a mute and the *l* or *r* after it, so
 *    `persōna` is /pɛrˈsoːna/ and `nārrāre` /naːrˈraːrɛ/, not /naːˈrːaːrɛ/.
 *
 * And `iūsiūrandum` had a syllable too many, because its second *i* is the
 * consonant that begins *jūrandum*, which the spelling cannot show.
 *
 * So these tests work each headword's syllables out again from its spelling,
 * by Allen & Greenough's rules, and hold its transcription to them. They do
 * not borrow the generator's reading: the defects were in how it read the
 * spelling, and a copy would have read it the same way.
 *
 *   §7    as many syllables as vowels and diphthongs. A single consonant
 *         between vowels goes with the following vowel, doubled consonants
 *         are separated, and *dīx-it*, *sax-um* are preferred to *dī-xit* —
 *         so a group of consonants splits before its last.
 *   §11   a syllable is long by nature, with a long vowel or a diphthong, or
 *         long by position, with a short vowel before two consonants or *x*.
 *         A mute before *l* or *r* is properly short — "the ordinary
 *         pronunciation was pa-trem" — and goes with the vowel after it. *h*
 *         is not counted, nor the *u* of *qu* and *gu* (§11 note 3).
 *   §12   a word of two syllables is stressed on the first; a longer one on
 *         the penult if that is long, otherwise on the antepenult.
 *
 * What the spelling cannot show is read from Lewis & Short and written down
 * below, not guessed; a headword spelling a combination nothing here can read
 * is refused, and the message says which.
 *
 * A second form — the plural of a noun, the participle of a verb — is held to
 * the same rules beside its headword. The tooltip prints the seed's ninth
 * column, `ipa2`, under it, and until 2026-10-04 printed the headword's sound
 * there instead: /ˈwɪr/ under *virī*, /aˈmaːrɛ/ under *amāns*, which Latin
 * stresses on its first syllable of two. A second form is read from its own
 * spelling, so its stress may stand elsewhere than its headword's.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const LEXICON = join(ROOT, 'tools/seed/lex-la.tsv');

/**
 * Headwords respelled the way Lewis & Short prints them, for what the
 * lexicon's spelling leaves out.
 *
 * *eu* is a diphthong in a handful of particles — *ceu*, "contr. from ce-ve,
 * like neu and seu, from neve and sive" — and two vowels in most words that
 * spell it, which Lewis & Short shows by marking the *e* short. An *i* between
 * a consonant and a vowel is a vowel, *fī-li-us*, except where a compound's
 * second part begins with the consonant, which Lewis & Short prints as *j*.
 * The breve and the *j* are the only marks used: a breve vowel is short and
 * never half of a diphthong.
 *
 * A second form is listed under its own spelling, read the way its headword
 * is. And one *i* before a vowel at the start of a word is not the consonant:
 * *iēns*, the participle of *īre*, has the verb's stem vowel, which Wiktionary
 * writes `{{la-IPA|ïēns}}`, and a vowel before a vowel is short (A&G §10a).
 */
const RESPELT: Record<string, string> = {
  cāseus: 'cāsĕus',
  calceus: 'calcĕus',
  caeruleus: 'caerŭlĕus',
  iūsiūrandum: 'iūsjūrandum', // "jus-jūrandum"
  iūsiūranda: 'iūsjūranda',
  iēns: 'ĭēns',
};

/** One spelled syllable nucleus, or one consonant as A&G §11 counts them. */
type Unit = { kind: 'v'; long: boolean } | { kind: 'c'; letter: string };

const SHORT = 'aeiouy';
const LONG = 'āēīōūȳ';
const BREVE = 'ăĕĭŏŭ';
const isVowel = (ch: string | undefined): boolean => !!ch && (SHORT + LONG + BREVE).includes(ch);

/** A&G §4: the mutes, the aspirates among them. A mute before l or r is "common" (§11c). */
const MUTE = new Set(['b', 'c', 'd', 'g', 'k', 'p', 't', 'ch', 'ph', 'th']);
const LIQUID = new Set(['l', 'r']);

/** The headword's nuclei and consonants, or the reason it cannot be read. */
function spell(headword: string): Unit[] | string {
  const w = (RESPELT[headword] ?? headword).toLowerCase();
  const units: Unit[] = [];
  for (let i = 0; i < w.length; ) {
    const ch = w[i] as string;
    const next = w[i + 1];
    const two = w.slice(i, i + 2);
    if (two === 'qu') {
      units.push({ kind: 'c', letter: 'qu' });
      i += 2;
    } else if (two === 'gu' && w[i - 1] === 'n' && isVowel(w[i + 2])) {
      units.push({ kind: 'c', letter: 'gu' });
      i += 2;
    } else if (two === 'su' && isVowel(w[i + 2])) {
      return 'su before a vowel is “sometimes” one consonant (A&G §5 note 2), and nothing here says which';
    } else if (['ch', 'ph', 'th', 'rh'].includes(two)) {
      units.push({ kind: 'c', letter: two === 'rh' ? 'r' : two });
      i += 2;
    } else if (['ae', 'au', 'oe'].includes(two)) {
      units.push({ kind: 'v', long: true });
      i += 2;
    } else if (['ei', 'eu', 'ui'].includes(two)) {
      return `nothing here says whether its “${two}” is one syllable or two — read Lewis & Short and respell it in RESPELT`;
    } else if (ch === 'i' && isVowel(next) && (i === 0 || isVowel(w[i - 1]))) {
      // Consonant i: before a vowel at the start of the word, or between two (A&G §7a).
      units.push({ kind: 'c', letter: 'j' });
      i += 1;
    } else if (isVowel(ch)) {
      units.push({ kind: 'v', long: LONG.includes(ch) });
      i += 1;
    } else if (ch === 'x') {
      // A double consonant, "probably dīc-sit, sac-sum" (A&G §7 note 1).
      units.push({ kind: 'c', letter: 'k' }, { kind: 'c', letter: 's' });
      i += 1;
    } else if (ch === 'z') {
      return 'z is a double consonant (A&G §4) and nothing here says how it is transcribed';
    } else if (/[a-z]/.test(ch)) {
      units.push({ kind: 'c', letter: ch });
      i += 1;
    } else {
      return `“${ch}” is not a letter the rules know`;
    }
  }
  return units;
}

/** A headword read for its syllables: what the transcription has to agree with. */
type Reading = {
  /** One entry per syllable: the consonants between the vowel before it and its own. */
  before: string[][];
  /** The syllable the rule stresses, counted from 0. */
  stressed: number;
};

function read(units: Unit[]): Reading {
  const before: string[][] = [];
  let run: string[] = [];
  const longs: boolean[] = [];
  for (const u of units) {
    if (u.kind === 'c') run.push(u.letter);
    else {
      before.push(run);
      longs.push(u.long);
      run = [];
    }
  }
  const n = before.length;
  if (n <= 2) return { before, stressed: 0 };
  // The consonants after the penult are the ones before the ultima; h does not count (A&G §11 note 3).
  const after = (before[n - 1] as string[]).filter((c) => c !== 'h');
  const mutePlusLiquid = after.length === 2 && MUTE.has(after[0] as string) && LIQUID.has(after[1] as string);
  const long = (longs[n - 2] as boolean) || (after.length >= 2 && !mutePlusLiquid) || after[0] === 'j';
  return { before, stressed: long ? n - 2 : n - 3 };
}

/** How many of the consonants before syllable `k` belong to it: where its mark goes. */
function onset(reading: Reading, k: number): number {
  const run = reading.before[k] as string[];
  if (k === 0 || run.length <= 1) return run.length;
  const [a, b] = run.slice(-2) as [string, string];
  return MUTE.has(a) && LIQUID.has(b) ? 2 : 1;
}

/** A transcription as a run of vowels, consonants and the stress mark. */
type Phone = 'v' | 'c' | 'ˈ';

const IPA_VOWEL = 'aeiouyɛɪɔʊæɑ';
const IPA_CONSONANT = 'bdfɡghklmnprstwjzŋθðvʃxɣ';
const NON_SYLLABIC = '̯';

function phones(ipa: string): Phone[] | string {
  const s = ipa.replace(/^\/|\/$/g, '');
  const out: Phone[] = [];
  for (let i = 0; i < s.length; ) {
    const ch = s[i] as string;
    if (ch === 'ˈ') {
      out.push('ˈ');
      i += 1;
    } else if (IPA_VOWEL.includes(ch)) {
      // The second half of a diphthong carries the non-syllabic mark: it is no syllable.
      if (s[i + 1] === NON_SYLLABIC) i += 2;
      else {
        out.push('v');
        i += s[i + 1] === 'ː' ? 2 : 1;
      }
    } else if (IPA_CONSONANT.includes(ch)) {
      out.push('c');
      i += 1;
      while (s[i] === 'ʷ' || s[i] === 'ʰ') i += 1;
      // A long consonant is a doubled one, and §7 separates the two.
      if (s[i] === 'ː') {
        out.push('c');
        i += 1;
      }
    } else {
      return `“${ch}” is not a sound the rules know`;
    }
  }
  return out;
}

/** Where a transcription puts its mark: the syllable, and how many consonants it gives that syllable. */
type Marked = { syllables: number; stressed: number; onset: number; run: number };

function marked(ps: Phone[]): Marked | string {
  const marks = ps.filter((p) => p === 'ˈ').length;
  if (marks !== 1) return `${marks} stress marks`;
  const at = ps.indexOf('ˈ');
  const syllables = ps.filter((p) => p === 'v').length;
  const stressed = ps.slice(0, at).filter((p) => p === 'v').length;
  const next = ps.indexOf('v', at);
  const prev = ps.lastIndexOf('v', at);
  if (next < 0) return 'a stress mark with no vowel after it';
  const onset = ps.slice(at + 1, next).length;
  const run = ps.slice(prev + 1, next).filter((p) => p === 'c').length;
  return { syllables, stressed, onset, run };
}

/** A transcribed form: a headword, or a second form beside the headword it is `of`. */
type Row = { line: number; tgt: string; ipa: string; of?: string };

/** Each transcribed headword, and each second form beside it, with the seed row's own transcription of it. */
const rows: Row[] = [];
/** Second forms the seed gives no transcription of their own, which the tooltip prints no sound under. */
const untranscribed: string[] = [];
/** Every form the seed spells, transcribed or not. */
const forms = new Set<string>();
readFileSync(LEXICON, 'utf8')
  .split('\n')
  .forEach((text, i) => {
    if (!text || text.startsWith('#')) return;
    const f = text.split('\t');
    const [tgt = '', tgt2 = '', ipa = '', ipa2 = ''] = [f[2], f[3], f[5], f[8]];
    for (const form of [tgt, tgt2]) if (form) forms.add(form);
    if (!tgt || !ipa) return;
    rows.push({ line: i + 1, tgt, ipa });
    if (!tgt2) return;
    if (ipa2) rows.push({ line: i + 1, tgt: tgt2, ipa: ipa2, of: tgt });
    else untranscribed.push(`lex-la.tsv:${i + 1} ${tgt2}, of ${tgt} ${ipa}`);
  });

/** A form as a message names it: a second form with the headword it is of. */
const named = (r: Row): string => (r.of ? `${r.tgt} (of ${r.of})` : r.tgt);

type Checked = Row & { reading: Reading; mark: Marked };

/** Every row both halves could be read for, and a line for each that could not. */
const checked: Checked[] = [];
const unread: string[] = [];
for (const row of rows) {
  const units = spell(row.tgt);
  const ps = phones(row.ipa);
  const mark = typeof ps === 'string' ? ps : marked(ps);
  if (typeof units === 'string') unread.push(`lex-la.tsv:${row.line} ${named(row)}: ${units}`);
  else if (typeof mark === 'string') unread.push(`lex-la.tsv:${row.line} ${named(row)} ${row.ipa}: ${mark}`);
  else checked.push({ ...row, reading: read(units), mark });
}

const ordinal = (k: number): string => ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'][k] ?? `${k + 1}th`;

function report(offenders: string[], what: string): void {
  assert.deepEqual(
    offenders.slice(0, 30),
    [],
    `${offenders.length} Latin transcriptions ${what}:\n  ${offenders.slice(0, 30).join('\n  ')}`,
  );
}

describe('every Latin transcription is stressed where the classical rule puts it', () => {
  test('every headword and its transcription can be read', () => {
    report(unread, 'cannot be read');
    const stale = Object.keys(RESPELT).filter((word) => !forms.has(word));
    assert.deepEqual(stale, [], `respelt here and no longer a form of lex-la.tsv: ${stale.join(', ')}`);
  });

  test('every second form has a transcription of its own', () => {
    // The tooltip prints a row's transcription under the form it wove, and the
    // pack builder prints the ninth column, ipa2, under a second form, or no
    // sound at all where the seed has none.
    assert.deepEqual(
      untranscribed.slice(0, 30),
      [],
      `${untranscribed.length} second forms have no transcription of their own — run python3 tools/seed/fill_ipa.py:\n  ` +
        untranscribed.slice(0, 30).join('\n  '),
    );
  });

  test('a transcription has a syllable for each vowel and diphthong of its headword', () => {
    report(
      checked
        .filter((r) => r.mark.syllables !== r.reading.before.length)
        .map((r) => `${named(r)} ${r.ipa}: ${r.mark.syllables} syllables, where the spelling has ${r.reading.before.length}`),
      'have the wrong number of syllables',
    );
  });

  test('a word is stressed on its penult if that is long, otherwise on the antepenult', () => {
    report(
      checked
        .filter((r) => r.mark.syllables === r.reading.before.length && r.mark.stressed !== r.reading.stressed)
        .map(
          (r) =>
            `${named(r)} ${r.ipa}: stressed on the ${ordinal(r.mark.stressed)} of ${r.reading.before.length} syllables, ` +
            `where the rule stresses the ${ordinal(r.reading.stressed)}`,
        ),
      'are stressed on the wrong syllable',
    );
  });

  test('the stress mark stands where its syllable begins', () => {
    report(
      checked
        .filter((r) => r.mark.syllables === r.reading.before.length)
        .flatMap((r) => {
          const run = (r.reading.before[r.mark.stressed] as string[]).length;
          const want = onset(r.reading, r.mark.stressed);
          if (r.mark.run !== run)
            return [`${named(r)} ${r.ipa}: ${r.mark.run} consonants before the stressed vowel, where the spelling has ${run}`];
          if (r.mark.onset !== want)
            return [`${named(r)} ${r.ipa}: ${r.mark.onset} of them after the mark, where the syllable takes ${want}`];
          return [];
        }),
      'put the stress mark inside the wrong syllable',
    );
  });

  test('the rules have something to police', () => {
    // Floors, not exact counts, so a new headword needs no edit here. Each
    // names a case one of the rules decides, so a reading that stops meeting
    // it cannot be taken for one that has nothing wrong to find.
    const heads = checked.filter((r) => !r.of);
    const long3 = heads.filter((r) => r.reading.before.length >= 3);
    const byPosition = long3.filter((r) => {
      const after = (r.reading.before.at(-1) as string[]).filter((c) => c !== 'h');
      return r.reading.stressed === r.reading.before.length - 2 && after.length >= 2;
    });
    const antepenult = long3.filter((r) => r.reading.stressed === r.reading.before.length - 3);
    const split = heads.filter((r) => r.reading.stressed > 0 && (r.reading.before[r.reading.stressed] as string[]).length >= 2);
    const mutePlusLiquid = heads.filter((r) => r.reading.stressed > 0 && onset(r.reading, r.reading.stressed) === 2);
    const qu = heads.filter((r) => r.tgt.includes('qu'));
    const second = checked.filter((r) => r.of);
    // A second form read from its own spelling, not copied from its headword:
    // amāre is stressed on its second syllable and amāns on its first.
    const byLine = new Map(heads.map((r) => [r.line, r]));
    const moved = second.filter((r) => byLine.get(r.line)?.reading.stressed !== r.reading.stressed);

    assert.ok(heads.length > 300, `only ${heads.length} Latin headwords were read`);
    assert.ok(second.length > 200, `only ${second.length} second forms were read beside their headwords`);
    assert.ok(moved.length > 30, `only ${moved.length} second forms are stressed on another syllable than their headwords`);
    assert.ok(byPosition.length > 10, `only ${byPosition.length} words are stressed on a penult long by position`);
    assert.ok(antepenult.length > 20, `only ${antepenult.length} words are stressed on the antepenult`);
    assert.ok(split.length > 10, `only ${split.length} stressed syllables follow a group of consonants`);
    assert.ok(mutePlusLiquid.length > 0, 'no stressed syllable begins with a mute and a liquid');
    assert.ok(qu.length > 5, `only ${qu.length} headwords are spelled with qu`);
  });
});
