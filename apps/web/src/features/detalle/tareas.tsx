'use client';

import { CalendarBlank, CheckCircle, Circle, ListChecks, Plus, Trash, User, X } from '@phosphor-icons/react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { ConfirmarDialog } from '@/components/dialogo/confirmar-dialog';
import { EstadoVacio } from '@/components/estado/estado';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fechaLarga } from '@/features/procesos/formato';
import type { ProcesoDetalle, Tarea } from '@/features/procesos/modelo';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Ejecutar } from './tipos';

/** Datos prellenados desde una actuación ("Agendar"). `clave` cambia en cada uso para reiniciar el formulario. */
export interface Borrador {
  titulo: string;
  fecha: string;
  idActuacion: string;
  clave: number;
}

interface Props {
  proceso: ProcesoDetalle;
  hoy: string;
  ocupado: boolean;
  ejecutar: Ejecutar;
  borrador: Borrador | null;
}

/** Tareas del proceso: alta, marcar como realizada, eliminar. Vencidas y de hoy se resaltan. */
export function Tareas({ proceso: p, hoy, ocupado, ejecutar, borrador }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [paraEliminar, setParaEliminar] = useState<Tarea | null>(null);
  const idTitulo = useId();
  const idFecha = useId();
  const idHora = useId();
  const idResponsable = useId();
  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [responsable, setResponsable] = useState(p.responsable);
  const [idActuacion, setIdActuacion] = useState<string | null>(null);

  useEffect(() => {
    if (!borrador) return;
    setTitulo(borrador.titulo);
    setFecha(borrador.fecha);
    setIdActuacion(borrador.idActuacion);
    setAbierto(true);
  }, [borrador]);

  const ordenadas = [...p.tareas].sort(
    (a, b) => Number(a.hecha) - Number(b.hecha) || (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')),
  );

  function alternar(tarea: Tarea, hecha: boolean) {
    return ejecutar(async () => ({
      proceso: await apiFetch<ProcesoDetalle>(`/procesos/${p.idProceso}/tareas/${tarea.id}`, {
        method: 'PATCH',
        body: { hecha },
      }),
    }));
  }

  function eliminar(tarea: Tarea) {
    setParaEliminar(null);
    return ejecutar(async () => ({
      proceso: await apiFetch<ProcesoDetalle>(`/procesos/${p.idProceso}/tareas/${tarea.id}`, { method: 'DELETE' }),
      aviso: 'Actividad eliminada.',
    }));
  }

  function agregar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    return ejecutar(async () => {
      const proceso = await apiFetch<ProcesoDetalle>(`/procesos/${p.idProceso}/tareas`, {
        method: 'POST',
        body: { titulo, fecha, hora, responsable, idActuacion },
      });
      setTitulo('');
      setFecha('');
      setHora('');
      setIdActuacion(null);
      setAbierto(false);
      return { proceso, aviso: 'Agendado.' };
    });
  }

  return (
    <section aria-labelledby="titulo-tareas" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="titulo-tareas" className="m-0 flex items-center gap-2 text-base font-semibold">
          <ListChecks aria-hidden="true" className="size-5 text-muted-foreground" />
          Agenda del proceso
        </h2>
        <Button variant="outline" size="sm" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>
          {abierto ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {abierto ? 'Cerrar' : 'Agendar actividad o término'}
        </Button>
      </div>

      {abierto && (
        <form
          key={borrador?.clave ?? 'manual'}
          onSubmit={agregar}
          className="grid gap-3 rounded-lg border border-line bg-card p-4 sm:grid-cols-2"
        >
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor={idTitulo}>Actividad</Label>
            <Input id={idTitulo} required maxLength={200} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={idFecha}>Fecha</Label>
            <Input id={idFecha} type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={idHora}>Hora (opcional)</Label>
            <Input id={idHora} type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={idResponsable}>Responsable</Label>
            <Input id={idResponsable} maxLength={60} value={responsable} onChange={(e) => setResponsable(e.target.value)} />
          </div>
          {idActuacion && (
            <div className="flex items-center justify-between gap-2 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground sm:col-span-2">
              <span>Vinculada a una actuación del expediente.</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIdActuacion(null)}>
                Quitar vínculo
              </Button>
            </div>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={ocupado}>
              Guardar actividad
            </Button>
          </div>
        </form>
      )}

      {ordenadas.length === 0 ? (
        <div className="rounded-lg border border-line bg-card">
          <EstadoVacio icono={CalendarBlank} titulo="Sin actividades agendadas">
            Agrega términos y audiencias con el botón Agendar actividad o término.
          </EstadoVacio>
        </div>
      ) : (
        <ul aria-label="Actividades del proceso" className="m-0 grid list-none gap-2 p-0">
          {ordenadas.map((t) => {
            const vencida = !t.hecha && t.fecha < hoy;
            const paraHoy = !t.hecha && t.fecha === hoy;
            return (
              <li
                key={t.id}
                className={cn(
                  'flex items-start gap-3 rounded-lg border border-line bg-card p-3.5',
                  t.hecha && 'opacity-70',
                )}
              >
                <input
                  type="checkbox"
                  aria-label={`Marcar como realizada: ${t.titulo}`}
                  checked={t.hecha}
                  disabled={ocupado}
                  onChange={(e) => alternar(t, e.target.checked)}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
                <div className="grid min-w-0 flex-1 gap-1">
                  <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {fechaLarga(t.fecha)}
                      {t.hora ? ` · ${t.hora}` : ''}
                    </span>
                    {vencida && <Badge variant="destructive">Vencida</Badge>}
                    {paraHoy && <Badge variant="secondary">Hoy</Badge>}
                  </p>
                  <p className={cn('m-0 text-sm font-medium', t.hecha && 'line-through')}>{t.titulo}</p>
                  <p className="m-0 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {t.hecha ? (
                      <CheckCircle aria-hidden="true" className="size-3.5" />
                    ) : (
                      <Circle aria-hidden="true" className="size-3.5" />
                    )}
                    {t.responsable ? (
                      <>
                        <User aria-hidden="true" className="size-3.5" />
                        {t.responsable}
                      </>
                    ) : (
                      'Sin responsable'
                    )}
                    {t.hecha && t.hechaPor ? ` · realizada por ${t.hechaPor}` : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Eliminar actividad: ${t.titulo}`}
                  disabled={ocupado}
                  onClick={() => setParaEliminar(t)}
                >
                  <Trash aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmarDialog
        abierto={paraEliminar !== null}
        titulo="¿Eliminar esta actividad?"
        descripcion="La actividad se quitará de la agenda de la oficina."
        etiquetaConfirmar="Eliminar actividad"
        destructiva
        onCancelar={() => setParaEliminar(null)}
        onConfirmar={() => paraEliminar && eliminar(paraEliminar)}
      />
    </section>
  );
}
