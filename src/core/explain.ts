import type { LexEntry } from './types.ts';
import { cognateReason } from './similarity.ts';

/**
 * Why this word?
 *
 * The selector already computes a factor breakdown. Showing it raw — a table
 * of eight numbers between zero and one — would be a debugging panel wearing
 * a user interface, and it would answer a question nobody asked. What a
 * reader actually wants to know when a word changes under them is whether
 * the choice was reasoned or random.
 *
 * So this turns the two strongest factors into one sentence. A legible
 * machine is a trustworthy machine, and the cost of legibility here is a
 * single line of text.
 */

export interface Reasons {
  /** One sentence, sentence-cased, no trailing full stop. */
  sentence: string;
  /** The factor names that drove it, strongest first. Used by the debug view. */
  drivers: string[];
}

/**
 * How each factor reads when it is the reason.
 *
 * `cognate` is not here: its phrasing depends on the reader's settings and on
 * the word's language, so `explainChoice` builds it.
 */
const PHRASES: Record<string, (entry: LexEntry) => string | null> = {
  due: () => 'it is due for review',
  frequency: () => 'it is common enough to meet often',
  bandFit: () => 'it sits at your level',
  guessability: () => 'the sentence around it gives you enough to go on',
  pos: (entry) =>
    entry.pos === 'noun'
      ? 'concrete nouns are the easiest to recover from context'
      : entry.pos === 'adj'
        ? 'adjectives are usually guessable from the noun they describe'
        : null,
};

/** Factors that are gates rather than reasons; never the answer to "why". */
const GATES = new Set(['confidence', 'ambiguityGate', 'repeatGate', 'positionGate', 'score']);

export interface ExplainOptions {
  firstMeeting?: boolean;
  /**
   * Whether the explanation may mention etymological descent.
   *
   * Needed because `cognateReason` answers "ancestor of English 'house'" for
   * a word carrying an etymon — which is exactly the fact the user switched
   * off when they turned the etymon badge off. Without this the explanation
   * leaked it straight back, one line lower.
   */
  allowEtymon?: boolean;
  /**
   * Whether English descends from the word's language, `ancestorOfEnglish`
   * in the language table: an etymon is then "ancestor of English", and
   * otherwise "source of English". Required, as it is of the feed, so a
   * caller that forgets it fails the typecheck rather than calling Latin an
   * ancestor.
   */
  ancestorOfEnglish: boolean;
}

/**
 * Build the explanation.
 *
 * Deliberately never says "because of a weighted sum". If the strongest
 * factor is one we have no good phrasing for, the sentence falls back to the
 * honest general case rather than inventing a specific one.
 */
export function explainChoice(
  entry: LexEntry,
  factors: Record<string, number> | undefined,
  opts: ExplainOptions,
): Reasons {
  const allowEtymon = opts.allowEtymon !== false;
  const reason = () => {
    // Withheld by the etymon itself, not by its wording: this once matched
    // "ancestor of English", which the same fact told as "source of" would
    // have walked straight past.
    if (!allowEtymon && entry.etymonOf) return null;
    return cognateReason(entry, opts.ancestorOfEnglish);
  };

  if (opts.firstMeeting) {
    const cognate = reason();
    return {
      sentence: cognate
        ? `New to you, and ${cognate}`
        : 'New to you — this is the first time Weft has shown it',
      drivers: ['due'],
    };
  }

  const ranked = Object.entries(factors ?? {})
    .filter(([name, value]) => !GATES.has(name) && Number.isFinite(value) && value > 0.15)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const parts: string[] = [];
  for (const name of ranked) {
    const phrase = name === 'cognate' ? (reason() ?? 'it resembles the English word') : PHRASES[name]?.(entry);
    if (phrase && !parts.includes(phrase)) parts.push(phrase);
    if (parts.length === 2) break;
  }

  if (!parts.length) {
    const cognate = reason();
    return {
      sentence: cognate ? capitalise(cognate) : 'Chosen as a good fit for your level',
      drivers: ranked.slice(0, 2),
    };
  }

  const sentence =
    parts.length === 1
      ? `Chosen because ${parts[0]}`
      : `Chosen because ${parts[0]}, and ${parts[1]}`;

  return { sentence: capitalise(sentence), drivers: ranked.slice(0, 2) };
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The developer-facing view, for the debug panel only.
 *
 * Kept separate so that the user-facing sentence can never accidentally leak
 * a row of decimals into the tooltip.
 */
export function factorTable(factors: Record<string, number> | undefined): Array<[string, string]> {
  if (!factors) return [];
  return Object.entries(factors)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => [name, value.toFixed(3)]);
}
