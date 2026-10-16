# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

"Mis Procesos": a small office web app (installable PWA) that tracks Colombian court cases ("procesos") through the Rama Judicial's public **CPNU** API (`https://consultaprocesos.ramajudicial.gov.co:448/api/v2`). Users log in with their name + a shared office password, add cases by 23-digit radicado, and the app periodically re-fetches them and flags new "actuaciones".

Identifiers, comments, UI copy and error messages are in **Spanish** — keep extending them in Spanish. Code identifiers (classes, methods) are English.

Monorepo with npm workspaces (`apps/*`). Backend: NestJS 12 + TypeORM + PostgreSQL 17 (`apps/api`). Frontend: vanilla JS/HTML/CSS in `public/`, served statically by the API. Phase 2 (a Next.js frontend) is a separate feature.

## Commands

```bash
npm run db:up                       # PostgreSQL 17 via docker compose (db: 127.0.0.1:5432, db-test: 127.0.0.1:5434)
npm run db:down
npm run -w apps/api migration:run   # TypeORM migrations (needs DATABASE_URL)
npm run dev:api                     # nest start --watch, http://localhost:3000
npm run build:api                   # nest build -> apps/api/dist
npm start                           # node apps/api/dist/main.js (after build)
npm test -w apps/api                # Vitest unit tests
docker compose up -d db-test && npm run -w apps/api test:e2e   # e2e against the test database
npm run -w apps/api lint            # oxlint
npm run -w apps/api typecheck
```

Health/diagnostics: `GET /api/salud` (CPNU reachability, database status, whether `DATA_ENCRYPTION_KEY` is configured so accounts can work).

## Architecture

`apps/api/src/<module>/{domain,application,infrastructure}` (hexagonal per module):

- `domain/` — plain types and pure functions, no framework decorators. Property names are the public contract (Spanish) shared with the frontend.
- `application/` — use cases (`ProcesosService`, `AgendaService`, `AuthService`, `RefreshProcesoService`, `DetectInstancesService`, `ReviewService`, `AutosService`) and ports (`CpnuPort`, `PublicacionesPort`, `ProcesoRepository`, `MetaRepository`, `AutoPublicadoRepository`) declared with Symbol tokens (`PROCESO_REPOSITORY`, `META_REPOSITORY`, `CPNU_PORT`, `PUBLICACIONES_PORT`, `AUTO_PUBLICADO_REPOSITORY`, `AUTH_SECRET`).
- `infrastructure/` — HTTP controllers, TypeORM entities and repositories, the CPNU HTTP adapter, the cron scheduler. TypeORM types never leave infrastructure.

Modules: `auth` (session cookie signed with `SESSION_SECRET` carrying the user id, login by correo, logout, `/yo`, login rate limit, global `SessionGuard`), `usuarios` (accounts table, self-registration `POST /api/registro`, `AdministracionUsuarios` used by the `users:*` CLI in `src/cli/`), `procesos` (routes, CPNU client, refresh, instance detection, review, persistence), `agenda` (`/api/agenda`, public `/api/agenda.ics`), `salud`, `config` (typed env validation), `database` (DataSource, migrations), `common` (`ApiError`, exception filter, JSON body middleware, `safeEqual`).

Key decisions:

- Every route lives under the global `api` prefix. `public/` is served by Nest's static module with SPA fallback for non-API GETs.
- Accounts: passwords are hashed with scrypt (`scrypt$N$r$p$salt$hash`, parameters stored in the hash, `needsRehash` upgrades them at login). Personal data (cédula, celular, correo) is AES-256-GCM encrypted with keys derived from `DATA_ENCRYPTION_KEY` by HKDF; uniqueness and login use an HMAC-SHA256 index. New self-registered accounts are inactive until an operator runs `users:activate`. `APP_PASSWORD` is gone: sessions and the ICS token derive from `SESSION_SECRET` only, so cookies and calendar links issued under the old secret stop working once.
- The frozen legacy oracle `agenda/testing/legacy-ics.fixture.ts` still pins the ICS output format; the legacy session fixture was removed with the shared password.
- Errors render as `{ error: string }` through `ApiExceptionFilter`; `ApiError(status, message)` carries the legacy Spanish messages.
- Refresh writes only CPNU-owned data inside a transaction that locks the proceso row (`SELECT ... FOR UPDATE`), so office edits are never clobbered and deleted procesos are never resurrected.
- Scheduled review: `@nestjs/schedule` cron (`REVISION_CRON`, default `0 11 * * *` UTC) with a re-entrancy guard; `/api/cron` (Bearer `CRON_SECRET`) runs the same review on demand. CPNU pacing: 1 s per proceso, 0.5 s per radicado.
- Autos: `GET /api/procesos/:id/actuaciones/:actuacionId/auto` (providencias only) scrapes the Publicaciones Procesales portal (`infrastructure/publicaciones/`): despacho = first 12 digits of the radicado, window = auto date to CPNU "Fijación estado" + 2 business days, matcher and confidence levels (`exacto`, `del_dia`, `estado`, `sin_resultado`) in `domain/autos.ts`. Links only: the server reads the start, search and estado detail pages and NEVER requests `/documents/`, `/dtd/` or a `/c/document_library/` path other than `get_file?uuid=…` — the estado's `LISTADO`, downloaded only to find a private caso (robots.txt; `validarRutaPortal` enforces it). Process-wide queue with 2 s between requests, 60 s timeout, one retry on 5xx/timeout, 30 min stop on 403/429/captcha (`PortalBloqueadoError`, the endpoint answers 503 or the stored result). Results live in `autos_publicados` (FK to `procesos`, not `actuaciones`, because a refresh rewrites actuaciones); `exacto`/`del_dia` are final, `estado`/`sin_resultado` are retried after 3 days, at most 5 searches. Tests use trimmed HTML fixtures in `procesos/testing/fixtures/publicaciones/` and `FakePublicaciones` (the e2e app never hits the portal).
- Schema: `procesos`, `actuaciones` (with `no_vista`), `sujetos`, `notas`, `tareas`, `meta`, `autos_publicados`. `synchronize` is off; schema changes go through migrations.

