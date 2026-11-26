import { describe, expect, it } from 'vitest';
import type { Task } from '@/lib/tasks';
import type { Store } from './store-types';

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'a',
    title: 'Task',
    due: '2026-11-25',
    done: false,
    createdAt: 1,
    completedAt: null,
    repeat: 'none',
    seriesId: null,
    previousId: null,
    updatedAt: 1,
    deletedAt: null,
    notes: '',
    pinned: false,
    remindAt: null,
    list: 'Inbox',
    tags: [],
    priority: 0,
    start: null,
    subtasks: [],
    evening: false,
    ...overrides,
  };
}

/** The behaviour every backend must share; a new backend only adds a loader. */
export function runStoreContract(backend: string, load: () => Promise<Store>): void {
  describe(`${backend}: accounts`, () => {
    it('creates an account once and verifies the password', async () => {
      const store = await load();
      expect(await store.createAccount('contract-a@example.com', 'correct horse')).toBe('ok');
      expect(await store.createAccount('contract-a@example.com', 'other')).toBe('exists');
      expect(await store.verifyAccount('contract-a@example.com', 'correct horse')).toBe(true);
      expect(await store.verifyAccount('contract-a@example.com', 'wrong')).toBe(false);
      expect(await store.verifyAccount('nobody@example.com', 'x')).toBe(false);
    });
  });

  describe(`${backend}: syncTasks`, () => {
    it('returns null for an unknown account', async () => {
      const store = await load();
      expect(await store.syncTasks('ghost@example.com', 0, [makeTask()])).toBeNull();
    });

    it('hands every task back once and then only what changed', async () => {
      const store = await load();
      await store.createAccount('contract-b@example.com', 'pw');
      const first = await store.syncTasks('contract-b@example.com', 0, [
        makeTask({ id: 'a' }),
        makeTask({ id: 'b' }),
      ]);
      expect(first?.tasks.map((task) => task.id).sort()).toEqual(['a', 'b']);
      expect(first?.now).toBe(2);

      const unchanged = await store.syncTasks('contract-b@example.com', first!.now, []);
      expect(unchanged).toEqual({ tasks: [], now: 2 });

      const second = await store.syncTasks('contract-b@example.com', first!.now, [
        makeTask({ id: 'a', title: 'renamed', updatedAt: 5 }),
        makeTask({ id: 'c', updatedAt: 5 }),
      ]);
      expect(second?.tasks.map((task) => task.id).sort()).toEqual(['a', 'c']);
      expect(second?.now).toBe(4);
    });

    it('ignores an upload older than what the server holds', async () => {
      const store = await load();
      const result = await store.syncTasks('contract-b@example.com', 0, [
        makeTask({ id: 'a', title: 'stale edit', updatedAt: 1 }),
      ]);
      expect(result?.tasks.find((task) => task.id === 'a')?.title).toBe('renamed');
    });

    it('keeps deletes as tombstones so other devices see them', async () => {
      const store = await load();
      const result = await store.syncTasks('contract-b@example.com', 0, [
        makeTask({ id: 'b', deletedAt: 9, updatedAt: 9 }),
      ]);
      expect(result?.tasks.find((task) => task.id === 'b')?.deletedAt).toBe(9);
    });

    it('lists what a session holds and survives a reload', async () => {
      const store = await load();
      expect((await store.listTasks('contract-b@example.com'))?.map((t) => t.id).sort()).toEqual([
        'a',
        'b',
        'c',
      ]);
      const reloaded = await load();
      expect((await reloaded.listTasks('contract-b@example.com'))?.map((t) => t.id).sort()).toEqual([
        'a',
        'b',
        'c',
      ]);
      expect(await reloaded.verifyAccount('contract-b@example.com', 'pw')).toBe(true);
    });

    it('keeps accounts isolated from each other', async () => {
      const store = await load();
      await store.createAccount('contract-c@example.com', 'pw');
      expect(await store.listTasks('contract-c@example.com')).toEqual([]);
    });
  });
}
