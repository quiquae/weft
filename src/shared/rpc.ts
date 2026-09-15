import { api, contextAlive } from './browser.ts';
import type { Envelope, Request, ResponseFor } from './messages.ts';

/**
 * Typed request/response over runtime messaging.
 *
 * Every call can fail for a reason that is nobody's fault: the service worker
 * was asleep, the extension was just updated, the tab is being discarded.
 * Returning `null` on failure rather than throwing means a page keeps working
 * (unwoven) instead of filling the console, which matters because the content
 * script runs on pages the user is trying to read.
 */
export async function send<T extends Request['type']>(
  request: Extract<Request, { type: T }>,
): Promise<ResponseFor<T> | null> {
  if (!contextAlive()) return null;
  try {
    const reply = (await api.runtime.sendMessage(request)) as Envelope<ResponseFor<T>> | undefined;
    if (!reply) return null;
    if (!reply.ok) {
      if (__WEFT_DEV__) console.warn('[weft]', request.type, reply.error);
      return null;
    }
    return reply.data;
  } catch (err) {
    if (__WEFT_DEV__) console.warn('[weft]', request.type, err);
    return null;
  }
}

/** Wrap a handler result in the response envelope. */
export function ok<T>(data: T): Envelope<T> {
  return { ok: true, data };
}

export function fail(error: unknown): Envelope<never> {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}
