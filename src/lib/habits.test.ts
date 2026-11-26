import { describe, expect, it } from 'vitest';
import { habitStats } from './habits';
import type { Repeat, Task } from './tasks';

const TODAY = '2026-11-26';

function make(overrides: Partial<Task> = {}): Task {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'Task',
    due: TODAY,
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
    evening: false,
    ...overrides,
  };
}

function series(
  seriesId: string,
  repeat: Repeat,
  done: string[],
  open: string[] = [],
  title = seriesId,
): Task[] {
  return [
    ...done.map((due) =>
      make({ title, due, done: true, completedAt: 1, repeat, seriesId }),
    ),
    ...open.map((due) => make({ title, due, repeat, seriesId })),
  ];
}

describe('habitStats', () => {
  it('counts a daily chain of three', () => {
    const tasks = series('gym', 'daily', ['2026-11-24', '2026-11-25', '2026-11-26'], [], 'Gym');
    expect(habitStats(tasks, TODAY)).toEqual([
      { seriesId: 'gym', title: 'Gym', streak: 3, done: 3, lastDone: '2026-11-26' },
    ]);
  });

  it('resets the streak at a gap', () => {
    const tasks = series('gym', 'daily', ['2026-11-22', '2026-11-23', '2026-11-25', '2026-11-26']);
    expect(habitStats(tasks, TODAY)[0].streak).toBe(2);
  });

  it('follows the weekly cadence', () => {
    const tasks = series('review', 'weekly', ['2026-11-12', '2026-11-19', '2026-11-26']);
    expect(habitStats(tasks, TODAY)[0]).toMatchObject({ streak: 3, lastDone: '2026-11-26' });
  });

  it('follows the monthly day-of-month', () => {
    const tasks = series('rent', 'monthly', ['2026-09-15', '2026-10-15', '2026-11-15']);
    expect(habitStats(tasks, TODAY)[0].streak).toBe(3);
  });

  it('reports a series with a single completion', () => {
    const tasks = series('stretch', 'daily', ['2026-11-26']);
    expect(habitStats(tasks, TODAY)).toEqual([
      { seriesId: 'stretch', title: 'stretch', streak: 1, done: 1, lastDone: '2026-11-26' },
    ]);
  });

  it('does not break the run when today is still open', () => {
    const tasks = series('gym', 'daily', ['2026-11-24', '2026-11-25'], ['2026-11-26']);
    expect(habitStats(tasks, TODAY)[0]).toMatchObject({ streak: 2, done: 2 });
  });

  it('ignores one-off tasks and series without an id', () => {
    const tasks = [
      make({ due: TODAY, done: true }),
      make({ due: TODAY, done: true, repeat: 'daily', seriesId: null }),
      make({ due: TODAY, done: true, repeat: 'daily', seriesId: 'gone', deletedAt: 5 }),
    ];
    expect(habitStats(tasks, TODAY)).toEqual([]);
    expect(habitStats([], TODAY)).toEqual([]);
  });

  it('caps the list at five, longest streak first then title', () => {
    const tasks = [
      ...series('zebra', 'daily', ['2026-11-24', '2026-11-25', '2026-11-26'], [], 'Zebra'),
      ...series('a', 'daily', ['2026-11-26'], [], 'Alpha'),
      ...series('b', 'daily', ['2026-11-26'], [], 'Bravo'),
      ...series('c', 'daily', ['2026-11-26'], [], 'Charlie'),
      ...series('d', 'daily', ['2026-11-26'], [], 'Delta'),
      ...series('e', 'daily', ['2026-11-26'], [], 'Echo'),
    ];
    const stats = habitStats(tasks, TODAY);
    expect(stats).toHaveLength(5);
    expect(stats.map((stat) => stat.title)).toEqual([
      'Zebra',
      'Alpha',
      'Bravo',
      'Charlie',
      'Delta',
    ]);
  });
});
