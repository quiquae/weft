import type { MemoryCard, Settings, SiteAttention } from './types.ts';
import { cardRetrievability, daysUntilDue, isRetirable } from './fsrs.ts';
import { dayKey, shiftDay } from './escalation.ts';
import { orderKey } from './similarity.ts';

/**
 * Aggregations for the dashboard.
 *
 * Kept in core and pure so the numbers shown to the user are the same numbers
 * the tests assert on. A progress dashboard that quietly computes things
 * differently from the engine is worse than no dashboard: it teaches the user
 * to distrust the product.
 */

export type VocabStage = 'new' | 'learning' | 'familiar' | 'retired';

export function stageOf(card: MemoryCard, settings: Settings, now: number): VocabStage {
  if (card.retiredAt || isRetirable(card, settings.learning.retireStabilityDays, now)) {
    return 'retired';
  }
  if (card.reps === 0) return 'new';
  if (card.stability >= 7) return 'familiar';
  return 'learning';
}

export interface VocabStats {
  total: number;
  new: number;
  learning: number;
  familiar: number;
  retired: number;
  /** Cards whose retrievability has fallen below 0.9. */
  dueNow: number;
  totalExposures: number;
  totalReveals: number;
  /** Cards per difficulty band, index 0 unused. */
  byBand: number[];
  /** Median stability in days across non-new cards. */
  medianStability: number;
  /** Proportion of exposures that did not need a reveal. */
  comprehensionRate: number;
}

export function vocabStats(cards: MemoryCard[], settings: Settings, now: number): VocabStats {
  const out: VocabStats = {
    total: cards.length,
    new: 0,
    learning: 0,
    familiar: 0,
    retired: 0,
    dueNow: 0,
    totalExposures: 0,
    totalReveals: 0,
    byBand: [0, 0, 0, 0, 0, 0, 0],
    medianStability: 0,
    comprehensionRate: 0,
  };

  const stabilities: number[] = [];
  for (const card of cards) {
    out[stageOf(card, settings, now)]++;
    out.totalExposures += card.exposures;
    out.totalReveals += card.lapses;
    if (card.reps > 0) {
      stabilities.push(card.stability);
      if (cardRetrievability(card, now) < 0.9) out.dueNow++;
    }
  }

  stabilities.sort((a, b) => a - b);
  if (stabilities.length) {
    const mid = Math.floor(stabilities.length / 2);
    out.medianStability =
      stabilities.length % 2
        ? (stabilities[mid] as number)
        : ((stabilities[mid - 1] as number) + (stabilities[mid] as number)) / 2;
  }

  out.comprehensionRate =
    out.totalExposures > 0
      ? Math.max(0, Math.min(1, 1 - out.totalReveals / out.totalExposures))
      : 0;

  return out;
}

/** Cards ordered by how much they need to be seen next. */
export function studyQueue(cards: MemoryCard[], now: number, limit = 50): MemoryCard[] {
  return [...cards]
    .filter((c) => !c.retiredAt)
    .map((c) => ({ c, r: cardRetrievability(c, now) }))
    .sort((a, b) => a.r - b.r)
    .slice(0, limit)
    .map((x) => x.c);
}

export interface AttentionSummary {
  todaySeconds: number;
  yesterdaySeconds: number;
  weekSeconds: number;
  /** Per-host today, descending. */
  today: Array<{ host: string; seconds: number }>;
  /** Daily totals for the last `days`, oldest first, gaps filled with 0. */
  series: Array<{ day: string; seconds: number }>;
  /** Consecutive days with any recorded attention, ending today or yesterday. */
  streakDays: number;
}

export function attentionSummary(
  sites: SiteAttention[],
  now: number,
  rolloverHour: number,
  days = 30,
): AttentionSummary {
  const today = dayKey(now, rolloverHour);
  const yesterday = shiftDay(today, -1);

  const byDay = new Map<string, number>();
  const todayByHost: Array<{ host: string; seconds: number }> = [];

  for (const site of sites) {
    if (site.day === today) {
      byDay.set(today, (byDay.get(today) ?? 0) + site.seconds);
      todayByHost.push({ host: site.host, seconds: Math.round(site.seconds) });
    }
    for (const h of site.history) {
      byDay.set(h.day, (byDay.get(h.day) ?? 0) + h.seconds);
    }
  }

  const series: Array<{ day: string; seconds: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = shiftDay(today, -i);
    series.push({ day: key, seconds: Math.round(byDay.get(key) ?? 0) });
  }

  let streakDays = 0;
  for (let i = 0; i < days; i++) {
    const key = shiftDay(today, -i);
    if ((byDay.get(key) ?? 0) > 0) streakDays++;
    else if (i > 0) break;
  }

  const weekSeconds = series.slice(-7).reduce((a, b) => a + b.seconds, 0);

  todayByHost.sort((a, b) => b.seconds - a.seconds);

  return {
    todaySeconds: Math.round(byDay.get(today) ?? 0),
    yesterdaySeconds: Math.round(byDay.get(yesterday) ?? 0),
    weekSeconds,
    today: todayByHost,
    series,
    streakDays,
  };
}

