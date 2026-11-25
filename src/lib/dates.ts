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

/**
 * The next date a recurring task falls on, always strictly after today, so a
 * task finished late never lands back in the overdue pile.
 */
export function nextOccurrence(
  due: string,
  repeat: 'daily' | 'weekly',
  today: string,
): string {
  const step = repeat === 'daily' ? 1 : 7;
  let next = addDays(due, step);
  for (let guard = 0; daysFromToday(next, today) <= 0 && guard < 730; guard += 1) {
    next = addDays(next, step);
  }
  return next;
}

function toUTC(value: string): [number, number, number] {
  const [year, month, day] = value.split('-').map(Number);
  return [year, month - 1, day];
}
