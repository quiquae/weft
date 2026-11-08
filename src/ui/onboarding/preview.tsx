import { useMemo } from 'preact/hooks';
import type { LexPack, Settings } from '../../core/types.ts';
import { selectSwaps, topBandOf } from '../../core/selector.ts';
import { tokenize } from '../../core/tokenize.ts';
import { hashString } from '../../core/rand.ts';
import { applyLetterforms } from '../../core/letterforms.ts';
import { getLanguage } from '../../core/languages.ts';

/**
 * Live preview.
 *
 * Runs the real selector over a real paragraph at the chosen density, rather
 * than showing a mock-up. Two reasons: a mock-up would let the onboarding
 * promise something the engine does not deliver, and seeing the actual
 * density is the only way to choose one — "35%" means nothing until you see
 * what a 35% paragraph looks like.
 */

const SAMPLE =
  'The old house stood at the end of a long road, where the river ran under a stone bridge ' +
  'and the road climbed towards the mountain. In the morning a woman came down from the ' +
  'village with bread and salt, and the young king rode past on a black horse without a word. ' +
  'The water was cold. A bird sang in the green field beyond the wall, and the light on the ' +
  'water moved like something alive.';

export function Preview({
  pack,
  settings,
  ratio,
}: {
  pack: LexPack | null;
  settings: Settings;
  ratio: number;
}) {
  const parts = useMemo(() => {
    if (!pack) return null;
    const target = pack.meta.target;
    const meta = getLanguage(target);
    const tokens = tokenize(SAMPLE);

    const lookup = (surface: string) => {
      const list = pack.entries[surface];
      if (!list?.length) return undefined;
      if (!meta.historical) return list;
      return list.map((entry) => ({
        ...entry,
        tgt: applyLetterforms(entry.tgt, target, settings.weave.letterforms),
      }));
    };

    const result = selectSwaps({
      tokens,
      lookup,
      cards: new Map(),
      now: Date.now(),
      target,
      ratio,
      settings,
      effectiveLevel: settings.learning.level,
      topBand: topBandOf(pack.meta),
      introducedToday: new Set(),
      pageLemmaCounts: new Map(),
      seed: hashString(SAMPLE),
    });

    const out: Array<{ text: string; swap: boolean; original?: string }> = [];
    let cursor = 0;
    for (const swap of result.swaps) {
      if (swap.start > cursor) out.push({ text: SAMPLE.slice(cursor, swap.start), swap: false });
      out.push({ text: swap.replacement, swap: true, original: swap.original });
      cursor = swap.end;
    }
    if (cursor < SAMPLE.length) out.push({ text: SAMPLE.slice(cursor), swap: false });
    return { parts: out, count: result.swaps.length, eligible: result.eligible };
  }, [pack, settings, ratio]);

  if (!parts) {
    return <p class="muted">Loading the sample…</p>;
  }

  return (
    <div class="preview">
      <p class="preview__text">
        {parts.parts.map((part, i) =>
          part.swap ? (
            <span key={i} class="preview__word" title={part.original}>
              {part.text}
            </span>
          ) : (
            <span key={i}>{part.text}</span>
          ),
        )}
      </p>
      <p class="preview__count muted">
        {parts.count} of {parts.eligible} words Weft knows here. Hover one to see the English.
      </p>
    </div>
  );
}
