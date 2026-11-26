import { toISODate } from './dates';
import type { Task } from './tasks';

export type DayCell = { date: string; day: number; inMonth: boolean };

const WEEK = 7;
const CELLS = 42;

/** Six Monday-first weeks covering the given month. */
export function monthGrid(year: number, month: number): DayCell[][] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const start = new Date(year, month, 1 - offset);
  const weeks: DayCell[][] = [];
  for (let row = 0; row < CELLS / WEEK; row += 1) {
    const week: DayCell[] = [];
    for (let column = 0; column < WEEK; column += 1) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + row * WEEK + column);
      week.push({
        date: toISODate(date),
        day: date.getDate(),
        inMonth: date.getMonth() === month,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** How many open and finished tasks sit on each date. */
export function tasksByDay(tasks: Task[]): Map<string, { open: number; done: number }> {
  const map = new Map<string, { open: number; done: number }>();
  for (const task of tasks) {
    if (task.deletedAt !== null) continue;
    const entry = map.get(task.due) ?? { open: 0, done: 0 };
    if (task.done) entry.done += 1;
    else entry.open += 1;
    map.set(task.due, entry);
  }
  return map;
}
