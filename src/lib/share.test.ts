import { describe, expect, it } from 'vitest';
import {
  fromRow,
  makeInviteCode,
  shareRequest,
  toInvite,
  type ShareConfig,
  type ShareInvite,
  type ShareSession,
} from './share';

const cfg: ShareConfig = { url: 'https://example.supabase.co', key: 'anon-key' };
const session: ShareSession = {
  accessToken: 'token-123',
  user: { id: 'user-1', email: 'owner@example.com' },
};

function invite(overrides: Partial<ShareInvite> = {}): ShareInvite {
  return {
    id: 'invite-1',
    list: 'Groceries',
    ownerEmail: 'owner@example.com',
    role: 'editor',
    code: 'ABCD2345',
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

function headersOf(request: ReturnType<typeof shareRequest>): Record<string, string> {
  return request.init.headers as Record<string, string>;
}

describe('makeInviteCode', () => {
  it('is eight unambiguous uppercase characters', () => {
    for (let run = 0; run < 50; run += 1) {
      const code = makeInviteCode();
      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
      expect(code).not.toMatch(/[01IO]/);
    }
  });

  it('does not repeat itself', () => {
    const codes = new Set(Array.from({ length: 500 }, () => makeInviteCode()));
    expect(codes.size).toBe(500);
  });
});

describe('shareRequest', () => {
  it('builds a GET against the REST table, with the session key when there is one', () => {
    const request = shareRequest(cfg, session, 'GET', '/rest/v1/list_shares?select=id');

    expect(request.url).toBe('https://example.supabase.co/rest/v1/list_shares?select=id');
    expect(request.init.method).toBe('GET');
    expect(request.init.body).toBeUndefined();
    expect(headersOf(request)).toEqual({
      apikey: 'anon-key',
      accept: 'application/json',
      authorization: 'Bearer token-123',
    });

    const anonymous = shareRequest(cfg, null, 'GET', '/rest/v1/list_shares');
    expect(headersOf(anonymous)).not.toHaveProperty('authorization');
    expect(headersOf(anonymous).apikey).toBe('anon-key');
  });

  it('adds a JSON body and content type when one is passed', () => {
    const request = shareRequest(cfg, session, 'POST', '/rest/v1/list_shares', {
      list: 'Groceries',
      role: 'viewer',
    });

    expect(request.init.method).toBe('POST');
    expect(headersOf(request)['content-type']).toBe('application/json');
    expect(request.init.body).toBe(JSON.stringify({ list: 'Groceries', role: 'viewer' }));
  });

});

describe('row mapping', () => {
  it('toInvite sends the snake_case columns and no timestamps', () => {
    expect(toInvite(invite())).toEqual({
      id: 'invite-1',
      list: 'Groceries',
      owner_email: 'owner@example.com',
      role: 'editor',
      invite_code: 'ABCD2345',
    });
  });

  it('fromRow reads a PostgREST row back into an invite', () => {
    const mapped = fromRow({
      id: 'invite-1',
      list: 'Groceries',
      owner_email: 'owner@example.com',
      role: 'viewer',
      invite_code: 'ABCD2345',
      created_at: '2026-11-28T10:00:00.000Z',
    });

    expect(mapped).toEqual({
      id: 'invite-1',
      list: 'Groceries',
      ownerEmail: 'owner@example.com',
      role: 'viewer',
      code: 'ABCD2345',
      createdAt: Date.parse('2026-11-28T10:00:00.000Z'),
    });
  });

  it('fromRow rejects rows with a missing or unknown role', () => {
    const base = {
      id: 'invite-1',
      list: 'Groceries',
      owner_email: 'owner@example.com',
      invite_code: 'ABCD2345',
      created_at: '2026-11-28T10:00:00.000Z',
    };

    expect(fromRow({ ...base, role: 'owner' })).toBeNull();
    expect(fromRow({ ...base, role: undefined })).toBeNull();
    expect(fromRow({ id: 'x', role: 'editor' })).toBeNull();
    expect(fromRow(null)).toBeNull();
  });
});
