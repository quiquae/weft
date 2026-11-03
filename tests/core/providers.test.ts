import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { deepl } from '../../src/background/providers/deepl.ts';
import { google } from '../../src/background/providers/google.ts';
import { openai } from '../../src/background/providers/openai.ts';
import type { TranslationRequest } from '../../src/background/providers/types.ts';
import { settings } from '../helpers.ts';
import { SENTENCE_RECIPIENTS } from '../../src/core/sending.ts';

/**
 * What actually leaves the machine when a user brings their own API key.
 *
 * The free product makes no requests at all and there is an end-to-end test
 * asserting it. Providers are the one path that does contact a server, and
 * the promise made about them is specific: individual words, never
 * sentences, paragraphs, URLs or page content — unless the reader separately
 * turns sentence context on, which is off by default.
 *
 * That promise lives in three request bodies built by hand, so it is worth a
 * test that reads the bytes rather than the intent. The interesting failure
 * is not a provider refusing to work; it is a provider quietly starting to
 * send a little more than it said.
 */

const PAGE_TEXT =
  'The old house stands at the end of a long road, where the river runs under a stone bridge.';
const PAGE_URL = 'https://example.test/private/article?id=42';

let bodies: string[] = [];
let urls: string[] = [];
const realFetch = globalThis.fetch;

