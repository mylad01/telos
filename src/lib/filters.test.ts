import { describe, expect, it } from 'vitest';
import { visibleTasks } from './filters';
import type { Task } from './tasks';

function make(overrides: Partial<Task> = {}): Task {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'Task',
    due: '2026-11-25',
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
    remindAt: null,
    list: 'Inbox',
    tags: [],
    priority: 0,
    start: null,
    subtasks: [],
    ...overrides,
  };
}

const TODAY = '2026-11-25';

const tasks = [
  make({ id: 'overdue', title: 'Overdue', due: '2026-11-20' }),
  make({ id: 'today', title: 'Today', due: TODAY }),
  make({ id: 'soon', title: 'In three days', due: '2026-11-28' }),
  make({ id: 'nextweek', title: 'Next week', due: '2026-12-02' }),
  make({ id: 'later', title: 'Later', due: '2026-12-20' }),
  make({ id: 'done', title: 'Done', due: TODAY, done: true, completedAt: 10 }),
  make({ id: 'gone', title: 'Gone', due: TODAY, deletedAt: 5 }),
];

const ids = (list: Task[]) => list.map((task) => task.id);

describe('visibleTasks', () => {
  it('today means today plus overdue, open only', () => {
    expect(ids(visibleTasks(tasks, 'today', TODAY))).toEqual(['overdue', 'today']);
  });

  it('week covers today through seven days out, overdue included', () => {
    expect(ids(visibleTasks(tasks, 'week', TODAY))).toEqual(['overdue', 'today', 'soon', 'nextweek']);
  });

  it('done lists finished tasks newest first', () => {
    const finished = [
      make({ id: 'old', done: true, completedAt: 10 }),
      make({ id: 'new', done: true, completedAt: 30 }),
    ];
    expect(ids(visibleTasks(finished, 'done', TODAY))).toEqual(['new', 'old']);
  });

  it('all lists open before done, by due date', () => {
    expect(ids(visibleTasks(tasks, 'all', TODAY))).toEqual([
      'overdue',
      'today',
      'soon',
      'nextweek',
      'later',
      'done',
    ]);
  });

  it('never shows tombstones', () => {
    for (const filter of ['today', 'week', 'all', 'done'] as const) {
      expect(ids(visibleTasks(tasks, filter, TODAY))).not.toContain('gone');
    }
  });
});
