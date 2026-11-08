import type { Grade, LangCode, LexEntry, MemoryCard, Settings, SiteAttention } from '../core/types.ts';
import { classifyUrl, originCoversRules, patternMatches } from '../core/sites.ts';
import {
  currentAttentionSeconds,
  dayKey,
  recordAttention,
  weaveRatio,
} from '../core/escalation.ts';
import {
  applyReadyChanges,
  cancelPending,
  markQuizPassed,
  panicActive,
  penaltyActive,
  requestChange,
  splitOnboarding,
  usePanicPass,
} from '../core/lock.ts';
import { cardId, isRetirable, newCard, reviewCard } from '../core/fsrs.ts';
import { effectiveLevel } from '../core/selector.ts';
import { buildQuiz, quizPassed, quizScore } from '../core/quiz.ts';
import { entriesByTarget } from '../core/lexicon.ts';
import { isWithdrawn } from '../core/renames.ts';
import { validateSettings } from '../core/settings.ts';
import { clampToTier, exceedsTier, featureInfo } from '../core/entitlements.ts';
import { describeLicence } from '../core/licence.ts';
import { newInstallId } from '../core/integrity.ts';
import { api, can, contextMenus } from '../shared/browser.ts';
import { fail, ok } from '../shared/rpc.ts';
import { CONFIGURE_FOR_TEST, type PageState, type Request, type ResponseMap } from '../shared/messages.ts';
import * as store from './storage.ts';
import { profileFor } from './hard-mode.ts';
import { lookupMissing } from './providers/index.ts';

/**
 * Service worker.
 *
 * Holds the authority for anything a page must not be able to decide for
 * itself: the current difficulty, whether a cooldown has elapsed, what the
 * learner knows. A content script asks; it never computes.
 *
 * Written on the assumption that this worker is killed roughly every thirty
 * idle seconds. Nothing is kept in memory that has not been written, and
 * every handler is safe to run on a cold start.
 */

const CONTENT_SCRIPT_ID = 'weft-content';
const LOCK_ALARM = 'weft-lock-tick';
const FLUSH_ALARM = 'weft-flush';

/* ------------------------------------------------------------------ ratio */

interface RatioInput {
  settings: Settings;
  decision: ReturnType<typeof classifyUrl>;
  attentionSeconds: number;
  panic: boolean;
  penalty: boolean;
}

/**
 * The single place difficulty is decided.
 *
 * Order matters: a panic pass wins over everything (that is the whole point of
 * an escape valve), and a tamper penalty wins over the curve (that is the
 * whole point of a penalty).
 */
function computeRatio(input: RatioInput): number {
  if (input.panic) return 0;
  if (input.penalty) return input.decision.ceilingRatio || input.settings.weave.ceilingRatio;
  return weaveRatio({
    baseRatio: input.decision.baseRatio,
    ceilingRatio: input.decision.ceilingRatio,
    gainPerMinute: input.settings.attention.gainPerMinute,
    attentionSeconds: input.attentionSeconds,
    escalate: input.decision.escalate,
  });
}

