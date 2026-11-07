import type { LangCode, LanguageMeta, LetterformId } from './types.ts';

/**
 * Language registry.
 *
 * Historical languages are first-class here, not an afterthought. They are the
 * best case for the diglot-weave method precisely because so much of English
 * descends from them: an Old English word woven into an English sentence is
 * often the literal ancestor of the word it replaced, and Latin supplies the
 * learned half of the English lexicon. The tooltip's etymon badge turns that
 * into the motivating feedback loop — you are not memorising a foreign word,
 * you are being shown where your own word came from.
 */

/**
 * Types one entry. Marked as having no side effects so that esbuild can drop the
 * table from a bundle that never reads it, which it cannot for an unmarked call.
 */
const L = /* @__NO_SIDE_EFFECTS__ */ (m: LanguageMeta): LanguageMeta => m;

export const LANGUAGES: Record<LangCode, LanguageMeta> = {
  /* ------------------------------------------------------- source languages */
  en: L({
    code: 'en',
    name: 'English',
    endonym: 'English',
    historical: false,
    rtl: false,
    morphology: 'agreeing',
    ttsLang: 'en-US',
    scriptFamiliarity: 1,
  }),

  /* ------------------------------------------------------- modern languages */
  fr: L({
    code: 'fr',
    name: 'French',
    endonym: 'français',
    historical: false,
    rtl: false,
    morphology: 'agreeing',
    ttsLang: 'fr-FR',
    scriptFamiliarity: 0.97,
  }),
  es: L({
    code: 'es',
    name: 'Spanish',
    endonym: 'español',
    historical: false,
    rtl: false,
    morphology: 'agreeing',
    ttsLang: 'es-ES',
    scriptFamiliarity: 0.98,
  }),
  de: L({
    code: 'de',
    name: 'German',
    endonym: 'Deutsch',
    historical: false,
    rtl: false,
    morphology: 'agreeing',
    ttsLang: 'de-DE',
    scriptFamiliarity: 0.97,
  }),
  it: L({
    code: 'it',
    name: 'Italian',
    endonym: 'italiano',
    historical: false,
    rtl: false,
    morphology: 'agreeing',
    ttsLang: 'it-IT',
    scriptFamiliarity: 0.99,
  }),
  pt: L({
    code: 'pt',
    name: 'Portuguese',
    endonym: 'português',
    historical: false,
    rtl: false,
    morphology: 'agreeing',
    ttsLang: 'pt-PT',
    scriptFamiliarity: 0.97,
  }),
  nl: L({
    code: 'nl',
    name: 'Dutch',
    endonym: 'Nederlands',
    historical: false,
    rtl: false,
    morphology: 'agreeing',
    ttsLang: 'nl-NL',
    scriptFamiliarity: 0.99,
  }),
  sv: L({
    code: 'sv',
    name: 'Swedish',
    endonym: 'svenska',
    historical: false,
    rtl: false,
    morphology: 'agreeing',
    ttsLang: 'sv-SE',
    scriptFamiliarity: 0.96,
  }),
  cy: L({
    code: 'cy',
    name: 'Welsh',
    endonym: 'Cymraeg',
    historical: false,
    rtl: false,
    morphology: 'agreeing',
    ttsLang: 'cy-GB',
    scriptFamiliarity: 0.95,
  }),
  ga: L({
    code: 'ga',
    name: 'Irish',
    endonym: 'Gaeilge',
    historical: false,
    rtl: false,
    morphology: 'agreeing',
    ttsLang: 'ga-IE',
    scriptFamiliarity: 0.93,
  }),

  /* --------------------------------------------------- historical languages */
  la: L({
    code: 'la',
    name: 'Latin',
    endonym: 'Latina',
    historical: true,
    era: 'Classical, c. 75 BC – AD 200',
    rtl: false,
    // English marks case by word order, so a nominative singular headword
    // slots into an English frame without becoming ungrammatical.
    morphology: 'citation',
    // Chrome/macOS ship no Latin voice. Italian is the pragmatic stand-in for
    // Ecclesiastical pronunciation, but silence plus IPA is more honest for a
    // classical reconstruction, so we default to no audio and show IPA.
    ttsLang: null,
    pronunciationNote:
      'Classical reconstruction. Every letter is pronounced; v as /w/, c always hard, ae as /ae̯/.',
    letterforms: ['macrons'],
    scriptFamiliarity: 1,
  }),
  ang: L({
    code: 'ang',
    name: 'Old English',
    endonym: 'Englisc',
    historical: true,
    ancestorOfEnglish: true,
    era: 'West Saxon, c. 900–1050',
    rtl: false,
    morphology: 'citation',
    ttsLang: null,
    pronunciationNote:
      'þ and ð are both “th”; ċ is “ch”, ġ is “y”, sċ is “sh” and cg is “dg”. A macron marks a long vowel.',
    letterforms: ['macrons', 'thorn', 'eth', 'ash', 'wynn'],
    scriptFamiliarity: 0.82,
  }),
  enm: L({
    code: 'enm',
    name: 'Middle English',
    endonym: 'Middel Englisch',
    historical: true,
    ancestorOfEnglish: true,
    era: 'Chaucerian, c. 1350–1450',
    rtl: false,
    morphology: 'citation',
    ttsLang: null,
    pronunciationNote:
      'Pre-Great-Vowel-Shift values: “i” as /iː/, “ou” as /uː/. Final -e is usually pronounced.',
    letterforms: ['thorn', 'yogh', 'longS'],
    scriptFamiliarity: 0.94,
  }),
  non: L({
    code: 'non',
    name: 'Old Norse',
    endonym: 'norrœnt mál',
    historical: true,
    era: 'Saga-age, c. 1150–1350',
    rtl: false,
    morphology: 'citation',
    ttsLang: null,
    pronunciationNote:
      'þ is “th” in thing, ð is “th” in this; á/é/í/ó/ú are long. Stress always falls on the first syllable.',
    letterforms: ['macrons', 'thorn', 'eth', 'ash'],
    scriptFamiliarity: 0.86,
  }),
  grc: L({
    code: 'grc',
    name: 'Ancient Greek',
    endonym: 'Ἑλληνική',
    historical: true,
    era: 'Attic, 5th–4th c. BC',
    rtl: false,
    morphology: 'citation',
    ttsLang: null,
    pronunciationNote:
      'Attic reconstruction. Pitch accent marked by the diacritics; η is a long open e, ου a long u.',
    scriptFamiliarity: 0.15,
  }),
  got: L({
    code: 'got',
    name: 'Gothic',
    endonym: 'gutiska razda',
    historical: true,
    era: 'Wulfila Bible, 4th c. AD',
    rtl: false,
    morphology: 'citation',
    ttsLang: null,
    pronunciationNote:
      'Transliterated from the Gothic alphabet. þ is “th”; ai and au are short e and o before h and r.',
    letterforms: ['thorn'],
    scriptFamiliarity: 0.9,
  }),
};

