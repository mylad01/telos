'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useThemePreset } from './ThemeProvider';
import { groupPresets } from '@/lib/theme/presets';
import type { ThemePreset } from '@/lib/theme/tokens';

const GROUPS: ThemePreset['group'][] = ['iphone', 'trend', 'classic'];

/** iOS-style menu: one topbar button, presets in a floating popover. */
export function ThemeMenu() {
  const t = useTranslations('theme');
  const { presetId, sync, choose, auto, setAuto } = useThemePreset();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const items = () =>
      Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [],
      );

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const list = items();
      if (list.length === 0) return;
      event.preventDefault();
      const current = list.indexOf(document.activeElement as HTMLButtonElement);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = (current + step + list.length) % list.length;
      list[next]?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menuRef.current
      ?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')
      ?.focus();
  }, [open]);

  return (
    <div className="theme-menu-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="theme-toggle"
        aria-label={t('change')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3a9 9 0 1 0 0 18h1.2a1.8 1.8 0 0 0 1.4-2.9 1.8 1.8 0 0 1 1.4-2.9H18A3 3 0 0 0 21 12a9 9 0 0 0-9-9Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="8" cy="10.5" r="1.15" fill="currentColor" />
          <circle cx="12" cy="7.8" r="1.15" fill="currentColor" />
          <circle cx="15.8" cy="10" r="1.15" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div className="theme-menu" role="menu" aria-label={t('title')} ref={menuRef}>
          <div className="theme-menu-head">
            <span className="theme-menu-title">{t('title')}</span>
            <span className="theme-menu-sync" data-sync={sync} role="status">
              {t('status.' + sync)}
            </span>
          </div>

          {GROUPS.map((group) => (
            <div
              key={group}
              role="group"
              aria-label={t('group.' + group)}
              className="theme-menu-group"
            >
              <p className="theme-menu-label">{t('group.' + group)}</p>
              {groupPresets(group).map((preset) => {
                const selected = preset.id === presetId;
                const glass = preset.tokens.glassBlur !== '0px';
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    className="theme-item"
                    onClick={() => {
                      choose(preset.id);
                      setOpen(false);
                      buttonRef.current?.focus();
                    }}
                  >
                    <span className="theme-item-swatch" aria-hidden="true">
                      {preset.swatch.map((color, index) => (
                        <span key={color + index} style={{ background: color }} />
                      ))}
                    </span>
                    <span className="theme-item-text">
                      <span className="theme-item-name">{preset.name}</span>
                      <span className="theme-item-note">
                        {preset.tokens.scheme === 'dark' ? t('dark') : t('light')}
                        {glass ? ' · ' + t('glass') : ''}
                      </span>
                    </span>
                    {selected && (
                      <svg
                        className="theme-item-check"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M5 12.5 9.5 17 19 7"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={auto === 'auto'}
            className="theme-item theme-item-auto"
            onClick={() => setAuto(auto === 'auto' ? 'off' : 'auto')}
          >
            <span className="theme-item-text">
              <span className="theme-item-name">{t('auto')}</span>
              <span className="theme-item-note">{t('autoHint')}</span>
            </span>
            <span className="switch" data-on={auto === 'auto'} aria-hidden="true">
              <span className="switch-knob" />
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
