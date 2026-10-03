import type { LexEntry } from './types.ts';

/**
 * Orthographic similarity, used to answer "is this word an easy first swap?"
 *
 * The pedagogy is straightforward: a learner meeting "important" as French
 * "important" or "nation" as Spanish "nación" has to do almost no work, gets
 * the reward of comprehension, and learns that the two languages are related.
 * Starting there and widening is the difference between a tool that feels like
 * a game and one that feels like being punished for opening a browser tab.
 */

const COMBINING = /[̀-ͯ᷀-᷿⃐-⃰]/g;

/**
 * Fold a word to a comparison skeleton: lowercase, no diacritics, letters only,
 * no doubled consonants. Latin ligatures are expanded because Old English æ
 * and Latin æ both correspond to English "ae"/"a".
 */
export function fold(s: string): string {
  const expanded = s
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ø/g, 'o')
    .replace(/[þð]/g, 'th')
    .replace(/ƿ/g, 'w')
    .replace(/ȝ/g, 'g')
    .replace(/ſ/g, 's')
    .replace(/ß/g, 'ss');
  const stripped = expanded.normalize('NFD').replace(COMBINING, '');
  const letters = stripped.replace(/[^a-z]/g, '');
  return collapseDoubles(letters);
}

/**
 * Fold a word for *ordering*: lowercase, diacritics removed, nothing else.
 *
 * Deliberately not `fold`. That one collapses doubled consonants, which is
 * right for asking "are these the same word?" and wrong for sorting, where it
 * would file "pomme" and "pome" at the same key. And deliberately not
 * `localeCompare`, which reads correctly but depends on the ICU data the
 * runtime was built with, so a contributor's machine and CI can disagree —
 * the determinism bug one layer down. Plain code units are deterministic
 * everywhere and put "pierre" before "père", because `i` (U+0069) sorts below
 * `è` (U+00E8): correct, and it reads like a bug in a list of French.
 */
export function orderKey(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(COMBINING, '');
}

export function collapseDoubles(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i] as string;
    if (c !== s[i - 1]) out += c;
  }
  return out;
}

