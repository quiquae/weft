import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The capability shim, tested against each engine's real API shape.
 *
 * This file exists because of a bug that no test could have caught in its
 * previous form. `src/shared/browser.ts` exported:
 *
 *     export const isFirefox = typeof browser !== 'undefined' && browser !== undefined;
 *
 * Safari also defines `browser`, so that constant answered "Firefox" when
 * running in Safari. Nothing read it, so nothing broke — but the next person
 * to write `if (isFirefox)` would have shipped Firefox behaviour to every
 * Safari user, and the failure would have surfaced in App Store review rather
 * than in CI.
 *
 * It was replaced with capability probes, and these tests fake each engine's
 * namespace to prove the probes answer correctly. The Safari case is the one
 * that matters: no `notifications` at all, and `menus` instead of
 * `contextMenus`.
 */

const g = globalThis as unknown as Record<string, unknown>;

/** Build-time constants esbuild would otherwise have inlined. */
function defineBuildGlobals(target: string): void {
  g['__WEFT_TARGET__'] = target;
  g['__WEFT_VERSION__'] = '0.0.0-test';
  g['__WEFT_DEV__'] = false;
}

/**
 * Load a fresh copy of the shim against a faked namespace.
 *
 * The module resolves `api` once at import time, exactly as it does in a real
 * extension, so each scenario needs its own module instance. The query string
 * defeats the module cache.
 */
let counter = 0;
async function loadShim(opts: {
  target: string;
  /** Present as the `browser` global, as Firefox and Safari both do. */
  asBrowser?: boolean;
  namespace: Record<string, unknown>;
}) {
  defineBuildGlobals(opts.target);
  delete g['browser'];
  delete g['chrome'];
  if (opts.asBrowser) g['browser'] = opts.namespace;
  g['chrome'] = opts.asBrowser ? undefined : opts.namespace;
  return import(`../../src/shared/browser.ts?case=${counter++}`);
}

/** What Chrome exposes, reduced to the parts the shim probes. */
const CHROME_NS = {
  runtime: { id: 'abc', getURL: (p: string) => `chrome-extension://abc/${p}` },
  notifications: { create: () => {} },
  contextMenus: { create: () => {}, removeAll: () => {}, onClicked: { addListener: () => {} } },
  commands: { onCommand: { addListener: () => {} } },
  action: { setBadgeText: () => {}, setTitle: () => {} },
};

/** Firefox: `browser`, has everything, and aliases both menu names. */
const FIREFOX_NS = {
  ...CHROME_NS,
  menus: CHROME_NS.contextMenus,
};

/**
 * Safari: no notifications at all, `menus` rather than `contextMenus`, and
 * no `commands` below Safari 26.
 */
const SAFARI_NS = {
  runtime: { id: 'abc', getURL: (p: string) => `safari-web-extension://abc/${p}` },
  menus: { create: () => {}, removeAll: () => {}, onClicked: { addListener: () => {} } },
  action: { setBadgeText: () => {}, setTitle: () => {} },
};

describe('capability probes', () => {
  test('Chrome: everything available', async () => {
    const { can, ENGINE } = await loadShim({ target: 'chrome', namespace: CHROME_NS });
    assert.equal(ENGINE, 'chrome');
    assert.equal(can.notify, true);
    assert.equal(can.contextMenus, true);
    assert.equal(can.commands, true);
    assert.equal(can.badge, true);
  });

  test('Firefox: everything available via the browser global', async () => {
    const { can, ENGINE } = await loadShim({
      target: 'firefox',
      asBrowser: true,
      namespace: FIREFOX_NS,
    });
    assert.equal(ENGINE, 'firefox');
    assert.equal(can.notify, true);
    assert.equal(can.contextMenus, true);
  });

  test('Safari: notifications absent, badge present', async () => {
    // The exact combination the fallback depends on. If Safari ever lacked
    // setBadgeText too, notify() would have nothing to fall back to and the
    // compat audit would have to flag it.
    const { can, ENGINE } = await loadShim({
      target: 'safari',
      asBrowser: true,
      namespace: SAFARI_NS,
    });
    assert.equal(ENGINE, 'safari');
    assert.equal(can.notify, false, 'Safari has never implemented notifications');
    assert.equal(can.badge, true, 'the notification fallback needs the badge');
  });

  test('Safari: commands absent below Safari 26', async () => {
    const { can } = await loadShim({ target: 'safari', asBrowser: true, namespace: SAFARI_NS });
    assert.equal(can.commands, false);
  });

  test('probes are live, so a namespace gaining an API is picked up', async () => {
    // `can` uses getters rather than constants precisely so that a browser
    // release adding an API does not need a Weft rebuild.
    const ns: Record<string, unknown> = { runtime: { id: 'abc' } };
    const { can } = await loadShim({ target: 'safari', asBrowser: true, namespace: ns });
    assert.equal(can.notify, false);
    ns['notifications'] = { create: () => {} };
    assert.equal(can.notify, true, 'probe was evaluated once at import instead of on read');
  });
});

describe('contextMenus namespace resolution', () => {
  test('Chrome: returns contextMenus', async () => {
    const { contextMenus } = await loadShim({ target: 'chrome', namespace: CHROME_NS });
    assert.equal(contextMenus(), CHROME_NS.contextMenus);
  });

  test('Safari: falls back to menus', async () => {
    const { contextMenus } = await loadShim({
      target: 'safari',
      asBrowser: true,
      namespace: SAFARI_NS,
    });
    assert.equal(contextMenus(), SAFARI_NS.menus, 'Safari names the namespace "menus"');
  });

  test('returns undefined rather than throwing when neither exists', async () => {
    const { contextMenus } = await loadShim({
      target: 'safari',
      asBrowser: true,
      namespace: { runtime: { id: 'abc' } },
    });
    assert.equal(contextMenus(), undefined);
  });
});

describe('the bug this file exists for', () => {
  test('no engine-identity export survives that Safari would answer wrongly', async () => {
    const shim = await loadShim({ target: 'safari', asBrowser: true, namespace: SAFARI_NS });
    assert.equal(
      'isFirefox' in shim,
      false,
      'isFirefox is back; it is true in Safari and will mislead the next caller',
    );
  });

  test('ENGINE is the declared build target, not sniffed from the namespace', async () => {
    // A Safari build wrapping the Chrome bundle would still report chrome,
    // which is correct: ENGINE answers "which package is this", and the
    // capability probes answer "what can it do".
    const { ENGINE } = await loadShim({ target: 'safari', asBrowser: true, namespace: CHROME_NS });
    assert.equal(ENGINE, 'safari');
  });
});
