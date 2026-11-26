import { describe, expect, it } from 'vitest';
import { PREFS_PATH, httpPrefsRequest, isPresetId, parsePrefs } from './prefs';

describe('isPresetId', () => {
  it('accepts slugs made of lowercase letters, digits and dashes', () => {
    expect(isPresetId('liquid-glass')).toBe(true);
    expect(isPresetId('ios-dark')).toBe(true);
    expect(isPresetId('a')).toBe(true);
    expect(isPresetId('9')).toBe(true);
  });

  it('rejects labels, blanks and over-long ids', () => {
    expect(isPresetId('Liquid Glass')).toBe(false);
    expect(isPresetId('')).toBe(false);
    expect(isPresetId('x'.repeat(41))).toBe(false);
    expect(isPresetId('glass_light')).toBe(false);
    expect(isPresetId(null)).toBe(false);
    expect(isPresetId(7)).toBe(false);
  });
});

describe('parsePrefs', () => {
  it('keeps a well-formed record', () => {
    expect(parsePrefs({ presetId: 'aurora', updatedAt: 1_700_000_000_000 })).toEqual({
      presetId: 'aurora',
      updatedAt: 1_700_000_000_000,
    });
  });

  it('drops anything that cannot be trusted', () => {
    expect(parsePrefs(null)).toBeNull();
    expect(parsePrefs('aurora')).toBeNull();
    expect(parsePrefs({ presetId: 'Bad Id', updatedAt: 1 })).toBeNull();
    expect(parsePrefs({ presetId: 'aurora', updatedAt: 0 })).toBeNull();
    expect(parsePrefs({ presetId: 'aurora', updatedAt: Number.NaN })).toBeNull();
    expect(parsePrefs({ presetId: 'aurora' })).toBeNull();
  });
});

describe('httpPrefsRequest', () => {
  it('reads without a body', () => {
    const request = httpPrefsRequest('GET');
    expect(request.url).toBe(PREFS_PATH);
    expect(request.init.method).toBe('GET');
    expect(request.init.body).toBeUndefined();
  });

  it('writes the preset id as JSON', () => {
    const request = httpPrefsRequest('PUT', 'liquid-glass');
    expect(request.init.method).toBe('PUT');
    expect(JSON.parse(String(request.init.body))).toEqual({ presetId: 'liquid-glass' });
  });
});