/** Capture every request and answer plausibly, without a network. */
function stubFetch(reply: unknown): void {
  bodies = [];
  urls = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    urls.push(String(url));
    bodies.push(typeof init?.body === 'string' ? init.body : '');
    return new Response(JSON.stringify(reply), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

beforeEach(() => {
  bodies = [];
  urls = [];
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const ctx = (patch: Record<string, unknown> = {}) => ({
  source: 'en' as const,
  target: 'fr' as const,
  settings: settings({
    'providers.enabled': true,
    'providers.deepl.key': 'test-key',
    'providers.google.key': 'test-key',
    'providers.openai.key': 'test-key',
    'providers.openai.baseUrl': 'https://api.openai.com/v1',
    'providers.openai.model': 'gpt-test',
    ...patch,
  }),
  signal: new AbortController().signal,
});

const words: TranslationRequest[] = [
  { word: 'house', pos: 'noun' },
  { word: 'river', pos: 'noun' },
];

/** Words plus a sentence of context, as the content script would supply. */
const withContext: TranslationRequest[] = [{ word: 'house', pos: 'noun', context: PAGE_TEXT }];

describe('what a provider sends', () => {
  test('DeepL sends the words and nothing else', async () => {
    stubFetch({ translations: [{ text: 'maison' }, { text: 'rivière' }] });
    await deepl.translate(words, ctx());

    assert.equal(bodies.length, 1);
    const body = JSON.parse(bodies[0] ?? '{}');
    assert.deepEqual(body.text, ['house', 'river'], 'the payload is the word list');
    assert.deepEqual(
      Object.keys(body).sort(),
      ['preserve_formatting', 'source_lang', 'split_sentences', 'target_lang', 'text'],
      'an unexpected field appeared in the DeepL payload',
    );
  });

  test('Google sends the words and nothing else', async () => {
    stubFetch({ data: { translations: [{ translatedText: 'maison' }, { translatedText: 'rivière' }] } });
    await google.translate(words, ctx());

    const body = JSON.parse(bodies[0] ?? '{}');
    assert.deepEqual(body.q, ['house', 'river']);
    assert.deepEqual(Object.keys(body).sort(), ['format', 'q', 'source', 'target']);
  });

  test('OpenAI sends word and part of speech, and no context by default', async () => {
    stubFetch({
      choices: [{ message: { content: JSON.stringify({ results: [{ word: 'house', tgt: 'maison' }] }) } }],
    });
    await openai.translate([{ word: 'house', pos: 'noun' }], ctx());

    const body = JSON.parse(bodies[0] ?? '{}');
    const user = body.messages.find((m: { role: string }) => m.role === 'user');
    const sent = JSON.parse(user.content);
    assert.deepEqual(sent.words, [{ word: 'house', pos: 'noun' }]);
  });

  test('DeepL and Google ignore context even when it is offered', async () => {
    // Only the chat provider can use a sentence, so the other two must drop
    // it rather than pass it along in some field that happens to exist.
    stubFetch({ translations: [{ text: 'maison' }] });
    await deepl.translate(withContext, ctx());
    assert.ok(!bodies[0]?.includes('stone bridge'), 'DeepL forwarded the sentence');

    stubFetch({ data: { translations: [{ translatedText: 'maison' }] } });
    await google.translate(withContext, ctx());
    assert.ok(!bodies[0]?.includes('stone bridge'), 'Google forwarded the sentence');
  });

  test('OpenAI includes context only when the request carries it', async () => {
    // The content script only populates context when providers.sendContext
    // is on, which is false by default; this asserts the provider end of
    // that contract rather than re-testing the setting.
    stubFetch({ choices: [{ message: { content: '{"results":[]}' } }] });
    await openai.translate(withContext, ctx());
    const sent = JSON.parse(
      JSON.parse(bodies[0] ?? '{}').messages.find((m: { role: string }) => m.role === 'user').content,
    );
    assert.equal(sent.words[0].context, PAGE_TEXT);
  });
});

describe('what a provider must never send', () => {
  /**
   * The page URL is the single most identifying thing Weft touches, and no
   * provider has any use for it. Checked against every body rather than
   * per-provider, so a new provider is covered by an existing test.
   */
  test('no provider sends the page URL', async () => {
    const replies: Array<[() => Promise<unknown>, unknown]> = [
      [() => deepl.translate(words, ctx()), { translations: [{ text: 'maison' }] }],
      [() => google.translate(words, ctx()), { data: { translations: [{ translatedText: 'maison' }] } }],
      [() => openai.translate(words, ctx()), { choices: [{ message: { content: '{"results":[]}' } }] }],
    ];

    for (const [call, reply] of replies) {
      stubFetch(reply);
      await call();
      // Without this the loop below can assert nothing at all: a provider
      // that made no request would pass a test named "does not send the URL"
      // for entirely the wrong reason.
      assert.ok(bodies.length > 0, 'no request was captured, so this proves nothing');
      for (const body of bodies) {
        assert.ok(!body.includes(PAGE_URL), `a provider sent the page URL: ${body.slice(0, 120)}`);
        assert.ok(!body.includes('example.test'), 'a provider sent the page host');
      }
    }
  });

  test('a body carrying a sentence is only ever the chat provider', async () => {
    // A guard for the shape of the promise: if some future provider starts
    // needing prose, this test says so rather than letting it slide.
    stubFetch({ translations: [{ text: 'maison' }] });
    await deepl.translate(withContext, ctx());
    const deeplBody = bodies[0] ?? '';

    stubFetch({ data: { translations: [{ translatedText: 'maison' }] } });
    await google.translate(withContext, ctx());
    const googleBody = bodies[0] ?? '';

    for (const [name, body] of [['deepl', deeplBody], ['google', googleBody]] as const) {
      // A word list is short. Prose is not.
      assert.ok(body.length < 400, `${name} body is suspiciously long: ${body.length} bytes`);
    }
  });
});

describe('who is sent the sentence is what the dashboard says', () => {
  /**
   * The dashboard and the settings page name the services sent the sentence
   * when “Send the surrounding sentence” is on, from `SENTENCE_RECIPIENTS` in
   * `src/core/sending.ts`. Which services those are is a fact about the
   * bodies above, so it is read from them, for every provider the worker can
   * call: a fourth provider, or DeepL taking up its own `context` parameter,
   * fails here until the words say so.
   */
  test('the services whose body carries the sentence are exactly the ones named', async () => {
    const g = globalThis as unknown as Record<string, unknown>;
    // The registry imports the worker's storage, which reads these at load.
    g['__WEFT_TARGET__'] ??= 'chrome';
    g['chrome'] ??= { storage: { local: {} } };
    const { PROVIDERS } = await import('../../src/background/providers/index.ts');

    const carriers: string[] = [];
    for (const [id, provider] of Object.entries(PROVIDERS)) {
      stubFetch({});
      await provider.translate(withContext, ctx());
      assert.ok(bodies.length > 0, `${id} made no request, so this proves nothing about it`);
      if (bodies.some((body) => body.includes('stone bridge'))) carriers.push(id);
    }
    assert.ok(Object.keys(PROVIDERS).length >= 3, 'fewer providers were read than ship');
    assert.deepEqual(
      carriers.sort(),
      [...SENTENCE_RECIPIENTS].sort(),
      'the services sent the sentence are not the ones src/core/sending.ts names',
    );
  });
});

describe('a model that answers badly must not reach the page', () => {
  test('a multi-word answer is rejected', async () => {
    // "A multi-word answer under one underline reads as a bug." The model is
    // asked for a single word; the code has to enforce it, not hope.
    stubFetch({
      choices: [
        {
          message: {
            content: JSON.stringify({ results: [{ word: 'house', tgt: 'la grande maison' }] }),
          },
        },
      ],
    });
    const out = await openai.translate([{ word: 'house', pos: 'noun' }], ctx());
    assert.equal(out[0]?.tgt, null, 'a phrase was accepted as a single-word gloss');
  });

  test('an answer echoing the input is rejected', async () => {
    stubFetch({
      choices: [{ message: { content: JSON.stringify({ results: [{ word: 'house', tgt: 'House' }] }) } }],
    });
    const out = await openai.translate([{ word: 'house', pos: 'noun' }], ctx());
    assert.equal(out[0]?.tgt, null, 'the English word was accepted as its own translation');
  });

  test('a response that is not JSON degrades to no answer', async () => {
    stubFetch({ choices: [{ message: { content: 'Sorry, I cannot do that.' } }] });
    const out = await openai.translate([{ word: 'house', pos: 'noun' }], ctx());
    assert.equal(out.length, 1);
    assert.equal(out[0]?.tgt, null);
  });
});

describe('availability', () => {
  test('a provider with no key says so rather than failing later', () => {
    assert.match(deepl.unavailable(settings()) ?? '', /key/i);
    assert.match(google.unavailable(settings()) ?? '', /key/i);
    assert.match(openai.unavailable(settings()) ?? '', /key/i);
  });

  test('DeepL reports a language it cannot do, instead of guessing', () => {
    // DeepL has no Latin. Saying so is what keeps historical languages
    // answered from the packs rather than mistranslated.
    const withKey = settings({ 'providers.deepl.key': 'k', 'learning.activeTarget': 'la' });
    assert.match(deepl.unavailable(withKey) ?? '', /does not support/i);
  });
});
