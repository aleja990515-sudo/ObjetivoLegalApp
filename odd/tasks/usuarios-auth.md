# Feature: usuarios-auth

Locator: `odd/tasks/usuarios-auth.md` · Engram mirror: `odd/usuarios-auth/tasks` · Branch: to be created from `feat/nestjs-backend` after the frontend chain is checked, or as a sub-chain (decide at delegation time; default: stack on `feat/nestjs-backend`).

## Objective
Replace the single shared office password with real accounts stored in PostgreSQL. The shared `APP_PASSWORD` becomes the password of one test account only.

## Decisions (user, 2026-10-11)
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

## Tasks (TDD: RED before GREEN for every behaviour)
- [ ] U1 Domain: `Usuario` type, username and password policy, scrypt hashing port and adapter with known-answer tests (format `scrypt$N$r$p$salt$hash`, verify constant time, rehash-needed check).
- [ ] U2 Persistence: entity, migration `usuarios`, repository (find by usuario, create, set password), tests against Postgres.
- [ ] U3 Auth flow: login by usuario/clave, generic failure, inactive user rejected, rate limit per IP+usuario, session payload with user id, `SESSION_SECRET` required, `APP_PASSWORD` removed from config and code.
- [ ] U4 CLI: `users:create` and `users:password` (no password arguments, echo off, confirm twice, minimum length 12), with tests for the non-interactive core.
- [ ] U5 ICS/agenda: token from `SESSION_SECRET`; update the agenda e2e and the calendar test; regenerate note in docs.
- [ ] U6 Cleanup and docs: remove the legacy-cookie fixture and its tests, update README and CLAUDE.md (env vars, `users:create`), feature doc progress.

## Checks
- `npm test -w apps/api`, `npm run -w apps/api test:e2e` (Docker test DB on 5434), `typecheck`, `lint`, `build`, all under `mise exec --`.
- Manual: create the test account with `users:create`, log in through `POST /api/login`, `GET /api/yo`, wrong password 401, inactive user 401.
- Confirm in the database that `password_hash` never equals the plaintext and that no column stores the password in clear.

## Delivery
- Strategy: `feature-branch-chain`. Sequence: frontend chain (F1–F6) is in progress on `feat/nextjs-frontend`; this change lands on `feat/nestjs-backend` first, then the frontend login form is adjusted to `usuario`/`clave` in the same chain.
- No push or PR without the user's decision.

## Progress / Evidence
- 2026-10-11: decisions recorded (above), document created.

## Next step
After the frontend F1–F2 writer finishes: delegate U1–U6 on the backend branch.
