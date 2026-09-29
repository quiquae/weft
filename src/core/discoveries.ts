import type { LexEntry, MemoryCard } from './types.ts';

/**
 * The discoveries feed.
 *
 * The most charming thing in this product is already sitting in the lexicon
 * and nothing surfaces it. `hlāford` means loaf-keeper and became "lord".
 * `steorfan` meant simply to die and became "starve". `vacca` is a cow and
 * gave us "vaccine". Those facts are why someone tells a friend about Weft,
 * and until now they were only visible if you happened to hover the right
 * word at the right moment.
 *
 * Two rules keep it honest:
 *
 * **Only words the learner has actually met.** A feed of facts about words
 * you have never seen is content marketing, not progress. Every item here is
 * something that happened while they were reading.
 *
 * **The interesting kinds first.** A meaning that shifted — steorfan meaning
 * simply to die — is the thing someone repeats to a friend. Plain descents
 * sink below them, because a feed where two lines in three read "English X
 * comes straight from Y" stops being read at all.
 */

export type DiscoveryKind = 'descent' | 'false-friend' | 'literal' | 'unchanged' | 'note';

export interface Discovery {
  /** `${target}:${lemma}` — the card it came from. */
  id: string;
  kind: DiscoveryKind;
  /** The target-language word. */
  target: string;
  /** The English word on the page. */
  source: string;
  /** The English word it became or gave us, when there is one. */
  descendant?: string;
  /** One sentence, ready to read. */
  text: string;
  /** When the learner first met the word. */
  metAt: number;
}

/**
 * Notes that describe a meaning shift rather than an additional detail.
 *
 * "whence" was in this list and should not have been: a note reading
 * "whence evening and eve" is additive, not contrastive, and the
 * false-friend template turned it into "aefen became English even, but
 * whence evening and eve" — which is not a sentence.
 */
const FALSE_FRIEND = /\b(meant|means|simply|not a|rather than)\b/i;
/** Notes that gloss the word literally. */
const LITERAL = /\bliterally\b/i;

/** Compare words ignoring diacritics and historical letterforms. */
function fold(word: string): string {
  return word
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/[þð]/g, 'th')
    .replace(/ƿ/g, 'w')
    .replace(/ȝ/g, 'g')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
}

/** Code-unit order, which is the same on every runtime. */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function classify(entry: LexEntry): DiscoveryKind | null {
  const note = entry.note ?? '';
  if (LITERAL.test(note)) return 'literal';
  if (note && FALSE_FRIEND.test(note)) return 'false-friend';
  if (entry.etymonOf) {
    // "English weald comes straight from weald" is a tautology, not a
    // discovery. That the word has not changed in a thousand years, on the
    // other hand, is the more interesting fact.
    return fold(entry.etymonOf) === fold(entry.tgt) ? 'unchanged' : 'descent';
  }
  if (note) return 'note';
  return null;
}

/**
 * Most interesting kind first — which depends on the language.
 *
 * The original order put descents last, on the reasoning that a feed where
 * two lines in three read "English X comes straight from Y" stops being
 * read. That is true of Old English, where 544 of 584 entries carry an
 * etymon and a descent is the default rather than a find.
 *
 * It is exactly wrong for French. There a descent is rare — 30 entries
 * against 88 notes — and "English river comes from rivière" is the
 * striking line, while "shares a root with amiable" is the common one.
 * Ranking descents last there produced a feed of two dozen identically
 * phrased notes: the same monotony, arrived at from the opposite
 * direction.
 *
 * So the order is a function of the data shape, not a constant. The rule
 * underneath both cases is the same: whatever is rare in this language is
 * what is worth reading.
 */
function interestOf(kind: DiscoveryKind, historical: boolean): number {
  switch (kind) {
    case 'false-friend':
      return 0;
    case 'literal':
      return 1;
    case 'unchanged':
      return 2;
    case 'descent':
      // Rare and surprising in a living language; the default in a dead one.
      return historical ? 4 : 3;
    case 'note':
      return historical ? 3 : 4;
  }
}

/**
 * Phrasings for a plain descent, varied by a stable hash of the word.
 *
 * Not random: the same word always reads the same way, so the feed does not
 * reshuffle its own wording between visits.
 */
const DESCENT_FRAMES = [
  (target: string, descendant: string) => `English ${descendant} comes straight from ${target}.`,
  (target: string, descendant: string) => `${target} is where ${descendant} comes from.`,
  (target: string, descendant: string) => `${descendant} began as ${target}.`,
  (target: string, descendant: string) => `${target} survived into English as ${descendant}.`,
];

/**
 * The same variation, for a language that is still spoken.
 *
 * The historical frames do not transfer: "survived into English as" implies
 * the source language did not, which is true of Old English and rude about
 * French. The living-language set says borrowing rather than descent,
 * because that is what actually happened.
 *
 * This branch had no frames at all until French gained etymologies — one
 * template, repeated, which is the monotony the historical frames were
 * written to fix, arrived at from the other direction.
 */
