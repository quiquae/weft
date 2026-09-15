import type { LetterformId } from './types.ts';
import { getLanguage } from './languages.ts';

/**
 * Letterform normalisation for historical languages.
 *
 * Old English "þēod" is not hard because of the word, it is hard because of the
 * thorn and the macron. Beginners can be shown "theod" and graduate to "þēod"
 * later; that is a difficulty axis independent of vocabulary, and collapsing
 * the two is why most historical-language tools feel impossible on day one.
 *
 * Each flag means "keep this letterform". Flag off = transform it away.
 */

const MACRON_RE = /̄/g;
const BREVE_RE = /̆/g;

type Transform = (s: string) => string;

const TRANSFORMS: Record<LetterformId, Transform> = {
  macrons: (s) => s.normalize('NFD').replace(MACRON_RE, '').replace(BREVE_RE, '').normalize('NFC'),
  thorn: (s) => s.replace(/þ/g, 'th').replace(/Þ/g, 'Th'),
  eth: (s) => s.replace(/ð/g, 'th').replace(/Ð/g, 'Th'),
  ash: (s) => s.replace(/æ/g, 'ae').replace(/Æ/g, 'Ae'),
  wynn: (s) => s.replace(/ƿ/g, 'w').replace(/Ƿ/g, 'W'),
  // Yogh is /j/ initially and /x~ɣ/ (spelled gh) elsewhere in Middle English.
  yogh: (s) =>
    s
      .replace(/^ȝ/, 'y')
      .replace(/^Ȝ/, 'Y')
      .replace(/ȝ/g, 'gh')
      .replace(/Ȝ/g, 'Gh'),
  longS: (s) => s.replace(/ſ/g, 's'),
};

/**
 * Apply the user's letterform preferences to a target-language surface form.
 * Modern languages are returned untouched: stripping French accents would be
 * teaching people to spell badly, not making the word easier.
 */
export function applyLetterforms(
  text: string,
  target: string,
  keep: Partial<Record<LetterformId, boolean>>,
): string {
  const meta = getLanguage(target);
  if (!meta.historical || !meta.letterforms?.length) return text;

  let out = text;
  for (const id of meta.letterforms) {
    if (keep[id]) continue;
    out = TRANSFORMS[id](out);
  }
  return out;
}

/** Which letterform toggles to show for a given language. */
export function letterformsFor(target: string): LetterformId[] {
  return getLanguage(target).letterforms ?? [];
}

/**
 * Cost of a language's unfamiliar orthography, 0..1, given current settings.
 * Feeds the difficulty model so that turning macrons back on is recognised as
 * making the page harder, not as a cosmetic change.
 */
export function orthographyCost(
  target: string,
  keep: Partial<Record<LetterformId, boolean>>,
): number {
  const meta = getLanguage(target);
  const base = 1 - meta.scriptFamiliarity;
  const forms = meta.letterforms ?? [];
  if (!forms.length) return base;
  const kept = forms.filter((f) => keep[f]).length;
  return Math.min(1, base + 0.06 * kept);
}
