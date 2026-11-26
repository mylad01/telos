-- Adds the fields the 0.3 line of the app uses: a free-text note, a pin flag and
-- a per-task reminder time, plus monthly repeats.
-- Run once in the Supabase SQL editor after 20261125100000_telos_tasks.sql.

alter table public.tasks add column if not exists notes text not null default '';
alter table public.tasks add column if not exists pinned boolean not null default false;
alter table public.tasks add column if not exists remind_at text;

alter table public.tasks drop constraint if exists tasks_repeat_rule_check;
alter table public.tasks
  add constraint tasks_repeat_rule_check
  check (repeat_rule in ('none', 'daily', 'weekly', 'monthly'));

alter table public.tasks
  add constraint tasks_remind_at_format
  check (remind_at is null or remind_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
