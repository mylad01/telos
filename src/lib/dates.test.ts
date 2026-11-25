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
});

describe('todayISODate', () => {
  it('matches the local calendar date', () => {
    const now = new Date();
    expect(todayISODate()).toBe(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    );
  });
});
