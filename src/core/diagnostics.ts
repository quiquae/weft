import type { MemoryCard, Settings } from './types.ts';
import type { Tier } from './entitlements.ts';

/**
 * The report someone pastes into a bug report.
 *
 * Every store requires a support URL, and every support conversation starts
 * with "what version, which browser, what were you doing". Asking a reader
 * to find that themselves is how you get bug reports nobody can act on.
 *
 * The hard part is not what to include. It is what to leave out.
 *
 * A diagnostic bundle is the easiest place in a privacy-respecting product
 * to leak something, because it is written once, glanced at, and then grows
 * a field at a time until it quietly contains the thing you promised never
 * to collect. Weft's report therefore carries **counts and settings, never
 * content**: how many sites are configured, not which; how many words are
 * known, not which; which tier, never the licence key.
 *
 * `diagnosticsLeakCheck` below is the test-facing half of that promise, and
 * the test asserts against real secrets rather than a field list, so a new
 * field that happens to contain one fails immediately.
 *
 * Nothing here is transmitted. The report is built, shown, and copied by the
 * reader if they choose. That is the only behaviour consistent with a
 * product whose dashboard says "0 network requests, ever".
 */

export interface DiagnosticsInput {
  version: string;
  /** Build target: chrome, firefox or safari. */
  engine: string;
  /** navigator.userAgent, trimmed to the browser token. */
  userAgent: string;
  settings: Settings;
  cards: MemoryCard[];
  tier: Tier;
  /** Which renderer actually resolved on the last page, if known. */
  renderMode?: string;
  /** Requests made to translation providers, ever. */
  networkRequests: number;
  /** Failed integrity checks recorded. */
  tamperCount: number;
  /** Settings changes waiting out a cooldown. */
  pendingChanges: number;
}

/**
 * Reduce a user agent to the browser and version.
 *
 * The full string carries the OS build number, which is more identifying
 * than it is useful — "Chrome 141 on macOS" answers every question a bug
 * report needs.
 */
export function shortUserAgent(ua: string): string {
  const browser =
    /(Firefox)\/([\d.]+)/.exec(ua) ??
    /(Edg)\/([\d.]+)/.exec(ua) ??
    /(Chrome)\/([\d.]+)/.exec(ua) ??
    /Version\/([\d.]+).*(Safari)/.exec(ua);
  const os = /Mac OS X/.test(ua)
    ? 'macOS'
    : /Windows/.test(ua)
      ? 'Windows'
      : /Linux|X11/.test(ua)
        ? 'Linux'
        : 'unknown OS';

  if (!browser) return `unknown browser, ${os}`;
  // The Safari pattern captures version first, name second.
  const [name, version] =
    browser[2] === 'Safari' ? ['Safari', browser[1]] : [browser[1], browser[2]];
  const major = String(version ?? '').split('.')[0] ?? '?';
  return `${name} ${major}, ${os}`;
}

/** Build the report. Plain text, because it is going into a form. */
export function buildDiagnostics(input: DiagnosticsInput): string {
  const s = input.settings;
  const mine = input.cards.filter((c) => c.target === s.learning.activeTarget);
  const retired = mine.filter((c) => c.retiredAt).length;

  const lines = [
    `Weft ${input.version} (${input.engine} build)`,
    shortUserAgent(input.userAgent),
    '',
    `Learning: ${s.learning.sourceLang} → ${s.learning.activeTarget}, level ${s.learning.level}`,
    `Tier: ${input.tier}`,
    `Renderer: ${input.renderMode ?? 'not yet resolved'} (setting: ${s.weave.renderMode})`,
    '',
    `Density: ${Math.round(s.weave.baseRatio * 100)}% base, ` +
      `${Math.round(s.weave.ceilingRatio * 100)}% ceiling, ` +
      `attention ${s.attention.enabled ? 'on' : 'off'}`,
    `Cooldown: ${s.friction.cooldownMinutes} min` +
      (s.friction.requireQuizToUnlock ? ' with a quiz' : '') +
      (s.friction.hardMode ? ', hard mode on' : ''),
    '',
    // Counts, deliberately. Which sites someone reads is the single most
    // sensitive thing this extension knows.
    `Sites: ${s.sites.taxed.length} taxed, ${s.sites.gentle.length} gentle, ` +
      `${s.sites.excluded.length} never-weave`,
    `Vocabulary: ${mine.length} met, ${retired} retired`,
    `Providers: ${s.providers.enabled ? `on (${s.providers.order.join(', ')})` : 'off'}`,
    `Network requests, ever: ${input.networkRequests}`,
    '',
    `Integrity failures: ${input.tamperCount}`,
    `Changes waiting on a cooldown: ${input.pendingChanges}`,
    '',
    'No page addresses, no vocabulary, no keys. Nothing was sent anywhere;',
    'this text only exists if you copy it.',
  ];

  return lines.join('\n');
}

/**
 * Everything a report must never contain, for the test to assert against.
 *
 * A list of forbidden *values* rather than forbidden field names, because
 * the failure mode is someone adding a field whose contents happen to
 * include a secret — which a field-name check would wave straight through.
 */
export function diagnosticsLeakCheck(input: DiagnosticsInput): string[] {
  const s = input.settings;
  const forbidden: Array<[string, string]> = [
    ['install id', s.installId],
    ['DeepL key', s.providers.deepl.key],
    ['Google key', s.providers.google.key],
    ['OpenAI key', s.providers.openai.key],
    ...s.sites.taxed.map((r) => ['a taxed site pattern', r.pattern] as [string, string]),
    ...s.sites.excluded.map((p) => ['a never-weave pattern', p] as [string, string]),
    ...input.cards.slice(0, 50).map((c) => ['a vocabulary word', c.lemma] as [string, string]),
  ];

  const report = buildDiagnostics(input);
  const found: string[] = [];
  for (const [label, value] of forbidden) {
    // Short values produce false positives against ordinary prose: a
    // two-letter language code appears in the report legitimately.
    if (!value || value.length < 4) continue;
    if (report.includes(value)) found.push(`${label}: ${value}`);
  }
  return found;
}
