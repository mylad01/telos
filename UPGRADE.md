# Telos — upgrade and modernisation plan

Written 2026-11-25 against the code as it stands (Phases 1–3 shipped, no test suite yet).
Companion to `PLAN.md`, which covers features; this file covers the stack and the
runtime risks underneath them.

## Status (2026-11-25)

Phases 0–3 are done and Phase 4's CI is in place; lint and auth hardening stay
open by design. What landed, and where it differs from the plan:

- **Phase 0** — `vitest` (the watch-mode option) because the node:test route cannot
  load extensionless TS imports without touching every import. Tests live beside
  the code (`src/lib/*.test.ts`, `src/server/*.test.ts`); the sync contract in
  `src/server/store.contract.ts` runs against both stores. `next-env.d.ts` was
  already tracked. The smoke journey runs through the workspace browser tool at
  390 px and 1280 px rather than as a committed Playwright spec, because installing
  Playwright is not allowed in this workspace; add the spec when the repo has its
  own CI runner with browsers.
- **Phase 1** — `engines.node >=24 <25`, `.nvmrc` 24, TypeScript 7.0.2. `tsc --noEmit`
  and `next build` are clean.
- **Phase 2** — react/react-dom `^19.3.1`, `@types/react(-dom)` `^19.3.0`.
- **Phase 3** — `TELOS_STORE=sqlite` uses `node:sqlite`; JSON stays the default.
  No `sessions` table (sessions are stateless HMAC cookies) and no dual-write:
  `npm run store:backfill` copies the JSON store in one transaction, and the seq is
  raised to the highest value seen. Verified end-to-end: sign up and sync on JSON,
  backfill, restart on SQLite, same account and task come back over HTTP.
- **Phase 4** — `.github/workflows/ci.yml` runs install, `check:messages`,
  `typecheck`, `test`, `build` on Node 24. Lint and auth hardening are still open
  decisions; no public URL is served without them.

Note that the plan's `node:test` preference is superseded: the plan chose it to
avoid a dependency, but Node's type stripping needs explicit `.ts` import
extensions, which this codebase does not use.


## Where the app stands

| Piece | Installed | Latest | Verdict |
| --- | --- | --- | --- |
| next | 16.4.6 | 16.4.6 | current |
| react / react-dom | 19.3.1 (range says `^19.2.0`) | 19.3.1 | installed current, range lags |
| next-intl | 4.16.1 | 4.16.1 | current |
| @formatjs/icu-messageformat-parser | 3.1.0 | 3.1.0 | current |
| typescript | 5.9.3 | 7.0.2 | one major behind (native port) |
| @types/node | 24.19.2 | 26.6.9 | correct — matches the Node 24 runtime, do not chase 26 |
| node | 24.22.1 | 24 LTS | fine, but nothing pins it |
| `npm audit --omit=dev` | 0 vulnerabilities | | clean |

Gaps that matter more than version numbers:

- **No test suite.** `check:messages`, `tsc --noEmit` and `npm run build` are the only
  checks; every behavioural check so far was a one-off script or a browser session.
- **No `engines`, `.nvmrc` or CI.** A fresh clone on Node 22 or Node 26 is untested.
- **`next-env.d.ts` is gitignored.** A clone that runs `tsc --noEmit` before `next build`
  fails because the file Next generates is missing.
- **Storage is one JSON file** (`.data/telos.json`, `src/server/store.ts`). Every write
  rewrites the whole file, and `locked()` only serialises inside one process — two
  instances, or one crash mid-write, is the real durability risk.
- **Auth has no throttle and no reset.** Fine for a private list, not for a public deploy.
- **No lint.** Nothing catches unused code or hook mistakes.

## Options considered

1. **Harden in place (chosen).** Keep Next 16 / React 19, add the missing checks, take
   TypeScript 7 and the React 19.3 range bump, then move the store off a single JSON file.
   Smallest risk, every phase shippable.
2. **Toolchain-first rewrite.** Jump to TS 7 + eslint + vitest in one change. Faster on
   paper, but a red type-check and a red lint would land on the same commit with no
   baseline to tell which change broke what.
3. **Re-platform the storage on Postgres now.** Correct destination, but it is a data
   migration on an app with no characterisation tests — the exact combination the plan
   below sequences against. Deferred to Phase 3, behind a store switch.

Runtime first, then framework and libraries, then application code, then CI. Each phase
leaves `npm run build` and `npm test` green and can be reverted on its own.

## Behaviour that must survive every phase

Pin these with tests in Phase 0 and re-run them after each later phase:

- `localStorage` key `telos.tasks.v1` and its stored shape; tasks saved before Phase 2
  (no `repeat`, no `updatedAt`) still load as one-offs.
- Merge rule: last write wins on `updatedAt`, local wins a tie, deletes kept as tombstones.
- The sync cursor is the server `seq`, never a clock.
- Filters: **Today** = today + overdue; **This week** = today .. today+7, overdue included.
- Unticking a finished repeating task retracts the copy it spawned.
- All 85 keys in `messages/en.json` (key parity, ICU syntax, argument names).
- HTTP contract: `POST /api/auth` (`signup|signin|signout`, HttpOnly cookie),
  `POST /api/sync` `{since, changes}` → `{tasks, now, seq}`, stale writes rejected.

