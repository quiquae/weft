import type { Provider, TranslationResult } from './types.ts';
import { providerFetch } from './types.ts';
import { getLanguage } from '../../core/languages.ts';
import type { Settings } from '../../core/types.ts';

/**
 * Any OpenAI-compatible chat endpoint.
 *
 * This is the provider that can actually answer for Latin and Old English,
 * and the only one that can return grammatical gender — so it is worth the
 * extra prompt discipline. The response is constrained to JSON and every
 * field is validated, because a model that returns a sentence where a word
 * belongs would put a sentence on the user's page.
 */
export const openai: Provider = {
  id: 'openai',
  label: 'OpenAI-compatible',
  batchSize: 40,

  unavailable(settings: Settings): string | null {
    if (!settings.providers.openai.key) return 'No API key set.';
    if (!settings.providers.openai.baseUrl) return 'No base URL set.';
    if (!settings.providers.openai.model) return 'No model set.';
    return null;
  },

  async translate(requests, ctx): Promise<TranslationResult[]> {
    const { baseUrl, key, model } = ctx.settings.providers.openai;
    const targetMeta = getLanguage(ctx.target);
    const sourceMeta = getLanguage(ctx.source);

    const rules = [
      `Translate each word from ${sourceMeta.name} into ${targetMeta.name}.`,
      targetMeta.morphology === 'citation'
        ? 'Give the dictionary headword: nominative singular for nouns, the infinitive for verbs.'
        : 'Give the citation form: singular for nouns, infinitive for verbs, masculine singular for adjectives.',
      'Match the part of speech given. Do not explain, do not add articles, do not return a phrase where a single word exists.',
      'If no single-word equivalent exists in the target language, return null for that word.',
      targetMeta.historical
        ? 'Use the standard normalised orthography of teaching editions, including vowel-length marks.'
        : '',
      'Return gender as m, f, n or c for nouns in languages that mark it, otherwise null.',
    ]
      .filter(Boolean)
      .join(' ');

    const payload = {
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `You are a careful bilingual lexicographer. ${rules}` },
        {
          role: 'user',
          content: JSON.stringify({
            words: requests.map((r) => ({
              word: r.word,
              pos: r.pos,
              ...(r.num ? { number: r.num } : {}),
              ...(r.context ? { context: r.context } : {}),
            })),
            respond_with: {
              results: [{ word: 'string', tgt: 'string or null', gender: 'm|f|n|c or null' }],
            },
          }),
        },
      ],
    };

    const response = await providerFetch(
      `${baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctx.signal,
      },
      ctx.signal,
      25_000,
    );

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content ?? '{}';

    let parsed: { results?: Array<{ word?: string; tgt?: string | null; gender?: string | null }> };
    try {
      parsed = JSON.parse(content);
    } catch {
      return requests.map((r) => ({ word: r.word, tgt: null, conf: 0 }));
    }

    const byWord = new Map<string, { tgt?: string | null; gender?: string | null }>();
    for (const item of parsed.results ?? []) {
      if (typeof item?.word === 'string') byWord.set(item.word.toLowerCase(), item);
    }

    return requests.map((req) => {
      const hit = byWord.get(req.word.toLowerCase());
      const tgt = typeof hit?.tgt === 'string' ? hit.tgt.trim() : '';
      // Reject anything that is not a single word, or that came back as the
      // input. A multi-word answer under one underline reads as a bug.
      const usable = tgt && !/\s/.test(tgt) && tgt.toLowerCase() !== req.word.toLowerCase();
      const gender = hit?.gender;
      const result: TranslationResult = {
        word: req.word,
        tgt: usable ? tgt : null,
        conf: usable ? 0.7 : 0,
      };
      if (gender === 'm' || gender === 'f' || gender === 'n' || gender === 'c') {
        result.gender = gender;
      }
      return result;
    });
  },
};
