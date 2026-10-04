/**
 * An Old English transcription is stressed, and voiced, where the grammar puts it.
 *
 * Every Old English headword carries IPA, printed in the tooltip, on its word
 * page and in that page's meta description, and `tools/seed/_ipa.py` derives
 * all of it from the spelling. Old English stresses the first syllable of the
 * root, so the derivation can only put the stress in the wrong place on a word
 * whose first element the language left unstressed. Nothing had ever checked
 * it, and on 2026-10-04, read against Joseph and Elizabeth Mary Wright's *Old
 * English Grammar* (2nd ed., Oxford, 1914), six transcriptions were wrong in
 * two ways, and each had reached the page:
 *
 *  - **The three adverbs made of *tō* and a noun were stressed on *tō*.**
 *    `tōdæġ` was /ˈtoːdæj/, `tōmorgen` /ˈtoːmorɡen/ and `tōgædere`
 *    /ˈtoːɣædere/. §15: "In compound adverbs the first element had the chief
 *    or secondary stress according as it was the more or less important
 *    element of the compound, as eal(l)mǣst, almost … but onwég, away;
 *    tōgǽdere, together". And `tōgædere` had a second fault: the *g* that
 *    begins *gædere* was read as the spirant between two vowels, where it is
 *    the guttural explosive that begins a word, as the *g* of *be-ginnan* is.
 *  - **Three compounds voiced the sound their second element begins with.**
 *    `andswaru` was /ˈɑndzwɑru/, `onsīen` /ˈonziːen/ and `ēagþȳrel`
 *    /ˈæːɑɡðyːrel/. §261 note: "This voicing of f, þ, s only took place in
 *    simple words, but not in compounds, such as āþwēan, to wash; ġefeoht,
 *    battle; ġesendan, to send; wynsum, pleasant."
 *
 * So these tests read each headword again by Wright's rules and hold its
 * transcription to them. They do not borrow the generator's reading, which is
 * where the defects were:
 *
 *   §10   the chief stress falls on the stem syllable, and stays there when
 *         suffixes and endings follow it.
 *   §§11–12  a compound whose second element is a noun or an adjective is
 *         stressed on its first element, a particle included — *ándswaru*,
 *         *ánsīen* (§§568–569) — except a particle already unstressed: ġe-,
 *         and be- and for- in words formed from verbs.
 *   §14   a verb with an inseparable particle is stressed on its root.
 *   §15   a compound adverb is stressed on its more important element.
 *   §7    initial *g* before a guttural vowel is an explosive, as in *good*;
 *         between vowels it is a spirant. The pack dots the palatal one, so
 *         an undotted *g* is the guttural one.
 *   §8, §261  *f*, *s* and *þ* are voiced medially between voiced sounds,
 *         and voiceless initially, finally, before voiceless consonants and
 *         when doubled — and not voiced at the start of a compound's second
 *         element, nor of a root after a particle.
 *
 * Where a fricative *ends* a compound's first element, as in `wīfmann` and
 * `hūsbonda`, Wright's note can be read as reaching it, and English
 * Wiktionary's transcription voices it — [ˈwiːvˌmɑn]. Nothing here decides
 * between them, and those fricatives are counted neither way.
 *
 * What the spelling cannot show is where a word divides, and that is written
 * down below as it was read. A headword beginning with the letters of a
 * particle in Wright's lists (§§564–589, 645–656) is refused unless it is
 * written down one way or the other; a compound of two nouns cannot be found
 * that way, and is listed as it is met.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const LEXICON = join(ROOT, 'tools/seed/lex-ang.tsv');

/** Which element of a compound takes the chief stress. */
type Divided = { first: string; stressed: 'first' | 'second' };

