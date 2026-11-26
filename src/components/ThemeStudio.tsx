'use client';

import { useTranslations } from 'next-intl';
import { useThemePreset } from './ThemeProvider';
import { groupPresets } from '@/lib/theme/presets';
import type { ThemePreset } from '@/lib/theme/tokens';

const ORDER: ThemePreset['group'][] = ['iphone', 'trend', 'classic'];

export function ThemeStudio() {
  const t = useTranslations('theme');
  const { presetId, sync, choose } = useThemePreset();

  return (
    <section className="theme-studio" aria-label={t('title')}>
      <header className="theme-studio-head">
        <div>
          <h3 className="theme-studio-title">{t('title')}</h3>
          <p className="theme-studio-blurb">{t('blurb')}</p>
        </div>
        <p className="theme-studio-sync" data-sync={sync} role="status">
          {t(`status.${sync}`)}
        </p>
      </header>

      {ORDER.map((group) => (
        <div className="theme-group" key={group}>
          <p className="theme-group-label">{t(`group.${group}`)}</p>
          <ul className="theme-grid">
            {groupPresets(group).map((preset) => (
              <li key={preset.id}>
                <button
                  type="button"
                  className="theme-card"
                  data-preset={preset.id}
                  aria-pressed={preset.id === presetId}
                  onClick={() => choose(preset.id)}
                >
                  <span className="theme-swatch" aria-hidden="true">
                    {preset.swatch.map((color) => (
                      <span key={color} style={{ background: color }} />
                    ))}
                  </span>
                  <span className="theme-card-name">{preset.name}</span>
                  <span className="theme-card-note">
                    {preset.tokens.scheme === 'dark' ? t('dark') : t('light')}
                    {preset.tokens.glassBlur !== '0px' ? ` · ${t('glass')}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="theme-studio-foot">{t('saved')}</p>
    </section>
  );
}
