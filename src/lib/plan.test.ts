import { describe, expect, it } from 'vitest';
import { visibleTasks } from './filters';
import { parseTags, listsOf, normalizeTag, type Task } from './tasks';

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

const TODAY = '2026-11-25';
const ids = (list: Task[]) => list.map((task) => task.id);

describe('start dates', () => {
  it('holds a task back from Today until its start date', () => {
    const task = make({ id: 'later-start', due: TODAY, start: '2026-11-27' });
    expect(ids(visibleTasks([task], 'today', TODAY))).toEqual([]);
    expect(ids(visibleTasks([task], 'week', TODAY))).toEqual(['later-start']);
  });

  it('hides a task from This week too when it starts beyond the horizon', () => {
    const task = make({ id: 'far', due: TODAY, start: '2026-12-20' });
    expect(ids(visibleTasks([task], 'today', TODAY))).toEqual([]);
    expect(ids(visibleTasks([task], 'week', TODAY))).toEqual([]);
    expect(ids(visibleTasks([task], 'all', TODAY))).toEqual(['far']);
  });

  it('shows it on the start date itself', () => {
    const task = make({ id: 'ready', due: TODAY, start: TODAY });
    expect(ids(visibleTasks([task], 'today', TODAY))).toEqual(['ready']);
  });
});

describe('sort order', () => {
  it('puts pinned above everything, then priority, then due', () => {
    const list = [
      make({ id: 'none', due: TODAY }),
      make({ id: 'low', due: TODAY, priority: 3 }),
      make({ id: 'high', due: TODAY, priority: 1 }),
      make({ id: 'pinned', due: TODAY, priority: 3, pinned: true }),
    ];
    expect(ids(visibleTasks(list, 'today', TODAY))).toEqual(['pinned', 'high', 'low', 'none']);
  });
});

describe('scope', () => {
  const list = [
    make({ id: 'inbox', list: 'Inbox' }),
    make({ id: 'work', list: 'Work', tags: ['job'] }),
    make({ id: 'home', list: 'Home', tags: ['job', 'diy'] }),
  ];

  it('narrows to one list', () => {
    expect(ids(visibleTasks(list, 'today', TODAY, { list: 'Work' }))).toEqual(['work']);
  });

  it('narrows to one tag', () => {
    expect(ids(visibleTasks(list, 'today', TODAY, { tag: 'job' }))).toEqual(['work', 'home']);
    expect(ids(visibleTasks(list, 'today', TODAY, { tag: 'diy' }))).toEqual(['home']);
  });

  it('combines list and tag', () => {
    expect(ids(visibleTasks(list, 'today', TODAY, { list: 'Work', tag: 'diy' }))).toEqual([]);
  });
});

describe('tags and lists helpers', () => {
  it('normalises tags, drops duplicates and empties', () => {
    expect(normalizeTag('  #Work ')).toBe('work');
    expect(parseTags(['Work', 'work', '', 5, '#job'])).toEqual(['work', 'job']);
  });

  it('caps the tag count', () => {
    expect(parseTags(['a', 'b', 'c', 'd', 'e', 'f'])).toHaveLength(5);
  });

  it('lists Inbox first, then the rest alphabetically, ignoring tombstones', () => {
    const tasks = [
      make({ list: 'Work' }),
      make({ list: 'Home' }),
      make({ list: 'Errands', deletedAt: 1 }),
      make({ list: 'Work' }),
    ];
    expect(listsOf(tasks)).toEqual(['Inbox', 'Home', 'Work']);
  });
});
