import { apiFetch } from '@/lib/api';

interface ProcesoId {
  idProceso: number;
}

interface ResultadoActualizar {
  instanciasNuevas?: number;
}

/**
 * Revisa todos los procesos contra la Rama Judicial, uno por uno para no exceder
 * el tiempo de una sola petición (mismo flujo que la interfaz anterior).
 * Un fallo en un proceso no detiene la revisión. Devuelve las instancias nuevas.
 */
export async function revisarTodos(onProgreso: (hecho: number, total: number) => void): Promise<number> {
  const { procesos } = await apiFetch<{ procesos: ProcesoId[] }>('/procesos');
  let instancias = 0;

  for (let i = 0; i < procesos.length; i++) {
    onProgreso(i + 1, procesos.length);
    try {
      const resultado = await apiFetch<ResultadoActualizar>(
        `/procesos/${procesos[i].idProceso}/actualizar`,
        { method: 'POST' },
      );
      instancias += resultado.instanciasNuevas ?? 0;
    } catch {
      // Se continúa con el siguiente proceso.
    }
  }
  return instancias;
}
