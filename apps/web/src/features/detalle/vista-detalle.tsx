'use client';

import { UserCircle } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { EstadoError } from '@/components/estado/estado';
import { Tarjeta } from '@/components/tarjeta/tarjeta';
import { TituloSeccion } from '@/components/titulo-seccion/titulo';
import { Skeleton } from '@/components/ui/skeleton';
import { hoyColombia } from '@/features/procesos/formato';
import type { ProcesoDetalle } from '@/features/procesos/modelo';
import { ApiError, apiFetch } from '@/lib/api';
import { Actuaciones } from './actuaciones';
import { CabeceraProceso } from './cabecera-proceso';
import { EnlaceVolver } from './enlace-volver';
import { Notas } from './notas';
import { Tareas, type Borrador } from './tareas';
import type { Ejecutar } from './tipos';

type Aviso = { tipo: 'ok' | 'error'; texto: string };

/** Detalle de un proceso: cabecera y gestión, agenda, notas, sujetos y actuaciones. */
export function VistaDetalle({ id }: { id: string }) {
  const [proceso, setProceso] = useState<ProcesoDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);

  useEffect(() => {
    let activo = true;
    apiFetch<ProcesoDetalle>(`/procesos/${id}`)
      .then((datos) => {
        if (activo) setProceso(datos);
      })
      .catch((fallo: unknown) => {
        if (activo) setError(fallo instanceof ApiError ? fallo.message : 'No se pudo cargar el proceso.');
      });
    return () => {
      activo = false;
    };
  }, [id]);

  const ejecutar: Ejecutar = useCallback(async (operacion) => {
    setOcupado(true);
    setAviso(null);
    try {
      const resultado = await operacion();
      if (resultado.proceso) setProceso(resultado.proceso);
      if (resultado.aviso) setAviso({ tipo: 'ok', texto: resultado.aviso });
    } catch (fallo) {
      setAviso({
        tipo: 'error',
        texto: fallo instanceof ApiError ? fallo.message : 'No se pudo completar la acción. Intenta de nuevo.',
      });
    } finally {
      setOcupado(false);
    }
  }, []);

  if (error) {
    return (
      <div className="grid gap-4">
        <EnlaceVolver />
        <EstadoError mensaje={error} />
      </div>
    );
  }
  if (!proceso) return <SkeletonDetalle />;

  function agendar(datos: Omit<Borrador, 'clave'>) {
    setBorrador({ ...datos, clave: Date.now() });
    // El bloque global solo anula transiciones CSS: el desplazamiento hay que decidirlo aqui.
    const suave = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('seccion-tareas')?.scrollIntoView?.({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
  }

  return (
    <div className="grid gap-8">
      <CabeceraProceso proceso={proceso} ocupado={ocupado} ejecutar={ejecutar} />

      {aviso && (
        aviso.tipo === 'error' ? (
          <EstadoError mensaje={aviso.texto} />
        ) : (
          <p role="status" className="m-0 text-sm text-accent-foreground">
            {aviso.texto}
          </p>
        )
      )}

      <Tareas proceso={proceso} hoy={hoyColombia()} ocupado={ocupado} ejecutar={ejecutar} borrador={borrador} />

      <Notas proceso={proceso} ocupado={ocupado} ejecutar={ejecutar} />

      <section aria-labelledby="titulo-sujetos" className="grid gap-3">
        <TituloSeccion id="titulo-sujetos" titulo="Sujetos procesales" icono={UserCircle} />
        <ul className="m-0 grid list-none gap-1.5 p-0 text-sm">
          {proceso.sujetos.length === 0 ? (
            <li className="text-muted-foreground">Sin información</li>
          ) : (
            proceso.sujetos.map((s, i) => (
              <li key={`${s.nombre}-${i}`}>
                {s.tipo && <strong className="font-medium">{s.tipo}: </strong>}
                {s.nombre}
              </li>
            ))
          )}
        </ul>
      </section>

      <Actuaciones proceso={proceso} onAgendar={agendar} onAviso={(texto) => setAviso({ tipo: 'ok', texto })} />
    </div>
  );
}

function SkeletonDetalle() {
  return (
    <div role="status" aria-live="polite" className="grid gap-6">
      <span className="sr-only">Cargando proceso…</span>
      <div aria-hidden="true" className="grid gap-2">
        <Skeleton className="h-6 w-2/5" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      <Tarjeta className="grid gap-2" aria-hidden="true">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </Tarjeta>
    </div>
  );
}
