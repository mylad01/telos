import type { Task } from './tasks';

/** Lowercases and strips accents, so "Café" matches "cafe". */
export function normalise(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function matchesQuery(task: Pick<Task, 'title' | 'notes'>, query: string): boolean {
  const needle = normalise(query);
  if (!needle) return true;
  return normalise(task.title).includes(needle) || normalise(task.notes).includes(needle);
}

export function searchTasks(tasks: Task[], query: string): Task[] {
  if (!normalise(query)) return tasks;
  return tasks.filter((task) => matchesQuery(task, query));
}
