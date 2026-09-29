import type { PanicState, PendingChange, PendingChangeKind, Settings } from './types.ts';
import { applyPatch, diffPaths, getPath, patchKey, setPath, type Patch } from './patch.ts';
import { dayKey } from './escalation.ts';

/**
 * The commitment layer.
 *
 * This is what separates Weft from a vocabulary toy. Anything that makes the
 * page *easier* is held behind a cooldown that survives restarts, and
 * optionally behind a quiz drawn from words you have already been shown. The
 * exit tax is itself the lesson, which is the only kind of friction that does
 * not simply breed resentment.
 *
 * Two design rules, both learned from how screen-time tools actually fail:
 *
 *  1. **Cancelling is always instant.** You can abandon a pending reduction at
 *     any time with no penalty. Friction on the way out of a commitment is
 *     coercion; friction on the way into an easier setting is a commitment.
 *
 *  2. **There is a panic valve.** A rate-limited "plain English for N minutes"
 *     pass exists because a tool with no escape hatch gets uninstalled the
 *     first time someone needs to read something urgently, and an uninstalled
 *     tool teaches nothing. The valve is logged, capped, and never silent.
 */

/** Every settings path the lock layer knows how to reason about. */
export const GOVERNED_PATHS: ReadonlyArray<{
  path: string;
  kind: PendingChangeKind;
  /** direction that makes the page easier */
  easier: 'lower' | 'higher' | 'false' | 'true' | 'shorter-list' | 'longer-list';
  label: string;
}> = Object.freeze([
  { path: 'weave.baseRatio', kind: 'reduce-difficulty', easier: 'lower', label: 'starting density' },
  { path: 'weave.ceilingRatio', kind: 'lower-ceiling', easier: 'lower', label: 'maximum density' },
  { path: 'weave.maxPerSentence', kind: 'reduce-difficulty', easier: 'lower', label: 'words per sentence' },
  { path: 'weave.minWordGap', kind: 'reduce-difficulty', easier: 'higher', label: 'spacing between woven words' },
  { path: 'weave.protectShortSentences', kind: 'reduce-difficulty', easier: 'higher', label: 'short-sentence protection' },
  { path: 'attention.enabled', kind: 'disable-all', easier: 'false', label: 'the attention tax' },
  { path: 'attention.gainPerMinute', kind: 'reduce-difficulty', easier: 'lower', label: 'how fast difficulty climbs' },
  { path: 'attention.dailyCapMinutes', kind: 'reduce-difficulty', easier: 'lower', label: 'daily attention cap' },
  { path: 'learning.level', kind: 'reduce-difficulty', easier: 'lower', label: 'your level' },
  { path: 'learning.minConfidence', kind: 'reduce-difficulty', easier: 'higher', label: 'confidence threshold' },
  { path: 'learning.introduceNewPerDay', kind: 'reduce-difficulty', easier: 'lower', label: 'new words per day' },
  { path: 'sites.taxed', kind: 'disable-site', easier: 'shorter-list', label: 'the taxed site list' },
  { path: 'sites.gentle', kind: 'disable-site', easier: 'shorter-list', label: 'the gentle site list' },
  { path: 'sites.excluded', kind: 'disable-site', easier: 'longer-list', label: 'the never-weave list' },
  { path: 'friction.cooldownMinutes', kind: 'reduce-friction', easier: 'lower', label: 'the cooldown itself' },
  { path: 'friction.requireQuizToUnlock', kind: 'reduce-friction', easier: 'false', label: 'the unlock quiz' },
  { path: 'friction.panicPassesPerDay', kind: 'reduce-friction', easier: 'higher', label: 'daily panic passes' },
  { path: 'friction.panicMinutes', kind: 'reduce-friction', easier: 'higher', label: 'panic pass length' },
  { path: 'friction.hardMode', kind: 'reduce-friction', easier: 'false', label: 'hard mode' },
  { path: 'learning.activeTarget', kind: 'change-target', easier: 'lower', label: 'your target language' },
]);

export type Direction = 'easier' | 'harder' | 'neutral';

