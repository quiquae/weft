import type { LangCode, LexEntry, MemoryCard } from './types.ts';
import { mulberry32, hashString } from './rand.ts';
import { fold } from './similarity.ts';
import { spelling } from './lexicon.ts';

/**
 * The unlock quiz.
 *
 * When a learner asks to make Weft easier, the cooldown makes them wait and the
 * quiz makes the wait productive. Questions are drawn only from words the
 * learner has actually been shown, so it is never a test of material they have
 * not met — it is a check that the exposure did something. Failing it costs
 * nothing except another attempt; the point is the five minutes of retrieval
 * practice, which is worth more than the setting they were trying to change.
 */

export type QuestionKind = 'target-to-source' | 'source-to-target' | 'type-it';

export interface QuizQuestion {
  id: string;
  kind: QuestionKind;
  /** The word or phrase shown to the learner. */
  prompt: string;
  promptLang: LangCode;
  /** The expected answer text. */
  answer: string;
  answerLang: LangCode;
  /** Present for multiple-choice questions; already shuffled, includes answer. */
  options?: string[];
  /** Target-language headword, used to attribute the result to a card. */
  lemma: string;
  pos: string;
  gender?: string;
  hint?: string;
}

export interface BuildQuizOptions {
  cards: MemoryCard[];
  /** Entry lookup by target lemma, for prompts and distractors. */
  entriesByLemma: Map<string, LexEntry>;
  /** All entries available, used to draw plausible distractors. */
  pool: LexEntry[];
  target: LangCode;
  source: LangCode;
  count: number;
  seed?: number;
  /** Include free-text questions. Harder, and much better retrieval practice. */
  includeTyping?: boolean;
}

/**
 * Pick the words to test.
 *
 * Preference order: words seen at least twice but not yet stable (the ones on
 * the edge of being learned), then anything seen at all. Retired words are
 * skipped — testing what someone already knows is theatre.
 */
export function pickQuizCards(cards: MemoryCard[], count: number, rng: () => number): MemoryCard[] {
  const eligible = cards.filter((c) => c.exposures >= 1 && !c.retiredAt);
  if (!eligible.length) return [];

  const scored = eligible.map((c) => {
    const edge = c.reps >= 1 && c.stability < 21 ? 1.5 : 1;
    const seen = Math.min(1, c.exposures / 5);
    return { card: c, weight: edge * (0.4 + 0.6 * seen) + rng() * 0.3 };
  });
  scored.sort((a, b) => b.weight - a.weight);
  return scored.slice(0, count).map((s) => s.card);
}

/** Plausible wrong answers: same part of speech, similar difficulty band. */
export function distractorsFor(
  entry: LexEntry,
  pool: LexEntry[],
  n: number,
  rng: () => number,
  side: 'target' | 'source',
): string[] {
  const correct = side === 'target' ? entry.tgt : entry.lemma;
  // Not the word itself, and not another word spelled the same: hund² and
  // hund are a hundred and a dog, and a learner shown "hund" who answers
  // "dog" has answered correctly. So rows are compared by spelling, which
  // covers the word's own rows too.
  const written = spelling(entry.tgtLemma);
  const other = (e: LexEntry): boolean => spelling(e.tgtLemma) !== written;
  const candidates = pool.filter(
    (e) =>
      e.pos === entry.pos &&
      // A word with no band, a translation service's, is near any band.
      (e.band === undefined || entry.band === undefined || Math.abs(e.band - entry.band) <= 1) &&
      other(e) &&
      (side === 'target' ? e.tgt !== correct : e.lemma !== correct),
  );

  // Fall back to a looser filter rather than returning too few options: a
  // two-option "multiple choice" gives away the answer.
  const source = candidates.length >= n ? candidates : pool.filter(other);

  const picked = new Set<string>();
  let guard = 0;
  while (picked.size < n && guard < source.length * 4 && source.length) {
    guard++;
    const e = source[Math.floor(rng() * source.length)] as LexEntry;
    const text = side === 'target' ? e.tgt : e.lemma;
    if (text && text !== correct) picked.add(text);
  }
  return [...picked].slice(0, n);
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}

