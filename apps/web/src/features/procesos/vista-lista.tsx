'use client';

import { Funnel, MagnifyingGlass, Tray } from '@phosphor-icons/react';
import { useId, useMemo, useState } from 'react';
import { Casilla } from '@/components/casilla/casilla';
import { EstadoError, EstadoVacio } from '@/components/estado/estado';
import { PageHeader } from '@/components/page-header/page-header';
import { Tarjeta } from '@/components/tarjeta/tarjeta';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AgregarRadicado } from './agregar-radicado';
import { fechaHora, hoyColombia } from './formato';
import { FilaProceso } from './fila-proceso';
import { filtrarProcesos, responsablesDe, SIN_RESPONSABLE, type FiltroLista } from './filtros';
import { useProcesos } from './use-procesos';

const FILTRO_INICIAL: FiltroLista = { texto: '', responsable: '', soloNuevas: false };

/** Lista de procesos: alta por radicado, filtros y tabla que se apila en móvil. */
export function VistaLista() {
  const { estado, recargar } = useProcesos();
  const [filtro, setFiltro] = useState<FiltroLista>(FILTRO_INICIAL);
  const idBuscar = useId();
  const idResponsable = useId();
  const idNovedades = useId();

  const datos = estado.tipo === 'lista' ? estado.datos : null;
  const procesos = useMemo(() => datos?.procesos ?? [], [datos]);
  const responsables = useMemo(() => responsablesDe(procesos), [procesos]);
  const visibles = useMemo(() => filtrarProcesos(procesos, filtro), [procesos, filtro]);
  const hoy = hoyColombia();

  const descripcion = datos
    ? `${visibles.length} de ${procesos.length} proceso(s) · última revisión automática: ${fechaHora(datos.ultimaRevision)}`
    : 'Cargando procesos…';

  return (
    <>
      <PageHeader titulo="Procesos" descripcion={descripcion} />

      <AgregarRadicado onAgregado={recargar} />

      {/* Las tres columnas esperan al ancho del riel ampliado (960px), no al del riel de iconos. */}
      <div className="mt-8 grid gap-3 min-[960px]:grid-cols-[minmax(0,1fr)_minmax(0,200px)_auto] min-[960px]:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor={idBuscar}>Buscar</Label>
          <Input
            id={idBuscar}
            type="search"
            autoComplete="off"
            placeholder="Radicado, alias, parte, despacho o etiqueta"
            value={filtro.texto}
            onChange={(e) => setFiltro((f) => ({ ...f, texto: e.target.value }))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={idResponsable}>Responsable</Label>
          <select
            id={idResponsable}
            value={filtro.responsable}
            onChange={(e) => setFiltro((f) => ({ ...f, responsable: e.target.value }))}
            className="min-h-11 w-full rounded-md border border-input bg-transparent px-2.5 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 min-[640px]:min-h-9 min-[640px]:text-sm dark:bg-input/30"
          >
            <option value="">Todos los responsables</option>
            {responsables.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
            <option value={SIN_RESPONSABLE}>Sin responsable</option>
          </select>
        </div>
        <div className="flex min-h-11 items-center gap-2 min-[640px]:min-h-9">
          <Casilla
            id={idNovedades}
            checked={filtro.soloNuevas}
            onChange={(e) => setFiltro((f) => ({ ...f, soloNuevas: e.target.checked }))}
          />
          <Label htmlFor={idNovedades} className="flex items-center gap-1.5 text-sm">
            <Funnel aria-hidden="true" weight="regular" className="size-4 text-muted-foreground" />
            Solo con novedades
          </Label>
        </div>
      </div>

      <div className="mt-8">
        {estado.tipo === 'cargando' && <SkeletonLista />}
        {estado.tipo === 'error' && (
          <EstadoError mensaje="No se pudo cargar la lista de procesos. Recarga la página para intentarlo de nuevo." />
        )}
        {datos && procesos.length === 0 && (
          <Tarjeta variante="vacio">
            <EstadoVacio icono={Tray} titulo="Aún no hay procesos">
              Escribe arriba el radicado de 23 dígitos y pulsa Agregar. La app consulta la Rama Judicial y trae sus actuaciones.
            </EstadoVacio>
          </Tarjeta>
        )}
        {datos && procesos.length > 0 && visibles.length === 0 && (
          <Tarjeta variante="vacio">
            <EstadoVacio icono={MagnifyingGlass} titulo="Ningún proceso coincide con el filtro">
              Cambia el texto de búsqueda o el responsable, o desmarca Solo con novedades.
            </EstadoVacio>
          </Tarjeta>
        )}
        {visibles.length > 0 && (
          // El borde y el recorte van en un contenedor, no en la tabla: `overflow` no aplica a `display: table`.
          <Tarjeta variante="vacio" className="overflow-hidden">
            <table className="block w-full border-collapse min-[640px]:table">
              <caption className="sr-only">Procesos seguidos</caption>
              <thead className="hidden min-[640px]:table-header-group">
                <tr className="border-b border-line text-left text-xs font-medium text-muted-foreground">
                  <th scope="col" className="px-3 py-2.5 font-medium">Proceso</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Despacho</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Última actuación</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="block min-[640px]:table-row-group">
                {visibles.map((p) => (
                  <FilaProceso key={p.idProceso} proceso={p} hoy={hoy} />
                ))}
              </tbody>
            </table>
          </Tarjeta>
        )}
      </div>
    </>
  );
}

/** Esqueleto con la forma de la tabla: cuatro columnas en escritorio, bloques en móvil. */
function SkeletonLista() {
  return (
    <Tarjeta className="overflow-hidden p-0" role="status" aria-live="polite">
      <span className="sr-only">Cargando procesos…</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className="grid gap-2.5 border-b border-line px-4 py-3.5 last:border-b-0 min-[640px]:grid-cols-[34%_22%_24%_20%] min-[640px]:gap-3"
        >
          <div className="grid gap-1.5">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </Tarjeta>
  );
}
