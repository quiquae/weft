import type { SiteAttention } from './types.ts';

/**
 * The attention tax.
 *
 * Weft's central idea is that the proportion of a page rendered in the target
 * language is a function of how long you have been looking at that page. Five
 * minutes on a news article costs you almost nothing. Forty minutes on an
 * infinite feed and you are reading a third in French — a third because the
 * shipped default is the Standard preset, whose ceiling is 0.35. Half of the
 * page needs Committed or above.
 *
 * The curve is exponential-approach rather than linear:
 *
 *     ratio(m) = base + (ceiling - base) · (1 - e^(-k·m))
 *     k        = gainPerMinute / (ceiling - base)
 *
 * Three properties made this the right shape:
 *
 *  1. It cannot overshoot the ceiling, so no clamping discontinuity. A linear
 *     ramp hits the cap and stops dead, which reads as a bug.
 *  2. Its initial slope is exactly `gainPerMinute`, so the one knob a user
 *     touches means something concrete: "how fast does it bite at first".
 *  3. Diminishing returns match the intent. The tax should be sharp early —
 *     that is the nudge to close the tab — and then plateau, because a page
 *     that becomes unreadable teaches nothing.
 */

export interface RatioInputs {
  baseRatio: number;
  ceilingRatio: number;
  /** Ratio added per minute at m = 0. */
  gainPerMinute: number;
  attentionSeconds: number;
  /** When false, the site is "gentle": fixed at baseRatio. */
  escalate: boolean;
}

export function weaveRatio(i: RatioInputs): number {
  const base = clamp01(i.baseRatio);
  const ceiling = clamp01(i.ceilingRatio);
  if (!i.escalate) return base;
  const span = ceiling - base;
  if (span <= 0) return base;
  if (i.gainPerMinute <= 0) return base;

  const minutes = Math.max(0, i.attentionSeconds) / 60;
  const k = i.gainPerMinute / span;
  return clamp01(base + span * (1 - Math.exp(-k * minutes)));
}

/**
 * Minutes of attention needed to reach `ratio`. Returns Infinity when the
 * ratio is at or above the ceiling. Used by the popup to say "50% in 9 min".
 */
export function minutesToRatio(ratio: number, i: Omit<RatioInputs, 'attentionSeconds'>): number {
  const base = clamp01(i.baseRatio);
  const ceiling = clamp01(i.ceilingRatio);
  const target = clamp01(ratio);
  if (!i.escalate || i.gainPerMinute <= 0) return target <= base ? 0 : Infinity;
  const span = ceiling - base;
  if (span <= 0) return target <= base ? 0 : Infinity;
  if (target <= base) return 0;
  if (target >= ceiling) return Infinity;
  const k = i.gainPerMinute / span;
  return -Math.log(1 - (target - base) / span) / k;
}

/**
 * Attention decays while you are away, so stepping away for an hour genuinely
 * lowers the tax rather than merely pausing it. Without decay the extension
 * becomes a ratchet and the only way out is to uninstall it.
 */
export function decayAttention(
  seconds: number,
  hoursAway: number,
  decayPerHourAway: number,
): number {
  if (hoursAway <= 0 || decayPerHourAway <= 0) return seconds;
  const retained = Math.pow(Math.max(0, 1 - decayPerHourAway), hoursAway);
  const out = seconds * retained;
  return out < 1 ? 0 : out;
}

/* --------------------------------------------------------------- day keys */

/**
 * Local day key with a configurable rollover hour.
 *
 * Rollover defaults to 04:00 rather than midnight because the population that
 * needs this product is disproportionately awake at 02:00, and a counter that
 * resets mid-session is a counter that can be gamed by waiting.
 */
