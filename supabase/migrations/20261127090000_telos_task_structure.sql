-- Phase B of docs/FEATURES.md: lists, tags, priority, start dates and sub-tasks.
-- Run once in the Supabase SQL editor after 20261126100000_telos_task_extras.sql.

alter table public.tasks add column if not exists list text not null default 'Inbox';
alter table public.tasks add column if not exists tags text[] not null default '{}';
alter table public.tasks add column if not exists priority smallint not null default 0;
alter table public.tasks add column if not exists start_date date;
alter table public.tasks add column if not exists subtasks jsonb not null default '[]'::jsonb;

alter table public.tasks
  add constraint tasks_priority_range check (priority between 0 and 3);
