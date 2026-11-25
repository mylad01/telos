import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Store } from './store-types';
import { runStoreContract } from './store.contract';

let dir: string;

async function load(): Promise<Store> {
  vi.resetModules();
  return import('./store');
}

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'telos-json-'));
  process.env.TELOS_DATA_DIR = dir;
  delete process.env.TELOS_STORE;
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('json store', () => {
  it('stores a salted scrypt hash, never the password', async () => {
    const store = await load();
    await store.createAccount('hash@example.com', 'correct horse');
    const raw = await readFile(path.join(dir, 'telos.json'), 'utf8');
    expect(raw).not.toContain('correct horse');
    const db = JSON.parse(raw);
    expect(db.users['hash@example.com'].hash).toMatch(/^[0-9a-f]{128}$/);
    expect(db.users['hash@example.com'].salt).toMatch(/^[0-9a-f]{32}$/);
  });
});

runStoreContract('json', load);
