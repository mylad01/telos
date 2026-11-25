import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cookies } from 'next/headers';
import { DATA_DIR } from './store';
import { createToken, readToken } from './token';

const COOKIE = 'telos_session';
export const MAX_AGE_S = 60 * 60 * 24 * 30;
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

export async function issueSession(email: string): Promise<void> {
  const token = createToken(email, Date.now() + MAX_AGE_S * 1000, await getSecret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
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
  return readToken(token, await getSecret())?.email ?? null;
}
