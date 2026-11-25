import { describe, expect, it } from 'vitest';
import { createToken, readToken } from './token';

const SECRET = 'test-secret';
const NOW = 1_800_000_000_000;

describe('session tokens', () => {
  it('round-trips the email', () => {
    expect(readToken(createToken('me@example.com', NOW + 1000, SECRET), SECRET, NOW)).toEqual({
      email: 'me@example.com',
      expires: NOW + 1000,
    });
  });

  it('rejects a tampered payload or signature', () => {
    const token = createToken('me@example.com', NOW + 1000, SECRET);
    const [email, expires, signature] = token.split('|');
    expect(readToken(`${email}|${Number(expires) + 1}|${signature}`, SECRET, NOW)).toBeNull();
    expect(readToken(`${email}|${expires}|${'0'.repeat(signature.length)}`, SECRET, NOW)).toBeNull();
  });

  it('rejects another secret and an expired token', () => {
    expect(readToken(createToken('me@example.com', NOW + 1000, SECRET), 'other', NOW)).toBeNull();
    expect(readToken(createToken('me@example.com', NOW - 1, SECRET), SECRET, NOW)).toBeNull();
  });

  it('rejects malformed tokens', () => {
    for (const token of ['', 'x', 'a|b', `${'a'.repeat(10)}|notanumber|ff`]) {
      expect(readToken(token, SECRET, NOW)).toBeNull();
    }
  });
});
