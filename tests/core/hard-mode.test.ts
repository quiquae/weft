import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  HARD_MODE_PLATFORMS,
  MISSING_PLATFORMS,
  STORE_UPDATE_URL,
  hardModeHere,
  noPolicyHere,
} from '../../src/core/hard-mode.ts';

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
 *
 * Edge has a file of its own since the same day, and it holds for one copy
 * only. Microsoft's `ExtensionSettings` page: an extension "from outside the
 * Microsoft Edge Add-ons website" is force-installed only on a machine joined
 * to a domain, or on macOS one managed by MDM. Which store a copy came from is
 * the `update_url` that store wrote into the manifest it served; an unpacked
 * copy, a developer's, has none.
 */

const CHROME = ['Not_A Brand', 'Chromium', 'Google Chrome'];
const EDGE = ['Not_A Brand', 'Chromium', 'Microsoft Edge'];
const BRAVE = ['Brave', 'Chromium', 'Not_A Brand'];
const UNPACKED = undefined;

describe('Hard Mode offers a file only where the browser obeys it', () => {
  test('the Firefox and Safari builds offer none, and say which browser that is', () => {
    assert.deepEqual(hardModeHere('firefox', [], UNPACKED), { file: null, browser: 'Firefox', reason: 'browser' });
    assert.deepEqual(hardModeHere('safari', [], UNPACKED), { file: null, browser: 'Safari', reason: 'browser' });
  });

  test('the Chrome package in Google Chrome offers Chrome’s file', () => {
    assert.deepEqual(hardModeHere('chrome', CHROME, STORE_UPDATE_URL.chrome), { file: 'chrome' });
    assert.deepEqual(hardModeHere('chrome', CHROME, UNPACKED), { file: 'chrome' });
  });

  test('any other browser that names itself is not offered a file', () => {
    assert.deepEqual(hardModeHere('chrome', BRAVE, STORE_UPDATE_URL.chrome), {
      file: null,
      browser: 'Brave',
      reason: 'browser',
    });
    assert.deepEqual(hardModeHere('chrome', ['Opera', 'Chromium', 'Not)A;Brand'], UNPACKED), {
      file: null,
      browser: 'Opera',
      reason: 'browser',
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
      assert.deepEqual(hardModeHere('chrome', brands, UNPACKED), { file: 'chrome' }, brands.join(', '));
    }
  });
});

describe('Microsoft Edge is offered its own file, for the copy its policy holds', () => {
  test('the copy from Edge Add-ons is offered Edge’s file', () => {
    assert.deepEqual(hardModeHere('chrome', EDGE, STORE_UPDATE_URL.edge), { file: 'edge' });
  });

  test('an unpacked copy in Edge is offered Edge’s file, as one in Chrome is offered Chrome’s', () => {
    assert.deepEqual(hardModeHere('chrome', EDGE, UNPACKED), { file: 'edge' });
  });

  test('the Chrome Web Store’s copy in Edge is offered none, though Edge obeys its own file', () => {
    assert.deepEqual(hardModeHere('chrome', EDGE, STORE_UPDATE_URL.chrome), {
      file: null,
      browser: 'Microsoft Edge',
      reason: 'store',
    });
  });

  test('the store is read from the update address’s host, so a scheme or a slash does not hide it', () => {
    assert.deepEqual(hardModeHere('chrome', EDGE, 'http://edge.microsoft.com/extensionwebstorebase/v1/crx/'), {
      file: 'edge',
    });
    assert.deepEqual(hardModeHere('chrome', EDGE, 'http://clients2.google.com/service/update2/crx'), {
      file: null,
      browser: 'Microsoft Edge',
      reason: 'store',
    });
    // An address that is no store’s, or that does not parse, is not Edge Add-ons.
    for (const url of ['https://example.com/updates.xml', 'not a url']) {
      assert.equal(hardModeHere('chrome', EDGE, url).file, null, url);
    }
  });

  test('Edge has no Linux file: Microsoft lists its policy for Windows and macOS', () => {
    assert.deepEqual([...HARD_MODE_PLATFORMS.chrome], ['macos', 'windows', 'linux']);
    assert.deepEqual([...HARD_MODE_PLATFORMS.edge], ['macos', 'windows']);
  });

  test('a browser missing a platform says so beside the rest, and only that browser', () => {
    for (const [file, platforms] of Object.entries(HARD_MODE_PLATFORMS) as [keyof typeof HARD_MODE_PLATFORMS, readonly string[]][]) {
      const said = MISSING_PLATFORMS[file];
      if (platforms.length === 3) {
        assert.equal(said, null, `${file} has a file for every platform, and says one is missing`);
        continue;
      }
      assert.ok(said, `${file} has no file for some platform and says nothing`);
      for (const name of ['Linux', 'Windows', 'macOS']) assert.ok(said.includes(name), `${file}: ${said}`);
    }
  });
});

describe('what the settings page says where there is no file', () => {
  test('it names the browsers that obey a file and the one that obeys neither', () => {
    for (const browser of ['Firefox', 'Safari', 'Brave']) {
      const said = noPolicyHere({ browser, reason: 'browser' });
      assert.match(said, /Google Chrome and Microsoft Edge obey/, said);
      assert.ok(said.includes(`${browser} reads no policy written for Chrome or Edge`), said);
      assert.match(said, /offers no file here/, said);
    }
  });

  test('in Edge, a copy from elsewhere is told Edge holds only a copy from Edge Add-ons', () => {
    const said = noPolicyHere({ browser: 'Microsoft Edge', reason: 'store' });
    assert.match(said, /Microsoft Edge obeys/, said);
    assert.match(said, /only for a copy installed from Edge Add-ons/, said);
    assert.match(said, /this copy of Weft was installed from somewhere else/, said);
    assert.match(said, /offers no file here/, said);
  });

  test('it says why a file is not offered anyway', () => {
    assert.match(noPolicyHere({ browser: 'Firefox', reason: 'browser' }), /would look like Hard Mode and hold nothing/);
    assert.match(
      noPolicyHere({ browser: 'Microsoft Edge', reason: 'store' }),
      /would look like Hard Mode and hold nothing/,
    );
  });
});
