import { resourceUrl } from './browser.ts';
import type { LangCode } from '../core/types.ts';

/**
 * Which languages actually have a lexicon on disk.
 *
 * The language registry lists more languages than Weft ships packs for,
 * because the pipeline can build any of them and a translation service can
 * answer for any of them. But offering a language that will silently do
 * nothing is the worst kind of feature, so every language picker reads this
 * and says which is which.
 */

export interface PackSummary {
  source: LangCode;
  target: LangCode;
  file: string;
  entryCount: number;
  lemmaCount: number;
  bands: number[];
}

export interface PackIndex {
  format: number;
  version: string;
  builtAt: string;
  packs: PackSummary[];
}

let cached: PackIndex | null = null;
let inFlight: Promise<PackIndex | null> | null = null;

export async function loadPackIndex(): Promise<PackIndex | null> {
  if (cached) return cached;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const response = await fetch(resourceUrl('lexicon/index.json'));
      if (!response.ok) return null;
      cached = (await response.json()) as PackIndex;
      return cached;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function packFor(
  index: PackIndex | null,
  source: LangCode,
  target: LangCode,
): PackSummary | null {
  return index?.packs.find((p) => p.source === source && p.target === target) ?? null;
}

export type Availability =
  | { kind: 'packed'; lemmas: number }
  | { kind: 'provider' }
  | { kind: 'unavailable' };

/**
 * How a language can be served right now.
 *
 * `packed` works offline. `provider` means there is no lexicon but a
 * configured translation service can answer. `unavailable` means choosing it
 * would do nothing, and the picker must say so rather than accept the choice.
 */
export function availabilityFor(
  index: PackIndex | null,
  source: LangCode,
  target: LangCode,
  providersEnabled: boolean,
): Availability {
  const pack = packFor(index, source, target);
  if (pack) return { kind: 'packed', lemmas: pack.lemmaCount };
  if (providersEnabled) return { kind: 'provider' };
  return { kind: 'unavailable' };
}

export function availabilityNote(availability: Availability, name: string): string {
  switch (availability.kind) {
    case 'packed':
      return `${availability.lemmas} checked words, works offline.`;
    case 'provider':
      return `No built-in lexicon for ${name}. Your translation service will be asked for every word, so expect gaps and a slower first page.`;
    case 'unavailable':
      return `No built-in lexicon for ${name} yet. Turn on a translation service in Vocabulary, or build a pack with "npm run packs".`;
  }
}
