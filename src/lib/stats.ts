import { addDays, daysFromToday, parseISODate, toISODate } from './dates';
import type { Task } from './tasks';

export type DayCount = { date: string; count: number };

function startOfWeek(date: string): string {
  const parsed = parseISODate(date);
  const offset = (parsed.getDay() + 6) % 7; // Monday = 0
  return addDays(date, -offset);
}

/** Completions per day for the last `days` days, oldest first. */
export function donePerDay(tasks: Task[], endDate: string, days: number): DayCount[] {
  const counts = new Map<string, number>();
  for (let index = days - 1; index >= 0; index -= 1) {
    counts.set(addDays(endDate, -index), 0);
  }
  for (const task of tasks) {
    if (task.completedAt === null) continue;
    const date = toISODate(new Date(task.completedAt));
    if (counts.has(date)) counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  return [...counts.entries()].map(([date, count]) => ({ date, count }));
}

/**
 * Consecutive days with at least one completion, counting back from today.
 * A day still in progress does not break the run, so a quiet morning keeps
 * yesterday's streak alive.
 */
export function streak(tasks: Task[], today: string): number {
  const completed = new Set<string>();
  for (const task of tasks) {
    if (task.completedAt !== null) completed.add(toISODate(new Date(task.completedAt)));
  }
  let day = completed.has(today) ? today : addDays(today, -1);
  let run = 0;
  while (completed.has(day) && run < 3650) {
    run += 1;
    day = addDays(day, -1);
  }
  return run;
}

export function weekRecap(tasks: Task[], today: string): { thisWeek: number; lastWeek: number } {
  const thisStart = startOfWeek(today);
  const lastStart = addDays(thisStart, -7);
  let thisWeek = 0;
  let lastWeek = 0;
  for (const task of tasks) {
    if (task.completedAt === null) continue;
    const date = toISODate(new Date(task.completedAt));
    if (date >= thisStart && date <= today) thisWeek += 1;
    else if (date >= lastStart && date < thisStart) lastWeek += 1;
  }
  return { thisWeek, lastWeek };
}
