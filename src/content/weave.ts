import type { LexEntry, Swap } from '../core/types.ts';

/** One swap after it has been written into a text node. */
export interface AppliedSwap {
  /** Offset into the WOVEN string, not the original. */
  start: number;
  end: number;
  original: string;
  replacement: string;
  entry: LexEntry;
  revealed: boolean;
  /** Already mastered: styled faintly and excluded from the difficulty budget. */
  retired: boolean;
}

export interface WovenRecord {
  node: Text;
  /** The text as the page wrote it. Restored on revert. */
  original: string;
  /** The text we wrote. Compared against nodeValue to detect page rewrites. */
  woven: string;
  swaps: AppliedSwap[];
  /**
   * The same swaps in SOURCE-text coordinates.
   *
   * `swaps` holds offsets into `woven`, which shift every time the set
   * changes. Re-weaving at a higher ratio needs to say "keep exactly these
   * words", and that sentence only has a stable meaning in the coordinates of
   * the text the page wrote.
   */
  sourceSwaps: Swap[];
  /** Wrapped mode only: the nodes we put in place of the original text node. */
  inserted?: Node[];
  /** Wrapped mode only: the elements carrying each swap, parallel to `swaps`. */
  elements?: HTMLElement[];
}

/**
 * Build the woven string and translate offsets into it.
 *
 * Offsets have to be recomputed rather than reused: "cat" becoming "chat"
 * shifts everything after it by one character, and the renderer styles exact
 * character ranges. An off-by-one here puts the underline on the wrong
 * letter, which is the most visible possible bug.
 */
export function computeWoven(
  original: string,
  swaps: Swap[],
): { woven: string; applied: AppliedSwap[] } {
  const ordered = [...swaps].sort((a, b) => a.start - b.start);
  let out = '';
  let cursor = 0;
  const applied: AppliedSwap[] = [];

  for (const swap of ordered) {
    if (swap.start < cursor) continue; // overlapping: keep the earlier one
    out += original.slice(cursor, swap.start);
    const start = out.length;
    out += swap.replacement;
    applied.push({
      start,
      end: out.length,
      original: swap.original,
      replacement: swap.replacement,
      entry: swap.entry,
      revealed: false,
      retired: swap.retired,
    });
    cursor = swap.end;
  }
  out += original.slice(cursor);

  return { woven: out, applied };
}

/** Find the swap containing an offset in the woven string. */
export function swapAtOffset(record: WovenRecord, offset: number): AppliedSwap | null {
  for (const swap of record.swaps) {
    if (offset >= swap.start && offset < swap.end) return swap;
  }
  // A caret exactly at the end boundary still belongs to the swap it closes.
  for (const swap of record.swaps) {
    if (offset === swap.end) return swap;
  }
  return null;
}

/** Stable identity of a swap within its source text. */
export function pinKey(swap: { start: number; original: string }): string {
  return `${swap.start}:${swap.original.toLowerCase()}`;
}

export interface Hit {
  record: WovenRecord;
  swap: AppliedSwap;
}
