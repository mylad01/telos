import { DEFAULT_LIST, type Task } from './tasks';

export const STARTER_HABITS = ['Drink 2L water', 'Walk 8,000 steps', 'Read 20 pages'] as const;

export function buildStarterTasks(
  today: string,
  now: number,
  newId: () => string,
  list = DEFAULT_LIST,
): Task[] {
  return STARTER_HABITS.map((title) => {
    const id = newId();
    return {
      id,
      title,
      due: today,
      done: false,
      createdAt: now,
      completedAt: null,
      repeat: 'daily',
      seriesId: id,
      previousId: null,
      updatedAt: now,
      deletedAt: null,
      notes: '',
      pinned: false,
      remindAt: null,
      list,
      tags: [],
      priority: 0,
      start: null,
      subtasks: [],
      evening: false,
      order: null,
    } satisfies Task;
  });
}