async function buildPageState(url: string): Promise<PageState> {
  const snapshot = await store.load();
  const now = Date.now();

  // Apply anything whose cooldown has elapsed before answering, so a page
  // load never shows stale difficulty.
  const applied = applyReadyChanges(snapshot.lock, snapshot.settings, now);
  if (applied.applied.length) {
    await store.saveLock(applied.state);
    await store.saveSettings(applied.settings);
  }
  // Clamped here, at the point of use. Storage keeps what the user chose.
  const tier = snapshot.tier;
  const settings = clampToTier(applied.settings, tier);
  const lock = applied.state;

  const decision = classifyUrl(url, settings);
  const attention = snapshot.attention[decision.attentionKey];
  const attentionSeconds = currentAttentionSeconds(attention, now, {
    rolloverHour: settings.attention.rolloverHour,
    decayPerHourAway: settings.attention.decayPerHourAway,
  });

  const panic = panicActive(lock, now);
  const penalty = penaltyActive(lock, now);
  const ratio = computeRatio({ settings, decision, attentionSeconds, panic, penalty });

  const allCards = await store.loadCards();
  const target = decision.target;
  const cards: Record<string, MemoryCard> = {};
  let retiredCount = 0;
  for (const [id, card] of Object.entries(allCards)) {
    if (card.target !== target) continue;
    cards[id] = card;
    if (card.retiredAt || isRetirable(card, settings.learning.retireStabilityDays, now)) {
      retiredCount++;
    }
  }

  return {
    settings,
    tier,
    decision,
    ratio,
    attentionSeconds,
    cards,
    introducedToday: snapshot.introduced.lemmas,
    panicActive: panic,
    effectiveLevel: effectiveLevel(settings.learning.level, retiredCount),
    penaltyActive: penalty,
  };
}

/* ------------------------------------------------------------------ cards */

async function ensureCard(target: LangCode, lemma: string, now: number): Promise<MemoryCard> {
  const cards = await store.loadCards();
  const id = cardId(target, lemma);
  const existing = cards[id];
  if (existing) return existing;
  const created = newCard(target, lemma, now);
  cards[id] = created;
  store.queueCardWrite();
  return created;
}

async function noteIntroduced(lemmas: string[]): Promise<void> {
  if (!lemmas.length) return;
  const snapshot = await store.load();
  const today = dayKey(Date.now(), snapshot.settings.attention.rolloverHour);
  const current =
    snapshot.introduced.day === today ? snapshot.introduced : { day: today, lemmas: [] };
  const set = new Set(current.lemmas);
  let changed = false;
  for (const lemma of lemmas) {
    if (!set.has(lemma)) {
      set.add(lemma);
      changed = true;
    }
  }
  if (changed) await store.saveIntroduced({ day: today, lemmas: [...set] });
}

/* --------------------------------------------------------------- handlers */

type Handlers = {
  [K in Request['type']]: (
    request: Extract<Request, { type: K }>,
    sender: chrome.runtime.MessageSender,
  ) => Promise<ResponseMap[K]>;
};

