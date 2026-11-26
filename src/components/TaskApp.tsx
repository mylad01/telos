'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Composer } from './Composer';
import { SyncPanel } from './SyncPanel';
import { TaskRow, type TaskPatch } from './TaskRow';
import { downloadBackup, parseBackup } from '@/lib/backup';
import { addDays, daysFromToday, nextOccurrence, parseISODate, todayISODate } from '@/lib/dates';
import { visibleTasks } from '@/lib/filters';
import { dueReminders, markNotified, type NotifiedMap } from '@/lib/reminders';
import { searchTasks } from '@/lib/search';
import { loadTasks, saveTasks } from '@/lib/storage';
import {
  listsOf,
  markDescendantsDeleted,
  mergeTaskLists,
  type Filter,
  type Repeat,
  type Task,
} from '@/lib/tasks';
import { nextTheme, readStoredTheme, resolveTheme, storeTheme, type Theme } from '@/lib/theme';
import { useSync } from '@/lib/useSync';

const FILTERS: Filter[] = ['today', 'week', 'all', 'done'];
const LOCALE = 'en';
const UNDO_MS = 8_000;
const NOTIFIED_KEY = 'telos.reminders.v1';
const REMINDER_TICK_MS = 30_000;

function newId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

type Pending = { kind: 'delete'; task: Task } | { kind: 'clear'; tasks: Task[] };

