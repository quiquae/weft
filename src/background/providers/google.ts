import type { Provider, TranslationResult } from './types.ts';
import { providerFetch } from './types.ts';
import type { Settings } from '../../core/types.ts';

/**
 * Google Cloud Translation v2. Widest language coverage of the three, which is
 * why it is the fallback: it answers for languages DeepL has never heard of.
 */
export const google: Provider = {
  id: 'google',
  label: 'Google Cloud Translation',
  batchSize: 100,

  unavailable(settings: Settings): string | null {
    return settings.providers.google.key ? null : 'No Google Cloud Translation key set.';
  },

  async translate(requests, ctx): Promise<TranslationResult[]> {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
      ctx.settings.providers.google.key,
    )}`;

    const response = await providerFetch(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: requests.map((r) => r.word),
          source: ctx.source,
          target: ctx.target,
          format: 'text',
        }),
        signal: ctx.signal,
      },
      ctx.signal,
    );

    const data = (await response.json()) as {
      data?: { translations?: Array<{ translatedText?: string }> };
    };
    return requests.map((req, i) => {
      const text = data.data?.translations?.[i]?.translatedText?.trim() ?? '';
      return {
        word: req.word,
        tgt: text && text.toLowerCase() !== req.word.toLowerCase() ? text : null,
        conf: text ? 0.72 : 0,
      };
    });
  },
};
