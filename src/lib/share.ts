import type { Session } from './supabase/map';

export type ShareRole = 'editor' | 'viewer';

export type ShareInvite = {
  id: string;
  list: string;
  ownerEmail: string;
  role: ShareRole;
  code: string;
  createdAt: number;
};

export type ShareConfig = { url: string; key: string };
export type ShareSession = Pick<Session, 'accessToken' | 'user'>;

export type ShareRequest = { url: string; init: RequestInit };

/** No 0/O/1/I, and 32 symbols so the byte modulo stays unbiased. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const TIMEOUT_MS = 15_000;
const COLUMNS = 'id,list,owner_email,role,invite_code,created_at';

export function makeInviteCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}

export function shareRequest(
  cfg: ShareConfig,
  session: ShareSession | null,
  method: string,
  path: string,
  body?: unknown,
): ShareRequest {
  const headers: Record<string, string> = { apikey: cfg.key, accept: 'application/json' };
  if (session) headers.authorization = `Bearer ${session.accessToken}`;
  const init: RequestInit = { method, headers, cache: 'no-store' };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  return { url: `${cfg.url}${path}`, init };
}

/** Outgoing insert payload; `created_at` and `owner_id` are the database's job. */
export function toInvite(invite: ShareInvite): {
  id: string;
  list: string;
  owner_email: string;
  role: ShareRole;
  invite_code: string;
} {
  return {
    id: invite.id,
    list: invite.list,
    owner_email: invite.ownerEmail,
    role: invite.role,
    invite_code: invite.code,
  };
}

export function fromRow(value: unknown): ShareInvite | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== 'string' ||
    !row.id ||
    typeof row.list !== 'string' ||
    !row.list.trim() ||
    typeof row.invite_code !== 'string' ||
    !row.invite_code
  ) {
    return null;
  }
  if (row.role !== 'editor' && row.role !== 'viewer') return null;
  const createdAt =
    typeof row.created_at === 'number'
      ? row.created_at
      : typeof row.created_at === 'string'
        ? Date.parse(row.created_at)
        : 0;
  return {
    id: row.id,
    list: row.list,
    ownerEmail: typeof row.owner_email === 'string' ? row.owner_email : '',
    role: row.role,
    code: row.invite_code,
    createdAt: Number.isFinite(createdAt) ? createdAt : 0,
  };
}

async function send(request: ShareRequest): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(request.url, { ...request.init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function read(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export async function listInvites(
  cfg: ShareConfig,
  session: ShareSession,
  list: string,
): Promise<ShareInvite[]> {
  const path =
    `/rest/v1/list_shares?select=${COLUMNS}` +
    `&list=eq.${encodeURIComponent(list)}` +
    `&owner_id=eq.${encodeURIComponent(session.user.id)}` +
    '&order=created_at.desc';
  try {
    const response = await send(shareRequest(cfg, session, 'GET', path));
    if (!response.ok) return [];
    const body = await read(response);
    if (!Array.isArray(body)) return [];
    return body
      .map(fromRow)
      .filter((invite): invite is ShareInvite => invite !== null);
  } catch {
    return [];
  }
}

export async function createInvite(
  cfg: ShareConfig,
  session: ShareSession,
  list: string,
  role: ShareRole,
): Promise<ShareInvite | null> {
  const invite: ShareInvite = {
    id: crypto.randomUUID(),
    list,
    ownerEmail: session.user.email ?? '',
    role,
    code: makeInviteCode(),
    createdAt: Date.now(),
  };
  try {
    const response = await send(
      shareRequest(cfg, session, 'POST', '/rest/v1/list_shares', toInvite(invite)),
    );
    return response.ok ? invite : null;
  } catch {
    return null;
  }
}

export async function revokeInvite(
  cfg: ShareConfig,
  session: ShareSession,
  code: string,
): Promise<boolean> {
  const path =
    `/rest/v1/list_shares?invite_code=eq.${encodeURIComponent(code)}` +
    `&owner_id=eq.${encodeURIComponent(session.user.id)}`;
  try {
    const response = await send(shareRequest(cfg, session, 'DELETE', path));
    return response.ok;
  } catch {
    return false;
  }
}

export async function joinShare(
  cfg: ShareConfig,
  session: ShareSession,
  code: string,
): Promise<string | null> {
  try {
    const response = await send(
      shareRequest(cfg, session, 'POST', '/rest/v1/rpc/telos_join_share', { code }),
    );
    if (!response.ok) return null;
    const body = await read(response);
    if (typeof body === 'string' && body.trim()) return body;
    if (typeof body === 'object' && body !== null) {
      const list = (body as Record<string, unknown>).list;
      if (typeof list === 'string' && list.trim()) return list;
    }
    return null;
  } catch {
    return null;
  }
}
