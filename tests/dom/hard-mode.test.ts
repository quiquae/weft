import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

/**
 * Hard Mode's file holds its own way out.
 *
 * docs/HARD-MODE.md rests the case that Hard Mode is "defensible rather than
 * malware behaviour" on three things, and the second is that "the removal
 * procedure ships inside the generated file". The options page tells a buyer
 * the same: "the file you download contains its own removal instructions".
 * Until 2026-11-06 the page showed the steps and the download held none of
 * them. The macOS profile's only mention of removal was the key
 * `PayloadRemovalDisallowed`, and the Linux file was bare JSON. The page is
 * closed the moment the file is saved; the file is what somebody finds again,
 * months later, on the day they want out.
 *
 * Each file is read the way the thing that installs it reads it, because a
 * way out written somewhere its reader refuses breaks Hard Mode rather than
 * explaining it. The macOS profile goes through a strict XML parser — a
 * comment may not hold `--`, and a plist string may not hold a bare `&`,
 * though the pane it names is "Privacy & Security". The Linux file is read as
 * Chrome reads a managed-policy file: `config_dir_policy_loader.cc` parses it
 * with `JSON_PARSE_CHROMIUM_EXTENSIONS`, which includes `JSON_ALLOW_COMMENTS`
 * and has since before Chrome 116, Weft's floor. The `.reg` file must open
 * with its header line and hold nothing regedit would read as a key or value
 * but the policy itself.
 *
 * jsdom is here for its XML parser, which is strict where a regular
 * expression would be hopeful.
 *
 * Microsoft Edge has a file of its own since 2026-11-07, for the copy of Weft
 * from Edge Add-ons, which is the only one Edge force-installs on a machine
 * nobody manages: the profile's domain is `com.microsoft.Edge`, the `.reg`
 * key `SOFTWARE\Policies\Microsoft\Edge`, and Microsoft lists the policy for
 * Windows and macOS, so there is no Linux file. Each test below reads both
 * browsers' files where both exist.
 */

const ID = 'abcdefghijklmnopabcdefghijklmnop';

/**
 * What the macOS steps have to name for somebody to find their way out: the
 * pane, the control and what it will ask for, and the profile as System
 * Settings lists it, which each test reads off the file it checks. Apple's guide, read 2026-11-06 at its macOS 27 version, puts
 * profiles in "General > Device Management" and removes one with "the Remove
 * button"; macOS before the move kept them in "Privacy & Security >
 * Profiles", which is all the steps named until then.
 */
const REMOVE_MACOS = ['General > Device Management', 'Privacy & Security > Profiles', 'Remove', 'administrator password'];
const g = globalThis as unknown as Record<string, unknown>;
g['__WEFT_TARGET__'] = 'chrome';
g['chrome'] = { runtime: { id: ID, getManifest: () => ({}) } };
const { profileFor } = await import('../../src/background/hard-mode.ts');
const { STORE_UPDATE_URL } = await import('../../src/core/hard-mode.ts');

/** Each browser Weft writes a file for, as the worker running in it sees itself. */
const BROWSERS = [
  {
    name: 'Chrome',
    brands: ['Not_A Brand', 'Chromium', 'Google Chrome'],
    update: STORE_UPDATE_URL.chrome,
    platforms: ['macos', 'windows', 'linux'],
    domain: 'com.google.Chrome',
    key: `HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome\\ExtensionSettings\\${ID}`,
    settings: { installation_mode: 'force_installed', update_url: STORE_UPDATE_URL.chrome, toolbar_pin: 'force_pinned' },
    own: 'chrome://',
    other: /edge:\/\/|Microsoft/,
  },
  {
    name: 'Edge',
    brands: ['Not_A Brand', 'Chromium', 'Microsoft Edge'],
    update: STORE_UPDATE_URL.edge,
    platforms: ['macos', 'windows'],
    domain: 'com.microsoft.Edge',
    key: `HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Edge\\ExtensionSettings\\${ID}`,
    settings: { installation_mode: 'force_installed', update_url: STORE_UPDATE_URL.edge, toolbar_state: 'force_shown' },
    own: 'edge://',
    other: /chrome:\/\/|Google/,
  },
] as const;

