import { addDays, addMonths, endOfMonth, parseISODate, toISODate } from './dates';
import type { Repeat, Task } from './tasks';

export type HabitStat = {
  seriesId: string;
  title: string;
  streak: number;
  done: number;
  lastDone: string | null;
};

const MAX_HABITS = 5;

function stepBack(date: string, repeat: Repeat, anchorDay: number): string {
  switch (repeat) {
    case 'daily':
      return addDays(date, -1);
    case 'weekdays': {
      let previous = addDays(date, -1);
      const day = parseISODate(previous).getDay();
      if (day === 0) previous = addDays(previous, -2);
      else if (day === 6) previous = addDays(previous, -1);
      return previous;
    }
    case 'weekly':
      return addDays(date, -7);
    case 'biweekly':
      return addDays(date, -14);
    case 'monthly': {
      const parsed = parseISODate(date);
      const target = new Date(parsed.getFullYear(), parsed.getMonth() - 1, 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      return toISODate(
        new Date(target.getFullYear(), target.getMonth(), Math.min(anchorDay, lastDay)),
      );
    }
    case 'monthly-last':
      return endOfMonth(addMonths(date, -1));
    case 'none':
      return date;
  }
}

export function habitStats(tasks: Task[], today: string): HabitStat[] {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    if (task.repeat === 'none' || task.seriesId === null || task.deletedAt !== null) continue;
    const group = groups.get(task.seriesId);
    if (group) group.push(task);
    else groups.set(task.seriesId, [task]);
  }

  const stats: HabitStat[] = [];
  for (const [seriesId, group] of groups) {
    let earliest: string | null = null;
    let latestDue: string | null = null;
    let lastDone: string | null = null;
    const completed = new Set<string>();
    for (const task of group) {
      if (earliest === null || task.due < earliest) earliest = task.due;
      if (latestDue === null || task.due > latestDue) latestDue = task.due;
      if (!task.done || task.due > today) continue;
      completed.add(task.due);
      if (lastDone === null || task.due > lastDone) lastDone = task.due;
    }

    const repeat = group[0].repeat;
    const anchorDay = earliest === null ? 1 : parseISODate(earliest).getDate();
    let streak = 0;
    let cursor = lastDone;
    while (cursor !== null && completed.has(cursor) && streak < 3650) {
      streak += 1;
      cursor = stepBack(cursor, repeat, anchorDay);
    }

    const title = group.reduce(
      (best, task) => (task.due > best.due ? task : best),
      group[0],
    ).title;

    stats.push({ seriesId, title, streak, done: completed.size, lastDone });
  }

  return stats
    .sort((a, b) => b.streak - a.streak || a.title.localeCompare(b.title))
    .slice(0, MAX_HABITS);
}
