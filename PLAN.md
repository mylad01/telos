# Telos — a quiet to-do list

## Goal and users

A phone-first to-do list for one person managing a day's work. It has to capture a
task with a due date in a couple of seconds, show what is actually due today
(including anything overdue), and let a task be ticked off without ceremony.
Everything stays in the browser — no account, no server, no sync.

"Working" means: add a task, reload the page and it is still there; the Today
filter holds exactly the undone tasks due today or earlier; the page is comfortable
at 360 px and at desktop width.

## Scope

In scope: task create / complete / delete, due dates, daily and weekly recurring
tasks, one-tap reschedule, undo after delete, Today, This week, All and Done
filters, localStorage persistence, English UI, phone and desktop layouts, warm
paper theme.

Out of scope: other languages (the catalog is ready for them), accounts or
cross-device sync, reminders/notifications, arbitrary recurrence rules (monthly,
every N days), editing a task's title or repeat after creation, subtasks,
drag-and-drop reordering, search, dark theme.

## Architecture

- **Next.js 16 (App Router) + React 19** — one server-rendered page with a single
  client island for the interactive list; statically generated.
- **next-intl 4** — keeps every user-visible string in `messages/en.json` behind
  ICU messages, so plurals and formatting are already right if a second language
  is added. One locale, no URL segment, no switcher.
- **Catalog check** — `npm run check:messages` fails on invalid ICU or unused
  argument mismatches; `scripts/check-messages.mjs`.
- **State** — `src/components/TaskApp.tsx` owns the tasks; `src/lib/storage.ts`
  reads/writes `localStorage` under `telos.tasks.v1` with shape validation and a
  visible "storage blocked" state. Phase 2 fields are optional on load, so data
  saved by Phase 1 keeps working.
- **Dates** — calendar strings (`YYYY-MM-DD`) compared against the local today;
  display and counts use `Intl`. No date library. `nextOccurrence` always lands
  strictly after today, so a task finished late never returns as overdue.
- **Recurrence** — completing a recurring task marks that occurrence done and
  appends a new one due on the next date, linked by `previousId`; un-ticking
  removes the rolled-forward copy (and its descendants) again. History stays in
  Done instead of one row whose date silently changes.
- **Delete** — removing a task shows a toast with Undo for 8 seconds (timer pauses
  while hovered or focused, Escape dismisses). Deletes are tombstones so they
  also reach other devices.
- **Sync** — optional. `app/api/auth` and `app/api/sync` route handlers keep
  accounts and per-user tasks in `.data/telos.json`; `src/lib/useSync.ts` runs a
  local-first loop (dirty tasks are the offline queue). See Phase 3 below.
- **Styling** — plain CSS in `app/globals.css`: warm paper tokens, Fraunces for
  display type, Inter for text, terracotta as the only accent, rust reserved for
  overdue. Logical properties, reduced-motion fallbacks.
- **Hosting** — needs a Node server for the API routes and a writable `.data`
  directory; `TELOS_SECRET` (optional) signs sessions, otherwise a secret is
  generated there. No third-party services, no Vault use.

Data model: `Task { id, title, due: 'YYYY-MM-DD', done, createdAt, completedAt,
repeat: 'none'|'daily'|'weekly', seriesId, previousId, updatedAt, deletedAt }`.
`Filter` is `today`, `week`, `all` or `done`; "This week" covers today through
today + 7 days, including overdue tasks.

Routes: `/`, `POST/GET /api/auth`, `POST /api/sync`.

## Risks and assumptions

- localStorage is unavailable in some private windows → the app keeps working for
  the session and shows a clear warning instead of silently losing data.
- Dates are calendar dates, not timestamps: no timezone conversion bugs, but a
  due date never carries a time of day.
- The managed preview had to be pointed at a running server, so the app is served
  from `npm start` on port 3000.

## Phase 1: The working list

Goal: a usable to-do app you can keep open on a phone.

- [x] Next.js app served at `/`, with the text catalog extracted
- [x] Warm paper design system: Fraunces + Inter, terracotta accent, paper surfaces
- [x] Add tasks with a due date, tick them done, delete them
- [x] localStorage persistence with a storage-blocked warning
- [x] Today filter (today + overdue), All, Done, with live counts
- [x] Intl dates and numbers, tabular figures, overdue in rust
- [x] Empty, loading and error states; keyboard focus and 44px touch targets
- [x] `npm run check:messages` and `npm run build` pass

Acceptance: open `/`, add a task due today and one due two days ago, tick one off,
reload — the list is intact and the Today count matches, with "2 days overdue" in
rust on the older task.

## Phase 2: A day that keeps moving

Goal: tasks that survive a missed day without manual cleanup.

- [x] Recurring tasks (daily/weekly) that roll forward when completed
- [x] One-tap reschedule (Today / Tomorrow / Next week) on each row
- [x] Undo after delete instead of a confirm dialog
- [x] "This week" view

Acceptance: a weekly task completed on Friday reappears on the following Friday;
deleting a task can be undone from the toast for 8 seconds.

Verified: daily task due Nov 25 ticked → next occurrence Dec 3 in All after
reload; weekly task rescheduled to "Next week" (Dec 2) shows in This week;
un-ticking a completed recurring task retracts its rolled-forward copy; delete →
Undo restores the row; phone 390 px and desktop 1280 px render without overflow,
clipping or low-contrast text.

## Phase 3: Same list on every device

Goal: optional, opt-in sync.

- [x] Sign-in and per-user storage behind a feature flag
- [x] Local-first merge (last-write-wins on task fields) with offline queue
- [x] Export/import as JSON

Acceptance: two devices signed into the same account see the same tasks within
seconds, with no data loss when one is offline.

How it works:

- `app/api/auth/route.ts` — email + password sign-up / sign-in / sign-out.
  Passwords are scrypt-hashed; the session is an HMAC-signed HttpOnly cookie.
  Accounts live in `.data/telos.json` (gitignored) written atomically.
- `app/api/sync/route.ts` — `POST { since, changes }`, answered with
  `{ tasks, now }`. `since` is a per-account server sequence number, not a
  clock, so device clock skew cannot make a change invisible to another device.
- `src/lib/useSync.ts` — polls every 4 s while signed in, pushes 900 ms after a
  local edit, retries after network failures. Changes awaited in
  `localStorage` are the offline queue; on reconnect the whole dirty set is sent.
- Merge: last-write-wins on each task's `updatedAt`; local wins ties. Deletes are
  tombstones (`deletedAt`) carried through sync, pruned locally after 30 days.
- Feature flag: `NEXT_PUBLIC_TELOS_SYNC=0` at build time hides the sync block;
  export/import stays available.
- `src/lib/backup.ts` — JSON export (live tasks only) and import with shape
  validation; imported tasks merge by the same last-write-wins rule.

Verified: sign-up in a browser, task synced, sign-out; a second browser profile
signed in and pulled the task, added another, and the server held both; curl
proved incremental cursors, rejection of a stale write and tombstone
propagation; merge/queue/backup logic covered by Node checks; 390 px and
1280 px render without overflow or clipping.

Open: the file-picker import path is covered by its parser tests but not clicked
end to end in a browser; passwords have no reset flow, and accounts are per
`telos` data directory rather than a managed identity provider.
