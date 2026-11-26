import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { weeklyReview } from './review';
import type { Task } from './tasks';

const TODAY = '2026-11-26';
const at = (date: string): number => new Date(`${date}T12:00:00`).getTime();

function make(overrides: Partial<Task> = {}): Task {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'Task',
    due: TODAY,
    done: false,
    createdAt: at(TODAY),
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

describe('weeklyReview', () => {
  it('counts completions, slipped and carried-over tasks', () => {
    const tasks = [
      make({ done: true, completedAt: at(TODAY) }),
      make({ done: true, completedAt: at(addDays(TODAY, -6)) }),
      make({ done: true, completedAt: at(addDays(TODAY, -7)) }),
      make({ due: addDays(TODAY, -1), createdAt: at(addDays(TODAY, -1)) }),
      make({ due: TODAY, createdAt: at(TODAY) }),
      make({ due: TODAY, createdAt: at(addDays(TODAY, -8)) }),
      make({ due: TODAY, createdAt: at(addDays(TODAY, -7)) }),
      make({ due: addDays(TODAY, 3), createdAt: at(addDays(TODAY, -10)) }),
    ];
    const review = weeklyReview(tasks, TODAY);
    expect(review.done).toBe(2);
    expect(review.slipped).toBe(1);
    expect(review.carriedOver).toBe(2);
  });

  it('returns exactly seven days, oldest first, ending today', () => {
    const review = weeklyReview([make({ done: true, completedAt: at(TODAY) })], TODAY);
    expect(review.days).toHaveLength(7);
    expect(review.days[0]).toEqual({ date: addDays(TODAY, -6), done: 0 });
    expect(review.days[6]).toEqual({ date: TODAY, done: 1 });
    expect(review.days.map((day) => day.date)).toEqual([
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
    ]);
  });

  it('excludes completions just outside the window from done and days', () => {
    const review = weeklyReview(
      [make({ done: true, completedAt: at(addDays(TODAY, -7)) })],
      TODAY,
    );
    expect(review.done).toBe(0);
    expect(review.days.every((day) => day.done === 0)).toBe(true);
  });

  it('counts a streak that ended yesterday', () => {
    const tasks = [
      make({ done: true, completedAt: at(addDays(TODAY, -1)) }),
      make({ done: true, completedAt: at(addDays(TODAY, -2)) }),
      make({ done: true, completedAt: at(addDays(TODAY, -4)) }),
    ];
    expect(weeklyReview(tasks, TODAY).streak).toBe(2);

    tasks.push(make({ done: true, completedAt: at(TODAY) }));
    expect(weeklyReview(tasks, TODAY).streak).toBe(3);
  });

  it('ignores soft-deleted tasks', () => {
    const review = weeklyReview(
      [
        make({ done: true, completedAt: at(TODAY), deletedAt: 5 }),
        make({ due: addDays(TODAY, -2), deletedAt: 5 }),
        make({ due: TODAY, createdAt: at(addDays(TODAY, -30)), deletedAt: 5 }),
      ],
      TODAY,
    );
    expect(review.done).toBe(0);
    expect(review.slipped).toBe(0);
    expect(review.carriedOver).toBe(0);
    expect(review.streak).toBe(0);
  });
});
