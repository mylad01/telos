import type { Repeat } from './tasks';

const DAY_MS = 86_400_000;

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISODate(): string {
  return toISODate(new Date());
}

export function parseISODate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Calendar days added in local time, so DST changes never shift the date. */
export function addDays(value: string, days: number): string {
  const date = parseISODate(value);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Whole days from today to `due`; negative means overdue. */
export function daysFromToday(due: string, today = todayISODate()): number {
  const a = Date.UTC(...toUTC(today));
  const b = Date.UTC(...toUTC(due));
  return Math.round((b - a) / DAY_MS);
}

/** Adds calendar months, clamping to the shorter month (31 Jan -> 28 Feb). */
export function addMonths(value: string, months: number): string {
  const date = parseISODate(value);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return toISODate(date);
}

/** The last calendar day of the month `value` falls in. */
export function endOfMonth(value: string): string {
  const date = parseISODate(value);
  return toISODate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

/** The next Monday–Friday date after `value`; Saturday and Sunday are skipped. */
function nextWeekdayAfter(value: string): string {
  let next = addDays(value, 1);
  const day = parseISODate(next).getDay();
  if (day === 6) next = addDays(next, 2);
  else if (day === 0) next = addDays(next, 1);
  return next;
}

/**
 * The next date a recurring task falls on, always strictly after today, so a
 * task finished late never lands back in the overdue pile. Monthly kinds count
 * whole months from `due`, so a task on the 31st stays on the 31st in months
 * that have one instead of drifting earlier.
 *
 * `'none'` is a no-op that returns `due` unchanged: the caller never passes it,
 * but returning the input keeps this function total instead of throwing.
 */
export function nextOccurrence(due: string, repeat: Repeat, today: string): string {
  if (repeat === 'none') return due;

  let months = 0;
  const step = (value: string): string => {
    switch (repeat) {
      case 'daily':
        return addDays(value, 1);
      case 'weekdays':
        return nextWeekdayAfter(value);
      case 'weekly':
        return addDays(value, 7);
      case 'biweekly':
        return addDays(value, 14);
      case 'monthly':
        months += 1;
        return addMonths(due, months);
      case 'monthly-last':
        months += 1;
        return endOfMonth(addMonths(due, months));
    }
  };

  let next = step(due);
  for (let guard = 0; daysFromToday(next, today) <= 0 && guard < 730; guard += 1) {
    next = step(next);
  }
  return next;
}

function toUTC(value: string): [number, number, number] {
  const [year, month, day] = value.split('-').map(Number);
  return [year, month - 1, day];
}
