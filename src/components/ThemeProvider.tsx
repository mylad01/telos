'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadPrefs, savePrefs } from '@/lib/prefs-client';
import { readLocalPreset, writeLocalPreset } from '@/lib/prefs';
import { DEFAULT_PRESET_ID, presetById } from '@/lib/theme/presets';
import type { ThemePreset } from '@/lib/theme/tokens';

export type ThemeSync = 'local' | 'syncing' | 'synced' | 'error';

type ThemeContextValue = {
  presetId: string;
  preset: ThemePreset;
  sync: ThemeSync;
  choose: (presetId: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useThemePreset(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useThemePreset must be used inside ThemeProvider');
  return value;
}

/**
 * Owns the chosen preset: paints it on <html> and keeps the account copy in
 * step. The first paint is already themed by the boot script in layout.tsx.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID);
  const [sync, setSync] = useState<ThemeSync>('local');

  useEffect(() => {
    const local = readLocalPreset();
    if (local) setPresetId(local);
    let cancelled = false;
    setSync('syncing');
    void loadPrefs().then((prefs) => {
      if (cancelled) return;
      if (prefs?.presetId) {
        setPresetId(prefs.presetId);
        writeLocalPreset(prefs.presetId);
        setSync('synced');
      } else {
        setSync('local');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const preset = presetById(presetId);
    root.dataset.preset = preset.id;
    root.dataset.theme = preset.tokens.scheme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', preset.tokens.bg);
  }, [presetId]);

  const choose = useCallback((next: string) => {
    const preset = presetById(next);
    setPresetId(preset.id);
    writeLocalPreset(preset.id);
    setSync('syncing');
    void savePrefs(preset.id).then(setSync);
  }, []);

  const value = useMemo(
    () => ({ presetId, preset: presetById(presetId), sync, choose }),
    [presetId, sync, choose],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
