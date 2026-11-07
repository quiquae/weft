import type { Settings, SiteRule } from './types.ts';

/**
 * Site classification: which pages get taxed, which get a gentle dose, and
 * which Weft must never touch.
 *
 * The exclusion list is the most important product decision in this file.
 * A language tool that translates half the words in your online banking, your
 * two-factor codes or your doctor's portal is not a language tool, it is a
 * hazard. Weft ships a conservative deny-list that wins over every other rule,
 * and the deny-list is checked before any pack is even loaded.
 */

/** Second-level suffixes that are not registrable on their own. */
const MULTI_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'net.uk', 'sch.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'id.au',
  'co.nz', 'net.nz', 'org.nz', 'govt.nz', 'ac.nz',
  'co.jp', 'or.jp', 'ne.jp', 'ac.jp', 'go.jp', 'lg.jp',
  'com.br', 'net.br', 'org.br', 'gov.br', 'edu.br',
  'co.in', 'net.in', 'org.in', 'gov.in', 'ac.in', 'edu.in',
  'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn', 'ac.cn',
  'co.za', 'org.za', 'net.za', 'gov.za', 'ac.za',
  'com.mx', 'com.ar', 'com.tr', 'com.sg', 'com.hk', 'com.tw', 'com.my',
  'co.kr', 'or.kr', 'go.kr', 'ac.kr',
  'co.il', 'org.il', 'ac.il', 'gov.il',
  'gov.us', 'k12.us',
]);

export function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
}

/**
 * Registrable domain ("eTLD+1"), used to group attention: time on
 * mobile.twitter.com and time on twitter.com are the same habit.
 *
 * This is a heuristic, not a full Public Suffix List. Shipping the PSL would
 * add ~230 KB to a content script that runs on every page, and the failure
 * mode of the heuristic is benign: it groups attention slightly too coarsely
 * for a handful of country domains.
 */
export function registrableDomain(host: string): string {
  const h = normalizeHost(host);
  if (!h || h === 'localhost') return h;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return h;
  const parts = h.split('.');
  if (parts.length <= 2) return h;
  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_SUFFIXES.has(lastTwo)) return parts.slice(-3).join('.');
  return lastTwo;
}

export interface ParsedPattern {
  host: string;
  /** When set, the URL path must start with this (leading slash included). */
  pathPrefix: string | null;
  /** True for "*.example.com": subdomains only, not the bare domain. */
  subdomainsOnly: boolean;
  /** True for "=example.com": this host only, no subdomains. */
  exact: boolean;
}

/**
 * Patterns are deliberately simple, because users type these by hand:
 *
 *   twitter.com            host and all subdomains
 *   *.twitter.com          subdomains only
 *   reddit.com/r/all       host (and subdomains) with a path prefix
 *   reddit.com/r/*         a * in a path stands for one path segment
 *   =news.ycombinator.com  exact host, no subdomains
 *
 * A star may also appear between segments, so a pattern can match a compare
 * page under any repository. The example is not written out here because the
 * sequence would close this comment.
 */