/** Headwords that divide, read against Wright and, for the nouns, etymonline. */
const COMPOUNDED: Record<string, Divided> = {
  // §14: a verb with an inseparable particle is stressed on its root.
  ābīdan: { first: 'ā', stressed: 'second' }, // §646, "ābīdan, to abide"
  beginnan: { first: 'be', stressed: 'second' }, // §647
  forġietan: { first: 'for', stressed: 'second' }, // §14, "forġiefan, to forgive"
  ġemunan: { first: 'ġe', stressed: 'second' }, // §651
  ondrǣdan: { first: 'on', stressed: 'second' }, // §654, on- "the unstressed form of and-"
  // §15: an adverb made of tō and the noun it governs is stressed on the noun.
  tōdæġ: { first: 'tō', stressed: 'second' },
  tōgædere: { first: 'tō', stressed: 'second' }, // §15, "tōgǽdere, together"
  tōmorgen: { first: 'tō', stressed: 'second' },
  // §§11, 568–569, 588: a noun or adjective is stressed on its particle.
  andswaru: { first: 'and', stressed: 'first' }, // §569, "andswaru, answer"
  onsīen: { first: 'on', stressed: 'first' }, // §568, "ansīen, countenance": an-, the stressed on
  unrōt: { first: 'un', stressed: 'first' }, // §588
  unwlitiġ: { first: 'un', stressed: 'first' },
  // §15: a compound adverb whose first element matters more is stressed on it, "eal(l)mǣst".
  fulnēah: { first: 'ful', stressed: 'first' },
  ǣghwǣr: { first: 'ǣg', stressed: 'first' },
  nāhwǣr: { first: 'nā', stressed: 'first' },
  ġiestrandæġ: { first: 'ġiestran', stressed: 'first' },
  // §11: two nouns, stressed on the first.
  wīfmann: { first: 'wīf', stressed: 'first' },
  hūsbonda: { first: 'hūs', stressed: 'first' },
  sǣmann: { first: 'sǣ', stressed: 'first' },
  ċildclāð: { first: 'ċild', stressed: 'first' },
  nēahgebūr: { first: 'nēah', stressed: 'first' },
  ēagþȳrel: { first: 'ēag', stressed: 'first' }, // "eye-hole"
  bōcstæf: { first: 'bōc', stressed: 'first' },
};

/**
 * Headwords that begin with a particle's letters and are not compounded of
 * it: simple words, stressed on their first syllable by §10.
 */
const SIMPLE = new Set([
  'bedd', 'beorg', 'bera', 'beran',
  'forma', 'full', 'oft', 'singan', 'tōð',
  'ān', 'āna', 'āscian', 'āscung', 'āþ', // ā- verbs are §646's; āscian is not one of them
  'ǣfen', 'ǣfre', 'ǣr',
  // From ǣmetta, "leisure", which etymonline says is "perhaps" ǣ- and mōtan:
  // stressed on its first syllable either way, with nothing to voice where it would divide.
  'ǣmettiġ',
  'ġeolu', 'ġeong',
]);

/** The particles of Wright §§564–589 and 645–656, the separable ones of §645 among them. */
const PARTICLES = [
  'ā', 'ǣ', 'æf', 'æfter', 'æt', 'an', 'and', 'be', 'bi', 'ed', 'for', 'fore', 'fram', 'ful',
  'ġe', 'in', 'mid', 'mis', 'of', 'ofer', 'on', 'or', 'oþ', 'sam', 'sin', 'tō', 'þri', 'þurh',
  'un', 'under', 'wiþ', 'wiþer', 'ymb',
];

/** How an unstressed first element sounds, by Wright §§4–8: ā long, ġ the palatal spirant. */
const UNSTRESSED_SOUND: Record<string, string> = { ā: 'ɑː', be: 'be', for: 'for', ġe: 'je', on: 'on', tō: 'toː' };

/** The sound a letter has at the start of a word (§§7–8): what a root after a particle begins with. */
const INITIAL: Record<string, string> = {
  b: 'b', c: 'k', ċ: 'tʃ', d: 'd', f: 'f', g: 'ɡ', ġ: 'j', h: 'h', l: 'l', m: 'm', n: 'n',
  p: 'p', r: 'r', s: 's', t: 't', w: 'w', þ: 'θ', ð: 'θ',
};

const VOWELS = 'aāæǣeēiīoōuūyȳ';
const CONSONANTS = 'bcċdfgġhklmnprstwxþð';
/** Voiced sounds, for §8's "between voiced sounds": the vowels and the voiced consonants. */
const VOICED = new Set([...VOWELS, ...'bdgġlmnrw']);
const FRICATIVE = new Set(['f', 's', 'þ', 'ð']);

