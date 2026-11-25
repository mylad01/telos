'use client';

import type { AuthOutcome, SyncAccount, SyncBackend, SyncPayload } from './sync-backend';

const TIMEOUT_MS = 15_000;

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(path, {
      ...init,
      headers: { ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}), ...init.headers },
      signal: controller.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The self-hosted backend: `app/api/auth` and `app/api/sync` over the JSON or
 * SQLite store in `src/server/`. Needs Node, so it only runs when the app is
 * served by its own process (not on GitHub Pages).
 */
export const nodeBackend: SyncBackend = {
  kind: 'node',

  async currentUser(): Promise<SyncAccount> {
    const response = await call('/api/auth');
    if (!response.ok) return null;
    const data = (await response.json()) as { email?: string | null };
    return data.email ? { email: data.email } : null;
  },

  async authenticate(action, email, password): Promise<AuthOutcome> {
    try {
      const response = await call('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ action, email, password }),
      });
      const data = (await response.json().catch(() => ({}))) as { email?: string; error?: string };
      if (!response.ok) return { error: data.error ?? 'invalid' };
      return { email: data.email ?? email };
    } catch {
      return { error: 'network' };
    }
  },

  async signOut(): Promise<void> {
    try {
      await call('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ action: 'logout' }),
      });
    } catch {
      // The local list is unaffected either way.
    }
  },

  async sync(since, changes): Promise<SyncPayload | null> {
    const response = await call('/api/sync', {
      method: 'POST',
      body: JSON.stringify({ since, changes }),
    });
    if (response.status === 401) return null;
    if (!response.ok) throw new Error(`sync ${response.status}`);
    return (await response.json()) as SyncPayload;
  },
};
