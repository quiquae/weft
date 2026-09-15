import type { LangCode, Settings } from './types.ts';

/**
 * What the free tier includes, and what Pro adds.
 *
 * Two rules shaped this list, and both are commercial as much as ethical:
 *
 * **The free tier has to be genuinely good, not crippled.** One language, the
 * whole lexicon for it, the whole escalation curve, the whole tooltip with
 * etymologies and pronunciation, the vocabulary list, and export. Someone can
 * use Weft free forever and get the entire idea. A hobbled free tier does not
 * convert; it just teaches people the product is disappointing.
 *
 * **Some things are never gated, at any price.** Accessibility is not a
 * feature, it is a floor. The never-weave list protects people from the
 * product and charging for protection would be indefensible. Panic passes are
 * the escape valve that stops a frustrated user uninstalling, so putting them
 * behind a paywall would cost more in churn than it earns. And your data is
 * yours: export is free.
 */

export type Tier = 'free' | 'pro';

export type Feature =
  | 'multi-language'
  | 'per-site-language'
  | 'hard-mode'
  | 'providers'
  | 'phrases'
  | 'extended-history'
  | 'unlock-quiz'
  | 'custom-lexicon';

export interface FeatureInfo {
  id: Feature;
  label: string;
  /** Why someone would want it, in the user's terms. */
  detail: string;
  tier: Tier;
}

export const FEATURES: FeatureInfo[] = [
  {
    id: 'multi-language',
    label: 'Every language at once',
    detail:
      'Free covers one language at a time, and you can change which. Pro keeps them all active so you can switch without losing your place in any of them.',
    tier: 'pro',
  },
  {
    id: 'per-site-language',
    label: 'A different language per site',
    detail:
      'French on the feeds, Latin on Wikipedia, Old English on the long reads. Each site keeps its own vocabulary and its own progress.',
    tier: 'pro',
  },
  {
    id: 'hard-mode',
    label: 'Hard Mode',
    detail:
      'Generates the browser policy that stops Weft being removed without an administrator password. The only mechanism that actually holds.',
    tier: 'pro',
  },
  {
    id: 'providers',
    label: 'Unlimited vocabulary',
    detail:
      'Point Weft at your own DeepL, Google or OpenAI-compatible key and it will weave any word on the page, not only the checked core lexicon.',
    tier: 'pro',
  },
  {
    id: 'phrases',
    label: 'Phrases, not just words',
    detail:
      'Weave "as well as" and "at the same time" as units, once single words have stopped being difficult.',
    tier: 'pro',
  },
  {
    id: 'extended-history',
    label: 'The whole history',
    detail:
      'Free shows today and your vocabulary. Pro keeps sixty days of attention, the per-site breakdown, and how fast words are graduating.',
    tier: 'pro',
  },
  {
    id: 'unlock-quiz',
    label: 'Quiz-gated unlocking',
    detail:
      'Require a vocabulary check before any setting gets easier, so the way out is itself practice.',
    tier: 'pro',
  },
  {
    id: 'custom-lexicon',
    label: 'Your own word lists',
    detail:
      'Import a lexicon — a course glossary, a reading list, a field vocabulary — and Weft will weave from it.',
    tier: 'pro',
  },
];

/**
 * Capabilities no tier ever removes.
 *
 * Kept as data rather than as a comment so it can be asserted in a test. If
 * someone later moves one of these behind the paywall, the suite fails and
 * says why.
 */
export const NEVER_GATED = [
  'accessibility',
  'privacy',
  'never-weave-list',
  'panic-passes',
  'core-weaving',
  'data-export',
  'pronunciation',
  'etymologies',
] as const;

const PRO_ONLY = new Set<Feature>(FEATURES.filter((f) => f.tier === 'pro').map((f) => f.id));

export function has(tier: Tier, feature: Feature): boolean {
  if (tier === 'pro') return true;
  return !PRO_ONLY.has(feature);
}

export function featureInfo(feature: Feature): FeatureInfo {
  const found = FEATURES.find((f) => f.id === feature);
  if (!found) throw new Error(`unknown feature: ${feature}`);
  return found;
}

/** Free-tier ceiling on simultaneously active target languages. */
export const FREE_LANGUAGE_LIMIT = 1;

/** Days of attention history the free tier shows. */
export const FREE_HISTORY_DAYS = 1;

export const PRO_HISTORY_DAYS = 60;

export function historyDays(tier: Tier): number {
  return tier === 'pro' ? PRO_HISTORY_DAYS : FREE_HISTORY_DAYS;
}

/**
 * Clamp settings to what the tier allows.
 *
 * Applied on every load rather than only at the moment of change, because a
 * licence can expire while settings that depended on it are still stored. The
 * clamp is deliberately gentle: it turns features off, it never erases the
 * configuration behind them, so the settings come back intact when a licence
 * is renewed.
 */
export function clampToTier(settings: Settings, tier: Tier): Settings {
  if (tier === 'pro') return settings;

  const targets = settings.learning.targetLangs.slice(0, FREE_LANGUAGE_LIMIT);
  const active: LangCode = targets.includes(settings.learning.activeTarget)
    ? settings.learning.activeTarget
    : ((targets[0] ?? settings.learning.activeTarget) as LangCode);

  return {
    ...settings,
    learning: {
      ...settings.learning,
      targetLangs: targets.length ? targets : [active],
      activeTarget: active,
      phrasesEnabled: false,
    },
    friction: {
      ...settings.friction,
      requireQuizToUnlock: false,
      hardMode: false,
    },
    providers: {
      ...settings.providers,
      enabled: false,
    },
    sites: {
      ...settings.sites,
      // Per-site language overrides are a Pro feature; drop the override and
      // keep the rule itself, so nothing the user configured disappears.
      taxed: settings.sites.taxed.map((r) => {
        if (!r.target) return r;
        const { target: _dropped, ...rest } = r;
        return rest;
      }),
      gentle: settings.sites.gentle.map((r) => {
        if (!r.target) return r;
        const { target: _dropped, ...rest } = r;
        return rest;
      }),
    },
  };
}

/** True when a settings object asks for something the tier does not allow. */
export function exceedsTier(settings: Settings, tier: Tier): Feature[] {
  if (tier === 'pro') return [];
  const over: Feature[] = [];
  if (settings.learning.targetLangs.length > FREE_LANGUAGE_LIMIT) over.push('multi-language');
  if (settings.learning.phrasesEnabled) over.push('phrases');
  if (settings.friction.requireQuizToUnlock) over.push('unlock-quiz');
  if (settings.friction.hardMode) over.push('hard-mode');
  if (settings.providers.enabled) over.push('providers');
  if ([...settings.sites.taxed, ...settings.sites.gentle].some((r) => r.target)) {
    over.push('per-site-language');
  }
  return over;
}
