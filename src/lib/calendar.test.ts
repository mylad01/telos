import { describe, expect, it } from 'vitest';
import { monthGrid, shiftMonth, tasksByDay } from './calendar';
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
    evening: false,
    order: null,
    ...overrides,
  };
}

describe('monthGrid', () => {
  it('starts each week on Monday', () => {
    const grid = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(grid[0][0].date).toBe('2026-10-26');
    expect(grid[0][0].inMonth).toBe(false);
  });

  it('covers the whole month in six weeks', () => {
    const grid = monthGrid(2026, 10);
    expect(grid).toHaveLength(6);
    const days = grid.flat();
    expect(days).toHaveLength(42);
    expect(days.find((day) => day.date === '2026-11-30')?.inMonth).toBe(true);
    expect(days.some((day) => day.date === '2026-12-01')).toBe(true);
  });

  it('marks days outside the month', () => {
    const days = monthGrid(2026, 1).flat(); // February 2026
    expect(days.filter((day) => day.inMonth)).toHaveLength(28);
  });
});

describe('shiftMonth', () => {
  it('rolls over the year', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe('tasksByDay', () => {
  it('counts open and done per date and skips tombstones', () => {
    const map = tasksByDay([
      make({ due: '2026-11-26' }),
      make({ due: '2026-11-26', done: true }),
      make({ due: '2026-11-26', deletedAt: 1 }),
      make({ due: '2026-11-27' }),
    ]);
    expect(map.get('2026-11-26')).toEqual({ open: 1, done: 1 });
    expect(map.get('2026-11-27')).toEqual({ open: 1, done: 0 });
  });
});
