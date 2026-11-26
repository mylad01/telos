import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESET_ID, PRESETS, groupPresets, presetById } from './presets';
import {
  TOKEN_KEYS,
  contrastRatio,
  cssVars,
  isThemeTokens,
  isTranslucent,
  parseColor,
  presetsCss,
} from './tokens';

describe('presets', () => {
  it('ships unique ids with a valid token set', () => {
    const ids = PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of PRESETS) {
      expect(isThemeTokens(preset.tokens), preset.id).toBe(true);
      expect(ids).toContain(preset.id);
      expect(preset.swatch).toHaveLength(3);
    }
  });

  it('resolves a known id, falls back to paper for anything else', () => {
    expect(presetById('liquid-glass').name).toBe('Liquid Glass');
    expect(presetById('nope').id).toBe(DEFAULT_PRESET_ID);
    expect(presetById(null).id).toBe('paper');
  });

  it('groups presets and covers all three groups', () => {
    expect(groupPresets('classic').length).toBeGreaterThanOrEqual(3);
    expect(groupPresets('trend').length).toBeGreaterThanOrEqual(5);
    const iphone = groupPresets('iphone').map((preset) => preset.id);
    expect(iphone).toContain('liquid-glass');
    expect(iphone).toContain('ios-dark');
  });

  it('keeps body text readable on every preset', () => {
    for (const preset of PRESETS) {
      const surface = isTranslucent(preset.tokens.surface)
        ? preset.tokens.bg
        : preset.tokens.surface;
      const ratio = contrastRatio(preset.tokens.text, surface);
      expect(ratio, `${preset.id} text contrast ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps accent labels readable on the accent colour', () => {
    for (const preset of PRESETS) {
      const ratio = contrastRatio(preset.tokens.accentInk, preset.tokens.accent);
      expect(ratio, `${preset.id} accent contrast ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('gives every preset a see-through surface only when glass is on', () => {
    for (const preset of PRESETS) {
      const translucent = isTranslucent(preset.tokens.surface);
      const glass = preset.tokens.glassBlur !== '0px';
      expect(translucent, preset.id).toBe(glass);
    }
  });
});

describe('tokens', () => {
  it('maps every token to a CSS variable, scheme included', () => {
    const vars = cssVars(PRESETS[0].tokens);
    expect(TOKEN_KEYS).toHaveLength(Object.keys(vars).length - 1);
    expect(vars['--bg']).toBe(PRESETS[0].tokens.bg);
    expect(vars['--font-sans']).toBe(PRESETS[0].tokens.fontBody);
    expect(vars['color-scheme']).toBe(PRESETS[0].tokens.scheme);
  });

  it('writes one scoped block per preset', () => {
    const css = presetsCss(PRESETS);
    expect(css.split('\n')).toHaveLength(PRESETS.length);
    for (const preset of PRESETS) {
      expect(css).toContain(`:root[data-preset="${preset.id}"]{color-scheme:${preset.tokens.scheme};`);
    }
  });

  it('rejects token sets with a missing or empty field', () => {
    const good = PRESETS[0].tokens;
    expect(isThemeTokens(good)).toBe(true);
    expect(isThemeTokens({ ...good, accent: '' })).toBe(false);
    expect(isThemeTokens({ ...good, scheme: 'sepia' })).toBe(false);
    expect(isThemeTokens(null)).toBe(false);
  });

  it('reads hex and rgb colours and measures contrast', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255]);
    expect(parseColor('#0071e3')).toEqual([0, 113, 227]);
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual([10, 20, 30]);
    expect(parseColor('tomato')).toBeNull();
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 2);
  });
});
