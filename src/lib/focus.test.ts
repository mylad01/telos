import { afterEach, describe, expect, it } from 'vitest';
import {
  BREAK_MS,
  FOCUS_MS,
  loadFocus,
  pauseFocus,
  readFocus,
  resumeFocus,
  saveFocus,
  startFocus,
  stopFocus,
  tick,
} from './focus';

const NOW = 1_700_000_000_000;
const KEY = 'telos.focus.v1';

function fakeWindow(store: Map<string, string>, throws = false) {
  return {
    localStorage: {
      getItem: (key: string) => {
        if (throws) throw new Error('blocked');
        return store.get(key) ?? null;
      },
      setItem: (key: string, value: string) => {
        if (throws) throw new Error('blocked');
        store.set(key, value);
      },
    },
  };
}

function started(taskId = 'a', now = NOW) {
  return startFocus(stopFocus(), taskId, now);
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('startFocus', () => {
  it('starts a running focus phase that ends 25 minutes from now', () => {
    const state = started();
    expect(state).toEqual({
      taskId: 'a',
      phase: 'focus',
      endsAt: NOW + FOCUS_MS,
      running: true,
      remainingMs: FOCUS_MS,
      rounds: 0,
    });
  });
});

describe('pauseFocus and resumeFocus', () => {
  it('freezes the remaining time when paused', () => {
    const state = tick(started(), NOW + 60_000);
    const paused = pauseFocus(state, NOW + 60_000);
    expect(paused.running).toBe(false);
    expect(paused.endsAt).toBeNull();
    expect(paused.remainingMs).toBe(FOCUS_MS - 60_000);
  });

  it('restores the frozen remaining time on resume', () => {
    const paused = pauseFocus(tick(started(), NOW + 60_000), NOW + 60_000);
    const resumed = resumeFocus(paused, NOW + 120_000);
    expect(resumed.running).toBe(true);
    expect(resumed.remainingMs).toBe(FOCUS_MS - 60_000);
    expect(resumed.endsAt).toBe(NOW + 120_000 + FOCUS_MS - 60_000);
  });
});

describe('tick', () => {
  it('only updates remaining time mid-way through a phase', () => {
    const state = tick(started(), NOW + 1_000);
    expect(state.remainingMs).toBe(FOCUS_MS - 1_000);
    expect(state.phase).toBe('focus');
    expect(state.rounds).toBe(0);
    expect(state.running).toBe(true);
    expect(state.endsAt).toBe(NOW + FOCUS_MS);
  });

  it('moves to a break and counts the round when focus runs out', () => {
    const end = NOW + FOCUS_MS;
    const state = tick(started(), end);
    expect(state.phase).toBe('break');
    expect(state.running).toBe(true);
    expect(state.rounds).toBe(1);
    expect(state.remainingMs).toBe(BREAK_MS);
    expect(state.endsAt).toBe(end + BREAK_MS);
  });

  it('stops running when the break runs out', () => {
    const breakStart = NOW + FOCUS_MS;
    const onBreak = tick(started(), breakStart);
    const state = tick(onBreak, breakStart + BREAK_MS);
    expect(state.phase).toBe('focus');
    expect(state.running).toBe(false);
    expect(state.endsAt).toBeNull();
    expect(state.remainingMs).toBe(FOCUS_MS);
    expect(state.rounds).toBe(1);
    expect(state.taskId).toBe('a');
  });

  it('leaves a paused timer untouched', () => {
    const paused = pauseFocus(tick(started(), NOW + 1_000), NOW + 1_000);
    expect(tick(paused, NOW + 10 * FOCUS_MS)).toBe(paused);
  });
});

describe('storage', () => {
  it('falls back to a stopped timer for corrupt or missing storage', () => {
    (globalThis as { window?: unknown }).window = fakeWindow(
      new Map([[KEY, '{not json']]),
    );
    expect(loadFocus()).toEqual(stopFocus());
    expect(readFocus({ phase: 'focus', running: 'yes' })).toBeNull();
    expect(readFocus(null)).toBeNull();
    (globalThis as { window?: unknown }).window = fakeWindow(new Map());
    expect(loadFocus()).toEqual(stopFocus());
  });

  it('round-trips a session and survives blocked storage', () => {
    const store = new Map<string, string>();
    (globalThis as { window?: unknown }).window = fakeWindow(store);
    const state = started();
    expect(saveFocus(state)).toBe(true);
    expect(loadFocus()).toEqual(state);
    (globalThis as { window?: unknown }).window = fakeWindow(store, true);
    expect(loadFocus()).toEqual(stopFocus());
    expect(saveFocus(state)).toBe(false);
  });
});
