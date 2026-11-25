import type { Task } from './tasks';

export type SyncAccount = { email: string } | null;

/** What one sync round trip returns: rows changed since the cursor, and the new cursor. */
export type SyncPayload = { tasks: Task[]; now: number };

export type AuthOutcome = { email: string } | { error: string };

/**
 * Where a signed-in list lives. Two implementations:
 *
 * - `node`: this app's own server (`app/api/auth`, `app/api/sync`) — needs a host
 *   with a writable disk.
 * - `supabase`: Supabase Auth + Postgres from the browser — works from a static
 *   export such as GitHub Pages, where no server code can run.
 *
 * The sync engine in `useSync` only talks to this interface, so the merge rules,
 * offline queue and polling are identical on both.
 */
export type SyncBackend = {
  kind: 'node' | 'supabase';
  currentUser(): Promise<SyncAccount>;
  authenticate(action: 'login' | 'signup', email: string, password: string): Promise<AuthOutcome>;
  signOut(): Promise<void>;
  /** `null` means the session is gone and the caller should sign the user out. */
  sync(since: number, changes: Task[]): Promise<SyncPayload | null>;
};

/** Reads the build-time Supabase settings, if both are present. */
export function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ''), key };
}
