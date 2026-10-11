import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegistroForm } from './registro-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Invented data only.
const CLAVE = 'clave-de-prueba-larga';

function llenar(valores: Partial<Record<'nombre-completo' | 'cedula' | 'correo' | 'celular' | 'clave' | 'confirmar-clave', string>> = {}) {
  const datos = {
    'nombre-completo': 'Prueba Smoke',
    cedula: '1000000000',
    correo: 'prueba@example.com',
    celular: '3001234567',
    clave: CLAVE,
    'confirmar-clave': CLAVE,
    ...valores,
  };
  for (const [id, valor] of Object.entries(datos)) {
    fireEvent.change(document.getElementById(id) as HTMLInputElement, { target: { value: valor } });
  }
}

describe('RegistroForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('sends the data with the consent and shows the generic success message', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ mensaje: 'Recibimos tu registro; la oficina lo activará.' }, 201),
    );
    render(<RegistroForm />);
    llenar();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Recibimos tu registro; la oficina lo activará.');
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/registro');
    expect(JSON.parse(String(init?.body))).toEqual({
      nombreCompleto: 'Prueba Smoke',
      cedula: '1000000000',
      correo: 'prueba@example.com',
      celular: '3001234567',
      clave: CLAVE,
      consentimiento: true,
    });
  });

  it('does not send anything without the consent checkbox', async () => {
    render(<RegistroForm />);
    llenar();
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Debes aceptar el tratamiento de tus datos');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('checks the celular and the clave before sending', async () => {
    render(<RegistroForm />);
    llenar({ celular: '2001234567' });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('empezar por 3');

    llenar({ celular: '3001234567', clave: 'corta', 'confirmar-clave': 'corta' });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('al menos 12 caracteres');

    llenar({ clave: CLAVE, 'confirmar-clave': 'otra-clave-larga' });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Las claves no coinciden.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the generic message from the server for a duplicate account', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: 'No podemos completar el registro con esos datos.' }, 409),
    );
    render(<RegistroForm />);
    llenar();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('No podemos completar el registro con esos datos.'),
    );
  });

  it('links back to the login page', () => {
    render(<RegistroForm />);
    expect(screen.getByRole('link', { name: 'Ya tengo cuenta' })).toHaveAttribute('href', '/login');
  });
});
