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

Health/diagnostics: `GET /api/salud` (CPNU reachability, database status, whether `APP_PASSWORD` is configured).

## Architecture

`apps/api/src/<module>/{domain,application,infrastructure}` (hexagonal per module):

- `domain/` — plain types and pure functions, no framework decorators. Property names are the public contract (Spanish) shared with the frontend.
- `application/` — use cases (`ProcesosService`, `AgendaService`, `AuthService`, `RefreshProcesoService`, `DetectInstancesService`, `ReviewService`) and ports (`CpnuPort`, `ProcesoRepository`, `MetaRepository`) declared with Symbol tokens (`PROCESO_REPOSITORY`, `META_REPOSITORY`, `CPNU_PORT`, `AUTH_SECRET`).
- `infrastructure/` — HTTP controllers, TypeORM entities and repositories, the CPNU HTTP adapter, the cron scheduler. TypeORM types never leave infrastructure.

Modules: `auth` (legacy-compatible session cookie, login, logout, `/yo`, global `SessionGuard`), `procesos` (routes, CPNU client, refresh, instance detection, review, persistence), `agenda` (`/api/agenda`, public `/api/agenda.ics`), `salud`, `config` (typed env validation), `database` (DataSource, migrations), `common` (`ApiError`, exception filter, JSON body middleware, `safeEqual`).

Key decisions:

- Every route lives under the global `api` prefix. `public/` is served by Nest's static module with SPA fallback for non-API GETs.
- The session cookie and the ICS token are compatible with the legacy algorithm (`SECRET = SESSION_SECRET || sha256('s:' + APP_PASSWORD)`); a frozen copy of the legacy algorithm (`auth/domain/legacy-session.fixture.ts`, `agenda/testing/legacy-ics.fixture.ts`) is the test oracle.
- Errors render as `{ error: string }` through `ApiExceptionFilter`; `ApiError(status, message)` carries the legacy Spanish messages.
- Refresh writes only CPNU-owned data inside a transaction that locks the proceso row (`SELECT ... FOR UPDATE`), so office edits are never clobbered and deleted procesos are never resurrected.
- Scheduled review: `@nestjs/schedule` cron (`REVISION_CRON`, default `0 11 * * *` UTC) with a re-entrancy guard; `/api/cron` (Bearer `CRON_SECRET`) runs the same review on demand. CPNU pacing: 1 s per proceso, 0.5 s per radicado.
- Schema: `procesos`, `actuaciones` (with `no_vista`), `sujetos`, `notas`, `tareas`, `meta`. `synchronize` is off; schema changes go through migrations.

## Environment variables

`DATABASE_URL` (required), `APP_PASSWORD` (required; the default `cambiar-esta-clave` is rejected on Vercel-like hosts), `SESSION_SECRET`, `CRON_SECRET`, `REVISION_CRON` (`off` disables the schedule), `DATABASE_CA_CERT` (PEM, verified TLS), `DATABASE_POOL_MAX` (5), `DATABASE_MIGRATIONS_RUN` (true), `PORT` (3000), `PUBLIC_DIR`, `NODE_ENV`. Nest loads a root `.env` (see `.env.example` once it exists).

## Gotchas

- The CPNU API sometimes blocks non-Colombian IPs — connection errors may be geographic, not code bugs.
- Cases marked private (`esPrivado`) in the Rama cannot be followed and are skipped.
- The review job is long-running (about 1.5 s per proceso). A serverless host is not suitable; the hosting target is still open.
- The frontend's `public/sw.js` never caches `/api/*`. Bump its `CACHE` version when the static asset list changes.
- Known legacy gap kept on purpose: ICS lines are not folded at 75 octets (pinned by a test).
- "Today" is computed as UTC−5 (Colombia) on the server (`fechaBogota`) and on the client.
