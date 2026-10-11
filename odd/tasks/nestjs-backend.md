# Feature: nestjs-backend

Locator: `odd/tasks/nestjs-backend.md` · Engram mirror: `odd/nestjs-backend/tasks` · Branch: `feat/nestjs-backend` (from `main`)

## Objective
Phase 1 of the incremental migration: replace the vanilla Node backend (`lib/`, `api/`, `server.js`) with a NestJS API on PostgreSQL, keeping the current `/api` HTTP contract so the existing frontend in `public/` keeps working unchanged. Phase 2 (separate feature) builds the Next.js frontend with the sidebar.

## Why
User decisions (2026-10-10): migrate to NestJS + Next.js incrementally; PostgreSQL only (Aiven in prod, Podman locally), Redis and the JSON file store removed, start with an empty DB (no data migration); ORM TypeORM.

## Scope
- In: npm workspaces root; `apps/api` (NestJS); PostgreSQL schema + TypeORM migrations; `compose.yaml` for Podman; all current `/api` routes; CPNU client; scheduled review; serving `public/` statically from Nest; README/CLAUDE.md/Iniciar.bat/.env.example updates; removal of `lib/`, `api/`, `server.js`, `vercel.json` Redis/file code at cutover.
- Out: `public/` changes (frontend untouched), Next.js, people locator, production hosting choice for the API, Redis data migration.

## Constraints
- Architecture: hexagonal per module (domain models without decorators; application use cases; infrastructure adapters). TypeORM entities live only in infrastructure and are mapped to domain models by repositories.
- Package manager: npm workspaces (pnpm not installed). Node 26 available; target Node ≥ 20.
- DB: `DATABASE_URL`; optional `DATABASE_CA_CERT` (PEM content) enabling `ssl: { ca, rejectUnauthorized: true }` for Aiven. `synchronize: false`, migrations only. Small pool (serverless-safe defaults, configurable).
- Normalized schema: `procesos` (CPNU-owned columns incl. `detalle` JSONB, `error`, `ultima_consulta`, plus office columns alias/responsable/etiquetas text[]/nueva_instancia), `actuaciones` (incl. `no_vista` flag), `sujetos`, `notas`, `tareas`, `meta`. Refresh writes only CPNU-owned data inside a transaction with `SELECT ... FOR UPDATE` on the proceso row, so office edits are never clobbered and deleted processes are never resurrected (replaces `guardarRefresco`/`CAMPOS_OFICINA`).
- DB runtime (user decision 2026-10-10): dev Postgres runs under Docker Compose on 127.0.0.1:5432 (was Podman on 5433); test DB stays 127.0.0.1:5434 (tmpfs). Migration `InitialSchema1791590400000` applied to dev DB and verified (7 tables).
- Contract compatibility (frontend + external links): same routes, methods, shapes, status codes and messages documented in the contract map below; `/logout`, `/yo`, `/cron`, `/salud` accept any method; `/novedades` bare array; same session cookie format and `SECRET = SESSION_SECRET || sha256hex('s:'+APP_PASSWORD)` derivation and ICS token so existing sessions and calendar subscriptions keep working; same ICS output.
- Deliberate fixes (documented, frontend-safe): malformed JSON body → 400 (was 502); oversized body → 413 (was a hang); `etiquetas: null` → `[]` (was tag "null"); stable sort tie-breaks; missing `ultimaActuacion` sorts last; `/salud.baseDeDatos` → `'postgres'` or `'sin configurar'`.
- Scheduler: `@nestjs/schedule` cron (default `0 11 * * *` UTC, env `REVISION_CRON`, disable with `REVISION_CRON=off`) with re-entrancy guard; `/api/cron` kept (Bearer `CRON_SECRET`). Keep CPNU pacing (1s/proceso, 0.5s/radicado).
- Tests: Vitest (the Nest 12 default; Nest 12 is ESM-only, so the original "Jest (Nest default)" premise no longer holds — see Progress 2026-10-10 T1). Test-first for domain/application logic (refresh diff, noVistas pruning, instance detection, resumen/sorting, validation, session signing compatibility with the legacy algorithm, ICS). E2E with supertest against a real Postgres from `compose.yaml` (separate test DB), CPNU mocked at the port.

## Contract map (from read-only explorer, 2026-10-10)
Legacy `lib/app.js` line refs. Public: `* /salud`, `* /cron`, `* /agenda.ics?t=`, `POST /login`, `* /logout`, `* /yo`; else 401 `Inicia sesión.`. Protected: `GET/POST /procesos`, `GET /novedades`, `GET /agenda`, `GET /actuaciones/:id/documentos`, `GET/PATCH/DELETE /procesos/:id`, `POST /procesos/:id/visto|actualizar`, `POST /procesos/:id/notas`, `DELETE /procesos/:id/notas/:nid`, `POST /procesos/:id/tareas`, `PATCH|DELETE /procesos/:id/tareas/:tid`. Full details, shapes and quirks: legacy `lib/app.js:212-432`, `rutasProtegidas` `:241-380`, `resumen` `:217-235`, `generarIcs` `:145-168`, session `:172-191`, CPNU `:8-61`, refresh `:64-138`.