type Row = { line: number; tgt: string; word: string; ipa: string };

const rows: Row[] = readFileSync(LEXICON, 'utf8')
  .split('\n')
  .flatMap((text, i) => {
    if (!text || text.startsWith('#')) return [];
    const f = text.split('\t');
    const tgt = f[2] ?? '';
    // hund² is the second word spelled hund; the number is not spoken.
    return tgt && f[5] ? [{ line: i + 1, tgt, word: tgt.replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]+$/, '').toLowerCase(), ipa: f[5] }] : [];
  });
const headwords = new Set(rows.map((r) => r.word));

/** The particle a headword begins with, if it spells one. */
const particleOf = (word: string): string | undefined => PARTICLES.find((p) => word.startsWith(p) && word !== p);

/** Why a headword or its transcription cannot be read, or nothing. */
function unreadable(row: Row): string | undefined {
  const odd = [...row.word].find((ch) => !VOWELS.includes(ch) && !CONSONANTS.includes(ch));
  if (odd) return `“${odd}” is not a letter the rules know`;
  const marks = [...row.ipa].filter((ch) => ch === 'ˈ').length;
  if (marks !== 1) return `${marks} stress marks`;
  const divided = COMPOUNDED[row.word];
  if (!divided && !SIMPLE.has(row.word)) {
    const particle = particleOf(row.word);
    if (particle)
      return `it begins with the particle “${particle}-” and nothing here says whether it is compounded of it — read a dictionary and list it in COMPOUNDED or SIMPLE`;
  }
  if (divided && !row.word.startsWith(divided.first)) return `it does not begin with “${divided.first}”`;
  if (divided?.stressed === 'second' && !UNSTRESSED_SOUND[divided.first])
    return `nothing here says how an unstressed “${divided.first}-” sounds`;
  return undefined;
}

const unread: string[] = [];
const checked: Row[] = [];
for (const row of rows) {
  const why = unreadable(row);
  if (why) unread.push(`lex-ang.tsv:${row.line} ${row.tgt} ${row.ipa}: ${why}`);
  else checked.push(row);
}

/** The sound a word's root begins with, after an unstressed particle. */
function initialOf(root: string): string | undefined {
  for (const [two, sound] of [['sċ', 'ʃ'], ['cw', 'kw'], ['hw', 'hw'], ['cg', 'ddʒ']] as const)
    if (root.startsWith(two)) return sound;
  return INITIAL[root[0] as string];
}

/**
 * What §8 and §261 make of a headword's f, s and þ: how many are voiced, how
 * many voiceless, and how many end a compound's first element, which nothing
 * here decides.
 */
function fricatives(word: string): { voiced: number; voiceless: number; undecided: number } {
  const at = COMPOUNDED[word]?.first.length ?? -1;
  const out = { voiced: 0, voiceless: 0, undecided: 0 };
  for (let i = 0; i < word.length; i++) {
    const ch = word[i] as string;
    if (!FRICATIVE.has(ch)) continue;
    if (ch === 's' && word[i + 1] === 'ċ') continue; // sċ is one sound, /ʃ/
    if (word[i + 1] === ch) {
      out.voiceless += 1; // doubled
      i += 1;
      continue;
    }
    if (i + 1 === at) out.undecided += 1;
    else if (i === 0 || i === at || i + 1 === word.length) out.voiceless += 1;
    else if (VOICED.has(word[i - 1] as string) && VOICED.has(word[i + 1] as string)) out.voiced += 1;
    else out.voiceless += 1;
  }
  return out;
}

/** The same count, read off a transcription: v z ð against f s θ, with the s of each x's /ks/ left out. */
function transcribed(row: Row): { voiced: number; voiceless: number } {
  const count = (text: string, re: RegExp): number => (text.match(re) ?? []).length;
  return { voiced: count(row.ipa, /[vzð]/g), voiceless: count(row.ipa, /[fsθ]/g) - count(row.word, /x/g) };
}

function report(offenders: string[], what: string): void {
  assert.deepEqual(
    offenders.slice(0, 30),
    [],
    `${offenders.length} Old English transcriptions ${what}:\n  ${offenders.slice(0, 30).join('\n  ')}`,
  );
}

