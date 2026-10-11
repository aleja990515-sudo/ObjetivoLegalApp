'use client';

import { CalendarCheck, CalendarPlus, Copy } from '@phosphor-icons/react';
import Link from 'next/link';
import { useEffect, useId, useMemo, useState } from 'react';
import { EstadoError, EstadoVacio } from '@/components/estado/estado';
import { PageHeader } from '@/components/page-header/page-header';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { fechaLarga, fmtRadicado, sumarDias } from '@/features/procesos/formato';
import type { ProcesoDetalle, RespuestaAgenda, TareaAgenda } from '@/features/procesos/modelo';
import { ApiError, apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Grupo {
  titulo: string;
  tareas: TareaAgenda[];
}

/** Agenda de la oficina: tareas de todos los procesos agrupadas por fecha y enlaces de suscripción. */
export function VistaAgenda() {
  const idVerHechas = useId();
  const [datos, setDatos] = useState<RespuestaAgenda | null>(null);
  const [tareas, setTareas] = useState<TareaAgenda[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [verHechas, setVerHechas] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    let activo = true;
    apiFetch<RespuestaAgenda>('/agenda')
      .then((respuesta) => {
        if (!activo) return;
        setDatos(respuesta);
        setTareas(respuesta.tareas);
      })
      .catch((fallo: unknown) => {
        if (activo) setError(fallo instanceof ApiError ? fallo.message : 'No se pudo cargar la agenda.');
      });
    return () => {
      activo = false;
    };
  }, []);

  const grupos = useMemo(() => (datos ? construirGrupos(tareas, datos.hoy, verHechas) : []), [tareas, datos, verHechas]);

  async function alternar(tarea: TareaAgenda, hecha: boolean) {
    setAviso('');
    try {
      const proceso = await apiFetch<ProcesoDetalle>(`/procesos/${tarea.idProceso}/tareas/${tarea.id}`, {
        method: 'PATCH',
        body: { hecha },
      });
      const actualizada = proceso.tareas.find((t) => t.id === tarea.id);
      if (actualizada) {
        setTareas((previas) =>
          previas.map((t) => (t.id === tarea.id && t.idProceso === tarea.idProceso ? { ...t, ...actualizada } : t)),
        );
      }
    } catch (fallo) {
      setAviso(fallo instanceof ApiError ? fallo.message : 'No se pudo actualizar la actividad.');
    }
  }

  if (error) {
    return (
      <>
        <PageHeader titulo="Agenda de la oficina" />
        <EstadoError mensaje={error} />
      </>
    );
  }

  return (
    <>
      <PageHeader titulo="Agenda de la oficina" descripcion="Términos y audiencias de todos los procesos." />

      {datos ? (
        <Suscripcion ics={datos.ics} onAviso={setAviso} />
      ) : (
        <Skeleton aria-hidden="true" className="h-24 w-full" />
      )}

      <div className="mt-8 grid gap-4">
        <div className="flex items-center gap-2">
          <input
            id={idVerHechas}
            type="checkbox"
            checked={verHechas}
            onChange={(e) => setVerHechas(e.target.checked)}
            className="size-4 accent-primary"
          />
          <Label htmlFor={idVerHechas}>Ver realizadas</Label>
        </div>

        {aviso && (
          <p role="status" className="m-0 text-sm text-accent-foreground">
            {aviso}
          </p>
        )}

        {!datos && <SkeletonAgenda />}
        {datos && grupos.length === 0 && (
          <div className="rounded-lg border border-line bg-card">
            <EstadoVacio icono={CalendarCheck} titulo="No hay actividades pendientes">
              Abre un proceso y usa Agendar actividad o término, o el botón Agendar de una actuación.
            </EstadoVacio>
          </div>
        )}
        {datos &&
          grupos.map((grupo) => (
            <section key={grupo.titulo} aria-label={grupo.titulo} className="grid gap-2">
              <h2 className="m-0 text-sm font-semibold text-muted-foreground">
                {grupo.titulo} ({grupo.tareas.length})
              </h2>
              <ul className="m-0 grid list-none gap-2 p-0">
                {grupo.tareas.map((t) => (
                  <ItemAgenda key={`${t.idProceso}-${t.id}`} tarea={t} hoy={datos.hoy} onAlternar={alternar} />
                ))}
              </ul>
            </section>
          ))}
      </div>
    </>
  );
}

