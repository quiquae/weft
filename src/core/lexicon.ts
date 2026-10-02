import type { LexEntry } from './types.ts';

/**
 * A pack read back by target word.
 *
 * A memory card is keyed by its target word alone — `fr:argent` — and the
 * pack holds a row per English word and surface form, so one card stands for
 * several rows: argent is *silver* and *money*, fille is *girl* and
 * *daughter*. Everything that reads a card back as a word has to pick among
 * them, and three places did it by hand, each keeping the first row it met:
 * the dashboard, for the discoveries feed and the vocabulary list beside it;
 * the background's quiz builder; and the site builder, which skipped plurals
 * first, for every Latin and Old English word page.
 *
 * Keeping the first row lost the word's story whenever that row carried
 * none. A claim is written on a row, and the French cousins file is keyed by
 * English lemma, so "shares a root with English “filial”" sits on daughter →
 * fille and not on girl → fille: the dashboard read girl, and the feed said
 * nothing at all about a word whose story the pack had.
 *
 * So the word is read from its first singular row — the gloss the vocabulary
 * list shows, the quiz asks and the site prints, none of which moves here —
 * and when that row carries no claim it takes the first claim that another
 * row of the same part of speech carries, etymon and note together.
 *
 * Only the same part of speech, because one spelling is not always one word.
 * Old English `hund` is a dog and a hundred and `earm` is an arm and poor,
 * and a claim about one is false of the other: "earm survived into English
 * as arm" is not true of the adjective. The seed writes the second word of
 * each such pair with a homograph number — `earm²` — so the two arrive here
 * as two keys and never meet (see `spelling()`); the line is for the
 * homograph nobody has numbered yet. Every row sharing a target word and a
 * part of speech in the seven packs is one word with two English glosses,
 * which is what makes the line safe to draw there. Across parts of speech
 * nothing is borrowed, and a word whose first row carries no claim keeps
 * none — a blank is cheaper than a claim about the wrong word.
 *
 * The rows themselves are never written to. Every caller hands over the
 * pack it loaded, and a claim copied onto a row would be a claim the tooltip
 * then showed for an English word it was never filed under.
 */
export function entriesByTarget(entries: Record<string, LexEntry[]>): Map<string, LexEntry> {
  const rows = new Map<string, LexEntry[]>();
  for (const list of Object.values(entries)) {
    for (const row of list) {
      const same = rows.get(row.tgtLemma);
      if (same) same.push(row);
      else rows.set(row.tgtLemma, [row]);
    }
  }

  const out = new Map<string, LexEntry>();
  for (const [word, same] of rows) {
    const head = same.find((row) => row.num !== 'pl') ?? (same[0] as LexEntry);
    const teller = carriesClaim(head)
      ? undefined
      : same.find((row) => row.pos === head.pos && carriesClaim(row));
    out.set(word, teller ? withClaimOf(head, teller) : head);
  }
  return out;
}

/**
 * A target headword as a reader sees it: without its homograph number.
 *
 * One spelling is sometimes two words. Old English `hund` is a dog and a
 * hundred, `earm` an arm and poor, `rīċe` a realm and rich — English
 * Wiktionary gives each pair two etymologies — and a card keyed by the
 * spelling alone made one card of the two, so a reader who met *hund* as
 * "hundred" was told it survived as *hound*, asked "dog" in the quiz, and
 * scheduled as though meeting the number were meeting the animal. So the
 * seed writes the second word `hund²`, and the number travels in `tgtLemma`,
 * which is the card's identity: two words, two cards, two pages.
 *
 * The first word is written bare and numbers start at two, so numbering a
 * second word never moves the card the first one already has. The number is
 * never shown: the page prints `tgt`, which the pack builder writes without
 * it, and anything that has only a `tgtLemma` to print goes through here.
 */
export function spelling(tgtLemma: string): string {
  return tgtLemma.replace(/[²³⁴⁵⁶⁷⁸⁹]$/u, '');
}

/** An etymon or a note: anything the discoveries feed can tell. */
function carriesClaim(row: LexEntry): boolean {
  return Boolean(row.etymonOf || row.note);
}

function withClaimOf(head: LexEntry, teller: LexEntry): LexEntry {
  const out: LexEntry = { ...head };
  if (teller.etymonOf) out.etymonOf = teller.etymonOf;
  if (teller.note) out.note = teller.note;
  return out;
}
