'use client';

import { CalendarBlank, ListChecks, Plus, Trash, User, X } from '@phosphor-icons/react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Casilla } from '@/components/casilla/casilla';
import { ConfirmarDialog } from '@/components/dialogo/confirmar-dialog';
import { EstadoVacio } from '@/components/estado/estado';
import { Tarjeta } from '@/components/tarjeta/tarjeta';
import { TituloSeccion } from '@/components/titulo-seccion/titulo';
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
    // El ancla del scroll lleva scroll-mt para no quedar bajo la cabecera pegajosa de movil.
    <section id="seccion-tareas" aria-labelledby="titulo-tareas" className="grid scroll-mt-[var(--top-h)] gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TituloSeccion id="titulo-tareas" titulo="Agenda del proceso" icono={ListChecks} />
        <Button variant="outline" size="sm" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)} className="min-h-11 min-[640px]:min-h-9">
          {abierto ? (
            <X aria-hidden="true" weight="regular" />
          ) : (
            <Plus aria-hidden="true" weight="regular" />
          )}
          {abierto ? 'Cerrar' : 'Agendar actividad o término'}
        </Button>
      </div>

      {abierto && (
        <form
          key={borrador?.clave ?? 'manual'}
          onSubmit={agregar}
          className="grid gap-3 rounded-lg border border-line bg-card p-4 min-[640px]:grid-cols-2"
        >
          <div className="grid gap-1.5 min-[640px]:col-span-2">
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
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground min-[640px]:col-span-2">
              <span className="min-w-0">Vinculada a una actuación del expediente.</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIdActuacion(null)} className="min-h-11 min-[640px]:min-h-9">
                Quitar vínculo
              </Button>
            </div>
          )}
          <div className="min-[640px]:col-span-2">
            <Button type="submit" disabled={ocupado} className="min-h-11 min-[640px]:min-h-9">
              Guardar actividad
            </Button>
          </div>
        </form>
      )}

      {ordenadas.length === 0 ? (
        <Tarjeta variante="vacio">
          <EstadoVacio icono={CalendarBlank} titulo="Sin actividades agendadas">
            Agrega términos y audiencias con el botón Agendar actividad o término.
          </EstadoVacio>
        </Tarjeta>
      ) : (
        <ul aria-label="Actividades del proceso" className="m-0 grid list-none gap-2 p-0">
          {ordenadas.map((t) => {
            const vencida = !t.hecha && t.fecha < hoy;
            const paraHoy = !t.hecha && t.fecha === hoy;
            return (
              <li
                key={t.id}
                className={cn(
                  'flex items-start gap-3 rounded-lg border border-line bg-card p-4',
                  t.hecha && 'opacity-70',
                )}
              >
                {/* La fila entera es etiqueta implicita de la casilla: tocarla la alterna.
                    El boton de eliminar queda fuera porque es contenido interactivo propio. */}
                <label className="flex min-h-11 min-w-0 flex-1 items-start gap-3 min-[640px]:min-h-9">
                  <Casilla
                    className="mt-1"
                    aria-label={`Marcar como realizada: ${t.titulo}`}
                    checked={t.hecha}
                    disabled={ocupado}
                    onChange={(e) => alternar(t, e.target.checked)}
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
                      {t.responsable ? (
                        <>
                          <User aria-hidden="true" weight="regular" className="size-3.5" />
                          {t.responsable}
                        </>
                      ) : (
                        'Sin responsable'
                      )}
                      {t.hecha && t.hechaPor ? ` · realizada por ${t.hechaPor}` : ''}
                    </p>
                  </div>
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 min-[640px]:size-9"
                  aria-label={`Eliminar actividad: ${t.titulo}`}
                  disabled={ocupado}
                  onClick={() => setParaEliminar(t)}
                >
                  <Trash aria-hidden="true" weight="regular" />
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
