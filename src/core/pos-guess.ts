import type { Pos, Token } from './types.ts';

/**
 * Coarse part-of-speech guessing from local context.
 *
 * Needed only on the provider path: the shipped packs carry a checked part of
 * speech, but a word the packs have never seen has to be classified before it
 * can be sent for translation, because "book" the noun and "book" the verb
 * get different answers.
 *
 * This is a heuristic and it is allowed to decline. Returning null for a word
 * it cannot place is the important behaviour — an inflected form guessed
 * wrong would be sent, translated, cached and then woven into the page as a
 * grammatically impossible form. Silence is cheaper than that.
 */

const DETERMINERS = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her',
  'its', 'our', 'their', 'some', 'any', 'no', 'every', 'each', 'both', 'another',
  'such', 'which', 'whose', 'many', 'much', 'few', 'several',
]);

const MODALS = new Set([
  'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must',
  'let', 'help', 'make', 'dare', 'need',
]);

const SUBJECT_PRONOUNS = new Set(['i', 'you', 'we', 'they', 'he', 'she', 'it', 'who']);

/**
 * The subject pronouns whose present tense carries -s: "she walks", never
 * "she walk". So a bare word after one is a past, a modal or an adverb, and
 * never the base form a provider's infinitive is woven under.
 */
const THIRD_PERSON_SINGULAR = new Set(['he', 'she', 'it']);

/**
 * Irregular simple pasts, which no suffix gives away: "they went" is not
 * "they walk", and a provider asked for the infinitive puts "aller" under
 * "went". English has a closed list of them, so it can be written down.
 * Left out: a past spelled like a base form a reader would mean ("put",
 * "read", "lay", "bore", "wound", "ground", "bound"), since declining those
 * after "they" would decline the present too; a past ending in -ed ("fled",
 * "led"), which the inflection check already declines; and a word under
 * three letters, which is never guessed. Only the pronoun rule reads it: a
 * past after "the" or "of" is the noun it is spelled like, "on the left".
 */
const IRREGULAR_PASTS = new Set([
  'arose', 'ate', 'awoke', 'became', 'began', 'bent', 'bit', 'blew', 'bought',
  'broke', 'brought', 'built', 'burnt', 'came', 'caught', 'chose', 'clung',
  'could', 'crept', 'dealt', 'did', 'dove', 'drank', 'dreamt', 'drew', 'drove',
  'dug', 'dwelt', 'fell', 'felt', 'flew', 'flung', 'forbade', 'foresaw',
  'forgave', 'forgot', 'fought', 'found', 'froze', 'gave', 'got', 'grew', 'had',
  'heard', 'held', 'hid', 'hung', 'kept', 'knelt', 'knew', 'laid', 'leapt',
  'learnt', 'left', 'lent', 'lit', 'lost', 'made', 'meant', 'met', 'might',
  'mistook', 'misunderstood', 'overcame', 'overheard', 'oversaw', 'overtook',
  'paid', 'ran', 'rang', 'rode', 'rose', 'said', 'sang', 'sank', 'sat', 'saw',
  'sent', 'shone', 'shook', 'shot', 'should', 'shrank', 'slept', 'slew', 'slid',
  'sold', 'sought', 'spat', 'spelt', 'spent', 'spilt', 'spoke', 'sprang',
  'spun', 'stank', 'stole', 'stood', 'strode', 'struck', 'stuck', 'stung',
  'swam', 'swept', 'swore', 'swung', 'taught', 'thought', 'threw', 'told',
  'took', 'tore', 'trod', 'understood', 'undertook', 'underwent', 'undid',
  'upheld', 'was', 'went', 'wept', 'were', 'withdrew', 'withheld', 'withstood',
  'woke', 'won', 'wore', 'would', 'wove', 'wrote', 'wrung',
]);

const COPULAS = new Set([
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'seems', 'seemed',
  'looks', 'looked', 'feels', 'felt', 'became', 'becomes', 'stays', 'remains',
]);