type Platform = 'macos' | 'windows' | 'linux';
type Browser = (typeof BROWSERS)[number];
const write = (b: Browser, platform: Platform) => profileFor(platform, b.brands, b.update);

const { DOMParser, Node: DomNode } = new JSDOM('').window;

/** Every comment in a parsed document, in order, as one string. */
function commentText(root: Node): string {
  const out: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === DomNode.COMMENT_NODE) out.push(node.textContent ?? '');
    for (const child of Array.from(node.childNodes)) walk(child);
  };
  walk(root);
  return out.join('\n');
}

/** The value of a key in a plist `<dict>`, read as a plist reader pairs them. */
function dictValue(dict: Element, key: string): Element | undefined {
  const children = Array.from(dict.children);
  const at = children.findIndex((child) => child.tagName === 'key' && child.textContent === key);
  return at >= 0 ? children[at + 1] : undefined;
}

/** A parsed profile's top-level dictionary, failing on a file that is not well-formed. */
function profileDict(contents: string): { doc: Document; top: Element } {
  const doc = new DOMParser().parseFromString(contents, 'application/xml');
  const error = doc.getElementsByTagName('parsererror')[0];
  assert.equal(error, undefined, `the profile is not well-formed XML: ${error?.textContent}`);
  const top = doc.querySelector('plist > dict');
  assert.ok(top, 'the profile has no top-level dictionary');
  return { doc, top };
}

/** The name a string is said under, and not a longer name it begins. */
const names = (text: string, name: string) =>
  new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?! \\()`).test(text);

describe('the Hard Mode file you download says how to take it off', () => {
  for (const b of BROWSERS) {
    test(`${b.name}’s macOS profile parses, and says in itself how to remove it`, () => {
      const { doc, top } = profileDict(write(b, 'macos').contents);
      // System Settings lists a profile by its top-level display name, so that
      // is the name the steps have to give.
      const listed = dictValue(top, 'PayloadDisplayName')?.textContent ?? '';
      assert.match(listed, /^Weft — Hard Mode/, 'the profile is not listed as Weft’s Hard Mode');

      const comments = commentText(doc);
      for (const words of REMOVE_MACOS) {
        assert.ok(comments.includes(words), `the profile's comments never say "${words}"`);
      }
      assert.ok(names(comments, listed), `the profile's comments never name it as listed, "${listed}"`);

      // A comment is for whoever opens the file. System Settings shows neither
      // the file nor its comments, only the profile's description, and that
      // pane is where somebody stands when they want it gone.
      const description = dictValue(top, 'PayloadDescription');
      assert.equal(description?.tagName, 'string', 'the profile has no PayloadDescription');
      for (const words of REMOVE_MACOS) {
        assert.ok(
          description.textContent?.includes(words),
          `the description System Settings shows never says "${words}"`,
        );
      }
      assert.ok(
        names(description.textContent ?? '', listed),
        `the description System Settings shows never names the profile as listed, "${listed}"`,
      );
    });
  }

  for (const b of BROWSERS) {
    test(`${b.name}’s .reg file says how to delete every key it writes, in comments regedit skips`, () => {
      const { contents } = write(b, 'windows');
      const lines = contents.replace(/\n$/, '').split('\n');
      assert.equal(lines[0], 'Windows Registry Editor Version 5.00', 'a .reg file must open with its header');

      const keys: string[] = [];
      const comments: string[] = [];
      for (const [i, line] of lines.slice(1).entries()) {
        if (line.trim() === '') continue;
        if (line.startsWith(';')) comments.push(line.slice(1).trim());
        else if (/^\[[^\]]+\]$/.test(line)) keys.push(line.slice(1, -1));
        else assert.match(line, /^"[^"]+"="[^"]*"$/, `line ${i + 2} is neither a comment, a key nor a value: ${line}`);
      }
      assert.ok(keys.length > 0, 'the file writes no key, so this proves nothing');
      for (const key of keys) {
        assert.ok(
          comments.includes(`[-${key}]`),
          `nothing in the file says how to delete [${key}]`,
        );
      }
      // regedit reads a version 5 file as UTF-16 or the ANSI code page, never
      // as the UTF-8 a Blob writes, so only ASCII survives the trip unchanged.
      assert.match(contents, /^[\x00-\x7f]*$/, 'the .reg file holds a character outside ASCII');
    });
  }

  test('the Linux file is the policy to Chrome, and says how to delete it from both directories', () => {
    const { contents, filename } = write(BROWSERS[0], 'linux');
    const lines = contents.split('\n');
    const comments = lines.filter((line) => line.trimStart().startsWith('//'));
    const policy = JSON.parse(lines.filter((line) => !line.trimStart().startsWith('//')).join('\n')) as {
      ExtensionSettings: Record<string, { installation_mode: string }>;
    };
    assert.equal(policy.ExtensionSettings[ID]?.installation_mode, 'force_installed');

    const said = comments.join('\n');
    for (const dir of ['/etc/opt/chrome/policies/managed/', '/etc/chromium/policies/managed/']) {
      assert.ok(said.includes(`sudo rm ${dir}${filename}`), `nothing in the file says to delete it from ${dir}`);
    }
  });

  test('no instructions state a length the file does not have', () => {
    for (const b of BROWSERS) {
      for (const platform of b.platforms) {
        const { contents, instructions } = write(b, platform);
        const length = contents.replace(/\n$/, '').split('\n').length;
        for (const [, stated] of instructions.matchAll(/(\d+) lines/g)) {
          assert.equal(Number(stated), length, `${b.name}'s ${platform} instructions say ${stated} lines of a ${length}-line file`);
        }
      }
    }
  });
});