describe('every Old English transcription is stressed and voiced where the grammar puts it', () => {
  test('every headword and its transcription can be read', () => {
    report(unread, 'cannot be read');
    const stale = Object.keys(COMPOUNDED)
      .concat([...SIMPLE])
      .filter((word) => !headwords.has(word));
    assert.deepEqual(stale, [], `listed here and no longer a headword of lex-ang.tsv: ${stale.join(', ')}`);
  });

  test('a word is stressed on its first syllable, unless it begins with a particle the language left unstressed', () => {
    report(
      checked.flatMap((r) => {
        const divided = COMPOUNDED[r.word];
        if (divided?.stressed === 'second') {
          const want = `/${UNSTRESSED_SOUND[divided.first]}ˈ`;
          return r.ipa.startsWith(want)
            ? []
            : [`${r.tgt} ${r.ipa}: its “${divided.first}-” is unstressed, so the transcription should begin ${want}`];
        }
        return r.ipa.startsWith('/ˈ') ? [] : [`${r.tgt} ${r.ipa}: stressed after its first syllable`];
      }),
      'are stressed on the wrong syllable',
    );
  });

  test('a root after an unstressed particle begins with the sound it has at the start of a word', () => {
    report(
      checked.flatMap((r) => {
        const divided = COMPOUNDED[r.word];
        if (divided?.stressed !== 'second') return [];
        const head = UNSTRESSED_SOUND[divided.first] as string;
        const root = r.word.slice(divided.first.length);
        const want = initialOf(root);
        const sounds = r.ipa.replace(/[/ˈ]/g, '');
        if (!want || !sounds.startsWith(head)) return [];
        return sounds.slice(head.length).startsWith(want)
          ? []
          : [`${r.tgt} ${r.ipa}: “${root}” begins a root, so with /${want}/`];
      }),
      'begin a root with the sound it has inside a word',
    );
  });

  test('f, s and þ are voiced between voiced sounds, and not where a word or its second element begins', () => {
    report(
      checked.flatMap((r) => {
        const want = fricatives(r.word);
        const got = transcribed(r);
        const fits =
          got.voiced >= want.voiced &&
          got.voiceless >= want.voiceless &&
          got.voiced + got.voiceless === want.voiced + want.voiceless + want.undecided;
        return fits
          ? []
          : [
              `${r.tgt} ${r.ipa}: ${got.voiced} voiced and ${got.voiceless} voiceless, ` +
                `where the spelling has ${want.voiced} voiced and ${want.voiceless} voiceless` +
                (want.undecided ? `, and ${want.undecided} either` : ''),
            ];
      }),
      'voice the wrong f, s or þ',
    );
  });

  test('the rules have something to police', () => {
    // Floors, not exact counts, so a new headword needs no edit here. Each
    // names a case one of the rules decides, so a reading that stops meeting
    // it cannot be taken for one that has nothing wrong to find.
    const unstressed = checked.filter((r) => COMPOUNDED[r.word]?.stressed === 'second');
    const adverbs = unstressed.filter((r) => r.word.startsWith('tō'));
    const voiced = checked.reduce((n, r) => n + fricatives(r.word).voiced, 0);
    const atSecond = checked.filter((r) => {
      const at = COMPOUNDED[r.word]?.first.length;
      return at !== undefined && FRICATIVE.has(r.word[at] as string);
    });
    const refused = rows.filter((r) => particleOf(r.word));

    assert.ok(checked.length > 300, `only ${checked.length} of ${rows.length} Old English rows were read`);
    assert.ok(unstressed.length >= 8, `only ${unstressed.length} headwords begin with an unstressed particle`);
    assert.ok(adverbs.length >= 3, `only ${adverbs.length} adverbs are made of tō and a noun`);
    assert.ok(voiced > 30, `only ${voiced} f, s or þ stand between voiced sounds`);
    assert.ok(atSecond.length >= 3, `only ${atSecond.length} compounds begin their second element with f, s or þ`);
    assert.ok(refused.length > 30, `only ${refused.length} headwords begin with a particle's letters`);
  });
});
