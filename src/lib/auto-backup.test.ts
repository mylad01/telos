import { describe, expect, it } from 'vitest';
import {
  BACKUP_INTERVAL_DAYS,
  backupDue,
  backupFilename,
  backupsToPrune,
} from './auto-backup';

const NOW = new Date('2026-11-26T12:00:00.000Z');

describe('backupDue', () => {
  it('is due when there is no last backup', () => {
    expect(backupDue(null, NOW)).toBe(true);
  });

  it('is due when the timestamp is unparseable', () => {
    expect(backupDue('not-a-date', NOW)).toBe(true);
    expect(backupDue('', NOW)).toBe(true);
  });

  it('is not due for a recent backup', () => {
    expect(backupDue('2026-11-25T12:00:00.000Z', NOW)).toBe(false);
  });

  it('is due at exactly seven days ago', () => {
    expect(backupDue('2026-11-19T12:00:00.000Z', NOW)).toBe(true);
  });

  it('is not due one millisecond before seven days', () => {
    expect(backupDue('2026-11-19T12:00:00.001Z', NOW)).toBe(false);
  });

  it('is due for an older backup', () => {
    expect(backupDue('2026-10-01T00:00:00.000Z', NOW)).toBe(true);
  });

  it('is not due for a timestamp in the future', () => {
    expect(backupDue('2026-12-01T00:00:00.000Z', NOW)).toBe(false);
  });

  it('uses a seven day interval', () => {
    expect(BACKUP_INTERVAL_DAYS).toBe(7);
  });
});

describe('backupFilename', () => {
  it('formats the UTC date', () => {
    expect(backupFilename(NOW)).toBe('telos-backup-2026-11-26.json');
  });

  it('uses the UTC date even late in the UTC day', () => {
    expect(backupFilename(new Date('2026-11-26T23:59:59.999Z'))).toBe(
      'telos-backup-2026-11-26.json',
    );
  });

  it('rolls over at UTC midnight', () => {
    expect(backupFilename(new Date('2026-11-27T00:00:00.000Z'))).toBe(
      'telos-backup-2026-11-27.json',
    );
  });

  it('zero-pads month and day', () => {
    expect(backupFilename(new Date('2026-01-05T00:00:00.000Z'))).toBe(
      'telos-backup-2026-01-05.json',
    );
  });
});

describe('backupsToPrune', () => {
  it('returns nothing when within the keep count', () => {
    const names = ['telos-backup-2026-11-26.json', 'telos-backup-2026-11-19.json'];
    expect(backupsToPrune(names, 2)).toEqual([]);
    expect(backupsToPrune(names, 5)).toEqual([]);
  });

  it('deletes the oldest names beyond keep, regardless of input order', () => {
    const names = [
      'telos-backup-2026-11-19.json',
      'telos-backup-2026-11-26.json',
      'telos-backup-2026-11-05.json',
      'telos-backup-2026-11-12.json',
    ];
    expect(backupsToPrune(names, 2)).toEqual([
      'telos-backup-2026-11-12.json',
      'telos-backup-2026-11-05.json',
    ]);
  });

  it('orders newest first across months and years', () => {
    const names = [
      'telos-backup-2025-12-31.json',
      'telos-backup-2026-02-01.json',
      'telos-backup-2026-01-15.json',
    ];
    expect(backupsToPrune(names, 1)).toEqual([
      'telos-backup-2026-01-15.json',
      'telos-backup-2025-12-31.json',
    ]);
  });

  it('ignores names that do not match the pattern', () => {
    const names = [
      'telos-backup-2026-11-26.json',
      'notes.txt',
      'telos-backup-2026-11-19.json.bak',
      'telos-backup-2026-11-19.json',
      'telos-backup-19-11-2026.json',
      'telos-backup-2026-13-01.json',
    ];
    expect(backupsToPrune(names, 1)).toEqual(['telos-backup-2026-11-19.json']);
  });

  it('returns all matching names when keep is zero', () => {
    const names = ['telos-backup-2026-11-26.json', 'other.json', 'telos-backup-2026-11-19.json'];
    expect(backupsToPrune(names, 0)).toEqual([
      'telos-backup-2026-11-26.json',
      'telos-backup-2026-11-19.json',
    ]);
  });

  it('handles an empty list', () => {
    expect(backupsToPrune([], 3)).toEqual([]);
  });
});
