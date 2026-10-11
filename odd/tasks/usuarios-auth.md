# Feature: usuarios-auth

Locator: `odd/tasks/usuarios-auth.md` · Engram mirror: `odd/usuarios-auth/tasks` · Branch: `feat/usuarios-auth` (chained on `feat/nextjs-frontend`, which is chained on `feat/nestjs-backend`).

## Workflow (user decision 2026-10-11)
- TDD is OFF for this feature: no RED-first requirement. Checks (tests, typecheck, lint, build, e2e, live smoke) still run and must pass before each commit.
- Login form change in `apps/web` is included, so the browser login works end to end.

## Objective
Replace the single shared office password with real accounts stored in PostgreSQL. The shared `APP_PASSWORD` becomes the password of one test account only.

## Decisions (user, 2026-10-11)
- APPROVED by user 2026-10-11: registration fields and manual activation as above; cédula, celular and correo encrypted at rest (AES-256-GCM with `DATA_ENCRYPTION_KEY`) plus HMAC-SHA256 lookup index; consent checkbox with timestamp.
- Accounts are stored in table `usuarios`. Passwords are **hashed, not reversibly encrypted**: scrypt via `node:crypto` (no new dependency), per-user random salt, constant-time verify, parameters stored with the hash so they can be upgraded. A hash cannot be decrypted by anyone, including the operator. Personal data other than the password may be encrypted at rest later; that is a separate decision.
- Login identifier: `usuario` (unique, lowercase, 3–40 chars, `[a-z0-9._-]`). Display name `nombre` (1–60 chars) is what the app shows and what `agregadoPor` records. No roles in this iteration: every account has the same access as today.
- Self-registration (user decision 2026-10-11) with manual approval (user decision): `POST /api/registro` takes `{ nombreCompleto, cedula, correo, celular, clave }`. It creates the account **inactive**; nobody can log in until an operator activates it with `npm run -w apps/api users:activate -- <usuario>`. Only the account owner sees their own data after activation. The response to registration is generic ("Recibimos tu registro; la oficina lo activará.") and does not reveal whether a cédula or correo already exists beyond a 409 with a generic message.
- Registration fields and rules: `nombreCompleto` (2–120 chars, required, becomes `nombre` shown in the app); `cedula` (digits only, 6–10 chars, unique); `correo` (valid format, lowercase, unique); `celular` (Colombian mobile: 10 digits starting with 3, unique or not required to be unique — decide with the operator, default: not unique); `clave` (min 12 chars, scrypt hash). The `usuario` login identifier is derived from `correo` (lowercase) so the user logs in with their email; `usuario` stays unique.
- Personal-data protection (Ley 1581 de 2012, habeas data): `cedula`, `celular` and `correo` are personal data. Proposed (pending confirmation at implementation time): store `cedula` and `celular` encrypted at rest with AES-256-GCM using `DATA_ENCRYPTION_KEY` (32 bytes, base64, from env, never committed), plus a keyed HMAC-SHA256 index column for uniqueness lookups. Losing the key makes those fields unreadable, so the key must be backed up by the operator. Registration shows a consent checkbox with the purpose (verification and contact for the office); consent timestamp is stored.
- Operator commands: `users:create` (test or internal accounts, active immediately, prompts for password with echo off), `users:activate <usuario>`, `users:deactivate <usuario>`, `users:password <usuario>`. None accepts a password argument.
- `APP_PASSWORD` is removed from the auth path. A test account can be bootstrapped with `users:create`.
- Session: cookie `sesion` keeps the same signed format, but the payload carries the user id (`[usuarioId, nombre, expMs]`) and is signed with `SESSION_SECRET` only. `SESSION_SECRET` becomes required (no fallback to the password). Sessions created by the legacy algorithm are invalidated once; the frozen legacy-compat tests are retired with the legacy code.
- ICS token: derived from `SESSION_SECRET` (not `APP_PASSWORD`). Calendar links are regenerated once; the agenda response returns the new link, so the frontend keeps working.
- Failed logins: same 800 ms delay and generic message (`Usuario o clave incorrectos.`). Add a per-IP+usuario rate limit (in-memory is acceptable for one instance; document it).
- Audit: `procesos.agregadoPor`, `notas.autor`, `tareas.autor`/`hechaPor` already store the display name; keep them. No new audit table yet.

## Scope
- In: migration `usuarios` (id, usuario unique, nombre, password_hash, creado, actualizado, activo bool); `apps/api` auth module (domain: `Usuario`, password hashing port + scrypt adapter; application: `AuthService.login`; infrastructure: TypeORM entity + repository, controller); `users:create` / `users:password` CLI (Nest standalone context or a small script under `apps/api/src/cli`); config: drop `APP_PASSWORD`, require `SESSION_SECRET`; tests (unit: hash/verify, username rules, session payload; e2e: login with a DB user, wrong password, inactive user, session still works after restart, legacy cookie rejected); `.env.example` note (user creates the file).
- Out: admin UI, roles, signup, password recovery by email, OAuth.
- Frontend (`apps/web`): login form fields `usuario` and `clave` (coordinated with the web writer; see its F2).

## Contract changes (must be reflected in docs and frontend)
- `POST /api/login` body `{ usuario, clave }` → 200 `{ nombre }` + `Set-Cookie: sesion=…`. Bad credentials → 401 `{ error: 'Usuario o clave incorrectos.' }`. Missing fields → 400 `{ error }`.
- `GET /api/yo` → `{ nombre }` (unchanged shape).
- Everything else unchanged.

