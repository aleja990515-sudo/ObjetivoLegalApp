import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VistaAgenda } from './vista-agenda';
import type { RespuestaAgenda, TareaAgenda } from '@/features/procesos/modelo';

vi.mock('next/navigation', () => ({
  usePathname: () => '/agenda',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

function tarea(parcial: Partial<TareaAgenda> & Pick<TareaAgenda, 'id' | 'titulo' | 'fecha'>): TareaAgenda {
  return {
    hora: '',
    responsable: 'Ana',
    idActuacion: null,
    hecha: false,
    hechaPor: null,
    autor: 'Ana',
    creada: '2026-10-01T10:00:00.000Z',
    idProceso: '1',
    radicado: '11001310300120240001200',
    alias: 'Pérez vs. Aseguradora',
    despacho: 'Juzgado 3 Civil',
    ...parcial,
  };
}

const agenda: RespuestaAgenda = {
  hoy: '2026-10-10',
  ics: 'https://app.test/api/agenda.ics?t=abc',
  tareas: [
    tarea({ id: 'a', titulo: 'Contestar demanda', fecha: '2026-10-09' }),
    tarea({ id: 'b', titulo: 'Audiencia inicial', fecha: '2026-10-10', hora: '09:00' }),
    tarea({ id: 'c', titulo: 'Memorial radicado', fecha: '2026-10-01', hecha: true, hechaPor: 'Ana' }),
  ],
};

function stubAgenda(cuerpo: RespuestaAgenda) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })),
  );
}

describe('VistaAgenda', () => {
  it('agrupa las pendientes en vencidas y hoy, y oculta las realizadas hasta activar "Ver realizadas"', async () => {
    stubAgenda(agenda);
    render(<VistaAgenda />);

    expect(await screen.findByRole('heading', { name: 'Vencidas (1)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hoy (1)' })).toBeInTheDocument();
    expect(screen.queryByText('Memorial radicado')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Ver realizadas' }));

    expect(screen.getByText('Memorial radicado')).toBeInTheDocument();
  });

  it('ofrece la suscripción al calendario por webcal, Google y copiando el enlace', async () => {
    stubAgenda(agenda);
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<VistaAgenda />);
    await screen.findByRole('heading', { name: 'Vencidas (1)' });

    const webcal = 'webcal://app.test/api/agenda.ics?t=abc';
    expect(screen.getByRole('link', { name: 'Agregar a Outlook / iPhone' })).toHaveAttribute('href', webcal);
    expect(screen.getByRole('link', { name: 'Agregar a Google Calendar' })).toHaveAttribute(
      'href',
      `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }));

    expect(writeText).toHaveBeenCalledWith(agenda.ics);
    expect(await screen.findByRole('status')).toHaveTextContent('Enlace copiado.');
  });
});
