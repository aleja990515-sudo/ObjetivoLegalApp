import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './login-form';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
}));

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('LoginForm', () => {
  beforeEach(() => {
    replace.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('muestra el mensaje de error que devuelve el servidor', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: 'Correo o clave incorrectos.' }, 401));

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@example.com' } });
    fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'mal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o clave incorrectos.');
    expect(replace).not.toHaveBeenCalled();
  });

  it('envia correo y clave a /api/login y va al inicio con exito', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ nombre: 'Ana' }, 200));

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@example.com' } });
    fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'secreta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/login');
    expect(JSON.parse(String(init?.body))).toEqual({ correo: 'ana@example.com', clave: 'secreta' });
  });
});
