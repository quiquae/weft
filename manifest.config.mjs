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
 *
 * Permissions are per-target rather than shared, because a permission a
 * browser does not implement is not free: Safari has never shipped
 * `notifications`, and declaring it there means an install prompt asking for
 * something that can never work, in front of a human reviewer who knows that.
 * `tools/compat-audit.mjs` checks every key here against MDN's compatibility
 * data and fails the build when one of them is unsupported on the target.
 */

export const VERSION = '1.1.0';

/**
 * Browser floors, each set by the newest thing Weft genuinely needs.
 *
 *  - Chrome 116: the CSS Custom Highlight API (105) plus MV3 dynamic
 *    registration, rounded up to a version worth supporting.
 *  - Firefox 140: `data_collection_permissions`, which addons.mozilla.org
 *    requires of every new add-on since 2025-11-03. (128 brought
 *    `optional_host_permissions`, which the per-origin consent design rests
 *    on.)
 *  - Safari 16.4: `scripting.registerContentScripts` (16.4) and
 *    `adoptedStyleSheets` (16.4). The Highlight API only arrives in Safari
 *    17.2, so 16.4–17.1 runs the wrapped renderer instead — a degradation
 *    the content script already detects and handles, rather than a floor.
 */
export const MINIMUMS = {
  chrome: '116',
  firefox: '140.0',
  safari: '16.4',
};

export const TARGETS = ['chrome', 'firefox', 'safari'];

/** Permissions every target needs and every target implements. */
const CORE_PERMISSIONS = ['storage', 'alarms', 'scripting', 'tabs', 'contextMenus'];

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
 * @param {'chrome'|'firefox'|'safari'} target
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
  m.permissions = [...CORE_PERMISSIONS];

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
        strict_min_version: MINIMUMS.firefox,
        // Nothing leaves by default. With the reader's own translation key,
        // words from the page go to the service they chose, which Mozilla
        // counts as website content, and Firefox asks them first.
        data_collection_permissions: { required: ['none'], optional: ['websiteContent'] },
      },
      // Data collection consent reached Firefox for Android in 142. Without
      // this floor AMO's linter warns that Android 140 cannot read the key.
      gecko_android: { strict_min_version: '142.0' },
    };
    m.permissions.push('notifications');
  } else if (target === 'safari') {
    // Safari 15.4+ runs an MV3 service worker. It does NOT implement
    // notifications or idle at all, so neither is declared: the background
    // script falls back to a toolbar badge, which Safari does support.
    m.background = { service_worker: 'background.js' };
    m.browser_specific_settings = {
      safari: { strict_min_version: MINIMUMS.safari },
    };
  } else {
    m.background = { service_worker: 'background.js' };
    m.minimum_chrome_version = MINIMUMS.chrome;
    m.permissions.push('notifications');
    // Chrome 130+ only, and `false` is the default everywhere else, so it is
    // declared for Chrome alone to avoid an "unrecognised key" warning at
    // review on the other two stores.
    m.web_accessible_resources[0].use_dynamic_url = false;
  }

  return m;
}
