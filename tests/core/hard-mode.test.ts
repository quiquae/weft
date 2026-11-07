import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hardModeHere, noPolicyHere } from '../../src/core/hard-mode.ts';

/**
 * Where Hard Mode has a file to offer.
 *
 * Hard Mode is a managed-policy file, and a policy holds only in the browser
 * that reads it. Until 2026-11-07 the options page offered Google Chrome's in
 * every build and every browser: on Firefox it named a Firefox add-on under
 * Chrome's paths, in Microsoft Edge, which runs the Chrome package, it wrote
 * where Edge never reads, and on Safari nothing applies. A file nothing obeys
 * is worse than no file, because it looks like Hard Mode and holds nothing.
 *
 * The build is known at build time. Which Chromium browser runs the Chrome
 * package is not, so it is read from the brands the browser names itself by,
 * `navigator.userAgentData.brands`, which every Chromium Weft supports has.
 * These are the brand lists those browsers print, GREASE entry and all.
 */

const CHROME = ['Not_A Brand', 'Chromium', 'Google Chrome'];
const EDGE = ['Not_A Brand', 'Chromium', 'Microsoft Edge'];
const BRAVE = ['Brave', 'Chromium', 'Not_A Brand'];

describe('Hard Mode offers a file only where the browser obeys it', () => {
  test('the Firefox and Safari builds offer none, and say which browser that is', () => {
    assert.deepEqual(hardModeHere('firefox', []), { file: null, browser: 'Firefox' });
    assert.deepEqual(hardModeHere('safari', []), { file: null, browser: 'Safari' });
  });

  test('the Chrome package in Google Chrome offers Chrome’s file', () => {
    assert.deepEqual(hardModeHere('chrome', CHROME), { file: 'chrome' });
  });

  test('the Chrome package in Microsoft Edge offers none, though it is the same package', () => {
    assert.deepEqual(hardModeHere('chrome', EDGE), { file: null, browser: 'Microsoft Edge' });
  });

  test('any other browser that names itself is not offered Chrome’s file either', () => {
    assert.deepEqual(hardModeHere('chrome', BRAVE), { file: null, browser: 'Brave' });
    assert.deepEqual(hardModeHere('chrome', ['Opera', 'Chromium', 'Not)A;Brand']), {
      file: null,
      browser: 'Opera',
    });
  });

  test('a browser that names only Chromium, or nothing, keeps the file it had', () => {
    // Chromium on Linux reads /etc/chromium/policies/managed/, which the
    // Linux file names; the test browser the e2e suite drives names itself
    // Chromium or HeadlessChrome; and Chrome for Testing is Google's.
    for (const brands of [
      [],
      ['Chromium', 'Not=A?Brand'],
      ['HeadlessChrome', 'Not.A/Brand'],
      ['Google Chrome for Testing', 'Chromium', 'Not/A)Brand'],
    ]) {
      assert.deepEqual(hardModeHere('chrome', brands), { file: 'chrome' }, brands.join(', '));
    }
  });
});

describe('what the settings page says where there is no file', () => {
  test('it names the browser that obeys the file and the one that does not', () => {
    for (const browser of ['Firefox', 'Safari', 'Microsoft Edge', 'Brave']) {
      const said = noPolicyHere(browser);
      assert.match(said, /Google Chrome obeys/, said);
      assert.ok(said.includes(`${browser} reads no policy written for Chrome`), said);
      assert.match(said, /offers no file here/, said);
    }
  });

  test('it says why a file is not offered anyway', () => {
    assert.match(noPolicyHere('Firefox'), /would look like Hard Mode and hold nothing/);
  });
});