/**
 * A file names one browser's policy, and holds there, or it names a place the
 * browser running it never reads. Chrome reads `com.google.Chrome` and
 * `Policies\Google\Chrome`, Edge `com.microsoft.Edge` and
 * `Policies\Microsoft\Edge`, and Edge pins a toolbar icon with its own
 * `toolbar_state`, which Microsoft's ExtensionSettings guide gives from Edge
 * 103, where Chrome's is `toolbar_pin`.
 */
describe('each browser’s file is that browser’s policy, and says that browser’s steps', () => {
  /** A plist dictionary's string values, by key. */
  const strings = (dict: Element | undefined) =>
    Object.fromEntries(
      Array.from(dict?.children ?? [])
        .filter((child) => child.tagName === 'key')
        .map((key) => [key.textContent, key.nextElementSibling?.textContent]),
    );

  for (const b of BROWSERS) {
    test(`${b.name}’s macOS profile sets ${b.domain}’s ExtensionSettings for this copy`, () => {
      const { top } = profileDict(write(b, 'macos').contents);
      const payload = dictValue(top, 'PayloadContent')?.querySelector(':scope > dict');
      assert.ok(payload, 'the profile carries no payload');
      assert.equal(dictValue(payload, 'PayloadType')?.textContent, b.domain);
      const settings = dictValue(payload, 'ExtensionSettings');
      assert.ok(settings, 'the payload sets no ExtensionSettings');
      assert.deepEqual(strings(dictValue(settings, ID)), b.settings);
    });

    test(`${b.name}’s .reg file writes ${b.name}’s policy key for this copy`, () => {
      const { contents } = write(b, 'windows');
      const at = contents.indexOf(`[${b.key}]`);
      assert.notEqual(at, -1, `the file writes no [${b.key}]`);
      const values = Object.fromEntries(
        contents
          .slice(at)
          .split('\n')
          .slice(1)
          .filter((line) => line.startsWith('"'))
          .map((line) => line.split('=').map((side) => JSON.parse(side))),
      );
      assert.deepEqual(values, b.settings);
    });

    test(`${b.name}’s files say ${b.own} and never the other browser’s pages or vendor`, () => {
      for (const platform of b.platforms) {
        const { contents, instructions } = write(b, platform);
        assert.ok(instructions.includes(`${b.own}policy`), `${b.name}'s ${platform} steps never say ${b.own}policy`);
        assert.doesNotMatch(contents, b.other, `${b.name}'s ${platform} file names the other browser`);
      }
    });
  }

  test('Chrome’s and Edge’s files can be installed side by side, and removed one at a time', () => {
    const [chrome, edge] = BROWSERS.map((b) => profileDict(write(b, 'macos').contents).top);
    for (const key of ['PayloadIdentifier', 'PayloadDisplayName', 'PayloadUUID']) {
      // A profile with another's identifier replaces it on install.
      assert.notEqual(dictValue(chrome!, key)?.textContent, dictValue(edge!, key)?.textContent, key);
    }
    for (const platform of ['macos', 'windows'] as const) {
      assert.notEqual(write(BROWSERS[0], platform).filename, write(BROWSERS[1], platform).filename, platform);
    }
  });
});

