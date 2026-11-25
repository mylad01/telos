# Deploy

Host: GitHub Pages on `mylad01/telos`, public repo (required on the free plan).
Site: https://mylad01.github.io/telos/ . Source: `.github/workflows/pages.yml`,
static export via `npm run build:static` (basePath `/telos`).

## Sync switch
`next.config.mjs` sets `NEXT_PUBLIC_TELOS_SYNC` for static builds: `1` only when
both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` exist,
otherwise `0` (local-only list, export/import). The workflow passes them from the
repository variables `SUPABASE_URL` and `SUPABASE_ANON_KEY`, which are not set
yet — so the live site is still local-only.

## Launch runbook
`docs/LAUNCH.md`: create the Supabase project, run
`supabase/migrations/*.sql` in the SQL editor (RLS required), prove sync locally
with the two env vars, add both repository variables, push.

## Checks before pushing
`npm run typecheck && npm run check:messages && npm test && npm run build:static`.
CI runs the first three plus `next build` on every push to `master`.
