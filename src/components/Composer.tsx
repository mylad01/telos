'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Repeat } from '@/lib/tasks';

const REPEATS: Repeat[] = ['none', 'daily', 'weekly'];

export function Composer({
  today,
  onAdd,
  disabled = false,
}: {
  today: string;
  onAdd: (title: string, due: string, repeat: Repeat) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('composer');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(today);
  const [repeat, setRepeat] = useState<Repeat>('none');
  const inputRef = useRef<HTMLInputElement>(null);
  const canSubmit = title.trim().length > 0 && !disabled;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed, due || today, repeat);
    setTitle('');
    setDue(today);
    setRepeat('none');
    inputRef.current?.focus();
  }

  return (
    <form className="composer" onSubmit={submit}>
      <input
        ref={inputRef}
        className="composer-title"
        name="title"
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setTitle('');
            setDue(today);
            setRepeat('none');
          }
        }}
        placeholder={t('placeholder')}
        aria-label={t('label')}
        autoComplete="off"
        maxLength={160}
        enterKeyHint="done"
        disabled={disabled}
      />

      <div className="composer-controls">
        <div className="due-field">
          <label htmlFor="due-date">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            {t('dueLabel')}
          </label>
          <input
            id="due-date"
            name="due"
            type="date"
            value={due}
            onChange={(event) => setDue(event.target.value)}
            disabled={disabled}
          />
        </div>

        <button className="btn-add" type="submit" disabled={!canSubmit}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {t('add')}
        </button>
      </div>

      <div className="composer-repeat" role="group" aria-label={t('repeatLabel')}>
        <span className="repeat-label" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M4 11a8 8 0 0113.7-5.7L20 7.5M20 4v3.5h-3.5M20 13a8 8 0 01-13.7 5.7L4 16.5M4 20v-3.5h3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t('repeatLabel')}
        </span>
        {REPEATS.map((value) => (
          <button
            key={value}
            type="button"
            className="chip"
            aria-pressed={repeat === value}
            disabled={disabled}
            onClick={() => setRepeat(value)}
          >
            {t(`repeat.${value}`)}
          </button>
        ))}
        <span className="hint">{t('hint')}</span>
      </div>
    </form>
  );
}
