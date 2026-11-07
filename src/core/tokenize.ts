import type { Token } from './types.ts';

/**
 * Unicode-aware tokenizer with byte-exact offsets.
 *
 * Offsets matter more than usual here: the renderer edits a DOM text node's
 * nodeValue in place and then asks the CSS Custom Highlight API to style the
 * exact character ranges it wrote. If an offset is off by one, the underline
 * lands on the wrong letter, so the tokenizer is the one place in Weft where
 * "close enough" is not acceptable and every token carries start/end.
 */

/**
 * Abbreviations that essentially never end a sentence. A period after one of
 * these is part of the abbreviation.
 */
const STRONG_ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'rev', 'hon', 'gen', 'col', 'lt', 'sgt',
  'capt', 'cmdr', 'adm', 'sen', 'rep', 'gov', 'pres', 'jr', 'sr', 'st',
  'vs', 'etc', 'inc', 'ltd', 'corp', 'dept', 'fig', 'vol', 'eds', 'trans',
  'cf', 'ibid', 'al', 'approx', 'apt', 'ave', 'blvd', 'mt', 'phd', 'bsc', 'msc',
  'eg', 'ie', 'est', 'ph',
]);

/**
 * Abbreviations that are also perfectly ordinary English words.
 *
 * This set is the reason the tokenizer needs lookahead. "The cat sat." ends a
 * sentence; "Sat. 9am" does not, and both contain "sat" followed by a period.
 * A weak abbreviation only suppresses the sentence break when the next word is
 * lowercase, i.e. when the text visibly continues.
 */
const WEAK_ABBREVIATIONS = new Set([
  'no', 'min', 'max', 'sec', 'co', 'ca', 'am', 'pm', 'ed', 'ft', 'in', 'ma', 'ba',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
]);

/**
 * A word: letters, optionally joined by an internal apostrophe or hyphen.
 * Hyphenated compounds stay one token on purpose — swapping half of
 * "well-known" reads as a typo rather than as a lesson.
 *
 * esbuild writes a pattern like this one, with a `\p{…}` outside a class, as
 * `new RegExp(…)`, a call it cannot drop unread; so each is returned from an
 * arrow called at once, and that call is marked pure.
 */
