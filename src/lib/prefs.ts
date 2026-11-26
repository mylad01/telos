/**
 * Theme preference in the account: only the preset slug and a timestamp travel.
 * Validation lives here (shared by the API route and the browser); the network
 * calls are in prefs-client.ts so the server never imports browser code.
 */

export const PREFS_PATH = '/api/prefs';
export const PREFS_KEY = 'telos.theme.preset.v1';
export const PRESET_ID_PATTERN = /^[a-z0-9-]{1,40}$/;

export type ThemePrefs = { presetId: string; updatedAt: number };

export function isPresetId(value: unknown): value is string {
  return typeof value === 'string' && PRESET_ID_PATTERN.test(value);
}

export function parsePrefs(raw: unknown): ThemePrefs | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (!isPresetId(record.presetId)) return null;
  const updatedAt = record.updatedAt;
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt) || updatedAt <= 0) return null;
  return { presetId: record.presetId, updatedAt };
}

export function httpPrefsRequest(
  method: 'GET' | 'PUT',
  presetId?: string,
): { url: string; init: RequestInit } {
  if (method === 'GET') {
    return { url: PREFS_PATH, init: { method, headers: { accept: 'application/json' } } };
  }
  return {
    url: PREFS_PATH,
    init: {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ presetId }),
    },
  };
}

export function readLocalPreset(): string | null {
  try {
    const stored = window.localStorage.getItem(PREFS_KEY);
    return isPresetId(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function writeLocalPreset(presetId: string): void {
  try {
    if (isPresetId(presetId)) window.localStorage.setItem(PREFS_KEY, presetId);
  } catch {
    // Private mode without storage still works for this page load.
  }
}