const handlers: Handlers = {
  'get-page-state': async (request) => {
    // Opening the popup is the acknowledgement gesture, so it is where the
    // notification badge gets cleared. Without this the badge set by the
    // Safari fallback would never come off, and a badge that never clears is
    // noise a user learns to ignore rather than a signal.
    await clearBadge();
    return buildPageState(request.url);
  },

  'get-pack': async (request) => {
    // The content script fetches packs from disk directly; this exists for UI
    // pages, which need a pack to build a quiz.
    try {
      const url = api.runtime.getURL(`lexicon/${request.source}-${request.target}.json`);
      const response = await fetch(url);
      if (!response.ok) return { pack: null, error: `No pack for ${request.target}.` };
      return { pack: await response.json() };
    } catch (err) {
      return { pack: null, error: (err as Error).message };
    }
  },

  'record-attention': async (request) => {
    const snapshot = await store.load();
    const now = Date.now();
    const settings = snapshot.settings;
    const decision = classifyUrl(request.url, settings);

    // Attention only accrues where difficulty can actually rise. Counting it
    // on a gentle or excluded site would make the dashboard lie.
    if (decision.mode === 'excluded' || decision.mode === 'off') {
      return { ratio: 0, attentionSeconds: 0, panicActive: false };
    }

    const attention = { ...snapshot.attention };
    const { attention: updated } = recordAttention(
      attention[request.host],
      request.host,
      request.seconds,
      now,
      {
        rolloverHour: settings.attention.rolloverHour,
        decayPerHourAway: settings.attention.decayPerHourAway,
        dailyCapMinutes: settings.attention.dailyCapMinutes,
      },
    );
    attention[request.host] = updated;
    await store.saveAttention(attention);

    const panic = panicActive(snapshot.lock, now);
    const penalty = penaltyActive(snapshot.lock, now);
    const ratio = computeRatio({
      settings,
      decision,
      attentionSeconds: updated.seconds,
      panic,
      penalty,
    });
    return { ratio, attentionSeconds: updated.seconds, panicActive: panic };
  },

  'record-exposure': async (request) => {
    const now = Date.now();
    const cards = await store.loadCards();
    const introduced: string[] = [];
    for (const lemma of request.lemmas) {
      const id = cardId(request.target, lemma);
      const card = cards[id] ?? newCard(request.target, lemma, now);
      if (card.exposures === 0) introduced.push(lemma);
      cards[id] = { ...card, exposures: card.exposures + 1 };
    }
    store.queueCardWrite();
    await noteIntroduced(introduced);
    return { ok: true };
  },

  'record-reveal': async (request) => {
    const now = Date.now();
    const cards = await store.loadCards();
    const id = cardId(request.target, request.lemma);
    const card = cards[id] ?? (await ensureCard(request.target, request.lemma, now));
    // Needing the English is the honest signal that the word is not known.
    // Grading it "again" is what puts it back in front of the learner soon.
    cards[id] = reviewCard(card, 1 as Grade, now);
    store.queueCardWrite();
    return { ok: true };
  },

  'record-grade': async (request) => {
    const now = Date.now();
    const cards = await store.loadCards();
    const id = cardId(request.target, request.lemma);
    const card = cards[id] ?? (await ensureCard(request.target, request.lemma, now));
    const settings = (await store.load()).settings;
    let updated = reviewCard(card, request.grade, now);
    if (!updated.retiredAt && isRetirable(updated, settings.learning.retireStabilityDays, now)) {
      updated = { ...updated, retiredAt: now };
    }
    cards[id] = updated;
    store.queueCardWrite();
    return { card: updated };
  },

  'get-settings': async () => {
    const snapshot = await store.load();
    return { settings: clampToTier(snapshot.settings, snapshot.tier), tier: snapshot.tier };
  },

  'get-licence': async () => {
    const snapshot = await store.load();
    return {
      licence: snapshot.licence,
      tier: snapshot.tier,
      exceeds: exceedsTier(snapshot.settings, snapshot.tier),
    };
  },

  'set-licence': async (request) => {
    // One instant for both, so the key is described as of the moment it was judged.
    const now = Date.now();
    const status = await store.saveLicence(request.key, now);
    store.invalidate();
    if (status.kind !== 'invalid') {
      await broadcastSettingsChanged();
      await registerContentScripts();
    }
    return { licence: status, tier: status.tier, message: describeLicence(status, now) };
  },

  'clear-licence': async () => {
    await store.clearLicence();
    await broadcastSettingsChanged();
    return { ok: true };
  },

  'request-change': async (request) => {
    const snapshot = await store.load();
    const now = Date.now();

    // A change that asks for a Pro feature is refused outright rather than
    // queued. Putting it through the cooldown would make the user wait an
    // hour to discover they cannot have it, which is the worst possible
    // ordering of those two pieces of news.
    const wouldBe = validateSettings(
      { ...snapshot.settings, ...applyPatchShallow(snapshot.settings, request.patch) },
      now,
      snapshot.settings.installId,
    );
    const over = exceedsTier(wouldBe, snapshot.tier).filter(
      (feature) => !exceedsTier(snapshot.settings, snapshot.tier).includes(feature),
    );
    if (over.length) {
      const first = over[0] as (typeof over)[number];
      const info = featureInfo(first);
      return {
        applied: false,
        message: `${info.label} is part of Weft Pro. ${info.detail}`,
        needsPro: first,
      };
    }

    const result = requestChange(
      snapshot.lock,
      snapshot.settings,
      request.patch,
      now,
      () => newInstallId().slice(0, 12),
    );
    await store.saveLock(result.state);
    if (result.applied) {
      await store.saveSettings(validateSettings(result.settings, now, snapshot.settings.installId));
      await broadcastSettingsChanged();
      await registerContentScripts();
    }
    const response: ResponseMap['request-change'] = {
      applied: result.applied,
      message: result.message,
    };
    if (result.pending) response.pending = result.pending;
    return response;
  },

  'cancel-pending': async (request) => {
    const snapshot = await store.load();
    await store.saveLock(cancelPending(snapshot.lock, request.id, Date.now()));
    return { ok: true };
  },

  'get-lock-state': async () => {
    const snapshot = await store.load();
    const now = Date.now();
    const applied = applyReadyChanges(snapshot.lock, snapshot.settings, now);
    if (applied.applied.length) {
      await store.saveLock(applied.state);
      await store.saveSettings(applied.settings);
      await broadcastSettingsChanged();
    }
    return {
      lock: applied.state,
      settings: clampToTier(applied.settings, snapshot.tier),
      tier: snapshot.tier,
      licence: snapshot.licence,
      exceeds: exceedsTier(applied.settings, snapshot.tier),
    };
  },

  'use-panic': async () => {
    const snapshot = await store.load();
    const result = usePanicPass(snapshot.lock, snapshot.settings, Date.now());
    await store.saveLock(result.state);
    if (result.granted) {
      await broadcastToTabs({ type: 'weft-suspend' });
      if (result.activeUntil) {
        // Resume exactly when the pass expires, rather than waiting for the
        // next page load. An alarm survives the worker being killed.
        const minutes = Math.max(0.5, (result.activeUntil - Date.now()) / 60_000);
        await api.alarms.create('weft-panic-end', { delayInMinutes: minutes });
      }
    }
    const response: ResponseMap['use-panic'] = {
      granted: result.granted,
      message: result.message,
    };
    if (result.activeUntil) response.activeUntil = result.activeUntil;
    return response;
  },

  'build-quiz': async (request) => {
    const snapshot = await store.load();
    const change = snapshot.lock.pending.find((p) => p.id === request.changeId);
    if (!change) return { questions: [], error: 'That change is no longer waiting.' };

    const settings = snapshot.settings;
    const target = settings.learning.activeTarget;
    const packUrl = api.runtime.getURL(`lexicon/${settings.learning.sourceLang}-${target}.json`);
    let pack: { entries: Record<string, LexEntry[]> };
    try {
      pack = await (await fetch(packUrl)).json();
    } catch {
      return { questions: [], error: 'Could not load the vocabulary pack.' };
    }

    const allCards = await store.loadCards();
    const cards = Object.values(allCards).filter((c) => c.target === target);
    const questions = buildQuiz({
      cards,
      // The same lookup the dashboard reads, so the quiz asks a word by the
      // gloss the vocabulary list shows for it. See `entriesByTarget`.
      entriesByLemma: entriesByTarget(pack.entries),
      pool: Object.values(pack.entries).flat(),
      target,
      source: settings.learning.sourceLang,
      count: settings.friction.quizWordCount,
      includeTyping: true,
      // Seeded from the change id so reloading the page does not reroll the
      // quiz into an easier one.
      seed: Array.from(request.changeId).reduce((a, c) => a + c.charCodeAt(0), 0),
    });

    if (!questions.length) {
      return {
        questions: [],
        error:
          'No words to test yet. Read a little with Weft on first — the check only ever uses words you have already been shown.',
      };
    }
    return { questions };
  },

  'submit-quiz': async (request) => {
    const snapshot = await store.load();
    const settings = snapshot.settings;
    const passed = quizPassed(request.results, settings.friction.quizPassThreshold);
    const score = quizScore(request.results);

    // The answers are real retrieval practice, so they feed the scheduler
    // whether or not the gate opens.
    const now = Date.now();
    const cards = await store.loadCards();
    for (const result of request.results) {
      const id = cardId(settings.learning.activeTarget, result.lemma);
      const card = cards[id] ?? newCard(settings.learning.activeTarget, result.lemma, now);
      cards[id] = reviewCard(card, result.correct ? (3 as Grade) : (1 as Grade), now);
    }
    store.queueCardWrite();

    if (!passed) {
      return {
        passed: false,
        score,
        message: `${Math.round(score * 100)}%. You need ${Math.round(
          settings.friction.quizPassThreshold * 100,
        )}%. Try again whenever you like — the answers still counted as practice.`,
      };
    }

    await store.saveLock(markQuizPassed(snapshot.lock, request.changeId, now));
    return {
      passed: true,
      score,
      message: `${Math.round(score * 100)}%. The change will apply when its cooldown ends.`,
    };
  },

  'get-stats': async () => {
    const snapshot = await store.load();
    // A word a pack withdrew is kept, and exported, but it is no longer
    // vocabulary, so nothing that reports progress lists or counts it: the
    // dashboard would show it with no English beside it. See WITHDRAWN.
    const cards = Object.values(await store.loadCards()).filter((c) => !isWithdrawn(c));
    return {
      tier: snapshot.tier,
      network: await store.loadNetworkLog(),
      settings: clampToTier(snapshot.settings, snapshot.tier),
      cards,
      attention: Object.values(snapshot.attention) as SiteAttention[],
      lock: snapshot.lock,
    };
  },

  'get-cards': async (request) => {
    const all = Object.values(await store.loadCards());
    return { cards: request.target ? all.filter((c) => c.target === request.target) : all };
  },

  'grant-origins': async (request) => {
    // The request itself must come from a user gesture on an extension page,
    // so the UI calls chrome.permissions.request directly. Here we only
    // confirm and re-register.
    const granted = await api.permissions.contains({ origins: request.origins });
    if (granted) await registerContentScripts();
    return { granted };
  },

  'get-granted-origins': async () => {
    const perms = await api.permissions.getAll();
    return { origins: perms.origins ?? [] };
  },

  'reregister-scripts': async () => {
    const registered = await registerContentScripts();
    return { ok: true, registered };
  },

  /**
   * Finish the first-run page.
   *
   * The page can be opened again at any time — it is a file in the
   * extension, at a URL anyone can type — so only the first finish writes
   * freely. Every one after goes through `splitOnboarding`: harder lands,
   * easier waits out the cooldown, as on the options page and in an import.
   */
  'complete-onboarding': async (request) => {
    const snapshot = await store.load();
    const now = Date.now();
    const incoming = validateSettings(
      { ...snapshot.settings, ...applyPatchShallow(snapshot.settings, request.patch), onboarded: true },
      now,
      snapshot.settings.installId,
    );
    const { immediate, deferred } = splitOnboarding(snapshot.settings, incoming);
    await store.saveSettings(immediate);
    const queued = await store.queueEasierSettings(
      snapshot.lock,
      immediate,
      deferred,
      now,
      snapshot.settings.installId,
    );
    const granted = request.origins.length
      ? await api.permissions.contains({ origins: request.origins })
      : true;
    await registerContentScripts();
    await broadcastSettingsChanged();
    return { ok: true, granted, queued };
  },

  'export-data': async () => ({ payload: await store.exportAll() }),

  'import-data': async (request) => {
    const result = await store.importAll(request.payload);
    store.invalidate();
    if (result.ok) {
      await broadcastSettingsChanged();
      await registerContentScripts();
    }
    return result;
  },

  'reset-vocabulary': async () => {
    await store.resetVocabulary();
    await broadcastSettingsChanged();
    return { ok: true };
  },

  'hard-mode-profile': async (request) => profileFor(request.platform),

  /**
   * Translate words the packs do not cover.
   *
   * The never-send list is enforced here rather than in the page, and two
   * details of that took a second pass to get right.
   *
   * **It matches with `patternMatches`, not string comparison.** The check
   * used to be `host === pattern || host.endsWith('.' + pattern)`, against a
   * default list that includes `amazon.com/gp/buy` and
   * `github.com/*\/compare`. A hostname never contains a slash, so those
   * entries could not match anything — dead weight that read, in the
   * settings UI, as protection. GitHub compare pages were the real casualty:
   * unlike docs.google.com/forms, plain github.com is not separately listed,
   * so nothing covered them. patternMatches is the same path-aware matcher
   * the site rules use, and it also understands the `*.` and `=` prefixes
   * that a user typing into this field would reasonably expect to work.
   *
   * **The URL comes from the sender, not the message.** The old check
   * trusted a `host` the content script reported about itself, under a
   * comment observing that a content script is the wrong place to keep a
   * privacy guarantee — which it is, and reading its self-report is the same
   * thing one step removed. `sender.url` is filled in by the browser.
   *
   * And it fails closed: if there is no URL to judge, nothing is sent.
   */
  'lookup-words': async (request, sender) => {
    const snapshot = await store.load();
    const settings = snapshot.settings;
    if (!settings.providers.enabled) {
      return { entries: [], fromCache: 0, fromProvider: 0, error: 'Providers are switched off.' };
    }

    const raw = sender?.url ?? sender?.tab?.url ?? '';
    let url: URL | null = null;
    try {
      url = raw ? new URL(raw) : null;
    } catch {
      url = null;
    }
    if (!url) {
      return {
        entries: [],
        fromCache: 0,
        fromProvider: 0,
        error: 'Could not identify the page, so nothing was sent.',
      };
    }

    const hit = settings.providers.neverSendHosts.find((pattern) => patternMatches(pattern, url));
    if (hit) {
      return {
        entries: [],
        fromCache: 0,
        fromProvider: 0,
        error: `${url.hostname} is on the never-send list (${hit}).`,
      };
    }
    return lookupMissing(request.words, settings.learning.sourceLang, request.target, settings);
  },
};