export interface UpcomingReview {
  /** The card's `lemma`, which is an identity: print `spelling(lemma)`. */
  lemma: string;
  days: number;
  stability: number;
}

export function upcoming(cards: MemoryCard[], now: number, limit = 20): UpcomingReview[] {
  return cards
    .filter((c) => c.reps > 0 && !c.retiredAt)
    .map((c) => ({ lemma: c.lemma, days: daysUntilDue(c, now), stability: c.stability }))
    .sort((a, b) => a.days - b.days)
    .slice(0, limit);
}

/**
 * Words retired per week, oldest first. The honest measure of whether Weft is
 * working: not exposures, not time on site, but words that graduated.
 */
export function retirementSeries(
  cards: MemoryCard[],
  now: number,
  weeks = 12,
): Array<{ weekStart: string; retired: number }> {
  const WEEK = 7 * 86_400_000;
  const buckets = new Array(weeks).fill(0) as number[];
  const start = now - weeks * WEEK;

  for (const card of cards) {
    if (!card.retiredAt || card.retiredAt < start) continue;
    const idx = Math.min(weeks - 1, Math.floor((card.retiredAt - start) / WEEK));
    buckets[idx] = (buckets[idx] as number) + 1;
  }

  return buckets.map((retired, i) => ({
    weekStart: new Date(start + i * WEEK).toISOString().slice(0, 10),
    retired,
  }));
}

/**
 * Rough estimate of how much target-language text the learner has read,
 * in words. Used for the one headline number on the dashboard, because
 * "you have read 14,300 words of French without meaning to" is the sentence
 * that makes people keep the extension.
 */
export function wordsRead(cards: MemoryCard[]): number {
  let total = 0;
  for (const card of cards) total += card.exposures;
  return total;
}

/** Which column the vocabulary list is ordered by. */
export type VocabSort = 'seen' | 'alpha' | 'stable' | 'urgent';

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Order the vocabulary list, totally.
 *
 * Three of the four columns tie constantly in real data: everything unseen
 * has `exposures` equal, everything unreviewed has `stability` 0, and every
 * brand-new card has the same retrievability. A comparator that returns 0 for
 * two distinct cards has not defined an order — it has delegated one to
 * whatever order the storage round-trip happened to return, which is why two
 * runs of the screenshot generator a minute apart produced
 * `docs/screens/dashboard-vocabulary.png` with the rows shuffled. A real
 * learner sees the same thing between two visits to the page.
 *
 * So every column falls through to the same total tiebreak, the one
 * `buildDiscoveries` already uses: the folded lemma, so accents file where a
 * reader expects them, then the raw lemma and the id for the rare pair that
 * folds alike. `alpha` never reaches it, and that is fine — a tiebreak that
 * cannot fire costs nothing and means nobody has to remember which columns
 * were the unsafe ones.
 */
export function sortVocabulary(
  cards: MemoryCard[],
  by: VocabSort,
  now: number,
): MemoryCard[] {
  const primary = (a: MemoryCard, b: MemoryCard): number => {
    switch (by) {
      case 'seen':
        return b.exposures - a.exposures;
      case 'alpha':
        return cmp(orderKey(a.lemma), orderKey(b.lemma));
      case 'stable':
        return b.stability - a.stability;
      case 'urgent':
      default:
        return cardRetrievability(a, now) - cardRetrievability(b, now);
    }
  };
  return [...cards].sort(
    (a, b) =>
      primary(a, b) ||
      cmp(orderKey(a.lemma), orderKey(b.lemma)) ||
      cmp(a.lemma, b.lemma) ||
      cmp(a.id, b.id),
  );
}
