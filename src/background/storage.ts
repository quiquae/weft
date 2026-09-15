import type { MemoryCard, Settings, SiteAttention } from '../core/types.ts';
import { migrateSettings, validateSettings } from '../core/settings.ts';
import { emptyLockState, recordTamper, type LockState } from '../core/lock.ts';
import { newInstallId, open, seal } from '../core/integrity.ts';
import { dayKey } from '../core/escalation.ts';
import { verifyLicence, type LicenceStatus } from '../core/licence.ts';
import type { Tier } from '../core/entitlements.ts';
import { api } from '../shared/browser.ts';

/**
 * Persistence.
 *
 * Two decisions worth stating, because both look like inconsistencies:
 *
 * **Settings, lock state and attention are signed. Vocabulary cards are not.**
 * Signing exists to detect edits that make the extension easier, and the three
 * signed objects are exactly the ones that could do that. Editing a card can
 * only make a word look *less* known, which makes the page harder — there is
 * no incentive to forge it, and HMAC-ing five thousand cards on every
 * exposure would cost real battery for no benefit.
 *
 * **Everything is read through, nothing is trusted from memory across an
 * awakening.** An MV3 service worker is killed after about thirty seconds of
 * idle and restarted on the next message, so module state is a cache and
 * never the source of truth. Every handler that mutates state reads, mutates,
 * writes.
 */

const KEYS = {
  meta: 'weft:meta',
  settings: 'weft:settings',
  lock: 'weft:lock',
  attention: 'weft:attention',
  cards: 'weft:cards',
  introduced: 'weft:introduced',
  providerCache: 'weft:provider-cache',
  licence: 'weft:licence',
  network: 'weft:network',
} as const;

interface Meta {
  installId: string;
  version: string;
  installedAt: number;
}

export interface Introduced {
  day: string;
  lemmas: string[];
}

export interface Snapshot {
  /**
   * Settings exactly as the user set them, NOT clamped to their tier.
   *
   * Clamping happens at the point of use rather than on write, so that a
   * licence expiring never erases the configuration behind the features it
   * disables — and renewing restores everything instead of asking the user to
   * set it all up again.
   */
  settings: Settings;
  lock: LockState;
  attention: Record<string, SiteAttention>;
  introduced: Introduced;
  /** True when a signature check failed during this load. */
  tampered: boolean;
  licence: LicenceStatus;
  tier: Tier;
}

let cache: Snapshot | null = null;
let metaCache: Meta | null = null;

async function raw<T>(key: string): Promise<T | undefined> {
  const result = await api.storage.local.get(key);
  return result[key] as T | undefined;
}

async function put(key: string, value: unknown): Promise<void> {
  await api.storage.local.set({ [key]: value });
}

export async function getMeta(): Promise<Meta> {
  if (metaCache) return metaCache;
  const stored = await raw<Meta>(KEYS.meta);
  if (stored?.installId) {
    metaCache = { ...stored, version: __WEFT_VERSION__ };
    if (stored.version !== __WEFT_VERSION__) await put(KEYS.meta, metaCache);
    return metaCache;
  }
  const created: Meta = {
    installId: newInstallId(),
    version: __WEFT_VERSION__,
    installedAt: Date.now(),
  };
  metaCache = created;
  await put(KEYS.meta, created);
  return created;
}

/**
 * Load everything, verifying signatures.
 *
 * A failed signature is not treated as corruption to be discarded: the data is
 * kept and the event is recorded. Discarding would hand a user a clean slate
 * for editing storage, which is precisely the thing being guarded against.
 */