export function TaskApp() {
  const t = useTranslations();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [filter, setFilter] = useState<Filter>('today');
  const [listScope, setListScope] = useState<string | null>(null);
  const [tagScope, setTagScope] = useState<string | null>(null);
  const [today, setToday] = useState<string>(todayISODate);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [toastPaused, setToastPaused] = useState(false);
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState<Theme>('system');
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
    setTheme(readStoredTheme());
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme, media.matches);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    if (tasks === null || typeof window === 'undefined' || !('Notification' in window)) return;
    const tick = () => {
      if (Notification.permission !== 'granted') return;
      let notified: NotifiedMap = {};
      try {
        notified = JSON.parse(window.localStorage.getItem(NOTIFIED_KEY) ?? '{}') as NotifiedMap;
      } catch {
        notified = {};
      }
      const now = new Date();
      const due = dueReminders(tasks, now, notified);
      if (due.length === 0) return;
      for (const task of due) {
        new Notification(task.title, {
          body: t('reminders.body', { time: task.remindAt ?? '' }),
          tag: task.id,
        });
      }
      window.localStorage.setItem(NOTIFIED_KEY, JSON.stringify(markNotified(notified, due, now)));
    };
    tick();
    const timer = window.setInterval(tick, REMINDER_TICK_MS);
    return () => window.clearInterval(timer);
  }, [tasks, t]);

  useEffect(() => {
    if (!pending || toastPaused) return;
    const timer = window.setTimeout(() => setPending(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [pending, toastPaused]);

  useEffect(() => {
    if (!pending) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPending(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pending]);

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

  const scoped = useMemo(
    () =>
      all
        .filter((task) => (listScope ? task.list === listScope : true))
        .filter((task) => (tagScope ? task.tags.includes(tagScope) : true)),
    [all, listScope, tagScope],
  );

  const counts = useMemo(() => {
    let dueToday = 0;
    let overdue = 0;
    let week = 0;
    let done = 0;
    for (const task of scoped) {
      if (task.done) {
        done += 1;
        continue;
      }
      const diff = daysFromToday(task.due, today);
      const waiting = task.start !== null && task.start > today;
      if (!waiting) {
        if (diff <= 0) dueToday += 1;
        if (diff < 0) overdue += 1;
      }
      if (diff <= 7 && (task.start === null || task.start <= addDays(today, 7))) week += 1;
    }
    return { dueToday, overdue, week, done, total: scoped.length };
  }, [scoped, today]);

  const lists = useMemo(() => listsOf(tasks ?? []), [tasks]);

  const listCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of all) map.set(task.list, (map.get(task.list) ?? 0) + 1);
    return map;
  }, [all]);

  const visible = useMemo(
    () =>
      searchTasks(
        visibleTasks(tasks ?? [], filter, today, { list: listScope, tag: tagScope }),
        query,
      ),
    [tasks, filter, today, query, listScope, tagScope],
  );

  function addTask(title: string, due: string, repeat: Repeat, list: string) {
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
      notes: '',
      pinned: false,
      remindAt: null,
      list,
      tags: [],
      priority: 0,
      start: null,
      subtasks: [],
    };
    setTasks([task, ...tasks]);
    if (filter === 'done') setFilter('today');
    if (tagScope) setTagScope(null);
    if (listScope && listScope !== list) setListScope(list);
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
        notes: task.notes,
        pinned: task.pinned,
        remindAt: task.remindAt,
        list: task.list,
        tags: task.tags,
        priority: task.priority,
        start: task.start,
        subtasks: task.subtasks,
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

  function updateTask(id: string, patch: TaskPatch) {
    const now = Date.now();
    setTasks((current) =>
      current?.map((task) =>
        task.id === id && task.deletedAt === null ? { ...task, ...patch, updatedAt: now } : task,
      ) ?? current,
    );
    if (
      patch.remindAt &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      void Notification.requestPermission();
    }
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
    setPending({ kind: 'delete', task });
    setToastPaused(false);
    window.requestAnimationFrame(() => {
      const next =
        document.querySelector<HTMLElement>('.task .tick') ??
        document.querySelector<HTMLElement>('.composer-title');
      next?.focus();
    });
  }

  function clearDone() {
    if (tasks === null) return;
    const cleared = tasks.filter((task) => task.done && task.deletedAt === null);
    if (cleared.length === 0) return;
    const now = Date.now();
    const ids = new Set(cleared.map((task) => task.id));
    setTasks(
      tasks.map((item) =>
        ids.has(item.id) ? { ...item, deletedAt: now, updatedAt: now } : item,
      ),
    );
    setPending({ kind: 'clear', tasks: cleared });
    setToastPaused(false);
  }

  function undoPending() {
    if (!pending) return;
    const now = Date.now();
    const ids =
      pending.kind === 'delete'
        ? new Set([pending.task.id])
        : new Set(pending.tasks.map((task) => task.id));
    setTasks((current) =>
      current?.map((item) =>
        ids.has(item.id) ? { ...item, deletedAt: null, updatedAt: now } : item,
      ) ?? current,
    );
    setPending(null);
    window.requestAnimationFrame(() => {
      const first = [...ids][0];
      document.querySelector<HTMLElement>(`[data-task-id="${first}"] .tick`)?.focus();
    });
  }

  function cycleTheme() {
    const next = nextTheme(theme);
    storeTheme(next);
    setTheme(next);
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
  const searching = query.trim().length > 0;
  const themeLabel =
    theme === 'system' ? t('theme.system') : theme === 'light' ? t('theme.light') : t('theme.dark');

  return (
    <main className={`shell${pending ? ' has-toast' : ''}`} id="main">
      <header className="topbar">
        <span className="wordmark">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="7.6" stroke="currentColor" strokeWidth="1.3" opacity="0.55" />
            <path d="M10 5.4v5l3 2.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          {t('appName')}
        </span>
        <span className="topbar-rule" aria-hidden="true" />
        <button
          type="button"
          className="theme-toggle"
          aria-label={t('theme.change', { mode: themeLabel })}
          title={t('theme.change', { mode: themeLabel })}
          onClick={cycleTheme}
        >
          {theme === 'dark' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          ) : theme === 'light' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="7.4" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 4.6a7.4 7.4 0 000 14.8z" fill="currentColor" opacity="0.5" />
            </svg>
          )}
          <span className="sr-only">{themeLabel}</span>
        </button>
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

      <Composer today={today} lists={lists} onAdd={addTask} disabled={tasks === null} />

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

      <div className="list-chips" role="group" aria-label={t('lists.label')}>
        <button
          type="button"
          className="list-chip"
          aria-pressed={listScope === null}
          onClick={() => setListScope(null)}
        >
          {t('lists.all')}
          <span className="filter-count">{numberFormat.format(all.length)}</span>
        </button>
        {lists.map((name) => (
          <button
            key={name}
            type="button"
            className="list-chip"
            aria-pressed={listScope === name}
            onClick={() => setListScope(listScope === name ? null : name)}
          >
            {name}
            <span className="filter-count">
              {numberFormat.format(listCounts.get(name) ?? 0)}
            </span>
          </button>
        ))}
      </div>

      <div className="search">
        <label className="sr-only" htmlFor="task-search">
          {t('search.label')}
        </label>
        <input
          id="task-search"
          type="search"
          className="search-input"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {searching && (
          <button
            type="button"
            className="search-clear"
            aria-label={t('search.clear')}
            onClick={() => setQuery('')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <div className="list-head">
        <span className="list-head-left">
          {tagScope ? (
            <button
              type="button"
              className="tag-chip"
              aria-label={t('lists.clearTag', { tag: tagScope })}
              onClick={() => setTagScope(null)}
            >
              #{tagScope}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
          ) : searching ? (
            t('search.count', { count: visible.length })
          ) : filter === 'week' ? (
            t('list.weekRange')
          ) : (
            t('list.sortedBy')
          )}
        </span>
        {filter === 'done' && counts.done > 0 && !searching ? (
          <button type="button" className="clear-done" onClick={clearDone}>
            {t('list.clearDone')}
          </button>
        ) : visible.length > 0 ? (
          <span>{t('list.count', { count: visible.length })}</span>
        ) : null}
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
          {searching ? (
            <>
              <h2>{t('search.emptyTitle')}</h2>
              <p>{t('search.empty', { query: query.trim() })}</p>
            </>
          ) : (
            <>
              <h2>{t(`empty.${emptyKey}Title`)}</h2>
              <p>{t(`empty.${emptyKey}Body`)}</p>
            </>
          )}
        </div>
      ) : (
        <ul className="task-list">
          {visible.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              today={today}
              lists={lists}
              onToggle={toggleTask}
              onDelete={deleteTask}
              onReschedule={rescheduleTask}
              onUpdate={updateTask}
              onTagFilter={(tag) => setTagScope(tagScope === tag ? null : tag)}
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

      {pending && (
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
          <span className="toast-text">
            {pending.kind === 'delete'
              ? t('toast.deleted', { title: pending.task.title })
              : t('toast.cleared', { count: pending.tasks.length })}
          </span>
          <button type="button" className="toast-undo" onClick={undoPending}>
            {t('toast.undo')}
          </button>
          <button
            type="button"
            className="toast-dismiss"
            aria-label={t('toast.dismiss')}
            onClick={() => setPending(null)}
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