/** Which way a single path change moves difficulty. */
export function directionOf(path: string, from: unknown, to: unknown): Direction {
  const rule = GOVERNED_PATHS.find((g) => g.path === path);
  if (!rule) return 'neutral';
  if (JSON.stringify(from) === JSON.stringify(to)) return 'neutral';

  switch (rule.easier) {
    case 'lower':
      if (typeof from === 'number' && typeof to === 'number') {
        return to < from ? 'easier' : 'harder';
      }
      // Non-numeric governed path (activeTarget): treat any change as neutral
      // in direction but still governed, handled by the caller.
      return 'neutral';
    case 'higher':
      if (typeof from === 'number' && typeof to === 'number') {
        return to > from ? 'easier' : 'harder';
      }
      return 'neutral';
    case 'false':
      return to === false ? 'easier' : 'harder';
    case 'true':
      return to === true ? 'easier' : 'harder';
    case 'shorter-list': {
      const a = Array.isArray(from) ? from.length : 0;
      const b = Array.isArray(to) ? to.length : 0;
      if (b < a) return 'easier';
      if (b > a) return 'harder';
      // Same length: a rule may have been disabled in place.
      const enabledA = countEnabled(from);
      const enabledB = countEnabled(to);
      if (enabledB < enabledA) return 'easier';
      if (enabledB > enabledA) return 'harder';
      return 'neutral';
    }
    case 'longer-list': {
      const a = Array.isArray(from) ? from.length : 0;
      const b = Array.isArray(to) ? to.length : 0;
      return b > a ? 'easier' : b < a ? 'harder' : 'neutral';
    }
    default:
      return 'neutral';
  }
}

function countEnabled(v: unknown): number {
  if (!Array.isArray(v)) return 0;
  return v.filter((x) => !x || typeof x !== 'object' || (x as { enabled?: boolean }).enabled !== false)
    .length;
}

export interface ChangeAssessment {
  direction: Direction;
  kind: PendingChangeKind;
  summary: string;
  /** Paths involved. */
  paths: string[];
}

/** Human summary of what a patch does, for the countdown UI and the audit log. */
export function assessPatch(current: Settings, patch: Patch): ChangeAssessment {
  const paths = Object.keys(patch);
  let direction: Direction = 'neutral';
  let kind: PendingChangeKind = 'reduce-difficulty';
  const parts: string[] = [];

  for (const path of paths) {
    const from = getPath(current, path);
    const to = patch[path];
    const d = directionOf(path, from, to);
    const rule = GOVERNED_PATHS.find((g) => g.path === path);

    if (rule) {
      if (d === 'easier') {
        direction = 'easier';
        kind = rule.kind;
      } else if (d === 'harder' && direction !== 'easier') {
        direction = 'harder';
      } else if (d === 'neutral' && rule.path === 'learning.activeTarget') {
        // Switching target language resets your vocabulary exposure, so it is
        // governed even though it is not strictly "easier".
        if (direction !== 'easier') {
          direction = 'easier';
          kind = 'change-target';
        }
      }
      parts.push(`${rule.label} → ${format(to)}`);
    }
  }

  if (!parts.length) parts.push('settings');
  return { direction, kind, summary: parts.join('; '), paths };
}

function format(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  if (typeof v === 'number') return v <= 1 && v > 0 && !Number.isInteger(v) ? `${Math.round(v * 100)}%` : String(v);
  if (Array.isArray(v)) return `${v.length} entr${v.length === 1 ? 'y' : 'ies'}`;
  return String(v);
}

/* --------------------------------------------------------------- lock state */

export type LogVia = 'immediate' | 'cooldown' | 'cancelled';

export interface LogEntry {
  at: number;
  summary: string;
  direction: Direction;
  via: LogVia;
}

export interface LockState {
  pending: PendingChange[];
  panic: PanicState;
  /** Count of detected state-tampering events. */
  tamperCount: number;
  lastTamperAt?: number;
  /** Set when tamper response has forced difficulty up for the current day. */
  penaltyUntil?: number;
  /**
   * Highest wall-clock time this install has observed.
   *
   * Signed along with the rest of the lock state, so it cannot simply be
   * edited back. See `noteClock`.
   */
  lastSeenAt?: number;
  /** Append-only audit of applied changes, newest last, capped. */
  log: LogEntry[];
}

const LOG_CAP = 200;

