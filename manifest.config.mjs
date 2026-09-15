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
  name: 'Weft — Language Immersion',
  short_name: 'Weft',
  version: VERSION,
  description:
    'Reads the web back to you with some words woven into another language. Difficulty rises with the time you spend.',
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
    default_title: 'Weft',
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
      description: 'Reveal the woven word under the cursor',
    },
    'weft-cycle': {
      suggested_key: { default: 'Alt+Shift+N', mac: 'Alt+Shift+N' },
      description: 'Move to the next woven word (keyboard reading)',
    },
    'weft-panic': {
      description: 'Use a panic pass: plain English for a few minutes',
    },
  },
};

export function buildManifest(target) {
  const m = structuredClone(SHARED);

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
