import { describe, expect, it } from 'vitest';
import { dueReminders, isReminderDue, markNotified } from './reminders';
import type { Task } from './tasks';

function make(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Standup',
    due: '2026-11-26',
    done: false,
    createdAt: 1,
    completedAt: null,
    repeat: 'none',
    seriesId: null,
    previousId: null,
    updatedAt: 1,
    deletedAt: null,
    notes: '',
    pinned: false,
    remindAt: '09:00',
    list: 'Inbox',
    tags: [],
    priority: 0,
    start: null,
    subtasks: [],
    ...overrides,
  };
}

const AT_930 = new Date(2026, 10, 26, 9, 30);

describe('reminders', () => {
  it('fires at the reminder time on the due day', () => {
    expect(isReminderDue(make(), AT_930, {})).toBe(true);
    expect(isReminderDue(make(), new Date(2026, 10, 26, 8, 59), {})).toBe(false);
  });

  it('stays quiet for done, deleted, unscheduled or other-day tasks', () => {
    expect(isReminderDue(make({ done: true }), AT_930, {})).toBe(false);
    expect(isReminderDue(make({ deletedAt: 5 }), AT_930, {})).toBe(false);
    expect(isReminderDue(make({ remindAt: null }), AT_930, {})).toBe(false);
    expect(isReminderDue(make({ due: '2026-11-27' }), AT_930, {})).toBe(false);
  });

  it('fires once per day', () => {
    expect(isReminderDue(make(), AT_930, { t1: '2026-11-26' })).toBe(false);
    expect(isReminderDue(make(), AT_930, { t1: '2026-11-25' })).toBe(true);
  });

  it('orders the batch by reminder time', () => {
    const tasks = [
      make({ id: 'late', remindAt: '18:00' }),
      make({ id: 'early', remindAt: '09:00' }),
    ];
    const evening = new Date(2026, 10, 26, 19, 0);
    expect(dueReminders(tasks, evening, {}).map((task) => task.id)).toEqual(['early', 'late']);
  });

  it('keeps only today in the notified map', () => {
    expect(markNotified({ old: '2026-11-25', keep: '2026-11-26' }, [make()], AT_930)).toEqual({
      keep: '2026-11-26',
      t1: '2026-11-26',
    });
  });
});
