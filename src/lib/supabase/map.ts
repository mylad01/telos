import { parseTask, type Task } from '../tasks';

export type TaskRow = {
  user_id: string;
  id: string;
  title: string;
  due: string;
  done: boolean;
  created_at: number;
  completed_at: number | null;
  repeat_rule: string;
  series_id: string | null;
  previous_id: string | null;
  updated_at: number;
  deleted_at: number | null;
  notes: string;
  pinned: boolean;
  remind_at: string | null;
  list: string;
  tags: string[];
  priority: number;
  start_date: string | null;
  subtasks: unknown;
  synced_at: number;
};

/** A task as a Postgres row; `repeat` is spelled `repeat_rule` to avoid the SQL function. */
export function toRow(task: Task, userId: string): Omit<TaskRow, 'synced_at'> {
  return {
    user_id: userId,
    id: task.id,
    title: task.title,
    due: task.due,
    done: task.done,
    created_at: task.createdAt,
    completed_at: task.completedAt,
    repeat_rule: task.repeat,
    series_id: task.seriesId,
    previous_id: task.previousId,
    updated_at: task.updatedAt,
    deleted_at: task.deletedAt,
    notes: task.notes,
    pinned: task.pinned,
    remind_at: task.remindAt,
    list: task.list,
    tags: task.tags,
    priority: task.priority,
    start_date: task.start,
    subtasks: task.subtasks,
  };
}

/** Validates a row on the way in, so a bad row is dropped instead of crashing the list. */
export function fromRow(value: unknown): { task: Task; syncedAt: number } | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const task = parseTask({
    id: row.id,
    title: row.title,
    due: row.due,
    done: row.done,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
    repeat: row.repeat_rule,
    seriesId: row.series_id ?? null,
    previousId: row.previous_id ?? null,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? null,
    notes: row.notes ?? '',
    pinned: row.pinned ?? false,
    remindAt: row.remind_at ?? null,
    list: row.list ?? 'Inbox',
    tags: row.tags ?? [],
    priority: row.priority ?? 0,
    start: row.start_date ?? null,
    subtasks: row.subtasks ?? [],
  });
  if (!task) return null;
  return { task, syncedAt: typeof row.synced_at === 'number' ? row.synced_at : 0 };
}

/**
 * The next pull cursor: the newest server write clock seen, stepped back one
 * millisecond. Rows written in the same millisecond are then fetched again
 * rather than skipped, which costs a little traffic and never loses a task.
 */
export function nextCursor(since: number, rows: { syncedAt: number }[]): number {
  let newest = 0;
  for (const row of rows) if (row.syncedAt > newest) newest = row.syncedAt;
  if (newest === 0) return since;
  return Math.max(since, newest - 1);
}

export type Session = {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms after which the access token is treated as expired. */
  expiresAt: number;
  user: { id: string; email: string };
};

const REFRESH_MARGIN_MS = 60_000;

export function needsRefresh(session: Session, now: number): boolean {
  return session.expiresAt - REFRESH_MARGIN_MS <= now;
}

/** GoTrue error bodies are `{msg}` or `{error_description}`; codes map to the UI's messages. */
export function mapAuthError(status: number, body: unknown): string {
  const text = JSON.stringify(body ?? {}).toLowerCase();
  // Transport and server trouble, plus GoTrue's rate limiting, are worth retrying.
  if (status === 0 || status >= 500 || text.includes('rate limit')) return 'network';
  if (text.includes('already registered') || text.includes('user_already_exists')) return 'exists';
  if (text.includes('at least') && text.includes('password')) return 'password';
  if (text.includes('password') && text.includes('weak')) return 'password';
  if (text.includes('email') && (text.includes('invalid') || text.includes('validate'))) {
    return 'email';
  }
  return 'invalid';
}

export function toSession(payload: unknown, now: number): Session | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const data = payload as Record<string, unknown>;
  const user = (data.user ?? {}) as Record<string, unknown>;
  if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string') return null;
  if (typeof user.id !== 'string' || typeof user.email !== 'string') return null;
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: now + expiresIn * 1000,
    user: { id: user.id, email: user.email },
  };
}