## Tasks (TDD off by user decision 2026-10-11: tests written after each behaviour, all checks run before each commit)
- [x] U1 Domain: `Usuario` type, username and password policy, scrypt hashing port and adapter with known-answer tests (format `scrypt$N$r$p$salt$hash`, verify constant time, rehash-needed check).
- [x] U2 Persistence: entity, migration `usuarios`, repository (find by usuario, create, set password), tests against Postgres.
- [x] U3 Auth flow: login by usuario/clave, generic failure, inactive user rejected, rate limit per IP+usuario, session payload with user id, `SESSION_SECRET` required, `APP_PASSWORD` removed from config and code.
- [x] U4 CLI: `users:create` and `users:password` (no password arguments, echo off, confirm twice, minimum length 12), with tests for the non-interactive core.
- [x] U5 ICS/agenda: token from `SESSION_SECRET`; update the agenda e2e and the calendar test; regenerate note in docs.
- [x] U6 Cleanup and docs: remove the legacy-cookie fixture and its tests, update README and CLAUDE.md (env vars, `users:create`), feature doc progress.

## Checks
- `npm test -w apps/api`, `npm run -w apps/api test:e2e` (Docker test DB on 5434), `typecheck`, `lint`, `build`, all under `mise exec --`.
- Manual: create the test account with `users:create`, log in through `POST /api/login`, `GET /api/yo`, wrong password 401, inactive user 401.
- Confirm in the database that `password_hash` never equals the plaintext and that no column stores the password in clear.

## Delivery
- Strategy: `feature-branch-chain`. Sequence: frontend chain (F1–F6) is in progress on `feat/nextjs-frontend`; this change lands on `feat/nestjs-backend` first, then the frontend login form is adjusted to `usuario`/`clave` in the same chain.
- No push or PR without the user's decision.

## Progress / Evidence
- 2026-10-11: decisions recorded (above), document created.
- 2026-10-11: user approved encrypted personal data and self-registration with manual activation.

## Deviations from the decisions above (writer, 2026-10-11)
- Login identifier is the **correo** (user instruction), not a separate `usuario`. There is no `usuario` column: `correo` is stored encrypted (`correo_cifrado`) with an HMAC index (`correo_indice`, unique), which is also the login lookup key. `nombre` is the display name (`nombre_completo` truncated to 60).
- `DATA_ENCRYPTION_KEY` is 32 bytes base64; two keys are derived with HKDF-SHA256 (`mis-procesos:cifrado:v1` and `mis-procesos:indice:v1`), so the index key is separate from the cipher key.
- Calendar token: `HMAC-SHA256(SESSION_SECRET, 'agenda-ics')[0:32]`, unchanged formula, new secret. The ICS legacy oracle fixture (`agenda/testing/legacy-ics.fixture.ts`) is kept because it pins the ICS output format, not the auth secret.
- `SESSION_SECRET` must be at least 32 characters; `DATA_ENCRYPTION_KEY` is optional at config level and required by registration, login and the `users:*` commands (503 generic message at runtime when missing).
- Health `claveConfigurada` now reports whether `DATA_ENCRYPTION_KEY` is configured.
- Operator-created accounts have no consent timestamp (`consentimiento_at` is null); self-registered ones always do.
- Rate limit: in memory, 5 failures per IP and correo in 15 minutes, then 429. Single instance only.

## Progress / Evidence (continued)
- 2026-10-11 U1 `feat(api): add scrypt password hashing and AES-GCM field encryption`: commit `1be7b7c`. Unit checks pass (`lint`, `typecheck`, `build`, `test` 133, `test:e2e` 88 at that point).
- 2026-10-11 U2 `feat(api): add usuarios table and repository`: commit `5687202`. Migration `1791676800000-usuarios`; repository e2e against `db-test` (5434) passes.
- 2026-10-11 U3 `feat(api): login by correo, self-registration and session by user id`: commit `6f504de`. Login, registration (inactive, 409 generic, consent required), session payload `[id, nombre, exp]`, legacy fixture removed, `APP_PASSWORD` removed. api unit 151 and e2e 104 passing.
- 2026-10-11 U4 `feat(api): add users operator commands`: commit `b4cceb8`. `users:create|activate|deactivate|password` (password never an argument, echo off on a terminal, piped input allowed, twice, min 12). Unit and e2e (`administracion-usuarios`) passing.
- 2026-10-11 U5 `feat(api): derive calendar token from SESSION_SECRET and refresh agenda tests`: commit `6dee80a`. Old-secret link rejected (401) in e2e.
- 2026-10-11 U6 `feat(web): login by correo and registration page`: commit `6df1985` (web lint, typecheck, test 36, build pass). Docs: README and CLAUDE.md updated in the following `docs` commit.
- 2026-10-11 Live smoke (dev DB 5432, API on port 3000, `REVISION_CRON=off`, env inline): `users:create` prueba.smoke ok; `POST /api/registro` 201; login inactive 401; `users:activate` ok; login 200; `GET /api/yo` 200; wrong password 401; SQL: 2 rows, both active, `password_hash` is scrypt and never equals the clave, no plaintext cédula, celular or correo in any column. Both throwaway users deleted from the dev DB (`DELETE 2`). Server stopped by PID; `/api/salud` no longer answers. CPNU reported a timeout from this sandbox (`rama`), unrelated to this change.

## Next step
- User: create `.env.example` (variables: `DATABASE_URL`, `SESSION_SECRET` generated with `openssl rand -hex 32`, `DATA_ENCRYPTION_KEY` generated with `openssl rand -base64 32`; back up the key), then create the real accounts with `npm run users:create -- ...`.
- User decides on push and PR. Branch `feat/usuarios-auth` has 6 work-unit commits plus docs.

