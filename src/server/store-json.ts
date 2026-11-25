import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Task } from '@/lib/tasks';
import { DATA_DIR } from './data-dir';
import { hashPassword, newSalt, sameHash } from './passwords';
import type { SyncResult } from './store-types';

const DB_FILE = path.join(DATA_DIR, 'telos.json');

type StoredTask = { task: Task; seq: number };
type User = {
  email: string;
  salt: string;
  hash: string;
  createdAt: number;
  /** Monotonic server counter: the sync cursor is a seq, not a clock. */
  seq: number;
  tasks: Record<string, StoredTask>;
};
type Db = { users: Record<string, User> };

let cache: Db | null = null;
let chain: Promise<unknown> = Promise.resolve();

/** Serializes every read-modify-write of the JSON store within this process. */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

async function readDb(): Promise<Db> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Db;
    cache = parsed && parsed.users ? parsed : { users: {} };
  } catch {
    cache = { users: {} };
  }
  return cache;
}

async function writeDb(db: Db): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db));
  await fs.rename(tmp, DB_FILE);
}

export async function createAccount(email: string, password: string): Promise<'ok' | 'exists'> {
  return locked(async () => {
    const db = await readDb();
    if (db.users[email]) return 'exists';
    const salt = newSalt();
    db.users[email] = {
      email,
      salt,
      hash: await hashPassword(password, salt),
      createdAt: Date.now(),
      seq: 0,
      tasks: {},
    };
    await writeDb(db);
    return 'ok';
  });
}

export async function verifyAccount(email: string, password: string): Promise<boolean> {
  const db = await readDb();
  const user = db.users[email];
  if (!user) return false;
  return sameHash(user.hash, await hashPassword(password, user.salt));
}

export async function syncTasks(
  email: string,
  since: number,
  changes: Task[],
): Promise<SyncResult | null> {
  return locked(async () => {
    const db = await readDb();
    const user = db.users[email];
    if (!user) return null;

    let changed = false;
    for (const incoming of changes) {
      const current = user.tasks[incoming.id];
      if (!current || incoming.updatedAt > current.task.updatedAt) {
        user.tasks[incoming.id] = { task: incoming, seq: (user.seq += 1) };
        changed = true;
      }
    }
    if (changed) await writeDb(db);

    const tasks = Object.values(user.tasks)
      .filter((entry) => entry.seq > since)
      .map((entry) => entry.task);
    return { tasks, now: user.seq };
  });
}

/** Reads a session's tasks without mutating; used by tests and diagnostics. */
export async function listTasks(email: string): Promise<Task[] | null> {
  const db = await readDb();
  const user = db.users[email];
  if (!user) return null;
  return Object.values(user.tasks).map((entry) => entry.task);
}
