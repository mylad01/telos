-- Telos task sync on Supabase (free tier): one table, row-level security per
-- user, and a server clock the browser sync cursor can trust.
--
-- Apply this file wherever the table should exist:
--   hosted  -> Supabase dashboard > SQL Editor > paste and run
--   local   -> `supabase db reset` (the CLI runs every file in this folder)
-- Safe to run more than once.

create table if not exists public.tasks (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  id          text        not null,
  title       text        not null check (char_length(title) between 1 and 500),
  due         date        not null,
  done        boolean     not null default false,
  created_at  bigint      not null,
  completed_at bigint,
  repeat_rule text        not null default 'none' check (repeat_rule in ('none', 'daily', 'weekly')),
  series_id   text,
  previous_id text,
  updated_at  bigint      not null,
  deleted_at  bigint,
  -- Server-assigned write clock in epoch milliseconds. The client asks for
  -- rows with synced_at > its last cursor, so device clocks never matter.
  synced_at   bigint      not null default 0,
  primary key (user_id, id)
);

create index if not exists tasks_user_synced_idx on public.tasks (user_id, synced_at);

-- Every insert and update gets the server's clock, whatever the client sent.
-- An update carrying an older (or equal) updated_at is dropped, so a device
-- that wakes up late with stale edits cannot overwrite a newer one — the same
-- last-write-wins rule `src/server/store-json.ts` applies server-side.
create or replace function public.telos_touch()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at <= old.updated_at then
    return null;
  end if;
  new.synced_at := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  return new;
end;
$$;

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch
  before insert or update on public.tasks
  for each row execute function public.telos_touch();

-- Isolation: a signed-in user only ever sees and writes their own rows. The
-- `with check` clause also makes user_id impossible to rewrite through an
-- update, so a stolen task id still cannot leak another account's list.
alter table public.tasks enable row level security;

drop policy if exists tasks_owner on public.tasks;
create policy tasks_owner on public.tasks
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;
