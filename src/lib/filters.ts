import { daysFromToday } from './dates';
import type { Filter, Task } from './tasks';

const collator = new Intl.Collator('en');

function byDue(a: Task, b: Task): number {
  return a.due.localeCompare(b.due) || a.createdAt - b.createdAt;
}

/** Live tasks only; tombstones never reach a filter. */
export function visibleTasks(tasks: Task[], filter: Filter, today: string): Task[] {
  const live = tasks.filter((task) => task.deletedAt === null);
  if (filter === 'today') {
    return live.filter((task) => !task.done && daysFromToday(task.due, today) <= 0).sort(byDue);
  }
  if (filter === 'week') {
    return live.filter((task) => !task.done && daysFromToday(task.due, today) <= 7).sort(byDue);
  }
  if (filter === 'done') {
    return live
      .filter((task) => task.done)
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  }
  return [...live].sort(
    (a, b) => Number(a.done) - Number(b.done) || byDue(a, b) || collator.compare(a.title, b.title),
  );
}
