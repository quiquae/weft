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
 *
 * The second half reads every undotted g the same way, by §§313–324, and is
 * introduced where it begins. On 2026-10-04 it found six more: `folgian`,
 * `morgen` and `tōmorgen` gave a spirant the stop of *good*, and `beorg`,
 * `burg` and `ēagþȳrel` gave it to a g that ends an element voiceless.
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

type Row = { line: number; pos: string; tgt: string; word: string; ipa: string };

const rows: Row[] = readFileSync(LEXICON, 'utf8')
  .split('\n')
  .flatMap((text, i) => {
    if (!text || text.startsWith('#')) return [];
    const f = text.split('\t');
    const tgt = f[2] ?? '';
    // hund² is the second word spelled hund; the number is not spoken.
    const word = tgt.replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]+$/, '').toLowerCase();
    return tgt && f[5] ? [{ line: i + 1, pos: f[1] ?? '', tgt, word, ipa: f[5] }] : [];
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

/*
 * An undotted g is the guttural one, and Wright gives it a sound by where it
 * stands (§§313–324). The pack dots the palatal g, so these read every g it
 * leaves bare:
 *
 *   §314  at the start of a word or a root, the explosive: "initial guttural
 *         ʒ … had become the voiced explosive g before the end of the OE.
 *         period".
 *   §313  after n, the explosive too, since the spirant "became g after ŋ".
 *   §320  inside a word, after a vowel, l or r and before a vowel, the voiced
 *         spirant: "Medial ʒ remained a guttural spirant before original
 *         guttural vowels" — "belgan … beorgan … folgian, to follow … swelgan".
 *   §323  at the end of a word, after l, r or a guttural vowel, voiceless:
 *         "After liquids and guttural vowels the restoration of the g was
 *         merely orthographical", and late Old English writes "beorh, hill;
 *         burh, city". English Wiktionary's module voices it, [burˠɣ]; the
 *         pack is dated 900–1050, which is the late Old English Wright means.
 *   §320 note  before a voiceless consonant, "ʒ became h (= x) …, but the g
 *         was often restored", so either spirant stands there.
 *
 * Two places make a g palatal whatever it came from, and an undotted g there
 * contradicts the grammar: between Old English palatal vowels (§320, "It also
 * became palatal between OE. palatal vowels") and at the end of a word or a
 * first element after one (§324, "dæg … weg … bodig … hefig"). The -ian of a
 * weak verb is *-ōjan, an original guttural vowel, so a g before it stays
 * guttural — §320's own "dagian from *dagōjan", and Wright's plegian, whose
 * index gives "plægian, plagian" beside it (§538).
 */

/** Headwords whose g stands where Wright makes it palatal, and which the pack writes bare. Dotting a headword moves its card's id, which is why they are waiting. */
const AWAITING_DOTS: Record<string, string> = {
  wīg: 'final after a palatal vowel (§324); Wiktionary writes wīġ',
  hunig: 'final after a palatal vowel, as §324’s bodig and hefig; Wiktionary writes huniġ',
  twēgen: 'between palatal vowels (§320); Wiktionary writes twēġen',
  ǣghwǣr: 'ending a first element after a palatal vowel (§324); ǣġ- is ā-ġe-, and Wiktionary’s module reads ǣġhwǣr /ˈæːj.xwæːr/',
};

const BACK = 'aāoōuū';
const FRONT = 'iīeēæǣyȳ';
const VOICELESS = 'cfhkpstþ';

type G = 'ɡ' | 'ɣ' | 'x' | 'either';

