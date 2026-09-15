import type { LangCode, LetterformId, Pos, Settings, SiteRule } from './types.ts';
import { DEFAULT_EXCLUSIONS, SITE_PRESETS } from './sites.ts';
import { isKnownLanguage } from './languages.ts';

export const SCHEMA_VERSION = 1;

/**
 * Parts of speech woven by default.
 *
 * Function words are excluded, and that is the single most important default in
 * the product. Replacing "the", "of" and "and" destroys the grammatical
 * scaffolding the reader is using to decode everything else, for almost no
 * vocabulary gain — those words are learned in week one of any course anyway.
 * Content words are where comprehensible input lives.
 */
export const DEFAULT_POS: Pos[] = ['noun', 'adj', 'verb', 'adv', 'num', 'intj'];

const ALL_LETTERFORMS: LetterformId[] = ['macrons', 'thorn', 'eth', 'ash', 'wynn', 'yogh', 'longS'];

function defaultLetterforms(): Record<LetterformId, boolean> {
  // Macrons on (they teach vowel length, which matters), exotic letterforms
  // off until the learner asks for them.
  const out = {} as Record<LetterformId, boolean>;
  for (const id of ALL_LETTERFORMS) out[id] = id === 'macrons';
  return out;
}

export interface DifficultyPreset {
  id: string;
  label: string;
  tagline: string;
  detail: string;
  patch: Record<string, unknown>;
}

/**
 * Difficulty presets. These exist because the space of knobs below is genuinely
 * large and nobody should have to tour it to get started — but every knob stays
 * reachable, because "professional and customizable" means not hiding the
 * machine from the people who want it.
 */
export const DIFFICULTY_PRESETS: DifficultyPreset[] = [
  {
    id: 'taster',
    label: 'Taster',
    tagline: 'A few words, no pressure',
    detail:
      'About 1 word in 30 to start, rising slowly to 1 in 8. Five-minute cooldown, three panic passes a day. Use this for a week to find out whether you like the feeling.',
    patch: {
      'weave.baseRatio': 0.03,
      'weave.ceilingRatio': 0.12,
      'attention.gainPerMinute': 0.01,
      'friction.cooldownMinutes': 5,
      'friction.requireQuizToUnlock': false,
      'friction.panicPassesPerDay': 3,
      'friction.panicMinutes': 10,
    },
  },
  {
    id: 'standard',
    label: 'Standard',
    tagline: 'Noticeable, still readable',
    detail:
      'Starts around 1 word in 16 and climbs towards a third of the content words after half an hour on a feed. Fifteen-minute cooldown on anything that makes it easier.',
    patch: {
      'weave.baseRatio': 0.06,
      'weave.ceilingRatio': 0.35,
      'attention.gainPerMinute': 0.02,
      'friction.cooldownMinutes': 15,
      'friction.requireQuizToUnlock': false,
      'friction.panicPassesPerDay': 2,
      'friction.panicMinutes': 5,
    },
  },
  {
    id: 'committed',
    label: 'Committed',
    tagline: 'The feed costs you something',
    detail:
      'Ten percent at rest, up to 55% after a long scroll. An hour of cooldown, and you must clear a short vocabulary check from words you have already seen before anything gets easier.',
    patch: {
      'weave.baseRatio': 0.1,
      'weave.ceilingRatio': 0.55,
      'attention.gainPerMinute': 0.035,
      'friction.cooldownMinutes': 60,
      'friction.requireQuizToUnlock': true,
      'friction.quizWordCount': 8,
      'friction.panicPassesPerDay': 1,
      'friction.panicMinutes': 5,
    },
  },
  {
    id: 'monastic',
    label: 'Monastic',
    tagline: 'You asked for this',
    detail:
      'Fifteen percent at rest, three quarters at the ceiling, a twelve-hour cooldown and no panic passes. Pair with Hard Mode if you want the extension itself to be unremovable without an administrator.',
    patch: {
      'weave.baseRatio': 0.15,
      'weave.ceilingRatio': 0.75,
      'attention.gainPerMinute': 0.06,
      'friction.cooldownMinutes': 720,
      'friction.requireQuizToUnlock': true,
      'friction.quizWordCount': 12,
      'friction.panicPassesPerDay': 0,
      'friction.panicMinutes': 3,
    },
  },
];