/** Shallow dotted-path apply, for the onboarding patch. */
function applyPatchShallow(base: Settings, patch: Record<string, unknown>): Partial<Settings> {
  const out = structuredClone(base) as unknown as Record<string, unknown>;
  for (const [path, value] of Object.entries(patch)) {
    const parts = path.split('.');
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i] as string;
      if (typeof cur[key] !== 'object' || cur[key] === null) cur[key] = {};
      cur = cur[key] as Record<string, unknown>;
    }
    cur[parts[parts.length - 1] as string] = value;
  }
  return out as unknown as Partial<Settings>;
}

/* ---------------------------------------------------------------- routing */

/**
 * The test build's scene-setter, and nobody else's.
 *
 * The e2e suite sets up every test's settings through one message. It was
 * `complete-onboarding`, which wrote whatever it was given; since that
 * judges every finish after the first, a spec that sets several scenes in
 * turn — Old English after French, a lower density after a higher one —
 * needs a write the lock does not judge. That is a capability a test build
 * has and a shipped one must not: `__WEFT_TEST__` is false in every other
 * build, so esbuild drops this branch and `configureForTest` with it.
 */
if (__WEFT_TEST__) Object.assign(handlers, { [CONFIGURE_FOR_TEST]: configureForTest });

async function configureForTest(request: { patch: Record<string, unknown> }): Promise<{ ok: true }> {
  const snapshot = await store.load();
  await store.saveSettings(
    validateSettings(
      { ...snapshot.settings, ...applyPatchShallow(snapshot.settings, request.patch), onboarded: true },
      Date.now(),
      snapshot.settings.installId,
    ),
  );
  await registerContentScripts();
  await broadcastSettingsChanged();
  return { ok: true };
}

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const request = message as Request;
  const handler = handlers[request.type] as
    | ((r: Request, s: chrome.runtime.MessageSender) => Promise<unknown>)
    | undefined;

  if (!handler) {
    sendResponse(fail(`Unknown request: ${String(request?.type)}`));
    return false;
  }

  handler(request, sender)
    .then((data) => sendResponse(ok(data)))
    .catch((err) => {
      console.error('[weft]', request.type, err);
      sendResponse(fail(err));
    });

  // Keeps the message channel open for the async reply.
  return true;
});