## Tasks
- [x] T1 Scaffold: npm workspaces, `apps/api` NestJS app (global prefix `api`, static `public/` with correct MIME incl. `.woff2`), config module with env validation, TypeORM Postgres connection (SSL CA), `compose.yaml` (Postgres 17 + test DB), `.env.example`, `/api/salud`.
- [x] T2 Domain + persistence: domain models, ports, TypeORM entities, initial migration, repository adapters with mapping; unit + integration tests.
- [x] T3 Auth: legacy-compatible session cookie, login (800ms failure delay), logout, yo, session guard; tests incl. a cookie signed by the legacy algorithm.
- [x] T4 CPNU + review: CPNU HTTP adapter (25s timeout, 404→null, pagination ≤20), refresh use case, instance detection, review-all service, scheduler, `/api/cron`; tests with mocked CPNU.
- [ ] T5 Procesos API: list, add, detail, patch, delete, visto, actualizar, notas, tareas, documentos, novedades; e2e contract tests.
- [ ] T6 Agenda + ICS: `/api/agenda`, `/api/agenda.ics`; tests comparing with legacy output for the same data.
- [ ] T7 Cutover: remove `lib/`, `api/`, `server.js`, legacy `vercel.json`; root scripts; update README, CLAUDE.md, Iniciar.bat; manual smoke of the existing frontend against Nest.

Route per task: delegated direct (writer trigger: multiple non-trivial new files per task). One writer at a time, one Conventional Commit per task (no AI attribution lines).

## Acceptance criteria
- Existing `public/` frontend works end to end against the NestJS API with a local Podman Postgres.
- All contract routes match the map (shapes, codes, messages), apart from the documented deliberate fixes.
- A cookie and ICS token produced by the legacy algorithm with the same secret are accepted.
- No Redis or file-store code remains.

## Checks
- `npm run -w apps/api lint`, `npm run -w apps/api build`, `npm test -w apps/api`, `npm run -w apps/api test:e2e` (Podman Postgres up).
- Manual smoke at T7: login, add radicado, detail, notes, tasks, agenda, ICS download.

## Delivery
- Forecast ≈ 2,500 authored lines (excluding lockfile and generated migration SQL). Above the ~400 budget → strategy `ask-on-risk`; chain strategy: `feature-branch-chain` (user, 2026-10-10): PR slices chain on `feat/nestjs-backend`; one final PR to `main`. Slice boundaries recorded below as commits land.
- RDD: off (global). Push/PR are the user's decision.

