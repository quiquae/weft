import type { LangCode, Pos, Settings } from '../../core/types.ts';

/**
 * Optional translation providers, for vocabulary beyond the shipped packs.
 *
 * Off by default, bring-your-own-key, and constrained by one rule that shapes
 * the whole interface: a provider receives isolated words, not page text.
 *
 * That is why `TranslationRequest` has no `text` field and no `html` field.
 * It carries a word, its part of speech and its number — the minimum needed
 * to get a usable gloss — and a `context` field that is only ever populated
 * when the user has explicitly turned context on. A provider therefore cannot
 * be handed a paragraph of someone's reading by accident, because there is no
 * parameter to put one in.
 */

export interface TranslationRequest {
  word: string;
  pos: Pos;
  num?: 'sg' | 'pl';
  /** Only set when settings.providers.sendContext is true. */
  context?: string;
}

export interface TranslationResult {
  word: string;
  /** The translated surface form, or null when the provider had no answer. */
  tgt: string | null;
  /** 0..1, the provider's own confidence where it reports one. */
  conf: number;
  gender?: 'm' | 'f' | 'n' | 'c';
  note?: string;
}

export interface ProviderContext {
  source: LangCode;
  target: LangCode;
  settings: Settings;
  /** Abort signal, so a slow provider cannot pin the service worker awake. */
  signal: AbortSignal;
}

export interface Provider {
  readonly id: 'deepl' | 'google' | 'openai';
  readonly label: string;
  /** Human-readable reason this provider cannot run, or null when it can. */
  unavailable(settings: Settings): string | null;
  /** Maximum words per call. */
  readonly batchSize: number;
  translate(requests: TranslationRequest[], ctx: ProviderContext): Promise<TranslationResult[]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/** Shared fetch with timeout and useful error messages. */
export async function providerFetch(
  url: string,
  init: RequestInit,
  signal: AbortSignal,
  timeoutMs = 12_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (response.status === 401 || response.status === 403) {
      throw new ProviderError('The API key was rejected.', false);
    }
    if (response.status === 429) {
      throw new ProviderError('Rate limited. Weft will back off and retry later.', true);
    }
    if (response.status >= 500) {
      throw new ProviderError(`The provider returned ${response.status}.`, true);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new ProviderError(`${response.status}: ${body.slice(0, 200)}`, false);
    }
    return response;
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if ((err as Error).name === 'AbortError') {
      throw new ProviderError('The provider did not respond in time.', true);
    }
    throw new ProviderError((err as Error).message, true);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}
