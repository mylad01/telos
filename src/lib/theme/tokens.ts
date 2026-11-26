export type ThemeScheme = 'light' | 'dark';

/**
 * Everything a theme may change. Components must only use these through their
 * CSS variables, so a new preset restyles the whole app without code changes.
 */
export type ThemeTokens = {
  scheme: ThemeScheme;
  bg: string;
  surface: string;
  surface2: string;
  surface3: string;
  border: string;
  borderStrong: string;
  text: string;
  text2: string;
  text3: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  accentLine: string;
  overdue: string;
  hover: string;
  dangerSoft: string;
  alertBg: string;
  alertBorder: string;
  radiusSm: string;
  radiusMd: string;
  shadow1: string;
  shadow2: string;
  fontDisplay: string;
  fontBody: string;
  backdrop: string;
  glassBlur: string;
  glassTint: string;
};

export type TokenKey = Exclude<keyof ThemeTokens, 'scheme'>;

export const TOKEN_VARS: Record<TokenKey, string> = {
  bg: '--bg',
  surface: '--surface',
  surface2: '--surface-2',
  surface3: '--surface-3',
  border: '--border',
  borderStrong: '--border-strong',
  text: '--text',
  text2: '--text-2',
  text3: '--text-3',
  accent: '--accent',
  accentInk: '--accent-ink',
  accentSoft: '--accent-soft',
  accentLine: '--accent-line',
  overdue: '--overdue',
  hover: '--hover',
  dangerSoft: '--danger-soft',
  alertBg: '--alert-bg',
  alertBorder: '--alert-border',
  radiusSm: '--radius-sm',
  radiusMd: '--radius-md',
  shadow1: '--shadow-1',
  shadow2: '--shadow-2',
  fontDisplay: '--font-display',
  fontBody: '--font-sans',
  backdrop: '--backdrop',
  glassBlur: '--glass-blur',
  glassTint: '--glass-tint',
};

export const TOKEN_KEYS = Object.keys(TOKEN_VARS) as TokenKey[];

/** The CSS variables for one token set, ready for an inline style or a style block. */
export function cssVars(tokens: ThemeTokens): Record<string, string> {
  const vars: Record<string, string> = { 'color-scheme': tokens.scheme };
  for (const key of TOKEN_KEYS) vars[TOKEN_VARS[key]] = tokens[key];
  return vars;
}

export type ThemePreset = {
  id: string;
  name: string;
  group: 'classic' | 'trend' | 'iphone';
  swatch: [string, string, string];
  tokens: ThemeTokens;
};

function declarations(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
}

/**
 * One style block holding every preset, emitted by the server layout so the
 * first paint already carries the chosen theme and no token data ships as JS.
 */
export function presetsCss(presets: ThemePreset[]): string {
  return presets
    .map((preset) => `:root[data-preset="${preset.id}"]{${declarations(cssVars(preset.tokens))}}`)
    .join('\n');
}

export function isThemeTokens(value: unknown): value is ThemeTokens {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (record.scheme !== 'light' && record.scheme !== 'dark') return false;
  return TOKEN_KEYS.every(
    (key) => typeof record[key] === 'string' && (record[key] as string).length > 0,
  );
}

/** #rgb / #rrggbb / rgb() / rgba() to [r, g, b], or null when unreadable. */
export function parseColor(color: string): [number, number, number] | null {
  const hex = color.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  if (short) {
    const [r, g, b] = [short[1], short[2], short[3]].map((part) => parseInt(part + part, 16));
    return [r, g, b];
  }
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (long) return [parseInt(long[1], 16), parseInt(long[2], 16), parseInt(long[3], 16)];
  const fn = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(hex);
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3])];
  return null;
}

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

export function luminance(color: string): number | null {
  const rgb = parseColor(color);
  if (!rgb) return null;
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

/** WCAG contrast ratio between two colours, or 0 when one is not readable. */
export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  if (a === null || b === null) return 0;
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** True when a token is see-through and must be judged against a solid backdrop. */
export function isTranslucent(color: string): boolean {
  const trimmed = color.trim();
  if (/^rgba\(/i.test(trimmed)) {
    const alpha = /^rgba\([^)]*,\s*([\d.]+)\s*\)$/i.exec(trimmed);
    return alpha ? Number(alpha[1]) < 1 : true;
  }
  return false;
}
