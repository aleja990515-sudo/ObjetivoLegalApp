# Feature: nextjs-frontend

Locator: `odd/tasks/nextjs-frontend.md` · Engram mirror: `odd/nextjs-frontend/tasks` · Branch: `feat/nextjs-frontend` (chained on `feat/nestjs-backend`)

## Objective
Phase 2 of the incremental migration: a Next.js frontend in `apps/web` that replaces the vanilla `public/` UI, consumes the NestJS API from phase 1 unchanged, and adds the professional sidebar shell (T5 of `ui-redesign`, on hold until now).

## Why
User decisions (2026-10-10): migrate to NestJS + Next.js incrementally; sidebar layout for a more professional look. The design tokens, fonts and icons from `feat/ui-redesign` are the visual reference and are carried over.

## Scope
- In: `apps/web` (Next.js 16.4, App Router, TypeScript, React); npm workspace; same-origin `/api` via Next rewrites; sidebar shell; views login, lista, detalle, novedades, agenda; loading/empty/error states; tests; docs.
- Out: backend changes (contract is frozen to phase 1); removing `public/` (legacy UI stays served by Nest until cutover, a later decision); people locator; Render deploy config (later).

## Constraints
- Next.js 16.4.0 (`engines.node >=20.9`); runs on Node 26.11.1 pinned in `.mise.toml`.
- Same-origin cookies: the browser talks only to Next; `next.config` rewrites `/api/:path*` to `API_ORIGIN` (env, default `http://localhost:3000`). No CORS. The `sesion` cookie stays first-party.
- Dev ports: API 3000 (`PORT`), web 3001.
- Styling: Tailwind CSS v4 (`@tailwindcss/postcss`) with shadcn/ui components (`base-vega` preset, neutral base colour, CSS variables; the `new-york` style no longer exists in the current CLI). One token source: the custom properties from `feat/ui-redesign:public/styles.css` (emerald accent, neutral zinc, radius 8/12/pill, Geist + Geist Mono via `next/font/local`) are mapped into `@theme inline` and shadcn's colour names in `apps/web/src/app/globals.css`. No CSS Modules for shadcn-covered elements. Decision: coordinator, 2026-10-10 (replaces the earlier no-Tailwind rule).
- Icons: Phosphor, regular weight, from `@phosphor-icons/react` 2.1.10 (decision, F3: the vendored `public/icons.svg` sprite and its `Icon` helper were removed; one family only). The user may change any icon later.
- Accessibility: WCAG AA contrast, visible focus, `prefers-reduced-motion` honoured, 360px width with no horizontal scroll, `safe-area` insets in the mobile bar.
- Copy: Spanish, no em/en dashes in visible text, same wording as the legacy UI where the view already exists.
- Contract: every request/response shape is the one documented by phase 1 (`apps/api` controllers). Read the controllers and DTO-like types before wiring a view.

## Shell (sidebar) spec
- ≥ 960px: fixed left sidebar (brand, Procesos / Novedades / Agenda with icon and count badge, footer with user name, "Revisar todos", "Salir").
- 640–959px: icon rail with accessible names.
- < 640px: bottom tab bar with safe-area inset; slim top bar with brand.
- Content: page header (title + primary action), max width container, process list as aligned columns on desktop (name/radicado, despacho, última actuación, estado) collapsing to stacked cards on mobile.
- Login is shell-less.

## Tasks
- [x] F1 Scaffold: `apps/web` with Next 16.4, TS, npm workspace entry, `next.config` rewrites, tokens + fonts from the redesign branch, root `dev:web` / `build:web` / `start:web` scripts, `.env.example` note (not created by agents; see open items).
- [x] F2 Shell: sidebar layout (responsive rules above), route groups: `(auth)/login` and `(app)/...`, session guard (calls `/api/yo`, redirects to login on 401), logout, "Revisar todos" wired to `POST /api/procesos/…` contract (see phase 1 controllers).
- [x] F3 Lista + novedades: process list with search/filter/only-new toggle, add-radicado form (field `radicado`, `alias`), empty and error states, skeletons.
- [x] F4 Detalle + agenda: detail header, tasks (add/toggle/delete), notes (add/delete), actuaciones with documents links, visto/actualizar/editar responsable and etiquetas; agenda with tasks list and calendar subscription links (`ics`, webcal, Google).
- [x] F5 Quality (e2e Playwright skipped: not installed and not requested; screenshots and a11y checks done): component tests (Vitest + Testing Library), an e2e smoke (Playwright, optional if the browser is available; report if skipped), contrast/a11y checks, mobile widths 360/390/1280 screenshots light and dark.
- [x] F6 Docs + ops: README and CLAUDE.md updated for the web app and dev flow (API on 3000, web on 3001), feature doc progress.

## Route per task
Delegated direct. Writer 1 does F1–F2 (foundation and shell). Writer 2 starts only after writer 1 is committed and checked: F3–F6. One writer at a time. One Conventional Commit per task. No AI attribution lines.

## Checks
- `npm run -w apps/web lint`, `typecheck`, `build`, `test`.
- API running (`npm run dev:api`, Podman/Docker DB on 5432) and web dev server: `curl` through the web origin for `/api/salud`, `/api/yo` (401 without cookie), and the page returns HTML.
- Visual screenshots (light/dark, 390 and 1280) if headless Chromium is available.

