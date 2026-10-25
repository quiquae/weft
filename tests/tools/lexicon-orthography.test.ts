/**
 * A Latin word has to be spelled the same way everywhere Weft shows it.
 *
 * The lexicon marks vowel length, because the IPA is generated from the
 * orthography and is only deterministic once it is marked: the pack's headword
 * for a thousand is `mīlle`. But the *prose around it* was written by hand, so
 * the tooltip note under `mīlle` read "a mile was mille passūs" — the same word,
 * one line apart, spelled two ways — and the same bare `mille` had reached the
 * published meta description of the Latin landing page, `README.md` and
 * `docs/PEDAGOGY.md`. Nothing generates that prose from the lexicon, so nothing
 * could notice.
 *
 * Two guards, because the copy lives in two different kinds of place.
 *
 * The first is the pack notes, which ship: they are tooltip text, sitting
 * directly beneath the headword they contradict. The rule is deliberately
 * narrow — a note may not spell *its own* entry's headword without the macron.
 * Widening it to every headword in the pack makes it fire 14 times on Old
 * English, because headwords collide with ordinary English words that notes
 * legitimately use (`an`, `is`, `dead`, `ham`), and a gate that fails for two
 * different reasons gets ignored. Only `tgtLemma` counts, not `tgt`: the
 * inflected form is often the macron-bearing one (`manus` → `manūs`), and the
 * singular in the note is then correct rather than careless.
 *
 * Its one exemption is a note that shows *both* spellings. That is not drift,
 * it is the point of the note: `mālum` apple and `malum` evil differ only in
 * vowel length, and saying so requires writing both.
 *
 * The second guard is the documents that quote Latin headwords at a reader. It
 * stops short of sweeping every document because Latin and English are full of
 * homographs — `docs/LAUNCH.md` says a Show HN post "dies" and
 * `docs/PRIVACY.md` says "your OS", which collide with `diēs` and `ōs` and have
 * nothing to do with the lexicon. Same reasoning as above: a general scan of
 * English prose fires for the wrong reason. But the boundary is drawn by
 * measurement, not by assumption, and it had only ever been measured against
 * those two: adding `site/index.html` and `docs/STORE-LISTING.md` turns out to
 * fire nothing at all, so both are in — the landing page and the copy that goes
 * to Google are the last two places a misspelling should survive.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spelling } from '../../src/core/lexicon.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * The documents that quote Latin headwords at a reader, rather than mentioning
 * Latin. `site/index.html` and `docs/STORE-LISTING.md` were added after being
 * measured rather than assumed: adding them plus `docs/LAUNCH.md` fires exactly
 * one offender, and it is the known homograph below, so the first two are clean
 * and the third stays out.
 */
const PROSE = [
  'README.md',
  'docs/PEDAGOGY.md',
  'tools/build-site.mjs',
  'site/index.html',
  'docs/STORE-LISTING.md',
];

/**
 * Latin that Weft writes down but the lexicon never defines.
 *
 * Both guards below derive their vocabulary from the packs, so they can only
 * police a word the lexicon contains — and the prose is free to reach for Latin
 * it never glosses. `peninsula` is explained as `paene īnsula` in four source
 * files and `īnsula` is not an entry, so every one of them was invisible: the
 * note under `paene`, the seed comment above it, `README.md` and
 * `docs/PEDAGOGY.md`. That note alone reaches three surfaces — the shipped
 * tooltip, `/latin/paene`, and the `latin-words-in-everyday-english` hub —
 * while `docs/LAUNCH.md` and `site/index.html` had the macron all along.
 *
 * Unlike the headword list, this one is applied across every note rather than
 * only to the entry that owns it, and that is safe *because* it is hand-picked:
 * the 14 false positives that rule out a pack-wide headword scan are English
 * homographs (`an`, `is`, `dead`, `ham`), and a word only enters this table once
 * someone has checked it is not one. Add to it when prose gains a Latin word the
 * lexicon does not carry.
 *
 * `homō` and `clāvicula` joined it when the notes under `vir` and `clāvis` were
 * rewritten to name them. Neither is a headword, and neither bare spelling
 * occurs in any note or in the prose scanned below — which is what makes each
 * safe to police everywhere. The match is case-sensitive, so the genus in
 * "Homo sapiens" is not the Latin noun misspelled.
 *
 * `iānitor` joined it when the note under `iānua` was rewritten to name the
 * doorkeeper its English *janitor* came through. Its bare form is `ianitor`,
 * not the English word, so *janitor* in prose is never mistaken for it; before
 * it was added, a bare `ianitor` planted in the shipped note passed unseen.
 */
