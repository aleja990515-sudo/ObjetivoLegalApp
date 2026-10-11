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
Delegate phase R to one read-only research worker.