export function parsePattern(pattern: string): ParsedPattern | null {
  let p = pattern.trim().toLowerCase();
  if (!p) return null;
  p = p.replace(/^[a-z]+:\/\//, '');

  let subdomainsOnly = false;
  let exact = false;
  if (p.startsWith('*.')) {
    subdomainsOnly = true;
    p = p.slice(2);
  } else if (p.startsWith('=')) {
    exact = true;
    p = p.slice(1);
  }

  const slash = p.indexOf('/');
  const host = normalizeHost(slash === -1 ? p : p.slice(0, slash));
  const pathPrefix = slash === -1 ? null : p.slice(slash) || null;
  if (!host || host.includes(' ')) return null;

  return { host, pathPrefix, subdomainsOnly, exact };
}

export function patternMatches(pattern: string, url: URL): boolean {
  const parsed = parsePattern(pattern);
  if (!parsed) return false;
  const host = normalizeHost(url.hostname);

  let hostOk: boolean;
  if (parsed.exact) {
    hostOk = host === parsed.host;
  } else if (parsed.subdomainsOnly) {
    hostOk = host.endsWith(`.${parsed.host}`);
  } else {
    hostOk = host === parsed.host || host.endsWith(`.${parsed.host}`);
  }
  if (!hostOk) return false;

  if (parsed.pathPrefix) {
    return pathMatches(parsed.pathPrefix, (url.pathname + url.search).toLowerCase());
  }
  return true;
}

/**
 * Match a path prefix, where `*` stands for a single path segment.
 *
 * Added because the shipped exclusion list already contained a pattern using
 * this syntax and it had never matched anything: `*` was literal, so the
 * pattern required a path beginning with a literal asterisk, which no real
 * URL has. It was dead in both places the list is used — the never-weave
 * site rules and the provider never-send list — while the settings page
 * displayed it as protection the entire time.
 *
 * One segment rather than `.*` deliberately. A compare-page pattern should
 * cover /owner/repo/compare/main...branch and must NOT quietly become
 * "everything on this host": over-blocking stops Weft working on sites
 * nobody excluded, and that fails silently, whereas under-blocking at least
 * shows up as words on a page.
 *
 * Still a prefix match, so a pattern ending at a segment covers what is
 * beneath it.
 */
function pathMatches(prefix: string, path: string): boolean {
  if (!prefix.includes('*')) return path.startsWith(prefix);
  const escaped = prefix
    .split('*')
    .map(escapeRegExp)
    .join('[^/]*');
  return new RegExp('^' + escaped).test(path);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Specificity, so that reddit.com/r/all beats reddit.com. */
function specificity(pattern: string): number {
  const parsed = parsePattern(pattern);
  if (!parsed) return -1;
  return parsed.host.length + (parsed.pathPrefix ? parsed.pathPrefix.length * 2 + 50 : 0);
}

export function findRule(url: URL, rules: SiteRule[]): SiteRule | null {
  let best: SiteRule | null = null;
  let bestScore = -1;
  for (const rule of rules) {
    if (!patternMatches(rule.pattern, url)) continue;
    const score = specificity(rule.pattern);
    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }
  return best;
}

/* ----------------------------------------------------------- classification */

export type SiteMode = 'taxed' | 'gentle' | 'excluded' | 'off';

export interface SiteDecision {
  mode: SiteMode;
  rule: SiteRule | null;
  /** Registrable domain used as the attention key. */
  attentionKey: string;
  /** Effective values after applying any rule overrides. */
  baseRatio: number;
  ceilingRatio: number;
  escalate: boolean;
  target: string;
  /** Present when mode is 'excluded', for the popup to explain itself. */
  reason?: string;
}

/** URL schemes Weft never runs on, whatever the settings say. */
const FORBIDDEN_SCHEMES = new Set([
  'chrome:', 'chrome-extension:', 'moz-extension:', 'about:', 'edge:', 'devtools:',
  'view-source:', 'data:', 'blob:', 'file:', 'javascript:', 'ws:', 'wss:',
]);

/**
 * What the never-weave list covers, a kind at a time, in the words the pages
 * that set it use. Chosen on the principle that Weft must not be between you
 * and your money, your health, your identity, or anything you are about to
 * sign. The settings row, the first-run page and `/support` each name every
 * kind, and `tests/tools/support-directions.test.ts` holds them to this list.
 * Users can take entries off it, which makes Weft harder and so applies at
 * once; adding one makes Weft easier, and waits out the cooldown.
 */
export const NEVER_WEAVE_KINDS: ReadonlyArray<{ kind: string; patterns: readonly string[] }> = [
  {
    kind: 'mail', // and messaging, where precision matters
    patterns: [
      'mail.google.com', 'outlook.com', 'outlook.office.com', 'outlook.live.com',
      'mail.proton.me', 'proton.me', 'fastmail.com', 'zoho.com', 'mail.yahoo.com',
    ],
  },
  {
    kind: 'money',
    patterns: [
      'paypal.com', 'stripe.com', 'wise.com', 'revolut.com', 'venmo.com',
      'coinbase.com', 'chase.com', 'bankofamerica.com', 'wellsfargo.com',
      'citibank.com', 'capitalone.com', 'americanexpress.com', 'schwab.com',
      'fidelity.com', 'vanguard.com', 'hsbc.com', 'barclays.co.uk', 'lloydsbank.com',
      'monzo.com', 'nationwide.co.uk', 'santander.co.uk',
    ],
  },
  {
    kind: 'passwords and sign-in',
    patterns: [
      '1password.com', 'lastpass.com', 'bitwarden.com', 'dashlane.com',
      'accounts.google.com', 'login.microsoftonline.com', 'appleid.apple.com',
      'id.atlassian.com', 'auth0.com', 'okta.com',
    ],
  },
  {
    kind: 'health and government',
    patterns: [
      'myuhc.com', 'mychart.com', 'nhs.uk', 'irs.gov', 'ssa.gov', 'gov.uk',
      'usa.gov', 'uscis.gov', 'dmv.ca.gov', 'healthcare.gov',
    ],
  },
  {
    kind: 'checkouts and forms you cannot take back',
    patterns: [
      'amazon.com/gp/buy', 'checkout.stripe.com', 'docs.google.com/forms',
      'turbotax.intuit.com', 'hrblock.com',
    ],
  },
  {
    kind: 'the places you write rather than read',
    patterns: [
      'docs.google.com', 'notion.so', 'overleaf.com', 'figma.com',
      'github.com/*/*/compare', 'mail.superhuman.com',
    ],
  },
];

/**
 * The never-weave list Weft ships: every kind's patterns, in order. Marked
 * pure because esbuild keeps a top-level call it cannot prove pure, and
 * without the mark the whole list rode, unread, into `options.js`.
 */
export const DEFAULT_EXCLUSIONS: string[] = /* @__PURE__ */ NEVER_WEAVE_KINDS.flatMap((k) => k.patterns);

/** Curated presets for onboarding, so the first run is one click. */
export const SITE_PRESETS: Array<{
  id: string;
  label: string;
  detail: string;
  patterns: string[];
  escalate: boolean;
}> = [
  {
    id: 'social',
    label: 'Social feeds',
    detail: 'The infinite-scroll ones. Difficulty climbs the longer you stay.',
    escalate: true,
    patterns: [
      'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'threads.net',
      'tiktok.com', 'reddit.com', 'linkedin.com', 'bsky.app', 'mastodon.social',
      'tumblr.com', 'pinterest.com', 'snapchat.com', 'quora.com', '9gag.com',
    ],
  },
  {
    id: 'video',
    label: 'Video and streaming',
    detail: 'Comments, titles and descriptions get woven. Subtitles are left alone.',
    escalate: true,
    patterns: ['youtube.com', 'twitch.tv', 'netflix.com', 'hulu.com', 'vimeo.com', 'dailymotion.com'],
  },
  {
    id: 'news',
    label: 'News and aggregators',
    detail: 'A gentle fixed dose. Reading the news should stay possible.',
    escalate: false,
    patterns: [
      'news.ycombinator.com', 'lobste.rs', 'bbc.co.uk/news', 'theguardian.com',
      'nytimes.com', 'washingtonpost.com', 'ft.com', 'economist.com',
      'apnews.com', 'reuters.com', 'npr.org', 'aljazeera.com',
    ],
  },
  {
    id: 'wikis',
    label: 'Wikipedia and reference',
    detail: 'Long-form reading where context makes guessing easy. Good for learning.',
    escalate: false,
    patterns: ['wikipedia.org', 'wiktionary.org', 'britannica.com', 'stanford.edu/entries'],
  },
  {
    id: 'shopping',
    label: 'Shopping and browsing',
    detail: 'Product pages and listings. Checkout pages stay in English.',
    escalate: true,
    patterns: ['amazon.com', 'ebay.com', 'etsy.com', 'aliexpress.com', 'wayfair.com'],
  },
];

export function classifyUrl(rawUrl: string, settings: Settings): SiteDecision {
  const off = (reason?: string): SiteDecision => ({
    mode: 'excluded',
    rule: null,
    attentionKey: '',
    baseRatio: 0,
    ceilingRatio: 0,
    escalate: false,
    target: settings.learning.activeTarget,
    ...(reason ? { reason } : {}),
  });

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return off('not a valid URL');
  }
  const scheme = url.protocol.replace(/:$/, '');
  if (FORBIDDEN_SCHEMES.has(url.protocol)) return off(`${scheme} pages are never woven`);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return off(`${scheme} pages are never woven`);
  }

  for (const pattern of settings.sites.excluded) {
    if (patternMatches(pattern, url)) return off(`excluded by “${pattern}”`);
  }

  const attentionKey = registrableDomain(url.hostname);
  const taxed = findRule(url, settings.sites.taxed.filter((r) => r.enabled));
  const gentle = findRule(url, settings.sites.gentle.filter((r) => r.enabled));

  // A more specific gentle rule beats a broader taxed one, which is how a user
  // says "tax reddit, but not r/languagelearning".
  const winner =
    taxed && gentle
      ? specificity(taxed.pattern) >= specificity(gentle.pattern)
        ? { rule: taxed, mode: 'taxed' as const }
        : { rule: gentle, mode: 'gentle' as const }
      : taxed
        ? { rule: taxed, mode: 'taxed' as const }
        : gentle
          ? { rule: gentle, mode: 'gentle' as const }
          : null;

  if (!winner) {
    if (settings.sites.mode === 'taxed-only') {
      return {
        mode: 'off',
        rule: null,
        attentionKey,
        baseRatio: 0,
        ceilingRatio: 0,
        escalate: false,
        target: settings.learning.activeTarget,
      };
    }
    // everywhere-except: unlisted sites get the gentle treatment.
    return {
      mode: 'gentle',
      rule: null,
      attentionKey,
      baseRatio: settings.weave.baseRatio,
      ceilingRatio: settings.weave.baseRatio,
      escalate: false,
      target: settings.learning.activeTarget,
    };
  }

  const { rule, mode } = winner;
  const escalate = mode === 'taxed' && rule.escalate && settings.attention.enabled;
  return {
    mode,
    rule,
    attentionKey,
    baseRatio: rule.baseRatio ?? settings.weave.baseRatio,
    ceilingRatio: escalate
      ? (rule.ceilingRatio ?? settings.weave.ceilingRatio)
      : (rule.baseRatio ?? settings.weave.baseRatio),
    escalate,
    target: rule.target ?? settings.learning.activeTarget,
  };
}

