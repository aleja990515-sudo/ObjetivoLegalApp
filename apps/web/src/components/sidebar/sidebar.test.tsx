import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from './sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/novedades',
  useRouter: () => ({ replace: vi.fn() }),
}));

describe('Sidebar', () => {
  it('muestra los tres enlaces y marca la ruta activa con aria-current', () => {
    render(
      <Sidebar
        nombre="Ana"
        conteos={{ novedades: 3, noVistas: 5 }}
        revisando={false}
        onRevisar={() => {}}
        onSalir={() => {}}
      />,
    );

    const procesos = screen.getByRole('link', { name: /^Procesos/ });
    const novedades = screen.getByRole('link', { name: /^Novedades/ });
    const agenda = screen.getByRole('link', { name: /^Agenda/ });

    expect(procesos).toHaveAttribute('href', '/');
    expect(novedades).toHaveAttribute('href', '/novedades');
    expect(agenda).toHaveAttribute('href', '/agenda');

    expect(novedades).toHaveAttribute('aria-current', 'page');
    expect(procesos).not.toHaveAttribute('aria-current');
    expect(agenda).not.toHaveAttribute('aria-current');
  });
});
