import { describe, expect, it } from 'vitest';
import { addDays, daysFromToday, nextOccurrence, parseISODate, todayISODate, toISODate } from './dates';

describe('toISODate', () => {
  it('pads month and day', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('round-trips through parseISODate in local time', () => {
    const date = parseISODate('2026-03-29');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(29);
    expect(toISODate(date)).toBe('2026-03-29');
  });
});

describe('addDays', () => {
  it('crosses a month boundary', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('is stable across a DST change', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
  });
});

describe('daysFromToday', () => {
  it('counts backwards as negative', () => {
    expect(daysFromToday('2026-11-24', '2026-11-25')).toBe(-1);
    expect(daysFromToday('2026-11-25', '2026-11-25')).toBe(0);
    expect(daysFromToday('2026-11-27', '2026-11-25')).toBe(2);
  });
});

describe('nextOccurrence', () => {
  it('moves a daily task one day past the reference', () => {
    expect(nextOccurrence('2026-11-25', 'daily', '2026-11-25')).toBe('2026-11-26');
  });

  it('skips every missed day instead of landing in the past', () => {
    expect(nextOccurrence('2026-11-01', 'daily', '2026-11-25')).toBe('2026-11-26');
  });

  it('moves a weekly task a week past the reference', () => {
    expect(nextOccurrence('2026-11-20', 'weekly', '2026-11-25')).toBe('2026-11-27');
  });

  it('steps past a due date that is already in the future', () => {
    expect(nextOccurrence('2026-12-01', 'weekly', '2026-11-25')).toBe('2026-12-08');
  });

  it('moves a monthly task a month past the reference', () => {
    expect(nextOccurrence('2026-11-10', 'monthly', '2026-11-25')).toBe('2026-12-10');
  });

  it('clamps a monthly task to the end of a shorter month', () => {
    expect(nextOccurrence('2026-01-31', 'monthly', '2026-01-31')).toBe('2026-02-28');
    expect(nextOccurrence('2026-03-31', 'monthly', '2026-03-31')).toBe('2026-04-30');
  });

  it('keeps a monthly task on the 31st when the target month has one', () => {
    expect(nextOccurrence('2026-01-31', 'monthly', '2026-03-05')).toBe('2026-03-31');
  });

  it('handles a leap February', () => {
    expect(nextOccurrence('2028-01-31', 'monthly', '2028-01-31')).toBe('2028-02-29');
  });

  it('moves a weekdays task to the next weekday', () => {
    expect(nextOccurrence('2026-11-26', 'weekdays', '2026-11-26')).toBe('2026-11-27');
  });

  it('crosses the weekend from a Friday to the following Monday', () => {
    expect(nextOccurrence('2026-11-27', 'weekdays', '2026-11-27')).toBe('2026-11-30');
  });

  it('never returns a Saturday or Sunday for weekdays', () => {
    expect(nextOccurrence('2026-11-28', 'weekdays', '2026-11-28')).toBe('2026-11-30');
    expect(nextOccurrence('2026-11-29', 'weekdays', '2026-11-29')).toBe('2026-11-30');
    for (const today of ['2026-11-23', '2026-11-26', '2026-11-27', '2026-11-28']) {
      const day = parseISODate(nextOccurrence('2026-11-02', 'weekdays', today)).getDay();
      expect(day).toBeGreaterThan(0);
      expect(day).toBeLessThan(6);
    }
  });

  it('skips every missed weekday instead of landing in the past', () => {
    expect(nextOccurrence('2026-11-06', 'weekdays', '2026-11-26')).toBe('2026-11-27');
  });

  it('moves a biweekly task two weeks past the reference', () => {
    expect(nextOccurrence('2026-11-12', 'biweekly', '2026-11-25')).toBe('2026-11-26');
    expect(nextOccurrence('2026-12-01', 'biweekly', '2026-11-25')).toBe('2026-12-15');
  });

  it('moves a monthly-last task to the last day of the following month', () => {
    expect(nextOccurrence('2026-11-26', 'monthly-last', '2026-11-26')).toBe('2026-12-31');
    expect(nextOccurrence('2026-01-15', 'monthly-last', '2026-01-20')).toBe('2026-02-28');
  });

  it('stops a monthly-last task on the last day of the month it lands in', () => {
    expect(nextOccurrence('2026-09-30', 'monthly-last', '2026-11-26')).toBe('2026-11-30');
  });

  it('is always strictly after today', () => {
    expect(nextOccurrence('2026-10-26', 'monthly', '2026-11-26')).toBe('2026-12-26');
    expect(nextOccurrence('2026-11-26', 'daily', '2026-11-26')).toBe('2026-11-27');
    expect(nextOccurrence('2026-11-30', 'monthly-last', '2026-11-30')).toBe('2026-12-31');
  });

  it('returns the due date unchanged for a one-off repeat', () => {
    expect(nextOccurrence('2026-11-01', 'none', '2026-11-25')).toBe('2026-11-01');
  });
});

describe('todayISODate', () => {
  it('matches the local calendar date', () => {
    const now = new Date();
    expect(todayISODate()).toBe(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    );
  });
});
