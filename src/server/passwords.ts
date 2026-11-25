import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export function newSalt(): string {
  return randomBytes(16).toString('hex');
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return key.toString('hex');
}

export function sameHash(expected: string, actual: string): boolean {
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(actual, 'hex');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}
