import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Task } from '@/lib/tasks';
import { DATA_DIR } from './data-dir';
import { hashPassword, newSalt, sameHash } from './passwords';
import type { SyncResult } from './store-types';

const DB_FILE = path.join(DATA_DIR, 'telos.db');

let db: DatabaseSync | null = null;
let chain: Promise<unknown> = Promise.resolve();

/** One file, WAL, schema created on first use; the seq lives in `meta`. */
function open(): DatabaseSync {
  if (db) return db;
  mkdirSync(DATA_DIR, { recursive: true });
  const handle = new DatabaseSync(DB_FILE);
  handle.exec('PRAGMA journal_mode = WAL');
  handle.exec('PRAGMA busy_timeout = 5000');
  handle.exec(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      salt TEXT NOT NULL,
      hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      email TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      seq INTEGER NOT NULL,
      PRIMARY KEY (email, id)
    );
    CREATE INDEX IF NOT EXISTS tasks_email_seq ON tasks (email, seq);
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO meta (key, value) VALUES ('seq', 0);
  `);
  db = handle;
  return handle;
}

/** Serializes writers in this process; SQLite's own lock covers other processes. */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

function currentSeq(handle: DatabaseSync): number {
  const row = handle.prepare(`SELECT value FROM meta WHERE key = 'seq'`).get() as
    | { value: number }
    | undefined;
  return row?.value ?? 0;
}

function nextSeq(handle: DatabaseSync): number {
  handle.prepare(`UPDATE meta SET value = value + 1 WHERE key = 'seq'`).run();
  return currentSeq(handle);
}

export async function createAccount(email: string, password: string): Promise<'ok' | 'exists'> {
  return locked(async () => {
    const handle = open();
    const existing = handle.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
    if (existing) return 'exists';
    const salt = newSalt();
    handle
      .prepare('INSERT INTO users (email, salt, hash, created_at) VALUES (?, ?, ?, ?)')
      .run(email, salt, await hashPassword(password, salt), Date.now());
    return 'ok';
  });
}

export async function verifyAccount(email: string, password: string): Promise<boolean> {
  const row = open().prepare('SELECT salt, hash FROM users WHERE email = ?').get(email) as
    | { salt: string; hash: string }
    | undefined;
  if (!row) return false;
  return sameHash(row.hash, await hashPassword(password, row.salt));
}

export async function syncTasks(
  email: string,
  since: number,
  changes: Task[],
): Promise<SyncResult | null> {
  return locked(async () => {
    const handle = open();
    if (!handle.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return null;

    const selectOne = handle.prepare('SELECT updated_at FROM tasks WHERE email = ? AND id = ?');
    const upsert = handle.prepare(`
      INSERT INTO tasks (email, id, data, updated_at, seq) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (email, id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at,
        seq = excluded.seq
    `);

    handle.exec('BEGIN IMMEDIATE');
    try {
      for (const incoming of changes) {
        const current = selectOne.get(email, incoming.id) as { updated_at: number } | undefined;
        if (current && incoming.updatedAt <= current.updated_at) continue;
        upsert.run(email, incoming.id, JSON.stringify(incoming), incoming.updatedAt, nextSeq(handle));
      }
      const now = currentSeq(handle);
      const rows = handle
        .prepare('SELECT data FROM tasks WHERE email = ? AND seq > ? ORDER BY seq')
        .all(email, since) as { data: string }[];
      handle.exec('COMMIT');
      return { tasks: rows.map((row) => JSON.parse(row.data) as Task), now };
    } catch (error) {
      handle.exec('ROLLBACK');
      throw error;
    }
  });
}

/** Reads a session's tasks without mutating; used by tests and diagnostics. */
export async function listTasks(email: string): Promise<Task[] | null> {
  const handle = open();
  if (!handle.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return null;
  const rows = handle
    .prepare('SELECT data FROM tasks WHERE email = ? ORDER BY updated_at, id')
    .all(email) as { data: string }[];
  return rows.map((row) => JSON.parse(row.data) as Task);
}
