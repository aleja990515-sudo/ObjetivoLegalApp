import { CalendarBlank, User } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { FilaEnlazada } from '@/components/fila-enlazada/fila-enlazada';
import { cn } from '@/lib/utils';
import { fecha, fmtRadicado } from './formato';
import type { ProcesoResumen } from './modelo';

interface Props {
  proceso: ProcesoResumen;
  /** Día de hoy en Bogotá, para marcar tareas vencidas. */
  hoy: string;
}

const CELDA = 'block break-words px-4 py-1 min-[640px]:table-cell min-[640px]:px-3 min-[640px]:py-3.5 min-[640px]:align-top';
const ETIQUETA_MOVIL = 'mb-0.5 block text-xs text-muted-foreground min-[640px]:sr-only';

/**
 * Fila de la lista: en escritorio es una fila de tabla; bajo 640px se apila como tarjeta.
 * El enlace ocupa toda la fila (enlace estirado) para que la fila entera sea clicable.
 */
export function FilaProceso({ proceso: p, hoy }: Props) {
  const ultima = p.ultimaActuacion;
  const tarea = p.proximaTarea;
  const vencida = tarea !== null && tarea.fecha < hoy;
  const hayNovedad = p.noVistas > 0 || p.nuevaInstancia;

  return (
    <tr
      className={cn(
        'relative block border-b border-line py-2 last:border-b-0 focus-within:bg-surface-sunken min-[640px]:table-row min-[640px]:py-0',
        'hover:bg-surface-sunken',
      )}
    >
      <td className={cn(CELDA, 'min-[640px]:w-[34%]')}>
        <FilaEnlazada href={`/procesos/${p.idProceso}`}>{p.alias || p.despacho || 'Proceso'}</FilaEnlazada>
        <div className="font-mono text-xs text-muted-foreground tabular-nums">{fmtRadicado(p.radicado)}</div>
        {p.sujetos && <div className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">{p.sujetos}</div>}
      </td>

      <td className={cn(CELDA, 'min-[640px]:w-[22%] min-[640px]:text-sm')}>
        <span className={ETIQUETA_MOVIL}>Despacho</span>
        {p.despacho ? p.despacho : <span className="text-muted-foreground">Sin despacho</span>}
      </td>

      <td className={cn(CELDA, 'min-[640px]:w-[24%] min-[640px]:text-sm')}>
        <span className={ETIQUETA_MOVIL}>Última actuación</span>
        {ultima ? (
          <>
            <span className="tabular-nums">{fecha(ultima.fecha)}</span>
            <span className="text-muted-foreground"> · {ultima.actuacion}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Sin actuaciones registradas</span>
        )}
      </td>

      <td className={cn(CELDA, 'min-[640px]:w-[20%] min-[640px]:text-sm')}>
        <span className={ETIQUETA_MOVIL}>Estado</span>
        <div className="flex flex-wrap gap-1.5">
          {p.nuevaInstancia && <Badge>Nueva instancia</Badge>}
          {p.noVistas > 0 && <Badge>{p.noVistas} nueva(s)</Badge>}
          {p.tareasVencidas > 0 && <Badge variant="destructive">{p.tareasVencidas} vencida(s)</Badge>}
          {!hayNovedad && p.tareasVencidas === 0 && <span className="self-center text-muted-foreground">Al día</span>}
        </div>
        {tarea && (
          <p className={cn('m-0 mt-1.5 flex items-start gap-1.5 text-xs', vencida ? 'text-destructive' : 'text-muted-foreground')}>
            <CalendarBlank aria-hidden="true" weight="regular" className="mt-px size-3.5 shrink-0" />
            <span>
              {fecha(tarea.fecha)}
              {tarea.hora ? ` ${tarea.hora}` : ''}: {tarea.titulo}
            </span>
          </p>
        )}
        {p.responsable && (
          <p className="m-0 mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <User aria-hidden="true" weight="regular" className="size-3.5 shrink-0" />
            {p.responsable}
          </p>
        )}
        {p.error && <p className="m-0 mt-1.5 text-xs text-destructive">Última consulta falló: {p.error}</p>}
      </td>
    </tr>
  );
}
