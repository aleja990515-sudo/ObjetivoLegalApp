import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ApiError } from '../../common/http/api-error.js';
import type { SessionUser } from '../../auth/domain/session.js';
import { hoyBogota } from '../domain/bogota-time.js';
import { ahoraIso } from '../../common/time/temporal.js';
import { META_REPOSITORY, META_ULTIMA_REVISION, type MetaRepository } from '../domain/meta.repository.js';
import {
  ESTADO_PROCESO_REPOSITORY,
  type EstadoProcesoRepository,
} from '../domain/estado-proceso.repository.js';
import { newProceso } from '../domain/refresh.js';
import {
  compararProcesos,
  detalleCompleto,
  novedades as construirNovedades,
  resumen,
  type Novedad,
  type ProcesoDetalle,
  type ProcesoResumen,
} from '../domain/proceso-resumen.js';
import type { DocumentoActuacion } from './ports/cpnu.port.js';
import type { Proceso, ProcesoOfficeChanges, TareaChanges } from '../domain/proceso.js';
import { PROCESO_REPOSITORY, type ProcesoRepository } from '../domain/proceso.repository.js';
import {
  comoTexto,
  cuerpoObjeto,
  fechaValida,
  horaValida,
  LIMITE,
  normalizarEtiquetas,
  texto,
} from '../domain/validation.js';
import { CPNU_PORT, type CpnuPort } from './ports/cpnu.port.js';
import { DetectInstancesService } from './detect-instances.service.js';
import { RefreshProcesoService } from './refresh-proceso.service.js';

/**
 * @deprecated A private proceso is stored and reported as a `ProcesoResumen`
 * now; this entry is only kept for the web client until it is updated.
 */
export interface ProcesoPrivado {
  idProceso: string;
  privado: true;
}

export interface ListaProcesos {
  procesos: ProcesoResumen[];
  ultimaRevision: string | null;
}

export type ProcesoActualizado = ProcesoResumen & { instanciasNuevas: number };

const nuevoId = (): string => randomBytes(6).toString('hex');
const ahora = (): string => ahoraIso();
const hoy = (): string => hoyBogota();

/** Use cases of the procesos routes (legacy `rutasProtegidas`, lib/app.js:241-383). */
@Injectable()
export class ProcesosService {
  constructor(
    @Inject(PROCESO_REPOSITORY) private readonly procesos: ProcesoRepository,
    @Inject(META_REPOSITORY) private readonly meta: MetaRepository,
    @Inject(CPNU_PORT) private readonly cpnu: CpnuPort,
    @Inject(ESTADO_PROCESO_REPOSITORY) private readonly estados: EstadoProcesoRepository,
    private readonly refresher: RefreshProcesoService,
    private readonly detector: DetectInstancesService,
  ) {}

  async list(): Promise<ListaProcesos> {
    const today = hoy();
    const noVistos = await this.estados.contarNoVistos();
    const procesos = (await this.procesos.findAll())
      .map((p) => resumen(p, today, noVistos.get(p.idProceso) ?? 0))
      .sort(compararProcesos);
    return { procesos, ultimaRevision: await this.meta.get(META_ULTIMA_REVISION) };
  }

  /** Searches the radicado in CPNU and follows every instance that is not followed yet. */
  async add(usuario: SessionUser, body: unknown): Promise<{ agregados: (ProcesoResumen | ProcesoPrivado)[] }> {
    const { radicado, alias } = cuerpoObjeto(body);
    const numero = comoTexto(radicado).replace(/\D/g, '');
    if (numero.length !== 23) throw new ApiError(400, 'El radicado debe tener 23 dígitos.');

    const encontrados = await this.cpnu.searchRadicado(numero);
    if (!encontrados.length) {
      throw new ApiError(404, 'No se encontró ese radicado en la Consulta Nacional Unificada.');
    }

    const seguidos = new Set((await this.procesos.listRefs()).map((r) => r.idProceso));
    const today = hoy();
    const agregados: (ProcesoResumen | ProcesoPrivado)[] = [];
    for (const encontrado of encontrados) {
      const id = String(encontrado.idProceso);
      if (seguidos.has(id)) continue;
      const inicial = newProceso(encontrado, numero, usuario.nombre, ahora(), { alias: texto(alias, LIMITE.alias) });
      // A private proceso is stored with the little the search returns: CPNU
      // answers 404 for its detail, parties and actuaciones.
      const proceso = encontrado.esPrivado ? inicial : await this.refresher.hydrateNew(inicial);
      if (!(await this.procesos.insert(proceso))) continue; // added concurrently
      agregados.push(resumen(proceso, today));
    }
    if (!agregados.length) throw new ApiError(409, 'Ese proceso ya está en la lista.');
    return { agregados };
  }

  async novedades(): Promise<Novedad[]> {
    return construirNovedades(await this.procesos.findAll(), await this.estados.listarNoVistos());
  }

  async documentos(idActuacion: string): Promise<DocumentoActuacion[]> {
    return this.cpnu.listDocumentos(idActuacion);
  }

  async detalle(idProceso: string): Promise<ProcesoDetalle> {
    return this.vista(idProceso);
  }

