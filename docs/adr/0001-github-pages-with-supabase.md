# ADR 0001 — GitHub Pages as the host, Supabase for the shared list

- Status: accepted (2026-11-25)
- Context: the list already synced through this app's own Node server. The
  requirement was a permanent public URL on the user's own GitHub, at no cost,
  with the same list on phone and laptop.

## Context

GitHub Pages serves static files only: no server code, no request handlers, no
writable disk. `POST /api/auth` and `POST /api/sync`, and the JSON/SQLite store in
`.data/`, therefore cannot run there. Two other facts shaped the decision:

- the free plan only serves a **public** repository, so any secret placed in the
  build ends up in public code;
- the requirement is small and personal: one person, a few hundred tasks, no
  realtime need, and it must keep working offline.

## Options

| Option | Shared list at $0 | Work | Main risk |
|---|---|---|---|
| **A. Pages + Supabase free tier** | yes | new browser backend + SQL policy layer | a second account and project to keep alive |
| B. Pages + Cloudflare Workers/D1 | yes | rewrite server routes as a Worker, own auth | own auth done properly (hashing, reset, rate limits) |
| C. GitHub itself as the store (repo file or Gist via API) | yes | small | a repo-wide token in phone browser storage, a commit per sync, no per-user isolation, 5,000 requests/hour |
| D. Real host (Fly.io + volume) | no, ~$2/mo | almost none — the code exists | a paid machine to maintain |

## Decision

**Option A.** The static app stays the product; Supabase supplies the two things
Pages cannot: an identity service and a database. The client talks to GoTrue and
PostgREST with plain `fetch` and no SDK.

Security rests on one rule instead of application code: row-level security on
`public.tasks` keyed on `auth.uid()`. The public anon key is harmless because the
database itself refuses rows that are not the caller's, including forged
`user_id` values. Nothing in the browser build needs a secret.

A last-write-wins trigger keeps sync semantics identical to the existing Node
store, so `useSync`, the offline queue and the merge rules are shared by both
deployments rather than forked.

## Consequences

Positive: no cost, one URL to bookmark, both devices share a list, offline still
works, the self-hosted path keeps working unchanged, and the entire trust model
is one SQL file a reviewer can read.

Negative: a second account (Supabase) that must exist for sync; free projects
pause after a week of inactivity and need a manual resume; the project owner must
apply one migration by hand; being a static site, there is no server-side
enforcement of anything beyond the RLS policy.

Neutral: polling every 4 s instead of realtime; whole-task merge rather than
field-level.

## Revisit when

- two people need one shared list (option A needs a membership table, not just
  `user_id`);
- the free project's pausing becomes a problem in practice (Pro is $25/mo);
- sync volume outgrows 500 MB or the 5 GB egress allowance;
- a requirement appears for anything that must be server-rendered.

## Notes

Option C was rejected despite being the most literal reading of "GitHub stores
it": the token would live in a phone browser, every device would need it pasted,
and there is no per-user separation. Option D remains the fallback if a writable
disk is ever needed —  `supabase/migrations` then does not apply, and the Node
store in `src/server/` is used as before.