export function dayKey(ts: number, rolloverHour = 4): string {
  const d = new Date(ts);
  if (d.getHours() < rolloverHour) d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The day key `days` days after `key`, or before it for a negative `days`,
 * counted on the calendar.
 *
 * Never `dayKey(now - days * 86_400_000)`. A day is 25 hours long on the
 * night the clocks go back and 23 on the night they go forward, so stepping
 * by 24 hours lands twice in one day or skips one, at a 4 a.m. rollover for
 * an hour of every day the changed day is still in the span being stepped
 * through. A key names a date, and a date is stepped in UTC, where no day
 * has a change of the clocks.
 */
export function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export interface TickResult {
  attention: SiteAttention;
  /** True when the day rolled over during this tick. */
  rolled: boolean;
}

const MAX_HISTORY = 60;

/**
 * Record `deltaSeconds` of attention against a host, handling day rollover and
 * away-time decay. Pure: callers hand in `now`, which makes the whole
 * escalation model testable without faking timers.
 */
export function recordAttention(
  prev: SiteAttention | undefined,
  host: string,
  deltaSeconds: number,
  now: number,
  cfg: { rolloverHour: number; decayPerHourAway: number; dailyCapMinutes: number },
): TickResult {
  const today = dayKey(now, cfg.rolloverHour);
  const capSeconds = Math.max(0, cfg.dailyCapMinutes) * 60;

  if (!prev) {
    return {
      attention: {
        host,
        seconds: clampTo(deltaSeconds, capSeconds),
        lastTick: now,
        day: today,
        history: [],
      },
      rolled: false,
    };
  }

  if (prev.day !== today) {
    const history = [...prev.history, { day: prev.day, seconds: Math.round(prev.seconds) }].slice(
      -MAX_HISTORY,
    );
    return {
      attention: {
        host,
        seconds: clampTo(deltaSeconds, capSeconds),
        lastTick: now,
        day: today,
        history,
      },
      rolled: true,
    };
  }

  const hoursAway = Math.max(0, (now - prev.lastTick) / 3_600_000);
  // Only decay once a real gap has opened up; a one-second tick gap is not
  // "away", and applying decay to it would make the counter drift down while
  // the user is actively reading.
  const decayed = hoursAway >= 0.25 ? decayAttention(prev.seconds, hoursAway, cfg.decayPerHourAway) : prev.seconds;

  return {
    attention: {
      ...prev,
      host,
      seconds: clampTo(decayed + deltaSeconds, capSeconds),
      lastTick: now,
      day: today,
    },
    rolled: false,
  };
}

/** Attention as it stands right now, with away-decay applied but nothing added. */
export function currentAttentionSeconds(
  prev: SiteAttention | undefined,
  now: number,
  cfg: { rolloverHour: number; decayPerHourAway: number },
): number {
  if (!prev) return 0;
  if (prev.day !== dayKey(now, cfg.rolloverHour)) return 0;
  const hoursAway = Math.max(0, (now - prev.lastTick) / 3_600_000);
  if (hoursAway < 0.25) return prev.seconds;
  return decayAttention(prev.seconds, hoursAway, cfg.decayPerHourAway);
}

/**
 * Merge two machines' attention records, for an import.
 *
 * An export carries `attention` and the import used to discard it, so moving
 * machines silently cost a user their whole history, their streak and every
 * progress tile that reads from it.
 *
 * Restoring it is a merge, not a replace, and the direction is what makes it
 * safe to apply at once. `weaveRatio` is monotone increasing in attention, so
 * *more* attention is a harder page — and this merge can only ever add. An
 * import that carries less than this machine already has changes nothing, so
 * there is no way to spend an export file on an easier page. That is why
 * `attention` can come in where `lock` cannot: every field of the lock state
 * moves the other way.
 *
 * **Max per day, never sum.** `mergeCards` already gives the reason for
 * exposures and it is the same reason here: the same hour read on two
 * machines is not two hours, and summing would let a round trip through
 * export inflate the number every time it happened. Max also makes the
 * operation idempotent, which matters because nothing stops a user importing
 * the same file twice — and the dashboard calls this panel "facts about
 * reading you have actually done".
 *
 * Pure, and takes `now`, like everything else here.
 */
export function mergeAttention(
  mine: Record<string, SiteAttention>,
  theirs: Record<string, SiteAttention>,
  now: number,
): Record<string, SiteAttention> {
  const out: Record<string, SiteAttention> = { ...mine };

  for (const [host, incoming] of Object.entries(theirs)) {
    if (!incoming || typeof incoming !== 'object') continue;
    const current = out[host];
    out[host] = current ? mergeOneHost(current, incoming, host, now) : sanitiseSite(incoming, host, now);
  }

  return out;
}

/** Fold a record's current day and its history into one day -> seconds map. */
function daySeconds(site: SiteAttention, into: Map<string, number>): Map<string, number> {
  const add = (day: unknown, seconds: unknown) => {
    if (typeof day !== 'string' || !day) return;
    const s = typeof seconds === 'number' && Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
    into.set(day, Math.max(into.get(day) ?? 0, s));
  };
  add(site.day, site.seconds);
  for (const h of Array.isArray(site.history) ? site.history : []) add(h?.day, h?.seconds);
  return into;
}

/**
 * Rebuild a record from a day map.
 *
 * The later of the two current days stays current; the other machine's
 * current day is not lost, it becomes history, which is exactly what it is.
 * Day keys are `YYYY-MM-DD`, so a lexicographic compare is a date compare.
 */
function fromDays(days: Map<string, number>, host: string, day: string, lastTick: number): SiteAttention {
  const history = [...days.entries()]
    .filter(([d]) => d !== day)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([d, seconds]) => ({ day: d, seconds }))
    .slice(-MAX_HISTORY);
  return { host, seconds: days.get(day) ?? 0, lastTick, day, history };
}

function mergeOneHost(
  mine: SiteAttention,
  theirs: SiteAttention,
  host: string,
  now: number,
): SiteAttention {
  const days = daySeconds(theirs, daySeconds(mine, new Map()));
  const day = (theirs.day ?? '') > (mine.day ?? '') ? theirs.day : mine.day;
  return fromDays(days, mine.host || host, day, laterTick(mine.lastTick, theirs.lastTick, now));
}

function sanitiseSite(incoming: SiteAttention, host: string, now: number): SiteAttention {
  const days = daySeconds(incoming, new Map());
  return fromDays(days, incoming.host || host, incoming.day, laterTick(0, incoming.lastTick, now));
}

/**
 * The more recent tick wins, but never a future one.
 *
 * `lastTick` is what away-decay is measured from, so a tick in the future is
 * a record that never decays. Clamping to `now` costs a legitimate import
 * nothing and closes the one field here that could be edited into an
 * advantage.
 */
function laterTick(a: number, b: number, now: number): number {
  const best = Math.max(Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0);
  return Math.min(best, now);
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function clampTo(n: number, cap: number): number {
  const v = Math.max(0, n);
  return cap > 0 ? Math.min(v, cap) : v;
}

/** Human phrasing for the popup: "12 min today". */
export function formatDuration(seconds: number): string {
  const s = Math.round(Math.max(0, seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}