/* ----------------------------------------------------------- broadcasting */

async function broadcastToTabs(message: { type: string }): Promise<void> {
  try {
    const tabs = await api.tabs.query({});
    await Promise.all(
      tabs.map(async (tab) => {
        if (tab.id === undefined) return;
        try {
          await api.tabs.sendMessage(tab.id, message);
        } catch {
          // No content script in that tab. Expected and uninteresting.
        }
      }),
    );
  } catch {
    // tabs permission may be absent in a stripped build.
  }
}

async function broadcastSettingsChanged(): Promise<void> {
  store.invalidate();
  await broadcastToTabs({ type: 'weft-settings-changed' });
}

/* -------------------------------------------------- script registration */

/**
 * Register the content script for exactly the origins the user has granted.
 *
 * Weft asks for no host permissions at install time, so there is nothing to
 * run until the user names some sites. Registering dynamically is what turns
 * "read and change all your data on all websites" into a list the user chose,
 * and `persistAcrossSessions` means it survives the worker being killed and
 * the browser being restarted.
 */
async function registerContentScripts(): Promise<number> {
  const snapshot = await store.load();
  const settings = snapshot.settings;

  const perms = await api.permissions.getAll();
  const granted = perms.origins ?? [];
  if (!granted.length) {
    await unregister();
    return 0;
  }

  // Intersect what we may access with what the user actually wants woven, so
  // a leftover permission does not silently widen the extension's reach.
  // Compared by host: "http://localhost/*" and "*://localhost/*" name the
  // same site, and comparing the pattern strings registers nothing.
  const rules = [...settings.sites.taxed, ...settings.sites.gentle];
  const matches =
    settings.sites.mode === 'everywhere-except'
      ? granted
      : granted.filter((origin) => originCoversRules(origin, rules));

  const effective = matches.length ? matches : granted.includes('*://*/*') ? ['*://*/*'] : [];
  if (!effective.length) {
    await unregister();
    return 0;
  }

  await unregister();
  try {
    await api.scripting.registerContentScripts([
      {
        id: CONTENT_SCRIPT_ID,
        matches: effective,
        js: ['content.js'],
        runAt: 'document_idle',
        allFrames: false,
        persistAcrossSessions: true,
      },
    ]);
  } catch (err) {
    console.error('[weft] could not register content script', err);
    return 0;
  }
  return effective.length;
}