function ItemAgenda({
  tarea: t,
  hoy,
  onAlternar,
}: {
  tarea: TareaAgenda;
  hoy: string;
  onAlternar: (tarea: TareaAgenda, hecha: boolean) => void;
}) {
  const vencida = !t.hecha && t.fecha < hoy;
  return (
    <li className={cn('flex items-start gap-3 rounded-lg border border-line bg-card p-3.5', t.hecha && 'opacity-70')}>
      <input
        type="checkbox"
        aria-label={`Marcar como realizada: ${t.titulo}`}
        checked={t.hecha}
        onChange={(e) => onAlternar(t, e.target.checked)}
        className="mt-1 size-4 shrink-0 accent-primary"
      />
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="m-0 text-xs text-muted-foreground tabular-nums">
          {fechaLarga(t.fecha)}
          {t.hora ? ` · ${t.hora}` : ''}
          {vencida && <span className="ml-2 font-medium text-destructive">Vencida</span>}
        </p>
        <p className={cn('m-0 text-sm font-medium', t.hecha && 'line-through')}>{t.titulo}</p>
        <Link href={`/procesos/${t.idProceso}`} className="w-fit text-xs text-primary underline-offset-4 hover:underline">
          {t.alias || t.despacho || 'Proceso'} · {fmtRadicado(t.radicado)}
        </Link>
        <p className="m-0 text-xs text-muted-foreground">
          {t.responsable || 'Sin responsable'}
          {t.hecha && t.hechaPor ? ` · realizada por ${t.hechaPor}` : ''}
        </p>
      </div>
    </li>
  );
}

function Suscripcion({ ics, onAviso }: { ics: string; onAviso: (texto: string) => void }) {
  const webcal = ics.replace(/^https?:/, 'webcal:');
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(ics);
      onAviso('Enlace copiado.');
    } catch {
      onAviso('No se pudo copiar el enlace.');
    }
  }

  return (
    <section aria-labelledby="titulo-suscripcion" className="grid gap-3 rounded-lg border border-line bg-card p-4">
      <h2 id="titulo-suscripcion" className="m-0 text-base font-semibold">
        Llevar la agenda a tu calendario
      </h2>
      <p className="m-0 text-sm text-muted-foreground">
        Suscríbete una vez y las actividades se actualizan solas en tu calendario.
      </p>
      <div className="flex flex-wrap gap-2">
        <a className={buttonVariants({ variant: 'outline' })} href={google} target="_blank" rel="noopener noreferrer">
          <CalendarPlus aria-hidden="true" />
          Agregar a Google Calendar
        </a>
        <a className={buttonVariants({ variant: 'outline' })} href={webcal}>
          <CalendarPlus aria-hidden="true" />
          Agregar a Outlook / iPhone
        </a>
        <Button variant="outline" onClick={copiar}>
          <Copy aria-hidden="true" />
          Copiar enlace
        </Button>
      </div>
    </section>
  );
}

function SkeletonAgenda() {
  return (
    <div role="status" aria-live="polite" className="grid gap-2 rounded-lg border border-line bg-card p-4">
      <span className="sr-only">Cargando agenda…</span>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} aria-hidden="true" className="h-12 w-full" />
      ))}
    </div>
  );
}

/** Pendientes por fecha (vencidas, hoy, próximos 7 días, más adelante) y, si se pide, realizadas. */
function construirGrupos(tareas: TareaAgenda[], hoy: string, verHechas: boolean): Grupo[] {
  const semana = sumarDias(hoy, 7);
  const visibles = tareas.filter((t) => verHechas || !t.hecha);
  const pendientes = visibles.filter((t) => !t.hecha).sort(porFecha);
  const grupos: Grupo[] = [
    { titulo: 'Vencidas', tareas: pendientes.filter((t) => t.fecha < hoy) },
    { titulo: 'Hoy', tareas: pendientes.filter((t) => t.fecha === hoy) },
    { titulo: 'Próximos 7 días', tareas: pendientes.filter((t) => t.fecha > hoy && t.fecha <= semana) },
    { titulo: 'Más adelante', tareas: pendientes.filter((t) => t.fecha > semana) },
    { titulo: 'Realizadas', tareas: visibles.filter((t) => t.hecha).sort(porFecha).reverse() },
  ];
  return grupos.filter((g) => g.tareas.length > 0);
}

function porFecha(a: TareaAgenda, b: TareaAgenda): number {
  return (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || ''));
}
