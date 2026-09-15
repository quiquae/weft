import type { MemoryCard, Settings } from './types.ts';
import { vocabStats, wordsRead } from './stats.ts';

/**
 * Milestones.
 *
 * The temptation with a learning product is to invent a points economy:
 * streaks that punish a missed day, badges for opening the app, levels that
 * mean nothing. That works on some people and it is also why a lot of
 * language software feels like a slot machine.
 *
 * These are different in three specific ways:
 *
 * **Every one is a real fact about reading.** Words read, words graduated,
 * pages understood without help. Nothing is awarded for showing up.
 *
 * **Nothing is ever lost.** There is no streak to break and no decay. A
 * milestone earned is permanent, because the reading that earned it happened.
 *
 * **They stop.** The list is finite and ends at a genuinely hard achievement.
 * A product that keeps inventing new tiers forever is not measuring anything.
 */

export interface Milestone {
  id: string;
  /** Shown when earned. */
  label: string;
  /** Why it is worth something, in the user's terms. */
  detail: string;
  /** Progress towards it, 0..1. */
  progress: number;
  earned: boolean;
  /** "312 / 500" for the progress line. */
  measure: string;
}

interface Definition {
  id: string;
  label: string;
  detail: string;
  /** Current value and the target. */
  value(input: Input): { at: number; target: number };
}

export interface Input {
  cards: MemoryCard[];
  settings: Settings;
  now: number;
  /** Consecutive days with recorded attention. */
  streakDays: number;
}

const DEFINITIONS: Definition[] = [
  {
    id: 'first-hundred',
    label: 'A hundred words read',
    detail: 'A hundred sightings of another language, on pages you were reading anyway.',
    value: (i) => ({ at: wordsRead(i.cards), target: 100 }),
  },
  {
    id: 'first-graduate',
    label: 'Your first word',
    detail:
      'One word held well enough that Weft stopped asking about it and simply leaves it in the other language.',
    value: (i) => ({ at: vocabStats(i.cards, i.settings, i.now).retired, target: 1 }),
  },
  {
    id: 'thousand-words',
    label: 'A thousand words read',
    detail: 'Roughly four newspaper articles worth of another language, absorbed sideways.',
    value: (i) => ({ at: wordsRead(i.cards), target: 1000 }),
  },
  {
    id: 'fifty-known',
    label: 'Fifty words known',
    detail:
      'Fifty words you now simply read. At this point a page in the target language starts to have footholds.',
    value: (i) => ({ at: vocabStats(i.cards, i.settings, i.now).retired, target: 50 }),
  },
  {
    id: 'week',
    label: 'A week of reading',
    detail: 'Seven consecutive days with some woven reading in them.',
    value: (i) => ({ at: i.streakDays, target: 7 }),
  },
  {
    id: 'comprehension',
    label: 'Nine in ten without help',
    detail:
      'Nine of every ten woven words met without needing the English back — measured across everything you have read, not a good afternoon.',
    value: (i) => {
      const v = vocabStats(i.cards, i.settings, i.now);
      // Needs a real sample before the ratio means anything.
      if (v.totalExposures < 200) return { at: 0, target: 100 };
      return { at: Math.round(v.comprehensionRate * 100), target: 90 };
    },
  },
  {
    id: 'ten-thousand',
    label: 'Ten thousand words read',
    detail: 'A short novel, in words you did not sit down to study.',
    value: (i) => ({ at: wordsRead(i.cards), target: 10_000 }),
  },
  {
    id: 'five-hundred-known',
    label: 'Five hundred words known',
    detail:
      'The point at which the most common words of a language are simply yours. This is the last one; there is no tier above it.',
    value: (i) => ({ at: vocabStats(i.cards, i.settings, i.now).retired, target: 500 }),
  },
];

export function milestones(input: Input): Milestone[] {
  return DEFINITIONS.map((def) => {
    const { at, target } = def.value(input);
    const progress = target > 0 ? Math.min(1, at / target) : 0;
    return {
      id: def.id,
      label: def.label,
      detail: def.detail,
      progress,
      earned: at >= target,
      measure: `${at.toLocaleString()} / ${target.toLocaleString()}`,
    };
  });
}

/**
 * The one to show next.
 *
 * Exactly one, and only when it is genuinely close. A dashboard listing eight
 * things you have not done is a list of failures.
 */
export function nextMilestone(input: Input): Milestone | null {
  const pending = milestones(input)
    .filter((m) => !m.earned && m.progress > 0.08)
    .sort((a, b) => b.progress - a.progress);
  return pending[0] ?? null;
}

export function earnedMilestones(input: Input): Milestone[] {
  return milestones(input).filter((m) => m.earned);
}