const BORROWING_FRAMES = [
  (target: string, descendant: string) => `English ${descendant} comes from ${target}.`,
  (target: string, descendant: string) => `${target} is where English ${descendant} comes from.`,
  (target: string, descendant: string) => `English borrowed ${descendant} from ${target}.`,
  (target: string, descendant: string) => `${descendant} came into English from ${target}.`,
];

function frameFor(word: string): number {
  let h = 0;
  for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Turn an entry into a sentence.
 *
 * Phrased as something that happened to the reader — "you met", "you learned"
 * — rather than as a dictionary fact, because that is what makes it feel like
 * progress rather than trivia.
 */
function sentence(entry: LexEntry, kind: DiscoveryKind, historical: boolean): string {
  const note = entry.note ? entry.note.replace(/\.$/, '') : '';

  switch (kind) {
    case 'literal':
      return `${entry.tgt} — ${note}.`;
    case 'false-friend':
      return entry.etymonOf
        ? `${entry.tgt} became English ${entry.etymonOf}, but ${lowerFirst(note)}.`
        : `${entry.tgt} — ${note}.`;
    case 'unchanged':
      return historical
        ? `${entry.tgt} has not changed in a thousand years — it is still ${entry.etymonOf}.`
        : `${entry.tgt} is simply ${entry.etymonOf}.`;
    case 'descent': {
      const descendant = entry.etymonOf ?? '';
      const frames = historical ? DESCENT_FRAMES : BORROWING_FRAMES;
      const frame = frames[frameFor(entry.tgtLemma) % frames.length];
      return frame ? frame(entry.tgt, descendant) : `English ${descendant} comes from ${entry.tgt}.`;
    }
    case 'note':
      return `${entry.tgt} — ${note}.`;
  }
}

function lowerFirst(text: string): string {
  if (!text) return text;
  // Leave a quoted or already-lowercase opening alone.
  if (/^[“"']/.test(text)) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export interface BuildDiscoveriesOptions {
  cards: MemoryCard[];
  /** Entry lookup by target headword. */
  entriesByLemma: Map<string, LexEntry>;
  /** True when the target language has no living speakers. */
  historical: boolean;
  limit?: number;
}

export function buildDiscoveries(opts: BuildDiscoveriesOptions): Discovery[] {
  const out: Discovery[] = [];

  for (const card of opts.cards) {
    // Met means seen on a page, not merely present in the pack.
    if (card.exposures < 1) continue;
    const entry = opts.entriesByLemma.get(card.lemma);
    if (!entry) continue;
    const kind = classify(entry);
    if (!kind) continue;

    const discovery: Discovery = {
      id: card.id,
      kind,
      target: entry.tgt,
      source: entry.lemma,
      text: sentence(entry, kind, opts.historical),
      metAt: card.firstSeen,
    };
    if (entry.etymonOf) discovery.descendant = entry.etymonOf;
    out.push(discovery);
  }

  /*
   * Most interesting kind first, then most recently met within a kind, then
   * by id so the order is total.
   *
   * The third key is not decoration. Cards first met in the same millisecond
   * — which is what a bulk import produces, and what two words woven into
   * one render produce — tie on both of the first two, and a comparator that
   * returns 0 leaves the result at the mercy of input order. That is
   * whatever the storage round-trip handed back, so one vocabulary rendered
   * twice could disagree with itself. The feed already refuses to reshuffle
   * its *wording* between visits (see the stable hash above); this is the
   * same promise about its order.
   *
   * Folded before comparing, and not with `localeCompare`. Raw code units
   * put "pierre" before "père", because `i` sorts below `è` — correct, and
   * it reads like a bug in a feed of French. `localeCompare` reads correctly
   * and is the determinism bug one layer down: it depends on the ICU data
   * the runtime was built with, so a contributor's machine and CI can
   * disagree. `fold` is already here, is pure string work, and gives
   * "pere" < "pierre". The raw id breaks the rare tie where two ids fold
   * alike, so the order is total either way.
   */
  out.sort(
    (a, b) =>
      interestOf(a.kind, opts.historical) - interestOf(b.kind, opts.historical) ||
      b.metAt - a.metAt ||
      cmp(fold(a.id), fold(b.id)) ||
      cmp(a.id, b.id),
  );
  return out.slice(0, opts.limit ?? 40);
}

/** How many of the learner's words carry a discovery at all. */
export function discoveryCoverage(
  cards: MemoryCard[],
  entriesByLemma: Map<string, LexEntry>,
): { met: number; withStory: number } {
  let met = 0;
  let withStory = 0;
  for (const card of cards) {
    if (card.exposures < 1) continue;
    met++;
    const entry = entriesByLemma.get(card.lemma);
    if (entry && classify(entry)) withStory++;
  }
  return { met, withStory };
}
