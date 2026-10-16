import type { ArchivoPublicado, EstadoPublicado } from '../../domain/autos.js';

export type { ArchivoPublicado, EstadoPublicado };

export const PUBLICACIONES_PORT = Symbol('PUBLICACIONES_PORT');

export interface BusquedaEstados {
  /** Despacho code: the first 12 digits of the radicado. */
  despacho: string;
  /** `YYYY-MM-DD`, inclusive. */
  desde: string;
  /** `YYYY-MM-DD`, inclusive. */
  hasta: string;
}

/** The portal answered 403 or 429, or served a captcha/block page. Never retried right away. */
export class PortalBloqueadoError extends Error {
  constructor(message = 'Publicaciones Procesales bloqueó la consulta. Intenta más tarde.') {
    super(message);
    this.name = 'PortalBloqueadoError';
  }
}

/** The portal did not answer (timeout, 5xx after one retry) or answered something unexpected. */
export class PortalNoDisponibleError extends Error {
  constructor(message = 'Publicaciones Procesales no respondió. Intenta más tarde.') {
    super(message);
    this.name = 'PortalNoDisponibleError';
  }
}

/**
 * Port to the Rama Judicial's Publicaciones Procesales portal (electronic
 * estados). It reads search results and estado detail pages; PDF links are
 * returned as they are and not fetched, with one deliberate exception: the
 * `LISTADO <n>.pdf` of an estado, because the estados channel does not inherit
 * the reservation of a private case and the listing is the only place that says
 * whether the case was published.
 */
export interface PublicacionesPort {
  /** Publications of a despacho in a date range (empty when none). */
  buscarEstados(busqueda: BusquedaEstados): Promise<EstadoPublicado[]>;
  /** Files listed in the detail page of a publication. */
  listarArchivos(estado: EstadoPublicado): Promise<ArchivoPublicado[]>;
  /**
   * Bytes of one document of the portal (the `LISTADO` of an estado). `null` when
   * the answer is not a usable document: an HTTP error (a portal block included:
   * the adapter still remembered its cool-down), an empty body, HTML/JSON, or a
   * body over the adapter's size cap.
   */
  descargar(url: string): Promise<Buffer | null>;
}
