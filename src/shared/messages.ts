import type {
  Grade,
  LangCode,
  LexEntry,
  LexPack,
  Pos,
  MemoryCard,
  PendingChange,
  Settings,
  SiteAttention,
} from '../core/types.ts';
import type { LockState } from '../core/lock.ts';
import type { SiteDecision } from '../core/sites.ts';
import type { QuizQuestion, QuizResult } from '../core/quiz.ts';
import type { LicenceStatus } from '../core/licence.ts';
import type { LookupDay } from '../core/lookups.ts';
import type { Feature, Tier } from '../core/entitlements.ts';

/**
 * The message protocol between content scripts, UI pages and the service
 * worker.
 *
 * Typed as a discriminated union with a matching response type per request, so
 * a handler that forgets a case is a compile error rather than a page that
 * silently stops weaving. MV3 service workers are killed aggressively, so
 * every request must be idempotent and must tolerate a cold start.
 */

export interface PageState {
  /** Clamped to the current tier. */
  settings: Settings;
  tier: Tier;
  decision: SiteDecision;
  /** Effective weave ratio right now, after attention and panic. */
  ratio: number;
  /** Attention seconds accumulated against this site today. */
  attentionSeconds: number;
  /** Cards for the active target language, keyed by `${target}:${lemma}`. */
  cards: Record<string, MemoryCard>;
  /** Lemmas introduced today, across all sites. */
  introducedToday: string[];
  /** True while a panic pass is running: the page stays in plain English. */
  panicActive: boolean;
  /** Effective level after progression. */
  effectiveLevel: number;
  /** True when a tamper penalty is pinning difficulty to the ceiling. */
  penaltyActive: boolean;
}

/**
 * The e2e harness's way to set a scene: settings written as they come, past
 * the lock, as `complete-onboarding` wrote them every time until 2026-11-08.
 * Only a test build's worker answers it; every other build compiles the
 * handler out, and `tools/validate-package.mjs` refuses a package that
 * carries this name. It is not in `Request`, so no page can send it.
 */
export const CONFIGURE_FOR_TEST = 'configure-for-test';

export type Request =
  | { type: 'get-page-state'; url: string }
  | { type: 'get-pack'; source: LangCode; target: LangCode }
  | { type: 'record-attention'; host: string; seconds: number; url: string }
  | { type: 'record-exposure'; target: LangCode; lemmas: string[] }
  | { type: 'record-reveal'; target: LangCode; lemma: string }
  | { type: 'record-grade'; target: LangCode; lemma: string; grade: Grade }
  | { type: 'get-settings' }
  | { type: 'request-change'; patch: Record<string, unknown> }
  | { type: 'cancel-pending'; id: string }
  | { type: 'get-lock-state' }
  | { type: 'use-panic' }
  | { type: 'build-quiz'; changeId: string }
  | { type: 'submit-quiz'; changeId: string; results: QuizResult[] }
  | { type: 'get-stats' }
  | { type: 'get-cards'; target?: LangCode }
  | { type: 'grant-origins'; origins: string[] }
  | { type: 'get-granted-origins' }
  | { type: 'reregister-scripts' }
  | { type: 'complete-onboarding'; patch: Record<string, unknown>; origins: string[] }
  | { type: 'export-data' }
  | { type: 'import-data'; payload: unknown }
  | { type: 'reset-vocabulary'; confirm: 'yes' }
  | { type: 'hard-mode-profile'; platform: 'macos' | 'windows' | 'linux' }
  | { type: 'get-licence' }
  | { type: 'set-licence'; key: string }
  | { type: 'clear-licence' }
  | {
      type: 'lookup-words';
      target: LangCode;
      words: Array<{ word: string; pos: Pos; num?: 'sg' | 'pl'; context?: string }>;
    };

export interface ResponseMap {
  'get-page-state': PageState;
  'get-pack': { pack: LexPack | null; error?: string };
  'record-attention': { ratio: number; attentionSeconds: number; panicActive: boolean };
  'record-exposure': { ok: true };
  'record-reveal': { ok: true };
  'record-grade': { card: MemoryCard };
  'get-settings': { settings: Settings; tier: Tier };
  'request-change': {
    applied: boolean;
    pending?: PendingChange;
    message: string;
    /** Set when the change was refused because it needs Pro. */
    needsPro?: Feature;
  };
  'cancel-pending': { ok: true };
  'get-lock-state': {
    lock: LockState;
    /** Clamped to the tier. */
    settings: Settings;
    tier: Tier;
    licence: LicenceStatus;
    /** Features the stored settings ask for but the tier does not allow. */
    exceeds: Feature[];
  };
  'use-panic': { granted: boolean; activeUntil?: number; message: string };
  'build-quiz': { questions: QuizQuestion[]; error?: string };
  'submit-quiz': { passed: boolean; score: number; message: string };
  'get-stats': {
    tier: Tier;
    network: { requests: number; words: number; last?: number; hosts: string[]; today?: LookupDay };
    settings: Settings;
    cards: MemoryCard[];
    attention: SiteAttention[];
    lock: LockState;
  };
  'get-cards': { cards: MemoryCard[] };
  'grant-origins': { granted: boolean };
  'get-granted-origins': { origins: string[] };
  'reregister-scripts': { ok: true; registered: number };
  /** `queued` counts the paths that made Weft easier and wait out the cooldown. */
  'complete-onboarding': { ok: true; granted: boolean; queued: number };
  'export-data': { payload: unknown };
  'import-data': { ok: boolean; message: string };
  'reset-vocabulary': { ok: true };
  'hard-mode-profile': { filename: string; contents: string; instructions: string };
  'lookup-words': { entries: LexEntry[]; fromCache: number; fromProvider: number; error?: string };
  'get-licence': { licence: LicenceStatus; tier: Tier; exceeds: Feature[] };
  'set-licence': { licence: LicenceStatus; tier: Tier; message: string };
  'clear-licence': { ok: true };
}

export type ResponseFor<T extends Request['type']> = ResponseMap[T];

/** Errors are returned rather than thrown, so a dead worker cannot break a page. */
export type Envelope<T> = { ok: true; data: T } | { ok: false; error: string };