const WORD_RE = /* @__PURE__ */ (() => /^\p{L}[\p{L}\p{M}]*(?:[’'’\-][\p{L}\p{M}]+)*/u)();
const DIGIT_RE = /^[\p{Nd}]+(?:[.,:\/][\p{Nd}]+)*/u;
const SPACE_RE = /^\s+/u;
const UPPER_RE = /* @__PURE__ */ (() => /^\p{Lu}/u)();
const HAS_LOWER_RE = /* @__PURE__ */ (() => /\p{Ll}/u)();
const LOWER_START_RE = /* @__PURE__ */ (() => /^\p{Ll}/u)();
const PARAGRAPH_RE = /\n[^\S\n]*\n/;
const SENTENCE_END = new Set(['.', '!', '?', '…', '。', '！', '？']);
/** Punctuation that closes a sentence but belongs to it. */
const TRAILING = new Set(['"', '”', "'", '’', ')', ']', '}', '»', '›', '*', '_']);

export interface TokenizeOptions {
  /** Stop after this many tokens. Guards against pathological inputs. */
  maxTokens?: number;
}

/**
 * Tokenize in two passes.
 *
 * Pass one cuts the string; pass two assigns sentence numbers with full
 * lookahead. Splitting them is what makes ambiguous abbreviations tractable:
 * the decision about a period needs to see the word that follows it, which a
 * single forward pass does not have.
 */
export function tokenize(input: string, opts: TokenizeOptions = {}): Token[] {
  const tokens = cut(input, opts.maxTokens ?? 20_000);
  assignSentences(tokens);
  return tokens;
}

function cut(input: string, maxTokens: number): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length && tokens.length < maxTokens) {
    const rest = input.slice(i);

    const space = SPACE_RE.exec(rest);
    if (space) {
      tokens.push(mk(space[0], i, 'space'));
      i += space[0].length;
      continue;
    }

    const word = WORD_RE.exec(rest);
    if (word) {
      tokens.push(mk(word[0], i, 'word'));
      i += word[0].length;
      continue;
    }

    const digits = DIGIT_RE.exec(rest);
    if (digits) {
      tokens.push(mk(digits[0], i, 'digit'));
      i += digits[0].length;
      continue;
    }

    const ch = rest[0] as string;
    tokens.push(mk(ch, i, /[\p{P}\p{S}]/u.test(ch) ? 'punct' : 'other'));
    i += ch.length;
  }

  return tokens;
}

function assignSentences(tokens: Token[]): void {
  let sentence = 0;
  for (let i = 0; i < tokens.length; i++) {
    (tokens[i] as Token).sentence = sentence;
    if (breaksAfter(tokens, i)) sentence++;
  }
}

/**
 * True when a sentence boundary falls immediately after tokens[i].
 *
 * A boundary is detected at the *last* token of a terminal run, not at the
 * period itself. `He said "stop." Then…` ends after the closing quote; firing
 * on the period would put the quote in the wrong sentence, and refusing to
 * fire at all (the first version of this function) merged the two sentences.
 */
function breaksAfter(tokens: Token[], i: number): boolean {
  const token = tokens[i] as Token;

  // A blank line is a paragraph break, and therefore a sentence break.
  if (token.kind === 'space' && PARAGRAPH_RE.test(token.text)) return true;
  if (token.kind !== 'punct') return false;

  const isTerminal = SENTENCE_END.has(token.text);
  const isTrailing = TRAILING.has(token.text);
  if (!isTerminal && !isTrailing) return false;

  const next = tokens[i + 1];

  // Must be the last token of the run: "stop.\"" fires on the quote.
  if (next && next.kind === 'punct' && (SENTENCE_END.has(next.text) || TRAILING.has(next.text))) {
    return false;
  }

  // The run must actually contain a sentence-ending mark, so a stray closing
  // bracket in "(see below) and more" does not split anything.
  let sawEnd = isTerminal;
  let runStart = i;
  for (let k = i - 1; k >= 0; k--) {
    const t = tokens[k] as Token;
    if (t.kind === 'punct' && (SENTENCE_END.has(t.text) || TRAILING.has(t.text))) {
      if (SENTENCE_END.has(t.text)) sawEnd = true;
      runStart = k;
      continue;
    }
    break;
  }
  if (!sawEnd) return false;

  if (!next) return true; // end of input
  if (next.kind !== 'space') return false; // "cat.Dog": not prose

  const after = tokens[i + 2];

  // Nearest word before the terminal run.
  let prevWord: Token | undefined;
  for (let k = runStart - 1; k >= 0; k--) {
    const t = tokens[k] as Token;
    if (t.kind === 'space') break;
    if (t.kind === 'word') {
      prevWord = t;
      break;
    }
  }

  // Abbreviation logic only applies to a plain period; "!" and "?" are never
  // abbreviation marks.
  const runHasOnlyPeriod = sawEnd && !runContains(tokens, runStart, i, ['!', '?', '…']);
  if (prevWord && runHasOnlyPeriod) {
    const lower = prevWord.text.toLowerCase();
    // "J. R. R. Tolkien": a lone capital is an initial.
    if (prevWord.text.length === 1 && prevWord.capitalized) return false;
    if (STRONG_ABBREVIATIONS.has(lower)) return false;
    const nextIsLower = Boolean(after && after.kind === 'word' && LOWER_START_RE.test(after.text));
    if (WEAK_ABBREVIATIONS.has(lower) && nextIsLower) return false;
    // A period followed by a lowercase word is usually not a boundary.
    if (nextIsLower) return false;
  }

  return true;
}

function runContains(tokens: Token[], from: number, to: number, chars: string[]): boolean {
  for (let k = from; k <= to; k++) {
    if (chars.includes((tokens[k] as Token).text)) return true;
  }
  return false;
}

function mk(text: string, start: number, kind: Token['kind']): Token {
  return {
    text,
    start,
    end: start + text.length,
    kind,
    sentence: 0,
    capitalized: UPPER_RE.test(text),
    allCaps: text.length > 1 && !HAS_LOWER_RE.test(text) && /\p{Lu}/u.test(text),
  };
}

/** Word tokens only, with their index in the full token list. */
export function wordTokens(tokens: Token[]): Array<{ token: Token; index: number }> {
  const out: Array<{ token: Token; index: number }> = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i] as Token;
    if (t.kind === 'word') out.push({ token: t, index: i });
  }
  return out;
}

