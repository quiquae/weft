import type { MemoryCard, Settings, SiteAttention } from '../core/types.ts';
import {
  exportSafeSettings,
  keepLocalOnly,
  LOCAL_ONLY_PATHS,
  migrateSettings,
  sendNoMoreThan,
  SENDING_PATHS,
  validateSettings,
} from '../core/settings.ts';
import {
  emptyLockState,
  noteClock,
  recordTamper,
  requestChange,
  splitImportedSettings,
  type LockState,
} from '../core/lock.ts';
import { getPath, type Patch } from '../core/patch.ts';
import { newInstallId, open, seal } from '../core/integrity.ts';
import { dayKey, mergeAttention } from '../core/escalation.ts';
import { mergeCards } from '../core/fsrs.ts';
import { renameCards } from '../core/renames.ts';
import { pruneAttention, pruneByAge } from '../core/prune.ts';
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
  const licence = await verifyLicence(licenceKey ?? '', now);

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

  /*
   * Every wake is a clock observation.
   *
   * Here rather than on an alarm because an MV3 service worker is killed
   * when idle: load() is the one path guaranteed to run whenever the
   * extension does anything at all, which makes it the densest sampling of
   * the wall clock available. See noteClock for why only the backwards
   * direction is detectable.
   */
  const clock = noteClock(lock, settings, now);
  lock = clock.state;

  const today = dayKey(now, settings.attention.rolloverHour);
  const introduced: Introduced =
    introducedRaw && introducedRaw.day === today ? introducedRaw : { day: today, lemmas: [] };

  cache = { settings, lock, attention, introduced, tampered, licence, tier: licence.tier };
  // Persisted when the clock moved too, so the new baseline survives the
  // worker being killed — otherwise the same rewind is re-detected forever.
  if (tampered || clock.rewound || lock.lastSeenAt !== lockOpened.data?.lastSeenAt) {
    await saveLock(lock);
  }
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

/**
 * Save attention, pruned.
 *
 * Pruned on write rather than on a periodic alarm because this is the only
 * path that grows the record, so it is the only place the bound can actually
 * be guaranteed. An alarm leaves the size unbounded between firings, which is
 * precisely the window a quota error happens in.
 */
export async function saveAttention(
  attention: Record<string, SiteAttention>,
): Promise<Record<string, SiteAttention>> {
  const meta = await getMeta();
  const { kept } = pruneAttention(attention, Date.now());
  await put(KEYS.attention, await seal(meta.installId, kept));
  if (cache) cache.attention = kept;
  // Returned rather than void so an importer can say how many sites actually
  // landed instead of how many the file offered.
  return kept;
}

/** Store a licence key and return what it turned out to be at `now`. */
export async function saveLicence(key: string, now: number): Promise<LicenceStatus> {
  const status = await verifyLicence(key, now);
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
  // A card filed under a spelling the pack has since changed moves to the
  // word's current one, and is written back at once so the move is made once
  // rather than on every awakening. See RENAMED.
  const { cards, moved } = renameCards((await raw<Record<string, MemoryCard>>(KEYS.cards)) ?? {});
  cardCache = cards;
  if (moved) {
    cardsDirty = true;
    await flushCards();
  }
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
  const { kept } = pruneByAge(entries, Date.now());
  await put(KEYS.providerCache, kept);
}

/* -------------------------------------------------------- export / import */

