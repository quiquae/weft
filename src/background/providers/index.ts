import type { LangCode, LexEntry, Pos, Settings } from '../../core/types.ts';
import { dayKey } from '../../core/escalation.ts';
import { getLanguage } from '../../core/languages.ts';
import { machineEntry } from '../../core/machine-entry.ts';
import { deepl } from './deepl.ts';
import { google } from './google.ts';
import { openai } from './openai.ts';
import { ProviderError, type Provider, type TranslationRequest } from './types.ts';
import {
  loadProviderCache,
  saveProviderCache,
  spendLookups,
  type ProviderCacheEntry,
} from '../storage.ts';

export const PROVIDERS: Record<string, Provider> = { deepl, google, openai };

export interface LookupOutcome {
  entries: LexEntry[];
  fromCache: number;
  fromProvider: number;
  error?: string;
}

const DAY_MS = 86_400_000;

function cacheKey(source: LangCode, target: LangCode, word: string, pos: Pos): string {
  return `${source}>${target}:${pos}:${word.toLowerCase()}`;
}

/**
 * Look up words that the shipped pack does not contain.
 *
 * Cache first, always. A provider call is slow, costs the user money and
 * leaves their machine, so a word is not sent again while its answer is
 * kept: the cache is keyed on language pair, part of speech and word, and an
 * answer is kept, and served, for as many days as “Keep answers for” says —
 * one length for both, `keepDays` below — and for the newest
 * `MAX_PROVIDER_ENTRIES` words at most.
 *
 * Providers are tried in the user's order and the first usable answer wins.
 * A failure is reported, never thrown: the page must keep working with the
 * packaged vocabulary when a key expires.
 *
 * Every word sent comes off the day's lookup limit first, by `spendLookups`,
 * which is what makes the limit a day's and not a call's: until 2026-11-03
 * each call was sliced to the limit on its own, and a page load sends at most
 * sixty words, so at the default 2 000 it never bit.
 */
