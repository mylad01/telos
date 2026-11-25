# Launch plan — Telos on GitHub Pages + Supabase

The goal of this launch: a public URL that opens on a phone and a laptop, with one
shared task list behind a sign-in, for zero cost and no server to babysit.

Two moving parts:

| Part | What it does | Cost |
|---|---|---|
| GitHub Pages | serves the static export of this app | free on a public repo |
| Supabase | Postgres table + email/password accounts | free tier |

Nothing else is needed. There is no Node server in production: the browser talks
to Supabase directly, and row-level security is the whole access rule.

---

## Readiness (checked 2026-11-25, before this plan was pushed)

| Check | Command | Result |
|---|---|---|
| Unit + contract tests | `npm test` | 64 passed, 9 files |
| Types | `npm run typecheck` | clean |
| Message catalog | `npm run check:messages` | 86 keys × 1 locale |
| Static export | `npm run build:static` | 5 routes prerendered |
| Sync without a server | `src/lib/supabase/client.ts` + `map.test.ts` | REST-only, contract-tested |

What is *not* proven from here, because it needs your accounts:

- a real Supabase project accepting the migration,
- a real sign-up round trip against it,
- the Pages workflow building with the two repository variables set.

Those are Phase 2 and Phase 3 below. Everything they touch already exists in the
repo; the steps are configuration, not code.

---

## Phase 0 — Before you start (5 minutes)

1. The repo must be **public** for Pages on a free account. `mylad01/telos` is
   already public.
2. Confirm Pages is served from Actions: **Settings → Pages → Build and
   deployment → Source: GitHub Actions**.
3. Decide the sign-in policy: Supabase confirms new emails by default. For a
   personal list, **Authentication → Sign In / Providers → Email → Confirm email
   off** means the first sign-up works instantly. If you leave it on, the sync
   panel tells the person to check their inbox.

---

## Phase 1 — Create the Supabase project (10 minutes)

1. Sign in at <https://supabase.com/dashboard> and **New project**.
   Name, database password and region are yours; pick the region nearest you.
   The free tier gives 500 MB, 50,000 monthly active users and unlimited API
   requests — a task list uses a rounding error of that.
2. Wait for the project to finish provisioning (about two minutes).
3. Open **SQL Editor**, paste the whole of
   [`supabase/migrations/20261125100000_telos_tasks.sql`](../supabase/migrations/20261125100000_telos_tasks.sql)
   and run it. It is idempotent, so running it twice is safe.
4. Verify in **Table Editor** that `public.tasks` exists and shows a green
   "RLS enabled" badge. That badge is the security guarantee: without it the anon
   key could read every row.
5. **Project Settings → API**: copy the **Project URL** and the **anon /
   publishable key**. The anon key is designed to be public — it is baked into
   the bundle — so it never goes in the Vault or in a `.env` that gets committed.
   The **service_role** key must never be copied anywhere; nothing here needs it.

---

## Phase 2 — Prove sync works before publishing (10 minutes)

Run the real thing locally against the real project, so a broken key or a missing
policy shows up before it is public.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key> \
npm run dev
```

Then, in the browser:

1. Open <http://localhost:3000>, scroll to the sync panel, **Create account**
   with an email and password of your choosing.
2. Add two tasks; the panel status should reach "Synced <time>".
3. In **Table Editor → tasks** the rows are there, and `synced_at` is filled by
   the trigger (a server clock, not your machine's).
4. Open the same URL in a private window, sign in with the same account: the
   tasks appear. That is the phone-and-laptop promise, proven.
5. Add one task in each window within a few seconds; both survive. The trigger
   drops the older `updated_at`, which is the last-write-wins rule.
6. Second account check: create a second account in another private window and
   confirm it sees an **empty** list. If it does not, RLS is wrong — stop here.

If step 1 says "check your inbox", email confirmation is on (Phase 0.3). If it
says "couldn't reach sync", the URL or key is wrong. If rows never appear but
status says synced, step 3.4 of Phase 1 was skipped — the policy is missing.

Laptop-only smoke test without a browser profile dance:

```bash
npx supabase projects list   # confirms which account the CLI is logged into
```

---

## Phase 3 — Publish (5 minutes)

1. In GitHub: **Settings → Secrets and variables → Actions → Variables → New
   repository variable**, two entries:
   - `SUPABASE_URL` — the Project URL
   - `SUPABASE_ANON_KEY` — the anon / publishable key
2. Push to `master`. `.github/workflows/pages.yml` runs `npm run build:static`
   with those two variables, and `next.config.mjs` turns sync **on** only when
   both are present. Without them the same commit deploys a local-only list —
   that is a valid fallback, not a failure.
3. Watch **Actions → pages**: the build job then the deploy job, both green.
4. Open `https://mylad01.github.io/telos/` on a phone, sign in, add a task, then
   reload on the laptop. Done.
