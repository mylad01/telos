import { describe, expect, it } from 'vitest';
import { isDarkHours, resolveAutoPreset } from './auto-theme';
import type { AutoTheme } from './auto-theme';

function at(hour: number, minute: number): Date {
  return new Date(2026, 0, 15, hour, minute, 0, 0);
}

const presets = { light: 'Daylight', dark: 'Midnight' };

describe('isDarkHours', () => {
  it('is light at 18:59', () => {
    expect(isDarkHours(at(18, 59))).toBe(false);
  });

  it('turns dark at 19:00 inclusive', () => {
    expect(isDarkHours(at(19, 0))).toBe(true);
  });

  it('is still dark at 06:59', () => {
    expect(isDarkHours(at(6, 59))).toBe(true);
  });

  it('is light at 07:00 exclusive', () => {
    expect(isDarkHours(at(7, 0))).toBe(false);
  });

  it('is dark through midnight and light at midday', () => {
    expect(isDarkHours(at(0, 0))).toBe(true);
    expect(isDarkHours(at(12, 0))).toBe(false);
  });
});

describe('resolveAutoPreset', () => {
  const cases: { name: string; hour: number; minute: number; auto: AutoTheme; expected: string }[] = [
    { name: 'off before dark hours', hour: 12, minute: 0, auto: 'off', expected: 'Daylight' },
    { name: 'off during dark hours', hour: 21, minute: 0, auto: 'off', expected: 'Daylight' },
    { name: 'auto at 18:59', hour: 18, minute: 59, auto: 'auto', expected: 'Daylight' },
    { name: 'auto at 19:00', hour: 19, minute: 0, auto: 'auto', expected: 'Midnight' },
    { name: 'auto at 06:59', hour: 6, minute: 59, auto: 'auto', expected: 'Midnight' },
    { name: 'auto at 07:00', hour: 7, minute: 0, auto: 'auto', expected: 'Daylight' },
    { name: 'auto at midday', hour: 12, minute: 0, auto: 'auto', expected: 'Daylight' },
  ];

  for (const c of cases) {
    it(`${c.name} returns light preset when expected`, () => {
      expect(resolveAutoPreset(at(c.hour, c.minute), { ...presets, auto: c.auto })).toBe(c.expected);
    });
  }

  it('falls back to light when the dark preset is empty', () => {
    expect(resolveAutoPreset(at(22, 0), { light: 'Daylight', dark: '', auto: 'auto' })).toBe(
      'Daylight',
    );
  });

  it('falls back to light when both the dark preset is empty and auto is off', () => {
    expect(resolveAutoPreset(at(22, 0), { light: 'Daylight', dark: '', auto: 'off' })).toBe(
      'Daylight',
    );
  });
});
