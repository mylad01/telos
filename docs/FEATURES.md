# Feature map: what the leaders do, and what Telos should copy

Research data for deciding what to build next. Sources are the vendors' own docs and
feature pages (Nov 2026). This is a study of *behaviour and UX patterns*, not of their
code, copy or brand assets — nothing here is copied from their source.

Apps surveyed: Notion, Todoist, TickTick, Things 3, Apple Reminders, Google Tasks,
Microsoft To Do.

---

## 1. Feature inventory

Grouped by job-to-be-done. "Who" lists the apps that ship it, as reported by their own
pages — it is a survey, not an exhaustive legal claim about every plan tier.

### A. Capture (getting the thing out of your head)
| Feature | Who | Notes |
| --- | --- | --- |
| Quick add from anywhere | Todoist, TickTick, Things 3 | floating entry, global shortcut |
| Natural-language dates ("rent every friday 4pm") | Todoist, TickTick | called smart date recognition |
| Voice capture | Todoist (Ramble), Apple Reminders (Siri) | |
| Email → task | Todoist, Notion AI | needs a server/agent |
| Share sheet / widget / watch | all mobile apps | OS-level |
| Templates (reusable task/card shapes) | Notion, Apple Reminders, Todoist | |
| Keyboard shortcuts + command menu | TickTick, Things 3, Notion | |

### B. Organise (where it lives)
| Feature | Who | Notes |
| --- | --- | --- |
| Lists / projects | Todoist, TickTick, Things 3, Google Tasks, MS To Do | the basic filing unit |
| Areas (life spheres: Work, Home) | Things 3 | grouping above projects |
| Sections / headings inside a list | Todoist (sections), Things 3 (headings), Apple Reminders, Notion (groups) | |
| Sub-tasks / checklists | all of them | Todoist: sub-tasks; Things: checklist; Apple: full sub-reminders |
| Tags / labels / multi-select | Todoist, TickTick, Apple Reminders, Notion | cross-cutting categories |
| Priority (p1–p4 or flag) | Todoist, TickTick, Apple Reminders | |
| Starred / pinned / flagged | Google Tasks (star), Apple (flag), things (pin to Today) | |
| Notes / description on a task | Todoist, TickTick, Things 3, MS To Do | rich text in Some |
| Attachments | TickTick, Apple Reminders, Notion | needs file storage |
| Relations, rollups, formulas | Notion | database modelling, far past a to-do app |
| Bulk edit, duplicate, move | Todoist, TickTick | |

### C. Schedule (when)
| Feature | Who | Notes |
| --- | --- | --- |
| Due date | all | |
| Start date vs deadline | Things 3, Google Tasks, Todoist | "when I work on it" vs "when it must be done" |
| Time of day on a task | Todoist, TickTick, Apple Reminders | |
| Duration / time blocking | TickTick (timeline), Google Tasks | |
| Repeat: daily/weekly/monthly/yearly | all | |
| Repeat: custom interval, end date/count | Todoist, TickTick, Google Tasks | |
| Repeat from completion ("3 days after I do it") | Todoist, Apple Reminders | |
| Reminders: absolute time, "X before due" | Todoist, TickTick, Apple Reminders | |
| Reminders: recurring, persistent ("keep ringing") | TickTick | |
| Location reminders | Apple Reminders, TickTick | OS-level geofencing |
| Evening bucket ("This Evening") | Things 3 | splits Today in two |
| Calendar events beside tasks | Things 3, TickTick | read-only calendar integration |

### D. Views (how you look at it)
| Feature | Who | Notes |
| --- | --- | --- |
| Today | all | the anchor view |
| Upcoming / next 7 days | Todoist, Things 3, TickTick, Apple | |
| Anytime / Someday | Things 3 | "no date but available" vs "not now" |
| Done / completed + archive | all | Notes/TickTick keep a completed log |
| Search | Todoist, TickTick, Things 3 (Quick Find) | |
| Saved filters / smart lists (query language) | Todoist (filters), Apple (Smart Lists), TickTick | |
| Calendar views (day/week/month/agenda) | TickTick, Todoist, Things 3, Google Tasks | |
| Board / kanban | Todoist, TickTick, Notion, Apple (columns) | |
| Timeline / gantt | TickTick, Notion | |
| Eisenhower matrix | TickTick | |
| Group/sort/filter by any property | Notion | the most general model |

### E. Progress and motivation
| Feature | Who | Notes |
| --- | --- | --- |
| Karma / points, daily+weekly goals | Todoist | |
| Streaks, habit log | TickTick | separate habit module |
| Stats: tasks done, focus time, productive hours | TickTick, Todoist | |
| Activity history | Todoist, Notion (audit) | |
| Zero-inbox ritual ("Todoist Zero") | Todoist | framing, not code |

### F. Focus and extras
| Feature | Who |
| --- | --- |
| Pomodoro timer tied to a task | TickTick |
| Habit tracker with mini journal | TickTick |
| Countdown to an event | TickTick |
| Weekly review prompt / daily reminder to plan | TickTick |

### G. Collaboration
| Feature | Who | Notes |
| --- | --- | --- |
| Shared lists, realtime edits | Todoist, TickTick, Apple Reminders, MS To Do, Notion | |
| Assign a task to a person | Todoist, Apple Reminders, Notion | |
| Comments, @mentions, resolution | Notion, Todoist | |
| Guests / per-page permissions, roles | Notion | |
| Teamspaces, audit log, SSO | Notion | enterprise floor |

