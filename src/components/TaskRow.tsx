'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { addDays, daysFromToday, parseISODate } from '@/lib/dates';
import { parseTags, type Priority, type Repeat, type Subtask, type Task } from '@/lib/tasks';

type Tone = 'today' | 'overdue' | 'future';
const LOCALE = 'en';

export type TaskPatch = Partial<
  Pick<Task, 'title' | 'due' | 'repeat' | 'notes' | 'pinned' | 'remindAt' | 'list' | 'tags' | 'priority' | 'start' | 'subtasks' | 'evening'>
>;

const REPEATS: Repeat[] = [
  'none',
  'daily',
  'weekdays',
  'weekly',
  'biweekly',
  'monthly',
  'monthly-last',
];

const REPEAT_KEYS: Record<Repeat, string> = {
  none: 'repeatNone',
  daily: 'repeatDaily',
  weekdays: 'repeatWeekdays',
  weekly: 'repeatWeekly',
  biweekly: 'repeatBiweekly',
  monthly: 'repeatMonthly',
  'monthly-last': 'repeatMonthlyLast',
};
const PRIORITIES: Priority[] = [0, 1, 2, 3];

function subtaskId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function TaskRow({
  task,
  today,
  lists,
  onToggle,
  onDelete,
  onReschedule,
  onUpdate,
  onTagFilter,
  onDropBefore,
}: {
  task: Task;
  today: string;
  lists: string[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onReschedule: (id: string, due: string) => void;
  onUpdate: (id: string, patch: TaskPatch) => void;
  onTagFilter: (tag: string) => void;
  /** Present only while manual ordering is on: drag `movingId` before this row. */
  onDropBefore?: (movingId: string, targetId: string) => void;
}) {
  const t = useTranslations('task');
  const diff = daysFromToday(task.due, today);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dropTarget, setDropTarget] = useState(false);
  const [draft, setDraft] = useState({
    title: task.title,
    due: task.due,
    start: task.start ?? '',
    repeat: task.repeat,
    notes: task.notes,
    remindAt: task.remindAt ?? '',
    list: task.list,
    tags: task.tags.join(', '),
    priority: task.priority,
    subtasks: task.subtasks,
    evening: task.evening,
    subtask: '',
  });

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

  const repeatLabel = task.repeat === 'none' ? null : t(REPEAT_KEYS[task.repeat]);

  const doneSubtasks = task.subtasks.filter((item) => item.done).length;

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

  function openEditor() {
    setDraft({
      title: task.title,
      due: task.due,
      start: task.start ?? '',
      repeat: task.repeat,
      notes: task.notes,
      remindAt: task.remindAt ?? '',
      list: task.list,
      tags: task.tags.join(', '),
      priority: task.priority,
      subtasks: task.subtasks,
      evening: task.evening,
      subtask: '',
    });
    setEditing(true);
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) return;
    onUpdate(task.id, {
      title,
      due: draft.due || task.due,
      start: draft.start || null,
      repeat: draft.repeat,
      notes: draft.notes.trim(),
      remindAt: draft.remindAt || null,
      list: draft.list.trim() || 'Inbox',
      tags: parseTags(draft.tags.split(',')),
      priority: draft.priority,
      subtasks: draft.subtasks,
      evening: draft.evening,
    });
    setEditing(false);
  }

  function addSubtask() {
    const title = draft.subtask.trim();
    if (!title) return;
    setDraft({
      ...draft,
      subtasks: [...draft.subtasks, { id: subtaskId(), title, done: false }],
      subtask: '',
    });
  }

  if (editing) {
    return (
      <li className="task is-editing">
        <form
          className="task-form"
          onSubmit={save}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setEditing(false);
            }
          }}
        >
          <h3 className="sr-only">{t('editTitle')}</h3>
          <label className="field">
            <span className="field-label">{t('titleLabel')}</span>
            <input
              className="field-input"
              value={draft.title}
              autoFocus
              required
              maxLength={200}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field-label">{t('startLabel')}</span>
              <input
                className="field-input"
                type="date"
                value={draft.start}
                max={draft.due || undefined}
                onChange={(event) => setDraft({ ...draft, start: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">{t('dueLabel')}</span>
              <input
                className="field-input"
                type="date"
                value={draft.due}
                onChange={(event) => setDraft({ ...draft, due: event.target.value })}
              />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span className="field-label">{t('listLabel')}</span>
              <input
                className="field-input"
                value={draft.list}
                list={`task-lists-${task.id}`}
                maxLength={40}
                onChange={(event) => setDraft({ ...draft, list: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">{t('remindLabel')}</span>
              <input
                className="field-input"
                type="time"
                value={draft.remindAt}
                onChange={(event) => setDraft({ ...draft, remindAt: event.target.value })}
              />
            </label>
          </div>

          <label className="field">
            <span className="field-label">{t('tagsLabel')}</span>
            <input
              className="field-input"
              value={draft.tags}
              placeholder={t('tagsPlaceholder')}
              maxLength={120}
              onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
            />
          </label>

          <fieldset className="field">
            <legend className="field-label">{t('priorityLabel')}</legend>
            <div className="repeat-chips">
              {PRIORITIES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="chip"
                  aria-pressed={draft.priority === value}
                  onClick={() => setDraft({ ...draft, priority: value })}
                >
                  {value === 0 ? t('priorityNone') : t('priorityLevel', { level: value })}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="field">
            <legend className="field-label">{t('whenLabel')}</legend>
            <div className="repeat-chips">
              <button
                type="button"
                className="chip"
                aria-pressed={draft.evening}
                onClick={() => setDraft({ ...draft, evening: !draft.evening })}
              >
                {t('evening')}
              </button>
            </div>
          </fieldset>

          <fieldset className="field">
            <legend className="field-label">{t('repeatLabel')}</legend>
            <div className="repeat-chips">
              {REPEATS.map((repeat) => (
                <button
                  key={repeat}
                  type="button"
                  className="chip"
                  aria-pressed={draft.repeat === repeat}
                  onClick={() => setDraft({ ...draft, repeat })}
                >
                  {t(REPEAT_KEYS[repeat])}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="field">
            <legend className="field-label">{t('subtasksLabel')}</legend>
            {draft.subtasks.length > 0 && (
              <ul className="subtask-edit-list">
                {draft.subtasks.map((subtask) => (
                  <li key={subtask.id} className="subtask-edit">
                    <input
                      type="checkbox"
                      checked={subtask.done}
                      aria-label={t('subtaskDone', { title: subtask.title })}
                      onChange={() =>
                        setDraft({
                          ...draft,
                          subtasks: draft.subtasks.map((item) =>
                            item.id === subtask.id ? { ...item, done: !item.done } : item,
                          ),
                        })
                      }
                    />
                    <input
                      className="subtask-title"
                      value={subtask.title}
                      maxLength={140}
                      aria-label={t('subtaskTitle', { title: subtask.title })}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          subtasks: draft.subtasks.map((item) =>
                            item.id === subtask.id
                              ? { ...item, title: event.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="task-tool"
                      aria-label={t('subtaskRemove', { title: subtask.title })}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          subtasks: draft.subtasks.filter((item) => item.id !== subtask.id),
                        })
                      }
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="subtask-add">
              <input
                className="field-input"
                value={draft.subtask}
                placeholder={t('subtaskPlaceholder')}
                maxLength={140}
                aria-label={t('subtaskPlaceholder')}
                onChange={(event) => setDraft({ ...draft, subtask: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addSubtask();
                  }
                }}
              />
              <button type="button" className="button-quiet" onClick={addSubtask}>
                {t('subtaskAdd')}
              </button>
            </div>
          </fieldset>

          <label className="field">
            <span className="field-label">{t('noteLabel')}</span>
            <textarea
              className="field-input field-textarea"
              value={draft.notes}
              rows={2}
              maxLength={500}
              placeholder={t('notePlaceholder')}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </label>

          <div className="task-form-actions">
            <button type="submit" className="button-primary">
              {t('save')}
            </button>
            <button type="button" className="button-quiet" onClick={() => setEditing(false)}>
              {t('cancel')}
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      className={`task${task.done ? ' is-done' : ''}`}
      data-task-id={task.id}
      data-dragging={dragging ? 'true' : undefined}
      data-drop-target={dropTarget ? 'true' : undefined}
      draggable={onDropBefore ? true : undefined}
      onDragStart={
        onDropBefore
          ? (event) => {
              event.dataTransfer.setData('text/telos-task', task.id);
              event.dataTransfer.effectAllowed = 'move';
              setDragging(true);
            }
          : undefined
      }
      onDragEnd={
        onDropBefore
          ? () => {
              setDragging(false);
              setDropTarget(false);
            }
          : undefined
      }
      onDragOver={
        onDropBefore
          ? (event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDropTarget(true);
            }
          : undefined
      }
      onDragLeave={onDropBefore ? () => setDropTarget(false) : undefined}
      onDrop={
        onDropBefore
          ? (event) => {
              event.preventDefault();
              const movingId = event.dataTransfer.getData('text/telos-task');
              setDropTarget(false);
              setDragging(false);
              if (movingId && movingId !== task.id) onDropBefore(movingId, task.id);
            }
          : undefined
      }
    >
      <datalist id={`task-lists-${task.id}`}>
        {lists.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
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
        <span className="task-title">
          {task.priority > 0 && (
            <span className="priority-dot" data-priority={task.priority} aria-hidden="true" />
          )}
          {task.title}
        </span>
        {task.notes && <span className="task-note">{task.notes}</span>}
        <span className="task-meta" data-tone={label.tone}>
          <span className="task-list-name">{task.list}</span>
          <span>{label.text}</span>
          {task.remindAt && (
            <span className="task-reminder">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              {t('remindAt', { time: task.remindAt })}
            </span>
          )}
          {repeatLabel && (
            <span className="task-repeat" aria-label={t('repeats', { repeat: repeatLabel })}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 11a8 8 0 0113.7-5.7L20 7.5M20 4v3.5h-3.5M20 13a8 8 0 01-13.7 5.7L4 16.5M4 20v-3.5h3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {repeatLabel}
            </span>
          )}
          {task.evening && <span className="task-evening">{t('evening')}</span>}
          {task.subtasks.length > 0 && (
            <span
              className={`task-subtasks${doneSubtasks === task.subtasks.length ? ' is-complete' : ''}`}
              aria-label={t('subtaskProgress', { done: doneSubtasks, total: task.subtasks.length })}
            >
              {t('subtaskProgress', { done: doneSubtasks, total: task.subtasks.length })}
            </span>
          )}
          {task.pinned && <span className="task-pinned">{t('pinned')}</span>}
          {task.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="task-tag"
              aria-label={t('filterByTag', { tag })}
              onClick={() => onTagFilter(tag)}
            >
              #{tag}
            </button>
          ))}
          <span className="task-tools">
            <button
              type="button"
              className="task-tool"
              aria-pressed={task.pinned}
              aria-label={task.pinned ? t('unpin', { title: task.title }) : t('pin', { title: task.title })}
              onClick={() => onUpdate(task.id, { pinned: !task.pinned })}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.9l6-.8L12 3.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill={task.pinned ? 'currentColor' : 'none'} />
              </svg>
            </button>
            <button
              type="button"
              className="task-tool"
              aria-label={t('edit', { title: task.title })}
              onClick={openEditor}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 20h4l10.5-10.5a2.1 2.1 0 00-3-3L5 17v3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </button>
          </span>
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
