import type { Task } from './tasks';

export type SortMode = 'manual' | 'plan';

type Entry = { task: Task; index: number };

/** Manual order first, then never-dragged tasks by creation time. Ties keep input order. */
function manualFirst(a: Entry, b: Entry): number {
  const ao = a.task.order;
  const bo = b.task.order;
  if (ao !== null && bo !== null) return ao - bo || a.index - b.index;
  if (ao !== null) return -1;
  if (bo !== null) return 1;
  return a.task.createdAt - b.task.createdAt || a.index - b.index;
}

/**
 * Places `movingId` directly before `targetId` in the same list and renumbers
 * that list 0,1,2,... Only tasks whose order actually changed are copied (with
 * a fresh `updatedAt`); everything else keeps its object identity.
 */
export function moveBefore(
  tasks: Task[],
  movingId: string,
  targetId: string,
  now: number,
): Task[] {
  if (movingId === targetId) return tasks;
  const moving = tasks.find((task) => task.id === movingId);
  const target = tasks.find((task) => task.id === targetId);
  if (!moving || !target) return tasks;
  if (moving.deletedAt !== null || target.deletedAt !== null) return tasks;
  if (moving.list !== target.list) return tasks;

  const ordered = tasks
    .map((task, index): Entry => ({ task, index }))
    .filter((entry) => entry.task.deletedAt === null && entry.task.list === moving.list)
    .sort(manualFirst)
    .map((entry) => entry.task);

  const from = ordered.indexOf(moving);
  ordered.splice(from, 1);
  const to = ordered.indexOf(target);
  ordered.splice(to, 0, moving);

  const nextOrder = new Map<string, number>();
  ordered.forEach((task, index) => nextOrder.set(task.id, index));

  return tasks.map((task) => {
    const order = nextOrder.get(task.id);
    if (order === undefined || order === task.order) return task;
    return { ...task, order, updatedAt: now };
  });
}

/** True when at least one live task carries an explicit manual position. */
export function hasManualOrder(tasks: Task[]): boolean {
  return tasks.some((task) => task.deletedAt === null && task.order !== null);
}

/**
 * Display order: live tasks with an explicit order ascending, then live tasks
 * with null order by createdAt. Tombstones trail the list in input order.
 * Stable on equal keys and never mutates the input.
 */
export function manualOrder(tasks: Task[]): Task[] {
  const decorated = tasks.map((task, index): Entry => ({ task, index }));
  const rank = (entry: Entry): number =>
    entry.task.deletedAt !== null ? 2 : entry.task.order !== null ? 0 : 1;

  decorated.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 0) {
      const ao = a.task.order as number;
      const bo = b.task.order as number;
      return ao - bo || a.index - b.index;
    }
    if (ra === 1) return a.task.createdAt - b.task.createdAt || a.index - b.index;
    return a.index - b.index;
  });

  return decorated.map((entry) => entry.task);
}
