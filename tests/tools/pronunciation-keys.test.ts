/**
 * A pronunciation key says only what its pack's transcriptions bear out.
 *
 * A historical language has no voice to play, so the tooltip prints its key
 * under the transcription instead (`pronunciationNote` in
 * `src/core/languages.ts`, read by `src/content/tooltip.ts`), and every word
 * page on the site prints it under its own. Until 2026-10-04 both keys stated
 * rules about bare letters that the transcriptions above them contradicted:
 * "c before front vowels is “ch”" over `cyning` /ˈkyniŋɡ/ and `cēpan`
 * /ˈkeːpɑn/, "g before front vowels is “y”" over `beginnan` and `finger`,
 * "sc is “sh”" over `fisc` /ˈfisk/, and Latin's "ae as /ai̯/" over all ten
 * headwords with *ae*, every one of them transcribed /ae̯/. What the Old
 * English transcriptions do follow, without one exception, is the dots the
 * pack prints — ċ, ġ, sċ — which neither key mentioned. And the site's key
 * was a hand copy of the table's, drifted in both languages.
 *
 * So each key's claims are written down here beside the letters they are
 * about and the sound they promise, and each is held to every headword that
 * spells the letters: a headword spelling them n times must be transcribed
 * with the sound at least n times. That is a necessary condition rather than
 * a sufficient one, and every false rule above fails it. A key cannot say
 * more than its ledger holds, either: with every claim taken out, no
 * respelling (“…”) or transcription (/…/) may be left in it.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGUAGES, getLanguage } from '../../src/core/languages.ts';
import { spelling } from '../../src/core/lexicon.ts';
import type { LangCode } from '../../src/core/types.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PACKS = join(ROOT, 'src/lexicon/packs');

type Claim = {
  /** The words of the key that make the claim, exactly as it prints them. */
  says: string;
  /** What spells it, matched against the headword. */
  letters: RegExp;
  /** What it promises, matched against the headword's transcription. */
  sound: RegExp;
};

/**
 * Every claim each key makes. A key and its ledger move together: rewording
 * a claim fails the first test below until its line here is rewritten, and
 * the new line is then held to the pack.
 */
const KEYS: Partial<Record<LangCode, readonly Claim[]>> = {
  la: [
    { says: 'v as /w/', letters: /v/g, sound: /w/g },
    // A doubled consonant is one long sound: vacca is /ˈwakːa/.
    { says: 'c always hard', letters: /c+/g, sound: /k/g },
    { says: 'ae as /ae̯/', letters: /ae/g, sound: /ae̯/g },
  ],
  ang: [
    { says: 'þ and ð are both “th”', letters: /[þð]/g, sound: /[θð]/g },
    // Not the ċ of sċ, which is a claim of its own.
    { says: 'ċ is “ch”', letters: /(?<!s)ċ/g, sound: /tʃ/g },
    { says: 'ġ is “y”', letters: /ġ/g, sound: /j/g },
    // Not the ʃ of tʃ, which is ċ's.
    { says: 'sċ is “sh”', letters: /sċ/g, sound: /(?<!t)ʃ/g },
    { says: 'cg is “dg”', letters: /cg/g, sound: /dʒ/g },
    { says: 'A macron marks a long vowel', letters: /[āǣēīōūȳ]/g, sound: /ː/g },
  ],
};

/** Each language with a pack, and its headwords' transcriptions as the pack spells them. */
function transcribed(): Map<LangCode, Map<string, string>> {
  const out = new Map<LangCode, Map<string, string>>();
  for (const file of readdirSync(PACKS).filter((f) => /^en-[a-z]{2,3}\.json$/.test(f))) {
    const lang = file.slice(3, -5) as LangCode;
    const pack = JSON.parse(readFileSync(join(PACKS, file), 'utf8'));
    const heads = new Map<string, string>();
    for (const rows of Object.values(pack.entries) as { tgt: string; tgtLemma: string; ipa?: string }[][]) {
      for (const row of rows) {
        // The headword's row: a plural or participle prints a transcription of
        // its own spelling, which the headword's letters cannot be counted against.
        if (row.ipa && row.tgt === spelling(row.tgtLemma) && !heads.has(row.tgtLemma)) heads.set(row.tgtLemma, row.ipa);
      }
    }
    out.set(lang, heads);
  }
  return out;
}

