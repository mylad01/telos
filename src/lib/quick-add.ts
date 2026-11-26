import { addDays, daysFromToday, endOfMonth, parseISODate, toISODate } from './dates';
import type { Repeat } from './tasks';

export type QuickAdd = { title: string; due: string | null; repeat: Repeat | null };

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const WEEKDAY_WORDS =
  'sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat';

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

const MONTH_WORDS =
  'january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec';

function weekdayIndex(word: string): number {
  const lower = word.toLowerCase();
  if (lower.startsWith('su')) return 0;
  if (lower.startsWith('mon')) return 1;
  if (lower.startsWith('tu')) return 2;
  if (lower.startsWith('w')) return 3;
  if (lower.startsWith('th')) return 4;
  if (lower.startsWith('f')) return 5;
  return 6;
}

function monthIndex(word: string): number {
  const lower = word.toLowerCase().slice(0, 3);
  const index = MONTHS.findIndex((month) => month.startsWith(lower));
  return index === -1 ? Number.NaN : index;
}

/** The coming weekday, always strictly after today. */
function nextWeekday(word: string, today: string): string {
  const current = parseISODate(today).getDay();
  const diff = (weekdayIndex(word) - current + 7) % 7 || 7;
  return addDays(today, diff);
}

/** Today when it is Monday–Friday, otherwise the coming Monday. */
function weekdayOrToday(today: string): string {
  const day = parseISODate(today).getDay();
  if (day === 0) return addDays(today, 1);
  if (day === 6) return addDays(today, 2);
  return today;
}

/** The last day of this month, or of next month when that one is already past. */
function lastDayDue(today: string): string {
  const end = endOfMonth(today);
  return daysFromToday(end, today) > 0 ? end : endOfMonth(addDays(end, 1));
}

function monthDayDate(day: number, month: number, today: string): string | null {
  if (!Number.isInteger(day) || month < 0 || month > 11 || day < 1 || day > 31) return null;
  const now = parseISODate(today);
  const lastDay = new Date(now.getFullYear(), month + 1, 0).getDate();
  if (day > lastDay) return null;
  let candidate = toISODate(new Date(now.getFullYear(), month, day));
  if (daysFromToday(candidate, today) < 0) {
    candidate = toISODate(new Date(now.getFullYear() + 1, month, day));
  }
  return candidate;
}

function isoDate(word: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(word);
  if (!match) return null;
  const candidate = word;
  const parsed = parseISODate(candidate);
  return toISODate(parsed) === candidate ? candidate : null;
}

function take(text: string, pattern: RegExp): { text: string; match: RegExpMatchArray | null } {
  const match = text.match(pattern);
  if (!match) return { text, match: null };
  return { text: text.replace(pattern, ' '), match };
}

function cleanup(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s*[,;]\s*$/, '')
    .replace(/^[\s,;–-]+|[\s,;–-]+$/g, '')
    .trim();
}

/**
 * Reads a date and a repeat rule out of what the user typed, the way the big
 * to-do apps do: "pay rent friday", "gym every monday", "taxes 2026-12-01".
 * Anything it does not recognise stays in the title.
 */
export function parseQuickAdd(input: string, today: string): QuickAdd {
  let rest = input;
  let due: string | null = null;
  let repeat: Repeat | null = null;

  const setRepeat = (value: Repeat) => {
    if (repeat === null) repeat = value;
  };
  const setDue = (value: string | null) => {
    if (due === null && value) due = value;
  };

  let step = take(rest, new RegExp(`\\bevery\\s+(${WEEKDAY_WORDS})\\b`, 'i'));
  if (step.match) {
    rest = step.text;
    setRepeat('weekly');
    setDue(nextWeekday(step.match[1], today));
  }

  step = take(rest, /\bevery\s+weekdays?\b/i);
  if (step.match) {
    rest = step.text;
    setRepeat('weekdays');
    setDue(weekdayOrToday(today));
  }

  step = take(rest, /\bevery\s+(?:other|two|2)\s+weeks?\b/i);
  if (step.match) {
    rest = step.text;
    setRepeat('biweekly');
    setDue(today);
  }

  step = take(rest, /\bevery\s+(day|week|month)\b/i);
  if (step.match) {
    rest = step.text;
    const word = step.match[1].toLowerCase();
    setRepeat(word === 'day' ? 'daily' : word === 'week' ? 'weekly' : 'monthly');
    setDue(today);
  }

  step = take(rest, /\blast\s+day\s+of\s+(?:the\s+)?month\b/i);
  if (step.match) {
    rest = step.text;
    setRepeat('monthly-last');
    setDue(lastDayDue(today));
  }

  step = take(rest, /\b(daily|weekly|biweekly|fortnightly|weekdays|monthly)\s*$/i);
  if (step.match) {
    rest = step.text;
    const word = step.match[1].toLowerCase();
    setRepeat(
      word === 'daily'
        ? 'daily'
        : word === 'weekly'
          ? 'weekly'
          : word === 'monthly'
            ? 'monthly'
            : word === 'weekdays'
              ? 'weekdays'
              : 'biweekly',
    );
  }

  step = take(rest, /\bnext\s+week\b/i);
  if (step.match) {
    rest = step.text;
    setDue(addDays(today, 7));
  }

  step = take(rest, /\bin\s+(\d{1,2})\s+(day|days|week|weeks)\b/i);
  if (step.match) {
    rest = step.text;
    const count = Number(step.match[1]);
    setDue(addDays(today, step.match[2].toLowerCase().startsWith('w') ? count * 7 : count));
  }

  step = take(rest, /\bin\s+(?:a|one)\s+(day|week)\b/i);
  if (step.match) {
    rest = step.text;
    setDue(addDays(today, step.match[1].toLowerCase() === 'week' ? 7 : 1));
  }

  step = take(rest, /\b(tonight|tomorrow|today)\b/i);
  if (step.match) {
    rest = step.text;
    const word = step.match[1].toLowerCase();
    setDue(word === 'tomorrow' ? addDays(today, 1) : today);
  }

  step = take(rest, /\b(\d{4}-\d{2}-\d{2})\b/);
  if (step.match) {
    rest = step.text;
    setDue(isoDate(step.match[1]));
  }

  step = take(rest, new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_WORDS})\\b`, 'i'));
  if (step.match) {
    rest = step.text;
    setDue(monthDayDate(Number(step.match[1]), monthIndex(step.match[2]), today));
  }

  step = take(rest, new RegExp(`\\b(${MONTH_WORDS})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'));
  if (step.match) {
    rest = step.text;
    setDue(monthDayDate(Number(step.match[2]), monthIndex(step.match[1]), today));
  }

  step = take(rest, new RegExp(`\\b(${WEEKDAY_WORDS})\\b`, 'i'));
  if (step.match) {
    rest = step.text;
    setDue(nextWeekday(step.match[1], today));
  }

  const title = cleanup(rest);
  if (!title) return { title: cleanup(input), due: null, repeat: null };
  return { title, due, repeat };
}
