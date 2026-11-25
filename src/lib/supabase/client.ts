'use client';

/**
 * The Supabase half of the browser backend, using plain `fetch` against the two
 * REST surfaces Supabase exposes — no SDK, so the static bundle stays small and
 * any AI assistant or developer can read the exact requests being made:
 *
 *   GoTrue   POST /auth/v1/signup | /token?grant_type=… | /logout, GET /user
 *   PostgREST POST/GET /rest/v1/tasks   (row access guarded by RLS)
 *
 * Every request carries `apikey: <anon key>`; user requests also carry the
 * user's access token. The anon key is public by design — RLS is what protects
 * the data, and `supabase/migrations/*.sql` is the only place that rule lives.
 */

import {
  mapAuthError,
  needsRefresh,
  nextCursor,
  fromRow,
  toRow,
  toSession,
  type TaskRow,
  type Session,
} from './map';
import type { AuthOutcome, SyncAccount, SyncBackend, SyncPayload } from '../sync-backend';
import type { Task } from '../tasks';

const SESSION_KEY = 'telos.sb.session.v1';
const TIMEOUT_MS = 15_000;

export type SbConfig = { url: string; key: string };

let memorySession: Session | null = null;

export function readSession(): Session | null {
  if (memorySession) return memorySession;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (typeof parsed?.accessToken !== 'string' || typeof parsed?.user?.email !== 'string') {
      return null;
    }
    memorySession = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: Session | null): void {
  memorySession = session;
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Private mode without storage still works for this page load.
  }
}

async function request(
  config: SbConfig,
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('apikey', config.key);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${config.url}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timer);
  }
}

async function json(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

/** Signs in, or falls back to the stored refresh token when the access token ran out. */
export async function ensureSession(config: SbConfig): Promise<Session | null> {
  const session = readSession();
  if (!session) return null;
  if (!needsRefresh(session, Date.now())) return session;

  try {
    const response = await request(config, '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
    if (!response.ok) {
      writeSession(null);
      return null;
    }
    const refreshed = toSession(await json(response), Date.now());
    if (!refreshed) {
      writeSession(null);
      return null;
    }
    writeSession(refreshed);
    return refreshed;
  } catch {
    // Offline: keep the session so the next attempt can retry, report nothing.
    throw new Error('network');
  }
}

export async function signIn(
  config: SbConfig,
  email: string,
  password: string,
): Promise<AuthOutcome> {
  try {
    const response = await request(config, '/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const body = await json(response);
    if (!response.ok) return { error: mapAuthError(response.status, body) };
    const session = toSession(body, Date.now());
    if (!session) return { error: 'invalid' };
    writeSession(session);
    return { email: session.user.email };
  } catch {
    return { error: 'network' };
  }
}

export async function signUp(
  config: SbConfig,
  email: string,
  password: string,
): Promise<AuthOutcome> {
  try {
    const response = await request(config, '/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const body = await json(response);
    if (!response.ok) return { error: mapAuthError(response.status, body) };
    const session = toSession(body, Date.now());
    if (session) {
      writeSession(session);
      return { email: session.user.email };
    }
    // Confirmation is on: the account exists but cannot sign in until the link is clicked.
    return { error: 'confirm' };
  } catch {
    return { error: 'network' };
  }
}

export async function signOut(config: SbConfig): Promise<void> {
  const session = readSession();
  writeSession(null);
  if (!session) return;
  try {
    await request(config, '/auth/v1/logout', { method: 'POST' }, session.accessToken);
  } catch {
    // The token is already gone locally; remote revocation is best effort.
  }
}

interface PushBody extends Partial<TaskRow> {}

async function pushRows(
  config: SbConfig,
  token: string,
  rows: PushBody[],
): Promise<TaskRow[]> {
  const response = await request(
    config,
    '/rest/v1/tasks?on_conflict=user_id,id',
    {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(rows),
    },
    token,
  );
  if (response.status === 401) throw new Unauthorized();
  if (!response.ok) throw new Error(`push ${response.status}`);
  const body = await json(response);
  return Array.isArray(body) ? (body as TaskRow[]) : [];
}

async function pullRows(
  config: SbConfig,
  token: string,
  since: number,
): Promise<TaskRow[]> {
  const query = new URLSearchParams({
    select: '*',
    synced_at: `gt.${since}`,
    order: 'synced_at.asc,id.asc',
  });
  const response = await request(config, `/rest/v1/tasks?${query}`, {}, token);
  if (response.status === 401) throw new Unauthorized();
  if (!response.ok) throw new Error(`pull ${response.status}`);
  const body = await json(response);
  return Array.isArray(body) ? (body as TaskRow[]) : [];
}

class Unauthorized extends Error {}

/** One round trip: upload this device's edits, then fetch everything newer. */
export async function syncOnce(
  config: SbConfig,
  since: number,
  changes: Task[],
): Promise<SyncPayload | null> {
  let session = readSession();
  if (!session) return null;
  if (needsRefresh(session, Date.now())) session = await ensureSession(config);
  if (!session) return null;

  const attempt = async (current: Session) => {
    const rows: TaskRow[] = [];
    if (changes.length > 0) {
      rows.push(...(await pushRows(config, current.accessToken, changes.map((task) => toRow(task, current.user.id)))));
    }
    rows.push(...(await pullRows(config, current.accessToken, since)));
    return rows;
  };

  let rows: TaskRow[];
  try {
    rows = await attempt(session);
  } catch (error) {
    if (!(error instanceof Unauthorized)) throw error;
    const refreshed = await ensureSession(config);
    if (!refreshed) {
      writeSession(null);
      return null;
    }
    try {
      rows = await attempt(refreshed);
    } catch (second) {
      if (second instanceof Unauthorized) {
        writeSession(null);
        return null;
      }
      throw second;
    }
  }

  const seen = rows
    .map((row) => fromRow(row))
    .filter((row): row is { task: Task; syncedAt: number } => row !== null);

  return {
    tasks: seen.map((row) => row.task),
    now: nextCursor(since, seen),
  };
}

/** Who is signed in, if anyone; a stored session is checked against the server once. */
export async function currentUser(config: SbConfig): Promise<SyncAccount> {
  let session: Session | null;
  try {
    session = await ensureSession(config);
  } catch {
    // Offline but signed in: show the account, sync will retry.
    return readSession() ? { email: readSession()!.user.email } : null;
  }
  if (!session) return null;
  try {
    const response = await request(config, '/auth/v1/user', {}, session.accessToken);
    if (response.status === 401) {
      writeSession(null);
      return null;
    }
  } catch {
    // Offline: trust the stored session.
  }
  return { email: session.user.email };
}

export function createSupabaseBackend(config: SbConfig): SyncBackend {
  return {
    kind: 'supabase',
    currentUser: () => currentUser(config),
    async authenticate(action, email, password) {
      return action === 'login'
        ? signIn(config, email, password)
        : signUp(config, email, password);
    },
    signOut: () => signOut(config),
    sync: (since, changes) => syncOnce(config, since, changes),
  };
}
