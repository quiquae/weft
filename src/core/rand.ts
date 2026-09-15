/**
 * Deterministic hashing and PRNG.
 *
 * Determinism is a correctness requirement, not a nicety. The content script
 * re-processes text nodes whenever a single-page app mutates the DOM, and if
 * the choice of which words to weave were random, a React re-render would
 * reshuffle half a feed under the reader's eyes. Seeding from the text content
 * means the same paragraph always weaves the same way.
 */

/** FNV-1a, 32-bit. Fast, stable across engines, good enough for seeding. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: tiny, fast, statistically fine for tie-breaking. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable pseudo-random value in [0,1) derived from a string. */
export function hashUnit(s: string): number {
  return hashString(s) / 4294967296;
}