const INTENSIFIERS = new Set([
  'very', 'quite', 'rather', 'too', 'so', 'extremely', 'fairly', 'really',
  'somewhat', 'utterly', 'incredibly', 'unusually', 'especially',
]);

const PREPOSITIONS = new Set([
  'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'into', 'onto', 'about',
  'over', 'under', 'through', 'between', 'among', 'against', 'during', 'without',
  'within', 'across', 'behind', 'beyond', 'near', 'upon',
]);

/**
 * Endings that look plural but are not: "glass", "campus", "analysis",
 * "gas", "famous", "physics". Treating these as plurals would mean never
 * weaving them, and would send the wrong number to a provider.
 */
const NOT_REALLY_PLURAL = /(?:ss|us|is|as|ous|ics)$/;

/**
 * Words that close a noun phrase.
 *
 * This set is what lets the guesser tell "the **book** yesterday" from "the
 * **quick** brown fox". After a determiner, a word followed by one of these
 * is the head noun; a word followed by another bare word might be either, and
 * the guesser says so rather than picking.
 *
 * Built inside an arrow called at once, the call marked pure, because esbuild
 * cannot drop a spread unread, and with it the three sets it spreads.
 */
const PHRASE_CLOSERS = /* @__PURE__ */ (() =>
  new Set([
    ...PREPOSITIONS,
    ...COPULAS,
    ...MODALS,
    'and', 'or', 'but', 'than', 'that', 'which', 'who', 'while', 'when', 'where',
    'yesterday', 'today', 'tomorrow', 'now', 'then', 'soon', 'again', 'here',
    'there', 'always', 'never', 'often', 'still', 'already', 'too', 'also',
  ]))();

/**
 * Suffixes reliable enough to act on.
 *
 * Deliberately short. An earlier version included -ate, -ary and -ish, and
 * every one of them is a trap: "climate" is not a verb, "library" is not an
 * adjective, and "publish" is not an adjective either. A suffix earns its
 * place here only if the counterexamples are rare enough to enumerate.
 */
const SUFFIX_POS: ReadonlyArray<readonly [RegExp, Pos]> = /* @__PURE__ */ Object.freeze([
  [/(?:tion|sion|ness|ment|ity|ance|ence|ency|ship|hood|dom|ism|ist|ology|acy)$/, 'noun'],
  [/(?:ous|ful|less|able|ible|ical|like)$/, 'adj'],
  [/(?:ise|ize|ify)$/, 'verb'],
]);

/**
 * "-ly" is an adverb often enough to be useful and not often enough to trust:
 * family, reply, supply, holy and early are all counterexamples. Requiring a
 * stem of four letters or more handles most of them; the rest are listed.
 */
const NOT_ADVERBS = new Set([
  'supply', 'comply', 'imply', 'reply', 'apply', 'multiply', 'family',
  'assembly', 'anomaly', 'monopoly', 'panoply', 'homily', 'doily', 'gangly',
]);

function suffixGuess(word: string): Guess | null {
  if (word.endsWith('ly') && !NOT_ADVERBS.has(word)) {
    const stem = word.slice(0, -2);
    if (stem.length >= 4 && !/[aeiou]$/.test(stem)) {
      return { pos: 'adv', confidence: 0.75 };
    }
  }
  for (const [pattern, pos] of SUFFIX_POS) {
    if (pattern.test(word)) {
      return pos === 'noun'
        ? { pos, num: 'sg', confidence: 0.8 }
        : { pos, confidence: 0.78 };
    }
  }
  return null;
}

export interface GuessOptions {
  /** Allow plural nouns, which the pack does handle via tgt2. */
  allowPlural?: boolean;
}

export interface Guess {
  pos: Pos;
  num?: 'sg' | 'pl';
  /** 0..1. Below about 0.55 the caller should decline to use it. */
  confidence: number;
}

/**
 * Guess the part of speech of tokens[index], or return null.
 *
 * Order: decisive morphology first, then context. Morphology is checked
 * first because it is the more reliable signal — "lordship" is a noun
 * whatever precedes it — and because the contextual rules below are, by
 * construction, guesses about English structure made without a parser.
 */
