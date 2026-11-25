# Telos

A quiet, phone-first to-do list in warm paper tones. Tasks, due dates, repeats
and completion state live in the browser's `localStorage` first; optional sync
keeps the same list on every device.

- Add a task with a due date; choose Once, Daily or Weekly.
- Tick a repeating task and the next occurrence appears on the next date.
- Move any task to Today, Tomorrow or Next week with one tap.
- Undo a delete from the toast (8 seconds) instead of confirming.
- Today, This week, All and Done views, with live counts.
- Optional sign-in syncs the list across devices; it works offline and merges
  last-write-wins.
- Export the list as JSON, or import one back.

## Two ways to run it

The same codebase runs with or without a server. Which one you get is decided at
build time, from whether Supabase settings are present — see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the diagrams and the full design,
[docs/adr/0001](docs/adr/0001-github-pages-with-supabase.md) for why it is built
this way, and [docs/LAUNCH.md](docs/LAUNCH.md) for the step-by-step launch plan
(Supabase project, proving sync, publishing, rollback).

| | Self-hosted | Free on GitHub Pages |
|---|---|---|
| Accounts and data | this app's server, `.data/` | Supabase (Auth + Postgres) |
| Needs | Node and a writable disk | a Supabase free project |
| Sync code | same `useSync`, same merge rules | same `useSync`, same merge rules |

### Self-hosted

```bash
npm install
npm run dev              # http://localhost:3000
npm run build && npm start
```

Accounts and tasks are kept in `.data/`, created on first use and gitignored; the
directory must be writable. The default store is `.data/telos.json`;
`TELOS_STORE=sqlite` uses `.data/telos.db` (Node's built-in `node:sqlite`) with
the same API. Copy an existing JSON store over with `npm run store:backfill`,
which is safe to repeat. `TELOS_SECRET` signs sessions; without it a secret is
generated in `.data/secret`.

### Free on GitHub Pages, with a shared list

The page is static, so it cannot run this app's server. Sync instead goes to
Supabase, and the two settings below are baked into the public bundle — which is
why only the anon key is used, and why row-level security is the entire access
rule.

1. Create a free project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Open **SQL Editor**, paste `supabase/migrations/20261125100000_telos_tasks.sql`,
   and run it. That file creates the table, the trigger and the policy.
3. Under **Project Settings → API** copy the **Project URL** and the **anon /
   publishable key**.
4. In your GitHub repository: **Settings → Secrets and variables → Actions →
   Variables** and add `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
5. Push to `master`. `.github/workflows/pages.yml` builds and publishes
   `https://<user>.github.io/<repo>/`.

Without those two variables the site still deploys, as a local-only list that
moves between devices with **Export JSON / Import JSON**. On a static build the
sync flag is decided by those settings alone (`next.config.mjs`): keys present
means sync on, absent means off — so `NEXT_PUBLIC_TELOS_SYNC=0` in the
`build:static` script is overridden when they are present. Self-hosted builds
still honour `NEXT_PUBLIC_TELOS_SYNC=0` to hide the panel.

By default Supabase asks new accounts to confirm their email before signing in.
For a personal instance you can turn that off under **Authentication → Sign In /
Providers → Email → Confirm email**; otherwise the panel says to check your inbox.

Cost: GitHub Pages is free on a public repository, and Supabase free covers
500 MB, 50,000 monthly active users and unlimited API requests. A free Supabase
project pauses itself after a week with no activity — open the dashboard and
resume it if sync ever stops. A visual task is tiny, so the storage limit is not
close.

### Local Supabase (optional, for development)

```bash
supabase start          # Docker; prints the local URL and keys
supabase db reset       # applies supabase/migrations/*.sql
npm run build:static    # honours NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY if set
```

Run the app against the local stack with

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key> \
npm run dev
```

## Checks

```bash
npm test                 # vitest: units, row mapping, sync contract on both stores
npm run typecheck
npm run check:messages   # catalog ICU syntax and arguments
```

## Structure

- `app/layout.tsx`, `app/page.tsx` — the single page and its fonts
- `app/api/auth/route.ts`, `app/api/sync/route.ts` — self-hosted sign-in and sync
- `app/globals.css` — design tokens and all component styles
- `src/components/` — `TaskApp` (state), `Composer`, `TaskRow`, `SyncPanel`
- `src/lib/` — task type and merge rules, storage, sync hook, backup, dates
- `src/lib/backend-select.ts` — picks the backend at build time
- `src/lib/http-backend.ts` — self-hosted backend (`/api/auth`, `/api/sync`)
- `src/lib/supabase/` — browser backend: REST calls (`client.ts`), row mapping,
  cursor and token expiry (`map.ts`)
- `src/server/` — JSON and SQLite stores behind one contract, passwords and
  session cookies; `src/server/*.test.ts` runs the same sync contract on both
- `supabase/migrations/` — table, RLS policy and write trigger for the hosted lists
- `src/i18n/request.ts` — next-intl request config (single locale)
- `messages/en.json` — the only place user-visible copy lives

## Picking this up later

Everything an assistant or a new contributor needs is in three places:
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (components, data flow, sync
protocol, failure modes, "where to change what"), the ADR (why, and what was
rejected), and the tests, which pin the merge rules, the cursor arithmetic and
the row mapping. The invariants most easily broken by accident:

- tasks are last-write-wins on `updated_at`; the database enforces it, so do not
  remove that clause from the trigger;
- `synced_at` is the server's clock and never the client's;
- the anon key is public, so any new table needs RLS enabled and a policy before
  it is exposed through the API.

## Adding a language

The UI is English only, but every string is already in ICU messages, so a second
language is mostly catalog work: add `messages/<locale>.json`, add the locale to
`scripts/check-messages.mjs`, and choose the locale in `src/i18n/request.ts`
(e.g. from a cookie). Use `dir="rtl"` on `<html>` if the script is right-to-left;
the stylesheet already uses logical properties.
