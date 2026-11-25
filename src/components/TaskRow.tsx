'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { addDays, daysFromToday, parseISODate } from '@/lib/dates';
import type { Task } from '@/lib/tasks';

type Tone = 'today' | 'overdue' | 'future';
const LOCALE = 'en';

export function TaskRow({
  task,
  today,
  onToggle,
  onDelete,
  onReschedule,
}: {
  task: Task;
  today: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onReschedule: (id: string, due: string) => void;
}) {
  const t = useTranslations('task');
  const diff = daysFromToday(task.due, today);

  const label = useMemo(() => {
    const sameYear = parseISODate(task.due).getFullYear() === parseISODate(today).getFullYear();
    const date = new Intl.DateTimeFormat(LOCALE, {
      day: 'numeric',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
      timeZone: 'UTC',
    }).format(parseISODate(task.due));

    if (task.done) return { text: date, tone: 'future' as Tone };
    if (diff === 0) return { text: t('dueToday'), tone: 'today' as Tone };
    if (diff === 1) return { text: t('dueTomorrow'), tone: 'future' as Tone };
    if (diff === -1) return { text: t('dueYesterday'), tone: 'overdue' as Tone };
    if (diff < -1) return { text: t('overdueBy', { count: Math.abs(diff) }), tone: 'overdue' as Tone };
    return { text: date, tone: 'future' as Tone };
  }, [diff, task.done, task.due, t, today]);

  const repeatLabel =
    task.repeat === 'daily' ? t('repeatDaily') : task.repeat === 'weekly' ? t('repeatWeekly') : null;

  const targets = [
    { key: 'today', due: today, label: t('chipToday'), aria: t('rescheduleToday', { title: task.title }) },
    {
      key: 'tomorrow',
      due: addDays(today, 1),
      label: t('chipTomorrow'),
      aria: t('rescheduleTomorrow', { title: task.title }),
    },
    {
      key: 'next-week',
      due: addDays(today, 7),
      label: t('chipNextWeek'),
      aria: t('rescheduleNextWeek', { title: task.title }),
    },
  ];

  return (
    <li className={`task${task.done ? ' is-done' : ''}`} data-task-id={task.id}>
      <button
        type="button"
        className="tick"
        aria-pressed={task.done}
        aria-label={task.done ? t('undoneToggle', { title: task.title }) : t('doneToggle', { title: task.title })}
        onClick={() => onToggle(task.id)}
      >
        <span className="tick-ring" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M5 12.5l4.2 4.2L19 6.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      <div className="task-body">
        <span className="task-title">{task.title}</span>
        <span className="task-meta" data-tone={label.tone}>
          <span>{label.text}</span>
          {repeatLabel && (
            <span className="task-repeat" aria-label={t('repeats', { repeat: repeatLabel })}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 11a8 8 0 0113.7-5.7L20 7.5M20 4v3.5h-3.5M20 13a8 8 0 01-13.7 5.7L4 16.5M4 20v-3.5h3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {repeatLabel}
            </span>
          )}
        </span>
      </div>

      <button
        type="button"
        className="task-delete"
        aria-label={t('delete', { title: task.title })}
        onClick={() => onDelete(task.id)}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 7h16M9.5 7V4.8h5V7M6.5 7l.8 12.2a1.6 1.6 0 001.6 1.5h6.2a1.6 1.6 0 001.6-1.5L17.5 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {!task.done && (
        <div className="task-actions" role="group" aria-label={t('reschedule', { title: task.title })}>
          {targets.map((target) => (
            <button
              key={target.key}
              type="button"
              className="chip"
              aria-label={target.aria}
              aria-current={task.due === target.due ? 'date' : undefined}
              onClick={() => onReschedule(task.id, target.due)}
            >
              {target.label}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
