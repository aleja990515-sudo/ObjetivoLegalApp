# Feature: radicados-por-usuario

Locator: `odd/tasks/radicados-por-usuario.md` · Engram mirror: `odd/radicados-por-usuario/tasks` · Branch: `feat/radicados-por-usuario` (from `main` @ 400aaff).

## Objective
Make every `proceso` (and its actuaciones, sujetos, notas and tareas) visible only to the user who added it. User A adds radicados; user B must not see, read, modify or delete them, and must not be able to discover that they exist.

## Problem (verified 2026-10-15)
Ownership is not modelled at all today. This is not a broken filter, it is a missing concept.
- `procesos.agregado_por` is a `text` holding `usuario.nombre` — the display **name**, not the id. No FK to `usuarios`, no index.
- `ProcesoRepository` (`apps/api/src/procesos/domain/proceso.repository.ts`) has **no** user scoping on any method: `findAll()`, `findById()`, `listRefs()` are global.
- 9 of the 13 routes in `ProcesosController` never receive the session user; only the write routes do, and only to stamp the author of a nota/tarea.
- `AgendaService` reads `findAll()` globally, and the ICS token is **global**: `tokenAgenda(secret) = HMAC(secret,'agenda-ics')` (`apps/api/src/agenda/domain/calendar-token.ts`). `GET /api/agenda.ics?t=…` returns every office task with no session at all. Scoping the agenda without fixing this leaves the requirement open through the calendar.

## Decisions (user, 2026-10-15)
- Strict ownership: only the uploader sees the proceso. No roles, no sharing, no admin override — `usuarios` has no role column and none is added here.
- Existing rows are backfilled to the user who added them by matching `agregado_por` against `usuarios.nombre` (trimmed, case-insensitive) — user-selected option over "hide from everyone" and over "leave visible to all", because the office already has that work loaded.

## Scope
- In: migration + `ProcesoEntity.usuarioId`; `Proceso.usuarioId`; scoped `ProcesoRepository` (read side) plus explicitly system-level unscoped accessors for the cron; `ProcesosService` + `ProcesosController` threading `SessionUser` through the read routes; `DetectInstancesService` ownership propagation; `AgendaService` per-user scoping; per-user ICS token.
- Out: roles/admin view, sharing between users, re-assigning an existing proceso to another user, any change to `actuaciones`/`sujetos`/`notas`/`tareas` schemas.

## Design
1. **Owner column.** `procesos.usuario_id uuid NULL REFERENCES usuarios(id) ON DELETE RESTRICT` + index `procesos_usuario_idx`. Kept nullable so orphan rows survive the migration instead of being dropped. `Proceso.usuarioId: string`.
2. **Reads are scoped; writes inherit the guard for free.** `findAll(usuarioId)`, `findById(idProceso, usuarioId)`, `listRefs(usuarioId)`. Every write path in `ProcesosService` already funnels through the private `existente()` guard, so scoping `findById` makes that guard an ownership check with **zero** new guard code. It already raises the legacy `404 Proceso no encontrado.`, which is the correct response: a 403/404 split would leak existence.
3. **The cron keeps global access.** `ReviewService` (cron) has no user. It uses `listRefsForReview()` + `findByIdForReview(id)` and `updateCpnuState(id, …)`, which stay unscoped and are named so the system scope is explicit at every call site.
4. **Insert carries the owner.** `add()` sets `usuarioId: usuario.id` on the new aggregate. `DetectInstancesService.detect(radicado, base)` inherits `base.usuarioId` and calls `listRefs(base.usuarioId)`, so a new instance belongs to whoever owns the base proceso.
5. **Per-user ICS.** Token becomes `${usuarioId}.${HMAC(secret,'agenda-ics:'+usuarioId).slice(0,32)}`. The ICS endpoint parses the id and verifies the signature with `safeEqual` before calling `findAll(usuarioId)`. No schema change, no lookup table; the frontend already receives the link from `GET /api/agenda`.

## Known limitation (accepted)
`procesos.id_proceso` stays the global primary key (it is the CPNU id). Two users cannot independently follow the same radicado: the second `insert` collides and `add()` returns the existing `409 Ese proceso ya está en la lista.`. This is pre-existing behaviour, not introduced here, and it does not violate the visibility requirement — the 409 reveals only existence of a radicado the second user typed themselves, never its content. Lifting it would mean a surrogate key and FK changes across all five tables. `shortcut: global id_proceso PK, two users cannot follow the same radicado; upgrade if the office needs co-counsel tracking`.

