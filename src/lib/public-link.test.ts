import { describe, expect, it } from 'vitest';
import type { Task } from './tasks';
import {
  SHARE_MAX_BYTES,
  decodeShare,
  encodeShare,
  readShareFromHash,
  shareHref,
} from './public-link';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Water plants',
    due: '2026-11-26',
    done: false,
    createdAt: 1,
    completedAt: null,
    repeat: 'none',
    seriesId: null,
    previousId: null,
    updatedAt: 2,
    deletedAt: null,
    notes: '',
    pinned: false,
    remindAt: null,
    list: 'Home',
    tags: ['garden'],
    priority: 1,
    start: null,
    subtasks: [{ id: 's1', title: 'Fill can', done: true }],
    evening: false,
    order: null,
    ...overrides,
  };
}

/** Test-only base64url encoder for hand-crafted payloads (all ASCII). */
function toCode(text: string): string {
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromCode(code: string): string {
  const unpadded = code.replace(/-/g, '+').replace(/_/g, '/');
  return atob(unpadded + '='.repeat((4 - (unpadded.length % 4)) % 4));
}

describe('encodeShare / decodeShare', () => {
  it('roundtrips a snapshot', () => {
    const tasks = [makeTask(), makeTask({ id: 't2', title: 'Call mum', list: 'Inbox', priority: 3 })];
    const code = encodeShare(tasks, 'Home', 1_700_000_000_000);
    expect(code).not.toBeNull();
    expect(decodeShare(code as string)).toEqual({
      v: 1,
      list: 'Home',
      sharedAt: 1_700_000_000_000,
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        due: task.due,
        done: task.done,
        notes: task.notes,
        pinned: task.pinned,
        list: task.list,
        tags: task.tags,
        priority: task.priority,
        subtasks: task.subtasks,
        evening: task.evening,
      })),
    });
  });

  it('encodes base64url without padding', () => {
    const code = encodeShare([makeTask({ title: 'Ünïcode ✓' })], null, 5);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code).not.toContain('=');
  });

  it('roundtrips unicode titles, notes and tags', () => {
    const tasks = [
      makeTask({
        title: 'Café ☕ 東京 🎉',
        notes: 'naïve façade — 日本語 🚀, emoji 👩‍💻 and #tag',
        tags: ['日本語', 'café'],
      }),
    ];
    const decoded = decodeShare(encodeShare(tasks, 'Ünïcode', 42) as string);
    expect(decoded?.tasks[0]?.title).toBe('Café ☕ 東京 🎉');
    expect(decoded?.tasks[0]?.notes).toBe('naïve façade — 日本語 🚀, emoji 👩‍💻 and #tag');
    expect(decoded?.tasks[0]?.tags).toEqual(['日本語', 'café']);
    expect(decoded?.list).toBe('Ünïcode');
  });

  it('strips every field not in the share pick', () => {
    const task = makeTask({ completedAt: 99, deletedAt: 88, repeat: 'weekly', order: 4 });
    const code = encodeShare([task], null, 1) as string;
    const payload = JSON.parse(fromCode(code)) as { tasks: Record<string, unknown>[] };
    expect(Object.keys(payload.tasks[0]).sort()).toEqual(
      ['done', 'due', 'evening', 'id', 'list', 'notes', 'pinned', 'priority', 'subtasks', 'tags', 'title'].sort(),
    );
    expect(payload.tasks[0]).not.toHaveProperty('completedAt');
    expect(payload.tasks[0]).not.toHaveProperty('deletedAt');
    expect(decodeShare(code)?.tasks[0]).not.toHaveProperty('completedAt');
  });

  it('returns null when the encoded code exceeds SHARE_MAX_BYTES', () => {
    const big = Array.from({ length: 40 }, (_, i) =>
      makeTask({ id: `t${i}`, notes: 'x'.repeat(500) }),
    );
    expect(encodeShare(big, null, 1)).toBeNull();
    const code = encodeShare(big, null, 1);
    if (code !== null) expect(code.length).toBeGreaterThan(SHARE_MAX_BYTES);
  });

  it('returns null for an empty task list', () => {
    expect(encodeShare([], null, 1)).toBeNull();
  });

  it('treats a blank list name as the whole list set', () => {
    expect(decodeShare(encodeShare([makeTask()], '   ', 1) as string)?.list).toBeNull();
  });

  it('accepts padded base64url', () => {
    const code = encodeShare([makeTask()], null, 1) as string;
    const padded = code + '='.repeat((4 - (code.length % 4)) % 4);
    expect(padded.length % 4).toBe(0);
    expect(decodeShare(padded)).toEqual(decodeShare(code));
  });

  it('rejects malformed codes', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('   ')).toBeNull();
    expect(decodeShare('not base64!!')).toBeNull();
    expect(decodeShare('abc')).toBeNull();
    expect(decodeShare('a')).toBeNull();
    expect(decodeShare('-w')).toBeNull(); // 0xff is not valid UTF-8
    expect(decodeShare(toCode('not json at all'))).toBeNull();
    expect(decodeShare(toCode('[1,2,3]'))).toBeNull();
    expect(decodeShare(toCode('null'))).toBeNull();
    expect(decodeShare(toCode('"text"'))).toBeNull();
  });

  it('rejects the wrong version', () => {
    const body = { v: 2, list: null, tasks: [], sharedAt: 1 };
    expect(decodeShare(toCode(JSON.stringify(body)))).toBeNull();
    expect(decodeShare(toCode(JSON.stringify({ ...body, v: '1' })))).toBeNull();
    expect(decodeShare(toCode(JSON.stringify({ ...body, v: 1 })))).toEqual({
      v: 1,
      list: null,
      tasks: [],
      sharedAt: 1,
    });
  });

  it('rejects tampered shapes', () => {
    const good = {
      v: 1,
      list: 'Home',
      sharedAt: 1,
      tasks: [
        {
          id: 't1',
          title: 'Water plants',
          due: '2026-11-26',
          done: false,
          notes: '',
          pinned: false,
          list: 'Home',
          tags: ['garden'],
          priority: 1,
          subtasks: [{ id: 's1', title: 'Fill can', done: true }],
          evening: false,
        },
      ],
    };
    const tampered = (patch: (snapshot: typeof good) => unknown) =>
      decodeShare(toCode(JSON.stringify(patch(structuredClone(good)) as object)));

    expect(decodeShare(toCode(JSON.stringify(good)))).not.toBeNull();
    expect(decodeShare(toCode(JSON.stringify({ ...good, tasks: 'nope' })))).toBeNull();
    expect(decodeShare(toCode(JSON.stringify({ ...good, tasks: undefined })))).toBeNull();
    expect(decodeShare(toCode(JSON.stringify({ ...good, sharedAt: 'now' })))).toBeNull();
    expect(decodeShare(toCode(JSON.stringify({ ...good, list: 7 })))).toBeNull();
    expect(tampered((s) => ({ ...s, tasks: [{ ...s.tasks[0], title: 5 }] }))).toBeNull();
    expect(tampered((s) => ({ ...s, tasks: [{ ...s.tasks[0], priority: 9 }] }))).toBeNull();
    expect(tampered((s) => ({ ...s, tasks: [{ ...s.tasks[0], tags: [1] }] }))).toBeNull();
    expect(tampered((s) => ({ ...s, tasks: [{ ...s.tasks[0], evening: 'yes' }] }))).toBeNull();
    expect(
      tampered((s) => ({ ...s, tasks: [{ ...s.tasks[0], subtasks: [{ id: 's1', title: 2, done: false }] }] })),
    ).toBeNull();
    expect(tampered((s) => ({ ...s, tasks: [{ ...s.tasks[0], id: undefined }] }))).toBeNull();
  });
});