/** Rules generated from a preset id, for onboarding. */
export function rulesFromPreset(id: string): { taxed: SiteRule[]; gentle: SiteRule[] } {
  const preset = SITE_PRESETS.find((p) => p.id === id);
  if (!preset) return { taxed: [], gentle: [] };
  const rules: SiteRule[] = preset.patterns.map((pattern) => ({
    pattern,
    enabled: true,
    escalate: preset.escalate,
    origin: 'preset' as const,
  }));
  return preset.escalate ? { taxed: rules, gentle: [] } : { taxed: [], gentle: rules };
}

/** The host part of a match pattern, with any leading wildcard removed. */
export function hostOfOrigin(origin: string): string | null {
  const withoutScheme = origin.replace(/^(?:\*|https?|file|ftp):\/\//, '');
  const host = withoutScheme.split('/')[0] ?? '';
  if (!host || host === '*') return null;
  return normalizeHost(host.replace(/^\*\./, ''));
}

/**
 * Does a granted origin cover a host any enabled rule cares about?
 *
 * Compared by host rather than by pattern string. `http://localhost/*` and
 * `*://localhost/*` are different strings for the same site, and an earlier
 * version of this intersection used string equality — which silently
 * registered the content script nowhere whenever the granted scheme differed
 * from the requested one.
 */
export function originCoversRules(origin: string, rules: SiteRule[]): boolean {
  if (origin === '*://*/*' || origin === '<all_urls>') return true;
  const host = hostOfOrigin(origin);
  if (!host) return false;
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const parsed = parsePattern(rule.pattern);
    if (!parsed) continue;
    if (host === parsed.host) return true;
    if (host.endsWith(`.${parsed.host}`)) return true;
    // A granted origin broader than the rule also covers it: granting
    // example.com covers a rule for shop.example.com.
    if (parsed.host.endsWith(`.${host}`)) return true;
  }
  return false;
}

/** Origins to request host permission for, given the configured rules. */
export function originsForRules(rules: SiteRule[]): string[] {
  const out = new Set<string>();
  for (const rule of rules) {
    const parsed = parsePattern(rule.pattern);
    if (!parsed) continue;
    out.add(`*://*.${parsed.host}/*`);
    out.add(`*://${parsed.host}/*`);
  }
  return [...out];
}
