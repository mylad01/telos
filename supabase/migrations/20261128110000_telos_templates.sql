-- Phase D of docs/FEATURES.md: templates that follow the account between
-- devices, and the reminder queue the `remind` Edge Function drains.
--
-- Run in the Supabase SQL editor after 20261128100000_telos_share.sql.
-- Safe to run more than once: tables and policies are created only when missing.

-- One row per template. `payload` is the client's whole Template object
-- (src/lib/templates.ts), so the app can keep one parser for local and synced
-- copies; only name and id are duplicated for listing without parsing.
create table if not exists public.template (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  id         text        not null,
  name       text        not null check (char_length(name) between 1 and 40),
  payload    jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.template enable row level security;

drop policy if exists template_owner on public.template;
create policy template_owner on public.template
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.template from anon;
grant select, insert, update, delete on public.template to authenticated;

-- The push queue. The browser inserts a row when a task with `remind_at` comes
-- due; the Edge Function (service role) claims rows with `fire_at <= now()`.
-- Times are timestamptz because the sender runs on the server clock, unlike the
-- client-owned `tasks` timestamps.
create table if not exists public.telos_reminders (
  id         bigint      generated always as identity primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  task_id    text        not null,
  fire_at    timestamptz not null,
  sent       boolean     not null default false,
  created_at timestamptz not null default now()
);

-- The sender only ever asks for unsent rows, oldest first.
create index if not exists telos_reminders_due_idx
  on public.telos_reminders (fire_at)
  where not sent;

alter table public.telos_reminders enable row level security;

drop policy if exists telos_reminders_owner on public.telos_reminders;
create policy telos_reminders_owner on public.telos_reminders
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.telos_reminders from anon;
grant select, insert, update, delete on public.telos_reminders to authenticated;

-- Where each account's Web Push subscription lives. The function needs it to
-- know which endpoint to call; without it the reminder queue has nowhere to go.
-- One subscription per account (the last device to register wins).
create table if not exists public.telos_push_subscriptions (
  user_id      uuid        primary key references auth.users (id) on delete cascade,
  subscription jsonb       not null,
  updated_at   timestamptz not null default now()
);

alter table public.telos_push_subscriptions enable row level security;

drop policy if exists telos_push_subscriptions_owner on public.telos_push_subscriptions;
create policy telos_push_subscriptions_owner on public.telos_push_subscriptions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.telos_push_subscriptions from anon;
grant select, insert, update, delete on public.telos_push_subscriptions to authenticated;