async function unregister(): Promise<void> {
  try {
    const existing = await api.scripting.getRegisteredContentScripts({ ids: [CONTENT_SCRIPT_ID] });
    if (existing.length) {
      await api.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
    }
  } catch {
    // Nothing registered.
  }
}

/* ------------------------------------------------------------- lifecycle */

api.runtime.onInstalled.addListener(async (details) => {
  await store.load();
  await api.alarms.create(LOCK_ALARM, { periodInMinutes: 1 });
  await api.alarms.create(FLUSH_ALARM, { periodInMinutes: 1 });
  await registerContentScripts();
  await setupContextMenus();

  if (details.reason === 'install') {
    await api.tabs.create({ url: api.runtime.getURL('onboarding.html') });
  }
});

api.runtime.onStartup.addListener(async () => {
  await api.alarms.create(LOCK_ALARM, { periodInMinutes: 1 });
  await api.alarms.create(FLUSH_ALARM, { periodInMinutes: 1 });
  await registerContentScripts();
  await setupContextMenus();
});

api.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === LOCK_ALARM) {
    const snapshot = await store.load();
    const result = applyReadyChanges(snapshot.lock, snapshot.settings, Date.now());
    if (result.applied.length) {
      await store.saveLock(result.state);
      await store.saveSettings(result.settings);
      await broadcastSettingsChanged();
      await registerContentScripts();
      await notify(
        'Weft',
        result.applied.length === 1
          ? `Applied: ${result.applied[0]?.summary ?? 'your change'}.`
          : `Applied ${result.applied.length} waiting changes.`,
      );
    }
    return;
  }
  if (alarm.name === FLUSH_ALARM) {
    await store.flushCards();
    return;
  }
  if (alarm.name === 'weft-panic-end') {
    await broadcastToTabs({ type: 'weft-resume' });
  }
});

