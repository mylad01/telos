'use client';

import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { parseISODate } from '@/lib/dates';
import { parseQuickAdd } from '@/lib/quick-add';
import type { Repeat } from '@/lib/tasks';

const REPEATS: Repeat[] = ['none', 'daily', 'weekly', 'monthly'];
const LOCALE = 'en';

export function Composer({
  today,
  lists,
  onAdd,
  disabled = false,
}: {
  today: string;
  lists: string[];
  onAdd: (title: string, due: string, repeat: Repeat, list: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('composer');
  const tTask = useTranslations('task');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(today);
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [list, setList] = useState(lists[0] ?? 'Inbox');
  const inputRef = useRef<HTMLInputElement>(null);
  const canSubmit = title.trim().length > 0 && !disabled;

  const shortDate = useMemo(
    () =>
      new Intl.DateTimeFormat(LOCALE, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }),
    [],
  );
  const repeatLabel = (value: Repeat) =>
    value === 'none'
      ? t('repeat.none')
      : value === 'daily'
        ? t('repeat.daily')
        : value === 'weekly'
          ? t('repeat.weekly')
          : t('repeat.monthly');

  const parsed = useMemo(() => parseQuickAdd(title, today), [title, today]);
  const hint =
    title.trim() && (parsed.due || parsed.repeat)
      ? parsed.due && parsed.repeat
        ? t('parsed', {
            due: shortDate.format(parseISODate(parsed.due)),
            repeat: repeatLabel(parsed.repeat),
          })
        : parsed.due
          ? t('parsedDue', { due: shortDate.format(parseISODate(parsed.due)) })
          : t('parsedRepeat', { repeat: repeatLabel(parsed.repeat ?? 'none') })
      : null;

  function reset() {
    setTitle('');
    setDue(today);
    setRepeat('none');
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = parseQuickAdd(title.trim(), today);
    const nextTitle = result.title.trim();
    if (!nextTitle) return;
    onAdd(
      nextTitle,
      result.due ?? due ?? today,
      repeat !== 'none' ? repeat : (result.repeat ?? 'none'),
      list.trim() || 'Inbox',
    );
    reset();
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
          if (event.key === 'Escape') reset();
        }}
        placeholder={t('placeholder')}
        aria-label={t('label')}
        autoComplete="off"
        maxLength={160}
        enterKeyHint="done"
        disabled={disabled}
      />

      {hint && (
        <p className="composer-parsed" aria-live="polite">
          {hint}
        </p>
      )}

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

        <div className="list-field">
          <label htmlFor="task-list">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6.5h16M4 12h16M4 17.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {t('listLabel')}
          </label>
          <input
            id="task-list"
            name="list"
            type="text"
            value={list}
            list="composer-lists"
            maxLength={40}
            autoComplete="off"
            onChange={(event) => setList(event.target.value)}
            disabled={disabled}
          />
          <datalist id="composer-lists">
            {lists.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
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
            aria-label={tTask('repeats', { repeat: repeatLabel(value) })}
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
