-- Theme preference per account. Only a preset slug is stored, never tokens:
-- the presets themselves ship in the app bundle, so a new preset needs no
-- migration and an old row never pins someone to a deleted theme.

create table if not exists public.telos_prefs (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  preset_id text not null check (preset_id ~ '^[a-z0-9-]{1,40}$'),
  updated_at timestamptz not null default now()
);

alter table public.telos_prefs enable row level security;

drop policy if exists "prefs read own" on public.telos_prefs;
create policy "prefs read own"
  on public.telos_prefs for select
  using (auth.uid() = user_id);

drop policy if exists "prefs insert own" on public.telos_prefs;
create policy "prefs insert own"
  on public.telos_prefs for insert
  with check (auth.uid() = user_id);

drop policy if exists "prefs update own" on public.telos_prefs;
create policy "prefs update own"
  on public.telos_prefs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- The client upserts `on conflict (user_id) do update`; stamping here keeps the
-- timestamp authoritative even if a device clock is wrong.
create or replace function public.telos_touch_prefs()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists telos_prefs_touch on public.telos_prefs;
create trigger telos_prefs_touch
  before insert or update on public.telos_prefs
  for each row execute function public.telos_touch_prefs();

grant select, insert, update on public.telos_prefs to authenticated;
