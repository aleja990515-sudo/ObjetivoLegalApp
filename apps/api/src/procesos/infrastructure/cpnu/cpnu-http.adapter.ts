import { Injectable } from '@nestjs/common';
import type { CpnuPort, DocumentoActuacion } from '../../application/ports/cpnu.port.js';
import type { ProcesoCargado, ProcesoEncontrado } from '../../domain/cpnu-data.js';
import type { Actuacion, Sujeto } from '../../domain/proceso.js';

export const CPNU_BASE_URL = 'https://consultaprocesos.ramajudicial.gov.co:448/api/v2';
export const CPNU_TIMEOUT_MS = 25_000;
export const CPNU_MAX_ACTUACION_PAGES = 20;

const HEADERS = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 SeguimientoProcesos' };

type Json = Record<string, any>;

const orNull = <T>(value: T | undefined): T | null => (value === undefined ? null : value);

/**
 * HTTP client of the CPNU public API (legacy `cpnu`, lib/app.js:13-61).
 * 404 means "not found" (`null`); any other non-2xx answer throws
 * "La Rama Judicial respondió <status>"; requests time out after 25 s.
 */
@Injectable()
export class CpnuHttpAdapter implements CpnuPort {
  async searchRadicado(numero: string): Promise<ProcesoEncontrado[]> {
    const r = await this.get(`/Procesos/Consulta/NumeroRadicacion?numero=${numero}&SoloActivos=false&pagina=1`);
    return ((r && r.procesos) || []).map((e: Json): ProcesoEncontrado => ({
      idProceso: String(e.idProceso),
      despacho: orNull(e.despacho),
      sujetosProcesales: orNull(e.sujetosProcesales),
      esPrivado: Boolean(e.esPrivado),
    }));
  }

  // CPNU answers 500 when a proceso has no sujetos or actuaciones; those calls
  // yield `null` so the previous values are kept instead of failing the proceso.
  async loadProceso(idProceso: string): Promise<ProcesoCargado> {
    const detalle = await this.get(`/Proceso/Detalle/${idProceso}`);
    const suj = await this.get(`/Proceso/Sujetos/${idProceso}?pagina=1`).catch(() => null);
    const actuaciones = await this.allActuaciones(idProceso).catch(() => null);
    return {
      detalle: detalle || {},
      sujetos: suj
        ? (suj.sujetos || []).map((s: Json): Sujeto => ({
            tipo: orNull(s.tipoSujeto),
            nombre: orNull(s.nombreRazonSocial),
          }))
        : null,
      actuaciones,
    };
  }

  async listDocumentos(idActuacion: string): Promise<DocumentoActuacion[]> {
    const docs: Json[] = (await this.get(`/Proceso/DocumentosActuacion/${idActuacion}`)) || [];
    return docs.map((d) => ({
      id: d.idRegDocumento,
      tipo: d.tipo,
      fechaCarga: d.fechaCarga,
      nombre: (d.descripcion && !/^cargado el/i.test(d.descripcion) ? d.descripcion : d.nombre) || 'Documento',
      url: `${CPNU_BASE_URL}/Descarga/Documento/${d.idRegDocumento}`,
    }));
  }

  private async allActuaciones(idProceso: string): Promise<Actuacion[]> {
    const out: Json[] = [];
    for (let pagina = 1; pagina <= CPNU_MAX_ACTUACION_PAGES; pagina++) {
      const r = await this.get(`/Proceso/Actuaciones/${idProceso}?pagina=${pagina}`);
      const lote: Json[] = (r && r.actuaciones) || [];
      out.push(...lote);
      const pag = r && r.paginacion;
      if (!lote.length || !pag || pagina >= pag.cantidadPaginas) break;
    }
    return out.map((a) => ({
      id: a.idRegActuacion,
      cons: orNull(a.consActuacion),
      fecha: orNull(a.fechaActuacion),
      actuacion: orNull(a.actuacion),
      anotacion: orNull(a.anotacion),
      fechaInicial: orNull(a.fechaInicial),
      fechaFinal: orNull(a.fechaFinal),
      fechaRegistro: orNull(a.fechaRegistro),
      conDocumentos: orNull(a.conDocumentos),
    }));
  }

  private async get(path: string): Promise<any> {
    const res = await fetch(CPNU_BASE_URL + path, {
      headers: HEADERS,
      signal: AbortSignal.timeout(CPNU_TIMEOUT_MS),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`La Rama Judicial respondió ${res.status}`);
    return res.json();
  }
}
