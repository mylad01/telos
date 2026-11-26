import { describe, expect, it } from 'vitest';
import {
  applyTemplate,
  parseTemplates,
  saveTemplate,
  TEMPLATES_MAX,
  type Template,
} from './templates';
import type { Task } from './tasks';

function make(overrides: Partial<Task> = {}): Task {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'Weekly shop',
    due: '2026-11-26',
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

describe('saveTemplate', () => {
  it('copies only the fields a template keeps', () => {
    const task = make({
      title: 'Buy milk',
      list: 'Groceries',
      tags: ['errand'],
      priority: 2,
      repeat: 'weekly',
      subtasks: [
        { id: 's1', title: 'Milk', done: true },
        { id: 's2', title: 'Bread', done: false },
      ],
      notes: 'secret note',
      due: '2026-12-01',
      done: true,
      completedAt: 9,
    });

    const template = saveTemplate('Shopping run', task);

    expect(Object.keys(template).sort()).toEqual([
      'createdAt',
      'id',
      'list',
      'name',
      'priority',
      'repeat',
      'subtasks',
      'tags',
      'title',
    ]);
    expect(template.name).toBe('Shopping run');
    expect(template.title).toBe('Buy milk');
    expect(template.list).toBe('Groceries');
    expect(template.tags).toEqual(['errand']);
    expect(template.priority).toBe(2);
    expect(template.repeat).toBe('weekly');
    expect(template.subtasks).toEqual(['Milk', 'Bread']);
    expect(template.tags).not.toBe(task.tags);
  });

  it('falls back to the task title when the name is blank', () => {
    const template = saveTemplate('   ', make({ title: 'Call the dentist' }));
    expect(template.name).toBe('Call the dentist');
    expect(template.title).toBe('Call the dentist');
  });

  it('leaves the title out when the task has none', () => {
    const template = saveTemplate('Reading', make({ title: '  ' }));
    expect(template).not.toHaveProperty('title');
    expect(applyTemplate(template, '2026-12-02', 't_new', 5).title).toBe('Reading');
  });
});

describe('applyTemplate', () => {
  it('builds a fresh task with the provided id and due date', () => {
    const template = saveTemplate(
      'Shopping run',
      make({
        title: 'Buy milk',
        list: 'Groceries',
        tags: ['errand'],
        priority: 2,
        repeat: 'weekly',
        subtasks: [
          { id: 's1', title: 'Milk', done: true },
          { id: 's2', title: 'Bread', done: false },
        ],
      }),
    );

    const task = applyTemplate(template, '2026-12-01', 't_new', 5_000);

    expect(task.id).toBe('t_new');
    expect(task.id).not.toBe(template.id);
    expect(task.due).toBe('2026-12-01');
    expect(task.createdAt).toBe(5_000);
    expect(task.updatedAt).toBe(5_000);
    expect(task.done).toBe(false);
    expect(task.completedAt).toBeNull();
    expect(task.deletedAt).toBeNull();
    expect(task.title).toBe('Buy milk');
    expect(task.list).toBe('Groceries');
    expect(task.tags).toEqual(['errand']);
    expect(task.priority).toBe(2);
    expect(task.repeat).toBe('weekly');
    expect(task.subtasks).toEqual([
      { id: 't_new:0', title: 'Milk', done: false },
      { id: 't_new:1', title: 'Bread', done: false },
    ]);
    expect(task.tags).not.toBe(template.tags);
  });
});

describe('parseTemplates', () => {
  it('round-trips a saved template through JSON', () => {
    const template = saveTemplate('Shopping run', make({ subtasks: [{ id: 's', title: 'Milk', done: false }] }));
    const parsed = parseTemplates(JSON.stringify([template]));
    expect(parsed).toEqual([template]);
  });

  it('turns corrupt or non-array input into an empty list', () => {
    expect(parseTemplates('{not json')).toEqual([]);
    expect(parseTemplates('null')).toEqual([]);
    expect(parseTemplates(null)).toEqual([]);
    expect(parseTemplates(undefined)).toEqual([]);
    expect(parseTemplates({ name: 'not an array' })).toEqual([]);
  });

  it('skips unusable entries and defaults invalid fields', () => {
    const parsed = parseTemplates([
      { name: '  ' },
      { name: 'Alpha', repeat: 'hourly', priority: 9, tags: 'not a list', list: '' },
      42,
      null,
      { name: 'Beta', createdAt: 7 },
    ]);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      name: 'Alpha',
      list: 'Inbox',
      tags: [],
      priority: 0,
      repeat: 'none',
      subtasks: [],
      createdAt: 0,
    });
    expect(parsed[1]).toMatchObject({ name: 'Beta', createdAt: 7 });
  });

  it('keeps at most TEMPLATES_MAX templates and drops the tail', () => {
    const stored: Partial<Template>[] = Array.from({ length: TEMPLATES_MAX + 5 }, (_, index) => ({
      name: `Template ${index}`,
      createdAt: index,
    }));

    const parsed = parseTemplates(stored);

    expect(parsed).toHaveLength(TEMPLATES_MAX);
    expect(parsed[0].name).toBe('Template 0');
    expect(parsed[TEMPLATES_MAX - 1].name).toBe(`Template ${TEMPLATES_MAX - 1}`);
  });
});
