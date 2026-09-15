import type { Settings } from '../core/types.ts';
import type { AppliedSwap, Hit, WovenRecord } from './weave.ts';

/**
 * Two ways to put a foreign word on the page, behind one interface.
 *
 * `highlight` edits nodeValue and styles character ranges: no DOM structure
 * changes, so no framework's node references are invalidated. It is the
 * default and it is what makes Weft safe on a React feed.
 *
 * `wrapped` replaces the text node with elements. That breaks the safety
 * property, but it buys two things nothing else can: a `lang` attribute, so a
 * screen reader pronounces the French word in French rather than reading it
 * as mangled English, and a focusable element, so the words are reachable by
 * Tab. For a user on assistive technology those are not niceties.
 *
 * The choice is therefore a real trade-off rather than a default plus a
 * fallback, and `resolveRenderMode` makes it per-page.
 */
export interface Renderer {
  readonly mode: 'highlight' | 'wrapped';
  apply(record: WovenRecord): void;
  revert(record: WovenRecord): void;
  setRevealed(record: WovenRecord, swap: AppliedSwap): void;
  clearRevealed(): void;
  hitTest(x: number, y: number, lookup: (node: Text) => WovenRecord | undefined): Hit | null;
  rectFor(record: WovenRecord, swap: AppliedSwap): DOMRect | null;
  flush(): void;
  updateSettings(settings: Settings): void;
  destroy(): void;
}
