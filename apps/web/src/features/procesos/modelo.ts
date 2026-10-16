// Tipos de la API (apps/api). Los nombres de propiedad son el contrato público en español.

export interface Actuacion {
  id: number;
  cons: number | null;
  fecha: string | null;
  actuacion: string | null;
  anotacion: string | null;
  fechaInicial: string | null;
  fechaFinal: string | null;
  fechaRegistro: string | null;
  conDocumentos: boolean | null;
}

export interface Sujeto {
  tipo: string | null;
  nombre: string | null;
}

export interface Nota {
  id: string;
  texto: string;
  autor: string;
  fecha: string;
}

export interface Tarea {
  id: string;
  titulo: string;
  /** `YYYY-MM-DD`. */
  fecha: string;
  /** `HH:MM` o cadena vacía. */
  hora: string;
  responsable: string;
  idActuacion: string | null;
  hecha: boolean;
  hechaPor: string | null;
  autor: string;
  creada: string;
}

/** Estado del juzgado donde apareció un proceso (`GET /api/procesos/:id`, `estados`). */
export interface EstadoProceso {
  procesoId: string;
  urlEstado: string;
  numeroEstado: string | null;
  /** `YYYY-MM-DD`. */
  fechaPublicacion: string | null;
  /** Radicado tal como apareció en el LISTADO del estado. */
  radicadoEncontrado: string;
  visto: boolean;
  /** Instante ISO del barrido que lo encontró. */
  detectadoEn: string;
}

/** Resumen de un proceso: filas de `GET /api/procesos` y respuestas de mutaciones. */
export interface ProcesoResumen {
  idProceso: string;
  radicado: string;
  alias: string;
  despacho: string | null;
  claseProceso: unknown;
  sujetos: string | null;
  ultimaActuacion: Actuacion | null;
  ultimoAuto: Actuacion | null;
  noVistas: number;
  /** Reservado en la Rama: se sigue por los estados del juzgado. */
  esPrivado: boolean;
  /** Estados detectados que aún no se han revisado (0 si no hay). */
  estadosNoVistos: number;
  nuevaInstancia: boolean;
  proximaTarea: Tarea | null;
  tareasVencidas: number;
  responsable: string;
  etiquetas: string[];
  ultimaConsulta: string | null;
  agregadoPor: string;
  error: string | null;
}

/** Vista completa de `GET /api/procesos/:id` y de las mutaciones de notas y tareas. */
export interface ProcesoDetalle extends Omit<ProcesoResumen, 'sujetos'> {
  detalle: Record<string, unknown>;
  sujetos: Sujeto[];
  actuaciones: Actuacion[];
  /** Del más reciente al más antiguo. */
  estados: EstadoProceso[];
  noVistasIds: number[];
  notas: Nota[];
  tareas: Tarea[];
}

export interface ListaProcesos {
  procesos: ProcesoResumen[];
  ultimaRevision: string | null;
}

export interface RespuestaAgregar {
  agregados: ProcesoResumen[];
}

interface NovedadBase {
  idProceso: string;
  radicado: string;
  alias: string;
  despacho: string | null;
}

/** Elemento de `GET /api/novedades` (array plano). */
export type Novedad = NovedadBase &
  (
    | { tipo: 'instancia'; fecha: string }
    | { tipo: 'actuacion'; fecha: string | null; actuacion: Actuacion }
    | { tipo: 'estado'; fecha: string | null; estado: EstadoProceso }
  );

/** Tarea con su proceso, como la devuelve `GET /api/agenda`. */
export interface TareaAgenda extends Tarea {
  idProceso: string;
  radicado: string;
  alias: string;
  despacho: string | null;
}

export interface RespuestaAgenda {
  tareas: TareaAgenda[];
  /** Fecha de Bogotá `YYYY-MM-DD`. */
  hoy: string;
  /** Enlace absoluto de la suscripción ICS, con token. */
  ics: string;
}

export interface DocumentoActuacion {
  id: unknown;
  tipo: unknown;
  fechaCarga: unknown;
  nombre: string;
  url: string;
}

/** Nivel de certeza del PDF encontrado en Publicaciones Procesales. */
export type ConfianzaAuto = 'exacto' | 'del_dia' | 'estado' | 'sin_resultado';

/** Respuesta de `GET /api/procesos/:id/actuaciones/:actuacionId/auto`. */
export interface AutoPublicado {
  confianza: ConfianzaAuto;
  urlPdf: string | null;
  nombreArchivo: string | null;
  urlEstado: string | null;
  numeroEstado: string | null;
  /** `YYYY-MM-DD`. */
  fechaPublicacion: string | null;
}
