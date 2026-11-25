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

## Run

```bash
npm install
npm run dev              # http://localhost:3000
npm run build            # production build
npm start
npm run check:messages   # catalog ICU syntax and arguments
npm run typecheck
npm test                 # vitest: units, sync contract for both stores
```

Sync needs the Node server (not a static export): accounts and tasks are kept in
`.data/`, created on first use and gitignored. The directory must be writable.
The default store is `.data/telos.json`; `TELOS_STORE=sqlite` uses
`.data/telos.db` (Node's built-in `node:sqlite`) with the same API. Copy an
existing JSON store over with `npm run store:backfill`, which is safe to repeat.
`TELOS_SECRET` signs sessions; without it a secret is generated in
`.data/secret`. Set `NEXT_PUBLIC_TELOS_SYNC=0` at build time to ship without the
sync panel (export/import stays).

## Hosting on GitHub Pages

`.github/workflows/pages.yml` builds the static export on every push to `master`
and publishes it to `https://<user>.github.io/telos/`. `npm run build:static`
sets `TELOS_STATIC=1`, which switches `next.config.mjs` to `output: 'export'`
under the `/telos` base path, drops the API route handlers and sets
`NEXT_PUBLIC_TELOS_SYNC=0`; the list then lives in the browser and moves between
devices with the JSON export/import. Pages needs the repository to be public on
a free plan.

## Structure

- `app/layout.tsx`, `app/page.tsx` — the single page and its fonts
- `app/api/auth/route.ts`, `app/api/sync/route.ts` — sign-in and task sync
- `app/globals.css` — design tokens and all component styles
- `src/components/` — `TaskApp` (state), `Composer`, `TaskRow`, `SyncPanel`
- `src/lib/` — task type and merge rules, storage, sync hook, backup, dates
- `src/server/` — JSON and SQLite stores behind one contract, passwords and
  session cookies; `src/server/*.test.ts` runs the same sync contract on both
- `src/i18n/request.ts` — next-intl request config (single locale)
- `messages/en.json` — the only place user-visible copy lives

## Adding a language

The UI is English only, but every string is already in ICU messages, so a second
language is mostly catalog work: add `messages/<locale>.json`, add the locale to
`scripts/check-messages.mjs`, and choose the locale in `src/i18n/request.ts`
(e.g. from a cookie). Use `dir="rtl"` on `<html>` if the script is right-to-left;
the stylesheet already uses logical properties.
