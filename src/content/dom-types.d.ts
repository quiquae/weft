/**
 * Ambient declarations for DOM APIs that are shipping in browsers but not yet
 * in the TypeScript lib we build against.
 *
 * Declared here rather than cast away at each call site so that a future
 * TypeScript release simply makes this file redundant instead of leaving
 * `as any` scattered through the renderer.
 */

interface Highlight extends Set<AbstractRange> {
  priority: number;
}

declare const Highlight: {
  prototype: Highlight;
  new (...ranges: AbstractRange[]): Highlight;
};

interface HighlightRegistry extends Map<string, Highlight> {}

interface CSS {
  highlights?: HighlightRegistry;
}

interface CaretPosition {
  offsetNode: Node;
  offset: number;
  getClientRect(): DOMRect | null;
}

interface Document {
  /** Standard. Chrome 128+, Firefox, Safari 17+. */
  caretPositionFromPoint?(x: number, y: number): CaretPosition | null;
  /** Legacy Blink/WebKit equivalent, still the only one in older Chrome. */
  caretRangeFromPoint?(x: number, y: number): Range | null;
}
