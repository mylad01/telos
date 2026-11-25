export type Repeat = 'none' | 'daily' | 'weekly';

export type Task = {
  id: string;
  title: string;
  due: string; // YYYY-MM-DD, calendar date in the user's local time
  done: boolean;
  createdAt: number;
  completedAt: number | null;
  repeat: Repeat;
  /** First task of a recurring chain; null for one-offs. */
  seriesId: string | null;
  /** The occurrence this task was rolled forward from; null for the first. */
  previousId: string | null;
  /** Last local edit; the last-write-wins clock for sync. */
  updatedAt: number;
  /** Set when deleted; kept as a tombstone so other devices delete it too. */
  deletedAt: number | null;
};

export type Filter = 'today' | 'week' | 'all' | 'done';

const REPEATS: Repeat[] = ['none', 'daily', 'weekly'];
export const TOMBSTONE_MS = 30 * 86_400_000;

/**
 * Validates one stored or synced task. Missing Phase 2/3 fields are defaulted,
 * so data written by any earlier version keeps loading.
 */
export function parseTask(value: unknown): Task | null {
  if (typeof value !== 'object' || value === null) return null;
  const task = value as Record<string, unknown>;
  if (
    typeof task.id !== 'string' ||
    typeof task.title !== 'string' ||
    typeof task.due !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(task.due) ||
    typeof task.done !== 'boolean' ||
    typeof task.createdAt !== 'number'
  ) {
    return null;
  }
  return {
    id: task.id,
    title: task.title,
    due: task.due,
    done: task.done,
    createdAt: task.createdAt,
    completedAt: typeof task.completedAt === 'number' ? task.completedAt : null,
    repeat: REPEATS.includes(task.repeat as Repeat) ? (task.repeat as Repeat) : 'none',
    seriesId: typeof task.seriesId === 'string' ? task.seriesId : null,
    previousId: typeof task.previousId === 'string' ? task.previousId : null,
    updatedAt: typeof task.updatedAt === 'number' ? task.updatedAt : task.createdAt,
    deletedAt: typeof task.deletedAt === 'number' ? task.deletedAt : null,
  };
}

/**
 * Last-write-wins merge by task id. Local wins ties, so merging a server echo
 * never bumps a task's clock.
 */
export function mergeTaskLists(local: Task[], remote: Task[]): Task[] {
  const byId = new Map(local.map((task) => [task.id, task]));
  for (const item of remote) {
    const known = byId.get(item.id);
    if (!known || item.updatedAt > known.updatedAt) byId.set(item.id, item);
  }
  return [...byId.values()];
}

/** Tombstones `id`'s rolled-forward descendants, keeping the task itself. */
export function markDescendantsDeleted(tasks: Task[], id: string, now = Date.now()): Task[] {
  const doomed = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const parent = queue.pop();
    for (const task of tasks) {
      if (task.previousId === parent && !doomed.has(task.id)) {
        doomed.add(task.id);
        queue.push(task.id);
      }
    }
  }
  if (doomed.size === 0) return tasks;
  return tasks.map((task) =>
    doomed.has(task.id) ? { ...task, deletedAt: now, updatedAt: now } : task,
  );
}

/** Drops stale tombstones so storage does not grow forever. */
export function pruneTombstones(tasks: Task[], now = Date.now()): Task[] {
  return tasks.filter((task) => task.deletedAt === null || now - task.deletedAt < TOMBSTONE_MS);
}

/**
 * The offline queue: every task edited since it was last uploaded. Lives in
 * localStorage with the tasks, so it survives reloads and reconnects.
 */
export function pendingChanges(tasks: Task[], pushed: Map<string, number>): Task[] {
  return tasks.filter((task) => (pushed.get(task.id) ?? 0) < task.updatedAt);
}
