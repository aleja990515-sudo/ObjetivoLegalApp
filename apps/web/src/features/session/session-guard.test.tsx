import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionGuard } from './session-guard';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/',
}));

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('SessionGuard', () => {
  beforeEach(() => {
    replace.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('redirige a /login cuando /api/yo responde 401', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: 'Sin sesión' }, 401));

    render(
      <SessionGuard>
        <p>Contenido protegido</p>
      </SessionGuard>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument();
  });

  it('muestra el contenido cuando hay sesión', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ nombre: 'Ana' }, 200));

    render(
      <SessionGuard>
        <p>Contenido protegido</p>
      </SessionGuard>,
    );

    expect(await screen.findByText('Contenido protegido')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