export function defaultSettings(now: number, installId: string): Settings {
  const social = SITE_PRESETS.find((p) => p.id === 'social');
  const taxed: SiteRule[] = (social?.patterns ?? []).map((pattern) => ({
    pattern,
    enabled: true,
    escalate: true,
    origin: 'preset' as const,
  }));

  return {
    schemaVersion: SCHEMA_VERSION,
    installId,
    onboarded: false,
    createdAt: now,

    learning: {
      sourceLang: 'en',
      targetLangs: ['fr'],
      activeTarget: 'fr',
      level: 1,
      posPreference: [...DEFAULT_POS],
      minConfidence: 0.7,
      maxSenses: 4,
      cognateWeight: 1.4,
      frequencyWeight: 1.0,
      dueWeight: 1.2,
      retireKnownWords: true,
      retireStabilityDays: 21,
      introduceNewPerDay: 12,
      phrasesEnabled: false,
    },

    weave: {
      baseRatio: 0.06,
      ceilingRatio: 0.35,
      minWordGap: 2,
      maxPerSentence: 3,
      protectShortSentences: 4,
      renderMode: 'auto',
      style: {
        underline: 'dotted',
        tint: '#7c5cff',
        tintOpacity: 0.12,
        weight: 'inherit',
        italic: false,
      },
      letterforms: defaultLetterforms(),
    },

    attention: {
      enabled: true,
      gainPerMinute: 0.02,
      decayPerHourAway: 0.35,
      dailyReset: true,
      rolloverHour: 4,
      idleThresholdSec: 45,
      dailyCapMinutes: 240,
    },

    sites: {
      mode: 'taxed-only',
      taxed,
      gentle: [],
      excluded: [...DEFAULT_EXCLUSIONS],
    },

    friction: {
      cooldownMinutes: 15,
      requireQuizToUnlock: false,
      quizWordCount: 6,
      quizPassThreshold: 0.75,
      panicPassesPerDay: 2,
      panicMinutes: 5,
      tamperResponse: 'escalate',
      hardMode: false,
      confirmIncreases: false,
    },

    reveal: {
      trigger: 'both',
      hoverDelayMs: 220,
      holdToReveal: true,
      showPos: true,
      showGender: true,
      showIpa: true,
      showEtymon: true,
      showExample: true,
      showBand: false,
      tts: true,
      grading: 'auto',
    },

    a11y: {
      respectReducedMotion: true,
      keyboardCursor: true,
      highContrast: false,
      announceSwaps: false,
      preferWrappedForAT: false,
      minTooltipFontPx: 13,
    },

    providers: {
      enabled: false,
      order: ['deepl', 'google', 'openai'],
      deepl: { key: '', free: true },
      google: { key: '' },
      openai: { baseUrl: 'https://api.openai.com/v1', key: '', model: 'gpt-4o-mini' },
      cacheDays: 90,
      neverSendHosts: [...DEFAULT_EXCLUSIONS],
      sendContext: false,
      dailyLookupCap: 2000,
    },

    privacy: {
      telemetry: false,
      syncSettings: false,
    },
  };
}

/* ------------------------------------------------------------- validation */

const clampNum = (v: unknown, lo: number, hi: number, dflt: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : dflt;
  return Math.min(hi, Math.max(lo, n));
};

const bool = (v: unknown, dflt: boolean): boolean => (typeof v === 'boolean' ? v : dflt);

/**
 * Clamp and repair settings read from storage.
 *
 * Runs on every load, not only on migration. Storage can contain anything: a
 * half-finished migration, a hand-edited value, a field from a newer version
 * the user downgraded from. The content script must never be handed a ratio of
 * 40 or a negative cooldown, so this is the single choke point where settings
 * become trustworthy.
 */
