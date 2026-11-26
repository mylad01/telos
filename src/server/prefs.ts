import { promises as fs } from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './data-dir';
import type { ThemePrefs } from '@/lib/prefs';

const PREFS_FILE = path.join(DATA_DIR, 'telos-prefs.json');

type Stored = Record<string, ThemePrefs>;

async function readAll(): Promise<Stored> {
  try {
    const raw = await fs.readFile(PREFS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Stored;
  } catch {
    return {};
  }
}

async function writeAll(data: Stored): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${PREFS_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data));
  await fs.rename(tmp, PREFS_FILE);
}

export async function readPrefs(email: string): Promise<ThemePrefs | null> {
  const all = await readAll();
  const record = all[email];
  if (!record || typeof record.presetId !== 'string') return null;
  return record;
}

export async function writePrefs(email: string, presetId: string): Promise<ThemePrefs> {
  const all = await readAll();
  const record: ThemePrefs = { presetId, updatedAt: Date.now() };
  all[email] = record;
  await writeAll(all);
  return record;
}