export async function load(): Promise<Snapshot> {
  if (cache) return cache;
  const meta = await getMeta();
  const now = Date.now();

  const [settingsEnv, lockEnv, attentionEnv, introducedRaw, licenceKey] = await Promise.all([
    raw<unknown>(KEYS.settings),
    raw<unknown>(KEYS.lock),
    raw<unknown>(KEYS.attention),
    raw<Introduced>(KEYS.introduced),
    raw<string>(KEYS.licence),
  ]);

  // Verified locally, against a public key compiled into the extension. No
  // request is made, here or anywhere, which is the point: an activation
  // server would be a per-user identifier and a log of when Weft is used.
  const licence = await verifyLicence(licenceKey ?? '');

  const settingsOpened = await open<unknown>(meta.installId, settingsEnv);
  const lockOpened = await open<LockState>(meta.installId, lockEnv);
  const attentionOpened = await open<Record<string, SiteAttention>>(meta.installId, attentionEnv);

  let settings = migrateSettings(settingsOpened.data, now, meta.installId);
  let lock: LockState = lockOpened.data ?? emptyLockState(now);
  const attention = attentionOpened.data ?? {};

  const tampered = settingsOpened.tampered || lockOpened.tampered || attentionOpened.tampered;
  if (tampered) {
    lock = recordTamper(lock, settings, now);
    // Re-validate, because a forged settings object may contain values the
    // engine must never see.
    settings = validateSettings(settings, now, meta.installId);
  }

  const today = dayKey(now, settings.attention.rolloverHour);
  const introduced: Introduced =
    introducedRaw && introducedRaw.day === today ? introducedRaw : { day: today, lemmas: [] };

  cache = { settings, lock, attention, introduced, tampered, licence, tier: licence.tier };
  if (tampered) await saveLock(lock);
  return cache;
}

export function invalidate(): void {
  cache = null;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const meta = await getMeta();
  await put(KEYS.settings, await seal(meta.installId, settings));
  if (cache) cache.settings = settings;
}

export async function saveLock(lock: LockState): Promise<void> {
  const meta = await getMeta();
  await put(KEYS.lock, await seal(meta.installId, lock));
  if (cache) cache.lock = lock;
}

export async function saveAttention(attention: Record<string, SiteAttention>): Promise<void> {
  const meta = await getMeta();
  await put(KEYS.attention, await seal(meta.installId, attention));
  if (cache) cache.attention = attention;
}

/** Store a licence key and return what it turned out to be. */
export async function saveLicence(key: string): Promise<LicenceStatus> {
  const status = await verifyLicence(key);
  // An unusable key is not stored, so a typo cannot leave the extension in a
  // permanently complaining state.
  if (status.kind === 'invalid') return status;
  await put(KEYS.licence, key.trim());
  if (cache) {
    cache.licence = status;
    cache.tier = status.tier;
  }
  return status;
}

export async function clearLicence(): Promise<void> {
  await api.storage.local.remove(KEYS.licence);
  invalidate();
}

export async function saveIntroduced(introduced: Introduced): Promise<void> {
  await put(KEYS.introduced, introduced);
  if (cache) cache.introduced = introduced;
}

/* ------------------------------------------------------------------ cards */

let cardCache: Record<string, MemoryCard> | null = null;
let cardWriteTimer: ReturnType<typeof setTimeout> | null = null;
let cardsDirty = false;

export async function loadCards(): Promise<Record<string, MemoryCard>> {
  if (cardCache) return cardCache;
  cardCache = (await raw<Record<string, MemoryCard>>(KEYS.cards)) ?? {};
  return cardCache;
}

/**
 * Queue a card write.
 *
 * Exposures arrive in batches every few seconds from every open tab, and each
 * one can touch dozens of cards. Writing through on each would mean hundreds
 * of storage writes a minute. The flush is also forced before the worker can
 * be suspended, which is the case that would otherwise lose data.
 */
export function queueCardWrite(): void {
  cardsDirty = true;
  if (cardWriteTimer) return;
  cardWriteTimer = setTimeout(() => {
    cardWriteTimer = null;
    void flushCards();
  }, 1500);
}

export async function flushCards(): Promise<void> {
  if (!cardsDirty || !cardCache) return;
  cardsDirty = false;
  await put(KEYS.cards, cardCache);
}

export async function replaceCards(cards: Record<string, MemoryCard>): Promise<void> {
  cardCache = cards;
  cardsDirty = true;
  await flushCards();
}

/* ------------------------------------------------------- network counter */

export interface NetworkLog {
  /** Requests Weft has made since install. Zero unless a provider is on. */
  requests: number;
  /** Words sent, cumulative. */
  words: number;
  /** Epoch ms of the most recent request, if any. */
  last?: number;
  /** Hosts contacted, for the user to check against what they expect. */
  hosts: string[];
}

