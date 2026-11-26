import { addDays } from './dates';
import { normalizeTag, TAGS_MAX, type Task } from './tasks';

export type BulkKind = 'move' | 'complete' | 'untag' | 'tag' | 'clearDone';

export type BulkCommand = {
  kind: BulkKind;
  list?: string;
  tag?: string;
  to?: string;
  text: string;
};

export type BulkResult = { tasks: Task[]; changed: number; summary: string };

function clean(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export function parseBulk(input: string, today: string): BulkCommand | null {
  const text = clean(input);
  if (!text) return null;

  if (/^clear\s+(?:done|completed|finished)$/i.test(text)) {
    return { kind: 'clearDone', text };
  }

  const move = /^move\s+(.+?)\s+to\s+(next\s+week|tomorrow|today)$/i.exec(text);
  if (move) {
    const when = clean(move[2]).toLowerCase();
    const to =
      when === 'next week' ? addDays(today, 7) : when === 'tomorrow' ? addDays(today, 1) : today;
    const list = move[1].trim();
    if (!list) return null;
    return { kind: 'move', list, to, text };
  }

  if (/^complete\s+all\s+today$/i.test(text)) {
    return { kind: 'complete', to: today, text };
  }

  const complete = /^complete\s+(.+)$/i.exec(text);
  if (complete) {
    const list = complete[1].trim();
    if (!list) return null;
    return { kind: 'complete', list, text };
  }

  const untag = /^untag\s+(.+)$/i.exec(text);
  if (untag) {
    const tag = normalizeTag(untag[1]);
    if (!tag) return null;
    return { kind: 'untag', tag, text };
  }

  const tag = /^tag\s+(.+)$/i.exec(text);
  if (tag) {
    const value = normalizeTag(tag[1]);
    if (!value) return null;
    return { kind: 'tag', tag: value, text };
  }

  return null;
}

function inList(task: Task, list: string | undefined): boolean {
  if (!list || list.toLowerCase() === 'all') return true;
  return task.list.toLowerCase() === list.toLowerCase();
}

function isLive(task: Task): boolean {
  return task.deletedAt === null;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function applyBulk(
  tasks: Task[],
  command: BulkCommand,
  today: string,
  now = 0,
): BulkResult {
  if (command.kind === 'clearDone') {
    let changed = 0;
    const next = tasks.map((task) => {
      if (!isLive(task) || !task.done) return task;
      changed += 1;
      return { ...task, deletedAt: now, updatedAt: now };
    });
    return {
      tasks: changed === 0 ? tasks : next,
      changed,
      summary:
        changed === 0
          ? 'Nothing to clear'
          : `Cleared ${plural(changed, 'done task', 'done tasks')}`,
    };
  }

  if (command.kind === 'move') {
    const to = command.to ?? today;
    let changed = 0;
    const next = tasks.map((task) => {
      if (!isLive(task) || task.done || !inList(task, command.list) || task.due === to) {
        return task;
      }
      changed += 1;
      return { ...task, due: to, updatedAt: now };
    });
    return {
      tasks: changed === 0 ? tasks : next,
      changed,
      summary: changed === 0 ? 'Nothing to move' : `Moved ${plural(changed, 'task', 'tasks')} to ${to}`,
    };
  }

  if (command.kind === 'complete') {
    const to = command.to;
    let changed = 0;
    const next = tasks.map((task) => {
      if (!isLive(task) || task.done || !inList(task, command.list)) return task;
      if (to !== undefined && task.due !== to) return task;
      changed += 1;
      return { ...task, done: true, completedAt: now, updatedAt: now };
    });
    return {
      tasks: changed === 0 ? tasks : next,
      changed,
      summary: changed === 0 ? 'Nothing to complete' : `Completed ${plural(changed, 'task', 'tasks')}`,
    };
  }

  const tag = command.tag ?? '';
  let changed = 0;
  const next = tasks.map((task) => {
    if (!isLive(task)) return task;
    if (command.kind === 'tag') {
      if (task.tags.includes(tag) || task.tags.length >= TAGS_MAX) return task;
      changed += 1;
      return { ...task, tags: [...task.tags, tag], updatedAt: now };
    }
    if (!task.tags.includes(tag)) return task;
    changed += 1;
    return { ...task, tags: task.tags.filter((item) => item !== tag), updatedAt: now };
  });
  return {
    tasks: changed === 0 ? tasks : next,
    changed,
    summary:
      changed === 0
        ? command.kind === 'tag'
          ? 'Nothing to tag'
          : `No task had #${tag}`
        : command.kind === 'tag'
          ? `Tagged ${plural(changed, 'task', 'tasks')} with #${tag}`
          : `Removed #${tag} from ${plural(changed, 'task', 'tasks')}`,
  };
}