/**
 * Append to the audit log, capped.
 *
 * A helper rather than inline literals, because inline object literals in
 * spread position widen `via` and `direction` to `string` and the log type
 * stops being a useful contract.
 */
function appendLog(log: LogEntry[], entry: LogEntry): LogEntry[] {
  return [...log, entry].slice(-LOG_CAP);
}

export function emptyLockState(now: number): LockState {
  return {
    pending: [],
    panic: { day: dayKey(now), used: 0 },
    tamperCount: 0,
    log: [],
  };
}

export interface RequestResult {
  state: LockState;
  settings: Settings;
  /** Set when the change took effect immediately. */
  applied: boolean;
  /** Set when the change was queued. */
  pending?: PendingChange;
  /** Explanation for the UI. */
  message: string;
}

/**
 * Split an imported settings file into what may land now and what must wait.
 *
 * `importAll` used to write an imported settings object straight to storage,
 * while its own doc comment promised that "any reduction in difficulty
 * relative to the current state still has to pass the cooldown, because
 * settings are applied through the same lock path as any other change". It
 * did not go through that path at all, so an export file was a complete
 * bypass of every cooldown here: the one door the commitment layer exists to
 * hold shut had a second entrance next to it, and moving a single number in
 * a JSON file was enough to use it.
 *
 * The split applies the rule the rest of the product already follows rather
 * than inventing one. Anything harder lands at once, because that is what
 * happens everywhere else and holding it would be friction on the way *into*
 * a commitment. Anything easier becomes a patch for `requestChange`, which
 * queues it against the cooldown the user configured — an import is then
 * exactly as fast, and exactly as slow, as making the same change by hand on
 * the options page.
 *
 * Everything outside `GOVERNED_PATHS` is untouched. Themes, tooltip
 * contents and accessibility are not difficulty, and putting a contrast
 * setting behind a cooldown would be the kind of blanket friction that gets
 * a tool uninstalled.
 *
 * Direction comes from `assessPatch` rather than `directionOf`, which is the
 * difference that matters for `learning.activeTarget`: switching target
 * language scores `neutral` on direction but resets your vocabulary
 * exposure, and `assessPatch` is the one that already knows to treat it as
 * easier.
 */
export function splitImportedSettings(
  current: Settings,
  incoming: Settings,
): { immediate: Settings; deferred: Patch } {
  const deferred: Patch = {};
  let immediate = incoming;

  for (const path of diffPaths(current, incoming, GOVERNED_PATHS.map((g) => g.path))) {
    const to = getPath(incoming, path);
    if (assessPatch(current, { [path]: to }).direction !== 'easier') continue;
    deferred[path] = to;
    // Held back means held back: the machine keeps the value it has until
    // the cooldown says otherwise.
    immediate = setPath(immediate, path, getPath(current, path));
  }

  return { immediate, deferred };
}

/**
 * Request a settings change.
 *
 * Changes that make the page harder (or that are difficulty-neutral) apply at
 * once. Changes that make it easier are queued with a cooldown that is stored,
 * not merely scheduled — closing the browser does not cancel it and does not
 * restart it.
 */
export function requestChange(
  state: LockState,
  settings: Settings,
  patch: Patch,
  now: number,
  idGen: () => string,
): RequestResult {
  const assessment = assessPatch(settings, patch);

  if (assessment.direction !== 'easier') {
    return {
      state: {
        ...state,
        log: appendLog(state.log, {
          at: now,
          summary: assessment.summary,
          direction: assessment.direction,
          via: 'immediate',
        }),
      },
      settings: applyPatch(settings, patch),
      applied: true,
      message: 'Applied.',
    };
  }

  const key = patchKey(patch);
  const existing = state.pending.find((p) => patchKey(p.patch) === key);
  if (existing) {
    // Re-requesting must never restart the clock in the user's favour, and
    // must never restart it against them either.
    return {
      state,
      settings,
      applied: false,
      pending: existing,
      message: `Already waiting. Unlocks ${describeWait(existing.unlocksAt - now)}.`,
    };
  }

  const cooldownMs = Math.max(0, settings.friction.cooldownMinutes) * 60_000;
  const change: PendingChange = {
    id: idGen(),
    kind: assessment.kind,
    patch,
    requestedAt: now,
    unlocksAt: now + cooldownMs,
    summary: assessment.summary,
  };

  if (cooldownMs === 0 && !settings.friction.requireQuizToUnlock) {
    return {
      state: {
        ...state,
        log: appendLog(state.log, {
          at: now,
          summary: assessment.summary,
          direction: 'easier',
          via: 'immediate',
        }),
      },
      settings: applyPatch(settings, patch),
      applied: true,
      message: 'Applied. (No cooldown is configured.)',
    };
  }

  return {
    state: { ...state, pending: [...state.pending, change] },
    settings,
    applied: false,
    pending: change,
    message: settings.friction.requireQuizToUnlock
      ? `Queued. Unlocks ${describeWait(cooldownMs)}, once you have passed the vocabulary check.`
      : `Queued. Unlocks ${describeWait(cooldownMs)}.`,
  };
}

