export type AutoTheme = 'off' | 'auto';

const DARK_START_HOUR = 19;
const DARK_END_HOUR = 7;

/** Dark between 19:00 and 07:00 local time (19:00 inclusive, 07:00 exclusive). */
export function isDarkHours(now: Date): boolean {
  const hour = now.getHours();
  return hour >= DARK_START_HOUR || hour < DARK_END_HOUR;
}

/**
 * Which preset to show. auto='off' -> light preset. auto='auto' -> dark preset during
 * dark hours, light otherwise. Always returns light if dark is empty.
 */
export function resolveAutoPreset(
  now: Date,
  opts: { light: string; dark: string; auto: AutoTheme },
): string {
  if (!opts.dark || opts.auto === 'off') return opts.light;
  return isDarkHours(now) ? opts.dark : opts.light;
}