## Delivery
- Strategy: `feature-branch-chain` (user decision): this branch chains on `feat/nestjs-backend`; final PR to `main` after Render decision.
- RDD: off (global). Push/PR are the user's decision.

## Progress / Evidence
- 2026-10-11: branch created from `feat/nestjs-backend`, `.mise.toml` pin committed, document created.

- 2026-10-10 F1 committed (a05782b, `feat(web): scaffold Next.js app with same-origin API rewrites`): `npm run -w apps/web build` passed, lint and typecheck passed; dev servers answered `/api/salud` 200 through port 3001, `/api/yo` 401 without session, `/login` 200 HTML.
- 2026-10-10 F2 committed (df35067, `feat(web): add sidebar shell, login and session guard`): TDD RED observed for 3 test files (module-not-found, before implementation); GREEN: 5 tests pass (SessionGuard redirects on 401, Sidebar aria-current, LoginForm server error and `{usuario, clave}` body). Build, lint, typecheck green. Live check through the web origin: login with the current API (`nombre` body) returned 200 and `/api/yo` 200 with the cookie jar; the `{usuario, clave}` body is pending the backend change (currently 401 from the API). Screenshots at 390 and 1280, light and dark: see shell and login captures in the session scratchpad. Shadcn components added: button, input, label, card, badge, skeleton, separator.

- 2026-10-10 F3 committed (8a9f42b, `feat(web): add lista de procesos and novedades views`). RED observed before implementation (module not found): `filtros.test.ts`, `formato.test.ts`, `vista-lista.test.tsx`, `vista-novedades.test.tsx`. GREEN: filter by radicado/alias/parte/despacho/responsable/etiqueta, "Solo con novedades", 409 message from the API, 23-digit check before POST, empty state, column headers. Icon migration: sprite and `Icon` helper removed; Phosphor 2.1.10 (regular) used in sidebar, app shell and views.
- 2026-10-10 F4 committed (7f4f63c, `feat(web): add detalle de proceso and agenda views`). RED observed (module not found): `vista-detalle.test.tsx` ("alterna una tarea con PATCH…", "pide confirmación antes de quitar el proceso…"), `vista-agenda.test.tsx` ("agrupa las pendientes…", "ofrece la suscripción…"), `texto-compartir.test.ts`. GREEN after implementation.
- 2026-10-10 F5 committed (69bf48e, `test(web): add a11y and contrast checks and detalle delete test`). `npm run test:web`: 31 tests in 11 files pass; the delete-confirm test ("al confirmar, quita el proceso…") passed on first run because the behaviour was already implemented in F4. axe-core 4.13.0 (dev; 4.14.0 is under two weeks old) on lista, novedades, detalle and agenda: no violations (page-level rules and color-contrast disabled in jsdom). WCAG AA for the token pairs in `globals.css`, light and dark: pass.
- 2026-10-10 F6 committed (f504ca7, `docs(web): document the Next.js app, dev order and checks`): `apps/web/README.md` (Spanish), root `README.md` (web dev step and `test:web`), `CLAUDE.md` (tracked, so updated, not left untracked).
- Gates on F5: `npm run -w apps/web lint` (oxlint, clean), `typecheck` (exit 0), `test` (31 passed), `build` (exit 0, routes `/`, `/novedades`, `/agenda`, `/procesos/[id]` dynamic).
- Live check: API on 3000 and web on 3001 started; `GET /api/salud` 200 on both (web through the rewrite); `/login` 200. Login through the web origin with the API's current body (`nombre`) returned 200; `/api/yo`, `/api/procesos`, `/api/novedades`, `/api/agenda` 200 with the cookie. The local database has no processes or tasks for this user, so populated states were checked with mocked API payloads intercepted in Chromium (no DB writes). Captures at 360 and 1280, light and dark, for lista, novedades, agenda and detalle: no horizontal overflow (scrollWidth ≤ viewport). Visually reviewed: lista 1280 light and 360 dark, agenda 1280 light, detalle 1280 light. Captures are in the session scratchpad, not in the repo.
- Deviations: no "Calcular término" (días hábiles) calculator in the agenda, since it was not in the F4 scope (it needs `Festivos` port). Legacy `sessionStorage` memory of filters and tabs is not ported. Rename uses an inline form instead of `prompt()`. Share uses the WhatsApp, mail and copy actions only (no `navigator.share`). Documents are fetched on demand per actuación.
- Open items: (1) the web login form sends `{usuario, clave}` but the API still expects `nombre`, so login from the browser fails until the backend login change lands (another task); the authenticated views were verified with the `nombre` body and mocks. (2) `.env.example` is a user action (not created by agents). (3) Engram mirror `odd/nextjs-frontend/tasks` is not updated by this writer; the parent must resynchronise it from this document. (4) Please verify visually: the mobile bottom bar over long cards, the Phosphor icon set, and the detalle sections below the fold (notas, sujetos, actuaciones), which were not captured.

## Next step
Parent: resynchronise the Engram mirror, review the open items above, then the login body change on the backend and a live login check from the web form.
