import { describe, expect, it } from 'vitest';
import { hasManualOrder, manualOrder, moveBefore } from './order';
import type { Task } from './tasks';

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    due: '2026-01-01',
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

const byId = (tasks: Task[], id: string): Task => {
  const found = tasks.find((entry) => entry.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};

describe('moveBefore', () => {
  it('moves a task down within an ordered list', () => {
    const tasks = [
      task('a', { order: 0, createdAt: 10 }),
      task('b', { order: 1, createdAt: 20 }),
      task('c', { order: 2, createdAt: 30 }),
    ];
    const next = moveBefore(tasks, 'a', 'c', 5000);

    expect(next.map((entry) => entry.id).map((id) => byId(next, id).order)).toEqual([1, 0, 2]);
    expect(byId(next, 'b').order).toBe(0);
    expect(byId(next, 'a').order).toBe(1);
    expect(byId(next, 'c').order).toBe(2);
    expect(byId(next, 'b').updatedAt).toBe(5000);
    expect(byId(next, 'a').updatedAt).toBe(5000);
  });

  it('moves a task up within an ordered list', () => {
    const tasks = [
      task('a', { order: 0 }),
      task('b', { order: 1 }),
      task('c', { order: 2 }),
    ];
    const next = moveBefore(tasks, 'c', 'a', 900);
    expect(byId(next, 'c').order).toBe(0);
    expect(byId(next, 'a').order).toBe(1);
    expect(byId(next, 'b').order).toBe(2);
    expect(next).not.toBe(tasks);
  });

  it('assigns 0,1,2,... when the list was never dragged', () => {
    const tasks = [
      task('a', { createdAt: 10 }),
      task('b', { createdAt: 20 }),
      task('c', { createdAt: 30 }),
    ];
    const next = moveBefore(tasks, 'a', 'c', 7000);

    expect(byId(next, 'b').order).toBe(0);
    expect(byId(next, 'a').order).toBe(1);
    expect(byId(next, 'c').order).toBe(2);
    expect(next.map((entry) => entry.updatedAt)).toEqual([7000, 7000, 7000]);
  });

  it('numbers every live task of the list, including done ones', () => {
    const tasks = [
      task('a', { order: 0 }),
      task('b', { order: 1, done: true }),
      task('c', { order: null, createdAt: 50 }),
      task('e', { order: 5, list: 'Work' }),
    ];
    const next = moveBefore(tasks, 'c', 'a', 1);

    expect(byId(next, 'c').order).toBe(0);
    expect(byId(next, 'a').order).toBe(1);
    expect(byId(next, 'b').order).toBe(2);
    expect(byId(next, 'e').order).toBe(5);
  });

  it('returns the same array reference for different lists', () => {
    const tasks = [
      task('a', { order: 0, list: 'Inbox' }),
      task('b', { order: 0, list: 'Work' }),
    ];
    expect(moveBefore(tasks, 'a', 'b', 1)).toBe(tasks);
  });

  it('returns the same array reference for unknown ids', () => {
    const tasks = [task('a', { order: 0 }), task('b', { order: 1 })];
    expect(moveBefore(tasks, 'missing', 'b', 1)).toBe(tasks);
    expect(moveBefore(tasks, 'a', 'missing', 1)).toBe(tasks);
  });

  it('returns the same array reference when either task is deleted', () => {
    const tasks = [
      task('a', { order: 0 }),
      task('b', { order: 1, deletedAt: 5 }),
      task('c', { order: 2 }),
    ];
    expect(moveBefore(tasks, 'a', 'b', 1)).toBe(tasks);
    expect(moveBefore(tasks, 'b', 'c', 1)).toBe(tasks);
  });

  it('keeps the existing relative order when order values are duplicated', () => {
    const tasks = [
      task('a', { order: 0 }),
      task('b', { order: 0 }),
      task('c', { order: 1 }),
      task('d', { order: null, createdAt: 99 }),
    ];
    const next = moveBefore(tasks, 'd', 'b', 3);

    expect(byId(next, 'a').order).toBe(0);
    expect(byId(next, 'd').order).toBe(1);
    expect(byId(next, 'b').order).toBe(2);
    expect(byId(next, 'c').order).toBe(3);
  });

  it('leaves tasks outside the list and tombstones untouched', () => {
    const outside = task('x', { order: 0, list: 'Work' });
    const tombstone = task('z', { order: 9, deletedAt: 4 });
    const tasks = [task('a', { order: 0 }), outside, task('b', { order: 1 }), tombstone];

    const next = moveBefore(tasks, 'b', 'a', 100);

    expect(byId(next, 'x')).toBe(outside);
    expect(byId(next, 'z')).toBe(tombstone);
  });

  it('keeps object identity for tasks whose order did not change', () => {
    const a = task('a', { order: 0 });
    const b = task('b', { order: 1 });
    const c = task('c', { order: 2 });
    const next = moveBefore([a, b, c], 'a', 'b', 100);

    expect(byId(next, 'a')).toBe(a);
    expect(byId(next, 'b')).toBe(b);
  });
});

describe('hasManualOrder', () => {
  it('is false when no live task has an order', () => {
    expect(hasManualOrder([task('a'), task('b', { order: null })])).toBe(false);
    expect(hasManualOrder([])).toBe(false);
  });

  it('ignores orders on deleted tasks', () => {
    expect(hasManualOrder([task('a', { order: 3, deletedAt: 10 })])).toBe(false);
  });

  it('is true when a live task has an order', () => {
    expect(hasManualOrder([task('a'), task('b', { order: 0 })])).toBe(true);
  });
});

describe('manualOrder', () => {
  it('puts explicit order first, then null order by createdAt', () => {
    const tasks = [
      task('null-early', { createdAt: 1 }),
      task('two', { order: 2, createdAt: 50 }),
      task('null-late', { createdAt: 9 }),
      task('zero', { order: 0, createdAt: 80 }),
    ];
    expect(manualOrder(tasks).map((entry) => entry.id)).toEqual([
      'zero',
      'two',
      'null-early',
      'null-late',
    ]);
  });

  it('is stable on duplicate order values and equal createdAt', () => {
    const tasks = [
      task('b', { order: 1 }),
      task('a', { order: 1 }),
      task('d', { createdAt: 7 }),
      task('c', { createdAt: 7 }),
    ];
    expect(manualOrder(tasks).map((entry) => entry.id)).toEqual(['b', 'a', 'd', 'c']);
  });

  it('does not mutate the input array', () => {
    const tasks = [task('b', { order: 1 }), task('a', { order: 0 })];
    const snapshot = [...tasks];
    const sorted = manualOrder(tasks);
    expect(tasks).toEqual(snapshot);
    expect(tasks[0]).toBe(snapshot[0]);
    expect(sorted).not.toBe(tasks);
  });

  it('keeps task object identity', () => {
    const a = task('a', { order: 0 });
    const b = task('b');
    const sorted = manualOrder([b, a]);
    expect(sorted[0]).toBe(a);
    expect(sorted[1]).toBe(b);
  });
});