export function validateSettings(raw: unknown, now: number, installId: string): Settings {
  const d = defaultSettings(now, installId);
  if (!raw || typeof raw !== 'object') return d;
  const s = raw as Partial<Settings>;

  const learning = { ...d.learning, ...(s.learning ?? {}) };
  const weave = { ...d.weave, ...(s.weave ?? {}) };
  const attention = { ...d.attention, ...(s.attention ?? {}) };
  const sites = { ...d.sites, ...(s.sites ?? {}) };
  const friction = { ...d.friction, ...(s.friction ?? {}) };
  const reveal = { ...d.reveal, ...(s.reveal ?? {}) };
  const a11y = { ...d.a11y, ...(s.a11y ?? {}) };
  const providers = { ...d.providers, ...(s.providers ?? {}) };

  const targetLangs = (Array.isArray(learning.targetLangs) ? learning.targetLangs : d.learning.targetLangs)
    .filter((c): c is LangCode => typeof c === 'string' && isKnownLanguage(c) && c !== 'en');
  const uniqueTargets = [...new Set(targetLangs)];
  const finalTargets = uniqueTargets.length ? uniqueTargets : d.learning.targetLangs;
  const activeTarget =
    typeof learning.activeTarget === 'string' && finalTargets.includes(learning.activeTarget)
      ? learning.activeTarget
      : (finalTargets[0] as LangCode);

  const posPreference = (Array.isArray(learning.posPreference) ? learning.posPreference : DEFAULT_POS)
    .filter((p): p is Pos => typeof p === 'string');

  const baseRatio = clampNum(weave.baseRatio, 0, 1, d.weave.baseRatio);
  const ceilingRatio = Math.max(baseRatio, clampNum(weave.ceilingRatio, 0, 1, d.weave.ceilingRatio));

  const letterforms = { ...defaultLetterforms(), ...(weave.letterforms ?? {}) } as Record<
    LetterformId,
    boolean
  >;

  return {
    schemaVersion: SCHEMA_VERSION,
    installId: typeof s.installId === 'string' && s.installId ? s.installId : installId,
    onboarded: bool(s.onboarded, false),
    createdAt: typeof s.createdAt === 'number' ? s.createdAt : now,

    learning: {
      sourceLang: isKnownLanguage(String(learning.sourceLang)) ? learning.sourceLang : 'en',
      targetLangs: finalTargets,
      activeTarget,
      level: Math.round(clampNum(learning.level, 1, 6, d.learning.level)),
      posPreference: posPreference.length ? posPreference : [...DEFAULT_POS],
      minConfidence: clampNum(learning.minConfidence, 0, 1, d.learning.minConfidence),
      maxSenses: Math.round(clampNum(learning.maxSenses, 1, 50, d.learning.maxSenses)),
      cognateWeight: clampNum(learning.cognateWeight, 0, 5, d.learning.cognateWeight),
      frequencyWeight: clampNum(learning.frequencyWeight, 0, 5, d.learning.frequencyWeight),
      dueWeight: clampNum(learning.dueWeight, 0, 5, d.learning.dueWeight),
      retireKnownWords: bool(learning.retireKnownWords, true),
      retireStabilityDays: clampNum(learning.retireStabilityDays, 1, 3650, d.learning.retireStabilityDays),
      introduceNewPerDay: Math.round(clampNum(learning.introduceNewPerDay, 0, 500, d.learning.introduceNewPerDay)),
      phrasesEnabled: bool(learning.phrasesEnabled, false),
    },

    weave: {
      baseRatio,
      ceilingRatio,
      minWordGap: Math.round(clampNum(weave.minWordGap, 0, 20, d.weave.minWordGap)),
      maxPerSentence: Math.round(clampNum(weave.maxPerSentence, 1, 20, d.weave.maxPerSentence)),
      protectShortSentences: Math.round(
        clampNum(weave.protectShortSentences, 0, 40, d.weave.protectShortSentences),
      ),
      renderMode: ['auto', 'highlight', 'wrapped'].includes(String(weave.renderMode))
        ? weave.renderMode
        : 'auto',
      style: {
        underline: ['dotted', 'dashed', 'solid', 'none'].includes(String(weave.style?.underline))
          ? weave.style.underline
          : 'dotted',
        tint: /^#[0-9a-f]{6}$/i.test(String(weave.style?.tint)) ? weave.style.tint : d.weave.style.tint,
        tintOpacity: clampNum(weave.style?.tintOpacity, 0, 1, d.weave.style.tintOpacity),
        weight: ['inherit', '500', '600'].includes(String(weave.style?.weight))
          ? weave.style.weight
          : 'inherit',
        italic: bool(weave.style?.italic, false),
      },
      letterforms,
    },

    attention: {
      enabled: bool(attention.enabled, true),
      gainPerMinute: clampNum(attention.gainPerMinute, 0, 1, d.attention.gainPerMinute),
      decayPerHourAway: clampNum(attention.decayPerHourAway, 0, 1, d.attention.decayPerHourAway),
      dailyReset: bool(attention.dailyReset, true),
      rolloverHour: Math.round(clampNum(attention.rolloverHour, 0, 23, d.attention.rolloverHour)),
      idleThresholdSec: Math.round(clampNum(attention.idleThresholdSec, 5, 3600, d.attention.idleThresholdSec)),
      dailyCapMinutes: Math.round(clampNum(attention.dailyCapMinutes, 1, 1440, d.attention.dailyCapMinutes)),
    },

    sites: {
      mode: sites.mode === 'everywhere-except' ? 'everywhere-except' : 'taxed-only',
      taxed: normalizeRules(sites.taxed, true),
      gentle: normalizeRules(sites.gentle, false),
      excluded: normalizePatterns(sites.excluded),
    },

    friction: {
      cooldownMinutes: clampNum(friction.cooldownMinutes, 0, 10080, d.friction.cooldownMinutes),
      requireQuizToUnlock: bool(friction.requireQuizToUnlock, false),
      quizWordCount: Math.round(clampNum(friction.quizWordCount, 1, 50, d.friction.quizWordCount)),
      quizPassThreshold: clampNum(friction.quizPassThreshold, 0.1, 1, d.friction.quizPassThreshold),
      panicPassesPerDay: Math.round(clampNum(friction.panicPassesPerDay, 0, 50, d.friction.panicPassesPerDay)),
      panicMinutes: clampNum(friction.panicMinutes, 1, 240, d.friction.panicMinutes),
      tamperResponse: friction.tamperResponse === 'ignore' ? 'ignore' : 'escalate',
      hardMode: bool(friction.hardMode, false),
      confirmIncreases: bool(friction.confirmIncreases, false),
    },

    reveal: {
      trigger: ['hover', 'click', 'both'].includes(String(reveal.trigger)) ? reveal.trigger : 'both',
      hoverDelayMs: Math.round(clampNum(reveal.hoverDelayMs, 0, 3000, d.reveal.hoverDelayMs)),
      holdToReveal: bool(reveal.holdToReveal, true),
      showPos: bool(reveal.showPos, true),
      showGender: bool(reveal.showGender, true),
      showIpa: bool(reveal.showIpa, true),
      showEtymon: bool(reveal.showEtymon, true),
      showExample: bool(reveal.showExample, true),
      showBand: bool(reveal.showBand, false),
      tts: bool(reveal.tts, true),
      grading: ['auto', 'manual', 'off'].includes(String(reveal.grading)) ? reveal.grading : 'auto',
    },

    a11y: {
      respectReducedMotion: bool(a11y.respectReducedMotion, true),
      keyboardCursor: bool(a11y.keyboardCursor, true),
      highContrast: bool(a11y.highContrast, false),
      announceSwaps: bool(a11y.announceSwaps, false),
      preferWrappedForAT: bool(a11y.preferWrappedForAT, false),
      minTooltipFontPx: Math.round(clampNum(a11y.minTooltipFontPx, 10, 28, d.a11y.minTooltipFontPx)),
    },

    providers: {
      enabled: bool(providers.enabled, false),
      order: (Array.isArray(providers.order) ? providers.order : d.providers.order).filter((p) =>
        ['deepl', 'google', 'openai'].includes(String(p)),
      ) as Settings['providers']['order'],
      deepl: {
        key: String(providers.deepl?.key ?? ''),
        free: bool(providers.deepl?.free, true),
      },
      google: { key: String(providers.google?.key ?? '') },
      openai: {
        baseUrl: String(providers.openai?.baseUrl ?? d.providers.openai.baseUrl),
        key: String(providers.openai?.key ?? ''),
        model: String(providers.openai?.model ?? d.providers.openai.model),
      },
      cacheDays: Math.round(clampNum(providers.cacheDays, 0, 3650, d.providers.cacheDays)),
      // The never-send list may be extended but the shipped defaults are always
      // retained: a provider must never see a banking page because a user
      // pruned a list they did not understand.
      neverSendHosts: [...new Set([...DEFAULT_EXCLUSIONS, ...normalizePatterns(providers.neverSendHosts)])],
      sendContext: bool(providers.sendContext, false),
      dailyLookupCap: Math.round(clampNum(providers.dailyLookupCap, 0, 100000, d.providers.dailyLookupCap)),
    },

    privacy: {
      telemetry: false,
      syncSettings: bool(s.privacy?.syncSettings, false),
    },
  };
}