/** Cancelling a queued change is always immediate and free. */
export function cancelPending(state: LockState, id: string, now: number): LockState {
  const change = state.pending.find((p) => p.id === id);
  return {
    ...state,
    pending: state.pending.filter((p) => p.id !== id),
    log: change
      ? appendLog(state.log, {
          at: now,
          summary: change.summary,
          direction: 'easier',
          via: 'cancelled',
        })
      : state.log,
  };
}

export function markQuizPassed(state: LockState, id: string, now: number): LockState {
  return {
    ...state,
    pending: state.pending.map((p) => (p.id === id ? { ...p, quizPassedAt: now } : p)),
  };
}

export function isReady(change: PendingChange, settings: Settings, now: number): boolean {
  if (now < change.unlocksAt) return false;
  if (settings.friction.requireQuizToUnlock && !change.quizPassedAt) return false;
  return true;
}

export interface ApplyResult {
  state: LockState;
  settings: Settings;
  applied: PendingChange[];
}

/** Apply every queued change whose cooldown (and quiz gate) has elapsed. */
export function applyReadyChanges(
  state: LockState,
  settings: Settings,
  now: number,
): ApplyResult {
  const ready = state.pending.filter((p) => isReady(p, settings, now));
  if (!ready.length) return { state, settings, applied: [] };

  let next = settings;
  let log = state.log;
  for (const change of ready) {
    next = applyPatch(next, change.patch);
    log = appendLog(log, {
      at: now,
      summary: change.summary,
      direction: 'easier',
      via: 'cooldown',
    });
  }

  return {
    state: {
      ...state,
      pending: state.pending.filter((p) => !ready.includes(p)),
      log,
    },
    settings: next,
    applied: ready,
  };
}

export function describeWait(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m === 0) return 'now';
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 24) return rem ? `in ${h}h ${rem}m` : `in ${h}h`;
  const d = Math.floor(h / 24);
  return `in ${d} day${d === 1 ? '' : 's'}`;
}

/* -------------------------------------------------------------------- panic */

export interface PanicResult {
  state: LockState;
  granted: boolean;
  activeUntil?: number;
  message: string;
}

export function usePanicPass(state: LockState, settings: Settings, now: number): PanicResult {
  const today = dayKey(now, settings.attention.rolloverHour);
  const panic: PanicState = state.panic.day === today ? state.panic : { day: today, used: 0 };

  if (panic.activeUntil && panic.activeUntil > now) {
    return {
      state: { ...state, panic },
      granted: true,
      activeUntil: panic.activeUntil,
      message: 'A pass is already running.',
    };
  }

  if (panic.used >= settings.friction.panicPassesPerDay) {
    return {
      state: { ...state, panic },
      granted: false,
      message:
        settings.friction.panicPassesPerDay === 0
          ? 'Panic passes are switched off in your settings.'
          : `You have used all ${settings.friction.panicPassesPerDay} passes today. They reset at ${settings.attention.rolloverHour}:00.`,
    };
  }

  const activeUntil = now + Math.max(1, settings.friction.panicMinutes) * 60_000;
  return {
    state: {
      ...state,
      panic: { day: today, used: panic.used + 1, activeUntil },
      log: appendLog(state.log, {
        at: now,
        summary: `panic pass (${settings.friction.panicMinutes} min)`,
        direction: 'easier',
        via: 'immediate',
      }),
    },
    granted: true,
    activeUntil,
    message: `Plain English for ${settings.friction.panicMinutes} minutes. ${settings.friction.panicPassesPerDay - panic.used - 1} pass${settings.friction.panicPassesPerDay - panic.used - 1 === 1 ? '' : 'es'} left today.`,
  };
}

