export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly';

/** 1 is the highest priority; 0 means none set. */
export type Priority = 0 | 1 | 2 | 3;

export type Subtask = { id: string; title: string; done: boolean };

export const DEFAULT_LIST = 'Inbox';
export const TAGS_MAX = 5;
export const SUBTASKS_MAX = 30;

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
  /** Optional free-text note under the title; empty string when unused. */
  notes: string;
  /** Pinned tasks sort above the rest of their list. */
  pinned: boolean;
  /** Local reminder time on the due date, HH:MM; null when off. */
  remindAt: string | null;
  /** Which list the task lives in; 'Inbox' when never filed. */
  list: string;
  /** Lowercase labels, at most TAGS_MAX. */
  tags: string[];
  priority: Priority;
  /** Tasks stay out of the Today view until this date; null means wait for nothing. */
  start: string | null;
  subtasks: Subtask[];
  /** Sits in the "This evening" section of Today. */
  evening: boolean;
};

export type Filter = 'today' | 'week' | 'all' | 'done';

const REPEATS: Repeat[] = ['none', 'daily', 'weekly', 'monthly'];
export const NOTES_MAX = 500;
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
    notes: typeof task.notes === 'string' ? task.notes.slice(0, NOTES_MAX) : '',
    pinned: task.pinned === true,
    remindAt:
      typeof task.remindAt === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(task.remindAt)
        ? task.remindAt
        : null,
    list:
      typeof task.list === 'string' && task.list.trim()
        ? task.list.trim().slice(0, 40)
        : DEFAULT_LIST,
    tags: parseTags(task.tags),
    priority: [1, 2, 3].includes(task.priority as number)
      ? (task.priority as Priority)
      : 0,
    start:
      typeof task.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(task.start) ? task.start : null,
    subtasks: parseSubtasks(task.subtasks),
    evening: task.evening === true,
  };
}

export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/^#/, '').slice(0, 24);
}

export function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const tags: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const tag = normalizeTag(item);
    if (tag && !tags.includes(tag)) tags.push(tag);
    if (tags.length === TAGS_MAX) break;
  }
  return tags;
}

export function parseSubtasks(value: unknown): Subtask[] {
  if (!Array.isArray(value)) return [];
  const subtasks: Subtask[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.id !== 'string' || typeof entry.title !== 'string') continue;
    const title = entry.title.trim().slice(0, 140);
    if (!title) continue;
    subtasks.push({ id: entry.id, title, done: entry.done === true });
    if (subtasks.length === SUBTASKS_MAX) break;
  }
  return subtasks;
}

/** Lists in use, Inbox first, then alphabetical. */
export function listsOf(tasks: Task[]): string[] {
  const names = new Set<string>([DEFAULT_LIST]);
  for (const task of tasks) {
    if (task.deletedAt === null) names.add(task.list);
  }
  const rest = [...names].filter((name) => name !== DEFAULT_LIST).sort((a, b) => a.localeCompare(b));
  return [DEFAULT_LIST, ...rest];
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
