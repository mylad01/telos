'use client';

import { useTranslations } from 'next-intl';
import type { ShareSnapshot } from '@/lib/public-link';
import { parseISODate } from '@/lib/dates';

/** Read-only rendering of a list snapshot carried in the URL hash. */
export function SharedView({ snapshot }: { snapshot: ShareSnapshot }) {
  const t = useTranslations('shared');
  const open = snapshot.tasks.filter((task) => !task.done).length;
  const sharedOn = new Date(snapshot.sharedAt);
  const dayFormat = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' });
  const dueFormat = new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

  return (
    <main className="shared">
      <header className="shared-head">
        <p className="shared-kicker">{t('kicker')}</p>
        <h1 className="shared-title">{snapshot.list ?? t('allLists')}</h1>
        <p className="shared-meta">
          {t('meta', {
            count: snapshot.tasks.length,
            open,
            date: dayFormat.format(sharedOn),
          })}
        </p>
      </header>

      <ul className="shared-list">
        {snapshot.tasks.map((task) => (
          <li className={`shared-row${task.done ? ' is-done' : ''}`} key={task.id}>
            <span className={`shared-ring${task.done ? ' is-done' : ''}`} aria-hidden="true">
              {task.done && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 12.8l4.4 4.4L20 5.7"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <span className="shared-body">
              <span className="shared-task-title">{task.title}</span>
              {task.notes && <span className="shared-notes">{task.notes}</span>}
              {task.subtasks.length > 0 && (
                <span className="shared-notes">
                  {t('subtasks', {
                    done: task.subtasks.filter((sub) => sub.done).length,
                    count: task.subtasks.length,
                  })}
                </span>
              )}
            </span>
            <span className="shared-due">{dueFormat.format(parseISODate(task.due))}</span>
          </li>
        ))}
      </ul>

      <footer className="shared-foot">
        <p>{t('foot')}</p>
        <a className="shared-cta" href="./">
          {t('openApp')}
        </a>
      </footer>
    </main>
  );
}
