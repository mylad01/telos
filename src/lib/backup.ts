import { parseTask, type Task } from './tasks';

type Backup = {
  app: 'telos';
  version: 1;
  exportedAt: string;
  tasks: Task[];
};

/** Live tasks only: tombstones are an internal sync detail. */
export function serializeBackup(tasks: Task[]): string {
  const payload: Backup = {
    app: 'telos',
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks: tasks.filter((task) => task.deletedAt === null),
  };
  return JSON.stringify(payload, null, 2);
}

/** Accepts a Telos backup (or a bare array of tasks) and throws on anything else. */
export function parseBackup(text: string): Task[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('invalid-backup');
  }
  const list = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null && Array.isArray((data as { tasks?: unknown }).tasks)
      ? ((data as { tasks: unknown[] }).tasks)
      : null;
  if (!list) throw new Error('invalid-backup');
  const tasks = list.map(parseTask).filter((task): task is Task => task !== null);
  if (list.length > 0 && tasks.length === 0) throw new Error('invalid-backup');
  return tasks;
}

export function downloadBackup(tasks: Task[]): void {
  const blob = new Blob([serializeBackup(tasks)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `telos-tasks-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
