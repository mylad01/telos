import { addDays, daysFromToday } from './dates';
import type { Filter, Priority, Task } from './tasks';

const collator = new Intl.Collator('en');

export type Scope = { list?: string | null; tag?: string | null };

function priorityRank(priority: Priority): number {
  return priority === 0 ? 9 : priority;
}

/** Pinned first, then priority, then the nearest due date. */
function byPlan(a: Task, b: Task): number {
  return (
    Number(b.pinned) - Number(a.pinned) ||
    priorityRank(a.priority) - priorityRank(b.priority) ||
    a.due.localeCompare(b.due) ||
    a.createdAt - b.createdAt
  );
}

function byCompletion(a: Task, b: Task): number {
  return (b.completedAt ?? 0) - (a.completedAt ?? 0);
}

/** A start date in the future keeps a task out of Today until it arrives. */
function waitingToStart(task: Task, today: string): boolean {
  return task.start !== null && task.start > today;
}

export function visibleTasks(
  tasks: Task[],
  filter: Filter,
  today: string,
  scope: Scope = {},
): Task[] {
  const live = tasks
    .filter((task) => task.deletedAt === null)
    .filter((task) => (scope.list ? task.list === scope.list : true))
    .filter((task) => (scope.tag ? task.tags.includes(scope.tag) : true));

  if (filter === 'today') {
    return live
      .filter((task) => !task.done && daysFromToday(task.due, today) <= 0 && !waitingToStart(task, today))
      .sort(byPlan);
  }
  if (filter === 'week') {
    const horizon = addDays(today, 7);
    return live
      .filter(
        (task) =>
          !task.done &&
          daysFromToday(task.due, today) <= 7 &&
          (task.start === null || task.start <= horizon),
      )
      .sort(byPlan);
  }
  if (filter === 'done') {
    return live.filter((task) => task.done).sort(byCompletion);
  }
  return [...live].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      byPlan(a, b) ||
      collator.compare(a.title, b.title),
  );
}
