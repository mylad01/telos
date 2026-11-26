export const FOCUS_MS = 25 * 60_000;
export const BREAK_MS = 5 * 60_000;
export const FOCUS_KEY = 'telos.focus.v1';

export type FocusState = {
  taskId: string | null;
  phase: 'focus' | 'break';
  endsAt: number | null;
  running: boolean;
  remainingMs: number;
  rounds: number;
};

export function stopFocus(): FocusState {
  return {
    taskId: null,
    phase: 'focus',
    endsAt: null,
    running: false,
    remainingMs: FOCUS_MS,
    rounds: 0,
  };
}

export function startFocus(state: FocusState, taskId: string, now: number): FocusState {
  return {
    taskId,
    phase: 'focus',
    endsAt: now + FOCUS_MS,
    running: true,
    remainingMs: FOCUS_MS,
    rounds: state.taskId === taskId ? state.rounds : 0,
  };
}

export function pauseFocus(state: FocusState, now: number): FocusState {
  if (!state.running || state.endsAt === null) return state;
  return {
    ...state,
    endsAt: null,
    running: false,
    remainingMs: Math.max(0, state.endsAt - now),
  };
}

export function resumeFocus(state: FocusState, now: number): FocusState {
  if (state.running || state.taskId === null) return state;
  return {
    ...state,
    endsAt: now + state.remainingMs,
    running: true,
  };
}

export function tick(state: FocusState, now: number): FocusState {
  if (!state.running || state.endsAt === null) return state;
  const remainingMs = state.endsAt - now;
  if (remainingMs > 0) return { ...state, remainingMs };
  if (state.phase === 'focus') {
    return {
      ...state,
      phase: 'break',
      endsAt: now + BREAK_MS,
      remainingMs: BREAK_MS,
      rounds: state.rounds + 1,
    };
  }
  return {
    ...state,
    phase: 'focus',
    endsAt: null,
    running: false,
    remainingMs: FOCUS_MS,
  };
}

export function readFocus(stored: unknown): FocusState | null {
  if (typeof stored !== 'object' || stored === null) return null;
  const value = stored as Record<string, unknown>;
  if (value.taskId !== null && typeof value.taskId !== 'string') return null;
  if (value.phase !== 'focus' && value.phase !== 'break') return null;
  if (typeof value.running !== 'boolean') return null;
  if (
    typeof value.remainingMs !== 'number' ||
    !Number.isFinite(value.remainingMs) ||
    value.remainingMs < 0
  ) {
    return null;
  }
  if (typeof value.rounds !== 'number' || !Number.isInteger(value.rounds) || value.rounds < 0) {
    return null;
  }
  if (
    value.endsAt !== null &&
    (typeof value.endsAt !== 'number' || !Number.isFinite(value.endsAt))
  ) {
    return null;
  }
  if (value.running && value.endsAt === null) return null;
  return {
    taskId: value.taskId,
    phase: value.phase,
    endsAt: value.endsAt,
    running: value.running,
    remainingMs: value.remainingMs,
    rounds: value.rounds,
  };
}

export function loadFocus(): FocusState {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(FOCUS_KEY);
  } catch {
    return stopFocus();
  }
  if (!raw) return stopFocus();
  try {
    return readFocus(JSON.parse(raw)) ?? stopFocus();
  } catch {
    return stopFocus();
  }
}

export function saveFocus(state: FocusState): boolean {
  try {
    window.localStorage.setItem(FOCUS_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
