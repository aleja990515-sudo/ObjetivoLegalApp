# Feature: procesos-privados-estados

Locator: `odd/tasks/procesos-privados-estados.md` · Engram mirror: `odd/procesos-privados-estados/tasks` · Branch: `feat/procesos-privados-estados` (from `main` @ 400aaff) · Worktree: `/home/santiago/Work/aioniq/ObjetivoLegalApp-worktrees/privados-estados`

## Objective
Let the office follow ANY radicado, including the ones the Rama marks private (`esPrivado: true`), by watching the court's published "estados" for the case instead of reading the CPNU expediente (which returns 404 for private cases).

## Problem (verified 2026-08-15 and 2026-10-15)
The app rejects private processes: `1 instancia(s) son privadas en la Rama Judicial y no se pueden seguir.`
- CPNU hides everything for a private case: `/Proceso/Detalle|Sujetos|Actuaciones/<id>` returns HTTP 404 `No se puede ver <X> de un proceso privado`, with and without `SoloActivos=true`.
- The rejection is deliberate and documented (`CLAUDE.md`, `README.md`): `procesos.service.ts` never hydrates nor inserts them, and `detect-instances.service.ts` skips them.
- **The estados channel does NOT inherit the reservation.** Proof: radicado `05001311000320260030200` is `esPrivado: true` in CPNU (`idProceso` 3276901971, subjects `--- [ PROCESO PRIVADO ] ---`, detail 404), yet it appears complete in estado 174 (fijación 14-oct-2026) of JUZGADO 003 DE FAMILIA DE MEDELLÍN: class `Procesos Ejecutivos`, claimant `Gladys Milena Giraldo Gutierrez`, defendant `Juan Esteban Jimenez Correa`, decision `Auto Libra Mandamiento Ejecutivo pago - Decrea Medidas`.
- The estados search form has NO radicado field (only `fechaInicio`, `fechaFin`, `idDepto`, `idDespacho`, `idDeptoIdCategory`, `verTotales`, `cur`), so the only way to know whether a case appears in an estado is to read the estado's own `LISTADO <n>.pdf`.

## Decisions
- **User (2026-10-15): "Bajar el PDF y buscar el radicado"**, over keeping only a data-less record and over not supporting privates at all. Accepted consequence: it goes against the portal `robots.txt` (`Disallow: /c/document_library/`), which this repo had deliberately respected.
- **User (2026-10-15): "Worktree aparte desde main"** so the uncommitted `radicados-por-usuario` work is not mixed into this branch.
- **Identity of the case = the radicado without its last two digits.** Confirmed by the Rama's own Acuerdo 201/1997 + Acuerdo 1463/2002 and the CPNU manual: `05001|31|10|003|2026|00662|00` = DANE + corporation + specialty + court + year + consecutive + **consecutive of recursos**, where `00` is first instance and `01/02/03` are later instances, and the consecutive "no cambia (solo cambian los últimos dos dígitos cuando hay recursos)". So `clave_caso` = first 21 digits.
- **Notification is in-app**, reusing the existing `novedades` mechanism. No email/push: the repo has no messaging infrastructure and adding a mail provider is a separate decision.
- **No new npm dependency for PDF text.** Verified that `zlib.inflate` + `Tj`/`TJ` operator extraction reads a real `LISTADO` PDF correctly (11 radicados extracted from estado 174, identical to `pdftotext -layout`). A hand-rolled parser is risky, so it fails loudly: a `LISTADO` that yields zero radicados is recorded as unreadable, never as "case not found".

## Scope
- In: `es_privado` + `clave_caso` columns; saving private processes; skipping CPNU hydration/refresh for them; PDF text extraction; allowing the LISTADO download; the periodic estados sweep; a detections table + its API/UI surface; docs.
- Out: email/push/WhatsApp notifications; reading private cases' actuaciones (impossible); automatic linking of a case to a different court (tribunal) radicado; the `radicados-por-usuario` work (separate branch).

## Known limitations (accepted)
- A case that moves to the superior court keeps its consecutive but changes the court code (the circular orders positions 10-12 to `000` in tribunals), so the sweep of the original court will not see it. `shortcut: same-court matching only; upgrade if the office needs tribunal follow-up`.
- Estado matches for a private case carry only what the estado shows (court, radicado, sometimes parties and the decision). There is no way to corroborate parties against CPNU because CPNU hides them.
- The portal paginates its own search; the existing `buscarEstados` does a single unpaginated GET, so the sweep must use a narrow date window (since the last run) instead of the whole year.

## Tasks
- [x] T1 Migration + entity + mapper: `procesos.es_privado boolean not null default false`; save private processes from the CPNU data already returned (despacho, sujetosTexto) without hydrating; skip them in the CPNU refresh; keep `detect-instances` skipping private instances.
- [ ] T2 Identity: `procesos.clave_caso text` (radicado minus the 2 recurso digits) + index + backfill; `claveCaso()` domain helper with tests.
- [ ] T3 PDF reader without dependencies: `extraerTextoPdf(buffer)` + `radicadosEnTexto(texto)`; unit tests over a deflate-compressed fixture that mimics the real generator.
- [ ] T4 Allow the LISTADO download: widen `validarRutaPortal` for `/c/document_library/get_file`, add a size-capped binary `descargar()` on the publicaciones adapter; update the adapter spec and the documented decision.
- [ ] T5 Periodic sweep: `EstadosService.revisar()` + its own `CronJob` (`ESTADOS_CRON`, `off` disables), narrow window, `LISTADO` selection, match by full radicado or `clave_caso`, paced through the shared portal queue.
- [ ] T6 Detections: `estados_proceso` table + repository + `GET /api/estados` and inclusion in `novedades`; `visto` cleared when the proceso detail is read.
- [ ] T7 Web: replace the rejection message with the "private, we watch the estados" notice; show detected estados in the proceso detail.
- [ ] T8 Docs: `CLAUDE.md` gotcha, `README.md`, feature doc progress with commit identities.

## Progress
- 2026-10-15: feature doc created. Worktree + branch created from `main` @ 400aaff.
- 2026-10-15 **T1 done.** `procesos.es_privado` (migration `1791936000000-procesos-privados`), `Proceso`/`ProcesoEntity`/mapper/`ProcesoResumen` carry it, `newProceso` nulls `sujetosTexto` for private cases, `ProcesosService.add()` inserts them and answers their resumen without hydrating, `RefreshProcesoService.refresh()` returns untouched for a private proceso (no CPNU call, no error). `ProcesoPrivado` kept as `@deprecated` for the web task. Checks: `npm run typecheck -w apps/api` clean; `npm test -w apps/api` 28 files / 224 tests; `npm run lint -w apps/api` 5 pre-existing warnings, 0 errors; `npm run test:e2e -w apps/api` 129 tests (run against a fresh throwaway test DB because another worktree was using the shared one). Work-unit commit: `feat(api): store private procesos instead of rejecting them`. Note: `git checkout -- package-lock.json` was needed because `npm install` resyncs `apps/web`'s stale `engines` entry (`>=24 <25`) — unrelated churn, reverted.

## Verification
- `npm test -w apps/api` (vitest) and `npm run test:api`; `npm run lint:web`, `npm run typecheck:web`, `npm run test:web` for the web slice.
- Manual, needs the portal: `POST /api/procesos` with `05001311000320260030200` (public? no: private but PUBLISHED in estado 174) must store the proceso and the sweep must flag estado 174 within its window.
