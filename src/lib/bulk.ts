import { addDays, addMonths, daysFromToday, toISODate } from './dates';
import { parseQuickAdd } from './quick-add';
import { normalizeTag, TAGS_MAX, type Task } from './tasks';

export type BulkKind =
  | 'move'
  | 'complete'
  | 'untag'
  | 'tag'
  | 'clearDone'
  | 'shift'
  | 'deleteBefore'
  | 'completeOverdue';

export type BulkCommand = {
  kind: BulkKind;
  list?: string;
  tag?: string;
  to?: string;
  days?: number;
  before?: string;
  text: string;
};

export type BulkResult = { tasks: Task[]; changed: number; summary: string };

function clean(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function amount(word: string): number {
  const lower = word.toLowerCase();
  if (lower === 'a' || lower === 'an' || lower === 'one') return 1;
  return Number(lower);
}

function spanDays(word: string): number {
  return word.toLowerCase().startsWith('w') ? 7 : 1;
}

function shiftList(raw: string): string | undefined {
  const list = raw.trim();
  return /^(?:all|everything)$/i.test(list) ? undefined : list;
}

/**
 * The nearest occurrence of a parsed date. Quick add reads dates as "the
 * coming one", but a cutoff like "before 1 nov" usually means the one just
 * gone, so a date more than half a year ahead is read as last year's.
 */
function nearestYear(date: string, today: string): string {
  const previous = addMonths(date, -12);
  const forward = Math.abs(daysFromToday(date, today));
  const backward = Math.abs(daysFromToday(previous, today));
  return backward < forward ? previous : date;
}

/**
 * Parses a whole phrase as a single date, reusing quick add so digits, month
 * names and ISO dates all behave the same. Anything left over in the title
 * means the phrase was not purely a date, and is refused.
 */
function parseDatePhrase(raw: string, today: string): string | null {
  const fragment = clean(raw);
  if (!fragment) return null;
  const parsed = parseQuickAdd(`${fragment} cutoff`, today);
  if (!parsed.due || parsed.title !== 'cutoff' || parsed.repeat !== null) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(fragment) ? parsed.due : nearestYear(parsed.due, today);
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

  const shiftBy = /^(?:push|move|shift)\s+(.+?)\s+by\s+(a|an|one|\d+)\s+(days?|weeks?)$/i.exec(text);
  const shiftBare = /^(?:push|move|shift)\s+(.+?)\s+(a|an|one|\d+)\s+(days?|weeks?)$/i.exec(text);
  const shiftNoListBy = /^(?:push|move|shift)\s+by\s+(a|an|one|\d+)\s+(days?|weeks?)$/i.exec(text);
  const shiftNoList = /^(?:push|move|shift)\s+(a|an|one|\d+)\s+(days?|weeks?)$/i.exec(text);
  const shift = shiftBy ?? shiftNoListBy ?? shiftBare ?? shiftNoList;
  if (shift) {
    const withList = shift === shiftBy || shift === shiftBare;
    const count = withList ? shift[2] : shift[1];
    const unit = withList ? shift[3] : shift[2];
    const days = amount(count) * spanDays(unit);
    if (!Number.isFinite(days) || days <= 0) return null;
    const list = withList ? shiftList(shift[1]) : undefined;
    return list ? { kind: 'shift', list, days, text } : { kind: 'shift', days, text };
  }

  const deleteBefore = /^delete\s+(?:completed|done|finished)\s+before\s+(.+)$/i.exec(text);
  if (deleteBefore) {
    const before = parseDatePhrase(deleteBefore[1], today);
    if (!before) return null;
    return { kind: 'deleteBefore', before, text };
  }

  if (/^complete\s+(?:all\s+)?overdue(?:\s+tasks)?$/i.test(text)) {
    return { kind: 'completeOverdue', text };
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

  if (command.kind === 'shift') {
    const days = command.days ?? 0;
    let changed = 0;
    const next = tasks.map((task) => {
      if (!isLive(task) || task.done || !inList(task, command.list)) return task;
      const due = addDays(task.due, days);
      const start = task.start === null ? null : addDays(task.start, days);
      if (due === task.due && start === task.start) return task;
      changed += 1;
      return { ...task, due, start, updatedAt: now };
    });
    return {
      tasks: changed === 0 ? tasks : next,
      changed,
      summary:
        changed === 0
          ? 'Nothing to shift'
          : `Shifted ${plural(changed, 'task', 'tasks')} by ${plural(days, 'day', 'days')}`,
    };
  }

  if (command.kind === 'deleteBefore') {
    const before = command.before ?? '';
    let changed = 0;
    const next = tasks.map((task) => {
      if (!isLive(task) || !task.done || task.completedAt === null) return task;
      if (toISODate(new Date(task.completedAt)) >= before) return task;
      changed += 1;
      return { ...task, deletedAt: now, updatedAt: now };
    });
    return {
      tasks: changed === 0 ? tasks : next,
      changed,
      summary:
        changed === 0
          ? 'Nothing to delete'
          : `Deleted ${plural(changed, 'completed task', 'completed tasks')} before ${before}`,
    };
  }

  if (command.kind === 'completeOverdue') {
    let changed = 0;
    const next = tasks.map((task) => {
      if (!isLive(task) || task.done || task.due >= today) return task;
      changed += 1;
      return { ...task, done: true, completedAt: now, updatedAt: now };
    });
    return {
      tasks: changed === 0 ? tasks : next,
      changed,
      summary:
        changed === 0 ? 'Nothing overdue' : `Completed ${plural(changed, 'overdue task', 'overdue tasks')}`,
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
