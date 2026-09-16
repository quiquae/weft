import type { LangCode, LexEntry, Pos, Settings } from '../../core/types.ts';
import { getLanguage } from '../../core/languages.ts';
import { deepl } from './deepl.ts';
import { google } from './google.ts';
import { openai } from './openai.ts';
import { ProviderError, type Provider, type TranslationRequest } from './types.ts';
import {
  loadProviderCache,
  noteNetworkRequest,
  saveProviderCache,
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
 * leaves their machine, so a word is only ever sent once: the cache is keyed
 * on language pair, part of speech and word, and lives until the configured
 * expiry.
 *
 * Providers are tried in the user's order and the first usable answer wins.
 * A failure is reported, never thrown: the page must keep working with the
 * packaged vocabulary when a key expires.
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
  const ttl = Math.max(1, settings.providers.cacheDays) * DAY_MS;
  const entries: LexEntry[] = [];
  const pending: TranslationRequest[] = [];
  let fromCache = 0;

  for (const item of words) {
    const key = cacheKey(source, target, item.word, item.pos);
    const hit = cache[key];
    if (hit && now - hit.at < ttl) {
      fromCache++;
      if (hit.tgt) entries.push(makeEntry(item.word, item.pos, hit.tgt, item.num));
      continue;
    }
    const request: TranslationRequest = { word: item.word, pos: item.pos };
    if (item.num) request.num = item.num;
    if (settings.providers.sendContext && item.context) request.context = item.context;
    pending.push(request);
  }

  if (!pending.length) return { entries, fromCache, fromProvider: 0 };

  const capped = pending.slice(0, Math.max(0, settings.providers.dailyLookupCap));
  const controller = new AbortController();
  let fromProvider = 0;
  let lastError: string | undefined;

  for (const id of settings.providers.order) {
    const provider = PROVIDERS[id];
    if (!provider) continue;
    const why = provider.unavailable(settings);
    if (why) {
      lastError ??= why;
      continue;
    }

    try {
      const remaining = capped.filter(
        (r) => !entries.some((e) => e.lemma.toLowerCase() === r.word.toLowerCase()),
      );
      if (!remaining.length) break;

      for (let i = 0; i < remaining.length; i += provider.batchSize) {
        const batch = remaining.slice(i, i + provider.batchSize);
        // Logged before the call, so a request that fails still counts. The
        // number in the dashboard has to be the number of times Weft went
        // out, not the number of times it succeeded.
        await noteNetworkRequest(providerHost(provider.id, settings), batch.length);
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
            makeEntry(result.word, request?.pos ?? 'noun', result.tgt, request?.num, result.conf, result.gender),
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
  // one with tests.
  await saveProviderCache(cache);
  const outcome: LookupOutcome = { entries, fromCache, fromProvider };
  if (lastError) outcome.error = lastError;
  return outcome;
}

/**
 * Provider-sourced entries are marked at a lower confidence and a middle
 * difficulty band. They are usable, but the selector will always prefer a
 * curated entry for the same word, which is the correct ordering: a checked
 * gloss beats a machine one.
 */
function makeEntry(
  word: string,
  pos: Pos,
  tgt: string,
  num?: 'sg' | 'pl',
  conf = 0.75,
  gender?: 'm' | 'f' | 'n' | 'c',
): LexEntry {
  const entry: LexEntry = {
    src: word.toLowerCase(),
    lemma: word.toLowerCase(),
    pos,
    tgt,
    tgtLemma: tgt,
    // Unknown frequency: place it mid-scale so it is neither preferred as a
    // very common word nor rejected as a rare one.
    zipf: 3.6,
    senses: 1,
    conf,
    band: 3,
    note: 'Machine translation, not a checked gloss.',
  };
  if (num) entry.num = num;
  if (gender) entry.gender = gender;
  return entry;
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
