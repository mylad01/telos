import { describe, expect, it } from 'vitest';
import {
  mergeTaskLists,
  markDescendantsDeleted,
  parseTask,
  pendingChanges,
  pruneTombstones,
  TOMBSTONE_MS,
  type Task,
} from './tasks';

function make(overrides: Partial<Task> = {}): Task {
  return {
    id: 'a',
    title: 'Water the plants',
    due: '2026-11-25',
    done: false,
    createdAt: 1_000,
    completedAt: null,
    repeat: 'none',
    seriesId: null,
    previousId: null,
    updatedAt: 1_000,
    deletedAt: null,
    ...overrides,
  };
}

describe('parseTask', () => {
  it('defaults the fields older versions never wrote', () => {
    const task = parseTask({
      id: 'a',
      title: 'Old task',
      due: '2026-11-25',
      done: false,
      createdAt: 5,
    });
    expect(task).toEqual(make({ title: 'Old task', createdAt: 5, updatedAt: 5 }));
  });

  it('rejects a malformed date, a missing title and non-objects', () => {
    expect(parseTask({ id: 'a', title: 'x', due: '25/11/2026', done: false, createdAt: 1 })).toBeNull();
    expect(parseTask({ id: 'a', due: '2026-11-25', done: false, createdAt: 1 })).toBeNull();
    expect(parseTask(null)).toBeNull();
    expect(parseTask('task')).toBeNull();
  });

  it('keeps a known repeat and drops an unknown one', () => {
    const base = { id: 'a', title: 'x', due: '2026-11-25', done: false, createdAt: 1 };
    expect(parseTask({ ...base, repeat: 'daily' })?.repeat).toBe('daily');
    expect(parseTask({ ...base, repeat: 'yearly' })?.repeat).toBe('none');
  });
});

describe('mergeTaskLists', () => {
  it('keeps the newer edit and local on a tie', () => {
    const local = [make({ id: 'a', title: 'local older', updatedAt: 10 }), make({ id: 'b', title: 'tie', updatedAt: 20 })];
    const remote = [make({ id: 'a', title: 'remote newer', updatedAt: 11 }), make({ id: 'b', title: 'remote tie', updatedAt: 20 })];
    const merged = new Map(mergeTaskLists(local, remote).map((task) => [task.id, task]));
    expect(merged.get('a')?.title).toBe('remote newer');
    expect(merged.get('b')?.title).toBe('tie');
  });

  it('adds tasks only the remote knows and keeps deleted tombstones', () => {
    const merged = mergeTaskLists(
      [make()],
      [make({ id: 'c', deletedAt: 50, updatedAt: 50 })],
    );
    expect(merged.map((task) => task.id).sort()).toEqual(['a', 'c']);
  });
});

describe('markDescendantsDeleted', () => {
  it('tombstones the whole chain below a task but not the task itself', () => {
    const tasks = [
      make({ id: 'a' }),
      make({ id: 'b', previousId: 'a' }),
      make({ id: 'c', previousId: 'b' }),
      make({ id: 'd', previousId: 'x' }),
    ];
    const result = new Map(markDescendantsDeleted(tasks, 'a', 999).map((task) => [task.id, task]));
    expect(result.get('a')?.deletedAt).toBeNull();
    expect(result.get('b')?.deletedAt).toBe(999);
    expect(result.get('c')?.deletedAt).toBe(999);
    expect(result.get('d')?.deletedAt).toBeNull();
  });

  it('returns the same array when there is nothing below', () => {
    const tasks = [make()];
    expect(markDescendantsDeleted(tasks, 'a', 999)).toBe(tasks);
  });
});

describe('pruneTombstones', () => {
  it('drops tombstones older than 30 days and keeps live tasks', () => {
    const now = 1_000 * TOMBSTONE_MS;
    const kept = pruneTombstones(
      [
        make({ id: 'live' }),
        make({ id: 'stale', deletedAt: now - TOMBSTONE_MS }),
        make({ id: 'fresh', deletedAt: now - TOMBSTONE_MS + 1 }),
      ],
      now,
    );
    expect(kept.map((task) => task.id).sort()).toEqual(['fresh', 'live']);
  });
});

describe('pendingChanges', () => {
  it('returns tasks edited after their last upload', () => {
    const pushed = new Map([['a', 10]]);
    expect(
      pendingChanges([make({ id: 'a', updatedAt: 10 }), make({ id: 'b', updatedAt: 5 })], pushed).map(
        (task) => task.id,
      ),
    ).toEqual(['b']);
  });
});
