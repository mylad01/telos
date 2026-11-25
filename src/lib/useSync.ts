'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { mergeTaskLists, pendingChanges, pruneTombstones, type Task } from './tasks';

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'offline' | 'error';
export type SyncAccount = { email: string } | null;

/** Feature flag: set NEXT_PUBLIC_TELOS_SYNC=0 at build time to hide sync. */
export const SYNC_ENABLED = process.env.NEXT_PUBLIC_TELOS_SYNC !== '0';

const POLL_MS = 4_000;
const PUSH_DELAY_MS = 900;

export function useSync(
  tasks: Task[] | null,
  setTasks: React.Dispatch<React.SetStateAction<Task[] | null>>,
) {
  const [account, setAccount] = useState<SyncAccount>(null);
  const [status, setStatus] = useState<SyncStatus>('local');
  const [pending, setPending] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  /** updatedAt we last uploaded, per task; anything newer is an offline edit. */
  const pushedRef = useRef(new Map<string, number>());
  const sinceRef = useRef(0);
  const busyRef = useRef(false);
  const accountRef = useRef<SyncAccount>(null);
  accountRef.current = account;

  const countPending = useCallback((list: Task[] | null) => {
    if (!list) return 0;
    return pendingChanges(list, pushedRef.current).length;
  }, []);

  const sync = useCallback(async () => {
    if (!SYNC_ENABLED || !accountRef.current || busyRef.current) return;
    const list = tasksRef.current;
    if (!list) return;

    busyRef.current = true;
    setStatus('syncing');
    try {
      const changes = pendingChanges(list, pushedRef.current);
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ since: sinceRef.current, changes }),
        cache: 'no-store',
      });

      if (response.status === 401) {
        setAccount(null);
        pushedRef.current = new Map();
        sinceRef.current = 0;
        setStatus('local');
        setPending(0);
        return;
      }
      if (!response.ok) throw new Error(`sync ${response.status}`);

      const data = (await response.json()) as { tasks: Task[]; now: number };
      sinceRef.current = Math.max(sinceRef.current, data.now);
      for (const task of changes) pushedRef.current.set(task.id, task.updatedAt);

      if (data.tasks.length > 0) {
        setTasks((previous) =>
          previous ? pruneTombstones(mergeTaskLists(previous, data.tasks)) : previous,
        );
      }

      setLastSyncedAt(Date.now());
      setStatus('synced');
      setPending(countPending(tasksRef.current));
    } catch {
      setStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error');
    } finally {
      busyRef.current = false;
    }
  }, [countPending, setTasks]);

  useEffect(() => {
    if (!SYNC_ENABLED) return;
    let cancelled = false;
    fetch('/api/auth', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { email?: string | null } | null) => {
        if (!cancelled && data?.email) setAccount({ email: data.email });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!account || !SYNC_ENABLED) return;
    const tick = () => {
      if (document.visibilityState === 'visible') void sync();
    };
    const timer = window.setInterval(tick, POLL_MS);
    window.addEventListener('online', tick);
    document.addEventListener('visibilitychange', tick);
    void sync();
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [account, sync]);

  // Offline queue: local edits wait here (persisted in localStorage) and go out
  // as soon as the network or the account is available.
  useEffect(() => {
    if (!account || !tasks) return;
    if (countPending(tasks) === 0) return;
    const timer = window.setTimeout(() => void sync(), PUSH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [account, tasks, countPending, sync]);

  const authenticate = useCallback(
    async (action: 'login' | 'signup', email: string, password: string) => {
      try {
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, email, password }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          email?: string;
          error?: string;
        };
        if (!response.ok) return data.error ?? 'invalid';

        // First upload after signing in sends this device's whole list.
        pushedRef.current = new Map();
        sinceRef.current = 0;
        setAccount({ email: data.email ?? email });
        setPending(countPending(tasksRef.current));
        setStatus('syncing');
        return null;
      } catch {
        return 'network';
      }
    },
    [countPending],
  );

  const signIn = useCallback(
    (email: string, password: string) => authenticate('login', email, password),
    [authenticate],
  );
  const signUp = useCallback(
    (email: string, password: string) => authenticate('signup', email, password),
    [authenticate],
  );

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
    } catch {
      // The local list is unaffected either way.
    }
    setAccount(null);
    pushedRef.current = new Map();
    sinceRef.current = 0;
    setLastSyncedAt(null);
    setPending(0);
    setStatus('local');
  }, []);

  return {
    enabled: SYNC_ENABLED,
    account,
    status,
    pending,
    lastSyncedAt,
    signIn,
    signUp,
    signOut,
    sync,
  };
}
