'use client';

import { CheckCircle } from '@phosphor-icons/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EstadoError, EstadoVacio } from '@/components/estado/estado';
import { PageHeader } from '@/components/page-header/page-header';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { esProvidencia, fecha, fmtRadicado } from '@/features/procesos/formato';
import type { Novedad } from '@/features/procesos/modelo';
import { ApiError, apiFetch } from '@/lib/api';

type Estado = { tipo: 'cargando' } | { tipo: 'lista'; novedades: Novedad[] } | { tipo: 'error'; mensaje: string };

/** Novedades: actuaciones sin revisar y nuevas instancias de todos los procesos. */
export function VistaNovedades() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  useEffect(() => {
    let activo = true;
    apiFetch<Novedad[]>('/novedades')
      .then((novedades) => {
        if (activo) setEstado({ tipo: 'lista', novedades });
      })
      .catch((fallo: unknown) => {
        if (!activo) return;
        const mensaje = fallo instanceof ApiError ? fallo.message : 'No se pudieron cargar las novedades.';
        setEstado({ tipo: 'error', mensaje });
      });
    return () => {
      activo = false;
    };
  }, []);

  const descripcion =
    estado.tipo === 'lista' ? `${estado.novedades.length} novedad(es) sin revisar` : 'Actuaciones nuevas y nuevas instancias';

  return (
    <>
      <PageHeader titulo="Novedades" descripcion={descripcion} />

      {estado.tipo === 'cargando' && <SkeletonNovedades />}
      {estado.tipo === 'error' && <EstadoError mensaje={estado.mensaje} />}
      {estado.tipo === 'lista' && estado.novedades.length === 0 && (
        <div className="rounded-lg border border-line bg-card">
          <EstadoVacio icono={CheckCircle} titulo="No hay novedades pendientes">
            Cuando la Rama registre actuaciones nuevas o aparezca una nueva instancia, se mostrarán aquí hasta que las marques como revisadas.
          </EstadoVacio>
        </div>
      )}
      {estado.tipo === 'lista' && estado.novedades.length > 0 && (
        <ul className="m-0 grid list-none gap-3 p-0">
          {estado.novedades.map((novedad, indice) => (
            <TarjetaNovedad key={`${novedad.idProceso}-${novedad.tipo}-${indice}`} novedad={novedad} />
          ))}
        </ul>
      )}
    </>
  );
}

function TarjetaNovedad({ novedad: n }: { novedad: Novedad }) {
  const nombre = n.alias || n.despacho || 'Proceso';
  const esInstancia = n.tipo === 'instancia';
  const providencia = n.tipo === 'actuacion' && esProvidencia(n.actuacion.actuacion);

  return (
    <li className="relative rounded-lg border border-line bg-card p-4 hover:bg-surface-sunken focus-within:bg-surface-sunken">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/procesos/${n.idProceso}`}
          className="font-semibold text-foreground no-underline after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
        >
          {nombre}
        </Link>
        {esInstancia ? <Badge>Nueva instancia</Badge> : <Badge variant={providencia ? 'default' : 'secondary'}>{providencia ? 'Auto / providencia' : 'Actuación'}</Badge>}
      </div>
      <p className="m-0 mt-1 font-mono text-xs text-muted-foreground tabular-nums">{fmtRadicado(n.radicado)}</p>
      {esInstancia ? (
        <p className="m-0 mt-2 text-sm">El proceso apareció en un nuevo despacho: {n.despacho || 'sin despacho informado'}.</p>
      ) : (
        <div className="mt-2 grid gap-1 text-sm">
          <p className="m-0">
            <span className="tabular-nums">{fecha(n.actuacion.fecha)}</span>
            <span className="font-medium"> · {n.actuacion.actuacion}</span>
          </p>
          {n.actuacion.anotacion && <p className="m-0 text-muted-foreground">{n.actuacion.anotacion}</p>}
        </div>
      )}
      {n.alias && n.despacho && <p className="m-0 mt-2 text-xs text-muted-foreground">{n.despacho}</p>}
    </li>
  );
}

function SkeletonNovedades() {
  return (
    <div role="status" aria-live="polite" className="grid gap-3">
      <span className="sr-only">Cargando novedades…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} aria-hidden="true" className="grid gap-2 rounded-lg border border-line bg-card p-4">
          <Skeleton className={i % 2 ? 'h-4 w-2/5' : 'h-4 w-1/2'} />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ))}
    </div>
  );
}