  /** Office-owned fields only (alias, responsable, etiquetas). */
  async actualizarOficina(idProceso: string, body: unknown): Promise<ProcesoDetalle> {
    await this.existente(idProceso);
    const b = cuerpoObjeto(body);
    const cambios: ProcesoOfficeChanges = {};
    if ('alias' in b) cambios.alias = texto(b.alias, LIMITE.alias);
    if ('responsable' in b) cambios.responsable = texto(b.responsable, LIMITE.responsable);
    if ('etiquetas' in b) cambios.etiquetas = normalizarEtiquetas(b.etiquetas);
    if (Object.keys(cambios).length) await this.procesos.updateOffice(idProceso, cambios);
    return this.vista(idProceso);
  }

  async eliminar(idProceso: string): Promise<{ ok: true }> {
    await this.existente(idProceso);
    await this.procesos.delete(idProceso);
    return { ok: true };
  }

  async marcarVisto(idProceso: string): Promise<ProcesoResumen> {
    const proceso = await this.existente(idProceso);
    await this.procesos.markSeen(idProceso);
    // A detection is a novedad too, so one route clears both kinds.
    await this.estados.marcarVistos(idProceso);
    return resumen({ ...proceso, noVistas: [], nuevaInstancia: false }, hoy());
  }

  /** Re-reads CPNU and then looks for new instances; CPNU failures are stored, not raised. */
  async actualizar(idProceso: string): Promise<ProcesoActualizado> {
    await this.existente(idProceso);
    const refresco = await this.refresher.refresh(idProceso);
    if (!refresco.state) throw new ApiError(404, 'Proceso no encontrado.');
    const proceso = await this.existente(idProceso);
    let instanciasNuevas = 0;
    try {
      instanciasNuevas = await this.detector.detect(proceso.radicado, proceso);
    } catch {
      instanciasNuevas = 0; // a failed search never fails the refresh (legacy behaviour)
    }
    return { ...resumen(proceso, hoy()), instanciasNuevas };
  }

  async agregarNota(usuario: SessionUser, idProceso: string, body: unknown): Promise<ProcesoDetalle> {
    await this.existente(idProceso);
    const textoNota = texto(cuerpoObjeto(body).texto, LIMITE.nota);
    if (!textoNota) throw new ApiError(400, 'La nota está vacía.');
    await this.procesos.addNota(idProceso, {
      id: nuevoId(),
      texto: textoNota,
      autor: usuario.nombre,
      fecha: ahora(),
    });
    return this.vista(idProceso);
  }

  async eliminarNota(idProceso: string, idNota: string): Promise<ProcesoDetalle> {
    await this.existente(idProceso);
    await this.procesos.deleteNota(idProceso, idNota);
    return this.vista(idProceso);
  }

  async agregarTarea(usuario: SessionUser, idProceso: string, body: unknown): Promise<ProcesoDetalle> {
    const proceso = await this.existente(idProceso);
    const b = cuerpoObjeto(body);
    const titulo = texto(b.titulo, LIMITE.titulo);
    if (!titulo || !fechaValida(b.fecha)) throw new ApiError(400, 'Escribe la actividad y una fecha válida.');
    await this.procesos.addTarea(idProceso, {
      id: nuevoId(),
      titulo,
      fecha: b.fecha,
      hora: horaValida(b.hora),
      responsable: texto(b.responsable, LIMITE.responsable) || proceso.responsable || '',
      idActuacion: b.idActuacion ? comoTexto(b.idActuacion) || null : null,
      hecha: false,
      hechaPor: null,
      autor: usuario.nombre,
      creada: ahora(),
    });
    return this.vista(idProceso);
  }

  async actualizarTarea(usuario: SessionUser, idProceso: string, idTarea: string, body: unknown): Promise<ProcesoDetalle> {
    await this.tareaExistente(idProceso, idTarea);
    const b = cuerpoObjeto(body);
    const cambios: TareaChanges = {};
    if ('hecha' in b) {
      cambios.hecha = Boolean(b.hecha);
      cambios.hechaPor = cambios.hecha ? usuario.nombre : null;
    }
    if ('titulo' in b && texto(b.titulo, LIMITE.titulo)) cambios.titulo = texto(b.titulo, LIMITE.titulo);
    if ('fecha' in b && fechaValida(b.fecha)) cambios.fecha = b.fecha;
    if ('hora' in b) cambios.hora = horaValida(b.hora);
    if ('responsable' in b) cambios.responsable = texto(b.responsable, LIMITE.responsable);
    await this.procesos.updateTarea(idProceso, idTarea, cambios);
    return this.vista(idProceso);
  }

  async eliminarTarea(idProceso: string, idTarea: string): Promise<ProcesoDetalle> {
    await this.tareaExistente(idProceso, idTarea);
    await this.procesos.deleteTarea(idProceso, idTarea);
    return this.vista(idProceso);
  }

  /** The route guard for every `/procesos/:id` path (legacy 404 "Proceso no encontrado."). */
  private async existente(idProceso: string): Promise<Proceso> {
    const proceso = await this.procesos.findById(idProceso);
    if (!proceso) throw new ApiError(404, 'Proceso no encontrado.');
    return proceso;
  }

  private async tareaExistente(idProceso: string, idTarea: string): Promise<void> {
    const proceso = await this.existente(idProceso);
    if (!proceso.tareas.some((t) => t.id === idTarea)) throw new ApiError(404, 'Tarea no encontrada.');
  }

  private async vista(idProceso: string): Promise<ProcesoDetalle> {
    const proceso = await this.existente(idProceso);
    return detalleCompleto(proceso, hoy(), await this.estados.listarPorProceso(idProceso));
  }
}
