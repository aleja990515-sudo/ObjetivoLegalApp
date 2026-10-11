import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VistaDetalle } from './vista-detalle';
import type { ProcesoDetalle } from '@/features/procesos/modelo';

vi.mock('next/navigation', () => ({
  usePathname: () => '/procesos/1',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}));

function detalle(parcial: Partial<ProcesoDetalle> = {}): ProcesoDetalle {
  return {
    idProceso: '1',
    radicado: '11001310300120240001200',
    alias: 'Pérez vs. Aseguradora',
    despacho: 'Juzgado 3 Civil',
    claseProceso: 'Ordinario',
    ultimaActuacion: null,
    ultimoAuto: null,
    noVistas: 0,
    nuevaInstancia: false,
    proximaTarea: null,
    tareasVencidas: 0,
    responsable: "Ana",
    etiquetas: ['urgente'],
    ultimaConsulta: null,
    agregadoPor: 'Ana',
    error: null,
    detalle: { despacho: 'Juzgado 3 Civil', ponente: 'Dra. Lina' },
    sujetos: [],
    actuaciones: [],
    noVistasIds: [],
    notas: [],
    tareas: [
      {
        id: 't1',
        titulo: 'Contestar demanda',
        fecha: '2026-10-20',
        hora: '',
        responsable: 'Ana',
        idActuacion: null,
        hecha: false,
        hechaPor: null,
        autor: 'Ana',
        creada: '2026-10-01T10:00:00.000Z',
      },
    ],
    ...parcial,
  } as ProcesoDetalle;
}

interface Llamada {
  metodo: string;
  url: string;
  cuerpo: unknown;
}

/** Responde `GET /api/procesos/1` con `proceso` y las mutaciones con `respuestas`; registra cada llamada. */
function stubDetalle(proceso: ProcesoDetalle, respuestas: Record<string, unknown> = {}) {
  const llamadas: Llamada[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const metodo = init?.method ?? 'GET';
      llamadas.push({ metodo, url, cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined });
      const cuerpo = metodo === 'GET' ? proceso : (respuestas[`${metodo} ${url}`] ?? proceso);
      return new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }),
  );
  return llamadas;
}

describe('VistaDetalle', () => {
  it('alterna una tarea con PATCH y refleja el cambio en la lista de tareas', async () => {
    const hecha = detalle({
      tareas: [{ ...detalle().tareas[0], hecha: true, hechaPor: 'Ana' }],
    });
    const llamadas = stubDetalle(detalle(), { 'PATCH /api/procesos/1/tareas/t1': hecha });
    render(<VistaDetalle id="1" />);

    const casilla = await screen.findByRole('checkbox', { name: 'Marcar como realizada: Contestar demanda' });
    expect(casilla).not.toBeChecked();

    fireEvent.click(casilla);

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Marcar como realizada: Contestar demanda' })).toBeChecked());
    const patch = llamadas.find((l) => l.metodo === 'PATCH');
    expect(patch?.url).toBe('/api/procesos/1/tareas/t1');
    expect(patch?.cuerpo).toEqual({ hecha: true });
  });

  it('pide confirmación antes de quitar el proceso y no llama a la API si se cancela', async () => {
    const llamadas = stubDetalle(detalle());
    render(<VistaDetalle id="1" />);
    await screen.findByRole('heading', { name: 'Pérez vs. Aseguradora' });

    fireEvent.click(screen.getByRole('button', { name: 'Quitar de la lista' }));

    const dialogo = await screen.findByRole('alertdialog');
    expect(dialogo).toHaveTextContent('¿Quitar este proceso de la lista de la oficina?');

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(llamadas.some((l) => l.metodo === 'DELETE')).toBe(false);
  });
});
