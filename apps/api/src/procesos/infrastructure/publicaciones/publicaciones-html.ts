// Parsers of the Publicaciones Procesales HTML (Liferay portlet). Only the
// markup kept in testing/fixtures/publicaciones is relied on.

import type { ArchivoPublicado, EstadoPublicado } from '../../domain/autos.js';

export const PORTAL_ORIGIN = 'https://publicacionesprocesales.ramajudicial.gov.co';

function decodificar(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

const texto = (html: string): string => decodificar(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().normalize('NFC');

/** `data-id` of every department option of the start page, by department code ("05" -> "178845807"). */
export function parseCategoriasDepartamento(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of html.matchAll(/<option\b[^>]*>/gi)) {
    const id = m[0].match(/data-id="(\d+)"/)?.[1];
    const valor = m[0].match(/value="(\d{2})"/)?.[1];
    if (id && valor && !out.has(valor)) out.set(valor, id);
  }
  return out;
}

/** Rows (`tr.tramites`) of a search result page. */
export function parseBusqueda(html: string): EstadoPublicado[] {
  const out: EstadoPublicado[] = [];
  for (const m of html.matchAll(/<tr[^>]*class="[^"]*\btramites\b[^"]*"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const fila = m[1];
    const enlace = fila.match(/<a\s[^>]*href="([^"]*articleId[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!enlace) continue;
    out.push({
      titulo: texto(enlace[2]),
      tipo: texto(fila.match(/Tipo de publicaci[oó]n:([^<]*)/i)?.[1] ?? ''),
      fechaPublicacion: fila.match(/publish-date"[^>]*>[\s\S]*?(\d{4}-\d{2}-\d{2})/)?.[1] ?? null,
      urlEstado: new URL(decodificar(enlace[1]), PORTAL_ORIGIN).toString(),
    });
  }
  return out;
}

/** Files (`/c/document_library/get_file` links) of a publication detail page. */
export function parseDetalle(html: string): ArchivoPublicado[] {
  const out = new Map<string, ArchivoPublicado>();
  for (const m of html.matchAll(/<a\s[^>]*href="([^"]*\/c\/document_library\/get_file\?[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = new URL(decodificar(m[1]), PORTAL_ORIGIN);
    const nombre = texto(m[2]) || url.searchParams.get('title') || 'Documento';
    if (!out.has(url.toString())) out.set(url.toString(), { nombre, url: url.toString() });
  }
  return [...out.values()];
}
