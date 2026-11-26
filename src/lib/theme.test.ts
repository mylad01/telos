import { describe, expect, it } from 'vitest';
import { nextTheme, parseTheme, resolveTheme } from './theme';

describe('theme', () => {
  it('falls back to system for unknown stored values', () => {
    expect(parseTheme(null)).toBe('system');
    expect(parseTheme('sepia')).toBe('system');
    expect(parseTheme('dark')).toBe('dark');
  });

  it('follows the system setting only when asked to', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('cycles system -> light -> dark -> system', () => {
    expect(nextTheme('system')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('system');
  });
});
