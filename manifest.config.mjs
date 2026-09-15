/**
 * Single source of truth for the extension manifest.
 *
 * Design note: Weft declares NO static content_scripts and does not request
 * <all_urls> at install time. Host access is requested per-origin from the
 * options/onboarding UI and the content script is registered dynamically with
 * chrome.scripting.registerContentScripts({persistAcrossSessions:true}).
 *
 * That costs us some code but buys three things a shipping product needs:
 *   1. No "Read and change all your data on all websites" install warning.
 *   2. A clean answer to Chrome Web Store's narrow-permission review.
 *   3. Users can hand us exactly the sites they want taxed and nothing else.
 */

export const VERSION = '1.0.0';

const SHARED = {
  manifest_version: 3,
  name: '__MSG_extName__',
  short_name: '__MSG_extShortName__',
  version: VERSION,
  description: '__MSG_extDescription__',
  default_locale: 'en',
  icons: {
    16: 'assets/icon-16.png',
    32: 'assets/icon-32.png',
    48: 'assets/icon-48.png',
    128: 'assets/icon-128.png',
  },
  permissions: [
    'storage',
    'alarms',
    'scripting',
    'tabs',
    'idle',
    'contextMenus',
    'notifications',
    'unlimitedStorage',
  ],
  optional_host_permissions: ['*://*/*'],
  action: {
    default_title: '__MSG_actionTitle__',
    default_popup: 'popup.html',
    default_icon: {
      16: 'assets/icon-16.png',
      32: 'assets/icon-32.png',
      48: 'assets/icon-48.png',
      128: 'assets/icon-128.png',
    },
  },
  options_ui: { page: 'options.html', open_in_tab: true },
  web_accessible_resources: [
    {
      resources: ['lexicon/*', 'assets/*'],
      matches: ['*://*/*'],
      use_dynamic_url: false,
    },
  ],
  commands: {
    'weft-reveal': {
      suggested_key: { default: 'Alt+Shift+R', mac: 'Alt+Shift+R' },
      description: '__MSG_commandReveal__',
    },
    'weft-cycle': {
      suggested_key: { default: 'Alt+Shift+N', mac: 'Alt+Shift+N' },
      description: '__MSG_commandCycle__',
    },
    'weft-panic': {
      description: '__MSG_commandPanic__',
    },
  },
};

/**
 * @param {'chrome'|'firefox'} target
 * @param {{ test?: boolean }} [opts] `test: true` adds a static host
 *   permission for localhost. Chrome shows a native dialog for an optional
 *   permission request, which Playwright cannot dismiss, so the end-to-end
 *   tests need the origin granted at install time. Everything else is
 *   identical, and the dynamic registration path still runs — it reads
 *   permissions.getAll(), which now simply includes localhost — so the code
 *   under test is the shipping code.
 */
export function buildManifest(target, opts = {}) {
  const m = structuredClone(SHARED);

  if (opts.test) {
    m.host_permissions = ['http://localhost/*', 'http://127.0.0.1/*'];
    m.name = 'Weft (test build)';
  }

  if (target === 'firefox') {
    // Firefox MV3 uses an event page, not a service worker, and requires an
    // explicit extension id for storage.sync and for policy targeting.
    m.background = { scripts: ['background.js'] };
    m.browser_specific_settings = {
      gecko: {
        id: 'weft@weft.study',
        strict_min_version: '128.0',
      },
    };
    // Firefox has no chrome.offscreen and gates notifications differently;
    // notifications still works, but contextMenus is `menus` there. We keep
    // contextMenus because Firefox aliases it.
  } else {
    m.background = { service_worker: 'background.js' };
    m.minimum_chrome_version = '116';
  }

  return m;
}
