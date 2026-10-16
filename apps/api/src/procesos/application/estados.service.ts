import { Inject, Injectable, Logger } from '@nestjs/common';
import { ahoraIso } from '../../common/time/temporal.js';
import { numeroDelTitulo, type EstadoPublicado } from '../domain/autos.js';
import { fechaBogota, hoyBogota } from '../domain/bogota-time.js';
import {
  ESTADO_PROCESO_REPOSITORY,
  type EstadoProceso,
  type EstadoProcesoRepository,
} from '../domain/estado-proceso.repository.js';
import { META_REPOSITORY, META_ULTIMO_BARRIDO_ESTADOS, type MetaRepository } from '../domain/meta.repository.js';
import type { ProcesoRef } from '../domain/proceso.js';
import { PROCESO_REPOSITORY, type ProcesoRepository } from '../domain/proceso.repository.js';
import { claveCaso } from '../domain/radicado.js';
import { extraerTextoPdf, radicadosEnTexto } from '../infrastructure/pdf/texto-pdf.js';
import { PUBLICACIONES_PORT, type PublicacionesPort } from './ports/publicaciones.port.js';

/** Window searched when there is no previous run, and the ceiling of any window. */
export const VENTANA_MAXIMA_DIAS = 30;
/** Margin subtracted from the last run so an estado published around it is never missed. */
export const MARGEN_DIAS = 1;

export interface EstadosSummary {
  despachos: number;
  estados: number;
  detecciones: number;
  /** Estados whose LISTADO could not be read (no download or no radicado inside). */
  ilegibles: number;
  /** Estados without a LISTADO attachment. */
  sinListado: number;
}

/** The estado's listing; it is not the first of the ~11 documents of an estado. */
const ES_LISTADO = /listado/i;

/**
 * Sweeps the court's published estados for the followed private cases (legacy
 * public cases are refreshed from CPNU daily, so a second notification for the
 * same event would be noise). The estados search form has no radicado field, so
 * the case is looked for inside each estado's `LISTADO <n>.pdf`.
 */
@Injectable()
export class EstadosService {
  private readonly logger = new Logger(EstadosService.name);
  private inFlight: Promise<EstadosSummary> | null = null;

  constructor(
    @Inject(PROCESO_REPOSITORY) private readonly procesos: ProcesoRepository,
    @Inject(ESTADO_PROCESO_REPOSITORY) private readonly estados: EstadoProcesoRepository,
    @Inject(META_REPOSITORY) private readonly meta: MetaRepository,
    @Inject(PUBLICACIONES_PORT) private readonly portal: PublicacionesPort,
  ) {}

  get running(): boolean {
    return this.inFlight !== null;
  }

  /** One sweep; concurrent callers share the running one. */
  revisar(): Promise<EstadosSummary> {
    this.inFlight ??= this.run().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async run(): Promise<EstadosSummary> {
    // Only private casos: the daily CPNU review already delivers a public case's
    // actuaciones, and a second notification for the same event would be noise.
    const porDespacho = new Map<string, ProcesoRef[]>();
    for (const ref of await this.procesos.listPrivados()) {
      const despacho = ref.radicado.slice(0, 12);
      const grupo = porDespacho.get(despacho);
      if (grupo) grupo.push(ref);
      else porDespacho.set(despacho, [ref]);
    }

    const { desde, hasta } = await this.ventana();
    const resumen: EstadosSummary = {
      despachos: porDespacho.size,
      estados: 0,
      detecciones: 0,
      ilegibles: 0,
      sinListado: 0,
    };

    for (const [despacho, refs] of porDespacho) {
      const encontrados = await this.portal.buscarEstados({ despacho, desde, hasta });
      resumen.estados += encontrados.length;
      for (const estado of encontrados) {
        const archivos = await this.portal.listarArchivos(estado);
        const listado = archivos.find((a) => ES_LISTADO.test(a.nombre));
        if (!listado) {
          resumen.sinListado++;
          continue;
        }
        // `null` (portal block, HTML answer, oversized body) and a PDF without a
        // radicado are unreadable, never proof that the case is not there.
        const buffer = await this.portal.descargar(listado.url);
        const radicados = buffer ? radicadosEnTexto(extraerTextoPdf(buffer)) : [];
        if (!radicados.length) {
          resumen.ilegibles++;
          continue;
        }
        resumen.detecciones += await this.registrar(estado, refs, radicados);
      }
    }

    // Advance the window only when the run swept at least one despacho and found
    // at least one estado. Every despacho answering no estados is almost always a
    // portal block rather than an empty window, and with no private caso at all
    // the portal was never asked. Either way, keeping the previous run lets the
    // next one retry the same range and a caso added later keeps its full window.
    if (resumen.despachos > 0 && resumen.estados > 0) {
      await this.meta.set(META_ULTIMO_BARRIDO_ESTADOS, ahoraIso());
    }
    this.logger.log(
      `[estados] despachos=${resumen.despachos} estados=${resumen.estados} detecciones=${resumen.detecciones} ` +
        `ilegibles=${resumen.ilegibles} sinListado=${resumen.sinListado}`,
    );
    return resumen;
  }

  /**
   * Records one row per proceso of the despacho whose case appears in the estado.
   * The case key (radicado without its recurso digits) matches a case that a
   * recurso moved, and the radicado is stored as it appeared in the LISTADO.
   */
  private async registrar(estado: EstadoPublicado, refs: ProcesoRef[], radicados: string[]): Promise<number> {
    const porClave = new Map<string, string>();
    for (const radicado of radicados) {
      const clave = claveCaso(radicado);
      if (!porClave.has(clave)) porClave.set(clave, radicado);
    }

    const ahora = ahoraIso();
    let detecciones = 0;
    for (const { idProceso, radicado } of refs) {
      const encontrado = porClave.get(claveCaso(radicado));
      if (!encontrado) continue;
      const fila: EstadoProceso = {
        idProceso,
        urlEstado: estado.urlEstado,
        numeroEstado: numeroDelTitulo(estado.titulo),
        fechaPublicacion: estado.fechaPublicacion,
        radicadoEncontrado: encontrado,
        visto: false,
        detectadoEn: ahora,
      };
      if (await this.estados.guardar(fila)) detecciones++;
    }
    return detecciones;
  }

  /** Shifted window since the last run (a 1-day margin), capped at 30 days. */
  private async ventana(): Promise<{ desde: string; hasta: string }> {
    const hasta = Temporal.PlainDate.from(hoyBogota());
    const ultimo = await this.meta.get(META_ULTIMO_BARRIDO_ESTADOS);
    const desde = ultimo
      ? Temporal.PlainDate.from(fechaBogota(Temporal.Instant.from(ultimo))).subtract({ days: MARGEN_DIAS })
      : hasta.subtract({ days: VENTANA_MAXIMA_DIAS });
    const limite = hasta.subtract({ days: VENTANA_MAXIMA_DIAS });
    const inicio = Temporal.PlainDate.compare(desde, limite) < 0 ? limite : desde;
    // A start past `hasta` would search nothing; keep the window non-empty.
    const acotado = Temporal.PlainDate.compare(inicio, hasta) > 0 ? hasta : inicio;
    return { desde: acotado.toString(), hasta: hasta.toString() };
  }
}
