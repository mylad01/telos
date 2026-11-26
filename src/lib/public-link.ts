import type { Priority, Subtask, Task } from './tasks';

/** Longest encoded share code (base64url characters) we will put in a URL. */
export const SHARE_MAX_BYTES = 6000;

export type SharedTask = Pick<
  Task,
  | 'id'
  | 'title'
  | 'due'
  | 'done'
  | 'notes'
  | 'pinned'
  | 'list'
  | 'tags'
  | 'priority'
  | 'subtasks'
  | 'evening'
>;

export type ShareSnapshot = {
  v: 1;
  /** null = the whole list set */
  list: string | null;
  tasks: SharedTask[];
  sharedAt: number;
};

function encodeUtf8(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      } else {
        code = 0xfffd;
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      code = 0xfffd;
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}

function decodeUtf8(bytes: number[]): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const first = bytes[i];
    let code: number;
    let extra: number;
    if (first < 0x80) {
      code = first;
      extra = 0;
    } else if (first >= 0xc2 && first <= 0xdf) {
      code = first & 0x1f;
      extra = 1;
    } else if (first >= 0xe0 && first <= 0xef) {
      code = first & 0x0f;
      extra = 2;
    } else if (first >= 0xf0 && first <= 0xf4) {
      code = first & 0x07;
      extra = 3;
    } else {
      throw new Error('bad utf8 lead byte');
    }
    i += 1;
    for (let k = 0; k < extra; k += 1) {
      const byte = bytes[i];
      if (byte === undefined || (byte & 0xc0) !== 0x80) throw new Error('bad utf8 continuation');
      code = (code << 6) | (byte & 0x3f);
      i += 1;
    }
    if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
      throw new Error('bad codepoint');
    }
    out += String.fromCodePoint(code);
  }
  return out;
}

type BufferLike = {
  from(data: string, encoding: string): { toString(encoding: string): string };
};

function nodeBuffer(): BufferLike | null {
  const candidate = (globalThis as { Buffer?: BufferLike }).Buffer;
  return typeof candidate?.from === 'function' ? candidate : null;
}

function bytesToBinary(bytes: number[]): string {
  let binary = '';
  const chunk = 0x2000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunk));
  }
  return binary;
}

function base64Encode(bytes: number[]): string {
  const binary = bytesToBinary(bytes);
  const btoaFn = (globalThis as { btoa?: (data: string) => string }).btoa;
  if (typeof btoaFn === 'function') return btoaFn(binary);
  const buffer = nodeBuffer();
  if (buffer) return buffer.from(binary, 'binary').toString('base64');
  throw new Error('no base64 encoder available');
}

function base64Decode(text: string): number[] | null {
  const atobFn = (globalThis as { atob?: (data: string) => string }).atob;
  let binary: string;
  try {
    if (typeof atobFn === 'function') {
      binary = atobFn(text);
    } else {
      const buffer = nodeBuffer();
      if (!buffer) return null;
      binary = buffer.from(text, 'base64').toString('binary');
    }
  } catch {
    return null;
  }
  const bytes: number[] = [];
  for (let i = 0; i < binary.length; i += 1) bytes.push(binary.charCodeAt(i) & 0xff);
  return bytes;
}

function toBase64Url(text: string): string {
  return base64Encode(encodeUtf8(text))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(code: string): string | null {
  if (typeof code !== 'string') return null;
  const trimmed = code.trim();
  if (!trimmed || !/^[A-Za-z0-9\-_]+=*$/.test(trimmed)) return null;
  const unpadded = trimmed.replace(/=+$/, '');
  if (!unpadded || unpadded.length % 4 === 1) return null;
  const padded =
    unpadded.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (unpadded.length % 4)) % 4);
  const bytes = base64Decode(padded);
  if (bytes === null) return null;
  try {
    return decodeUtf8(bytes);
  } catch {
    return null;
  }
}

function pickTask(task: Task): SharedTask {
  return {
    id: task.id,
    title: task.title,
    due: task.due,
    done: task.done,
    notes: task.notes,
    pinned: task.pinned,
    list: task.list,
    tags: [...task.tags],
    priority: task.priority,
    subtasks: task.subtasks.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      done: subtask.done,
    })),
    evening: task.evening,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSharedTask(value: unknown): SharedTask | null {
  if (!isRecord(value)) return null;
  const { id, title, due, done, notes, pinned, list, tags, priority, subtasks, evening } = value;
  if (typeof id !== 'string' || typeof title !== 'string') return null;
  if (typeof due !== 'string') return null;
  if (typeof done !== 'boolean' || typeof pinned !== 'boolean' || typeof evening !== 'boolean') {
    return null;
  }
  if (typeof notes !== 'string' || typeof list !== 'string') return null;
  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string')) return null;
  if (priority !== 0 && priority !== 1 && priority !== 2 && priority !== 3) return null;
  if (!Array.isArray(subtasks)) return null;
  const parsedSubtasks: Subtask[] = [];
  for (const raw of subtasks) {
    if (!isRecord(raw)) return null;
    if (
      typeof raw.id !== 'string' ||
      typeof raw.title !== 'string' ||
      typeof raw.done !== 'boolean'
    ) {
      return null;
    }
    parsedSubtasks.push({ id: raw.id, title: raw.title, done: raw.done });
  }
  return {
    id,
    title,
    due,
    done,
    notes,
    pinned,
    list,
    tags: [...tags],
    priority: priority as Priority,
    subtasks: parsedSubtasks,
    evening,
  };
}

/** JSON -> UTF-8 -> base64url. Returns null when the encoded code exceeds SHARE_MAX_BYTES
 * or there are no tasks. Strips every field not in the Pick above. */
export function encodeShare(tasks: Task[], list: string | null, now: number): string | null {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;
  const snapshot: ShareSnapshot = {
    v: 1,
    list: typeof list === 'string' && list.trim() ? list : null,
    tasks: tasks.map(pickTask),
    sharedAt: now,
  };
  let text: string;
  try {
    text = JSON.stringify(snapshot);
  } catch {
    return null;
  }
  const code = toBase64Url(text);
  return code.length > SHARE_MAX_BYTES ? null : code;
}

/** Strict decode: null on bad base64, bad JSON, wrong v, or a shape that fails validation. */
export function decodeShare(code: string): ShareSnapshot | null {
  const text = fromBase64Url(code);
  if (text === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  if (value.v !== 1) return null;
  if (typeof value.sharedAt !== 'number' || !Number.isFinite(value.sharedAt)) return null;
  if (value.list !== null && typeof value.list !== 'string') return null;
  if (!Array.isArray(value.tasks)) return null;
  const tasks: SharedTask[] = [];
  for (const raw of value.tasks) {
    const task = parseSharedTask(raw);
    if (task === null) return null;
    tasks.push(task);
  }
  return { v: 1, list: value.list as string | null, tasks, sharedAt: value.sharedAt };
}

/** `${basePath}#share=${code}` — basePath may be '' or '/telos'. */
export function shareHref(basePath: string, code: string): string {
  return `${basePath}#share=${code}`;
}

/** Reads `#share=...` out of a location.hash; null when absent. */
export function readShareFromHash(hash: string): string | null {
  if (typeof hash !== 'string') return null;
  const hashAt = hash.indexOf('#');
  const raw = hashAt >= 0 ? hash.slice(hashAt + 1) : hash;
  if (!raw) return null;
  const code = new URLSearchParams(raw).get('share');
  return code && code.trim() ? code : null;
}
