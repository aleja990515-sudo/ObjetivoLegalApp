'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiFetch } from '@/lib/api';

const ERROR_DE_CONEXION = 'No hay conexión con el servidor. Inténtalo de nuevo.';

export function LoginForm() {
  const router = useRouter();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await apiFetch('/login', { method: 'POST', body: { correo, clave } });
      router.replace('/');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : ERROR_DE_CONEXION);
      setEnviando(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="grid gap-1.5">
        <Label htmlFor="correo">Correo</Label>
        <Input
          id="correo"
          name="correo"
          type="email"
          autoComplete="username"
          required
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          className="min-h-11 rounded-md border-line-input bg-surface px-3 text-base md:text-sm"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="clave">Clave</Label>
        <Input
          id="clave"
          name="clave"
          type="password"
          autoComplete="current-password"
          required
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          className="min-h-11 rounded-md border-line-input bg-surface px-3 text-base md:text-sm"
        />
      </div>
      <p role="alert" className="m-0 min-h-5 text-sm text-destructive">
        {error}
      </p>
      <Button type="submit" className="min-h-11 w-full" disabled={enviando}>
        Entrar
      </Button>
    </form>
  );
}
