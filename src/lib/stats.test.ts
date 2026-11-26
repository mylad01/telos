import { describe, expect, it } from 'vitest';
import { donePerDay, streak, weekRecap } from './stats';
import type { Task } from './tasks';

const TODAY = '2026-11-26'; // a Thursday

function doneOn(date: string, id = date): Task {
  const [year, month, day] = date.split('-').map(Number);
  return {
    id,
    title: 'Done',
    due: date,
    done: true,
    createdAt: 1,
    completedAt: new Date(year, month - 1, day, 12, 0).getTime(),
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
  };
}

describe('donePerDay', () => {
  it('returns one bucket per day, oldest first, including empty days', () => {
    const series = donePerDay([doneOn('2026-11-24'), doneOn('2026-11-26', 'b')], TODAY, 7);
    expect(series).toHaveLength(7);
    expect(series[0].date).toBe('2026-11-20');
    expect(series[6]).toEqual({ date: '2026-11-26', count: 1 });
    expect(series.find((day) => day.date === '2026-11-24')?.count).toBe(1);
  });

  it('ignores completions outside the window', () => {
    const series = donePerDay([doneOn('2026-10-01')], TODAY, 7);
    expect(series.reduce((sum, day) => sum + day.count, 0)).toBe(0);
  });
});

describe('streak', () => {
  it('counts consecutive days back from today', () => {
    const tasks = [doneOn('2026-11-26'), doneOn('2026-11-25', 'b'), doneOn('2026-11-24', 'c')];
    expect(streak(tasks, TODAY)).toBe(3);
  });

  it('keeps the run alive while today is still empty', () => {
    expect(streak([doneOn('2026-11-25')], TODAY)).toBe(1);
  });

  it('stops at the first gap', () => {
    const tasks = [doneOn('2026-11-26'), doneOn('2026-11-24', 'b')];
    expect(streak(tasks, TODAY)).toBe(1);
  });

  it('is zero with nothing done', () => {
    expect(streak([], TODAY)).toBe(0);
  });
});

describe('weekRecap', () => {
  it('separates this calendar week from the last', () => {
    const tasks = [
      doneOn('2026-11-26'), // this week (Mon 23rd - Sun 29th)
      doneOn('2026-11-23', 'b'),
      doneOn('2026-11-22', 'c'), // last week
    ];
    expect(weekRecap(tasks, TODAY)).toEqual({ thisWeek: 2, lastWeek: 1 });
  });
});