export function guessPos(
  tokens: Token[],
  index: number,
  opts: GuessOptions = {},
): Guess | null {
  const token = tokens[index];
  if (!token || token.kind !== 'word') return null;
  const word = token.text.toLowerCase();
  if (word.length < 3) return null;

  const prev = previousWord(tokens, index);
  const next = nextWord(tokens, index);
  const afterSubject = prev !== null && SUBJECT_PRONOUNS.has(prev);

  // Decline on inflected forms. Only base forms are woven, so an inflected
  // form has nothing grammatical to put in its place.
  if (/(?:ed|ing)$/.test(word)) return null;
  if (/s$/.test(word) && !NOT_REALLY_PLURAL.test(word)) {
    // After a subject pronoun the -s is a verb's, "she walks", or an
    // adverb's, "they always", and never a plural noun's.
    if (!opts.allowPlural || afterSubject) return null;
    return { pos: 'noun', num: 'pl', confidence: 0.55 };
  }

  const morphology = suffixGuess(word);
  if (morphology) return morphology;

  if (prev === 'to' && next !== 'the') return { pos: 'verb', confidence: 0.8 };
  if (prev && MODALS.has(prev)) return { pos: 'verb', confidence: 0.8 };
  if (afterSubject) {
    // A verb here is finite, and only its present base form, "they walk",
    // is one a provider's infinitive can stand in for.
    if (THIRD_PERSON_SINGULAR.has(prev) || IRREGULAR_PASTS.has(word)) return null;
    return { pos: 'verb', confidence: 0.65 };
  }
  if (prev && INTENSIFIERS.has(prev)) return { pos: 'adj', confidence: 0.7 };
  if (prev && COPULAS.has(prev)) return { pos: 'adj', confidence: 0.6 };

  if (prev && DETERMINERS.has(prev)) {
    // Phrase-final after a determiner: confidently the head noun.
    if (!next || PHRASE_CLOSERS.has(next)) {
      return { pos: 'noun', num: 'sg', confidence: 0.78 };
    }
    // Another bare word follows, so this could be an attributive adjective
    // or a noun modifier. Telling those apart needs a tagger, so the
    // confidence stays below the usable threshold and the caller declines.
    return { pos: 'noun', num: 'sg', confidence: 0.5 };
  }

  if (prev && PREPOSITIONS.has(prev)) {
    if (!next || PHRASE_CLOSERS.has(next)) {
      return { pos: 'noun', num: 'sg', confidence: 0.7 };
    }
    return { pos: 'noun', num: 'sg', confidence: 0.5 };
  }

  // Nothing decisive. A bare content word in English is most often a noun,
  // but not confidently enough to act on.
  return { pos: 'noun', num: 'sg', confidence: 0.4 };
}

function previousWord(tokens: Token[], index: number): string | null {
  for (let i = index - 1; i >= 0 && i > index - 4; i--) {
    const t = tokens[i];
    if (!t) return null;
    if (t.kind === 'word') return t.text.toLowerCase();
    if (t.kind === 'punct' && t.text !== '’' && t.text !== "'") return null;
  }
  return null;
}

function nextWord(tokens: Token[], index: number): string | null {
  for (let i = index + 1; i < tokens.length && i < index + 4; i++) {
    const t = tokens[i];
    if (!t) return null;
    if (t.kind === 'word') return t.text.toLowerCase();
    if (t.kind === 'punct') return null;
  }
  return null;
}

/** The sentence a token sits in, for optional provider context. */
export function sentenceOf(tokens: Token[], index: number, maxChars = 220): string {
  const token = tokens[index];
  if (!token) return '';
  const sentence = token.sentence;
  let text = '';
  for (const t of tokens) {
    if (t.sentence !== sentence) continue;
    text += t.text;
    if (text.length > maxChars) break;
  }
  return text.trim();
}
