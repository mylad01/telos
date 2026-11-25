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
```

Sync needs the Node server (not a static export): accounts and tasks are kept in
`.data/telos.json`, created on first use and gitignored. The directory must be
writable. `TELOS_SECRET` signs sessions; without it a secret is generated in
`.data/secret`. Set `NEXT_PUBLIC_TELOS_SYNC=0` at build time to ship without the
sync panel (export/import stays).

## Structure

- `app/layout.tsx`, `app/page.tsx` — the single page and its fonts
- `app/api/auth/route.ts`, `app/api/sync/route.ts` — sign-in and task sync
- `app/globals.css` — design tokens and all component styles
- `src/components/` — `TaskApp` (state), `Composer`, `TaskRow`, `SyncPanel`
- `src/lib/` — task type and merge rules, storage, sync hook, backup, dates
- `src/server/` — JSON store, password hashing and session cookies
- `src/i18n/request.ts` — next-intl request config (single locale)
- `messages/en.json` — the only place user-visible copy lives

## Adding a language

The UI is English only, but every string is already in ICU messages, so a second
language is mostly catalog work: add `messages/<locale>.json`, add the locale to
`scripts/check-messages.mjs`, and choose the locale in `src/i18n/request.ts`
(e.g. from a cookie). Use `dir="rtl"` on `<html>` if the script is right-to-left;
the stylesheet already uses logical properties.