describe('shareHref', () => {
  it('builds a hash link under a base path', () => {
    expect(shareHref('/telos', 'abc123')).toBe('/telos#share=abc123');
  });

  it('builds a hash-only link at the site root', () => {
    expect(shareHref('', 'abc123')).toBe('#share=abc123');
  });
});

describe('readShareFromHash', () => {
  it('reads the share code', () => {
    expect(readShareFromHash('#share=abc123')).toBe('abc123');
    expect(readShareFromHash('#share=abc-_123')).toBe('abc-_123');
    expect(readShareFromHash('#foo=1&share=abc123')).toBe('abc123');
    expect(readShareFromHash('share=abc123')).toBe('abc123');
    expect(readShareFromHash(shareHref('/telos', 'abc123'))).toBe('abc123');
  });

  it('returns null without the key', () => {
    expect(readShareFromHash('')).toBeNull();
    expect(readShareFromHash('#')).toBeNull();
    expect(readShareFromHash('#other=1')).toBeNull();
    expect(readShareFromHash('#share=')).toBeNull();
    expect(readShareFromHash('#share')).toBeNull();
  });

  it('roundtrips with encodeShare', () => {
    const code = encodeShare([makeTask()], null, 7) as string;
    expect(readShareFromHash(shareHref('', code))).toBe(code);
    expect(decodeShare(readShareFromHash(shareHref('/telos', code)) as string)).not.toBeNull();
  });
});