/**
 * The settings page offers the file only where the browser obeys it
 * (`hardModeHere()` in `src/core/hard-mode.ts`). The worker that writes it
 * refuses on its own as well, so a page that one day offers the button in the
 * wrong place still hands nobody a file that looks like Hard Mode and holds
 * nothing. Until 2026-11-07 every build wrote Chrome's policy for whoever asked.
 */
describe('no file is written for a browser that would not obey it', () => {
  test('the Firefox and Safari builds refuse on every platform, naming the browser', () => {
    for (const [target, browser] of [
      ['firefox', 'Firefox'],
      ['safari', 'Safari'],
    ] as const) {
      g['__WEFT_TARGET__'] = target;
      try {
        for (const platform of ['macos', 'windows', 'linux'] as const) {
          assert.throws(
            () => profileFor(platform),
            new RegExp(`${browser} reads no policy written for Chrome or Edge`),
            `the ${target} build wrote a ${platform} file`,
          );
        }
      } finally {
        g['__WEFT_TARGET__'] = 'chrome';
      }
    }
  });

  test('the Chrome package writes Chrome’s file in Google Chrome', () => {
    for (const platform of ['macos', 'windows', 'linux'] as const) {
      const { contents } = profileFor(platform, BROWSERS[0].brands, STORE_UPDATE_URL.chrome);
      assert.ok(contents.includes(ID), `Google Chrome was not handed its ${platform} file`);
    }
  });

  test('in Microsoft Edge it writes Edge’s file for the Edge Add-ons or unpacked copy, and none for the Chrome Web Store’s', () => {
    for (const platform of ['macos', 'windows'] as const) {
      for (const update of [STORE_UPDATE_URL.edge, undefined]) {
        const { contents } = profileFor(platform, BROWSERS[1].brands, update);
        assert.match(contents, /com\.microsoft\.Edge|Microsoft\\Edge/, `Edge was not handed Edge's ${platform} file`);
      }
      assert.throws(
        () => profileFor(platform, BROWSERS[1].brands, STORE_UPDATE_URL.chrome),
        /only for a copy installed from Edge Add-ons/,
        `Edge was handed a ${platform} file for the Chrome Web Store's copy, which it would not hold`,
      );
    }
  });

  test('in Microsoft Edge there is no Linux file, whichever copy is running', () => {
    for (const update of [STORE_UPDATE_URL.edge, undefined]) {
      assert.throws(() => profileFor('linux', BROWSERS[1].brands, update), /Windows and macOS only/, String(update));
    }
    // The Chrome Web Store's copy is refused for its store before its platform.
    assert.throws(() => profileFor('linux', BROWSERS[1].brands, STORE_UPDATE_URL.chrome), /Edge Add-ons/);
  });
});
