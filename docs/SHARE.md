# Sharing and reminders — operator notes

Phase D adds the two things a single-device list cannot do: let another account
edit one of your lists, and wake a phone when a task comes due.

Three moving parts, all optional until you want them:

1. Two migrations (`20261128100000_telos_share.sql` and
   `20261128110000_telos_templates.sql`).
2. The `remind` Edge Function, deployed by hand.
3. A scheduler that calls it about once a minute.

Everything else — the invite panel, the template menu, the join form — runs in
the browser against the tables the migrations create.

## What the migrations create

`20261128100000_telos_share.sql`:

- `list_shares` — one row per invite. `owner_id` is filled from the signed-in
  account, `member_id` stays null until the code is accepted, `invite_code` is
  unique, `role` is `editor` or `viewer`, and `list` is the plain list name from
  `tasks.list`. `owner_email` is display text, never an access check.
- New `tasks` policies layered on the owner-only policy: a member can select the
  owner's tasks in the shared list name, and an editor can insert and update
  them. Viewers are select-only. Nobody but the owner can delete.
- `telos_join_share(code)` — a security-definer function. A pending invite is
  invisible to the joiner under RLS, so the function looks it up, binds the
  caller as `member_id`, and returns only the list name.

`20261128110000_telos_templates.sql`:

- `template` — the account's templates, keyed `(user_id, id)`, with the client's
  whole Template object in `payload`.
- `telos_reminders` — the push queue: `fire_at` is a `timestamptz`, `sent`
  starts false.
- `telos_push_subscriptions` — one Web Push subscription per account; the
  function has nowhere to send without it.

All four tables are owner-only under RLS. Both files are safe to run twice and
run in order: share first, then templates.

## Deploying the reminder function

You need VAPID keys once per deployment. Generate them with the Web Push
library, keeping the private key out of the repo:

```
npx web-push generate-vapid-keys
```

Set the three values as function secrets (the browser needs the public key too,
so ship it as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` when the UI starts subscribing):

```
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
supabase functions deploy remind
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform; do
not set them yourself. The function reads at most 100 due reminders per run,
sends each one, and patches `sent = true`. A 404/410 from the push service means
the browser dropped the subscription, so it is deleted and the reminder is
marked sent instead of retried forever. Everything else stays queued.

Call it on a schedule — Supabase's `pg_cron`, GitHub Actions, or any cron box:

```
* * * * * curl -s -X POST https://<project-ref>.supabase.co/functions/v1/remind \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

## How an invite works, end to end

1. The owner opens Share on a list. `createInvite` writes a row with
   `member_id` null and an 8-character code from `makeInviteCode` (no `0`, `O`,
   `1` or `I`, so it can be read aloud).
2. The owner passes the code on. It is a bearer secret until accepted: anyone
   signed in can spend it.
3. The other account types it into the join form. The browser calls
   `telos_join_share`; Postgres binds `member_id` and returns the list name.
4. From then on the member's `tasks` queries see the owner's rows in that list
   under the new policies, and edits sync as usual. An editor's new tasks are
   written with `user_id = owner_id` so the owner sees them too.
5. Revoking deletes the share row. The member keeps nothing: the next sync
   returns no shared rows. The same code cannot be reused.
6. Deleting the owner's account cascades the shares away.

One list name, one owner, one member per code. Sharing the same list with three
people means three codes.

## What is not tested locally

- The SQL has no local test suite. It is written to be re-runnable, but treat
  the first run on a real project as the test: apply it, then check
  `select * from list_shares` and one select as both accounts.
- RLS behaviour (who sees which task) is only exercised on a live database. The
  unit tests cover the pure helpers in `src/lib/share.ts` and
  `src/lib/templates.ts`, not the policies.
- `telos_join_share` and the three new `tasks` policies have not been run
  against Postgres by the app tests; a wrong role check shows up as an empty
  list in the UI, not as a failing unit test.
- Web Push end to end (subscription, VAPID, delivery) needs a real browser and
  the deployed function. Nothing in `vitest` touches `fetch`, the function, or
  the push service.
- Realtime sync of a shared list (item 17 of Phase D) is not part of these
  migrations; the app still polls through the existing sync cursor.
