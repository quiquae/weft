import type { ProviderId, Settings } from './types.ts';

/**
 * What a translation service is sent, in the words two pages print.
 *
 * The dashboard's network panel and the settings page above the provider
 * keys both tell a reader what leaves this machine. Until 2026-11-03 each
 * said the sentence never did, the dashboard "Only isolated words are ever
 * sent, never page text." whatever the settings said, while “Send the
 * surrounding sentence”, a switch on the same settings page, sends the
 * OpenAI-compatible service the sentence each word appears in. So the words
 * are a function of the two settings that decide them, and both pages print
 * this one.
 *
 * Switches are named by their titles and the section by its heading, as the
 * settings page draws them; `tests/core/sending.test.ts` reads that page to
 * hold the names to it.
 */

type Sending = Pick<Settings['providers'], 'enabled' | 'sendContext'>;

/**
 * The services sent the sentence when it is on: the ones whose request has a
 * place for it. Not a choice made here: `tests/core/providers.test.ts` reads
 * every provider's body and fails when this list stops matching them.
 */
export const SENTENCE_RECIPIENTS: readonly ProviderId[] = ['openai'];

/** What a translation service is sent under these settings. */
/**
 * Whether the browser lets words go to a translation service.
 *
 * Firefox asks the reader for `websiteContent` and lists what they granted
 * under `data_collection`; a browser without that list asks nothing, and the
 * provider switch is the whole consent there.
 */
export function mayTransmit(granted: unknown): boolean {
  const list = (granted as { data_collection?: unknown } | undefined)?.data_collection;
  return list === undefined || (Array.isArray(list) && list.includes('websiteContent'));
}

export function whatIsSent(providers: Sending): string {
  if (!providers.enabled) return '“Use a translation service” is off, so Weft sends no more words.';
  if (!providers.sendContext) {
    return 'A translation service is sent single words and a part-of-speech hint, never the sentence they appear in.';
  }
  return (
    'A translation service is sent single words and a part-of-speech hint. ' +
    'Because “Send the surrounding sentence” is on, an OpenAI-compatible one is sent the sentence each word appears in as well; ' +
    'DeepL and Google are never sent it.'
  );
}

/**
 * Where to stop it, for a page that is not where the switch is. Null when
 * nothing is being sent.
 */
export function howToStop(providers: Sending): string | null {
  if (!providers.enabled) return null;
  if (!providers.sendContext) {
    return 'To send nothing, turn off “Use a translation service” under Vocabulary beyond the packs in settings.';
  }
  return 'To keep the sentence here, turn off “Send the surrounding sentence” under Vocabulary beyond the packs in settings.';
}
