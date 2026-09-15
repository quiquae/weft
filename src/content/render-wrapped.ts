import type { LangCode, Settings } from '../core/types.ts';
import type { AppliedSwap, Hit, WovenRecord } from './weave.ts';
import type { Renderer } from './renderer.ts';
import { WEFT_ATTR } from './walker.ts';

/** Custom element name, so page CSS that targets `span` cannot restyle us. */
const TAG = 'weft-w';

/**
 * Element-wrapping renderer.
 *
 * Used when accessibility requires it, when the user asks for it, or when the
 * page does not look framework-managed. Each woven word becomes a
 * `<weft-w lang="fr" tabindex="0">`, which is what lets a screen reader switch
 * voice and what puts the word in the tab order.
 *
 * The structural change is the known risk: a virtual-DOM library holding a
 * reference to the text node we replaced can throw on its next render. We
 * reduce the blast radius rather than pretend it is gone — one text node is
 * replaced by one fragment, we keep every inserted node so revert is exact,
 * and the orchestrator will not choose this mode on a framework-managed page
 * unless explicitly told to.
 */
export class WrappedRenderer implements Renderer {
  readonly mode = 'wrapped' as const;

  private records = new Set<WovenRecord>();
  private activeElement: HTMLElement | null = null;

  private settings: Settings;
  private target: LangCode;

  // Explicit fields rather than TypeScript parameter properties: those are
  // not supported by type-stripping runtimes, and keeping the source loadable
  // without a compile step is what lets the DOM tests import it directly.
  constructor(settings: Settings, target: LangCode) {
    this.settings = settings;
    this.target = target;
  }

  apply(record: WovenRecord): void {
    const { node, woven, swaps } = record;
    const parent = node.parentNode;
    if (!parent) return;

    const fragment = document.createDocumentFragment();
    const inserted: Node[] = [];
    const elements: HTMLElement[] = [];
    let cursor = 0;

    for (let i = 0; i < swaps.length; i++) {
      const swap = swaps[i] as AppliedSwap;
      if (swap.start > cursor) {
        const before = document.createTextNode(woven.slice(cursor, swap.start));
        fragment.append(before);
        inserted.push(before);
      }
      const el = document.createElement(TAG);
      el.setAttribute(WEFT_ATTR, '1');
      el.setAttribute('data-weft-swap', String(i));
      el.setAttribute('lang', this.target);
      el.textContent = swap.replacement;
      if (swap.retired) el.setAttribute('data-weft-retired', '1');
      if (this.settings.a11y.keyboardCursor) el.tabIndex = 0;
      // The English word as a title is a genuine accessibility win: it is
      // what a screen reader and a long hover both surface without needing
      // our tooltip to be reachable.
      el.setAttribute('title', swap.original);
      el.setAttribute('role', 'mark');
      el.setAttribute('aria-description', `${swap.original}, in ${this.target}`);
      fragment.append(el);
      inserted.push(el);
      elements.push(el);
      cursor = swap.end;
    }

    if (cursor < woven.length) {
      const tail = document.createTextNode(woven.slice(cursor));
      fragment.append(tail);
      inserted.push(tail);
    }

    try {
      parent.replaceChild(fragment, node);
    } catch (err) {
      // The node moved out from under us between selection and application.
      // Logged in dev builds: a silent catch here once hid a real failure for
      // an hour, and the cost of the log is nothing.
      if (__WEFT_DEV__) console.warn('[weft] wrapped apply failed', err);
      return;
    }

    record.inserted = inserted;
    record.elements = elements;
    this.records.add(record);
  }

  revert(record: WovenRecord): void {
    const inserted = record.inserted;
    if (!inserted?.length) {
      this.records.delete(record);
      return;
    }
    const first = inserted[0] as Node;
    const parent = first.parentNode;
    if (!parent) {
      this.records.delete(record);
      return;
    }
    const restored = document.createTextNode(record.original);
    try {
      parent.insertBefore(restored, first);
      for (const node of inserted) {
        if (node.parentNode === parent) parent.removeChild(node);
      }
      record.node = restored;
    } catch {
      // Partially detached: leave what is there rather than risk a throw
      // inside a MutationObserver callback, which would abort the batch.
    }
    record.inserted = undefined;
    record.elements = undefined;
    this.records.delete(record);
  }

  clearRevealed(): void {
    if (this.activeElement) {
      this.activeElement.removeAttribute('data-weft-active');
      this.activeElement = null;
    }
  }

  setRevealed(record: WovenRecord, swap: AppliedSwap): void {
    this.clearRevealed();
    const index = record.swaps.indexOf(swap);
    const el = record.elements?.[index];
    if (!el) return;
    el.setAttribute('data-weft-active', '1');
    this.activeElement = el;
  }

  hitTest(x: number, y: number, _lookup: (node: Text) => WovenRecord | undefined): Hit | null {
    const el = document.elementFromPoint(x, y);
    const host = el?.closest?.(`${TAG}[data-weft-swap]`) as HTMLElement | null;
    if (!host) return null;
    return this.hitForElement(host);
  }

  /** Resolve an element back to its record, used by hit-testing and keyboard. */
  hitForElement(el: HTMLElement): Hit | null {
    const index = Number(el.getAttribute('data-weft-swap'));
    for (const record of this.records) {
      if (record.elements?.[index] === el) {
        const swap = record.swaps[index];
        if (swap) return { record, swap };
      }
    }
    return null;
  }

  rectFor(record: WovenRecord, swap: AppliedSwap): DOMRect | null {
    const index = record.swaps.indexOf(swap);
    const el = record.elements?.[index];
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return rect.width || rect.height ? rect : null;
  }

  /** All woven elements in document order, for the keyboard cursor. */
  elementsInOrder(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>(`${TAG}[data-weft-swap]`)];
  }

  flush(): void {
    // Elements are self-maintaining; nothing to reconcile.
  }

  updateSettings(settings: Settings): void {
    this.settings = settings;
  }

  destroy(): void {
    for (const record of [...this.records]) this.revert(record);
    this.records.clear();
  }
}

export type RenderModeChoice = {
  mode: 'highlight' | 'wrapped';
  reason: string;
};

/**
 * Decide which renderer to use for this page.
 *
 * `auto` prefers the structurally safe renderer, and only wraps when nothing
 * on the page suggests a virtual DOM. An explicit accessibility preference
 * overrides that, because a screen-reader user reading French pronounced as
 * English is worse off than a page with an occasional hydration warning — and
 * that is the user's call to make, not ours.
 */
export function resolveRenderMode(
  settings: Settings,
  framework: string | null,
  highlightSupported: boolean,
): RenderModeChoice {
  if (settings.a11y.preferWrappedForAT) {
    return { mode: 'wrapped', reason: 'accessibility preference: words carry lang and focus' };
  }
  if (settings.weave.renderMode === 'wrapped') {
    return { mode: 'wrapped', reason: 'set explicitly in settings' };
  }
  if (settings.weave.renderMode === 'highlight') {
    if (!highlightSupported) {
      return { mode: 'wrapped', reason: 'highlight requested but unsupported in this browser' };
    }
    return { mode: 'highlight', reason: 'set explicitly in settings' };
  }
  if (!highlightSupported) {
    return { mode: 'wrapped', reason: 'CSS Custom Highlight API unavailable' };
  }
  if (framework) {
    return { mode: 'highlight', reason: `${framework} detected: avoiding DOM structure changes` };
  }
  return { mode: 'highlight', reason: 'default: no DOM structure changes' };
}
