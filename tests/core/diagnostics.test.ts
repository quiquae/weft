import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDiagnostics,
  diagnosticsLeakCheck,
  shortUserAgent,
  type DiagnosticsInput,
} from '../../src/core/diagnostics.ts';
import { settings, card, NOW } from '../helpers.ts';

/**
 * A diagnostic bundle is the easiest place in a private product to leak
 * something.
 *
 * It gets written once, glanced at, and then grows a field at a time until
 * it quietly contains the thing the product promised never to collect —
 * and nobody notices, because the leak is in a text blob nobody reads
 * closely. So the leak test asserts against real secret *values* planted in
 * the input rather than against a list of field names: a new field whose
 * contents happen to include a key fails immediately, where a field-name
 * check would wave it through.
 */

const CARDS = [
  card({ id: 'fr:maison', target: 'fr', lemma: 'house', reps: 9, retiredAt: NOW }),
  card({ id: 'fr:riviere', target: 'fr', lemma: 'river', reps: 2 }),
  card({ id: 'la:vacca', target: 'la', lemma: 'cow', reps: 4 }),
];

function input(over: Partial<DiagnosticsInput> = {}): DiagnosticsInput {
  return {
    version: '1.0.0',
    engine: 'chrome',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    settings: settings(),
    cards: CARDS,
    tier: 'free',
    renderMode: 'highlight',
    networkRequests: 0,
    tamperCount: 0,
    pendingChanges: 0,
    ...over,
  };
}

describe('what the report says', () => {
  test('names the version, engine and browser', () => {
    const report = buildDiagnostics(input());
    assert.match(report, /Weft 1\.0\.0 \(chrome build\)/);
    assert.match(report, /Chrome 141, macOS/);
  });

  test('counts only the target language the reader is on', () => {
    // Three cards, two of them French. A count that silently included the
    // Latin card would send someone chasing a vocabulary bug that is really
    // an arithmetic one.
    const report = buildDiagnostics(input());
    assert.match(report, /Vocabulary: 2 met, 1 retired/);
  });

  test('reports the renderer, because the two paths fail differently', () => {
    const report = buildDiagnostics(input({ renderMode: 'wrapped' }));
    assert.match(report, /Renderer: wrapped/);
  });

  test('says when the renderer has not resolved yet', () => {
    const report = buildDiagnostics(input({ renderMode: undefined as unknown as string }));
    assert.match(report, /not yet resolved/);
  });

  test('states that nothing was sent', () => {
    // The report exists inside a product whose headline claim is zero
    // requests. It has to say so, or copying it feels like uploading it.
    assert.match(buildDiagnostics(input()), /Nothing was sent anywhere/);
  });
});

describe('what the report must never say', () => {
  test('no secret value survives into the text', () => {
    const planted = settings({
      'providers.deepl.key': 'deepl-secret-abcdef123456',
      'providers.google.key': 'google-secret-abcdef123456',
      'providers.openai.key': 'sk-openai-secret-abcdef123456',
      'sites.taxed': [{ pattern: 'my-private-forum.example', enabled: true, escalate: true }],
    });
    const leaks = diagnosticsLeakCheck(input({ settings: planted }));
    assert.deepEqual(leaks, [], `the report leaked:\n  ${leaks.join('\n  ')}`);
  });

  test('which sites someone reads never appears', () => {
    // The single most sensitive thing this extension knows.
    const planted = settings({
      'sites.taxed': [{ pattern: 'therapy-forum.example', enabled: true, escalate: true }],
    });
    const report = buildDiagnostics(input({ settings: planted }));
    assert.ok(!report.includes('therapy-forum'), 'a site pattern reached the report');
    assert.match(report, /Sites: 1 taxed/, 'but the count should be there');
  });

  test('vocabulary words never appear', () => {
    const report = buildDiagnostics(input());
    for (const word of ['maison', 'riviere', 'house', 'river']) {
      assert.ok(!report.includes(word), `the report contains the word "${word}"`);
    }
  });

  test('the install id never appears', () => {
    // It is the HMAC key for the signed settings, so it is key material.
    const planted = settings();
    const report = buildDiagnostics(input({ settings: planted }));
    assert.ok(planted.installId.length > 4, 'the fixture has no install id to leak');
    assert.ok(!report.includes(planted.installId), 'the install id reached the report');
  });

  test('the leak check itself can fail', () => {
    /*
     * Guarding the guard. diagnosticsLeakCheck returning [] is only
     * meaningful if it is capable of returning something, and a check that
     * silently matches nothing is worse than no check — it converts an
     * unexamined risk into an apparently examined one.
     */
    const planted = settings({ 'providers.deepl.key': 'deepl-secret-abcdef123456' });
    const rigged = {
      ...input({ settings: planted }),
      // Pretend a future field echoed the key into the text.
      engine: 'chrome deepl-secret-abcdef123456',
    };
    const leaks = diagnosticsLeakCheck(rigged);
    assert.equal(leaks.length, 1, 'the leak check did not notice a planted key');
    assert.match(leaks[0] ?? '', /DeepL key/);
  });
});

describe('shortUserAgent', () => {
  const UA = {
    chrome:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0',
    safari:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
    edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  };

  test('identifies each browser, not the engine underneath it', () => {
    // Edge and Chrome both claim Chrome; Safari claims Version/ then Safari/.
    // Getting these backwards sends every Edge report to the Chrome pile.
    assert.equal(shortUserAgent(UA.chrome), 'Chrome 141, macOS');
    assert.equal(shortUserAgent(UA.firefox), 'Firefox 142, Linux');
    assert.equal(shortUserAgent(UA.safari), 'Safari 18, macOS');
    assert.equal(shortUserAgent(UA.edge), 'Edg 141, Windows');
  });

  test('drops the OS build number', () => {
    // "10_15_7" is more identifying than it is useful.
    assert.ok(!shortUserAgent(UA.chrome).includes('10_15_7'));
  });

  test('degrades rather than throwing on something unrecognised', () => {
    assert.match(shortUserAgent('some bespoke browser'), /unknown browser/);
  });
});