## Next.js web app (`apps/web`)

The new frontend is a Next.js 16 App Router app (TypeScript, Tailwind v4, shadcn/ui on the tokens in `src/app/globals.css`, Phosphor icons from `@phosphor-icons/react`). It replaces the vanilla `public/` UI view by view; `public/` is still served by the API until the cutover is decided.

- Run order: `npm run dev:api` (port 3000), then `npm run dev:web` (port 3001). The browser talks only to Next; `apps/web/next.config.ts` rewrites `/api/*` to `API_ORIGIN` (default `http://localhost:3000`), so the `sesion` cookie stays first-party.
- Checks: `npm run lint:web`, `npm run typecheck:web`, `npm run test:web` (Vitest + Testing Library, axe-core, WCAG contrast of the tokens), `npm run build:web`.
- Layout: `src/app/(app)/` routes behind `SessionGuard` (calls `/api/yo`); `src/features/<area>/` holds the views and their API models (`features/procesos/modelo.ts` mirrors the API contract); `src/lib/api.ts` is the only place that calls the API.
- Contract: the API contract is frozen to phase 1. Do not change `apps/api` from the web work; wire views to the controllers under `apps/api/src/**/infrastructure/http/`.
- Copy and identifiers are in Spanish, with no em or en dashes in visible text. Business logic stays in `features/`, not in shared components.

## Environment variables

`DATABASE_URL` (required), `SESSION_SECRET` (required, at least 32 characters), `DATA_ENCRYPTION_KEY` (32 bytes in base64; required for accounts), `CRON_SECRET`, `REVISION_CRON` (`off` disables the schedule), `DATABASE_CA_CERT` (PEM, verified TLS), `DATABASE_POOL_MAX` (5), `DATABASE_MIGRATIONS_RUN` (true), `PORT` (3000), `PUBLIC_DIR`, `NODE_ENV`. Nest loads a root `.env` (see `.env.example` once it exists).

Operator commands: `npm run users:create|users:activate|users:deactivate|users:password -- …` (root wrappers of `apps/api` scripts; the password is never an argument).

## Gotchas

- Publicaciones Procesales is Liferay HTML, not an API: the portlet id `BIyXQFHVaYaq` and the markup can change, and file naming is each clerk's habit. Colombian holidays are not in the business-day window yet. Second-instance procesos search the despacho of the radicado, not the tribunal.
- The CPNU API sometimes blocks non-Colombian IPs — connection errors may be geographic, not code bugs.
- Cases marked private (`esPrivado`) in the Rama hide their expediente in CPNU (`Detalle`, `Sujetos` and `Actuaciones` answer 404), so only the radicado search data is stored. They are followed through the court's own estados: `EstadosService` sweeps the despacho's estados on a cron of its own (`ESTADOS_CRON`, default every 6 h), downloads and reads their `LISTADO` pdf and records the match in `estados_proceso`, which `GET /procesos/:id` (field `estados`) and `GET /novedades` (novedad type `estado`, cleared by the same `POST /procesos/:id/visto`) expose.
- The review job is long-running (about 1.5 s per proceso). A serverless host is not suitable; the hosting target is still open.
- The frontend's `public/sw.js` never caches `/api/*`. Bump its `CACHE` version when the static asset list changes.
- Known legacy gap kept on purpose: ICS lines are not folded at 75 octets (pinned by a test).
- "Today" is computed as UTC−5 (Colombia) on the server (`fechaBogota`) and on the client.
