import { describe, expect, it } from 'vitest';
import { applyBulk, parseBulk } from './bulk';
import type { Task } from './tasks';

const TODAY = '2026-11-26';
const NEXT_WEEK = '2026-12-03';
const TOMORROW = '2026-11-27';

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

describe('parseBulk', () => {
  it('parses move commands and resolves the date', () => {
    expect(parseBulk('move work to next week', TODAY)).toEqual({
      kind: 'move',
      list: 'work',
      to: NEXT_WEEK,
      text: 'move work to next week',
    });
    expect(parseBulk('move home to tomorrow', TODAY)).toEqual({
      kind: 'move',
      list: 'home',
      to: TOMORROW,
      text: 'move home to tomorrow',
    });
  });

  it('parses complete commands', () => {
    expect(parseBulk('complete all today', TODAY)).toEqual({
      kind: 'complete',
      to: TODAY,
      text: 'complete all today',
    });
    expect(parseBulk('complete work', TODAY)).toEqual({
      kind: 'complete',
      list: 'work',
      text: 'complete work',
    });
  });

  it('parses tag and untag commands', () => {
    expect(parseBulk('tag #Gym', TODAY)).toEqual({ kind: 'tag', tag: 'gym', text: 'tag #Gym' });
    expect(parseBulk('untag gym', TODAY)).toEqual({
      kind: 'untag',
      tag: 'gym',
      text: 'untag gym',
    });
  });

  it('parses clear done', () => {
    expect(parseBulk('clear done', TODAY)).toEqual({
      kind: 'clearDone',
      text: 'clear done',
    });
  });

  it('returns null for anything it does not recognise', () => {
    expect(parseBulk('make everything nicer', TODAY)).toBeNull();
    expect(parseBulk('', TODAY)).toBeNull();
    expect(parseBulk('   ', TODAY)).toBeNull();
    expect(parseBulk('tag', TODAY)).toBeNull();
    expect(parseBulk('move work somewhere', TODAY)).toBeNull();
  });

  it('ignores case and extra whitespace', () => {
    expect(parseBulk('  MOVE   Work   TO   Next   Week  ', TODAY)).toEqual({
      kind: 'move',
      list: 'Work',
      to: NEXT_WEEK,
      text: 'MOVE Work TO Next Week',
    });
  });
});

describe('applyBulk', () => {
  it('moves a list to next week and leaves everything else alone', () => {
    const work = make({ title: 'Report', list: 'Work', evening: true });
    const home = make({ title: 'Bins', list: 'Home' });
    const result = applyBulk([work, home], parseBulk('move work to next week', TODAY)!, TODAY, 1000);
    expect(result.changed).toBe(1);
    expect(result.tasks[0]).toEqual({ ...work, due: NEXT_WEEK, updatedAt: 1000 });
    expect(result.tasks[0].evening).toBe(true);
    expect(result.tasks[1]).toBe(home);
    expect(result.summary).toContain('1 task');

    const input = [home];
    const none = applyBulk(input, parseBulk('move work to next week', TODAY)!, TODAY, 1000);
    expect(none.changed).toBe(0);
    expect(none.tasks).toBe(input);
    expect(none.summary).toBe('Nothing to move');
  });

  it('completes open tasks in a list or due today, never twice', () => {
    const open = make({ list: 'Work' });
    const done = make({ list: 'Work', done: true, completedAt: 5 });
    const home = make({ list: 'Home' });
    const listResult = applyBulk(
      [open, done, home],
      parseBulk('complete work', TODAY)!,
      TODAY,
      2000,
    );
    expect(listResult.changed).toBe(1);
    expect(listResult.tasks[0]).toEqual({ ...open, done: true, completedAt: 2000, updatedAt: 2000 });
    expect(listResult.tasks[1]).toBe(done);
    expect(listResult.tasks[2]).toBe(home);

    const overdue = make({ due: '2026-11-25', list: 'Home' });
    const today = make({ due: TODAY, list: 'Home' });
    const todayResult = applyBulk(
      [overdue, today],
      parseBulk('complete all today', TODAY)!,
      TODAY,
      3000,
    );
    expect(todayResult.changed).toBe(1);
    expect(todayResult.tasks[0]).toBe(overdue);
    expect(todayResult.tasks[1].done).toBe(true);
  });

  it('tags and untags live tasks', () => {
    const plain = make({ title: 'Plain', tags: ['work'] });
    const tagged = make({ title: 'Tagged', tags: ['gym'] });
    const gone = make({ title: 'Gone', tags: [], deletedAt: 9 });
    const taggedResult = applyBulk(
      [plain, tagged, gone],
      parseBulk('tag gym', TODAY)!,
      TODAY,
      4000,
    );
    expect(taggedResult.changed).toBe(1);
    expect(taggedResult.tasks[0]).toEqual({ ...plain, tags: ['work', 'gym'], updatedAt: 4000 });
    expect(taggedResult.tasks[1]).toBe(tagged);
    expect(taggedResult.tasks[2]).toBe(gone);

    const untagged = applyBulk(
      taggedResult.tasks,
      parseBulk('untag gym', TODAY)!,
      TODAY,
      5000,
    );
    expect(untagged.changed).toBe(2);
    expect(untagged.tasks[0].tags).toEqual(['work']);
    expect(untagged.tasks[1].tags).toEqual([]);
    expect(untagged.tasks[2]).toBe(gone);
  });

  it('tombstones done tasks instead of dropping them', () => {
    const open = make({ title: 'Open' });
    const done = make({ title: 'Done', done: true, completedAt: 1 });
    const result = applyBulk([open, done], parseBulk('clear done', TODAY)!, TODAY, 6000);
    expect(result.changed).toBe(1);
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0]).toBe(open);
    expect(result.tasks[1]).toEqual({ ...done, deletedAt: 6000, updatedAt: 6000 });
  });
});
