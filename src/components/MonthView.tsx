'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { monthGrid } from '@/lib/calendar';

const LOCALE = 'en';

export function MonthView({
  year,
  month,
  today,
  selected,
  counts,
  onSelect,
  onShift,
}: {
  year: number;
  month: number;
  today: string;
  selected: string | null;
  counts: Map<string, { open: number; done: number }>;
  onSelect: (date: string | null) => void;
  onShift: (delta: number) => void;
}) {
  const t = useTranslations('calendar');
  const weeks = useMemo(() => monthGrid(year, month), [year, month]);
  const title = useMemo(
    () => new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' }).format(new Date(year, month, 1)),
    [year, month],
  );
  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        new Intl.DateTimeFormat(LOCALE, { weekday: 'narrow' }).format(new Date(2024, 0, 1 + index)),
      ),
    [],
  );

  return (
    <section className="month" aria-label={t('label')}>
      <header className="month-head">
        <button type="button" className="month-shift" aria-label={t('previous')} onClick={() => onShift(-1)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2 className="month-title">{title}</h2>
        <button type="button" className="month-shift" aria-label={t('next')} onClick={() => onShift(1)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </header>

      <div className="month-weekdays" aria-hidden="true">
        {weekdays.map((day, index) => (
          <span key={index}>{day}</span>
        ))}
      </div>

      <div className="month-grid">
        {weeks.flat().map((cell) => {
          const entry = counts.get(cell.date);
          const total = (entry?.open ?? 0) + (entry?.done ?? 0);
          return (
            <button
              key={cell.date}
              type="button"
              className="month-day"
              data-outside={cell.inMonth ? undefined : 'true'}
              data-today={cell.date === today ? 'true' : undefined}
              aria-pressed={selected === cell.date}
              aria-label={t('day', { day: cell.day, count: total })}
              onClick={() => onSelect(selected === cell.date ? null : cell.date)}
            >
              <span className="month-day-number">{cell.day}</span>
              {total > 0 && (
                <span className="month-dots" aria-hidden="true">
                  {Array.from({ length: Math.min(total, 3) }, (_, index) => (
                    <span key={index} className="month-dot" data-done={index < (entry?.done ?? 0) ? 'true' : undefined} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