export function panicActive(state: LockState, now: number): boolean {
  return Boolean(state.panic.activeUntil && state.panic.activeUntil > now);
}

/* ------------------------------------------------------------------ tamper */

/**
 * Response to detected tampering with stored state.
 *
 * Deliberately escalates rather than resets. A learner who edits storage to
 * lower the ratio finds it pinned at the ceiling for the rest of the day; the
 * incentive to try is therefore negative. This is friction, not security — the
 * signing key ships inside the extension and a determined user can forge it.
 * docs/PRIVACY.md says so in plain words rather than implying otherwise.
 */
export function recordTamper(
  state: LockState,
  settings: Settings,
  now: number,
  summary = 'stored state failed its integrity check',
): LockState {
  if (settings.friction.tamperResponse === 'ignore') {
    return { ...state, tamperCount: state.tamperCount + 1, lastTamperAt: now };
  }
  const endOfDayPenalty = now + 12 * 3_600_000;
  return {
    ...state,
    tamperCount: state.tamperCount + 1,
    lastTamperAt: now,
    penaltyUntil: Math.max(state.penaltyUntil ?? 0, endOfDayPenalty),
    log: appendLog(state.log, {
      at: now,
      summary,
      direction: 'harder',
      via: 'immediate',
    }),
  };
}

/**
 * Small clock corrections that are not evidence of anything.
 *
 * NTP adjustments are sub-second and suspend/resume can skew a little, so
 * the threshold is generous. It only has to be tight enough that winding the
 * clock far enough to clear a cooldown cannot hide under it, and the shortest
 * cooldown Weft offers is far longer than two minutes.
 */
export const CLOCK_TOLERANCE_MS = 120_000;

export interface ClockNote {
  state: LockState;
  /** True when the wall clock moved backwards by more than the tolerance. */
  rewound: boolean;
}

/**
 * Notice the wall clock moving backwards.
 *
 * A cooldown is judged by comparing `Date.now()` against a stored
 * `unlocksAt`, so winding the system clock forward clears any pending change
 * instantly. That cannot be detected offline: a clock that reads a week
 * later is indistinguishable from a browser that was closed for a week, and
 * telling them apart needs a trusted time source — that is, a network
 * request, which is the one thing this product promises never to make.
 *
 * Requiring observed ticks instead is not available either. Weft
 * deliberately promises that closing the browser neither cancels a wait nor
 * restarts it, and an elapsed-ticks cooldown would break exactly that.
 *
 * What *is* detectable is the return trip. Defeating a cooldown this way is
 * two moves, not one: forward to unlock, then back to the real time, because
 * leaving the machine a week in the future breaks mail, calendars and TLS.
 * Time never legitimately runs backwards by minutes, so the second move is
 * unambiguous. The attack is invisible; its footprint is not.
 *
 * A genuinely wrong clock being corrected backwards trips this too, which is
 * why the response is whatever the user chose for tampering — and why
 * 'ignore' exists.
 */
export function noteClock(state: LockState, settings: Settings, now: number): ClockNote {
  const last = state.lastSeenAt ?? 0;
  const rewound = last > 0 && now < last - CLOCK_TOLERANCE_MS;

  if (rewound) {
    /*
     * Baseline resets to the new time rather than keeping the high-water
     * mark. Keeping it would mean a single jump a year into the future left
     * every subsequent wake for a year reporting a rewind — one act,
     * penalised hundreds of times. Accepting the corrected time records the
     * event once and leaves a repeat attempt just as detectable as the
     * first.
     */
    const penalised = recordTamper(state, settings, now, 'the clock moved backwards');
    return { state: { ...penalised, lastSeenAt: now }, rewound: true };
  }

  return { state: { ...state, lastSeenAt: Math.max(last, now) }, rewound: false };
}

export function penaltyActive(state: LockState, now: number): boolean {
  return Boolean(state.penaltyUntil && state.penaltyUntil > now);
}