## Tasks
- [x] T1 Migration + entity: `usuario_id` column, FK, index, two-pass backfill (deterministic name match, then radicado fallback), NULL + duplicate-name diagnostic; registered in `migrations/index.ts`; `ProcesoEntity.usuarioId`.
- [x] T2 Domain + port: `Proceso.usuarioId`; scoped `findAll`/`findById`/`listRefs`; explicit `listRefsForReview`/`findByIdForReview` for the cron; `newProceso`/`newInstance` carry the owner; mapper round-trip.
- [x] T3 Service + controller: `SessionUser` threaded through all 12 `ProcesosController` routes plus `AutosService` (an unlisted caller the port change exposed — it leaked A's PDF links to B); `existente(usuario, id)` is the single ownership guard; `DetectInstancesService` propagates the owner; `documentos` moved to `/procesos/:id/actuaciones/:actuacionId/documentos` and now proves the actuación belongs to the proceso.
- [x] T4 Agenda + ICS: per-user `<usuarioId>.<firma>` token, HMAC verified with `safeEqual` before any read.
- [x] T5 Tests: cross-user isolation on every route (404 never 403, owner gets 200 on the same route), cron still refreshes all rows, ICS token isolation, migration backfill run against a real DB.
- [x] T6 Docs: `CLAUDE.md` architecture notes on ownership, the surrogate key, the 404 discipline, the per-user ICS token and the orphan rows.

## Resolved (C2) — approved by the maintainer and shipped in `2a7a82b`
`id_proceso` is no longer the global primary key. A surrogate `procesos.id uuid` carries the key; `id_proceso` is unique **per owner**; the five child tables hang from the surrogate. Route paths and response shapes are unchanged, because reads stay addressed by `idProceso` scoped by owner. Consequences:
- `POST /api/procesos` now answers **201** for the second user on a radicado a colleague follows, and the 409 means only "you already follow this radicado". The existence oracle is closed.
- Every **write** is addressed by the surrogate, taken from the aggregate `existente()` returns. Addressing a write by `idProceso` would write into a colleague's copy — this is the single most dangerous mistake available in this codebase now.
- An independent verification of this unit found a **High regression introduced by it**: relaxing the global PK means an ownerless row never conflicts on `(usuario_id, id_proceso)` (a Postgres unique index treats every NULL as distinct), so the cron appended a duplicate orphan per detected instance on every run, without bound. Closed with a partial unique index on `(id_proceso) WHERE usuario_id IS NULL`, plus a regression test that runs `detect` twice and asserts the row count does not grow.
- The same verification found the cron fed a newly detected instance to only whichever co-follower won the first-slot race. Now `ReviewService` groups the review by radicado into one base per distinct owner, off a single CPNU search.

## Cross-branch risk found 2026-10-15 (not fixed here)
Migration timestamp `1791936000000` is used by both this branch (`1791936000000-procesos-id-surrogado.ts`) and `feat/procesos-privados` (`1791936000000-procesos-privados.ts`), which is also on `feat/estados-barrido` and `feat/estados-listado-pdf`. TypeORM tolerates it — `getPendingMigrations()` filters by class name, not by timestamp — but the convention is broken and should be resolved at merge time by renumbering one of them. Not touched here because the correct resolution depends on the merge order.

## Checks — all observed green 2026-10-15
| Command | Result |
| --- | --- |
| `npm test -w apps/api` | 32 files, **268 passed** |
| `npm run -w apps/api test:e2e` | 14 files, **167 passed**, exit 0 |
| `npm run -w apps/api typecheck` | clean |
| `npm run -w apps/api lint` | exit 0; 5 warnings, all pre-existing at HEAD |
| `npm run -w apps/api build` | exit 0 |
| `npm run -w apps/web typecheck` / `lint` / `test:web` | clean / clean / 13 files, 45 passed |

Every number above was re-run by the orchestrator after the last write, not reported second-hand. The e2e DB must be recreated before verifying (`docker compose down db-test && docker compose up -d db-test`): it is tmpfs, but a sibling branch left an `es_privado` column and a stray migration row behind in it.

## Independent verification (adversarial, post-implementation)
An independent verifier read the diff hunting for a bypass and found 2 critical, 2 high and 3 medium defects. All were fixed except the one below:
- **C1** — the e2e isolation tests passed *vacuously*: the cookie was minted in `beforeAll`, then `beforeEach` truncated `usuarios`, so every request was scoped to a dead uuid and the owner got the same 404 as the intruder. Fixed by minting the session after the truncate and asserting owner-200 / foreign-404 on the same route.
- **H1** — the backfill orphaned every auto-detected instance, because `agregado_por = 'Revisión automática'` matches no `usuarios.nombre`. Those rows became invisible to everyone. Fixed with a radicado-based second pass.
- **H2** — duplicate display names assigned ownership non-deterministically. Fixed with `DISTINCT ON … ORDER BY u.creado` + a duplicate-name diagnostic.
- **M1/M2/M3** — `''` owner id crashed the real adapter (`22P02`) while the in-memory double accepted it; `documentos` accepted an actuación id from another proceso. Fixed.

## Open decision (C2) — RESOLVED 2026-10-15, see "Resolved (C2)" above
`procesos.id_proceso` used to be a **global** primary key, which made `add()` an existence oracle (201 vs 409) and stopped two lawyers from following the same expediente. The maintainer approved the fix and it shipped in `2a7a82b`. The "Known limitation" section below is therefore obsolete and kept only to record why the original design accepted it.

## Delivery
Forecast ~450 authored changed lines including tests. Recommended as **one atomic PR**: splitting it would open a window where reads are scoped but the global ICS token still leaks the whole office. Delivery under `size:exception` / single-PR rationale to be confirmed with the maintainer before the PR is opened; push and PR creation stay human decisions.

## Progress
- 2026-10-15 — feature doc created, branch cut from `main` @ 400aaff.
- 2026-10-15 — T1–T5 implemented in two delegated passes. An interrupted writer left NUL bytes in two `apps/api/test/` files; both were detected by a byte scan, restored from HEAD, and the scan re-run clean. No corruption reached the final tree.
- 2026-10-15 — independent adversarial verification of WU-1; C1/H1/H2/M1/M2/M3 found and fixed; e2e went 39 failed → 0. Committed as `7b4bbb1`.
- 2026-10-15 — maintainer approved the C2 fix; surrogate key implemented, independently verified (which found a High regression it had introduced), regression closed. Committed as `2a7a82b`.
- 2026-10-15 — T6 docs committed. Both work units are on `feat/radicados-por-usuario`; **nothing is pushed and no PR is opened** — those remain the maintainer's decisions.

## Route declaration
- Exploration: inline (bounded batch, under the evidence budget). CodeGraph unavailable — CLI shim fails (`mise` has no version set) and `codegraph_explore` MCP is not present in this session; fell back to bounded filesystem search.
- Implementation: **delegated writer** — T1–T5 touch more than two non-trivial files across domain, persistence, application, http and agenda.