const EMPTY_LOG: NetworkLog = { requests: 0, words: 0, hosts: [] };

export async function loadNetworkLog(): Promise<NetworkLog> {
  return (await raw<NetworkLog>(KEYS.network)) ?? EMPTY_LOG;
}

/**
 * Record that Weft went to the network.
 *
 * Exists so the privacy claim is checkable rather than asserted. The
 * dashboard shows this number, and for anyone who has not configured a
 * translation key it is zero and stays zero — which is a far better argument
 * than a paragraph promising the same thing.
 */
export async function noteNetworkRequest(host: string, words: number): Promise<void> {
  const log = await loadNetworkLog();
  const hosts = log.hosts.includes(host) ? log.hosts : [...log.hosts, host].slice(-12);
  await put(KEYS.network, {
    requests: log.requests + 1,
    words: log.words + words,
    last: Date.now(),
    hosts,
  } satisfies NetworkLog);
}

/* --------------------------------------------------------- provider cache */

export interface ProviderCacheEntry {
  tgt: string;
  at: number;
}

export async function loadProviderCache(): Promise<Record<string, ProviderCacheEntry>> {
  return (await raw<Record<string, ProviderCacheEntry>>(KEYS.providerCache)) ?? {};
}

export async function saveProviderCache(
  entries: Record<string, ProviderCacheEntry>,
): Promise<void> {
  await put(KEYS.providerCache, entries);
}

/* -------------------------------------------------------- export / import */

export async function exportAll(): Promise<Record<string, unknown>> {
  const snapshot = await load();
  const cards = await loadCards();
  return {
    format: 'weft-export/1',
    exportedAt: new Date().toISOString(),
    version: __WEFT_VERSION__,
    // The install id is deliberately omitted: it is the signing key material,
    // and an export is a file the user may share when reporting a problem.
    // The licence key and the install id are both omitted: the id is signing
    // key material and the licence is the customer's property, and an export
    // is a file people attach to bug reports.
    settings: { ...snapshot.settings, installId: '' },
    cards,
    attention: snapshot.attention,
    introduced: snapshot.introduced,
    lock: { ...snapshot.lock, log: snapshot.lock.log.slice(-50) },
  };
}

export interface ImportResult {
  ok: boolean;
  message: string;
}

/**
 * Import a previously exported file.
 *
 * Imported settings go through the same validation as anything read from
 * storage, and are then re-signed with THIS install's key. An import is
 * therefore a legitimate way to move a configuration between machines, and
 * not a way to install a forged difficulty setting: the values are clamped on
 * the way in, and any reduction in difficulty relative to the current state
 * still has to pass the cooldown, because settings are applied through the
 * same lock path as any other change.
 */
export async function importAll(payload: unknown): Promise<ImportResult> {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, message: 'That file is not a Weft export.' };
  }
  const data = payload as Record<string, unknown>;
  if (data['format'] !== 'weft-export/1') {
    return { ok: false, message: 'Unrecognised export format.' };
  }

  const meta = await getMeta();
  const now = Date.now();
  const settings = validateSettings(data['settings'], now, meta.installId);
  await saveSettings(settings);

  if (data['cards'] && typeof data['cards'] === 'object') {
    const incoming = data['cards'] as Record<string, MemoryCard>;
    const existing = await loadCards();
    const merged: Record<string, MemoryCard> = { ...existing };
    let added = 0;
    for (const [id, card] of Object.entries(incoming)) {
      if (!card || typeof card !== 'object' || typeof card.lemma !== 'string') continue;
      const current = merged[id];
      // Keep whichever record shows more learning, so a merge never loses
      // progress in either direction.
      if (!current || card.reps > current.reps || card.exposures > current.exposures) {
        merged[id] = { ...card, id };
        added++;
      }
    }
    await replaceCards(merged);
    invalidate();
    return { ok: true, message: `Imported settings and ${added} vocabulary records.` };
  }

  invalidate();
  return { ok: true, message: 'Imported settings.' };
}

export async function resetVocabulary(): Promise<void> {
  await replaceCards({});
  await saveIntroduced({ day: dayKey(Date.now()), lemmas: [] });
  invalidate();
}
