import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll } from 'vitest';
import type { Store } from './store-types';
import { runStoreContract } from './store.contract';

let dir: string;

async function load(): Promise<Store> {
  return import('./store');
}

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'telos-sqlite-'));
  process.env.TELOS_DATA_DIR = dir;
  process.env.TELOS_STORE = 'sqlite';
});

afterAll(async () => {
  delete process.env.TELOS_STORE;
  await rm(dir, { recursive: true, force: true });
});

runStoreContract('sqlite', load);