api.permissions.onAdded.addListener(() => void registerContentScripts());
api.permissions.onRemoved.addListener(() => void registerContentScripts());

api.commands?.onCommand.addListener(async (command) => {
  if (command === 'weft-panic') {
    const snapshot = await store.load();
    const result = usePanicPass(snapshot.lock, snapshot.settings, Date.now());
    await store.saveLock(result.state);
    if (result.granted) await broadcastToTabs({ type: 'weft-suspend' });
    await notify('Weft', result.message);
    return;
  }
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return;
  try {
    await api.tabs.sendMessage(tab.id, { type: command });
  } catch {
    // No content script on this page.
  }
});

async function setupContextMenus(): Promise<void> {
  // Safari and Firefox name this namespace `menus`; Chrome names it
  // `contextMenus`. contextMenus() returns whichever one exists.
  const menus = contextMenus();
  if (!menus) return;
  try {
    await menus.removeAll();
    menus.create({
      id: 'weft-open-dashboard',
      title: 'Weft: progress',
      contexts: ['action'],
    });
    menus.create({
      id: 'weft-open-settings',
      title: 'Weft: settings',
      contexts: ['action'],
    });
  } catch {
    // Still defensive: a browser can expose the namespace and reject the
    // 'action' context, and a failed menu is not worth losing the worker for.
  }
}