export function buildQuiz(opts: BuildQuizOptions): QuizQuestion[] {
  const rng = mulberry32(opts.seed ?? hashString(opts.cards.map((c) => c.id).join('|')));
  const cards = pickQuizCards(opts.cards, opts.count, rng);
  const questions: QuizQuestion[] = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i] as MemoryCard;
    const entry = opts.entriesByLemma.get(card.lemma);
    if (!entry) continue;

    // Mix of directions. Recognition (target->source) is easier and comes
    // first; production (source->target) and typing carry more of the load as
    // the quiz goes on.
    const roll = rng();
    let kind: QuestionKind;
    if (opts.includeTyping && roll > 0.72) kind = 'type-it';
    else if (roll > 0.42) kind = 'source-to-target';
    else kind = 'target-to-source';

    const base = {
      id: `q${i}-${card.lemma}`,
      lemma: card.lemma,
      pos: entry.pos,
      ...(entry.gender ? { gender: entry.gender } : {}),
    };

    if (kind === 'target-to-source') {
      const options = shuffle(
        [entry.lemma, ...distractorsFor(entry, opts.pool, 3, rng, 'source')],
        rng,
      );
      questions.push({
        ...base,
        kind,
        prompt: entry.tgt,
        promptLang: opts.target,
        answer: entry.lemma,
        answerLang: opts.source,
        options,
      });
    } else if (kind === 'source-to-target') {
      const options = shuffle(
        [entry.tgt, ...distractorsFor(entry, opts.pool, 3, rng, 'target')],
        rng,
      );
      questions.push({
        ...base,
        kind,
        prompt: entry.lemma,
        promptLang: opts.source,
        answer: entry.tgt,
        answerLang: opts.target,
        options,
      });
    } else {
      questions.push({
        ...base,
        kind,
        prompt: entry.lemma,
        promptLang: opts.source,
        answer: entry.tgt,
        answerLang: opts.target,
        hint: `${entry.tgt.length} letters, starts with “${entry.tgt.slice(0, 1)}”`,
      });
    }
  }

  return questions;
}

/** Leading articles a learner should not be penalised for including or omitting. */
const ARTICLES =
  /^(?:le|la|les|l'|un|une|des|du|de la|el|los|las|un|una|unos|unas|der|die|das|den|dem|ein|eine|il|lo|gli|i|un|uno|una|o|a|os|as|um|uma|se|sē|sēo|þæt|þā|hit)\s+/i;

/**
 * Normalise a free-text answer.
 *
 * Generous on purpose. The quiz is a retrieval check, not a spelling bee, so
 * accents, articles and Old English letterform choices are all forgiven. Being
 * strict here would turn a productive gate into a wall, and a wall gets
 * uninstalled.
 */
export function normalizeAnswer(s: string): string {
  const trimmed = s.trim().toLowerCase().replace(/[.,!?;:"“”]/g, '');
  const noArticle = trimmed.replace(ARTICLES, '');
  return fold(noArticle || trimmed);
}

export function gradeAnswer(question: QuizQuestion, given: string): boolean {
  if (!given) return false;
  if (question.options) {
    return normalizeAnswer(given) === normalizeAnswer(question.answer);
  }
  const a = normalizeAnswer(given);
  const b = normalizeAnswer(question.answer);
  if (a === b) return true;
  // Accept a single-character slip on words of five letters or more.
  if (b.length >= 5 && a.length >= 4 && Math.abs(a.length - b.length) <= 1) {
    let diff = 0;
    const max = Math.max(a.length, b.length);
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length && diff <= 1) {
      if (a[i] === b[j]) {
        i++;
        j++;
      } else {
        diff++;
        if (a.length > b.length) i++;
        else if (b.length > a.length) j++;
        else {
          i++;
          j++;
        }
      }
    }
    diff += Math.abs(a.length - i) + Math.abs(b.length - j);
    return diff <= 1 && max >= 5;
  }
  return false;
}

export interface QuizResult {
  questionId: string;
  lemma: string;
  correct: boolean;
  given: string;
}

export function quizScore(results: QuizResult[]): number {
  if (!results.length) return 0;
  return results.filter((r) => r.correct).length / results.length;
}

export function quizPassed(results: QuizResult[], threshold: number): boolean {
  if (!results.length) return false;
  return quizScore(results) >= threshold;
}
