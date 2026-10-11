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
- Icons: Phosphor, vendored SVG symbols or `@phosphor-icons/react` (one family only).
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
- [ ] F3 Lista + novedades: process list with search/filter/only-new toggle, add-radicado form (field `radicado`, `alias`), empty and error states, skeletons.
- [ ] F4 Detalle + agenda: detail header, tasks (add/toggle/delete), notes (add/delete), actuaciones with documents links, visto/actualizar/editar responsable and etiquetas; agenda with tasks list and calendar subscription links (`ics`, webcal, Google).
- [ ] F5 Quality: component tests (Vitest + Testing Library), an e2e smoke (Playwright, optional if the browser is available; report if skipped), contrast/a11y checks, mobile widths 360/390/1280 screenshots light and dark.
- [ ] F6 Docs + ops: README and CLAUDE.md updated for the web app and dev flow (API on 3000, web on 3001), feature doc progress.

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

## Next step
Writer 2 (F3–F6) after the backend login change lands and this commit is checked.