/** Number of word tokens in each sentence, indexed by sentence number. */
export function sentenceWordCounts(tokens: Token[]): number[] {
  const counts: number[] = [];
  for (const t of tokens) {
    if (t.kind !== 'word') continue;
    counts[t.sentence] = (counts[t.sentence] ?? 0) + 1;
  }
  for (let i = 0; i < counts.length; i++) if (counts[i] === undefined) counts[i] = 0;
  return counts;
}

/* ----------------------------------------------------------- case matching */

export type CasePattern = 'lower' | 'upper' | 'title' | 'mixed';

export function casePatternOf(s: string): CasePattern {
  const letters = s.replace(/[^\p{L}]/gu, '');
  if (!letters) return 'lower';

  const hasUpper = /\p{Lu}/u.test(letters);
  const hasLower = HAS_LOWER_RE.test(letters);

  if (hasUpper && !hasLower) return letters.length > 1 ? 'upper' : 'title';
  if (!hasUpper) return 'lower';

  // Mixed-case: 'title' only when the very first letter is the only capital.
  const firstIsUpper = UPPER_RE.test(letters);
  const restHasUpper = /\p{Lu}/u.test(letters.slice(1));
  return firstIsUpper && !restHasUpper ? 'title' : 'mixed';
}

/**
 * Apply the source word's casing to the replacement.
 *
 * Getting this wrong is the tell that gives away a cheap implementation:
 * a sentence-initial "The" replaced by lowercase "le" looks like a bug, not
 * like immersion.
 */
export function matchCase(replacement: string, original: string): string {
  switch (casePatternOf(original)) {
    case 'upper':
      return replacement.toLocaleUpperCase();
    case 'title': {
      // Codepoint-aware so an astral first character is not split in half.
      const chars = [...replacement];
      const first = (chars[0] ?? '').toLocaleUpperCase();
      return first + chars.slice(1).join('');
    }
    case 'mixed':
    case 'lower':
    default:
      return replacement;
  }
}

/* ------------------------------------------------------- junk recognisers */

const URLISH = /(?:https?:\/\/|www\.|\.(?:com|org|net|io|gov|edu|co|dev)\b)/i;
const CAMEL = /* @__PURE__ */ (() => /^\p{Ll}[\p{Ll}\p{Nd}]*\p{Lu}/u)();

/**
 * Punctuation that, when directly adjacent to a word with no whitespace
 * between, marks the word as part of a machine token rather than prose:
 * a handle, a hashtag, a domain, a path, or an identifier.
 */
const GLUE = new Set(['.', '/', '@', '#', '_', '\\', '$', '~', '=', '&', '?', '+']);

/**
 * Text that should never be woven: URLs, handles, hashtags, identifiers.
 *
 * The adjacency checks matter more than the regexes. "@" and "." are separate
 * punctuation tokens, so `alice` in "@alice" and `com` in "example.com" look
 * like perfectly ordinary words until you inspect their neighbours. Weaving
 * either one produces text that is not merely wrong but unusable — nobody can
 * click through to "example.dotcom".
 */
export function looksLikeJunk(token: Token, tokens: Token[], index: number): boolean {
  const t = token.text;
  if (t.length < 2) return true;
  if (token.allCaps) return true;
  if (CAMEL.test(t)) return true;
  if (URLISH.test(t)) return true;

  const prev = tokens[index - 1];
  // Glued on the left: "@alice", "example.com" (the "com" part), "a/b".
  if (prev && prev.kind === 'punct' && GLUE.has(prev.text)) return true;

  // Glued on the right, but only when something is glued after the punctuation
  // too. Otherwise every sentence-final word would be rejected by its period.
  const next = tokens[index + 1];
  const afterNext = tokens[index + 2];
  if (
    next &&
    next.kind === 'punct' &&
    GLUE.has(next.text) &&
    afterNext &&
    (afterNext.kind === 'word' || afterNext.kind === 'digit')
  ) {
    return true;
  }

  return false;
}
