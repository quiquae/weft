import { cardId, mergeCards } from './fsrs.ts';
import type { LangCode, MemoryCard } from './types.ts';

/** Per language, a spelling a pack once gave a word, and the one it gives it now. */
export type Renames = Readonly<Record<LangCode, Readonly<Record<string, string>>>>;

/**
 * The words a pack has respelt, so their cards can follow them.
 *
 * A card's id is `${target}:${tgtLemma}`, which makes a spelling an identity:
 * dot a letter in the seed and every card a learner has for the word is
 * filed under an id no pack row reads any more. Nothing deletes it. The word
 * simply arrives as new, its reviews stranded beside it where nothing looks,
 * which is the outcome the homograph numbering was designed around ("Do not
 * number the first") and a respelling has to be designed around too.
 *
 * An entry is permanent. An install that has not loaded its cards since an
 * entry was added, or an export written before it, still holds the old id,
 * and either can turn up years later. A word respelt twice keeps both lines
 * and is followed to where it is now. `tests/tools/card-ids.test.ts` holds
 * the table to the packs and to `tools/seed/card-ids.tsv`, the ledger of
 * every card id a pack has carried: no entry may move a card off a word a
 * pack still teaches, every one must end at a word a pack does teach, and a
 * rename may change only marks, never letters, because a different word is a
 * different card.
 *
 * Today's introduced list (`Introduced` in `src/background/storage.ts`) holds
 * bare lemmas and is not renamed. The cost is bounded and accepted: a word
 * met under its old spelling earlier on the day an update lands takes one
 * more of that day's new-word slots, and the list is gone by the next day.
 *
 * **Old English, 2026-10-04.** Wright's *Old English Grammar* (1914) §311
 * lists "sēc(e)an, to seek … tǣc(e)an, to teach" and "þenc(e)an … to think"
 * among the palatal *c*, from an *i* or *j* that once followed it (§309,
 * "secan = Goth. sōkjan"), and gives `wyrcan` beside Goth. *waurkjan*, the
 * same *j*; English Wiktionary dots all four. The pack dots the palatal *c*
 * and transcribes what it dots, so these four were read /k/ where the grammar
 * reads /tʃ/.
 *
 * **And five *g*, the same day.** §320 makes a *g* palatal "between OE.
 * palatal vowels", `twēġen`, and §324 after one at the end of a word or a
 * first element, "dæg … weg … bodig … hefig": `wīġ`, `huniġ`, and `ǣġhwǣr`,
 * whose *ǣġ-* is *ā-ġe-*. `nēahġebūr`'s *gebūr* is the prefix *ġe-*, which
 * the pack dots in `ġemunan` and no spelling rule can see. English
 * Wiktionary writes `wīġ`, `huniġ`, `twēġen` and `nēahġebūr`, and its
 * pronunciation module reads `ǣġhwǣr`.
 *
 * **And two *sc*.** §312: "some time during the OE. period the guttural sc
 * became palatal, except in loanwords", naming "fisc, fish; flǣsc, flesh";
 * English Wiktionary writes `fisċ` and `flǣsċ`. Its declension keeps the
 * plural `fiscas`, the guttural before a back vowel, which is what the pack
 * weaves for "fishes". Read literally, Wright's sentence would dot `āscian`
 * and `āscung` too, and they stay bare: his own note gives "axian, to ask …
 * beside … ascian", Wiktionary writes them `ā+scian` and `ā+scung` with
 * `āxian`, `ācsian` and `āxung` beside them, and English kept *ask*, not
 * *ash*.
 */
export const RENAMED: Renames = {
  ang: {
    sēcan: 'sēċan',
    tǣcan: 'tǣċan',
    þencan: 'þenċan',
    wyrcan: 'wyrċan',
    twēgen: 'twēġen',
    wīg: 'wīġ',
    hunig: 'huniġ',
    ǣghwǣr: 'ǣġhwǣr',
    nēahgebūr: 'nēahġebūr',
    fisc: 'fisċ',
    flǣsc: 'flǣsċ',
  },
};

/**
 * Where a word filed under `lemma` is filed now, if it has moved.
 *
 * Undefined for a word that never moved, and for one whose trail goes round
 * in a circle: a malformed table must not hang the worker, and the shipped
 * one is held against circles by test.
 */
function respelt(table: Readonly<Record<string, string>>, lemma: string): string | undefined {
  const seen = new Set([lemma]);
  let at = lemma;
  for (let next = table[at]; next !== undefined; next = table[at]) {
    if (seen.has(next)) return undefined;
    seen.add(next);
    at = next;
  }
  return at === lemma ? undefined : at;
}

/**
 * Move every card filed under an old spelling to the word's current one.
 *
 * Its whole history goes with it, and where the new spelling already has a
 * card — an export from before the rename, opened on a machine that has met
 * the word since — the two are one word's two records, joined by
 * `mergeCards` exactly as an import joins them. Never writes to the map it
 * is given; hands that same map back when nothing moved, so a caller can
 * tell whether there is anything to write.
 */
export function renameCards(
  cards: Record<string, MemoryCard>,
  renames: Renames = RENAMED,
): { cards: Record<string, MemoryCard>; moved: number } {
  let out: Record<string, MemoryCard> | undefined;
  let moved = 0;
  for (const [target, table] of Object.entries(renames)) {
    for (const from of Object.keys(table)) {
      const oldId = cardId(target, from);
      const card = (out ?? cards)[oldId];
      const to = card && respelt(table, from);
      if (!card || !to) continue;

      out ??= { ...cards };
      const newId = cardId(target, to);
      const moving: MemoryCard = { ...card, id: newId, lemma: to };
      const there = out[newId];
      out[newId] = there ? mergeCards(there, moving) : moving;
      delete out[oldId];
      moved++;
    }
  }
  return { cards: out ?? cards, moved };
}