export const SOURCE_LANGUAGES: LangCode[] = ['en'];

export function getLanguage(code: LangCode): LanguageMeta {
  const meta = LANGUAGES[code];
  if (!meta) throw new Error(`unknown language: ${code}`);
  return meta;
}

export function isKnownLanguage(code: string): boolean {
  return Object.hasOwn(LANGUAGES, code);
}

export function targetLanguages(): LanguageMeta[] {
  return Object.values(LANGUAGES).filter((l) => l.code !== 'en');
}

export function historicalLanguages(): LanguageMeta[] {
  return targetLanguages().filter((l) => l.historical);
}

export function modernLanguages(): LanguageMeta[] {
  return targetLanguages().filter((l) => !l.historical);
}

/** Letterform labels for the settings UI, keyed by id. */
export const LETTERFORM_LABELS: Record<LetterformId, { label: string; detail: string }> = {
  macrons: {
    label: 'Keep macrons',
    detail: 'Show vowel length: rēx rather than rex, hūs rather than hus.',
  },
  thorn: { label: 'Keep þ (thorn)', detail: 'Off replaces þ with th: þing becomes thing.' },
  eth: { label: 'Keep ð (eth)', detail: 'Off replaces ð with th: brōðor becomes brōthor.' },
  ash: { label: 'Keep æ (ash)', detail: 'Off replaces æ with ae: wæter becomes waeter.' },
  wynn: { label: 'Keep ƿ (wynn)', detail: 'Off replaces ƿ with w. Most editions already do.' },
  yogh: { label: 'Keep ȝ (yogh)', detail: 'Off replaces ȝ with y or gh as the sound requires.' },
  longS: { label: 'Keep ſ (long s)', detail: 'Off replaces ſ with s.' },
};
