'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadPrefs, resetPrefsAccount, savePrefs } from '@/lib/prefs-client';
import { readLocalPreset, writeLocalPreset } from '@/lib/prefs';
import { resolveAutoPreset, type AutoTheme } from '@/lib/auto-theme';
import { DEFAULT_PRESET_ID, contrastPair, presetById } from '@/lib/theme/presets';
import type { ThemePreset } from '@/lib/theme/tokens';

export type ThemeSync = 'local' | 'syncing' | 'synced' | 'error';

const AUTO_KEY = 'telos.theme.auto.v1';

type ThemeContextValue = {
  /** The preset the person picked; stays put while auto mode flips the view. */
  presetId: string;
  /** The preset actually painted right now. */
  preset: ThemePreset;
  sync: ThemeSync;
  auto: AutoTheme;
  setAuto: (auto: AutoTheme) => void;
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
  const [auto, setAutoState] = useState<AutoTheme>('off');
  const [now, setNow] = useState(() => new Date());

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
    const onAccount = () => {
      resetPrefsAccount();
      void savePrefs(presetId).then(setSync);
    };
    window.addEventListener('telos:account', onAccount);
    return () => window.removeEventListener('telos:account', onAccount);
  }, [presetId]);

  useEffect(() => {
    if (window.localStorage.getItem(AUTO_KEY) === 'auto') setAutoState('auto');
  }, []);

  const autoOn = auto === 'auto';

  useEffect(() => {
    if (!autoOn) return;
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [autoOn]);

  const shownId = useMemo(
    () => (autoOn ? resolveAutoPreset(now, { ...contrastPair(presetId), auto }) : presetId),
    [autoOn, now, presetId, auto],
  );

  useEffect(() => {
    const root = document.documentElement;
    const preset = presetById(shownId);
    root.dataset.preset = preset.id;
    root.dataset.theme = preset.tokens.scheme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', preset.tokens.bg);
  }, [shownId]);

  const choose = useCallback((next: string) => {
    const preset = presetById(next);
    setPresetId(preset.id);
    writeLocalPreset(preset.id);
    setSync('syncing');
    void savePrefs(preset.id).then(setSync);
  }, []);

  const setAuto = useCallback((next: AutoTheme) => {
    setAutoState(next);
    try {
      window.localStorage.setItem(AUTO_KEY, next);
    } catch {
      /* storage full or blocked — the switch still works for this session */
    }
    setNow(new Date());
  }, []);

  const value = useMemo(
    () => ({ presetId, preset: presetById(shownId), sync, auto, setAuto, choose }),
    [presetId, shownId, sync, auto, setAuto, choose],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