/** Jaro similarity, 0..1. */
export function jaro(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (la === 0 || lb === 0) return 0;

  const window = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const aFlags = new Uint8Array(la);
  const bFlags = new Uint8Array(lb);
  let matches = 0;

  for (let i = 0; i < la; i++) {
    const lo = Math.max(0, i - window);
    const hi = Math.min(i + window + 1, lb);
    for (let j = lo; j < hi; j++) {
      if (bFlags[j] === 0 && a[i] === b[j]) {
        aFlags[i] = 1;
        bFlags[j] = 1;
        matches++;
        break;
      }
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (aFlags[i] === 0) continue;
    while (bFlags[k] === 0) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  const t = transpositions / 2;
  return (matches / la + matches / lb + (matches - t) / matches) / 3;
}

/** Jaro-Winkler, which rewards a shared prefix — exactly what cognates share. */
export function jaroWinkler(a: string, b: string, prefixScale = 0.1): number {
  const j = jaro(a, b);
  if (j < 0.7) return j;
  let prefix = 0;
  const max = Math.min(4, a.length, b.length);
  while (prefix < max && a[prefix] === b[prefix]) prefix++;
  return j + prefix * prefixScale * (1 - j);
}

/** Classic Levenshtein distance, iterative with a single row. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Uint32Array(b.length + 1);
  let curr = new Uint32Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    const ca = a[i - 1];
    for (let j = 1; j <= b.length; j++) {
      const cost = ca === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (curr[j - 1] as number) + 1,
        (prev[j] as number) + 1,
        (prev[j - 1] as number) + cost,
      );
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[b.length] as number;
}

/** 1 - normalised Levenshtein distance, 0..1. */
export function levenshteinSimilarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/**
 * Suffix correspondences that a learner can be taught as a rule rather than
 * word by word. A pair matching one of these is more learnable than its raw
 * edit distance suggests, so it earns a bonus.
 */
const SUFFIX_CORRESPONDENCES: ReadonlyArray<readonly [RegExp, RegExp]> = Object.freeze([
  [/tion$/, /(?:tion|cion|zione|cao|ction|tione)$/],
  [/ity$/, /(?:ite|idad|ita|idade|itat)$/],
  [/ous$/, /(?:eux|oso|os)$/],
  [/ary$/, /(?:aire|ario|ario)$/],
  [/able$/, /(?:able|abile|avel)$/],
  [/ic$/, /(?:ique|ico|isch)$/],
  [/ism$/, /(?:isme|ismo|ismus)$/],
  [/ist$/, /(?:iste|ista)$/],
  [/ence$/, /(?:ence|encia|enza)$/],
  [/ance$/, /(?:ance|ancia|anza)$/],
  [/ment$/, /(?:ment|mento|miento)$/],
  [/ure$/, /(?:ure|ura)$/],
  [/ive$/, /(?:if|ive|ivo)$/],
  [/al$/, /(?:al|el|ale)$/],
  [/or$/, /(?:eur|or|ore)$/],
  [/ate$/, /(?:er|ar|are|at)$/],
  [/ly$/, /(?:ment|mente)$/],
]);

function suffixBonus(srcFolded: string, tgtFolded: string): number {
  for (const [s, t] of SUFFIX_CORRESPONDENCES) {
    if (s.test(srcFolded) && t.test(tgtFolded)) {
      // Require the stems to be at least loosely related, so "ly"/"mente"
      // does not make every adverb look like a cognate.
      const sStem = srcFolded.replace(s, '');
      const tStem = tgtFolded.replace(t, '');
      if (sStem.length >= 3 && jaroWinkler(sStem, tStem) >= 0.72) return 0.18;
      return 0.04;
    }
  }
  return 0;
}

/**
 * How recognisable this target word is to someone who knows the source word.
 *
 * Returns 0..1. Three signals, taken as a maximum rather than a sum so that
 * one strong signal is enough:
 *
 *  - Orthographic: folded Jaro-Winkler. Catches nation/nación, important/
 *    important, water/Wasser.
 *  - Morphological: a known suffix correspondence with a related stem.
 *  - Etymological: the pack says English took a word from this one — Old
 *    English hūs became "house", and English borrowed "vaccine" from Latin
 *    vacca. hūs scores 0.62 orthographically but is maximally learnable once
 *    you are told where "house" came from, so etymon presence floors the score.
 */
export function cognateScore(entry: LexEntry): number {
  const src = fold(entry.src || entry.lemma);
  const tgt = fold(entry.tgt || entry.tgtLemma);
  if (!src || !tgt) return 0;

  const ortho = jaroWinkler(src, tgt);
  const morph = ortho + suffixBonus(src, tgt);

  let etym = 0;
  if (entry.etymonOf) {
    const descendant = fold(entry.etymonOf);
    // An etymon the learner can actually see the descent of scores higher than
    // one where sound change has obscured it.
    etym = 0.7 + 0.3 * jaroWinkler(descendant, tgt);
  }

  return Math.min(1, Math.max(ortho, morph, etym));
}

/**
 * What a word with an etymon is to the English word it names: its ancestor,
 * for a stage of English, and its source for every language English borrowed
 * from. The tooltip's badge and the reason line beneath it both read this, so
 * the two cannot disagree.
 *
 * Chosen by `ancestorOfEnglish`, never by `historical`. It was once chosen by
 * the second, so Latin, being dead, was called the ancestor of 300 English
 * words it lent — the mistake #49 took out of the feed's verbs.
 */
export function etymonRelation(ancestorOfEnglish: boolean): string {
  return ancestorOfEnglish ? 'ancestor of English' : 'source of English';
}

/**
 * A small, human-readable reason for the score, shown in the "why this word?"
 * debug panel and in the tooltip.
 *
 * `ancestorOfEnglish` is the word's language's flag, required so a caller
 * cannot forget it and call Latin an ancestor; see `etymonRelation`.
 */
export function cognateReason(entry: LexEntry, ancestorOfEnglish: boolean): string | null {
  if (entry.etymonOf) return `${etymonRelation(ancestorOfEnglish)} “${entry.etymonOf}”`;
  const src = fold(entry.src || entry.lemma);
  const tgt = fold(entry.tgt || entry.tgtLemma);
  if (!src || !tgt) return null;
  if (src === tgt) return 'identical to the English word';
  const jw = jaroWinkler(src, tgt);
  if (jw >= 0.88) return 'near-identical to the English word';
  if (jw >= 0.75) return 'recognisably related to the English word';
  if (suffixBonus(src, tgt) >= 0.18) return 'same root, predictable ending';
  return null;
}