5. Add the URL to the repo's About section so it is the first thing anyone sees.

The `ci` workflow (`check:messages`, `tsc`, `vitest`, `next build`) runs on the
same push. A red `ci` with a green `pages` means the site shipped something the
tests do not cover — fix `ci` before the next change.

---

## Verify the live site (the launch gate)

Tick each one on a real phone, not just a resized desktop window:

- [ ] Today shows the correct count, including overdue tasks.
- [ ] Adding a task, ticking it and deleting it with undo all work.
- [ ] Adding a task while the phone is in airplane mode still saves it, and it
      syncs when the network returns (status goes offline → syncing → synced).
- [ ] The same list appears on a second device after sign-in.
- [ ] Signing out on one device leaves the other signed in.
- [ ] Export JSON then Import JSON returns the same list.
- [ ] No sideways scroll at 360 px; the composer, tabs and rows are reachable
      with the thumb.

---

## Operations

**Cost.** GitHub Pages on a public repo: free. Supabase free tier: free, and a
project pauses itself after a week with no traffic — the first request after that
fails, so open the dashboard and **Resume** it, then reload the app. Data is kept.

**Backups.** The app exports JSON from the settings row; do that after any
significant amount of work. Supabase free tier has daily backups for the last
seven days.

**Rotating the anon key.** Project Settings → API → regenerate, then update the
`SUPABASE_ANON_KEY` repository variable and push (or re-run the `pages` workflow
by hand with **Run workflow**). The site is expected to break between the two
steps, so do them together.

**Changing the schema.** Add a new file in `supabase/migrations/`, run it in the
SQL Editor, and update `src/lib/supabase/map.ts` plus its test in the same commit.
Any new table needs `enable row level security` and an owner policy before it is
exposed — the anon key is public.

**Pausing or removing the project.** Deleting the Supabase project makes the
hosted page a local-only list again: the panel's sign-in stops working, but tasks
already in a browser stay there and export still works. Nothing else breaks.

---

## Rollback

| Situation | Action |
|---|---|
| Supabase is down or broken | Remove the two repository variables; the next push (or a manual re-run of `pages`) deploys the local-only build. Export/import still moves a list between devices. |
| The new commit breaks the page | **Actions → pages → the last good run → Re-run all jobs**, or `git revert` and push. |
| A bad migration | Write a new migration that undoes it; never edit an applied file. |

---

## Why this shape, in one paragraph

GitHub Pages serves files only — no server, no API routes, no disk — so a shared
list needs a hosted database with its own auth. Supabase was chosen over
Firebase, a Vercel backend or Cloudflare D1 because it is Postgres with SQL
policies that anyone can read, it has a free tier that fits, and the browser side
is about 300 lines of plain `fetch` with no SDK. See
[`docs/adr/0001-github-pages-with-supabase.md`](adr/0001-github-pages-with-supabase.md)
for the options that were rejected and
[`docs/ARCHITECTURE.md`](ARCHITECTURE.md) for how the pieces fit.
