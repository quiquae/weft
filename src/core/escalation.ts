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
