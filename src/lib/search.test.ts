import { describe, expect, it } from 'vitest';
import { matchesQuery, normalise, searchTasks } from './search';
import type { Task } from './tasks';

function make(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Buy milk',
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
    remindAt: null,
    list: 'Inbox',
    tags: [],
    priority: 0,
    start: null,
    subtasks: [],
    ...overrides,
  };
}

describe('searchTasks', () => {
  it('returns everything for an empty query', () => {
    const tasks = [make(), make({ id: 't2', title: 'Call bank' })];
    expect(searchTasks(tasks, '   ')).toHaveLength(2);
  });

  it('matches by title without caring about case', () => {
    expect(searchTasks([make()], 'MILK')).toHaveLength(1);
  });

  it('matches inside the note', () => {
    const task = make({ title: 'Shopping', notes: 'remember the oat milk' });
    expect(matchesQuery(task, 'oat')).toBe(true);
  });

  it('ignores accents in both directions', () => {
    expect(matchesQuery(make({ title: 'Café run' }), 'cafe')).toBe(true);
    expect(normalise('Crème Brûlée')).toBe('creme brulee');
  });

  it('keeps the input order and drops non-matches', () => {
    const tasks = [make({ id: 'a', title: 'alpha' }), make({ id: 'b', title: 'beta' })];
    expect(searchTasks(tasks, 'a').map((task) => task.id)).toEqual(['a', 'b']);
    expect(searchTasks(tasks, 'zzz')).toEqual([]);
  });
});
