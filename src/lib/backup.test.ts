import { describe, expect, it } from 'vitest';
import { parseBackup, serializeBackup } from './backup';
import type { Task } from './tasks';

function make(overrides: Partial<Task> = {}): Task {
  return {
    id: 'a',
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

describe('backup round trip', () => {
  it('restores what it exported', () => {
    const tasks = [make(), make({ id: 'b', due: '2026-12-01', done: true, completedAt: 4 })];
    expect(parseBackup(serializeBackup(tasks))).toEqual(tasks);
  });

  it('leaves tombstones out of the file', () => {
    const parsed = parseBackup(serializeBackup([make(), make({ id: 'dead', deletedAt: 9 })]));
    expect(parsed.map((task) => task.id)).toEqual(['a']);
  });

  it('accepts a bare array of tasks', () => {
    expect(parseBackup(JSON.stringify([make({ id: 'x' })]))[0].id).toBe('x');
  });

  it('throws on junk, a missing tasks list and entries that are all invalid', () => {
    expect(() => parseBackup('nope')).toThrow('invalid-backup');
    expect(() => parseBackup('{"app":"other"}')).toThrow('invalid-backup');
    expect(() => parseBackup('{"tasks":[{"id":1}]}')).toThrow('invalid-backup');
  });
});