## Progress / Evidence
- 2026-10-10: Decisions recorded, contract mapped, branch created from `main`, document created.
- 2026-10-10 T1 (route: delegated writer). Nest 12.1 (ESM, `type: module`), TypeORM 1.1, Vitest 4 + oxlint (Nest 12 CLI defaults, replacing Jest/ESLint). Root `package.json` is the workspaces root: `start`/`start:legacy` still run `server.js` until T7; `dev:api`, `build:api`, `start:api`, `test:api`, `db:up`, `db:down` added. `compose.yaml`: `db` (127.0.0.1:5433, volume `pgdata`) and `db-test` (127.0.0.1:5434, tmpfs), Postgres 17 with healthchecks. Extra env vars: `DATABASE_POOL_MAX` (5), `DATABASE_MIGRATIONS_RUN` (true), `TEST_DATABASE_URL`, `PUBLIC_DIR`. `/api/salud` returns `rama: 'sin verificar'` until T4 wires the CPNU port; `baseDeDatos` is `'postgres'` when `SELECT 1` succeeds. `.env.example` NOT written: the runtime permission settings deny any `.env*` path (content prepared for the parent). Checks: lint exit 0; typecheck exit 0; build ok; unit 15/15; e2e 11/11 (salud any method, `/` text/html, `.css`, `.woff2` font/woff2, `.webmanifest`, SPA fallback, `/api/*` 404 `{error}`, malformed JSON 400, >100kb 413); manual run on :3100 against dev DB: `/api/salud` 200, `/` text/html, `/styles.css` text/css. ~860 authored lines (scaffold + config + tests; above the 400 heuristic because the shell, config validation and its tests are one unit). Commit `25e0046`.
- 2026-10-10 T2 (route: delegated writer). `src/procesos/` module: `domain/` (plain types `Proceso`, `ProcesoCpnuState`, `Actuacion`, `Nota`, `Tarea`; ports `ProcesoRepository`/`MetaRepository` with Symbol tokens), `infrastructure/persistence/` (TypeORM entities, mapper, `TypeOrmProcesoRepository`, `TypeOrmMetaRepository`). Migration `InitialSchema1791590400000` (tables `procesos`, `actuaciones` with `no_vista`, `sujetos`, `notas`/`tareas` with identity `seq` for stable order, `meta`; migrations table `migraciones`); `typeorm schema:log` reports no drift between entities and migration. `updateCpnuState(id, mutate)` locks the row with `SELECT ... FOR UPDATE`, writes only CPNU-owned columns/children and returns `null` without writing when the proceso is gone. The full repository port (office edits, notas, tareas, markSeen) is implemented so T5 only adds HTTP/use cases. Decisions: `noVistasIds` are returned in CPNU order (legacy: union order; frontend uses a Set); a repeated CPNU actuación id keeps its first occurrence; `tareas.id_actuacion` is text (the frontend sends the hidden-input string). Checks: lint exit 0; typecheck exit 0; build ok; unit 21/21; e2e 24/24 (incl. lock-wait test proving office edits committed during a refresh survive and a delete during the wait is not resurrected); `migration:run` against dev DB ok. ~1,355 authored lines (about 40% tests; above the heuristic because the whole repository port, its migration and its integration tests form one persistence unit). Commit `c5c5d5a`.
- 2026-10-10 T3 (route: delegated writer). `src/auth/`: `domain/session.ts` (pure legacy-compatible signing/reading, `deriveSecret`, `safeEqual`), `application/auth.service.ts` (login with injectable `SLEEP` 800 ms penalty, 503 on Vercel with the default password, `secret` also exported as `AUTH_SECRET` for the ICS token in T6), `infrastructure/http/` (`AuthController` POST `/login` 200, `@All` `/logout` and `/yo`; global `SessionGuard` via `APP_GUARD` with `@Public()` opt-out and `@CurrentUser()` param decorator). Unknown `/api` paths answer 401 `Inicia sesión.` without a session and 404 `Ruta no encontrada.` with one (legacy order), via an optional `UNMATCHED_ROUTE_RESPONDER` hook in the global filter. `TimeModule` provides `SLEEP` globally. Legacy compatibility proven three ways: byte-identical `Set-Cookie` vs a frozen copy of the legacy code (`legacy-session.fixture.ts`, survives T7), legacy-signed cookie accepted, and an e2e that runs the real `lib/app.js` `handle` for `/login` and replays its cookie on `/api/yo` (auto-skips once `lib/` is removed). Checks: lint exit 0; typecheck exit 0; build ok; unit 37/37; e2e 31/31. Commit `44282c3`.
- 2026-10-10 T4 (route: delegated writer). Port `CpnuPort` (`procesos/application/ports/cpnu.port.ts`; value types in `domain/cpnu-data.ts`) with `CpnuHttpAdapter` (legacy base URL/headers, 25 s `AbortSignal.timeout`, 404→null, non-2xx → `La Rama Judicial respondió <status>`, ≤20 actuación pages, sujetos/actuaciones failures → `null` = keep previous, documents mapping for T5). Pure domain `domain/refresh.ts` (`applyRefresh`, `applyRefreshError`, `newProceso`, `newInstance`); application `RefreshProcesoService` (CPNU outside the transaction, diff applied inside `updateCpnuState`; `hydrateNew` for new procesos — T5 add route should use it), `DetectInstancesService`, `ReviewService` (1 s/proceso, 0.5 s/radicado via `SLEEP`, `ultimaRevision` meta, concurrent callers share the in-flight run); `ReviewScheduler` (`cron` CronJob in UTC from `REVISION_CRON`, `off` disables, skips ticks while running); `/api/cron` (`@All`, Bearer `CRON_SECRET` compared in constant time, 401 `No autorizado`); `/api/salud.rama` now live via the port. `safeEqual` moved to `common/security`. Test helpers: `procesos/testing/` (`FakeCpnu`, `InMemoryProcesoRepository`, fixtures); `createTestApp` injects a `FakeCpnu` and no-op sleep by default (e2e never hits the network). Test-first: RED observed with 34 failing unit tests across refresh, refresh-proceso, detect-instances, review and cpnu-http-adapter specs (stubs threw `not implemented`), then GREEN. Checks: lint exit 0; typecheck exit 0; build ok; unit 76/76; e2e 38/38.

- 2026-10-10 Parent spot check after T4: `npm test -w apps/api` 76/76 passed. `.env.example` NOT created: runtime permissions deny writes to `.env*` paths (agent and parent); pending user action.

## Next step
User creates `.env.example` (or allows the write); then delegate T5-T7.
