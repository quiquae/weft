import type { SiteAttention } from './types.ts';

/**
 * Bounding the two stores that grow forever.
 *
 * Everything else Weft persists is bounded by something real: settings are a
 * fixed shape, cards are bounded by the size of the lexicon, the lock log is
 * sliced. Two are not:
 *
 *   - `attention` gains a record for every host the reader ever visits, and
 *     each record carries sixty days of history (~1.8 KB). Five thousand
 *     hosts is about 9 MB, which is a realistic few years of browsing and
 *     over the storage quota.
 *   - the provider cache gains an entry for every word a paid translation
 *     provider was ever asked for.
 *
 * The original manifest answered this with `unlimitedStorage`, which is a
 * permission standing in for a fix: it silences the quota without bounding
 * anything, it is one more scary line in the install prompt, and Safari does
 * not honour it the way Chrome does. Pruning is the honest version.
 *
 * Both functions are pure and take `now`, so the tests can age data without
 * touching the clock.
 */

/**
 * Hosts kept at most. Generous on purpose: the cap is a backstop against
 * unbounded growth, not a feature anyone should notice.
 */
export const MAX_HOSTS = 500;

/** A host with no attention for this long is not a site the reader uses. */
export const HOST_TTL_DAYS = 90;

/** Provider cache entries kept at most. */
export const MAX_PROVIDER_ENTRIES = 5000;

const DAY_MS = 86_400_000;

export interface PruneResult<T> {
  kept: T;
  /** How many records were dropped. Surfaced in the storage panel. */
  dropped: number;
}

/**
 * Drop stale hosts, then the least recently attended, until under the cap.
 *
 * Deliberately keyed on `lastTick` rather than total seconds: a site read
 * heavily last year matters less than one read yesterday, and keeping the
 * heaviest would pin exactly the sites a reader has moved on from.
 */
export function pruneAttention(
  attention: Record<string, SiteAttention>,
  now: number,
): PruneResult<Record<string, SiteAttention>> {
  const cutoff = now - HOST_TTL_DAYS * DAY_MS;
  const entries = Object.entries(attention);
  const fresh = entries.filter(([, a]) => {
    // A record with no tick yet is brand new, not stale.
    if (!a.lastTick) return true;
    return a.lastTick >= cutoff;
  });

  fresh.sort((a, b) => (b[1].lastTick ?? 0) - (a[1].lastTick ?? 0));
  const kept = fresh.slice(0, MAX_HOSTS);

  return {
    kept: Object.fromEntries(kept),
    dropped: entries.length - kept.length,
  };
}

export interface Aged {
  at: number;
}

/**
 * Same shape for the provider cache: expire, then cap by recency.
 *
 * How long is required, and is the reader's own “Keep answers for”: until
 * 2026-11-05 it defaulted to a `PROVIDER_TTL_DAYS` of 180, so every save
 * pruned at six months while the slider offered a year, and a word the
 * reader had asked to keep was sent again. One store has one length.
 *
 * Generic over the value so that this does not have to import the background
 * layer's `ProviderCacheEntry` — core stays free of anything above it.
 */
export function pruneByAge<T extends Aged>(
  cache: Record<string, T>,
  now: number,
  opts: { ttlDays: number; max?: number },
): PruneResult<Record<string, T>> {
  const ttl = opts.ttlDays;
  const max = opts.max ?? MAX_PROVIDER_ENTRIES;
  const cutoff = now - ttl * DAY_MS;

  const entries = Object.entries(cache);
  const fresh = entries.filter(([, v]) => (v.at ?? 0) >= cutoff);
  fresh.sort((a, b) => (b[1].at ?? 0) - (a[1].at ?? 0));
  const kept = fresh.slice(0, max);

  return {
    kept: Object.fromEntries(kept),
    dropped: entries.length - kept.length,
  };
}