function normalizeRules(raw: unknown, escalateDefault: boolean): SiteRule[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SiteRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Partial<SiteRule>;
    const pattern = String(r.pattern ?? '').trim().toLowerCase();
    if (!pattern || seen.has(pattern)) continue;
    seen.add(pattern);
    const rule: SiteRule = {
      pattern,
      enabled: bool(r.enabled, true),
      escalate: bool(r.escalate, escalateDefault),
    };
    if (typeof r.baseRatio === 'number') rule.baseRatio = clampNum(r.baseRatio, 0, 1, 0);
    if (typeof r.ceilingRatio === 'number') rule.ceilingRatio = clampNum(r.ceilingRatio, 0, 1, 1);
    if (typeof r.target === 'string' && isKnownLanguage(r.target)) rule.target = r.target;
    if (r.origin === 'preset' || r.origin === 'user' || r.origin === 'imported') rule.origin = r.origin;
    out.push(rule);
  }
  return out;
}

function normalizePatterns(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((p) => String(p ?? '').trim().toLowerCase()).filter(Boolean))];
}

/* -------------------------------------------------------------- migration */

/** Migrate stored settings across schema versions, then validate. */
export function migrateSettings(raw: unknown, now: number, installId: string): Settings {
  if (!raw || typeof raw !== 'object') return defaultSettings(now, installId);
  const version = Number((raw as { schemaVersion?: unknown }).schemaVersion ?? 0);

  let working = raw;
  // v0 -> v1: the pre-release build stored a single `targetLang` string.
  if (version < 1) {
    const legacy = working as { targetLang?: string; learning?: Record<string, unknown> };
    if (typeof legacy.targetLang === 'string') {
      working = {
        ...working,
        learning: {
          ...(legacy.learning ?? {}),
          targetLangs: [legacy.targetLang],
          activeTarget: legacy.targetLang,
        },
      };
    }
  }

  return validateSettings(working, now, installId);
}

/** Settings fields that must never be written to chrome.storage.sync. */
export const LOCAL_ONLY_PATHS = [
  'providers.deepl.key',
  'providers.google.key',
  'providers.openai.key',
  'installId',
];

/** A copy of settings safe to sync, with secrets stripped. */
export function syncSafeSettings(s: Settings): Settings {
  return {
    ...s,
    providers: {
      ...s.providers,
      deepl: { ...s.providers.deepl, key: '' },
      google: { key: '' },
      openai: { ...s.providers.openai, key: '' },
    },
  };
}
