import { realSleep, type Sleep } from '../../../common/time/sleep.js';
import { epochMsAhora } from '../../../common/time/temporal.js';
import {
  PortalBloqueadoError,
  PortalNoDisponibleError,
  type BusquedaEstados,
  type PublicacionesPort,
} from '../../application/ports/publicaciones.port.js';
import type { ArchivoPublicado, EstadoPublicado } from '../../domain/autos.js';
import { colaPortalCompartida, type ColaPortal } from './cola-portal.js';
import { parseBusqueda, parseCategoriasDepartamento, parseDetalle, PORTAL_ORIGIN } from './publicaciones-html.js';

export { PORTAL_ORIGIN };
export const PORTAL_INICIO = `${PORTAL_ORIGIN}/web/publicaciones-procesales/inicio`;
export const PORTAL_TIMEOUT_MS = 60_000;
/** Pause before the single retry of a timeout or 5xx answer (the queue adds its own interval). */
export const PORTAL_PAUSA_REINTENTO_MS = 5_000;
/** The JSESSIONID cookie and department ids are refreshed after this time. */
export const PORTAL_SESION_MS = 15 * 60_000;
/** After a block (403, 429, captcha) no request is sent for this time. */
export const PORTAL_ENFRIAMIENTO_MS = 30 * 60_000;
/**
 * Ceiling of one document download. A real `LISTADO` is ~36 KB; 8 MB only stops
 * a runaway answer from filling memory.
 */
export const MAX_DESCARGA_BYTES = 8 * 1024 * 1024;
const MAX_DETALLES_EN_CACHE = 200;
const MAX_REDIRECCIONES = 2;

