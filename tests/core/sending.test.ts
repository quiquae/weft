import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ProviderId } from '../../src/core/types.ts';
import { SENTENCE_RECIPIENTS, howToStop, mayTransmit, whatIsSent } from '../../src/core/sending.ts';

/**
 * What the dashboard and the settings page say a translation service is sent.
 *
 * Until 2026-11-03 the dashboard's network panel said "Only isolated words
 * are ever sent, never page text." and the settings page said "It does not
 * send the page, the sentence, the URL or anything identifying." whatever the
 * settings said, and with “Send the surrounding sentence” on, the
 * OpenAI-compatible service is sent the sentence each word appears in. The
 * words are a function of the two settings that decide them now, and these
 * tests hold each of the three states to what it sends.
 *
 * Which services are sent the sentence is not decided here: it is decided by
 * the request bodies, and `tests/core/providers.test.ts` holds
 * `SENTENCE_RECIPIENTS` to them. This file holds the words to the list.
 */

/** How the copy names each service, so a recipient can be found in it. */
const NAMES: Record<ProviderId, string> = {
  deepl: 'DeepL',
  google: 'Google',
  openai: 'OpenAI-compatible',
};

const OFF = { enabled: false, sendContext: false };
const WORDS = { enabled: true, sendContext: false };
const SENTENCE = { enabled: true, sendContext: true };

describe('what a translation service is sent, by the settings that decide it', () => {
  test('with lookups off, no more words are sent, whatever sentence context says', () => {
    for (const sendContext of [false, true]) {
      const said = whatIsSent({ enabled: false, sendContext });
      assert.match(said, /“Use a translation service” is off/);
      assert.doesNotMatch(said, /sentence/, `lookups off still talks about a sentence: ${said}`);
      assert.equal(howToStop({ enabled: false, sendContext }), null, 'there is nothing to turn off');
    }
  });

  test('with sentence context off, the sentence stays on this machine', () => {
    const said = whatIsSent(WORDS);
    assert.match(said, /single words/);
    assert.match(said, /never the sentence/);
    for (const name of Object.values(NAMES)) {
      assert.ok(!said.includes(name), `names ${name} as if it were sent more: ${said}`);
    }
    assert.match(howToStop(WORDS) ?? '', /“Use a translation service”/);
  });

  test('with sentence context on, the sentence is said to go, and to which services', () => {
    const said = whatIsSent(SENTENCE);
    assert.doesNotMatch(said, /never the sentence/, `context on still promises the sentence stays: ${said}`);
    assert.match(said, /“Send the surrounding sentence” is on/);

    // The clause naming who is sent the sentence, and the one naming who is
    // not, are told apart by the semicolon between them.
    const [sent, spared] = said.split(';');
    assert.ok(sent && spared, `expected a clause for each side of a semicolon: ${said}`);
    for (const [id, name] of Object.entries(NAMES) as Array<[ProviderId, string]>) {
      const recipient = SENTENCE_RECIPIENTS.includes(id);
      assert.ok(
        (recipient ? sent : spared).includes(name),
        `${name} is ${recipient ? '' : 'not '}sent the sentence, and the copy does not say so: ${said}`,
      );
      assert.ok(
        !(recipient ? spared : sent).includes(name),
        `${name} is named on the wrong side: ${said}`,
      );
    }
    assert.match(howToStop(SENTENCE) ?? '', /“Send the surrounding sentence”/);
  });

  test('every recipient has a name the copy can be checked for', () => {
    assert.ok(SENTENCE_RECIPIENTS.length > 0, 'no service is sent the sentence, so the copy is moot');
    for (const id of SENTENCE_RECIPIENTS) assert.ok(NAMES[id], `no name for ${id}`);
  });
});

describe('the settings the words point at are the settings page’s', () => {
  /**
   * The copy names switches by their titles and a section by its heading, so
   * a reader can find them. Read from the page that draws them rather than
   * typed here, so renaming either fails this test rather than the reader.
   */
  const page = readFileSync(
    fileURLToPath(new URL('../../src/ui/options/data.tsx', import.meta.url)),
    'utf8',
  );
  const titles = new Set([...page.matchAll(/title="([^"]+)"/g)].map((m) => m[1]));

  test('the page has titles to read', () => {
    assert.ok(titles.size >= 5, `only ${titles.size} titles were read from the settings page`);
  });

  test('every switch and section the copy names is one the settings page has', () => {
    const named: string[] = [];
    for (const state of [OFF, WORDS, SENTENCE]) {
      for (const said of [whatIsSent(state), howToStop(state) ?? '']) {
        for (const m of said.matchAll(/“([^”]+)”/g)) named.push(m[1] as string);
        for (const m of said.matchAll(/under (.+?) in settings/g)) named.push(m[1] as string);
      }
    }
    assert.ok(named.length >= 4, `only ${named.length} names were found in the copy`);
    for (const name of named) {
      assert.ok(titles.has(name), `the copy names “${name}”, and the settings page has no such title`);
    }
  });
});

describe('what the browser lets leave', () => {
  test('Firefox sends only once the reader has granted website content', () => {
    assert.equal(mayTransmit({ origins: [], permissions: [], data_collection: [] }), false);
    assert.equal(mayTransmit({ data_collection: ['technicalAndInteraction'] }), false);
    assert.equal(mayTransmit({ data_collection: ['websiteContent'] }), true);
  });

  test('a browser that asks nothing leaves the switch as the whole consent', () => {
    assert.equal(mayTransmit({ origins: [], permissions: ['storage'] }), true);
    assert.equal(mayTransmit(undefined), true);
  });
});
