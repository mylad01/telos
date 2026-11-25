/**
 * Copies the JSON store into the SQLite store. Safe to run more than once:
 * rows are upserted and the seq counter is raised to the highest value seen.
 *
 *   node scripts/backfill-sqlite.mts [dataDir]
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Task } from '../src/lib/tasks';

type JsonDb = {
  users: Record<
    string,
    {
      email: string;
      salt: string;
      hash: string;
      createdAt: number;
      seq: number;
      tasks: Record<string, { task: Task; seq: number }>;
    }
  >;
};

const dir = process.argv[2] ?? process.env.TELOS_DATA_DIR ?? path.join(process.cwd(), '.data');
const source = path.join(dir, 'telos.json');
const target = path.join(dir, 'telos.db');

if (!existsSync(source)) {
  console.error(`No JSON store at ${source} — nothing to copy.`);
  process.exit(1);
}

const parsed = JSON.parse(readFileSync(source, 'utf8')) as JsonDb;
mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(target);
db.exec('PRAGMA journal_mode = WAL');
db.exec(`
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
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
  INSERT OR IGNORE INTO meta (key, value) VALUES ('seq', 0);
`);

const putUser = db.prepare(`
  INSERT INTO users (email, salt, hash, created_at) VALUES (?, ?, ?, ?)
  ON CONFLICT (email) DO UPDATE SET salt = excluded.salt, hash = excluded.hash
`);
const putTask = db.prepare(`
  INSERT INTO tasks (email, id, data, updated_at, seq) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT (email, id) DO UPDATE SET
    data = excluded.data, updated_at = excluded.updated_at, seq = excluded.seq
`);

let users = 0;
let tasks = 0;
let maxSeq = 0;

db.exec('BEGIN IMMEDIATE');
try {
  for (const user of Object.values(parsed.users ?? {})) {
    putUser.run(user.email, user.salt, user.hash, user.createdAt);
    users += 1;
    maxSeq = Math.max(maxSeq, user.seq ?? 0);
    for (const { task, seq } of Object.values(user.tasks ?? {})) {
      putTask.run(user.email, task.id, JSON.stringify(task), task.updatedAt, seq);
      tasks += 1;
      maxSeq = Math.max(maxSeq, seq);
    }
  }
  db.prepare(`UPDATE meta SET value = ? WHERE key = 'seq' AND value < ?`).run(maxSeq, maxSeq);
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}

console.log(`Copied ${users} account(s) and ${tasks} task(s) into ${target} (seq ${maxSeq}).`);
