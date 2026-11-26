export type Theme = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_KEY = 'telos.theme.v1';

const THEMES: Theme[] = ['system', 'light', 'dark'];

export function parseTheme(raw: string | null | undefined): Theme {
  return THEMES.includes(raw as Theme) ? (raw as Theme) : 'system';
}

export function resolveTheme(theme: Theme, systemDark: boolean): ResolvedTheme {
  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  return systemDark ? 'dark' : 'light';
}

export function nextTheme(theme: Theme): Theme {
  return theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
}

/** Reads the stored choice; safe where storage is blocked. */
export function readStoredTheme(): Theme {
  try {
    return parseTheme(window.localStorage.getItem(THEME_KEY));
  } catch {
    return 'system';
  }
}

export function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // storage blocked: the choice simply does not persist
  }
}
