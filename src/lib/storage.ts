import { parseTask, pruneTombstones, type Task } from './tasks';

const STORAGE_KEY = 'telos.tasks.v1';

type LoadResult = { status: 'ok'; tasks: Task[] } | { status: 'blocked'; tasks: Task[] };

export function loadTasks(): LoadResult {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { status: 'ok', tasks: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { status: 'ok', tasks: [] };
    const tasks = parsed
      .map(parseTask)
      .filter((task): task is Task => task !== null);
    return { status: 'ok', tasks: pruneTombstones(tasks) };
  } catch {
    return { status: 'blocked', tasks: [] };
  }
}

export function saveTasks(tasks: Task[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch {
    return false;
  }
}
