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

/**
 * The next date a recurring task falls on, always strictly after today, so a
 * task finished late never lands back in the overdue pile.
 */
export function nextOccurrence(
  due: string,
  repeat: 'daily' | 'weekly' | 'monthly',
  today: string,
): string {
  const step = (value: string) =>
    repeat === 'monthly' ? addMonths(value, 1) : addDays(value, repeat === 'daily' ? 1 : 7);
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
