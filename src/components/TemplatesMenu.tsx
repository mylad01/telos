'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Template } from '@/lib/templates';

type Props = {
  templates: Template[];
  onApply: (id: string) => void;
  onSaveCurrent: (name: string) => void;
  onDelete: (id: string) => void;
  busy?: boolean;
};

export function TemplatesMenu({
  templates,
  onApply,
  onSaveCurrent,
  onDelete,
  busy = false,
}: Props) {
  const t = useTranslations('templates');
  const [name, setName] = useState('');

  return (
    <section className="templates-panel" aria-labelledby="templates-title">
      <header className="templates-head">
        <h2 className="templates-title" id="templates-title">
          {t('title')}
        </h2>
        <p className="templates-blurb">{t('blurb')}</p>
      </header>

      <form
        className="templates-form"
        onSubmit={(event) => {
          event.preventDefault();
          const value = name.trim();
          if (!value) return;
          onSaveCurrent(value);
          setName('');
        }}
      >
        <label className="templates-field">
          <span>{t('saveLabel')}</span>
          <input
            className="templates-input"
            value={name}
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
            placeholder={t('savePlaceholder')}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button className="templates-button" type="submit" disabled={busy || !name.trim()}>
          {t('save')}
        </button>
      </form>

      {templates.length === 0 ? (
        <p className="templates-empty">{t('empty')}</p>
      ) : (
        <ul className="templates-list">
          {templates.map((template) => (
            <li className="templates-item" key={template.id}>
              <div className="templates-info">
                <span className="templates-name">{template.name}</span>
                <span className="templates-meta">
                  {t('meta', { list: template.list, count: template.subtasks.length })}
                </span>
              </div>
              <div className="templates-actions">
                <button
                  className="templates-button"
                  type="button"
                  disabled={busy}
                  onClick={() => onApply(template.id)}
                >
                  {t('apply')}
                </button>
                <button
                  className="templates-button templates-button-quiet"
                  type="button"
                  disabled={busy}
                  onClick={() => onDelete(template.id)}
                >
                  {t('delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="templates-status" role="status" aria-live="polite">
        {busy ? t('busy') : t('statusCount', { count: templates.length })}
      </p>
    </section>
  );
}
