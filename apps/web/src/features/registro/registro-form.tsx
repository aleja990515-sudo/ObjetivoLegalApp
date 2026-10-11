'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiFetch } from '@/lib/api';

const ERROR_DE_CONEXION = 'No hay conexión con el servidor. Inténtalo de nuevo.';
const CLAVE_MINIMA = 12;
const CELULAR = /^3\d{9}$/;

export const TEXTO_CONSENTIMIENTO =
  'Autorizo a la oficina a tratar mis datos personales (nombre, cédula, correo y celular) para verificar mi identidad y comunicarme sobre mis procesos, según la Ley 1581 de 2012.';

interface Respuesta {
  mensaje: string;
}

/** Formulario de autorregistro. La cuenta queda inactiva hasta que la oficina la active. */
export function RegistroForm() {
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [cedula, setCedula] = useState('');
  const [correo, setCorreo] = useState('');
  const [celular, setCelular] = useState('');
  const [clave, setClave] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [consentimiento, setConsentimiento] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensajeFinal, setMensajeFinal] = useState('');

  function validar(): string {
    if (!CELULAR.test(celular.trim())) return 'El celular debe tener 10 dígitos y empezar por 3.';
    if (clave.length < CLAVE_MINIMA) return `La clave debe tener al menos ${CLAVE_MINIMA} caracteres.`;
    if (clave !== confirmacion) return 'Las claves no coinciden.';
    if (!consentimiento) return 'Debes aceptar el tratamiento de tus datos para registrarte.';
    return '';
  }

  async function onSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const problema = validar();
    setError(problema);
    if (problema) return;
    setEnviando(true);
    try {
      const respuesta = await apiFetch<Respuesta>('/registro', {
        method: 'POST',
        body: {
          nombreCompleto: nombreCompleto.trim(),
          cedula: cedula.trim(),
          correo: correo.trim(),
          celular: celular.trim(),
          clave,
          consentimiento: true,
        },
      });
      setMensajeFinal(respuesta.mensaje);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : ERROR_DE_CONEXION);
    } finally {
      setEnviando(false);
    }
  }

  if (mensajeFinal) {
    return (
      <div className="grid gap-4">
        <p role="status" className="m-0 text-sm">
          {mensajeFinal}
        </p>
        <Link href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit} noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="nombre-completo">Nombre completo</Label>
        <Input
          id="nombre-completo"
          name="nombreCompleto"
          autoComplete="name"
          required
          value={nombreCompleto}
          onChange={(e) => setNombreCompleto(e.target.value)}
          className="min-h-11 rounded-md border-line-input bg-surface px-3 text-base md:text-sm"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cedula">Cédula</Label>
        <Input
          id="cedula"
          name="cedula"
          inputMode="numeric"
          required
          value={cedula}
          onChange={(e) => setCedula(e.target.value)}
          className="min-h-11 rounded-md border-line-input bg-surface px-3 text-base md:text-sm"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="correo">Correo</Label>
        <Input
          id="correo"
          name="correo"
          type="email"
          autoComplete="email"
          required
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          className="min-h-11 rounded-md border-line-input bg-surface px-3 text-base md:text-sm"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="celular">Celular</Label>
        <Input
          id="celular"
          name="celular"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required
          value={celular}
          onChange={(e) => setCelular(e.target.value)}
          className="min-h-11 rounded-md border-line-input bg-surface px-3 text-base md:text-sm"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="clave">Clave</Label>
        <Input
          id="clave"
          name="clave"
          type="password"
          autoComplete="new-password"
          required
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          className="min-h-11 rounded-md border-line-input bg-surface px-3 text-base md:text-sm"
        />
        <p className="m-0 text-xs text-muted-foreground">Mínimo {CLAVE_MINIMA} caracteres.</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="confirmar-clave">Repite la clave</Label>
        <Input
          id="confirmar-clave"
          name="confirmarClave"
          type="password"
          autoComplete="new-password"
          required
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          className="min-h-11 rounded-md border-line-input bg-surface px-3 text-base md:text-sm"
        />
      </div>
      <label htmlFor="consentimiento" className="flex items-start gap-2.5 text-sm">
        <input
          id="consentimiento"
          name="consentimiento"
          type="checkbox"
          checked={consentimiento}
          onChange={(e) => setConsentimiento(e.target.checked)}
          className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
        />
        <span>{TEXTO_CONSENTIMIENTO}</span>
      </label>
      <p role="alert" className="m-0 min-h-5 text-sm text-destructive">
        {error}
      </p>
      <Button type="submit" className="min-h-11 w-full" disabled={enviando}>
        Crear cuenta
      </Button>
      <Link href="/login" className="justify-self-center text-sm font-medium text-primary underline-offset-4 hover:underline">
        Ya tengo cuenta
      </Link>
    </form>
  );
}
