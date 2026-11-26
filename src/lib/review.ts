import { addDays, toISODate } from './dates';
import { donePerDay, streak } from './stats';
import type { Task } from './tasks';

export type WeeklyReviewDay = { date: string; done: number };

export type WeeklyReview = {
  done: number;
  slipped: number;
  carriedOver: number;
  days: WeeklyReviewDay[];
  streak: number;
};

export function weeklyReview(tasks: Task[], today: string): WeeklyReview {
  const live = tasks.filter((task) => task.deletedAt === null);
  const days = donePerDay(live, today, 7).map(({ date, count }) => ({ date, done: count }));
  const done = days.reduce((sum, entry) => sum + entry.done, 0);

  const windowStart = addDays(today, -7);
  let slipped = 0;
  let carriedOver = 0;
  for (const task of live) {
    if (task.done) continue;
    if (task.due < today) {
      slipped += 1;
    } else if (toISODate(new Date(task.createdAt)) < windowStart) {
      carriedOver += 1;
    }
  }

  return { done, slipped, carriedOver, days, streak: streak(live, today) };
}
