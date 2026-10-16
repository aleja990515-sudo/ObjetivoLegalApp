'use client';

import { ArrowSquareOut, ArrowsClockwise, Check, PencilSimple, Trash } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { ConfirmarDialog } from '@/components/dialogo/confirmar-dialog';
import { CLASE_TITULO } from '@/components/page-header/page-header';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fecha, fechaHora, fmtRadicado } from '@/features/procesos/formato';
import type { ProcesoDetalle, ProcesoResumen } from '@/features/procesos/modelo';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { EnlaceVolver } from './enlace-volver';
import type { Ejecutar } from './tipos';

interface Props {
  proceso: ProcesoDetalle;
  ocupado: boolean;
  ejecutar: Ejecutar;
}

const URL_CONSULTA_OFICIAL = 'https://consultaprocesos.ramajudicial.gov.co/Procesos/NumeroRadicacion';

/** Cabecera del proceso: identidad, datos de la Rama, acciones y gestión de la oficina. */
export function CabeceraProceso({ proceso: p, ocupado, ejecutar }: Props) {
  const router = useRouter();
  const [renombrando, setRenombrando] = useState(false);
  const [quitando, setQuitando] = useState(false);
  const idAlias = useId();
  const idResponsable = useId();
  const idEtiquetas = useId();
  const [alias, setAlias] = useState(p.alias);
  const [responsable, setResponsable] = useState(p.responsable);
  const [etiquetas, setEtiquetas] = useState(p.etiquetas.join(', '));
  const d = p.detalle;
  const despacho = typeof d.despacho === 'string' ? d.despacho : null;
  const titulo = p.alias || despacho || 'Proceso';
  const pendiente = p.noVistas > 0 || p.estadosNoVistos > 0 || p.nuevaInstancia;

  const dato = (etiqueta: string, valor: unknown) => {
    if (valor === null || valor === undefined || valor === '') return null;
    return (
      <div className="grid min-w-0 gap-0.5">
        <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
        <dd className="m-0 break-words text-sm">{String(valor)}</dd>
      </div>
    );
  };

  function marcarVisto() {
    return ejecutar(async () => {
      await apiFetch<ProcesoResumen>(`/procesos/${p.idProceso}/visto`, { method: 'POST' });
      return { proceso: await apiFetch<ProcesoDetalle>(`/procesos/${p.idProceso}`), aviso: 'Marcado como revisado.' };
    });
  }

  function actualizar() {
    return ejecutar(async () => {
      const resultado = await apiFetch<{ instanciasNuevas?: number }>(`/procesos/${p.idProceso}/actualizar`, { method: 'POST' });
      const nuevas = resultado.instanciasNuevas ?? 0;
      return {
        proceso: await apiFetch<ProcesoDetalle>(`/procesos/${p.idProceso}`),
        aviso: nuevas
          ? `El proceso tiene ${nuevas} instancia(s) nueva(s). Ya se agregaron a la lista.`
          : 'Consulta terminada.',
      };
    });
  }

  function guardarAlias(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    return ejecutar(async () => {
      const proceso = await apiFetch<ProcesoDetalle>(`/procesos/${p.idProceso}`, { method: 'PATCH', body: { alias } });
      setRenombrando(false);
      return { proceso, aviso: 'Nombre guardado.' };
    });
  }

  function guardarGestion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    return ejecutar(async () => {
      const proceso = await apiFetch<ProcesoDetalle>(`/procesos/${p.idProceso}`, {
        method: 'PATCH',
        body: { responsable, etiquetas },
      });
      setEtiquetas(proceso.etiquetas.join(', '));
      return { proceso, aviso: 'Gestión guardada.' };
    });
  }

  function quitar() {
    setQuitando(false);
    return ejecutar(async () => {
      await apiFetch<{ ok: true }>(`/procesos/${p.idProceso}`, { method: 'DELETE' });
      router.push('/');
      return { aviso: 'Proceso quitado de la lista.' };
    });
  }

  return (
    <section aria-labelledby="titulo-proceso" className="grid gap-5">
      <EnlaceVolver />

      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 id="titulo-proceso" className={CLASE_TITULO}>
            {titulo}
          </h1>
          <div className="flex flex-wrap gap-1.5">
            {p.nuevaInstancia && <Badge>Nueva instancia</Badge>}
            {p.noVistas > 0 && <Badge>{p.noVistas} nueva(s)</Badge>}
            {p.estadosNoVistos > 0 && <Badge>{p.estadosNoVistos} estado(s) nuevo(s)</Badge>}
          </div>
        </div>
        <p className="m-0 font-mono text-sm text-muted-foreground tabular-nums">{fmtRadicado(p.radicado)}</p>
        {p.alias && despacho && <p className="m-0 text-sm text-muted-foreground">{despacho}</p>}
        {p.error && <p className="m-0 text-sm text-destructive">Última consulta falló: {p.error}</p>}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Acciones del proceso">
        {pendiente && (
          <Button onClick={marcarVisto} disabled={ocupado} className="min-h-11 min-[640px]:min-h-9">
            <Check aria-hidden="true" weight="regular" className="size-4" />
            Marcar como revisado
          </Button>
        )}
        <Button variant="outline" onClick={actualizar} disabled={ocupado} className="min-h-11 min-[640px]:min-h-9">
          <ArrowsClockwise aria-hidden="true" weight="regular" className="size-4" />
          Actualizar
        </Button>
        <Button variant="outline" onClick={() => setRenombrando((v) => !v)} aria-expanded={renombrando} className="min-h-11 min-[640px]:min-h-9">
          <PencilSimple aria-hidden="true" weight="regular" className="size-4" />
          Renombrar
        </Button>
        <Button variant="destructive" onClick={() => setQuitando(true)} disabled={ocupado} className="min-h-11 min-[640px]:min-h-9">
          <Trash aria-hidden="true" weight="regular" className="size-4" />
          Quitar de la lista
        </Button>
      </div>

      {renombrando && (
        <form onSubmit={guardarAlias} className="grid max-w-md gap-3 rounded-lg border border-line bg-card p-4">
          <div className="grid gap-1.5">
            <Label htmlFor={idAlias}>Nombre interno del proceso</Label>
            <Input id={idAlias} value={alias} maxLength={120} onChange={(e) => setAlias(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={ocupado}>
              Guardar nombre
            </Button>
            <Button type="button" variant="outline" onClick={() => setRenombrando(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      <dl className={cn('m-0 grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-line bg-card p-4 min-[640px]:grid-cols-2 min-[960px]:grid-cols-3')}>
        {dato('Despacho', d.despacho)}
        {dato('Ponente', d.ponente)}
        {dato('Clase', d.claseProceso)}
        {dato('Subclase', d.subclaseProceso)}
        {dato('Tipo', d.tipoProceso)}
        {dato('Recurso', d.recurso)}
        {dato('Ubicación', d.ubicacion)}
        {dato('Fecha de radicación', d.fechaProceso ? fecha(String(d.fechaProceso)) : null)}
        {dato('Responsable', p.responsable)}
        {dato('Etiquetas', p.etiquetas.join(', '))}
        {dato('Agregado por', p.agregadoPor)}
        {dato('Consultado en la Rama', fechaHora(p.ultimaConsulta))}
      </dl>

      <p className="m-0 text-sm">
        <a href={URL_CONSULTA_OFICIAL} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: 'link', size: 'sm' }), 'h-auto p-0')}>
          Abrir la consulta oficial de la Rama Judicial
          <ArrowSquareOut aria-hidden="true" weight="regular" className="size-3.5" />
        </a>
      </p>

      {/* `items-start` es obligatorio: la columna de Etiquetas tiene una línea de ayuda extra, así que
          con el `stretch` por defecto ambas celdas se igualan a la más alta y el grid interno reparte
          el sobrante entre sus filas. Eso deformaba el input de Responsable y desalineaba los labels. */}
      <form onSubmit={guardarGestion} className="grid items-start gap-3 rounded-lg border border-line bg-card p-4 min-[640px]:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={idResponsable}>Responsable</Label>
          <Input id={idResponsable} value={responsable} maxLength={60} onChange={(e) => setResponsable(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={idEtiquetas}>Etiquetas</Label>
          <Input id={idEtiquetas} value={etiquetas} maxLength={200} onChange={(e) => setEtiquetas(e.target.value)} />
          <p className="m-0 text-xs text-muted-foreground">Separadas por coma, por ejemplo: urgente, cliente X, laboral.</p>
        </div>
        <div className="min-[640px]:col-span-2">
          <Button type="submit" variant="outline" disabled={ocupado} className="min-h-11 min-[640px]:min-h-9">
            Guardar gestión
          </Button>
        </div>
      </form>

      <ConfirmarDialog
        abierto={quitando}
        titulo="¿Quitar este proceso?"
        descripcion="¿Quitar este proceso de la lista de la oficina? Se perderán sus notas y su agenda."
        etiquetaConfirmar="Quitar proceso"
        destructiva
        onCancelar={() => setQuitando(false)}
        onConfirmar={quitar}
      />
    </section>
  );
}