const PACKED = transcribed();
const count = (re: RegExp, s: string): number => (s.match(re) ?? []).length;
const headword = (lemma: string): string => spelling(lemma).normalize('NFC').toLowerCase();

/** The languages whose key a reader is shown beside a transcription from a pack. */
const keyed = (Object.keys(LANGUAGES) as LangCode[]).filter(
  (code) => getLanguage(code).pronunciationNote && (PACKED.get(code)?.size ?? 0) > 0,
);

describe('a pronunciation key says only what its pack bears out', () => {
  test('every claim a key makes is written down here', () => {
    const unheld: string[] = [];
    for (const code of keyed) {
      const key = getLanguage(code).pronunciationNote as string;
      const claims = KEYS[code];
      if (!claims) {
        unheld.push(`${code}: a reader is shown this key and nothing here holds it: ${key}`);
        continue;
      }
      for (const c of claims) if (!key.includes(c.says)) unheld.push(`${code}: the key no longer says “${c.says}”`);
      const rest = claims.reduce((left, c) => left.replace(c.says, ''), key);
      if (/[“"]|\/[^/\s]+\//.test(rest)) unheld.push(`${code}: the key says more than its ledger holds: ${rest}`);
    }

    assert.deepEqual(unheld, [], unheld.join('\n'));
  });

  test('every claim holds in every headword that spells it', () => {
    const broken: string[] = [];
    for (const code of keyed) {
      const heads = PACKED.get(code) as Map<string, string>;
      for (const c of KEYS[code] ?? []) {
        const against = [...heads].filter(([lemma, ipa]) => count(c.sound, ipa) < count(c.letters, headword(lemma)));
        if (against.length) {
          broken.push(
            `${code} “${c.says}”: ${against.length} headwords are transcribed otherwise — ${against
              .slice(0, 6)
              .map(([lemma, ipa]) => `${spelling(lemma)} ${ipa}`)
              .join(', ')}`,
          );
        }
      }
    }

    assert.deepEqual(broken, [], broken.join('\n'));
  });

  test('no key quotes in straight marks', () => {
    const straight = (Object.keys(LANGUAGES) as LangCode[]).filter((code) =>
      getLanguage(code).pronunciationNote?.includes('"'),
    );

    assert.deepEqual(straight, [], `these keys quote in straight marks: ${straight.join(', ')}`);
  });

  test('no line here outlives the key it held', () => {
    const stale = (Object.keys(KEYS) as LangCode[]).filter((code) => !keyed.includes(code));

    assert.deepEqual(stale, [], `KEYS holds claims for languages no reader is shown a key for: ${stale.join(', ')}`);
  });

  test('the rule has something to police', () => {
    // Both shipped historical packs, and every claim tested on headwords
    // that really spell it — a claim about a letter no headword has passes
    // the rule above by inspecting nothing. cg has exactly three.
    for (const code of ['la', 'ang'] as const) assert.ok(keyed.includes(code), `${code} has no key or no pack`);
    const thin: string[] = [];
    for (const code of keyed) {
      const heads = [...(PACKED.get(code) as Map<string, string>).keys()].map(headword);
      for (const c of KEYS[code] ?? []) {
        const n = heads.filter((h) => count(c.letters, h) > 0).length;
        if (n < 3) thin.push(`${code} “${c.says}” is tested on ${n} headwords`);
      }
    }
    assert.deepEqual(thin, [], thin.join('\n'));
  });
});
