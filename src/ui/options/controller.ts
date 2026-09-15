import { useCallback, useEffect, useState } from 'preact/hooks';
import { send } from '../../shared/rpc.ts';
import type { PendingChange, Settings } from '../../core/types.ts';
import type { LockState } from '../../core/lock.ts';
import { assessPatch } from '../../core/lock.ts';

/**
 * Settings controller.
 *
 * Every write goes through the service worker's lock path, never straight to
 * storage, because the worker is the only thing that can decide whether a
 * change is allowed yet. That gives the page an unusual property: a control
 * the user moves may not move.
 *
 * Rather than hide that, the controller reports it. A change that makes the
 * page harder applies at once and the control stays where it was put. A
 * change that makes it easier is queued, the control snaps back to the stored
 * value, and a pending entry appears with a countdown. Snapping back is the
 * honest rendering — leaving the slider where the user dropped it would show
 * a setting that is not in force.
 */
export interface Controller {
  settings: Settings | null;
  lock: LockState | null;
  loading: boolean;
  /** Last message from the worker, e.g. "Queued. Unlocks in 15 min." */
  message: string | null;
  /** True while a write is in flight. */
  busy: boolean;
  set(path: string, value: unknown): Promise<void>;
  setMany(patch: Record<string, unknown>): Promise<void>;
  cancel(id: string): Promise<void>;
  reload(): Promise<void>;
  clearMessage(): void;
  /** Would this change be queued rather than applied? */
  wouldQueue(path: string, value: unknown): boolean;
}

export function useController(): Controller {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [lock, setLock] = useState<LockState | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const reply = await send({ type: 'get-lock-state' });
    if (reply) {
      setSettings(reply.settings);
      setLock(reply.lock);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setMany = useCallback(
    async (patch: Record<string, unknown>) => {
      setBusy(true);
      const reply = await send({ type: 'request-change', patch });
      setBusy(false);
      if (!reply) {
        setMessage('Weft could not reach its background worker. Nothing was changed.');
        return;
      }
      setMessage(reply.message);
      await reload();
    },
    [reload],
  );

  const set = useCallback(
    async (path: string, value: unknown) => setMany({ [path]: value }),
    [setMany],
  );

  const cancel = useCallback(
    async (id: string) => {
      await send({ type: 'cancel-pending', id });
      setMessage('Cancelled. Nothing changed.');
      await reload();
    },
    [reload],
  );

  const wouldQueue = useCallback(
    (path: string, value: unknown) => {
      if (!settings) return false;
      if (settings.friction.cooldownMinutes <= 0 && !settings.friction.requireQuizToUnlock) {
        return false;
      }
      return assessPatch(settings, { [path]: value }).direction === 'easier';
    },
    [settings],
  );

  return {
    settings,
    lock,
    loading,
    message,
    busy,
    set,
    setMany,
    cancel,
    reload,
    clearMessage: () => setMessage(null),
    wouldQueue,
  };
}

/** Pending changes, soonest first. */
export function sortedPending(lock: LockState | null): PendingChange[] {
  if (!lock) return [];
  return [...lock.pending].sort((a, b) => a.unlocksAt - b.unlocksAt);
}
