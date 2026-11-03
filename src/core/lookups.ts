/**
 * The daily lookup limit, as arithmetic.
 *
 * `providers.dailyLookupCap` is a number of words a day, and the day is
 * Weft's reading day, `dayKey(now, attention.rolloverHour)`, the day every
 * other "today" in the product means. A word counts when it is sent, whether
 * or not the request succeeds, because the limit exists to bound what leaves
 * the machine and what a key is billed for, and a failed request has done
 * both. A word answered from the cache is never sent and never counted.
 *
 * Until 2026-11-03 nothing counted a day: each call was sliced to the cap on
 * its own, so at the default 2 000 the cap never bit. See
 * `tests/core/lookup-limit.test.ts`.
 */

/** Words sent to a translation service on one reading day. */
export interface LookupDay {
  /** The reading day, a `dayKey()`. */
  day: string;
  /** Words sent that day, failed requests included. */
  words: number;
}

/**
 * How many of `wanted` words may be sent now, and the day's count once they
 * have been. A count kept under another day is yesterday's and starts again
 * at nothing; a limit lowered below what the day has already sent grants
 * nothing and leaves the count where it was.
 */
export function takeLookups(
  spent: LookupDay | undefined,
  today: string,
  cap: number,
  wanted: number,
): { granted: number; spent: LookupDay } {
  const used = spent?.day === today ? spent.words : 0;
  const granted = Math.max(0, Math.min(wanted, cap - used));
  return { granted, spent: { day: today, words: used + granted } };
}
