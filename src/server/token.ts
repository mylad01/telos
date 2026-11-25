import { createHmac, timingSafeEqual } from 'node:crypto';

export type SessionToken = { email: string; expires: number };

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function sameSignature(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/.test(a) || !/^[0-9a-f]+$/.test(b)) return false;
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

/** `email|expires|hmac` — expires is a millisecond timestamp. */
export function createToken(email: string, expires: number, secret: string): string {
  const payload = `${email}|${expires}`;
  return `${payload}|${sign(payload, secret)}`;
}

export function readToken(token: string, secret: string, now = Date.now()): SessionToken | null {
  const parts = token.split('|');
  if (parts.length !== 3) return null;
  const [email, expires, signature] = parts;
  if (!email || !/^\d+$/.test(expires) || Number(expires) < now) return null;
  if (!sameSignature(sign(`${email}|${expires}`, secret), signature)) return null;
  return { email, expires: Number(expires) };
}
