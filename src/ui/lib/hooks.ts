import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { send } from '../../shared/rpc.ts';
import type { Request, ResponseFor } from '../../shared/messages.ts';

/**
 * Request state for an extension page.
 *
 * Every UI page is a client of the service worker, and the worker can be
 * asleep, so "loading" and "unavailable" are both normal states rather than
 * error cases. `reload` exists because most pages need to re-read after a
 * mutation, and polling a sleeping worker would keep it awake for nothing.
 */
export function useRequest<T extends Request['type']>(
  request: Extract<Request, { type: T }> | null,
): {
  data: ResponseFor<T> | null;
  loading: boolean;
  failed: boolean;
  reload(): void;
} {
  const [data, setData] = useState<ResponseFor<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const key = request ? JSON.stringify(request) : null;

  useEffect(() => {
    if (!key || !request) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    void send(request).then((reply) => {
      if (!live) return;
      setData(reply);
      setFailed(reply === null);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, failed, reload };
}

/** A ticking clock, for countdowns. Stops when the document is hidden. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    const onVisibility = () => {
      window.clearInterval(timer);
      if (document.visibilityState === 'visible') {
        setNow(Date.now());
        timer = window.setInterval(() => setNow(Date.now()), intervalMs);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs]);
  return now;
}

/** Debounce a value, so dragging a slider does not fire a write per pixel. */
export function useDebounced<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