### H. Platform and plumbing
| Feature | Who | Notes |
| --- | --- | --- |
| Offline-first, sync on reconnect | all | |
| Installable app / PWA / native apps | all | Telos has the manifest |
| Dark mode (light/dark/system) | Notion, TickTick, Todoist | |
| Import/export (CSV, JSON, backups) | Notion, Todoist, TickTick | Telos has JSON export/import |
| Public API + webhooks | Notion, Todoist | needs a server |
| Integrations (calendar, email, Slack…) | all | |
| Importers from competitors | Notion | switching cost play |
| i18n, RTL | most | Telos has the catalog |
| Accessibility | most | WCAG target |

### I. AI (the 2026 layer)
| Feature | Who | Notes |
| --- | --- | --- |
| Natural-language create/edit ("move everything from today to monday") | Todoist Assist, Notion AI | |
| Auto-tag / autofill properties | Notion AI Autofill | |
| Meeting → action items | Notion | |
| AI filters / saved query generation | Todoist Filter Assist | |

---

## 2. Where Telos stands today

| Area | Telos now |
| --- | --- |
| Capture | title + date + repeat chip (once/daily/weekly/monthly) |
| Organise | flat list; note, pin and reminder fields exist in the data model but have **no UI** |
| Schedule | due date only; repeat monthly works, custom intervals do not |
| Views | Today (today + overdue), This week, All, Done; per-task reschedule chips |
| Progress | counts only |
| Platform | local-first localStorage, optional Supabase sync, email+password accounts, JSON export/import, PWA manifest, message catalog, English copy |
| Collaboration | one user per account, no sharing |

So: a solid single-list app. It has no notion of *containers* (lists/projects), no
*attributes* beyond due date and done, and no *views* beyond four fixed chips.

---

## 3. Gap analysis, filtered by the architecture

Telos ships as a static site on GitHub Pages with Supabase as the only backend
(no Node server, no cron of our own). That rules some features in and out:

**Fits today (pure client logic, no schema risk)**
edit a task · notes · pin · search · clear done · dark mode · quick-add date parsing ·
monthly/custom repeats · local reminders while the app is open · keyboard shortcuts ·
Tomorrow/This evening buckets · priority flag · tags · sub-task checklist (as a field)

**Fits with a Supabase migration (schema + RLS + RPC)**
lists/projects · tags table · sharing a list (RLS by membership) · realtime updates ·
attachments (Supabase Storage) · saved smart lists · history/audit · web push via an
Edge Function on a schedule

**Does not fit / needs another host**
location reminders (no native app), email-to-task (inbound mail needs a service),
calendar two-way sync (OAuth + server), true offline push (needs a worker), native
widgets, Siri/Shortcuts, public API + webhooks, AI features that hold a provider key
(possible only through an Edge Function with the key server-side)

---

## 4. Recommended build order

Chosen for value-per-risk against that table: each phase is shippable on its own and
none needs a new host.

### Phase A — make one list feel complete (client only)
1. Edit a task (title, due, repeat, note) — the most-used missing verb
2. Notes UI + pin (fields already in the model)
3. Search
4. Clear done, with undo
5. Dark mode (light / dark / system)
6. Quick-add parsing: `pay rent friday`, `every monday`, `in 3 days`
7. Local reminder at a set time (notifies while the tab is open, on next open otherwise)

### Phase B — structure (one migration)
8. Lists (Work / Home / …) with a per-list view and counts
9. Tags + one saved filter ("smart list") per user
10. Sub-task checklist per task
11. Priority flag; sort pinned → priority → due
12. Start date vs due date (Things' distinction; removes the "overdue guilt" pile)

### Phase C — plan the week (client)
13. Month calendar view (read-only first, drag later)
14. This evening / Tomorrow buckets
15. Stats: done-per-day, streak, weekly recap

### Phase D — share and grow (migration + realtime)
16. Share a list with another account (RLS membership + invites)
17. Realtime sync of a shared list
18. Web push via Supabase Edge Function + `pg_cron` for "remind me at 09:00"
19. Templates for repeatable lists

### Phase E — optional gloss
20. Pomodoro per task, habit streaks (only if metrics say people stay)
21. AI: natural-language bulk edits through an Edge Function that holds the key

---

## 5. Sources

- Notion, all features: https://www.notion.com/product/all-features
- Notion help, database properties: https://www.notion.com/help/database-properties
- Notion help, views/filters/sorts: https://www.notion.com/help/views-filters-and-sorts
- Todoist features: https://www.todoist.com/features
- Todoist glossary (dates, deadlines, reminders, filters): https://www.todoist.com/help/todoist/get-started/todoist-glossary-cA60laWMH
- Todoist pricing tiers: https://www.todoist.com/pricing
- TickTick features: https://ticktick.com/features
- TickTick beginner's guide: https://help.ticktick.com/articles/7054286604315131904
- Things 3 features: https://culturedcode.com/things/features/
- Things 3 on the App Store: https://apps.apple.com/us/app/things-3/id904237743
- Apple Reminders vs Microsoft To Do feature comparison: https://toolgpa.com/compare/apple-reminders-vs-microsoft-to-do
- Google Tasks vs Apple Reminders (2026): https://activity-tracker.io/blog/google-tasks-vs-apple-reminders