contextMenus()?.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'weft-open-dashboard') {
    await api.tabs.create({ url: api.runtime.getURL('dashboard.html') });
  } else if (info.menuItemId === 'weft-open-settings') {
    await api.runtime.openOptionsPage();
  }
});

/**
 * Tell the reader something changed.
 *
 * Safari has never shipped `browser.notifications` — not "not yet", it is
 * marked unsupported outright — so on Safari this used to be a TypeError
 * swallowed by the catch: the message was simply lost, silently, on a whole
 * platform. Every notification Weft sends marks a state change the reader
 * asked for (a lock cleared, a panic pass spent), so losing it is not
 * cosmetic.
 *
 * The fallback marks the toolbar icon instead. It carries less information
 * than the notification did, which is the honest trade: a badge the reader
 * can see beats a notification that was never delivered.
 */
async function notify(title: string, message: string): Promise<void> {
  if (can.notify) {
    try {
      await api.notifications.create({
        type: 'basic',
        iconUrl: api.runtime.getURL('assets/icon-128.png'),
        title,
        message,
      });
      return;
    } catch {
      // Notifications can be denied at the OS level; fall through to the badge.
    }
  }

  if (!can.badge) return;
  try {
    await api.action.setBadgeText({ text: '!' });
    await api.action.setTitle({ title: `${title} — ${message}` });
  } catch {
    // Out of options, and the state change still happened regardless.
  }
}

/**
 * Take the badge back off, and restore the toolbar tooltip.
 *
 * Both halves matter. An uncleared badge is merely noise; an uncleared title
 * is worse, because `setTitle` replaces the tooltip outright, so the button
 * would go on describing a cooldown that finished days ago. Resetting to the
 * empty string restores the manifest's own default_title rather than
 * hardcoding the product name here, which would drift from _locales.
 */
async function clearBadge(): Promise<void> {
  if (!can.badge) return;
  try {
    await api.action.setBadgeText({ text: '' });
    await api.action.setTitle({ title: '' });
  } catch {
    // Nothing to do; a stale badge is not worth an unhandled rejection.
  }
}

export {};
