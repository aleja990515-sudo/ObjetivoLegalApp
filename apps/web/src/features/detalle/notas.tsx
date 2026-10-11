'use client';

import { NotePencil, Trash } from '@phosphor-icons/react';
import { useId, useState, type FormEvent } from 'react';
import { ConfirmarDialog } from '@/components/dialogo/confirmar-dialog';
import { EstadoVacio } from '@/components/estado/estado';
import { Tarjeta } from '@/components/tarjeta/tarjeta';
import { TituloSeccion } from '@/components/titulo-seccion/titulo';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { fechaHora } from '@/features/procesos/formato';
import type { Nota, ProcesoDetalle } from '@/features/procesos/modelo';
import { apiFetch } from '@/lib/api';
import type { Ejecutar } from './tipos';

interface Props {
  proceso: ProcesoDetalle;
  ocupado: boolean;
  ejecutar: Ejecutar;
}

/** Notas internas de la oficina: alta y borrado con confirmación. */
export function Notas({ proceso: p, ocupado, ejecutar }: Props) {
  const idTexto = useId();
  const [texto, setTexto] = useState('');
  const [paraEliminar, setParaEliminar] = useState<Nota | null>(null);

  function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    return ejecutar(async () => {
      const proceso = await apiFetch<ProcesoDetalle>(`/procesos/${p.idProceso}/notas`, {
        method: 'POST',
        body: { texto },
      });
      setTexto('');
      return { proceso, aviso: 'Nota guardada.' };
    });
  }

  function eliminar(nota: Nota) {
    setParaEliminar(null);
    return ejecutar(async () => ({
      proceso: await apiFetch<ProcesoDetalle>(`/procesos/${p.idProceso}/notas/${nota.id}`, { method: 'DELETE' }),
      aviso: 'Nota eliminada.',
    }));
  }

  return (
    <section aria-labelledby="titulo-notas" className="grid gap-3">
      <TituloSeccion id="titulo-notas" titulo="Notas internas" icono={NotePencil} />

      <form onSubmit={guardar} className="grid gap-2 rounded-lg border border-line bg-card p-4">
        <Label htmlFor={idTexto}>Nota</Label>
        <textarea
          id={idTexto}
          required
          rows={3}
          maxLength={4000}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-2.5 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <div>
          <Button type="submit" variant="outline" disabled={ocupado || !texto.trim()} className="min-h-11 min-[640px]:min-h-9">
            Guardar nota
          </Button>
        </div>
      </form>

      {p.notas.length === 0 ? (
        <Tarjeta variante="vacio">
          <EstadoVacio icono={NotePencil} titulo="Sin notas todavía">
            Las notas son visibles para toda la oficina. Escribe una arriba para dejar constancia.
          </EstadoVacio>
        </Tarjeta>
      ) : (
        <ul aria-label="Notas del proceso" className="m-0 grid list-none gap-2 p-0">
          {p.notas.map((n) => (
            <li key={n.id} className="grid gap-1.5 rounded-lg border border-line bg-card p-4">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {n.autor} · {fechaHora(n.fecha)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 min-[640px]:size-8"
                  aria-label={`Eliminar nota de ${n.autor}`}
                  disabled={ocupado}
                  onClick={() => setParaEliminar(n)}
                >
                  <Trash aria-hidden="true" weight="regular" />
                </Button>
              </div>
              <p className="m-0 text-sm whitespace-pre-wrap">{n.texto}</p>
            </li>
          ))}
        </ul>
      )}

      <ConfirmarDialog
        abierto={paraEliminar !== null}
        titulo="¿Eliminar esta nota?"
        descripcion="La nota se borrará para toda la oficina."
        etiquetaConfirmar="Eliminar nota"
        destructiva
        onCancelar={() => setParaEliminar(null)}
        onConfirmar={() => paraEliminar && eliminar(paraEliminar)}
      />
    </section>
  );
}
