import {
  DEFAULT_LIST,
  parseTags,
  SUBTASKS_MAX,
  type Priority,
  type Repeat,
  type Task,
} from './tasks';

export type Template = {
  id: string;
  name: string;
  title?: string;
  list: string;
  tags: string[];
  priority: Priority;
  repeat: Repeat;
  subtasks: string[];
  createdAt: number;
};

export const TEMPLATES_MAX = 20;
export const TEMPLATES_KEY = 'telos.templates.v1';

const NAME_MAX = 40;
const TITLE_MAX = 500;
const SUBTASK_MAX = 140;
const REPEATS: Repeat[] = ['none', 'daily', 'weekly', 'monthly'];

function newTemplateId(): string {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function cleanName(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, NAME_MAX) : '';
}

function cleanTitle(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, TITLE_MAX) : '';
}

function cleanSubtasks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const titles: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const title = item.trim().slice(0, SUBTASK_MAX);
    if (!title) continue;
    titles.push(title);
    if (titles.length === SUBTASKS_MAX) break;
  }
  return titles;
}

/** Keeps a task's shape and drops everything that must start fresh. */
export function saveTemplate(name: string, from: Task): Template {
  const title = cleanTitle(from.title);
  return {
    id: newTemplateId(),
    name: cleanName(name) || title.slice(0, NAME_MAX) || 'Template',
    ...(title ? { title } : {}),
    list: from.list,
    tags: [...from.tags],
    priority: from.priority,
    repeat: from.repeat,
    subtasks: cleanSubtasks(from.subtasks.map((subtask) => subtask.title)),
    createdAt: Date.now(),
  };
}

export function applyTemplate(template: Template, due: string, id: string, now: number): Task {
  return {
    id,
    title: template.title?.trim() || template.name,
    due,
    done: false,
    createdAt: now,
    completedAt: null,
    repeat: template.repeat,
    seriesId: null,
    previousId: null,
    updatedAt: now,
    deletedAt: null,
    notes: '',
    pinned: false,
    remindAt: null,
    list: template.list,
    tags: [...template.tags],
    priority: template.priority,
    start: null,
    subtasks: template.subtasks.map((title, index) => ({
      id: `${id}:${index}`,
      title,
      done: false,
    })),
    evening: false,
    order: null,
  };
}

export function parseTemplates(stored: unknown): Template[] {
  let value = stored;
  if (typeof stored === 'string') {
    try {
      value = JSON.parse(stored);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];

  const templates: Template[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const entry = item as Record<string, unknown>;
    const name = cleanName(entry.name);
    if (!name) continue;

    const title = cleanTitle(entry.title);
    const list = cleanName(entry.list) || DEFAULT_LIST;
    templates.push({
      id: typeof entry.id === 'string' && entry.id ? entry.id : newTemplateId(),
      name,
      ...(title ? { title } : {}),
      list,
      tags: parseTags(entry.tags),
      priority: [1, 2, 3].includes(entry.priority as number) ? (entry.priority as Priority) : 0,
      repeat: REPEATS.includes(entry.repeat as Repeat) ? (entry.repeat as Repeat) : 'none',
      subtasks: cleanSubtasks(entry.subtasks),
      createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : 0,
    });
    if (templates.length === TEMPLATES_MAX) break;
  }
  return templates;
}

export function loadTemplates(): Template[] {
  try {
    return parseTemplates(window.localStorage.getItem(TEMPLATES_KEY));
  } catch {
    return [];
  }
}

export function saveTemplates(templates: Template[]): boolean {
  try {
    window.localStorage.setItem(
      TEMPLATES_KEY,
      JSON.stringify(templates.slice(0, TEMPLATES_MAX)),
    );
    return true;
  } catch {
    return false;
  }
}