const PORTLET = 'co_com_avanti_efectosProcesales_PublicacionesEfectosProcesalesPortletV2_INSTANCE_BIyXQFHVaYaq';
const NS = `_${PORTLET}_`;
const HEADERS = { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 SeguimientoProcesos' };
const PAGINA_DE_BLOQUEO = /captcha|access denied|request rejected/i;
/** An answer with one of these content types is not a document. */
const TIPOS_NO_DOCUMENTO = /^(text\/|application\/(json|xhtml\+xml))/;

/** robots.txt of the portal disallows these paths; PDFs live under the first one. */
const RUTAS_PROHIBIDAS = [/^\/c\/document_library\//i, /^\/documents\//i, /^\/dtd\//i];

/**
 * The only document this server fetches: the `LISTADO <n>.pdf` of an estado.
 * Deliberate exception to the robots.txt rule (`Disallow: /c/document_library/`),
 * authorised by the office, because the estados channel does not inherit the
 * reservation of a private case and the listing is the only place that says
 * whether the case was published. Every other path under `/c/document_library/`
 * stays forbidden.
 */
const RUTA_LISTADO = '/c/document_library/get_file';

/**
 * Guard of every request: pages of the portal under `/web/publicaciones-procesales/`,
 * plus the `LISTADO` document path, never another path robots.txt disallows.
 */
export function validarRutaPortal(url: string): URL {
  const destino = new URL(url, PORTAL_ORIGIN);
  const ruta = decodeURIComponent(destino.pathname);
  const listado = destino.pathname === RUTA_LISTADO && destino.searchParams.has('uuid');
  if (
    destino.origin !== PORTAL_ORIGIN ||
    (!listado && RUTAS_PROHIBIDAS.some((r) => r.test(ruta))) ||
    (!listado && !ruta.startsWith('/web/publicaciones-procesales/'))
  ) {
    throw new Error(`Ruta del portal no permitida: ${destino.origin}${destino.pathname}`);
  }
  return destino;
}

class Reintentable extends Error {}

/** One answer of the portal, still as bytes (an HTML page or a document). */
interface RespuestaPortal {
  status: number;
  cuerpo: Buffer;
  /** `Content-Type` without parameters and lowercased; null when the header is missing. */
  tipo: string | null;
  ubicacion: string | null;
}

export interface OpcionesPublicacionesHttp {
  fetch?: typeof fetch;
  sleep?: Sleep;
  cola?: ColaPortal;
  ahora?: () => number;
}

/**
 * Scraper of https://publicacionesprocesales.ramajudicial.gov.co. Every request
 * goes through the process-wide queue (one at a time, 2 s apart), times out
 * after 60 s and is retried once on timeout or 5xx. A 403, 429 or captcha page
 * stops the adapter for 30 minutes with {@link PortalBloqueadoError}.
 */
export class PublicacionesHttpAdapter implements PublicacionesPort {
  private readonly fetch: typeof fetch;
  private readonly sleep: Sleep;
  private readonly cola: ColaPortal;
  private readonly ahora: () => number;
  private cookies = new Map<string, string>();
  private categorias = new Map<string, string>();
  private sesionDesde = Number.NEGATIVE_INFINITY;
  private bloqueadoHasta = Number.NEGATIVE_INFINITY;
  private readonly detalles = new Map<string, ArchivoPublicado[]>();

  constructor(opciones: OpcionesPublicacionesHttp = {}) {
    this.fetch = opciones.fetch ?? globalThis.fetch;
    this.sleep = opciones.sleep ?? realSleep;
    this.cola = opciones.cola ?? colaPortalCompartida;
    this.ahora = opciones.ahora ?? epochMsAhora;
  }

  async buscarEstados({ despacho, desde, hasta }: BusquedaEstados): Promise<EstadoPublicado[]> {
    if (!/^\d{12}$/.test(despacho)) return [];
    await this.asegurarSesion();
    let html = await this.get(this.urlBusqueda(despacho, desde, hasta));
    if (html === null) return [];
    if (!html.trim()) {
      // An expired session answers 200 with an empty body: open a new one once.
      await this.asegurarSesion(true);
      html = (await this.get(this.urlBusqueda(despacho, desde, hasta))) ?? '';
    }
    return parseBusqueda(html);
  }

  async listarArchivos(estado: EstadoPublicado): Promise<ArchivoPublicado[]> {
    const url = validarRutaPortal(estado.urlEstado).toString();
    const enCache = this.detalles.get(url);
    if (enCache) return enCache;
    if (!this.cookies.size) await this.asegurarSesion();
    const archivos = parseDetalle((await this.get(url)) ?? '');
    if (this.detalles.size >= MAX_DETALLES_EN_CACHE) this.detalles.delete(this.detalles.keys().next().value as string);
    this.detalles.set(url, archivos);
    return archivos;
  }

  /**
   * Downloads the `LISTADO` of an estado through the same queue and session as the
   * other requests. Answers `null` instead of failing when the portal handed back
   * something that is not a usable document (an HTTP error, an empty body, HTML
   * or JSON, or more than {@link MAX_DESCARGA_BYTES}); a non-allowed route still
   * throws, because a guard must not fail silently.
   */
  async descargar(url: string): Promise<Buffer | null> {
    validarRutaPortal(url);
    try {
      if (!this.cookies.size) await this.asegurarSesion();
      const { cuerpo, tipo } = await this.pedirConReintento(url);
      return esDocumento(cuerpo, tipo) ? cuerpo : null;
    } catch (error) {
      // The adapter already remembered the cool-down, so a block is a "no document"
      // here and the caller keeps its loop free of portal failures.
      if (error instanceof PortalBloqueadoError || error instanceof PortalNoDisponibleError || error instanceof Reintentable) return null;
      throw error;
    }
  }

  private urlBusqueda(despacho: string, desde: string, hasta: string): string | null {
    const depto = despacho.slice(0, 2);
    const categoria = this.categorias.get(depto);
    if (!categoria) return null;
    const url = new URL(PORTAL_INICIO);
    const params: Record<string, string> = {
      p_p_id: PORTLET,
      p_p_lifecycle: '0',
      p_p_state: 'normal',
      p_p_mode: 'view',
      [`${NS}action`]: 'busqueda',
      [`${NS}fechaInicio`]: desde,
      [`${NS}fechaFin`]: hasta,
      [`${NS}idDepto`]: depto,
      [`${NS}idDespacho`]: despacho,
      [`${NS}verTotales`]: 'true',
      [`${NS}idDeptoIdCategory`]: categoria,
    };
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return url.toString();
  }

  /** Opens a session (JSESSIONID) and reads the department ids from the start page. */
  private async asegurarSesion(forzar = false): Promise<void> {
    if (!forzar && this.cookies.size && this.ahora() - this.sesionDesde < PORTAL_SESION_MS) return;
    this.cookies.clear();
    const html = (await this.get(PORTAL_INICIO)) ?? '';
    const categorias = parseCategoriasDepartamento(html);
    if (!categorias.size) throw new PortalNoDisponibleError();
    this.categorias = categorias;
    this.sesionDesde = this.ahora();
  }

  /** GET with one retry on timeout or 5xx. `null` url means "nothing to ask" (unknown department). */
  private async get(url: string | null): Promise<string | null> {
    if (url === null) return null;
    try {
      return (await this.pedirConReintento(url)).cuerpo.toString('utf8');
    } catch (error) {
      if (error instanceof Reintentable) throw new PortalNoDisponibleError();
      throw error;
    }
  }

  /** GET with one retry on timeout or 5xx; a second failure escapes as `Reintentable`. */
  private async pedirConReintento(url: string): Promise<RespuestaPortal> {
    try {
      return await this.pedir(url, 0);
    } catch (error) {
      if (!(error instanceof Reintentable)) throw error;
      await this.sleep(PORTAL_PAUSA_REINTENTO_MS);
      return await this.pedir(url, 0);
    }
  }

  private async pedir(url: string, saltos: number): Promise<RespuestaPortal> {
    const destino = validarRutaPortal(url);
    if (this.ahora() < this.bloqueadoHasta) throw new PortalBloqueadoError();
    const respuesta = await this.cola.turno(() => this.unaSolicitud(destino));
    const { status, cuerpo, ubicacion } = respuesta;
    if (status === 403 || status === 429 || PAGINA_DE_BLOQUEO.test(cuerpo.subarray(0, 5000).toString('utf8'))) {
      this.bloqueadoHasta = this.ahora() + PORTAL_ENFRIAMIENTO_MS;
      throw new PortalBloqueadoError();
    }
    if (status >= 300 && status < 400 && ubicacion && saltos < MAX_REDIRECCIONES) {
      return this.pedir(new URL(ubicacion, destino).toString(), saltos + 1);
    }
    if (status >= 500) throw new Reintentable(`HTTP ${status}`);
    if (status < 200 || status >= 300) throw new PortalNoDisponibleError(`Publicaciones Procesales respondió ${status}`);
    return respuesta;
  }

  private async unaSolicitud(destino: URL): Promise<RespuestaPortal> {
    // A block can start while this request waited in the queue.
    if (this.ahora() < this.bloqueadoHasta) throw new PortalBloqueadoError();
    const cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    try {
      const res = await this.fetch(destino, {
        headers: cookie ? { ...HEADERS, Cookie: cookie } : HEADERS,
        redirect: 'manual',
        signal: AbortSignal.timeout(PORTAL_TIMEOUT_MS),
      });
      for (const c of res.headers.getSetCookie()) {
        const [par] = c.split(';');
        const i = par.indexOf('=');
        if (i > 0) this.cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
      }
      return {
        status: res.status,
        cuerpo: Buffer.from(await res.arrayBuffer()),
        tipo: res.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? null,
        ubicacion: res.headers.get('location'),
      };
    } catch (error) {
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError' || error instanceof TypeError)) {
        throw new Reintentable(error.message);
      }
      throw error;
    }
  }
}

/** A body is a document when it is not empty, not huge and not an HTML/JSON answer. */
function esDocumento(cuerpo: Buffer, tipo: string | null): boolean {
  if (cuerpo.byteLength === 0 || cuerpo.byteLength > MAX_DESCARGA_BYTES) return false;
  return tipo === null || !TIPOS_NO_DOCUMENTO.test(tipo);
}
