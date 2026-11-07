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
 */

const ID = 'abcdefghijklmnopabcdefghijklmnop';

/**
 * What the macOS steps have to name for somebody to find their way out: the
 * pane, the profile as System Settings lists it, the control and what it will
 * ask for. Apple's guide, read 2026-11-06 at its macOS 27 version, puts
 * profiles in "General > Device Management" and removes one with "the Remove
 * button"; macOS before the move kept them in "Privacy & Security >
 * Profiles", which is all the steps named until then.
 */
const REMOVE_MACOS = [
  'General > Device Management',
  'Privacy & Security > Profiles',
  'Weft — Hard Mode',
  'Remove',
  'administrator password',
];
const g = globalThis as unknown as Record<string, unknown>;
g['__WEFT_TARGET__'] = 'chrome';
g['chrome'] = { runtime: { id: ID } };
const { profileFor } = await import('../../src/background/hard-mode.ts');

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

describe('the Hard Mode file you download says how to take it off', () => {
  test('the macOS profile parses, and says in itself how to remove it', () => {
    const { contents } = profileFor('macos');
    const doc = new DOMParser().parseFromString(contents, 'application/xml');
    const error = doc.getElementsByTagName('parsererror')[0];
    assert.equal(error, undefined, `the profile is not well-formed XML: ${error?.textContent}`);

    const comments = commentText(doc);
    for (const words of REMOVE_MACOS) {
      assert.ok(comments.includes(words), `the profile's comments never say "${words}"`);
    }

    // A comment is for whoever opens the file. System Settings shows neither
    // the file nor its comments, only the profile's description, and that
    // pane is where somebody stands when they want it gone.
    const top = doc.querySelector('plist > dict');
    assert.ok(top, 'the profile has no top-level dictionary');
    const description = dictValue(top, 'PayloadDescription');
    assert.equal(description?.tagName, 'string', 'the profile has no PayloadDescription');
    for (const words of REMOVE_MACOS) {
      assert.ok(
        description.textContent?.includes(words),
        `the description System Settings shows never says "${words}"`,
      );
    }
  });

  test('the .reg file says how to delete every key it writes, in comments regedit skips', () => {
    const { contents } = profileFor('windows');
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

  test('the Linux file is the policy to Chrome, and says how to delete it from both directories', () => {
    const { contents, filename } = profileFor('linux');
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
    for (const platform of ['macos', 'windows', 'linux'] as const) {
      const { contents, instructions } = profileFor(platform);
      const length = contents.replace(/\n$/, '').split('\n').length;
      for (const [, stated] of instructions.matchAll(/(\d+) lines/g)) {
        assert.equal(Number(stated), length, `the ${platform} instructions say ${stated} lines of a ${length}-line file`);
      }
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
            new RegExp(`${browser} reads no policy written for Chrome`),
            `the ${target} build wrote a ${platform} file`,
          );
        }
      } finally {
        g['__WEFT_TARGET__'] = 'chrome';
      }
    }
  });

  test('the Chrome package refuses in Microsoft Edge, and writes in Google Chrome', () => {
    for (const platform of ['macos', 'windows', 'linux'] as const) {
      assert.throws(
        () => profileFor(platform, ['Not_A Brand', 'Chromium', 'Microsoft Edge']),
        /Microsoft Edge reads no policy written for Chrome/,
        `Edge was handed a ${platform} file`,
      );
      const { contents } = profileFor(platform, ['Not_A Brand', 'Chromium', 'Google Chrome']);
      assert.ok(contents.includes(ID), `Google Chrome was not handed its ${platform} file`);
    }
  });
});
