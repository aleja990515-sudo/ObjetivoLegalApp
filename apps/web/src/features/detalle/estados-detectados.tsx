import { Newspaper } from '@phosphor-icons/react';
import { EstadoVacio } from '@/components/estado/estado';
import { TituloSeccion } from '@/components/titulo-seccion/titulo';
import { Badge } from '@/components/ui/badge';
import { fecha } from '@/features/procesos/formato';
import type { EstadoProceso } from '@/features/procesos/modelo';

interface Props {
  estados: EstadoProceso[];
  /** En un proceso privado el vacío se explica: los estados son su única fuente. */
  privado: boolean;
}

/** Estados del juzgado en los que apareció el proceso, del más reciente al más antiguo. */
export function EstadosDetectados({ estados, privado }: Props) {
  if (estados.length === 0 && !privado) return null;
  return (
    <section aria-labelledby="titulo-estados" className="grid gap-3">
      <TituloSeccion id="titulo-estados" titulo="Estados donde aparece" icono={Newspaper} />
      {estados.length === 0 ? (
        <EstadoVacio icono={Newspaper} titulo="Aún no aparece en ningún estado.">
          Se revisan los estados del juzgado de forma periódica y aquí se mostrarán los que lo mencionen.
        </EstadoVacio>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {estados.map((e) => (
            <li key={e.urlEstado} className="relative flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-card p-4 hover:bg-surface-sunken focus-within:bg-surface-sunken">
              <div className="grid gap-0.5">
                <a
                  href={e.urlEstado}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-foreground no-underline after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
                >
                  {`Estado No. ${e.numeroEstado ?? 'sin número'}`}
                  <span className="sr-only"> (se abre en una pestaña nueva)</span>
                </a>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {e.fechaPublicacion ? `Publicado ${fecha(e.fechaPublicacion)}` : 'Sin fecha de publicación'}
                </span>
              </div>
              {!e.visto && <Badge>Nuevo</Badge>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
