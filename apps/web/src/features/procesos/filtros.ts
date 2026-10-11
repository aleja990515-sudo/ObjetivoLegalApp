import type { ProcesoResumen } from './modelo';

/** Valor del selector de responsable para los procesos sin responsable. */
export const SIN_RESPONSABLE = '__sin';

export interface FiltroLista {
  texto: string;
  /** Nombre de responsable, `SIN_RESPONSABLE` o cadena vacía para todos. */
  responsable: string;
  soloNuevas: boolean;
}

/** Procesos que cumplen el filtro, en el mismo orden que llegan de la API. */
export function filtrarProcesos(procesos: ProcesoResumen[], filtro: FiltroLista): ProcesoResumen[] {
  const texto = filtro.texto.trim().toLowerCase();
  return procesos.filter((p) => {
    if (filtro.soloNuevas && !(p.noVistas > 0 || p.nuevaInstancia)) return false;
    if (filtro.responsable === SIN_RESPONSABLE && p.responsable) return false;
    if (filtro.responsable && filtro.responsable !== SIN_RESPONSABLE && p.responsable !== filtro.responsable) return false;
    if (!texto) return true;
    return buscable(p).toLowerCase().includes(texto);
  });
}

/** Responsables distintos de los procesos, ordenados alfabéticamente. */
export function responsablesDe(procesos: ProcesoResumen[]): string[] {
  const nombres = new Set(procesos.map((p) => p.responsable).filter(Boolean));
  return [...nombres].sort((a, b) => a.localeCompare(b, 'es'));
}

function buscable(p: ProcesoResumen): string {
  return [p.radicado, p.alias, p.despacho, p.sujetos, p.claseProceso, p.responsable, ...p.etiquetas]
    .filter((valor) => valor != null)
    .join(' ');
}
