import type { LexPack } from '../core/types.ts';
import { getLanguage } from '../core/languages.ts';
import { send } from '../shared/rpc.ts';
import { api, contextAlive, resourceUrl } from '../shared/browser.ts';
import { detectFramework, documentLanguageMatches } from './walker.ts';
import { HighlightRenderer } from './render-highlight.ts';
import { WrappedRenderer, resolveRenderMode } from './render-wrapped.ts';
import type { Renderer } from './renderer.ts';
import { WeftPage, applyLetterformsToPack } from './page.ts';

/**
 * Page orchestrator.
 *
 * Runs once per top-level document. Responsibilities, in the order they
 * matter: decide whether to act at all, weave, keep weaving as the page
 * mutates, raise difficulty as attention accumulates, and get out of the way
 * completely when asked.
 *
 * The first is decided here. The rest is `WeftPage`, in `page.ts`, which
 * this module starts and hands the popup's and the worker's messages to.
 */

declare global {
  interface Window {
    __weftActive?: boolean;
  }
}

/** Packs are fetched from disk once per document and cached per language. */
const packCache = new Map<string, LexPack>();

async function loadPack(source: string, target: string): Promise<LexPack | null> {
  const key = `${source}-${target}`;
  const cached = packCache.get(key);
  if (cached) return cached;
  try {
    const response = await fetch(resourceUrl(`lexicon/${key}.json`));
    if (!response.ok) return null;
    const pack = (await response.json()) as LexPack;
    packCache.set(key, pack);
    return pack;
  } catch {
    // The pack is a packaged resource, so a failure here means the extension
    // is being updated or the resource list is wrong. Either way, no weave.
    return null;
  }
}

/* ------------------------------------------------------------ bootstrap */

let page: WeftPage | null = null;

/**
 * Why this page is not being woven, when the answer would surprise someone.
 *
 * boot() has six early returns and three of them are failures a reader
 * cannot see: the worker did not answer, the page declares a language
 * other than the one they read in, or the lexicon would not load. In each case
 * they switched Weft on, the page looks entirely normal, and nothing
 * anywhere says why — which reads as a broken extension rather than as a
 * considered decision.
 *
 * Module scope on purpose: the message listener below is registered whether
 * or not boot() got anywhere, so the popup can ask even when nothing
 * started.
 */
let inactiveReason: string | null = null;

async function boot(): Promise<void> {
  // Re-injection happens on extension update and on manual re-registration.
  if (window.__weftActive) return;
  window.__weftActive = true;

  if (window.top !== window) return; // top-level documents only
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => void boot(), { once: true });
    window.__weftActive = false;
    return;
  }

  const state = await send({ type: 'get-page-state', url: location.href });
  if (!state) {
    inactiveReason = 'Weft could not reach its background worker. Reloading the page usually fixes it.';
    return;
  }
  if (state.decision.mode === 'excluded' || state.decision.mode === 'off') return;
  if (state.panicActive) return;
  if (!documentLanguageMatches(state.settings.learning.sourceLang)) {
    // Not a fault: weaving French into a French page would be nonsense.
    // But it is invisible, and "nothing happened" needs a reason.
    inactiveReason = `This page is not in ${getLanguage(state.settings.learning.sourceLang).name}, so there is nothing to weave from.`;
    return;
  }

  const raw = await loadPack(state.settings.learning.sourceLang, state.decision.target);
  if (!raw) {
    inactiveReason = 'The word list for this language would not load. Reinstalling Weft replaces it.';
    return;
  }
  const pack = applyLetterformsToPack(raw, state.settings);

  const framework = detectFramework();
  const supported = HighlightRenderer.supported();
  const choice = resolveRenderMode(state.settings, framework, supported);
  const renderer: Renderer =
    choice.mode === 'highlight'
      ? new HighlightRenderer()
      : new WrappedRenderer(state.settings, state.decision.target);

  if (__WEFT_DEV__) {
    console.info(
      `[weft] ${choice.mode} (${choice.reason}); ratio ${(state.ratio * 100).toFixed(1)}%; ` +
        `${Object.keys(pack.entries).length} surface forms`,
    );
  }

  inactiveReason = null;
  page = new WeftPage(state, pack, renderer);
  page.start();
}

if (contextAlive()) {
  api.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    const msg = message as { type?: string };
    if (msg.type === 'weft-sample') {
      // The popup's interlinear strip shows words actually woven into the
      // page in front of the user, not a canned sample. Real content is the
      // whole point of the device.
      sendResponse({
        pairs: page?.sample(3) ?? [],
        ratio: page?.currentRatio() ?? 0,
        ...(inactiveReason ? { reason: inactiveReason } : {}),
      });
      return undefined;
    }
    if (!page) return undefined;
    switch (msg.type) {
      case 'weft-cycle':
        page.moveCursor(1);
        return undefined;
      case 'weft-cycle-back':
        page.moveCursor(-1);
        return undefined;
      case 'weft-reveal':
        page.revealAtPointer();
        return undefined;
      case 'weft-suspend':
        page.suspend();
        return undefined;
      case 'weft-resume':
        page.resume();
        return undefined;
      case 'weft-teardown':
        page.destroy();
        page = null;
        return undefined;
      case 'weft-settings-changed':
        void refresh();
        return undefined;
      default:
        return undefined;
    }
  });
}

async function refresh(): Promise<void> {
  if (!page) return;
  const state = await send({ type: 'get-page-state', url: location.href });
  if (!state) return;
  if (state.decision.mode === 'excluded' || state.decision.mode === 'off' || state.panicActive) {
    page.suspend();
    return;
  }
  page.applySettings(state.settings, state.ratio, state.effectiveLevel);
}

void boot();

export {};