## Phase 0 — Baseline and characterisation

1. Add `node:test` (no new dependency, runs on Node 24) or `vitest` if you prefer
   watch mode; add `npm test`.
2. Unit tests for `src/lib/tasks.ts` (merge, tombstones, repeat rollover, retraction),
   `src/lib/dates.ts` (`nextOccurrence` across DST and month ends), `src/lib/storage.ts`
   (bad shapes rejected), `src/lib/backup.ts` (export → import round trip) and the session
   HMAC in `src/server/session.ts`.
3. One Playwright smoke journey: add a task with a due date → reload → tick it → filter
   Today → still correct. This is the release check for every later phase.
4. Untrack the `next-env.d.ts` ignore, commit the file.

**Done when** `npm test` is green on unchanged code and the smoke journey passes.
**Rollback:** delete the new test files; no runtime code changes.

## Phase 1 — Runtime and toolchain

1. Pin the runtime: `"engines": { "node": ">=24 <25" }` in `package.json`, `.nvmrc` = 24,
   and a GitHub Actions matrix of 24 only (add 26 only once it is LTS).
2. TypeScript 5.9.3 → 7.0.2. TypeScript 7 is the native Go port (stable since July 2026,
   ~10x faster, no JavaScript compiler API until 7.1). Next 16 already runs the
   project-local `tsc` for `next build` by default (`experimental.useTypeScriptCli`), so
   the build keeps type-checking; keep `npx tsc --noEmit` as the `typecheck` script.
3. TS 7 adopts the TypeScript 6 defaults (`strict` on, hard errors for flags deprecated in
   6.0). This `tsconfig.json` uses none of the removed flags (target ES2022, module
   resolution `bundler`), so expect a clean swap — confirm with a real `tsc --noEmit`.
4. Do **not** add `ignoreDeprecations`. If eslint is added later, it needs
   `"typescript": "npm:@typescript/typescript6@^6.0.2"` plus
   `"@typescript/native": "npm:typescript@^7.0.2"` as aliases, because typescript-eslint
   still imports the compiler API.

**Done when** `typecheck`, `npm test`, `build` and the smoke journey pass on TS 7.
**Rollback:** revert `package.json` + `package-lock.json`; no source changed.
**Stop and ship** if editor tooling (the Next TS plugin) misbehaves — CLI checks are the
gate, the plugin can wait for TS 7.1.

## Phase 2 — Framework and libraries

1. React range `^19.2.0` → `^19.3.1` (the lockfile already resolves 19.3.1, so this is a
   declared-range fix, not a new install). React 19.3 stabilises View Transitions and
   Fragment refs — adopt neither in this phase; the point is a declared, tested range.
2. `next`, `next-intl`, `@types/node` stay put: already latest. Bump nothing "for
   freshness".
3. `@types/react-dom` shows as unused to `depcheck` but is a peer type package — keep it.

**Done when** the same four checks pass, plus a browser pass at 390 px and 1280 px.
**Rollback:** revert the two version fields and the lockfile.

## Phase 3 — The store (the one real migration)

1. Move `.data/telos.json` to SQLite via `node:sqlite` (built into Node 24 — no native
   build step): `users`, `tasks`, `sessions` tables, `seq` from an `AUTOINCREMENT`/sequence.
2. `TELOS_STORE=json|sqlite` switch; SQLite path dual-writes behind the JSON path and a
   backfill script imports existing users and tasks.
3. Cut over by flipping the variable, keep the JSON file read-only for one release, then
   remove the JSON writer in the following release.
4. Postgres stays off the table until SQLite shows the write pattern is right.

**Done when** the smoke journey and merge tests pass on both store modes, and a restart
mid-write loses nothing.
**Rollback:** set `TELOS_STORE=json` — the JSON file is still authoritative until the
writer is removed.

## Phase 4 — Guardrails and release

1. GitHub Actions: install (cached), `check:messages`, `typecheck`, `npm test`, `build`.
2. Lint as its own decision, not bundled: `eslint-config-next` flat config + the TS 6
   alias from Phase 1. Expect a burst of first-run findings; land them as one commit of
   mechanical fixes, no behaviour change.
3. Auth hardening before any public URL: rate-limit `/api/auth` (per IP + per email),
   add password reset, and document `TELOS_SECRET` (sessions are invalidated if it is
   unset and regenerated).
4. Tag `v0.2.0` once Phases 0–2 are green; `v0.3.0` after the store cutover.

## Deprecation register

| Item | State | Action |
| --- | --- | --- |
| TypeScript < 7 | behind | Phase 1 |
| `next lint` | removed in Next 16 | never used here; do not add it, use eslint directly |
| `middleware.ts` → `proxy.ts` | renamed in Next 16 | no middleware in this app |
| JSON file store | at risk, not deprecated | Phase 3 |
| `@types/node` 26 | newer but wrong for this runtime | stay on 24 |

## Open decisions

- Test runner: **settled on vitest** — the node:test zero-dependency route needs
  `.ts` import extensions this codebase does not use.
- Store: **settled on SQLite behind the switch**; Postgres stays off the table.
- Whether lint is in scope at all for a single-author app — still open; the CI
  workflow does not run one.
- Auth hardening (rate limit, password reset) before any public URL — still open.
