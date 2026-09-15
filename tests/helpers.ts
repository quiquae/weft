import type { LexEntry, MemoryCard, Settings } from '../src/core/types.ts';
import { defaultSettings } from '../src/core/settings.ts';
import { applyPatch, type Patch } from '../src/core/patch.ts';

export const NOW = Date.UTC(2026, 8, 14, 12, 0, 0);

export function settings(patch: Patch = {}): Settings {
  return applyPatch(defaultSettings(NOW, 'test-install-id'), patch);
}

let entrySeq = 0;

export function entry(over: Partial<LexEntry> = {}): LexEntry {
  entrySeq++;
  const src = over.src ?? `word${entrySeq}`;
  return {
    src,
    lemma: over.lemma ?? src,
    pos: 'noun',
    tgt: over.tgt ?? `mot${entrySeq}`,
    tgtLemma: over.tgtLemma ?? over.tgt ?? `mot${entrySeq}`,
    zipf: 4,
    senses: 1,
    conf: 0.95,
    band: 1,
    ...over,
  };
}

/** Build a surface-form lookup from a flat entry list. */
export function lookupFrom(entries: LexEntry[]): (surface: string) => LexEntry[] | undefined {
  const index = new Map<string, LexEntry[]>();
  for (const e of entries) {
    const key = e.src.toLowerCase();
    const list = index.get(key);
    if (list) list.push(e);
    else index.set(key, [e]);
  }
  return (surface) => index.get(surface);
}

export function card(over: Partial<MemoryCard> = {}): MemoryCard {
  const lemma = over.lemma ?? 'mot';
  const target = over.target ?? 'fr';
  return {
    id: `${target}:${lemma}`,
    target,
    lemma,
    stability: 0,
    difficulty: 0,
    lastReview: 0,
    reps: 0,
    lapses: 0,
    exposures: 0,
    firstSeen: NOW,
    ...over,
  };
}

export function cardMap(cards: MemoryCard[]): Map<string, MemoryCard> {
  return new Map(cards.map((c) => [c.id, c]));
}
