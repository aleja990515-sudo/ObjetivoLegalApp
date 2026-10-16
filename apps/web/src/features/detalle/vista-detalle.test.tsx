import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VistaDetalle } from './vista-detalle';
import type { ProcesoDetalle } from '@/features/procesos/modelo';

const { empujar } = vi.hoisted(() => ({ empujar: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/procesos/1',
  useRouter: () => ({ replace: vi.fn(), push: empujar, back: vi.fn() }),
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
    esPrivado: false,
    estadosNoVistos: 0,
    estados: [],
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

  it('alterna la tarea al tocar la fila, no solo la casilla', async () => {
    const hecha = detalle({
      tareas: [{ ...detalle().tareas[0], hecha: true, hechaPor: 'Ana' }],
    });
    const llamadas = stubDetalle(detalle(), { 'PATCH /api/procesos/1/tareas/t1': hecha });
    render(<VistaDetalle id="1" />);
    await screen.findByRole('checkbox', { name: 'Marcar como realizada: Contestar demanda' });

    // La fila es etiqueta implicita de la casilla: el texto debe invertirla.
    fireEvent.click(screen.getByText('Contestar demanda'));

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Marcar como realizada: Contestar demanda' })).toBeChecked());
    expect(llamadas.find((l) => l.metodo === 'PATCH')?.url).toBe('/api/procesos/1/tareas/t1');
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

  it('al confirmar, quita el proceso con DELETE y vuelve a la lista', async () => {
    const llamadas = stubDetalle(detalle(), { 'DELETE /api/procesos/1': { ok: true } });
    render(<VistaDetalle id="1" />);
    await screen.findByRole('heading', { name: 'Pérez vs. Aseguradora' });

    fireEvent.click(screen.getByRole('button', { name: 'Quitar de la lista' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Quitar proceso' }));

    await waitFor(() => expect(empujar).toHaveBeenCalledWith('/'));
    expect(llamadas.find((l) => l.metodo === 'DELETE')?.url).toBe('/api/procesos/1');
  });

  it('lista los estados detectados y los marca como revisados con /visto', async () => {
    const conEstados = detalle({
      estadosNoVistos: 1,
      estados: [
        { procesoId: 'u1', urlEstado: 'https://portal/e/174', numeroEstado: '174', fechaPublicacion: '2026-10-14', radicadoEncontrado: '05001311000320260030200', visto: false, detectadoEn: '2026-10-15T10:00:00.000Z' },
        { procesoId: 'u1', urlEstado: 'https://portal/e/170', numeroEstado: '170', fechaPublicacion: '2026-10-09', radicadoEncontrado: '05001311000320260030200', visto: true, detectadoEn: '2026-10-10T10:00:00.000Z' },
      ],
    });
    const llamadas = stubDetalle(conEstados, { 'POST /api/procesos/1/visto': conEstados });
    render(<VistaDetalle id="1" />);

    expect(await screen.findByRole('heading', { name: 'Estados donde aparece' })).toBeInTheDocument();
    const enlaces = screen.getAllByRole('link', { name: /Estado No\./ });
    expect(enlaces.map((e) => e.getAttribute('href'))).toEqual(['https://portal/e/174', 'https://portal/e/170']);
    expect(screen.getByText('Nuevo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Marcar como revisado' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST' && l.url === '/api/procesos/1/visto')).toBe(true));
  });

  it('en un proceso privado avisa que se vigilan los estados y oculta sujetos y actuaciones', async () => {
    stubDetalle(detalle({ esPrivado: true, sujetos: [], actuaciones: [] }));
    render(<VistaDetalle id="1" />);

    expect(await screen.findByText(/privado en la Rama Judicial/i)).toBeInTheDocument();
    expect(screen.getByText('Aún no aparece en ningún estado.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sujetos procesales' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Actuaciones/ })).not.toBeInTheDocument();
  });
});