const UNDEFINED: ReadonlyMap<string, string> = new Map([
  ['insula', 'īnsula'],
  ['homo', 'homō'],
  ['clavicula', 'clāvicula'],
  ['ianitor', 'iānitor'],
]);

type Entry = { tgtLemma?: string; note?: string; src?: string };

/** `mīlle` → `mille`. Decompose, drop the combining macron, recompose. */
const bare = (s: string): string => s.normalize('NFD').replace(/̄/g, '').normalize('NFC');

const pack = (lang: string): Entry[] =>
  Object.values(
    JSON.parse(readFileSync(join(ROOT, `src/lexicon/packs/en-${lang}.json`), 'utf8')).entries as Record<
      string,
      Entry[]
    >,
  ).flat();

/**
 * Macron-stripped headword → the way the pack spells it.
 *
 * Read from the spelling, without a homograph number: `rīċe²` is the second
 * word spelled rīċe, and the bare form a note might wrongly write is `riċe`.
 */
function headwords(entries: Entry[]): Map<string, string> {
  const found = new Map<string, string>();
  for (const { tgtLemma } of entries) {
    for (const word of spelling(tgtLemma ?? '').split(/\s+/)) {
      if (word && bare(word) !== word) found.set(bare(word).toLowerCase(), word);
    }
  }
  return found;
}

/** Whole-word, and not the tail of a hyphenated English suffix like `-ham`. */
const writes = (text: string, word: string): boolean =>
  new RegExp(String.raw`(^|[^\p{L}-])${word}(?![\p{L}])`, 'u').test(text);

