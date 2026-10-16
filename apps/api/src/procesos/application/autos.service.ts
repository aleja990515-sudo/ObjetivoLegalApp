import { Inject, Injectable, Logger } from '@nestjs/common';
import { ApiError } from '../../common/http/api-error.js';
import type { SessionUser } from '../../auth/domain/session.js';
import { isoMs } from '../../common/time/temporal.js';
import { AUTO_PUBLICADO_REPOSITORY, type AutoPublicado, type AutoPublicadoRepository } from '../domain/auto-publicado.repository.js';
import {
  debeBuscar,
  esProvidencia,
  evaluarEstado,
  ordenarEstados,
  resultadoEstado,
  SIN_RESULTADO,
  ventanaBusqueda,
  type ResultadoAuto,
} from '../domain/autos.js';
import type { Actuacion, Proceso } from '../domain/proceso.js';
import { PROCESO_REPOSITORY, type ProcesoRepository } from '../domain/proceso.repository.js';
import { PortalBloqueadoError, PUBLICACIONES_PORT, type PublicacionesPort } from './ports/publicaciones.port.js';

/** Estado detail pages read per search at most (closest to the fijación first). */
export const MAX_ESTADOS_REVISADOS = 4;

export const PORTAL_NO_DISPONIBLE_MESSAGE = 'Publicaciones Procesales no está disponible en este momento. Intenta más tarde.';

/**
 * Finds the PDF of a providencia in the Publicaciones Procesales portal and
 * stores the result per actuación. Only links are returned: the PDF is opened
 * by the browser, never fetched by the server.
 */
@Injectable()
export class AutosService {
  private readonly logger = new Logger(AutosService.name);
  /** One portal search per actuación at a time. */
  private readonly enCurso = new Map<string, Promise<ResultadoAuto>>();

  constructor(
    @Inject(PROCESO_REPOSITORY) private readonly procesos: ProcesoRepository,
    @Inject(AUTO_PUBLICADO_REPOSITORY) private readonly autos: AutoPublicadoRepository,
    @Inject(PUBLICACIONES_PORT) private readonly portal: PublicacionesPort,
  ) {}

  async auto(usuario: SessionUser, idProceso: string, idActuacion: number): Promise<ResultadoAuto> {
    // Scoped read: a foreign proceso is "not found", never "forbidden".
    const proceso = await this.procesos.findById(idProceso, usuario.id);
    if (!proceso) throw new ApiError(404, 'Proceso no encontrado.');
    const actuacion = proceso.actuaciones.find((a) => a.id === idActuacion);
    if (!actuacion) throw new ApiError(404, 'Actuación no encontrada.');
    if (!esProvidencia(actuacion.actuacion)) throw new ApiError(404, 'Esa actuación no es un auto ni una sentencia.');

    // Keyed on the copy, not on the CPNU id: two users may follow the same expediente
    // and each one has to get the result written into their own row.
    const clave = `${proceso.id}:${idActuacion}`;
    const pendiente = this.enCurso.get(clave);
    if (pendiente) return pendiente;
    const busqueda = this.resolver(proceso, actuacion).finally(() => this.enCurso.delete(clave));
    this.enCurso.set(clave, busqueda);
    return busqueda;
  }

  private async resolver(proceso: Proceso, actuacion: Actuacion): Promise<ResultadoAuto> {
    // Cached per copy: the surrogate `id` is what `autos_publicados` hangs from, so
    // two users following the same expediente keep their own cache.
    const guardado = await this.autos.buscar(proceso.id, actuacion.id);
    const ahora = Temporal.Now.instant();
    if (guardado && !debeBuscar(guardado, ahora)) return publico(guardado);

    let resultado: ResultadoAuto;
    try {
      resultado = await this.buscarEnPortal(proceso, actuacion);
    } catch (error) {
      // Fail soft: keep the previous result, or tell the user to try later. Nothing is stored.
      this.logger.warn(`[autos] ${proceso.idProceso}/${actuacion.id}: ${error instanceof Error ? error.message : String(error)}`);
      if (guardado) return publico(guardado);
      throw new ApiError(503, error instanceof PortalBloqueadoError ? error.message : PORTAL_NO_DISPONIBLE_MESSAGE);
    }

    await this.autos.guardar({
      ...resultado,
      procesoId: proceso.id,
      idActuacion: actuacion.id,
      buscadoEn: isoMs(ahora),
      intentos: (guardado?.intentos ?? 0) + 1,
    });
    return resultado;
  }

  private async buscarEnPortal(proceso: Proceso, actuacion: Actuacion): Promise<ResultadoAuto> {
    const ventana = ventanaBusqueda(actuacion, proceso.actuaciones);
    if (!ventana) return SIN_RESULTADO;
    const encontrados = await this.portal.buscarEstados({
      despacho: proceso.radicado.slice(0, 12),
      desde: ventana.desde,
      hasta: ventana.hasta,
    });
    const estados = ordenarEstados(encontrados, ventana.fijacion);
    if (!estados.length) return SIN_RESULTADO;
    for (const estado of estados.slice(0, MAX_ESTADOS_REVISADOS)) {
      const archivos = await this.portal.listarArchivos(estado);
      const resultado = evaluarEstado(estado, archivos, proceso.radicado, ventana.fijacion);
      if (resultado) return resultado;
    }
    return resultadoEstado(estados[0]);
  }
}

function publico(auto: AutoPublicado): ResultadoAuto {
  const { confianza, urlPdf, nombreArchivo, urlEstado, numeroEstado, fechaPublicacion } = auto;
  return { confianza, urlPdf, nombreArchivo, urlEstado, numeroEstado, fechaPublicacion };
}
