import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cookies } from 'next/headers';
import { DATA_DIR } from './store';

const COOKIE = 'telos_session';
const MAX_AGE_S = 60 * 60 * 24 * 30;
const SECRET_FILE = path.join(DATA_DIR, 'secret');

let secretCache: string | null = null;
let secretPromise: Promise<string> | null = null;

async function getSecret(): Promise<string> {
  if (secretCache) return secretCache;
  if (!secretPromise) {
    secretPromise = (async () => {
      if (process.env.TELOS_SECRET) return process.env.TELOS_SECRET;
      try {
        return (await fs.readFile(SECRET_FILE, 'utf8')).trim();
      } catch {
        const generated = randomBytes(32).toString('hex');
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(SECRET_FILE, generated, { mode: 0o600 });
        return generated;
      }
    })();
  }
  secretCache = await secretPromise;
  return secretCache;
}

async function sign(payload: string): Promise<string> {
  return createHmac('sha256', await getSecret()).update(payload).digest('hex');
}

function sameToken(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function issueSession(email: string): Promise<void> {
  const expires = Date.now() + MAX_AGE_S * 1000;
  const payload = `${email}|${expires}`;
  const jar = await cookies();
  jar.set(COOKIE, `${payload}|${await sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_S,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
}

export async function currentUser(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const parts = token.split('|');
  if (parts.length !== 3) return null;
  const [email, expires, signature] = parts;
  if (!email || !/^\d+$/.test(expires) || Number(expires) < Date.now()) return null;
  const expected = await sign(`${email}|${expires}`);
  return sameToken(expected, signature) ? email : null;
}