describe('a Latin word is spelled the same way everywhere Weft shows it', () => {
  test('a pack note spells its own headword the way the pack does', () => {
    const offenders: string[] = [];

    for (const lang of ['la', 'ang']) {
      for (const entry of pack(lang)) {
        const { note = '', tgtLemma = '', src = '?' } = entry;
        if (!note) continue;

        for (const [stripped, headword] of [...headwords([entry]), ...UNDEFINED]) {
          // A note showing both spellings is contrasting vowel length on purpose.
          if (note.includes(headword)) continue;
          if (writes(note, stripped)) {
            offenders.push(`en-${lang} ${src} → ${tgtLemma}: note writes "${stripped}" — ${note}`);
          }
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `${offenders.length} tooltip notes spell their own headword without its macron:\n  ${offenders.join('\n  ')}`,
    );
  });

  test('published prose spells a Latin headword the way the lexicon does', () => {
    const latin = new Map([...headwords(pack('la')), ...UNDEFINED]);
    const offenders: string[] = [];

    for (const file of PROSE) {
      const text = readFileSync(join(ROOT, file), 'utf8');
      // Paragraph by paragraph, so a passage contrasting vowel length can show
      // both spellings the way a pack note can.
      for (const para of text.split(/\n\s*\n/)) {
        for (const [stripped, headword] of latin) {
          if (para.includes(headword)) continue;
          if (writes(para, stripped)) {
            offenders.push(`${file}: writes "${stripped}", the lexicon spells it "${headword}"`);
          }
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `${offenders.length} places in published copy disagree with the lexicon's own spelling:\n  ${[...new Set(offenders)].join('\n  ')}`,
    );
  });
});

/**
 * A note quotes with the same marks the site's own prose does.
 *
 * Latin and Old English were seeded with a straight `"`; French was seeded with
 * curly `“ ”`; the other five packs carry no notes at all. Reading all 59
 * straight-quoted notes shows this is not two different jobs — both packs quote
 * target-language citation forms (`"mann"`, `"frēon"`) *and* English descendant
 * words (`"muscle"`, `"despair"`, `"hopeless"`, `"warden"`), the same mix French
 * writes in curly, so the split tracks which pack a note was typed into rather
 * than what kind of word it names. `site/index.html` uses curly quotes 24 times
 * in running prose and straight none, so curly is the site's own convention;
 * unifying on it, rather than leaving two conventions, is what this guard now
 * holds. The note itself is plain text — `tooltip.ts`'s `el()` sets
 * `textContent`, not `innerHTML` — so a curly quote is a content change only,
 * with nothing to escape and no markup to add.
 */
const ALL_LANGS = readdirSync(join(ROOT, 'src/lexicon/packs'))
  .filter((f) => f.startsWith('en-') && f.endsWith('.json'))
  .map((f) => f.slice('en-'.length, -'.json'.length));

describe('a lexicon note quotes with the same marks the site itself does', () => {
  test('no pack note contains a straight double quote', () => {
    const offenders: string[] = [];

    for (const lang of ALL_LANGS) {
      for (const entry of pack(lang)) {
        const { note = '', tgtLemma = '', src = '?' } = entry;
        if (note.includes('"')) {
          offenders.push(`en-${lang} ${src} → ${tgtLemma}: ${note}`);
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `${offenders.length} notes quote with a straight " where the site's own prose uses curly “ ”:\n  ${offenders.join('\n  ')}`,
    );
  });

  test('the guard has something to police', () => {
    assert.ok(ALL_LANGS.length >= 7, `expected at least 7 packs, found ${ALL_LANGS.length}`);
  });
});

/*
 * An Old English second form keeps its headword's dots.
 *
 * The pack dots the palatal c and g, ċ and ġ, and pronounces what it dots, so
 * a plural or a participle that drops a dot its headword carries spells one
 * stem two ways, and one of them wrongly. On 2026-10-04 three did: `ċild` wove
 * "children" as `cildru`, `ċildclāð` "babies" as `cildclāðas`, and `æġ`
 * "eggs" as `ǣgru`, where English Wiktionary declines `ċild` on its dotted
 * stem and writes `{{ang-noun|ǣġ|n|ǣġru}}`. A dot may go where a back vowel
 * follows, which is the guttural sound coming back — `fisċ`, `fiscas`, as
 * Wiktionary declines it on the stems `fisċ|fisc`, and `dæġ`, `dagas`, which
 * Wright § 320 prints — but it need not: `ċiriċe` keeps both in `ċiriċan`,
 * as its table prints it and Bülbring § 499 Anm. 4 prints the West Saxon
 * "ćirićean 'Kirchen'", where the pack wove `ċirican` until 2026-10-25.
 */
type Form = Entry & { tgt?: string };

const DOTTED = new Set(['ċ', 'ġ']);
const BACK = new Set([...'aāoōuū']);
/** A letter without its marks: ċ is c and ǣ is æ, so a stem can be followed across them. */
const base = (ch: string): string => ch.normalize('NFD').replace(/\p{Mn}/gu, '');

/** How a second form departs from its headword's dots along the stem they share, or nothing. */
function departs(head: string, form: string): string | undefined {
  const h = [...head];
  const f = [...form];
  for (let k = 0; k < Math.min(h.length, f.length) && base(h[k] as string) === base(f[k] as string); k++) {
    const next = f[k + 1] ?? '';
    if (DOTTED.has(h[k] as string) && !DOTTED.has(f[k] as string) && !BACK.has(next))
      return `drops the dot of its headword's “${h[k]}”${next ? ` before “${next}”` : ' at its end'}`;
    if (!DOTTED.has(h[k] as string) && DOTTED.has(f[k] as string)) return `dots a “${f[k]}” its headword leaves bare`;
  }
  return undefined;
}

describe('an Old English second form keeps its headword’s dots', () => {
  const forms = (pack('ang') as Form[]).filter((e) => e.tgt && e.tgt !== spelling(e.tgtLemma ?? ''));

  test('a plural or a participle drops a dot only where a back vowel follows', () => {
    const offenders = forms.flatMap((e) => {
      const head = spelling(e.tgtLemma ?? '');
      const why = departs(head, e.tgt as string);
      return why ? [`en-ang ${e.src} → ${e.tgt}, of ${head}: ${why}`] : [];
    });
    assert.deepEqual(offenders, [], `${offenders.length} second forms spell their stem another way:\n  ${offenders.join('\n  ')}`);
  });

  test('the rule has something to police', () => {
    const dotted = forms.filter((e) => [...spelling(e.tgtLemma ?? '')].some((ch) => DOTTED.has(ch)));
    const undone = dotted.filter((e) => [...(e.tgt as string)].filter((ch) => DOTTED.has(ch)).length < [...spelling(e.tgtLemma ?? '')].filter((ch) => DOTTED.has(ch)).length);
    assert.ok(forms.length > 150, `only ${forms.length} Old English second forms were read`);
    assert.ok(dotted.length > 20, `only ${dotted.length} second forms belong to a dotted headword`);
    assert.ok(undone.length >= 2, `only ${undone.length} second forms rightly drop a dot before a back vowel`);
  });
});

/**
 * Latin is Classical in its second forms too, and a word made of two declined
 * words is where the two periods part. `iūsiūrandum`, an oath, is `iūs` and
 * the gerundive `iūrandum` written as one, and Classical Latin declines both:
 * Lewis & Short gives its genitive as "jurisjurandi" and cites Cicero writing
 * it apart, "jurisque jurandi". Medieval
 * Latin sometimes declines only the second, as English Wiktionary's
 * declension note says in as many words, and that is how the seed came to
 * weave "oaths" as `iūsiūranda` until 2026-10-05. The Classical plural by the
 * same rule, `iūraiūranda`, is in Wiktionary's generated table and in no text
 * found; Lewis & Short's one plural is bare "jura" (Paul. ex Fest. 132, 29),
 * which is `iūs`'s own plural, rights and laws, so weaving it would teach a
 * reader the word for laws. The row weaves no plural, which the seed's header
 * calls the correct outcome, and the reason is kept here rather than in a
 * commit message: a plural put back fails by name, saying what was read.
 */
type Compound = { parts: readonly string[]; plural?: string; read: string };

const COMPOUNDS: ReadonlyMap<string, Compound> = new Map([
  [
    'iūsiūrandum',
    {
      parts: ['iūs', 'iūrandum'],
      read:
        'Lewis & Short has the plural only as bare “jura” (Paul. ex Fest. 132, 29), the plural of iūs; ' +
        'Wiktionary’s “iūraiūranda” is generated by its table and cited from no text, and “iūsiūranda” is Medieval',
    },
  ],
]);

describe('a Latin word made of two declined words is woven as Classical Latin declines it', () => {
  const entries = pack('la') as Form[];

  test('its second form is the one the dictionary gives, or there is none', () => {
    const offenders = entries.flatMap((e) => {
      const head = spelling(e.tgtLemma ?? '');
      const compound = COMPOUNDS.get(head);
      if (!compound || !e.tgt || e.tgt === head || e.tgt === compound.plural) return [];
      return [`en-la ${e.src} → ${e.tgt}, of ${head}: ${compound.plural ? `the plural is ${compound.plural}` : compound.read}`];
    });
    assert.deepEqual(offenders, [], `${offenders.length} compounds are woven in a form Classical Latin does not use:\n  ${offenders.join('\n  ')}`);
  });

  test('every listed word is a headword the pack teaches, spelled by its parts', () => {
    const taught = new Set(entries.map((e) => spelling(e.tgtLemma ?? '')));
    const stale = [...COMPOUNDS].flatMap(([word, { parts }]) => [
      ...(taught.has(word) ? [] : [`${word} is listed, and the Latin pack teaches no such headword`]),
      ...(parts.join('') === word ? [] : [`${word} is listed as ${parts.join(' + ')}, which spells something else`]),
    ]);
    assert.deepEqual(stale, [], stale.join('\n'));
  });
});

/**
 * And a Latin noun its dictionary gives no plural to weave is woven in the
 * singular only. `vesper`'s head in Lewis & Short says "the plur. not used",
 * and `caelum`'s gives only "plur. caeli, only poet." — masculine, so the
 * row's neuter could not be printed under it either. The seed wove "evenings"
 * as `vesperēs` and "skies" as `caela`, regular forms neither entry gives,
 * until 2026-10-06; reading every Latin noun's head for "plur." when the
 * genders were read found the two. The reason is kept here, as `COMPOUNDS`
 * keeps `iūsiūrandum`'s, so a plural put back fails saying what was read.
 */
const SINGULAR: ReadonlyMap<string, string> = new Map([
  ['vesper', 'Lewis & Short: “(in class. prose mostly acc. vesperum, and abl. vespere, or adverb. vesperi; the plur. not used), m.”'],
  ['caelum', 'Lewis & Short: “plur. caeli, only poet., Lucr. 2, 1097” — a masculine plural, under a neuter row'],
]);

describe('a Latin noun its dictionary gives no plural to weave is woven in the singular', () => {
  const entries = pack('la') as Array<Form & { pos?: string }>;

  test('no second form is woven for it', () => {
    const offenders = entries.flatMap((e) => {
      const head = spelling(e.tgtLemma ?? '');
      const read = SINGULAR.get(head);
      return read && e.tgt && e.tgt !== head ? [`en-la ${e.src} → ${e.tgt}, of ${head}: ${read}`] : [];
    });
    assert.deepEqual(offenders, [], `${offenders.length} Latin plurals are forms the dictionary does not give:\n  ${offenders.join('\n  ')}`);
  });

  test('every listed word is a noun the pack teaches', () => {
    const taught = new Set(entries.filter((e) => e.pos === 'noun').map((e) => spelling(e.tgtLemma ?? '')));
    const stale = [...SINGULAR.keys()].filter((w) => !taught.has(w)).map((w) => `${w} is listed, and the Latin pack teaches no such noun`);
    assert.deepEqual(stale, [], stale.join('\n'));
  });
});