export async function exportAll(): Promise<Record<string, unknown>> {
  const snapshot = await load();
  const cards = await loadCards();
  return {
    format: 'weft-export/1',
    exportedAt: new Date().toISOString(),
    version: __WEFT_VERSION__,
    // An export is a file people attach to bug reports, so nothing in it may
    // be a secret. The install id is signing key material and the three
    // provider keys are somebody's paid account: `exportSafeSettings` blanks
    // every field `LOCAL_ONLY_PATHS` names, with the address one key is sent to. Until 2026-11-02 this blanked the
    // install id alone and the keys went out in clear, while the privacy page
    // said they were stripped. The licence lives under its own key and is
    // not read here at all: it is the customer's property.
    settings: exportSafeSettings(snapshot.settings),
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
 * An import is a merge into a live install, not a restore over a blank one,
 * and the file is plain JSON the user can edit. Both facts drive every rule
 * below: nothing may arrive that makes Weft easier without passing the same
 * gate it would have passed on the options page, and nothing already here
 * may be lost to a file that knows less than this machine does.
 *
 * **Local-only fields** — the API keys, the address the OpenAI-compatible
 * key is sent to, and the install id — keep this machine's values whatever
 * the file says (`keepLocalOnly`). An export never carries them, so a file
 * that does is old or edited, and a key belongs to the machine it was typed
 * on. Saving the file's settings as they came, as this did until 2026-11-02,
 * erased a machine's keys whenever it imported a file that had none, and
 * replaced them with any a file did have; keeping the key and taking the
 * file's address would have sent the key wherever the file said.
 *
 * **What this machine sends to a translation service** may narrow and never
 * widen (`sendNoMoreThan`): a file can switch lookups or sentence context
 * off, at once, and cannot switch either on, add a service, drop a host from
 * the never-send list, raise the daily lookup limit or keep answers for less
 * time. With the keys staying put, a machine holding a key with lookups off
 * was otherwise one line of an imported file from sending its reading to that
 * key's service. The message names what was left out.
 *
 * **Settings** are split by `splitImportedSettings`. Harder and cosmetic
 * values land at once; anything easier becomes a patch for `requestChange`
 * and queues against the user's own cooldown. This is what the previous
 * version of this comment claimed already happened and what the code did
 * not do — it wrote the whole object straight through, which made an export
 * file a complete bypass of the commitment layer.
 *
 * **Cards** merge through `mergeCards`, which moves the FSRS state as a unit
 * rather than taking field-wise maxima of a history that never happened.
 *
 * **Attention** merges through `mergeAttention`, max per day. It can only
 * ever raise the number, and a higher number is a harder page, so it needs
 * no gate — and a second import of the same file changes nothing.
 *
 * **Introduced** words come in only when the file is from today, which is
 * the one case they mean anything: `load()` discards any other day's.
 *
 * **Lock state is never imported**, and that is a decision rather than the
 * omission it used to be. Every field of it moves difficulty *down* when it
 * comes from a file — a pending change whose `unlocksAt` has already passed
 * is a reduction that applies on arrival, a `panic` day with `used: 0`
 * refills a spent budget, a lower `tamperCount` launders a history, and an
 * older `lastSeenAt` re-arms the clock-rewind trick `noteClock` exists to
 * catch. There is no field worth the hole, so the lock stays with the
 * machine that earned it and the result message says so instead of being
 * silent about it.
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
  const snapshot = await load();
  const { settings: before, lock, attention: mine, introduced } = snapshot;

  const { settings: incoming, held: unsent } = sendNoMoreThan(
    keepLocalOnly(validateSettings(data['settings'], now, meta.installId), before),
    before,
  );
  const { immediate, deferred } = splitImportedSettings(before, incoming);
  await saveSettings(immediate);
  const queued = await queueEasierSettings(lock, immediate, deferred, now, meta.installId);

  const cards = await importCards(data['cards']);
  const hosts = await importAttention(data['attention'], mine, now);
  await importIntroduced(data['introduced'], introduced, immediate.attention.rolloverHour, now);

  invalidate();
  return {
    ok: true,
    message: importMessage(
      cards,
      hosts,
      queued,
      carriesLockState(data['lock']),
      carriesKeys(data['settings']),
      unsent,
    ),
  };
}

/**
 * Hand the easier half of an import to the cooldown.
 *
 * `requestChange` applies it itself when no cooldown is configured, which is
 * the user's own setting and not something to second-guess here. Returns how
 * many paths are actually waiting, so the message can be true.
 */
async function queueEasierSettings(
  lock: LockState,
  settings: Settings,
  deferred: Patch,
  now: number,
  installId: string,
): Promise<number> {
  const paths = Object.keys(deferred);
  if (!paths.length) return 0;

  const result = requestChange(lock, settings, deferred, now, () => newInstallId().slice(0, 12));
  await saveLock(result.state);
  if (result.applied) {
    await saveSettings(validateSettings(result.settings, now, installId));
    return 0;
  }
  return paths.length;
}

/** Merge incoming cards, returning how many records the file contributed. */
async function importCards(incoming: unknown): Promise<number> {
  if (!incoming || typeof incoming !== 'object') return 0;
  const existing = await loadCards();
  const merged: Record<string, MemoryCard> = { ...existing };
  let added = 0;

  const offered: Record<string, MemoryCard> = {};
  for (const [id, card] of Object.entries(incoming as Record<string, MemoryCard>)) {
    if (!card || typeof card !== 'object' || typeof card.lemma !== 'string') continue;
    offered[id] = { ...card, id };
  }

  // A file an older version wrote may file a word under a spelling the pack
  // has since changed, and this install has already moved its own copy.
  for (const [id, card] of Object.entries(renameCards(offered).cards)) {
    const current = merged[id];
    if (!current) {
      merged[id] = card;
      added++;
      continue;
    }
    // mergeCards keeps the FSRS state as one unit and merges only the
    // genuinely additive counters. The version of this loop that compared
    // reps OR exposures and replaced the whole record could drop nine
    // reviews to gain an exposure count — see the note on mergeCards.
    const next = mergeCards(current, card);
    if (next !== current) {
      merged[id] = next;
      added++;
    }
  }

  await replaceCards(merged);
  return added;
}

/** Merge incoming attention, returning how many of its hosts landed. */
async function importAttention(
  incoming: unknown,
  mine: Record<string, SiteAttention>,
  now: number,
): Promise<number> {
  if (!incoming || typeof incoming !== 'object') return 0;
  const theirs = incoming as Record<string, SiteAttention>;
  const offered = Object.entries(theirs)
    .filter(([, site]) => site && typeof site === 'object')
    .map(([host]) => host);
  if (!offered.length) return 0;

  // Counted against what survived the write rather than what the file
  // offered, because saveAttention prunes to MAX_HOSTS.
  const kept = await saveAttention(mergeAttention(mine, theirs, now));
  return offered.filter((host) => host in kept).length;
}

/**
 * Today's introduced words, and only today's.
 *
 * Any other day is a no-op by construction — `load()` throws away an
 * `introduced` whose day is not today — so the only case this changes
 * anything is the same-day machine move it exists for, where dropping it
 * means meeting the same new words twice in one afternoon. Unioned rather
 * than replaced, and capped at the 500 `validateSettings` clamps
 * `introduceNewPerDay` to, because a list read out of a file is otherwise
 * unbounded and this store has no pruner of its own.
 */
const MAX_INTRODUCED = 500;

async function importIntroduced(
  incoming: unknown,
  current: Introduced,
  rolloverHour: number,
  now: number,
): Promise<boolean> {
  if (!incoming || typeof incoming !== 'object') return false;
  const { day, lemmas } = incoming as { day?: unknown; lemmas?: unknown };
  if (typeof day !== 'string' || day !== dayKey(now, rolloverHour)) return false;
  if (!Array.isArray(lemmas)) return false;

  const merged = new Set(current.day === day ? current.lemmas : []);
  const sizeBefore = merged.size;
  for (const lemma of lemmas) {
    if (merged.size >= MAX_INTRODUCED) break;
    if (typeof lemma === 'string' && lemma) merged.add(lemma);
  }
  if (merged.size === sizeBefore) return false;

  await saveIntroduced({ day, lemmas: [...merged] });
  return true;
}

/** True when the file carries lock state a user would notice the absence of. */
function carriesLockState(incoming: unknown): boolean {
  if (!incoming || typeof incoming !== 'object') return false;
  const lock = incoming as Partial<LockState>;
  return Boolean(
    (Array.isArray(lock.pending) && lock.pending.length) ||
      (lock.panic && lock.panic.used > 0) ||
      lock.tamperCount,
  );
}

/**
 * Whether a file held an API key, which the import left where it was.
 *
 * Only the fields named `key`: every export written before 2026-11-02 carries
 * the default base URL, which is local-only too and no key, and a file that
 * held only that must not be told it held one.
 */
function carriesKeys(settings: unknown): boolean {
  return LOCAL_ONLY_PATHS.some((path) => {
    if (path.split('.').at(-1) !== 'key') return false;
    const value = getPath(settings, path);
    return typeof value === 'string' && value !== '';
  });
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * Say what happened, including the parts that did not.
 *
 * The old message was `Imported settings and N vocabulary records.`, which
 * was true about what it did and silent about the three stores it threw
 * away. Silence is the part that made it a bug rather than a limitation: a
 * user cannot notice a history they were never told was dropped.
 */
function importMessage(
  cards: number,
  hosts: number,
  queued: number,
  heldLock: boolean,
  heldKeys: boolean,
  unsent: string[],
): string {
  const landed = ['settings'];
  if (cards) landed.push(plural(cards, 'vocabulary record'));
  if (hosts) landed.push(`attention for ${plural(hosts, 'site')}`);
  const list =
    landed.length > 1 ? `${landed.slice(0, -1).join(', ')} and ${landed.at(-1)}` : landed[0];

  const out = [`Imported ${list}.`];
  if (queued) {
    out.push(
      `${plural(queued, 'setting')} that would make Weft easier ${queued === 1 ? 'is' : 'are'} waiting out the cooldown.`,
    );
  }
  if (heldLock) out.push('Cooldowns and panic passes stay with this machine.');
  if (heldKeys) out.push('API keys stay with this machine: the ones in the file were left out.');
  if (unsent.length) {
    const labels = SENDING_PATHS.filter((s) => unsent.includes(s.path)).map((s) => s.label);
    const said =
      labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}` : (labels[0] ?? '');
    out.push(
      `${said.charAt(0).toUpperCase()}${said.slice(1)} ${labels.length === 1 ? 'was' : 'were'} left out: a file cannot make Weft send more to a translation service.`,
    );
  }
  return out.join(' ');
}

export async function resetVocabulary(): Promise<void> {
  await replaceCards({});
  await saveIntroduced({ day: dayKey(Date.now()), lemmas: [] });
  invalidate();
}
