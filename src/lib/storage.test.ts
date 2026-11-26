import { afterEach, describe, expect, it } from 'vitest';
import { loadTasks, saveTasks } from './storage';

type Store = Map<string, string>;

function fakeWindow(store: Store, throws = false) {
  return {
    localStorage: {
      getItem: (key: string) => {
        if (throws) throw new Error('blocked');
        return store.get(key) ?? null;
      },
      setItem: (key: string, value: string) => {
        if (throws) throw new Error('blocked');
        store.set(key, value);
      },
    },
  };
}

const KEY = 'telos.tasks.v1';
const valid = { id: 'a', title: 'Task', due: '2026-11-25', done: false, createdAt: 1 };

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('loadTasks', () => {
  it('returns an empty list on a first visit', () => {
    (globalThis as { window?: unknown }).window = fakeWindow(new Map());
    expect(loadTasks()).toEqual({ status: 'ok', tasks: [] });
  });

  it('drops one corrupt entry and keeps the rest', () => {
    const store: Store = new Map([[KEY, JSON.stringify([valid, { id: 'broken' }])]]);
    (globalThis as { window?: unknown }).window = fakeWindow(store);
    const result = loadTasks();
    expect(result.status).toBe('ok');
    expect(result.tasks.map((task) => task.id)).toEqual(['a']);
    expect(result.tasks[0].repeat).toBe('none');
  });

  it('treats unreadable JSON or a non-array as an empty list', () => {
    (globalThis as { window?: unknown }).window = fakeWindow(new Map([[KEY, '{not json']]));
    expect(loadTasks()).toEqual({ status: 'ok', tasks: [] });
    (globalThis as { window?: unknown }).window = fakeWindow(new Map([[KEY, '{}']]));
    expect(loadTasks()).toEqual({ status: 'ok', tasks: [] });
  });

  it('reports blocked storage instead of throwing', () => {
    (globalThis as { window?: unknown }).window = fakeWindow(new Map(), true);
    expect(loadTasks()).toEqual({ status: 'blocked', tasks: [] });
    expect(saveTasks([])).toBe(false);
  });
});

describe('saveTasks', () => {
  it('round-trips tasks', () => {
    const store: Store = new Map();
    (globalThis as { window?: unknown }).window = fakeWindow(store);
    const task = { ...valid, completedAt: null, repeat: 'none' as const, seriesId: null, previousId: null, updatedAt: 1, deletedAt: null, notes: '', pinned: false, remindAt: null, list: 'Inbox', tags: [] as string[], priority: 0 as const, start: null, subtasks: [] };
    expect(saveTasks([task])).toBe(true);
    expect(loadTasks().tasks).toEqual([task]);
  });
});