/** Each undotted g of a headword, read by Wright, or why it cannot be. */
function gsOf(row: Row): { sounds: G[]; refused: string[] } {
  const word = row.word;
  const at = COMPOUNDED[word]?.first.length ?? -1;
  const sounds: G[] = [];
  const refused: string[] = [];
  for (let i = 0; i < word.length; i++) {
    if (word[i] !== 'g') continue;
    const prev = word[i - 1] ?? '';
    const next = word[i + 1] ?? '';
    if (prev === 'c') continue; // cg is §319's palatal gg, /ddʒ/
    if (prev === 'g' || next === 'g') {
      refused.push('a doubled g, which nothing here reads');
      continue;
    }
    if (i === 0 || i === at || prev === 'n') {
      sounds.push('ɡ');
      continue;
    }
    const ends = i + 1 === word.length || i + 1 === at;
    if (ends) {
      if (FRONT.includes(prev)) refused.push(`a g ending ${i + 1 === at ? 'its first element' : 'the word'} after a palatal vowel is palatal (§324), and is not dotted`);
      else if (!'lr'.includes(prev) && !BACK.includes(prev)) refused.push(`a final g after “${prev}”, which nothing here reads`);
      else if (i + 1 === word.length) sounds.push('x');
      else if (VOICELESS.includes(next)) sounds.push('either');
      else refused.push(`a g before “${next}”, which nothing here reads`);
      continue;
    }
    if (!VOWELS.includes(next) || !(VOWELS.includes(prev) || 'lr'.includes(prev))) {
      refused.push(`a g between “${prev}” and “${next}”, which nothing here reads`);
      continue;
    }
    const weakVerb = row.pos === 'verb' && word.slice(i + 1).startsWith('ian');
    if (!weakVerb && FRONT.includes(prev) && FRONT.includes(next)) {
      refused.push('a g between palatal vowels is palatal (§320), and is not dotted');
      continue;
    }
    sounds.push('ɣ');
  }
  return { sounds, refused };
}

/** The x of a transcription that an h wrote: every h but one beginning a word or an element (§§325–328). */
function xOfH(row: Row): number {
  const at = COMPOUNDED[row.word]?.first.length ?? -1;
  return [...row.word].filter((ch, i) => ch === 'h' && i !== 0 && i !== at).length;
}

describe('every undotted Old English g has the sound Wright gives the guttural g where it stands', () => {
  test('an undotted g stands where the grammar allows the guttural one', () => {
    report(
      checked.flatMap((r) => {
        const { refused } = gsOf(r);
        if (AWAITING_DOTS[r.word]) return refused.length ? [] : [`${r.tgt}: listed as awaiting its dots, and its g reads as guttural`];
        return refused.map((why) => `${r.tgt} ${r.ipa}: ${why}`);
      }),
      'have an undotted g the grammar makes palatal or nothing here reads',
    );
    const stale = Object.keys(AWAITING_DOTS).filter((word) => !headwords.has(word));
    assert.deepEqual(stale, [], `awaiting dots and no longer a headword of lex-ang.tsv: ${stale.join(', ')}`);
  });

  test('an undotted g is a stop where a root begins and after n, voiced inside a word, and voiceless at its end', () => {
    report(
      checked.flatMap((r) => {
        if (AWAITING_DOTS[r.word]) return [];
        const want = gsOf(r).sounds;
        if (!want.length) return [];
        const count = (re: RegExp): number => (r.ipa.match(re) ?? []).length;
        const got = { stop: count(/ɡ/g), voiced: count(/ɣ/g), voiceless: count(/x/g) - xOfH(r) };
        const n = (g: G): number => want.filter((w) => w === g).length;
        const fits =
          got.stop === n('ɡ') &&
          got.voiced >= n('ɣ') &&
          got.voiceless >= n('x') &&
          got.voiced + got.voiceless === n('ɣ') + n('x') + n('either');
        return fits
          ? []
          : [
              `${r.tgt} ${r.ipa}: ${got.stop} ɡ, ${got.voiced} ɣ and ${got.voiceless} x from its g, ` +
                `where the spelling has ${n('ɡ')} ɡ, ${n('ɣ')} ɣ and ${n('x')} x` +
                (n('either') ? `, and ${n('either')} either spirant` : ''),
            ];
      }),
      'give an undotted g the wrong sound',
    );
  });

  test('the g rules have something to police', () => {
    const all = checked.filter((r) => !AWAITING_DOTS[r.word]).flatMap((r) => gsOf(r).sounds);
    const n = (g: G): number => all.filter((w) => w === g).length;
    const afterN = checked.filter((r) => /ng/.test(r.word)).length;
    assert.ok(n('ɡ') > 20, `only ${n('ɡ')} undotted g begin a root or follow n`);
    assert.ok(afterN > 10, `only ${afterN} headwords have ng`);
    assert.ok(n('ɣ') >= 8, `only ${n('ɣ')} undotted g stand inside a word`);
    assert.ok(n('x') >= 2, `only ${n('x')} undotted g end a word after l, r or a guttural vowel`);
    assert.ok(n('either') >= 1, `no undotted g stands before a voiceless consonant`);
  });
});
