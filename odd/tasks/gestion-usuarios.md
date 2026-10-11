# Feature: gestion-usuarios

Locator: `odd/tasks/gestion-usuarios.md` · Branch: `feat/gestion-usuarios` (from `main`)

## Objective
Administrator-only user management with roles. Roles live in a join table; the `usuarios` table is not changed.

## Decisions (user, 2026-10-11)
- Fixed role list: `administrador` and `usuario`. No role creation from the app.
- Roles are modelled as: `roles(id, nombre unique)` seeded with the two rows by migration, and `usuario_roles(usuario_id FK, rol_id FK, asignado_en, asignado_por FK nullable, PK(usuario_id, rol_id))`. `usuarios` gets no role column.
- Roles are explicit rows, never implied. The migration gives the `usuario` role to every account that exists at migration time, so current users keep access. New accounts get `usuario` on creation or activation (decide in U1 and record it here).
- Roles are read from the database on each protected request (not stored in the session cookie), so a role change or deactivation applies immediately.
- Bootstrap: CLI `users:role-add <correo> administrador` and `users:role-remove <correo> administrador`. No password argument.
- Safety rules: an administrator cannot remove their own `administrador` role, cannot deactivate their own account, and the system refuses any change that would leave zero active administrators.
- TDD is OFF for this feature (same user preference as usuarios-auth). Checks still run before each commit.

## Scope
- Migration: `roles` (seeded), `usuario_roles`, backfill `usuario` role for existing accounts.
- Backend: `RolesGuard` + `@Roles('administrador')` decorator; roles loaded per request. Admin endpoints under `/api/admin/usuarios`:
  - `GET /api/admin/usuarios` → list `{ id, nombre, correo, activo, roles: string[], creado }`.
  - `PATCH /api/admin/usuarios/:id` body `{ activo: boolean }`.
  - `PUT /api/admin/usuarios/:id/roles/:rol` → assign (201/200, idempotent).
  - `DELETE /api/admin/usuarios/:id/roles/:rol` → remove.
  - Non-admin on any admin route → 403 `{ error: 'No tienes permiso para esta acción.' }`. Not logged in → 401 as today.
  - `GET /api/yo` gains `roles: string[]` (additive; `nombre` unchanged).
  - Refusals (409 or 400, Spanish `{ error }`): removing own admin role, deactivating self, leaving zero active administrators, unknown role (404 `Rol no encontrado.`), unknown user (404 `Usuario no encontrado.`).
- CLI: `users:role-add`, `users:role-remove` wired in `apps/api/package.json` and root `package.json`, same style as `users:activate`.
- Frontend (`apps/web`): `/api/yo` roles in the session model; sidebar item "Usuarios" only for administrators; page `/admin/usuarios` (list with activo toggle and role checkboxes per user, Spanish copy, shadcn components, skeleton and error states). Non-admins who open the route are redirected to `/`.
- Docs: README and CLAUDE.md (roles, `users:role-*`, admin page), feature doc progress.

## Checks
- `npm run -w apps/api lint|typecheck|build|test`, `npm run test:e2e` (test DB on 5434).
- `npm run lint:web|typecheck:web|test:web|build:web`.
- Live smoke on dev DB (5432): create two throwaway accounts, activate one, `users:role-add` it as administrador, log in as admin, list users, assign/remove `usuario`, attempt self-deactivation (refused), attempt to remove last admin (refused), log in as non-admin and call an admin route (403). Delete the throwaway accounts at the end and say so.

## Delivery
- Branch chain: from `main` (already contains the accounts feature). Push and PR are the user's decision.
