import { describe, expect, it } from 'vitest';
import {
  fromRow,
  mapAuthError,
  needsRefresh,
  nextCursor,
  toRow,
  toSession,
  type Session,
} from './map';
import type { Task } from '../tasks';

function make(overrides: Partial<Task> = {}): Task {
  return {
    id: 'a',
    title: 'Water the plants',
    due: '2026-11-25',
    done: false,
    createdAt: 1_000,
    completedAt: null,
    repeat: 'none',
    seriesId: null,
    previousId: null,
    updatedAt: 1_000,
    deletedAt: null,
    notes: '',
    pinned: false,
    remindAt: null,
    list: 'Inbox',
    tags: [],
    priority: 0,
    start: null,
    subtasks: [],
    ...overrides,
  };
}

describe('supabase row mapping', () => {
  it('writes snake_case columns with user_id and repeat_rule', () => {
    const row = toRow(make({ repeat: 'weekly', completedAt: 2_000 }), 'user-1');
    expect(row).toMatchObject({
      user_id: 'user-1',
      id: 'a',
      repeat_rule: 'weekly',
      completed_at: 2_000,
      created_at: 1_000,
      updated_at: 1_000,
      deleted_at: null,
    });
  });

  it('round-trips a task through a row and back', () => {
    const task = make({ repeat: 'daily', seriesId: 's1', previousId: 'p1' });
    const row = { ...toRow(task, 'user-1'), synced_at: 9_000 };
    expect(fromRow(row)).toEqual({ task, syncedAt: 9_000 });
  });

  it('drops rows that are not valid tasks', () => {
    expect(fromRow(null)).toBeNull();
    expect(fromRow({ ...toRow(make(), 'u'), due: '25-11-2026', synced_at: 1 })).toBeNull();
    expect(fromRow({ ...toRow(make(), 'u'), title: 42 })).toBeNull();
  });

  it('treats a missing synchronisation clock as zero', () => {
    const { synced_at: _ignored, ...row } = { ...toRow(make(), 'u'), synced_at: 5 };
    expect(fromRow(row)?.syncedAt).toBe(0);
  });
});

describe('sync cursor', () => {
  it('steps one millisecond back so equal timestamps are refetched, never skipped', () => {
    expect(nextCursor(0, [{ syncedAt: 10 }, { syncedAt: 30 }, { syncedAt: 20 }])).toBe(29);
  });

  it('stays put when nothing new arrived', () => {
    expect(nextCursor(42, [])).toBe(42);
  });

  it('never moves backwards', () => {
    expect(nextCursor(100, [{ syncedAt: 50 }])).toBe(100);
  });
});

describe('session handling', () => {
  const session: Session = {
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: 60_000,
    user: { id: 'u', email: 'a@example.com' },
  };

  it('refreshes inside the one-minute safety margin', () => {
    expect(needsRefresh(session, 0)).toBe(true);
    expect(needsRefresh({ ...session, expiresAt: 600_000 }, 0)).toBe(false);
    expect(needsRefresh({ ...session, expiresAt: 120_000 }, 60_000)).toBe(true);
    expect(needsRefresh({ ...session, expiresAt: 120_000 }, 59_999)).toBe(false);
    expect(needsRefresh({ ...session, expiresAt: 120_000 }, 40_000)).toBe(false);
  });

  it('reads a token response into a session with an absolute expiry', () => {
    const parsed = toSession(
      {
        access_token: 'access',
        refresh_token: 'refresh',
        expires_in: 3600,
        user: { id: 'u', email: 'a@example.com' },
      },
      1_000,
    );
    expect(parsed).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: 1_000 + 3_600_000,
      user: { id: 'u', email: 'a@example.com' },
    });
  });

  it('rejects payloads without a usable session', () => {
    expect(toSession({ user: { id: 'u', email: 'e' } }, 0)).toBeNull();
    expect(toSession({ access_token: 'a', refresh_token: 'r' }, 0)).toBeNull();
  });
});

describe('auth error mapping', () => {
  it('maps the messages GoTrue actually sends', () => {
    expect(mapAuthError(400, { msg: 'User already registered' })).toBe('exists');
    expect(mapAuthError(422, { error_code: 'user_already_exists' })).toBe('exists');
    expect(mapAuthError(422, { msg: 'Password should be at least 6 characters.' })).toBe(
      'password',
    );
    expect(mapAuthError(400, { msg: 'Unable to validate email address: invalid format' })).toBe(
      'email',
    );
    expect(mapAuthError(400, { msg: 'Invalid login credentials' })).toBe('invalid');
    expect(mapAuthError(429, { msg: 'email rate limit exceeded' })).toBe('network');
    expect(mapAuthError(503, {})).toBe('network');
    expect(mapAuthError(0, {})).toBe('network');
  });
});
