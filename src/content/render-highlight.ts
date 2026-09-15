import type { Settings } from '../core/types.ts';
import { swapAtOffset, type AppliedSwap, type Hit, type WovenRecord } from './weave.ts';
import type { Renderer } from './renderer.ts';

/**
 * The default renderer: edit `nodeValue`, style with the CSS Custom Highlight
 * API, change no DOM structure at all.
 *
 * This is the single most important engineering decision in Weft.
 *
 * The reason Google Translate crashes React applications is that it replaces
 * text nodes: it builds a new node, inserts it, and detaches the original.
 * React's fiber still holds a reference to the detached node, so the next
 * render calls removeChild on a node that no longer has that parent and
 * throws NotFoundError. Every text-rewriting extension inherits this problem,
 * and the usual answer is to monkey-patch Node.prototype in the page's own
 * JavaScript context — invasive, and it only papers over the symptom.
 *
 * Assigning to `nodeValue` mutates the existing node in place. The tree is
 * never restructured, so no framework's reference is ever invalidated. The
 * cost is that we cannot attach per-word elements for styling or hit-testing,
 * and the Custom Highlight API pays exactly that cost back: it styles
 * arbitrary character ranges without touching the DOM, and hit-testing is
 * done against the caret position instead of against an element.
 *
 * Baseline since June 2025 (Chrome/Edge 105, Safari 17.2, Firefox 149).
 */
export class HighlightRenderer implements Renderer {
  readonly mode = 'highlight' as const;

  private woven: Highlight | null = null;
  private active: Highlight | null = null;
  private retired: Highlight | null = null;
  private ranges = new WeakMap<Text, Range[]>();
  private records = new Set<WovenRecord>();
  private activeRange: Range | null = null;

  static supported(): boolean {
    return typeof Highlight === 'function' && Boolean((CSS as CSS).highlights);
  }

  constructor() {
    const registry = (CSS as CSS).highlights;
    if (!registry) throw new Error('CSS Custom Highlight API unavailable');
    this.woven = new Highlight();
    this.active = new Highlight();
    this.retired = new Highlight();
    // The active (revealed) highlight must paint over the resting one.
    this.woven.priority = 1;
    this.retired.priority = 1;
    this.active.priority = 2;
    registry.set('weft-woven', this.woven);
    registry.set('weft-retired', this.retired);
    registry.set('weft-active', this.active);
  }

  apply(record: WovenRecord): void {
    const { node } = record;
    try {
      node.nodeValue = record.woven;
    } catch {
      return; // node detached between selection and application
    }

    const made: Range[] = [];
    for (const swap of record.swaps) {
      const range = document.createRange();
      try {
        range.setStart(node, swap.start);
        range.setEnd(node, swap.end);
      } catch {
        continue; // offsets no longer valid; skip this one rather than throw
      }
      made.push(range);
      (swap.retired ? this.retired : this.woven)?.add(range);
    }
    this.ranges.set(node, made);
    this.records.add(record);
  }

  revert(record: WovenRecord): void {
    const existing = this.ranges.get(record.node);
    if (existing) {
      for (const range of existing) {
        this.woven?.delete(range);
        this.retired?.delete(range);
        this.active?.delete(range);
      }
      this.ranges.delete(record.node);
    }
    try {
      if (record.node.nodeValue === record.woven) record.node.nodeValue = record.original;
    } catch {
      // detached; nothing to restore
    }
    this.records.delete(record);
  }

  clearRevealed(): void {
    if (this.activeRange) {
      this.active?.delete(this.activeRange);
      this.activeRange = null;
    }
  }

  setRevealed(record: WovenRecord, swap: AppliedSwap): void {
    this.clearRevealed();
    const range = document.createRange();
    try {
      range.setStart(record.node, swap.start);
      range.setEnd(record.node, swap.end);
    } catch {
      return;
    }
    this.active?.add(range);
    this.activeRange = range;
  }

  hitTest(x: number, y: number, lookup: (node: Text) => WovenRecord | undefined): Hit | null {
    const position = caretAt(x, y);
    if (!position) return null;
    const { node, offset } = position;
    if (node.nodeType !== Node.TEXT_NODE) return null;
    const record = lookup(node as Text);
    if (!record) return null;
    const swap = swapAtOffset(record, offset);
    return swap ? { record, swap } : null;
  }

  rectFor(record: WovenRecord, swap: AppliedSwap): DOMRect | null {
    const range = document.createRange();
    try {
      range.setStart(record.node, swap.start);
      range.setEnd(record.node, swap.end);
    } catch {
      return null;
    }
    const rect = range.getBoundingClientRect();
    return rect.width || rect.height ? rect : null;
  }

  /**
   * Ranges are live, so normal reflow needs no action. But a page that
   * rewrites a nodeValue we own leaves collapsed ranges behind, and a
   * collapsed range paints nothing while still costing memory.
   */
  flush(): void {
    for (const record of [...this.records]) {
      if (record.node.nodeValue !== record.woven) continue;
      const ranges = this.ranges.get(record.node);
      if (!ranges) continue;
      for (const range of ranges) {
        if (range.collapsed) {
          this.woven?.delete(range);
          this.retired?.delete(range);
        }
      }
    }
  }

  /**
   * Nothing to do: this renderer holds no per-node styling. Appearance lives
   * entirely in the adopted stylesheet's ::highlight() rules, so restyling is
   * a single replaceSync and every existing range picks it up for free.
   */
  updateSettings(_settings: Settings): void {}

  destroy(): void {
    for (const record of [...this.records]) this.revert(record);
    const registry = (CSS as CSS).highlights;
    registry?.delete('weft-woven');
    registry?.delete('weft-active');
    registry?.delete('weft-retired');
    this.woven = this.active = this.retired = null;
    this.records.clear();
  }
}

/** Caret hit-testing, across the standard and legacy spellings. */
export function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document;
  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y);
    return pos ? { node: pos.offsetNode, offset: pos.offset } : null;
  }
  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(x, y);
    return range ? { node: range.startContainer, offset: range.startOffset } : null;
  }
  return null;
}
