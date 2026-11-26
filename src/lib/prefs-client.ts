'use client';

import { readSession, type SbConfig } from './supabase/client';
import { supabaseConfig } from './sync-backend';
import { httpPrefsRequest, parsePrefs, readLocalPreset, writeLocalPreset, type ThemePrefs } from './prefs';

const TIMEOUT_MS = 10_000;

/** null = not asked yet; false = nobody signed in, so keep prefs local only. */
let httpAccount: boolean | null = null;

function supabaseRow(config: SbConfig, session: ReturnType<typeof readSession>) {
  return {
    url: `${config.url}/rest/v1/telos_prefs`,
    headers: {
      apikey: config.key,
      authorization: `Bearer ${session?.accessToken ?? ''}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=representation',
    },
  };
}

async function call(url: string, init: RequestInit): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The account's preset, or null when signed out / offline. */
export async function loadPrefs(): Promise<ThemePrefs | null> {
  const config = supabaseConfig();
  const session = config ? readSession() : null;
  if (config && session) {
    const { url, headers } = supabaseRow(config, session);
    const response = await call(
      `${url}?select=preset_id,updated_at&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
      { method: 'GET', headers },
    );
    if (!response?.ok) return null;
    const rows = (await response.json().catch(() => null)) as
      | { preset_id?: unknown; updated_at?: unknown }[]
      | null;
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row) return null;
    return parsePrefs({
      presetId: row.preset_id,
      updatedAt: row.updated_at ? Date.parse(String(row.updated_at)) : 0,
    });
  }

  const request = httpPrefsRequest('GET');
  const response = await call(request.url, request.init);
  httpAccount = response?.ok ?? false;
  if (!response?.ok) return null;
  return parsePrefs(await response.json().catch(() => null));
}

export type PrefsSave = 'synced' | 'local' | 'error';

export async function savePrefs(presetId: string): Promise<PrefsSave> {
  writeLocalPreset(presetId);
  const config = supabaseConfig();
  const session = config ? readSession() : null;

  let response: Response | null;
  if (config && session) {
    const { url, headers } = supabaseRow(config, session);
    response = await call(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id: session.user.id, preset_id: presetId }),
    });
  } else if (httpAccount === false) {
    return 'local';
  } else {
    const request = httpPrefsRequest('PUT', presetId);
    response = await call(request.url, request.init);
    if (response) httpAccount = response.ok;
  }
  if (response?.ok) return 'synced';
  return response?.status === 401 ? 'local' : 'error';
}

export { readLocalPreset };
