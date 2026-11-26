import { toISODate } from './dates';
import type { Task } from './tasks';

/** task id -> the day it was already announced on (YYYY-MM-DD). */
export type NotifiedMap = Record<string, string>;

export function minutesOf(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * A task wants a notification when it is due today, has a reminder time that
 * has passed, is not done yet and has not been announced today.
 */
export function isReminderDue(task: Task, now: Date, notified: NotifiedMap): boolean {
  if (task.done || task.deletedAt !== null || !task.remindAt) return false;
  const today = toISODate(now);
  if (task.due !== today) return false;
  if (notified[task.id] === today) return false;
  return now.getHours() * 60 + now.getMinutes() >= minutesOf(task.remindAt);
}

export function dueReminders(tasks: Task[], now: Date, notified: NotifiedMap): Task[] {
  return tasks
    .filter((task) => isReminderDue(task, now, notified))
    .sort((a, b) => minutesOf(a.remindAt ?? '00:00') - minutesOf(b.remindAt ?? '00:00'));
}

/** Records the day each task was announced, keeping only today's entries. */
export function markNotified(notified: NotifiedMap, tasks: Task[], now: Date): NotifiedMap {
  const today = toISODate(now);
  const next: NotifiedMap = {};
  for (const [id, day] of Object.entries(notified)) {
    if (day === today) next[id] = day;
  }
  for (const task of tasks) next[task.id] = today;
  return next;
}
