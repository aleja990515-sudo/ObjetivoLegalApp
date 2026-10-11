'use client';

import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiFetch } from '@/lib/api';
import { EstadoError } from '@/components/estado/estado';
import type { RespuestaAgregar } from './modelo';

interface Props {
  /** Se llama tras agregar, para refrescar la lista. */
  onAgregado: () => void;
}

/** Formulario de alta por radicado (23 dígitos) con alias opcional. */
export function AgregarRadicado({ onAgregado }: Props) {
  const idRadicado = useId();
  const idAlias = useId();
  const idAyuda = useId();
  const [radicado, setRadicado] = useState('');
  const [alias, setAlias] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  async function onSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setAviso('');
    const numero = radicado.replace(/\D/g, '');
    if (numero.length !== 23) {
      setError('El radicado debe tener 23 dígitos.');
      return;
    }

    setError('');
    setEnviando(true);
    try {
      const respuesta = await apiFetch<RespuestaAgregar>('/procesos', {
        method: 'POST',
        body: { radicado: numero, alias: alias.trim() },
      });
      const privados = respuesta.agregados.filter((a) => 'privado' in a && a.privado).length;
      const agregados = respuesta.agregados.length - privados;
      setAviso(agregados > 1 ? `Se agregaron ${agregados} instancias del proceso.` : 'Proceso agregado.');
      if (privados) {
        setError(`${privados} instancia(s) son privadas en la Rama Judicial y no se pueden seguir.`);
      }
      setRadicado('');
      setAlias('');
      onAgregado();
    } catch (fallo) {
      setError(fallo instanceof ApiError ? fallo.message : 'No se pudo agregar el proceso. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3 rounded-lg border border-line bg-card p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
      <div className="grid gap-1.5">
        <Label htmlFor={idRadicado}>Radicado</Label>
        <Input
          id={idRadicado}
          inputMode="numeric"
          autoComplete="off"
          value={radicado}
          onChange={(e) => setRadicado(e.target.value)}
          aria-describedby={idAyuda}
          aria-invalid={error ? true : undefined}
        />
        <p id={idAyuda} className="m-0 text-xs text-muted-foreground">
          23 dígitos de la Rama Judicial.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={idAlias}>Alias (opcional)</Label>
        <Input id={idAlias} autoComplete="off" value={alias} onChange={(e) => setAlias(e.target.value)} />
      </div>
      <Button type="submit" disabled={enviando} aria-busy={enviando} className="h-9 w-full sm:w-auto">
        {enviando ? 'Consultando…' : 'Agregar'}
      </Button>
      {error && (
        <div className="sm:col-span-3">
          <EstadoError mensaje={error} />
        </div>
      )}
      {aviso && (
        <p role="status" className="m-0 text-sm text-accent-foreground sm:col-span-3">
          {aviso}
        </p>
      )}
    </form>
  );
}
