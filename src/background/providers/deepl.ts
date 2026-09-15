import type { Provider, TranslationResult } from './types.ts';
import { providerFetch } from './types.ts';
import type { Settings } from '../../core/types.ts';

const TARGETS: Record<string, string> = {
  fr: 'FR', es: 'ES', de: 'DE', it: 'IT', pt: 'PT-PT', nl: 'NL', sv: 'SV',
};

/**
 * DeepL. Best quality of the three for the languages it supports, and the one
 * with the clearest data-retention terms, which is why it is first in the
 * default order.
 *
 * It has no Latin or Old English, so historical languages never reach a
 * provider at all and are answered entirely from the shipped packs.
 */
export const deepl: Provider = {
  id: 'deepl',
  label: 'DeepL',
  batchSize: 50,

  unavailable(settings: Settings): string | null {
    if (!settings.providers.deepl.key) return 'No DeepL API key set.';
    const target = TARGETS[settings.learning.activeTarget];
    if (!target) return `DeepL does not support ${settings.learning.activeTarget}.`;
    return null;
  },

  async translate(requests, ctx): Promise<TranslationResult[]> {
    const target = TARGETS[ctx.target];
    if (!target) return requests.map((r) => ({ word: r.word, tgt: null, conf: 0 }));

    const base = ctx.settings.providers.deepl.free
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';

    const response = await providerFetch(
      base,
      {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${ctx.settings.providers.deepl.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: requests.map((r) => r.word),
          source_lang: ctx.source.toUpperCase(),
          target_lang: target,
          // Single words have no sentences to split, and asking DeepL not to
          // try avoids it returning a full clause for a one-word input.
          split_sentences: '0',
          preserve_formatting: true,
        }),
        signal: ctx.signal,
      },
      ctx.signal,
    );

    const data = (await response.json()) as { translations?: Array<{ text?: string }> };
    return requests.map((req, i) => {
      const text = data.translations?.[i]?.text?.trim() ?? '';
      return {
        word: req.word,
        tgt: text && text.toLowerCase() !== req.word.toLowerCase() ? text : null,
        // A machine gloss without a dictionary check is good but not curated,
        // so it never reaches the confidence of a hand-authored entry.
        conf: text ? 0.78 : 0,
      };
    });
  },
};
