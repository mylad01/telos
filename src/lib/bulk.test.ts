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
    order: null,
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

const at = (date: string): number => new Date(`${date}T12:00:00`).getTime();

describe('parseBulk shift, deleteBefore and completeOverdue', () => {
  it('parses shift commands with a list, every list, or no list', () => {
    expect(parseBulk('push work by 2 days', TODAY)).toEqual({
      kind: 'shift',
      list: 'work',
      days: 2,
      text: 'push work by 2 days',
    });
    expect(parseBulk('move everything by a week', TODAY)).toEqual({
      kind: 'shift',
      days: 7,
      text: 'move everything by a week',
    });
    expect(parseBulk('shift gym 3 days', TODAY)).toEqual({
      kind: 'shift',
      list: 'gym',
      days: 3,
      text: 'shift gym 3 days',
    });
    expect(parseBulk('move all by a day', TODAY)).toEqual({
      kind: 'shift',
      days: 1,
      text: 'move all by a day',
    });
  });

  it('parses delete completed before a date', () => {
    expect(parseBulk('delete completed before 2026-10-01', TODAY)).toEqual({
      kind: 'deleteBefore',
      before: '2026-10-01',
      text: 'delete completed before 2026-10-01',
    });
    expect(parseBulk('delete completed before 1 nov', TODAY)).toEqual({
      kind: 'deleteBefore',
      before: '2026-11-01',
      text: 'delete completed before 1 nov',
    });
  });

  it('parses complete overdue without treating it as a list', () => {
    expect(parseBulk('complete all overdue', TODAY)).toEqual({
      kind: 'completeOverdue',
      text: 'complete all overdue',
    });
    expect(parseBulk('complete overdue', TODAY)).toEqual({
      kind: 'completeOverdue',
      text: 'complete overdue',
    });
  });

  it('returns null for phrases it does not recognise', () => {
    expect(parseBulk('push work by many days', TODAY)).toBeNull();
    expect(parseBulk('shift work sideways', TODAY)).toBeNull();
    expect(parseBulk('delete completed someday', TODAY)).toBeNull();
    expect(parseBulk('complete all today', TODAY)).toEqual({
      kind: 'complete',
      to: TODAY,
      text: 'complete all today',
    });
  });
});

describe('applyBulk shift', () => {
  it('shifts one list, moving due and start together', () => {
    const work = make({ list: 'Work', due: TODAY, start: '2026-11-20' });
    const home = make({ list: 'Home', due: TODAY, start: '2026-11-20' });
    const result = applyBulk(
      [work, home],
      parseBulk('push work by 2 days', TODAY)!,
      TODAY,
      7000,
    );
    expect(result.changed).toBe(1);
    expect(result.tasks[0]).toEqual({
      ...work,
      due: '2026-11-28',
      start: '2026-11-22',
      updatedAt: 7000,
    });
    expect(result.tasks[1]).toBe(home);
    expect(result.summary).toBe('Shifted 1 task by 2 days');
  });

  it('shifts every list and keeps a null start null', () => {
    const work = make({ list: 'Work', due: TODAY, start: null });
    const home = make({ list: 'Home', due: '2026-11-30', start: '2026-11-29' });
    const result = applyBulk(
      [work, home],
      parseBulk('move everything by a week', TODAY)!,
      TODAY,
      7100,
    );
    expect(result.changed).toBe(2);
    expect(result.tasks[0]).toEqual({ ...work, due: NEXT_WEEK, start: null, updatedAt: 7100 });
    expect(result.tasks[1]).toEqual({
      ...home,
      due: '2026-12-07',
      start: '2026-12-06',
      updatedAt: 7100,
    });
  });
});

describe('applyBulk deleteBefore', () => {
  it('soft-deletes only done tasks completed before the cutoff', () => {
    const old = make({ done: true, completedAt: at('2026-10-15') });
    const recent = make({ done: true, completedAt: at('2026-11-20') });
    const open = make({ done: false, completedAt: null });
    const gone = make({ done: true, completedAt: at('2026-09-01'), deletedAt: 3 });
    const result = applyBulk(
      [old, recent, open, gone],
      parseBulk('delete completed before 1 nov', TODAY)!,
      TODAY,
      8000,
    );
    expect(result.changed).toBe(1);
    expect(result.tasks[0]).toEqual({ ...old, deletedAt: 8000, updatedAt: 8000 });
    expect(result.tasks[1]).toBe(recent);
    expect(result.tasks[2]).toBe(open);
    expect(result.tasks[3]).toBe(gone);
  });

  it('soft-deletes nothing when the cutoff is ISO and nothing precedes it', () => {
    const old = make({ done: true, completedAt: at('2026-10-15') });
    const result = applyBulk(
      [old],
      parseBulk('delete completed before 2026-10-01', TODAY)!,
      TODAY,
      8100,
    );
    expect(result.changed).toBe(0);
    expect(result.tasks).toEqual([old]);
    expect(result.summary).toBe('Nothing to delete');
  });
});

describe('applyBulk completeOverdue', () => {
  it('completes open overdue tasks only', () => {
    const late = make({ due: '2026-11-25' });
    const today = make({ due: TODAY });
    const future = make({ due: '2026-11-30' });
    const doneLate = make({ due: '2026-11-20', done: true, completedAt: 1 });
    const deletedLate = make({ due: '2026-11-20', deletedAt: 2 });
    const result = applyBulk(
      [late, today, future, doneLate, deletedLate],
      parseBulk('complete all overdue', TODAY)!,
      TODAY,
      9000,
    );
    expect(result.changed).toBe(1);
    expect(result.tasks[0]).toEqual({ ...late, done: true, completedAt: 9000, updatedAt: 9000 });
    expect(result.tasks[1]).toBe(today);
    expect(result.tasks[2]).toBe(future);
    expect(result.tasks[3]).toBe(doneLate);
    expect(result.tasks[4]).toBe(deletedLate);
    expect(result.summary).toBe('Completed 1 overdue task');
  });
});