export async function lookupMissing(
  words: Array<{ word: string; pos: Pos; num?: 'sg' | 'pl'; context?: string }>,
  source: LangCode,
  target: LangCode,
  settings: Settings,
): Promise<LookupOutcome> {
  if (!settings.providers.enabled || !words.length) {
    return { entries: [], fromCache: 0, fromProvider: 0 };
  }

  // Historical languages are answered from the packs only. DeepL and Google
  // do not support them, and a model's Old English is not something to put on
  // a page silently.
  const meta = getLanguage(target);
  if (meta.historical && !settings.providers.order.includes('openai')) {
    return { entries: [], fromCache: 0, fromProvider: 0, error: `No provider supports ${meta.name}.` };
  }

  const cache = await loadProviderCache();
  const now = Date.now();
  const today = dayKey(now, settings.attention.rolloverHour);
  const cap = Math.max(0, settings.providers.dailyLookupCap);
  const keepDays = Math.max(1, settings.providers.cacheDays);
  const ttl = keepDays * DAY_MS;
  const entries: LexEntry[] = [];
  const pending: TranslationRequest[] = [];
  let fromCache = 0;

  for (const item of words) {
    const key = cacheKey(source, target, item.word, item.pos);
    const hit = cache[key];
    if (hit && now - hit.at < ttl) {
      fromCache++;
      if (hit.tgt) entries.push(machineEntry(item.word, item.pos, hit.tgt, item.num));
      continue;
    }
    const request: TranslationRequest = { word: item.word, pos: item.pos };
    if (item.num) request.num = item.num;
    if (settings.providers.sendContext && item.context) request.context = item.context;
    pending.push(request);
  }

  if (!pending.length) return { entries, fromCache, fromProvider: 0 };

  const controller = new AbortController();
  let fromProvider = 0;
  let lastError: string | undefined;
  /** Words this call sent anywhere, so the limit's message can be exact. */
  const sentNow = new Set<string>();
  let limited = false;

  for (const id of settings.providers.order) {
    const provider = PROVIDERS[id];
    if (!provider) continue;
    const why = provider.unavailable(settings);
    if (why) {
      lastError ??= why;
      continue;
    }

    try {
      const remaining = pending.filter(
        (r) => !entries.some((e) => e.lemma.toLowerCase() === r.word.toLowerCase()),
      );
      if (!remaining.length) break;

      for (let i = 0; i < remaining.length && !limited; i += provider.batchSize) {
        const wanted = remaining.slice(i, i + provider.batchSize);
        // Taken from the day before the call, so a request that fails still
        // counts. The number in the dashboard has to be the number of times
        // Weft went out, not the number of times it succeeded.
        const granted = await spendLookups(providerHost(provider.id, settings), wanted.length, today, cap);
        if (granted < wanted.length) limited = true;
        if (!granted) break;
        const batch = wanted.slice(0, granted);
        for (const request of batch) sentNow.add(request.word);
        const results = await provider.translate(batch, {
          source,
          target,
          settings,
          signal: controller.signal,
        });
        for (const result of results) {
          const request = batch.find((b) => b.word === result.word);
          cache[cacheKey(source, target, result.word, request?.pos ?? 'noun')] = {
            tgt: result.tgt ?? '',
            at: now,
          } satisfies ProviderCacheEntry;
          if (!result.tgt) continue;
          fromProvider++;
          entries.push(
            machineEntry(result.word, request?.pos ?? 'noun', result.tgt, request?.num, result.conf, result.gender),
          );
        }
      }
      lastError = undefined;
      break;
    } catch (err) {
      lastError = err instanceof ProviderError ? err.message : String(err);
      if (err instanceof ProviderError && !err.retryable) continue;
    }
  }

  // saveProviderCache prunes. There used to be a second pruner here, and
  // the two disagreed: this one capped at 20,000 entries by iterating
  // Object.entries and breaking, which keeps an arbitrary subset rather than
  // the newest, while the one in core/prune.ts caps at 5,000 by recency.
  // Two bounds on the same store is one bound too many; the survivor is the
  // one with tests. So are two lengths: the save prunes at the `keepDays`
  // the read above serves for, where until 2026-11-05 it pruned at 180 days
  // whatever the setting said.
  await saveProviderCache(cache, keepDays);
  const outcome: LookupOutcome = { entries, fromCache, fromProvider };
  if (lastError) outcome.error = lastError;
  else if (limited) outcome.error = limitReached(cap, pending.length - sentNow.size, sentNow.size);
  return outcome;
}

/** What a call the daily lookup limit stopped says, for the content script. */
function limitReached(cap: number, unsent: number, sent: number): string {
  const limit = `The daily lookup limit of ${cap} ${cap === 1 ? 'word' : 'words'}`;
  if (!sent) return `${limit} is used up for today, so nothing was sent.`;
  return `${limit} was reached, so ${unsent} ${unsent === 1 ? 'word was' : 'words were'} not sent.`;
}

/** The host a provider actually contacts, for the transparency log. */
function providerHost(id: string, settings: Settings): string {
  if (id === 'deepl') {
    return settings.providers.deepl.free ? 'api-free.deepl.com' : 'api.deepl.com';
  }
  if (id === 'google') return 'translation.googleapis.com';
  try {
    return new URL(settings.providers.openai.baseUrl).hostname;
  } catch {
    return 'openai-compatible endpoint';
  }
}

/** Status for the settings page: which providers are ready to use. */
export function providerStatus(settings: Settings): Array<{
  id: string;
  label: string;
  ready: boolean;
  reason: string | null;
}> {
  return settings.providers.order.map((id) => {
    const provider = PROVIDERS[id];
    if (!provider) return { id, label: id, ready: false, reason: 'Unknown provider.' };
    const reason = provider.unavailable(settings);
    return { id, label: provider.label, ready: !reason, reason };
  });
}
