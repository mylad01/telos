import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from './quick-add';

const TODAY = '2026-11-26'; // a Thursday

describe('parseQuickAdd', () => {
  it('pulls a weekday out of the title and dates it to the coming one', () => {
    expect(parseQuickAdd('pay rent friday', TODAY)).toEqual({
      title: 'pay rent',
      due: '2026-11-27',
      repeat: null,
    });
  });

  it('skips ahead a week when the weekday is today', () => {
    expect(parseQuickAdd('standup thursday', TODAY)).toEqual({
      title: 'standup',
      due: '2026-12-03',
      repeat: null,
    });
  });

  it('understands tomorrow and in N days', () => {
    expect(parseQuickAdd('call mum tomorrow', TODAY).due).toBe('2026-11-27');
    expect(parseQuickAdd('water plants in 3 days', TODAY)).toEqual({
      title: 'water plants',
      due: '2026-11-29',
      repeat: null,
    });
    expect(parseQuickAdd('review in 2 weeks', TODAY).due).toBe('2026-12-10');
  });

  it('reads a repeat every weekday phrase and keeps the weekday too', () => {
    expect(parseQuickAdd('gym every monday', TODAY)).toEqual({
      title: 'gym',
      due: '2026-11-30',
      repeat: 'weekly',
    });
  });

  it('reads a trailing repeat word', () => {
    expect(parseQuickAdd('water plants daily', TODAY)).toEqual({
      title: 'water plants',
      due: null,
      repeat: 'daily',
    });
    expect(parseQuickAdd('rent weekly', TODAY).repeat).toBe('weekly');
    expect(parseQuickAdd('pay landlord monthly', TODAY).repeat).toBe('monthly');
  });

  it('does not treat a repeat word in the middle as a rule', () => {
    expect(parseQuickAdd('weekly review monday', TODAY)).toEqual({
      title: 'weekly review',
      due: '2026-11-30',
      repeat: null,
    });
  });

  it('accepts an explicit ISO date', () => {
    expect(parseQuickAdd('taxes 2026-12-01', TODAY)).toEqual({
      title: 'taxes',
      due: '2026-12-01',
      repeat: null,
    });
    expect(parseQuickAdd('taxes 2026-02-31', TODAY).due).toBeNull();
  });

  it('accepts day-month and month-day wording, rolling into next year when past', () => {
    expect(parseQuickAdd('dentist 1 dec', TODAY).due).toBe('2026-12-01');
    expect(parseQuickAdd('insurance dec 1', TODAY).due).toBe('2026-12-01');
    expect(parseQuickAdd('renew passport 1 jan', TODAY).due).toBe('2027-01-01');
  });

  it('leaves text it does not understand alone', () => {
    expect(parseQuickAdd('buy may need milk', TODAY)).toEqual({
      title: 'buy may need milk',
      due: null,
      repeat: null,
    });
  });

  it('keeps the typed words when the date was the whole input', () => {
    expect(parseQuickAdd('tomorrow', TODAY)).toEqual({
      title: 'tomorrow',
      due: null,
      repeat: null,
    });
  });

  it('tidies punctuation left behind by a removed date', () => {
    expect(parseQuickAdd('call the bank, friday', TODAY).title).toBe('call the bank');
  });
});
