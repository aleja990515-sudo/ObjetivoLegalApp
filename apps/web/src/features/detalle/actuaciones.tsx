'use client';

import { CalendarPlus, Copy, DownloadSimple, EnvelopeSimple, FileText, Gavel, ShareNetwork, WhatsappLogo } from '@phosphor-icons/react';
import { useState } from 'react';
import { EstadoError, EstadoVacio } from '@/components/estado/estado';
import { Tarjeta } from '@/components/tarjeta/tarjeta';
import { TituloSeccion } from '@/components/titulo-seccion/titulo';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { esProvidencia, fecha, fmtRadicado } from '@/features/procesos/formato';
import type { Actuacion, DocumentoActuacion, ProcesoDetalle } from '@/features/procesos/modelo';
import { ApiError, apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { textoCompartir } from './texto-compartir';
import type { Borrador } from './tareas';

type Pestana = 'todas' | 'autos' | 'docs';

interface Props {
  proceso: ProcesoDetalle;
  onAgendar: (borrador: Omit<Borrador, 'clave'>) => void;
  onAviso: (texto: string) => void;
}

type DocumentosCargados = { estado: 'cargando' } | { estado: 'lista'; docs: DocumentoActuacion[] } | { estado: 'error'; mensaje: string };

const PESTANAS: { clave: Pestana; etiqueta: (p: ProcesoDetalle) => string; filtro: (a: Actuacion) => boolean }[] = [
  { clave: 'todas', etiqueta: (p) => `Todas (${p.actuaciones.length})`, filtro: () => true },
  {
    clave: 'autos',
    etiqueta: (p) => `Autos y sentencias (${p.actuaciones.filter((a) => esProvidencia(a.actuacion)).length})`,
    filtro: (a) => esProvidencia(a.actuacion),
  },
  {
    clave: 'docs',
    etiqueta: (p) => `Con documentos (${p.actuaciones.filter((a) => a.conDocumentos).length})`,
    filtro: (a) => Boolean(a.conDocumentos),
  },
];

/** Actuaciones del expediente con pestañas, documentos bajo demanda y compartir. */
export function Actuaciones({ proceso: p, onAgendar, onAviso }: Props) {
  const [pestana, setPestana] = useState<Pestana>('todas');
  const [documentos, setDocumentos] = useState<Record<string, DocumentosCargados>>({});
  const [compartiendo, setCompartiendo] = useState<string | null>(null);
  const nuevas = new Set(p.noVistasIds);
  const activa = PESTANAS.find((t) => t.clave === pestana) ?? PESTANAS[0];
  const lista = p.actuaciones.filter(activa.filtro);

  async function verDocumentos(actuacion: Actuacion) {
    const clave = String(actuacion.id);
    setDocumentos((previo) => ({ ...previo, [clave]: { estado: 'cargando' } }));
    try {
      const docs = await apiFetch<DocumentoActuacion[]>(`/actuaciones/${actuacion.id}/documentos`);
      setDocumentos((previo) => ({ ...previo, [clave]: { estado: 'lista', docs } }));
    } catch (fallo) {
      const mensaje = fallo instanceof ApiError ? fallo.message : 'No se pudieron cargar los documentos.';
      setDocumentos((previo) => ({ ...previo, [clave]: { estado: 'error', mensaje } }));
    }
  }

  async function copiar(actuacion: Actuacion) {
    try {
      await navigator.clipboard.writeText(textoCompartir(actuacion, p).replace(/\*/g, ''));
      onAviso('Copiado.');
    } catch {
      onAviso('No se pudo copiar.');
    }
  }

  return (
    <section aria-labelledby="titulo-actuaciones" className="grid gap-3">
      <TituloSeccion id="titulo-actuaciones" titulo="Actuaciones" icono={Gavel} />

      <div role="tablist" aria-label="Filtrar actuaciones" className="flex flex-wrap gap-1.5">
        {PESTANAS.map((t) => (
          <button
            key={t.clave}
            type="button"
            role="tab"
            aria-selected={t.clave === pestana}
            onClick={() => setPestana(t.clave)}
            className={cn(
              'min-h-11 rounded-pill border px-3 py-1 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 min-[640px]:min-h-8',
              t.clave === pestana
                ? 'border-transparent bg-accent text-accent-foreground'
                : 'border-line bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {t.etiqueta(p)}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <Tarjeta variante="vacio">
          <EstadoVacio
            icono={FileText}
            titulo={pestana === 'autos' ? 'No hay autos ni sentencias registrados' : 'No hay actuaciones con documentos'}
          >
            Cambia de pestaña para ver todas las actuaciones.
          </EstadoVacio>
        </Tarjeta>
      ) : (
        <ul aria-label="Lista de actuaciones" className="m-0 grid list-none gap-2 p-0">
          {lista.map((a) => {
            const esNueva = nuevas.has(a.id);
            const docs = documentos[String(a.id)];
            const termino = a.fechaInicial ? `Término: ${fecha(a.fechaInicial)} a ${fecha(a.fechaFinal)}` : null;
            const providencia = esProvidencia(a.actuacion);
            return (
              <li
                key={a.id}
                className={cn(
                  'grid gap-2 rounded-lg border border-line bg-card p-4',
                  // Sombra interior: un borde de 3px desplaza el relleno y desalinea la fila.
                  esNueva && 'shadow-[inset_3px_0_0_var(--accent)]',
                )}
              >
                <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {fecha(a.fecha)} · registrada {fecha(a.fechaRegistro)}
                  </span>
                  {esNueva && <Badge>Nueva</Badge>}
                </p>
                <p className="m-0 text-sm font-medium">{a.actuacion}</p>
                {a.anotacion && <p className="m-0 text-sm text-muted-foreground">{a.anotacion}</p>}
                {termino && <p className="m-0 text-xs text-muted-foreground">{termino}</p>}
                {!a.conDocumentos && providencia && (
                  <p className="m-0 text-xs text-muted-foreground">El despacho no adjuntó el documento en la Consulta Nacional.</p>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {a.conDocumentos && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 min-[640px]:min-h-8"
                      onClick={() => verDocumentos(a)}
                      disabled={docs?.estado === 'cargando' || docs?.estado === 'lista'}
                      aria-busy={docs?.estado === 'cargando'}
                    >
                      <FileText aria-hidden="true" weight="regular" />
                      {docs?.estado === 'cargando' ? 'Cargando…' : 'Ver documentos'}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11 min-[640px]:min-h-8"
                    onClick={() =>
                      onAgendar({
                        titulo: `Término: ${a.actuacion ?? 'actuación'}`,
                        fecha: a.fechaFinal ? a.fechaFinal.slice(0, 10) : '',
                        idActuacion: String(a.id),
                      })
                    }
                  >
                    <CalendarPlus aria-hidden="true" weight="regular" />
                    Agendar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11 min-[640px]:min-h-8"
                    aria-expanded={compartiendo === String(a.id)}
                    onClick={() => setCompartiendo((v) => (v === String(a.id) ? null : String(a.id)))}
                  >
                    <ShareNetwork aria-hidden="true" weight="regular" />
                    Compartir
                  </Button>
                </div>

                {compartiendo === String(a.id) && (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Compartir actuación">
                    <a
                      className={buttonVariants({ variant: 'outline', size: 'sm', className: 'min-h-11 min-[640px]:min-h-8' })}
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`https://wa.me/?text=${encodeURIComponent(textoCompartir(a, p))}`}
                    >
                      <WhatsappLogo aria-hidden="true" weight="regular" />
                      WhatsApp
                    </a>
                    <a
                      className={buttonVariants({ variant: 'outline', size: 'sm', className: 'min-h-11 min-[640px]:min-h-8' })}
                      href={`mailto:?subject=${encodeURIComponent(`${a.actuacion ?? 'Actuación'}, radicado ${fmtRadicado(p.radicado)}`)}&body=${encodeURIComponent(textoCompartir(a, p).replace(/\*/g, ''))}`}
                    >
                      <EnvelopeSimple aria-hidden="true" weight="regular" />
                      Correo
                    </a>
                    <Button variant="outline" size="sm" className="min-h-11 min-[640px]:min-h-8" onClick={() => copiar(a)}>
                      <Copy aria-hidden="true" weight="regular" />
                      Copiar
                    </Button>
                  </div>
                )}

                {docs?.estado === 'error' && <EstadoError mensaje={docs.mensaje} />}
                {docs?.estado === 'lista' && <Documentos docs={docs.docs} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Documentos({ docs }: { docs: DocumentoActuacion[] }) {
  if (docs.length === 0) {
    return <p className="m-0 text-xs text-muted-foreground">La Rama no devolvió documentos para esta actuación.</p>;
  }
  return (
    <ul aria-label="Documentos de la actuación" className="m-0 grid list-none gap-1.5 p-0">
      {docs.map((d, i) => (
        <li key={`${d.url}-${i}`} className="flex flex-wrap items-center gap-x-2 text-sm">
          <DownloadSimple aria-hidden="true" weight="regular" className="size-4 text-muted-foreground" />
          <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
            {d.nombre} ({String(d.tipo || 'archivo').toUpperCase()})
          </a>
          {d.fechaCarga ? <span className="text-xs text-muted-foreground">cargado {fecha(String(d.fechaCarga))}</span> : null}
        </li>
      ))}
    </ul>
  );
}
