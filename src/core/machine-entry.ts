import type { LexEntry, Pos } from './types.ts';

/**
 * A translation service's word, as the worker hands it to a page. Marked at a
 * lower confidence and with no difficulty band, because nobody has judged how
 * hard it is: the selector neither refuses it by level nor prefers it, and it
 * always prefers a curated entry for the same word, which is the correct
 * ordering: a checked gloss beats a machine one. Until 2026-11-09 it was given
 * band 3, which A1's window of bands 1 and 2 refused, so at the default level
 * every word a service filled was sent, counted and never woven.
 */
export function machineEntry(
  word: string,
  pos: Pos,
  tgt: string,
  num?: 'sg' | 'pl',
  conf = 0.75,
  gender?: 'm' | 'f' | 'n' | 'c',
): LexEntry {
  const entry: LexEntry = {
    src: word.toLowerCase(),
    lemma: word.toLowerCase(),
    pos,
    tgt,
    tgtLemma: tgt,
    // Unknown frequency: place it mid-scale so it is neither preferred as a
    // very common word nor rejected as a rare one.
    zipf: 3.6,
    senses: 1,
    conf,
    note: 'Machine translation, not a checked gloss.',
  };
  if (num) entry.num = num;
  if (gender) entry.gender = gender;
  return entry;
}
