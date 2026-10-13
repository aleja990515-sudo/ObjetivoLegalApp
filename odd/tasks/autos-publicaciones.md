# Feature: autos-publicaciones

Locator: `odd/tasks/autos-publicaciones.md` · Branch: `feat/autos-publicaciones` (from `main`, worktree `../ObjetivoLegalApp-worktrees/autos-publicaciones`)

## Objective
Show the PDF of autos and other providencias for each proceso, like Litigio Virtual does, using only official public sources of the Rama Judicial.

## Why
The CPNU API (`/Proceso/DocumentosActuacion/{id}`) only returns documents for a few actuaciones. Verified 2026-10-11 with radicado 05001311001520260010000 (Juzgado 015 de Familia de Medellín): 20 actuaciones, 9 autos/sentencias, only 1 document (the acta de reparto). Four other CPNU routes (`Documentos`, `Providencias`, `Estados`, `DocumentosProceso`) return 404. The full autos are published in the electronic "estados" of each despacho on the Publicaciones Procesales portal (https://publicacionesprocesales.ramajudicial.gov.co, since 2024-05-14; older ones in "consulta histórica").

## Decisions (user, 2026-10-11)
- Source: the official Publicaciones Procesales portal (scraping). Litigio Virtual's private API is NOT used (third-party credentials, no contract).
- Work in three gated phases. Each phase ends with a go/no-go decision by the user.
- The office accepts that the portal is not a documented API and may change; the feature must fail soft (the app keeps working, autos just show "no disponible").

## Phase R — Research (read-only, bounded)
Questions to answer with evidence:
1. How the portal's AJAX filters work (`p_p_lifecycle=2`, `tipoFiltro`, `idFiltro`, `id`): why a bare request returns 200 with 0 bytes (cookies, `p_p_resource_id`, headers, `p_auth`?).
2. How to find the despacho id for "Juzgado 015 de Familia de Medellín" through the filters (departamento 05 Antioquia → municipio Medellín → entidad/especialidad → despacho).
3. How a search by despacho + date range returns publications (HTML table or JSON), and the format of each item (date, type, title, PDF link).
4. Whether a publication PDF (the "estado") lists the radicado and whether the auto is a separate PDF or embedded.
5. How to match a CPNU actuación (e.g. "Auto Decide" + its "Fijación Estado" date) to a publication.
6. `robots.txt` and any stated terms of use; observed rate limits or blocks.
Limits: at most 40 requests to the portal in total, at least 2 s between requests, no login, no captcha or protection bypass, stop immediately if blocked (403/429/captcha). No PDFs stored in the repo (scratchpad only, deleted afterwards). No personal data of the parties in the report beyond radicado and despacho.
Deliverable: a research note appended to this document (≤ 2k tokens) with URLs, parameters, trimmed sample responses and a go/no-go recommendation.

## Phase P — Proof with one despacho and one date (after R is a go)
A throwaway script in the scratchpad that, for the test radicado, finds the despacho, lists the publications for the dates of its autos, and identifies the auto PDF. Success = at least 3 of the 9 autos matched to a PDF.

## Phase I — Implementation (after P is a go)
Backend port `PublicacionesPort` + HTTP adapter with retries, timeouts, pacing and caching; mapping actuación → publication; endpoint for the frontend; tests with recorded fixtures; frontend "Ver auto" action. Detailed tasks are written after P.

## Progress / Evidence
- 2026-10-11: document created; phase R pending.

## Next step
See the end of this document.

## Phase R result (2026-10-11, read-only worker, 26 portal requests, 0 PDFs downloaded)
- Session: filters and search need the `JSESSIONID` cookie from a first `GET /web/publicaciones-procesales/inicio`; without it the AJAX answer is 200 with 0 bytes. No `p_auth`, no special headers.
- Despacho code = first 12 digits of the radicado (e.g. `050013110015`); the first page already lists all 5,755 despachos.
- Search: plain GET on `inicio` with `p_p_lifecycle=0`, `NS_action=busqueda`, `NS_fechaInicio`, `NS_fechaFin`, `NS_idDepto`, `NS_idDespacho`, `NS_verTotales=true`, `NS_idDeptoIdCategory`; HTML rows `tr.tramites` with title, type, publication date and a detail link (`NS_jspPage=/META-INF/resources/detail.jsp&NS_articleId=<id>`).
- Detail page lists each auto as its own PDF: `/c/document_library/get_file?uuid=<uuid>&groupId=6098902`. In Juzgado 015 de Familia de Medellín the file name contains `<year><consecutivo>` of the radicado (e.g. `031202600100ConcedeApelación-NiegaSolicitud.pdf`).
- Matching: search a window of a few days up to the CPNU "Fijación Estado" date (estados can be published before that date), then match `<year><consecutivo>` in the file names.
- Result: 9 of 9 autos of the test case matched to a PDF link.
- robots.txt disallows `/documents/`, `/c/document_library/`, `/dtd/` (all PDFs live under `/c/document_library/`). Search and detail pages are allowed. Terms of use page not readable by curl: unverified.
- Risks: Liferay HTML and portlet instance id `BIyXQFHVaYaq` can change; file naming is per-clerk habit, not a standard; PDFs contain third-party data.
- Recommendation: GO for phase P with conditions: the server only reads search/detail pages and returns the PDF link; it never fetches, stores or proxies the PDF (the user's browser opens it). Cache results hard, pace like CPNU. Phase P must test a second despacho with different file naming.

## Phase P decision (user, 2026-10-11)
- GO for phase P with the phase R conditions: server reads only search and detail pages and returns PDF links; it never fetches, stores or proxies PDFs.
- Second despacho for the proof: radicado 05001400302120250133300 (despacho code 050014003021). Regression: 05001311001520260010000.
- Budget: at most 80 portal requests across both cases, at least 2 s apart, throwaway script in the scratchpad only.

## Phase P result (2026-10-11, throwaway script in scratchpad, 74 of 80 portal requests, 0 PDFs downloaded)
- Case A (05001311001520260010000, Juzgado 015 de Familia de Medellín): 9 of 9 autos matched to an exact PDF by `<year><consecutivo>` in the file name. Needed window = auto date to fijación + 2 business days (a Friday fijación was published on Monday).
- Case B (05001400302120250133300, Juzgado 021 Civil Municipal de Medellín): 3 autos, 0 exact matches possible. This court publishes one combined `AUTOS<yyyymmdd>.pdf` and one `ESTADOS<yyyymmdd>.pdf` per estado; no radicado in the names. Only a low-confidence "PDF del día" can be offered; verifying the auto is inside would require opening the PDF, which robots.txt disallows.
- Proposed matcher, in order: skip date-only names (avoid false positives like `AUTOS20260611`); rule a `<year><consecutivo>`; rule b year and consecutivo with separators (`2025-01333`, `1333 de 2025`); rule c combined estado on the fijación date, labelled "PDF del día, revisar"; else link to the estado page.
- Portal reliability: one 504 and two 60 s timeouts, all recovered with one retry.
- Recommendation: GO for phase I with conditions: links only; confidence level visible in the UI; window to fijación + 2 business days; persist results per actuación and never re-search a resolved one; 60 s timeout, one retry on 5xx/timeout, stop on 403/429/captcha; tests from recorded fixtures of both naming styles; read the department data-id dynamically.

## Phase I (user GO 2026-10-13)
Conditions from phase P apply. TDD is off (user preference for this project); tests are still required, built from recorded and trimmed portal fixtures of both naming styles.

### Tasks
- [x] I1 Domain: matcher rules (skip date-only names; a `<year><consecutivo>`; b year+consecutivo with separators; c combined estado on the fijación date; else estado link), confidence levels `exacto` / `del_dia` / `estado` / `sin_resultado`, business-day search window (auto date to fijación + 2 business days, Colombian holidays not required in v1), estado title date parsing (both title formats). Unit tests.
- [x] I2 Adapter: `PublicacionesPort` + HTTP adapter: session cookie from the start page, department `data-id` read dynamically, search and detail parsing, 60 s timeout, one retry on 5xx/timeout, stop on 403/429/captcha, at least 2 s between portal requests (process-wide queue), never fetch `/c/document_library/`. Tests with recorded fixtures (trimmed HTML, no party data).
- [x] I3 Persistence: table `autos_publicados` keyed by actuación (confidence, PDF link, file name, estado link, estado number, publication date, searched at, attempts) + migration + repository. Resolved results (`exacto`, `del_dia`) are never searched again; `estado` and `sin_resultado` may be retried after 3 days, at most 5 attempts.
- [x] I4 Use case + endpoint: `GET /api/procesos/:id/actuaciones/:actuacionId/auto` returns the stored result or resolves it on demand (only for providencias). Session required. Response `{ confianza, urlPdf, nombreArchivo, urlEstado, numeroEstado, fechaPublicacion }`.
- [x] I5 Web: "Ver auto" on providencias in the detalle; shows the result with a confidence label ("PDF exacto", "PDF del día, revisar", "Ver estado", "No encontrado"); opens links in a new tab; loading and error states.
- [x] I6 Docs: README and CLAUDE.md (source, conditions, limits, robots.txt rule), feature doc progress.

### Progress (phase I, single delegated writer, TDD off by user preference; tests written after each implementation)
- 2026-10-13 I1 `1caf47d` feat(api): add the autos matcher, confidence levels and search window. Route: delegated writer.
- 2026-10-13 I2 `84c7b35` feat(api): add the Publicaciones Procesales adapter with pacing and retries. Fixtures recorded with 6 portal requests (start page, 3 searches, 2 estado details), trimmed to rows, titles and file tables.
- 2026-10-13 I3 `895c5f8` feat(api): persist autos results per actuacion (migration `AutosPublicados1791763200000`).
- 2026-10-13 I4 `942f484` feat(api): add the auto endpoint for providencias.
- 2026-10-13 I5 `4fc3891` feat(web): show "Ver auto" with its confidence level.
- 2026-10-13 I6 docs: README, CLAUDE.md and this document (this commit).

### Verification (2026-10-13)
- API: lint, typecheck, build pass; unit 221 tests pass; e2e 128 tests pass (shared db-test on 5434).
- Web: lint, typecheck, test (44 tests), build pass.
- Live smoke: API from the worktree on :3100 against the dev DB, throwaway user, case A "Auto Concede" (2026-09-14) answered `exacto` `031202600100ConcedeApelación-NiegaSolicitud.pdf` with a `get_file` link in 6 s (3 portal requests); the second call came from the DB with 0 requests. Throwaway user and proceso deleted; the dev DB migration was reverted (table dropped, `migraciones` row removed).
- Portal requests in phase I: 6 recording + 3 smoke = 9 of 30.

### Deviations
- Rule c (`del_dia`) also requires the publication type to be a notificación por estado and a file named like `AUTO*`/`PROVIDENC*` (the proof fell back to any non-estado file), so a `TRASLADOS<fecha>.pdf` is never offered.
- At most 4 estado detail pages are read per search; concurrent requests for the same actuación share one search.
- A portal failure answers 503 only when nothing is stored; otherwise the stored result is returned and no attempt is counted.

### Open items
- Colombian holidays in the business-day window.
- Second-instance procesos: the despacho comes from the radicado, so a tribunal estado is not searched.
- Merge with `fix/alineacion-frontend`: likely conflicts in `apps/web/src/features/detalle/actuaciones.tsx`.

## Next step
User review of the phase I commits; push and PR are the user's decision.
