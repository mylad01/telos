'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Composer } from './Composer';
import { SyncPanel } from './SyncPanel';
import { TaskRow } from './TaskRow';
import { downloadBackup, parseBackup } from '@/lib/backup';
import { daysFromToday, nextOccurrence, parseISODate, todayISODate } from '@/lib/dates';
import { loadTasks, saveTasks } from '@/lib/storage';
import {
  markDescendantsDeleted,
  mergeTaskLists,
  type Filter,
  type Repeat,
  type Task,
} from '@/lib/tasks';
import { useSync } from '@/lib/useSync';

const FILTERS: Filter[] = ['today', 'week', 'all', 'done'];
const LOCALE = 'en';
const UNDO_MS = 8_000;

function newId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

type PendingDelete = { task: Task };

export function TaskApp() {
  const t = useTranslations();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [filter, setFilter] = useState<Filter>('today');
  const [today, setToday] = useState<string>(todayISODate);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [toastPaused, setToastPaused] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(
    null,
  );

  const sync = useSync(tasks, setTasks);

  useEffect(() => {
    const result = loadTasks();
    setTasks(result.tasks);
    if (result.status === 'blocked') setStorageBlocked(true);
  }, []);

  useEffect(() => {
    const sync = () => setToday(todayISODate());
    sync();
    const timer = window.setInterval(sync, 60_000);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  useEffect(() => {
    if (tasks === null) return;
    if (!saveTasks(tasks)) setStorageBlocked(true);
  }, [tasks]);

  useEffect(() => {
    if (!pendingDelete || toastPaused) return;
    const timer = window.setTimeout(() => setPendingDelete(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [pendingDelete, toastPaused]);

  useEffect(() => {
    if (!pendingDelete) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPendingDelete(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pendingDelete]);

  const collator = useMemo(() => new Intl.Collator(LOCALE), []);
  const numberFormat = useMemo(() => new Intl.NumberFormat(LOCALE), []);
  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(LOCALE, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      }),
    [],
  );

  const all = useMemo(
    () => (tasks ?? []).filter((task) => task.deletedAt === null),
    [tasks],
  );

  const counts = useMemo(() => {
    let dueToday = 0;
    let overdue = 0;
    let week = 0;
    let done = 0;
    for (const task of all) {
      if (task.done) {
        done += 1;
        continue;
      }
      const diff = daysFromToday(task.due, today);
      if (diff <= 0) dueToday += 1;
      if (diff < 0) overdue += 1;
      if (diff <= 7) week += 1;
    }
    return { dueToday, overdue, week, done, total: all.length };
  }, [all, today]);

  const visible = useMemo(() => {
    const byDue = (a: Task, b: Task) => a.due.localeCompare(b.due) || a.createdAt - b.createdAt;
    if (filter === 'today') {
      return all
        .filter((task) => !task.done && daysFromToday(task.due, today) <= 0)
        .sort(byDue);
    }
    if (filter === 'week') {
      return all
        .filter((task) => !task.done && daysFromToday(task.due, today) <= 7)
        .sort(byDue);
    }
    if (filter === 'done') {
      return all
        .filter((task) => task.done)
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
    }
    return [...all].sort(
      (a, b) =>
        Number(a.done) - Number(b.done) || byDue(a, b) || collator.compare(a.title, b.title),
    );
  }, [all, collator, filter, today]);

  function addTask(title: string, due: string, repeat: Repeat) {
    if (tasks === null) return;
    const id = newId();
    const now = Date.now();
    const task: Task = {
      id,
      title,
      due,
      done: false,
      createdAt: now,
      completedAt: null,
      repeat,
      seriesId: repeat === 'none' ? null : id,
      previousId: null,
      updatedAt: now,
      deletedAt: null,
    };
    setTasks([task, ...tasks]);
    if (filter === 'done') setFilter('today');
  }

  function toggleTask(id: string) {
    setTasks((current) => {
      if (current === null) return current;
      const task = current.find((item) => item.id === id && item.deletedAt === null);
      if (!task) return current;
      const now = Date.now();

      if (task.done) {
        return markDescendantsDeleted(current, id, now).map((item) =>
          item.id === id
            ? { ...item, done: false, completedAt: null, updatedAt: now }
            : item,
        );
      }

      const marked = current.map((item) =>
        item.id === id
          ? { ...item, done: true, completedAt: now, updatedAt: now }
          : item,
      );
      if (task.repeat === 'none') return marked;

      const next: Task = {
        id: newId(),
        title: task.title,
        due: nextOccurrence(task.due, task.repeat, today),
        done: false,
        createdAt: now,
        completedAt: null,
        repeat: task.repeat,
        seriesId: task.seriesId ?? task.id,
        previousId: task.id,
        updatedAt: now,
        deletedAt: null,
      };
      return [...marked, next];
    });
  }

  function rescheduleTask(id: string, due: string) {
    const now = Date.now();
    setTasks((current) =>
      current?.map((task) =>
        task.id === id ? { ...task, due, updatedAt: now } : task,
      ) ?? current,
    );
  }

  function deleteTask(id: string) {
    if (tasks === null) return;
    const task = tasks.find((item) => item.id === id && item.deletedAt === null);
    if (!task) return;
    const now = Date.now();
    setTasks(
      tasks.map((item) =>
        item.id === id ? { ...item, deletedAt: now, updatedAt: now } : item,
      ),
    );
    setPendingDelete({ task });
    setToastPaused(false);
    window.requestAnimationFrame(() => {
      const next =
        document.querySelector<HTMLElement>('.task .tick') ??
        document.querySelector<HTMLElement>('.composer-title');
      next?.focus();
    });
  }

  function undoDelete() {
    if (!pendingDelete) return;
    const { task } = pendingDelete;
    const now = Date.now();
    setTasks((current) =>
      current?.map((item) =>
        item.id === task.id ? { ...item, deletedAt: null, updatedAt: now } : item,
      ) ?? current,
    );
    setPendingDelete(null);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-task-id="${task.id}"] .tick`)?.focus();
    });
  }

  function exportTasks() {
    downloadBackup(tasks ?? []);
  }

  async function importTasks(file: File) {
    try {
      const incoming = parseBackup(await file.text());
      if (tasks === null) return;
      const applied = incoming.filter((item) => {
        const known = tasks.find((task) => task.id === item.id);
        return !known || item.updatedAt > known.updatedAt;
      }).length;
      setTasks(mergeTaskLists(tasks, incoming));
      setBackupMessage({
        kind: 'ok',
        text: t('backup.imported', { count: applied }),
      });
    } catch {
      setBackupMessage({ kind: 'error', text: t('backup.invalid') });
    }
  }

  const emptyKey = filter;
  const filterLabel = (value: Filter) => t(`filters.${value}`);
  const summaryText =
    filter === 'week'
      ? t('summary.thisWeek', { count: counts.week })
      : filter === 'done'
        ? t('summary.doneCount', { count: counts.done })
        : t('summary.dueToday', { count: counts.dueToday });
  const showOverdue = counts.overdue > 0 && filter !== 'done';
  const filterCount = (value: Filter) =>
    value === 'today'
      ? counts.dueToday
      : value === 'week'
        ? counts.week
        : value === 'done'
          ? counts.done
          : counts.total;

  return (
    <main className="shell" id="main">
      <header className="topbar">
        <span className="wordmark">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="7.6" stroke="currentColor" strokeWidth="1.3" opacity="0.55" />
            <path d="M10 5.4v5l3 2.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          {t('appName')}
        </span>
        <span className="topbar-rule" aria-hidden="true" />
      </header>

      <section className="intro">
        <p className="eyebrow" suppressHydrationWarning>
          {dateFormat.format(parseISODate(today))}
        </p>
        <h1 className="headline">{filterLabel(filter)}</h1>
        <p className="summary" aria-live="polite" suppressHydrationWarning>
          {summaryText}
          {showOverdue && (
            <>
              <span className="sep" aria-hidden="true">
                ·
              </span>
              <span className="overdue">{t('summary.overdue', { count: counts.overdue })}</span>
            </>
          )}
        </p>
      </section>

      {storageBlocked && (
        <div className="alert" role="alert">
          <span className="alert-rule" aria-hidden="true" />
          <div>
            <h2>{t('storage.errorTitle')}</h2>
            <p>{t('storage.errorBody')}</p>
          </div>
        </div>
      )}

      <Composer today={today} onAdd={addTask} disabled={tasks === null} />

      <div className="filters" role="group" aria-label={t('filters.label')}>
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            className="filter"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {filterLabel(value)}
            <span className="filter-count">{numberFormat.format(filterCount(value))}</span>
          </button>
        ))}
      </div>

      <div className="list-head">
        <span>{filter === 'week' ? t('list.weekRange') : t('list.sortedBy')}</span>
        <span>{t('list.count', { count: visible.length })}</span>
      </div>

      {tasks === null ? (
        <div aria-busy="true" aria-label={t('storage.loading')}>
          {[0, 1, 2].map((index) => (
            <div className="skeleton-row" key={index}>
              <span className="skeleton ring" />
              <span className="skeleton" style={{ width: `${62 - index * 9}%` }} />
              <span />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="empty">
          <span className="empty-mark" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M4 12.8l4.4 4.4L20 5.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h2>{t(`empty.${emptyKey}Title`)}</h2>
          <p>{t(`empty.${emptyKey}Body`)}</p>
        </div>
      ) : (
        <ul className="task-list">
          {visible.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              today={today}
              onToggle={toggleTask}
              onDelete={deleteTask}
              onReschedule={rescheduleTask}
            />
          ))}
        </ul>
      )}

      <footer className="footer">
        <div className="progress-line">
          <span>
            {t('summary.progress', {
              done: numberFormat.format(counts.done),
              total: numberFormat.format(counts.total),
            })}
          </span>
        </div>
        {counts.total > 0 && (
          <div className="progress-track" aria-hidden="true">
            <div
              className="progress-fill"
              style={{ width: `${Math.round((counts.done / counts.total) * 100)}%` }}
            />
          </div>
        )}
        <p className="footnote">{t('footer.saved')}</p>
      </footer>

      <SyncPanel
        enabled={sync.enabled}
        account={sync.account}
        status={sync.status}
        pending={sync.pending}
        lastSyncedAt={sync.lastSyncedAt}
        onSignIn={sync.signIn}
        onSignUp={sync.signUp}
        onSignOut={sync.signOut}
        onExport={exportTasks}
        onImport={importTasks}
        backupMessage={backupMessage}
      />

      {pendingDelete && (
        <div
          className="toast"
          role="status"
          onMouseEnter={() => setToastPaused(true)}
          onMouseLeave={() => setToastPaused(false)}
          onFocusCapture={() => setToastPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setToastPaused(false);
            }
          }}
        >
          <span className="toast-text">{t('toast.deleted', { title: pendingDelete.task.title })}</span>
          <button type="button" className="toast-undo" onClick={undoDelete}>
            {t('toast.undo')}
          </button>
          <button
            type="button"
            className="toast-dismiss"
            aria-label={t('toast.dismiss')}
            onClick={() => setPendingDelete(null)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
    </main>
  );
}
