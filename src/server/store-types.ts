import type { Task } from '@/lib/tasks';

export type SyncResult = { tasks: Task[]; now: number };

/**
 * The contract both backends implement. Kept in its own module so the JSON
 * backend and the SQLite backend can import it without a cycle through
 * `store.ts`.
 */
export type Store = {
  createAccount(email: string, password: string): Promise<'ok' | 'exists'>;
  verifyAccount(email: string, password: string): Promise<boolean>;
  syncTasks(email: string, since: number, changes: Task[]): Promise<SyncResult | null>;
  listTasks(email: string): Promise<Task[] | null>;
};
