import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VistaLista } from './vista-lista';
import type { ProcesoResumen } from './modelo';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

function proceso(parcial: Partial<ProcesoResumen> & Pick<ProcesoResumen, 'idProceso' | 'alias'>): ProcesoResumen {
  return {
    radicado: '11001310300120240001200',
    despacho: 'Juzgado 3 Civil',
    claseProceso: null,
    sujetos: null,
    ultimaActuacion: null,
    ultimoAuto: null,
    noVistas: 0,
    esPrivado: false,
    estadosNoVistos: 0,
    nuevaInstancia: false,
    proximaTarea: null,
    tareasVencidas: 0,
    responsable: '',
    etiquetas: [],
    ultimaConsulta: null,
    agregadoPor: 'Ana',
    error: null,
    ...parcial,
  };
}

const procesosBase = [
  proceso({ idProceso: '1', alias: 'Pérez vs. Aseguradora' }),
  proceso({ idProceso: '2', alias: 'Gómez laboral', noVistas: 2 }),
];

/** Responde a `fetch('/api/...')` según el método y la ruta; registra las llamadas. */
function stubApi(respuestas: Record<string, { status?: number; body: unknown }>) {
  const llamadas: { url: string; metodo: string }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const metodo = init?.method ?? 'GET';
      llamadas.push({ url, metodo });
      const respuesta = respuestas[`${metodo} ${url}`] ?? respuestas[url];
      if (!respuesta) return new Response(JSON.stringify({ error: 'sin ruta' }), { status: 500 });
      return new Response(JSON.stringify(respuesta.body), {
        status: respuesta.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return llamadas;
}

describe('VistaLista', () => {
  it('filtra por texto y por "Solo con novedades"', async () => {
    stubApi({ '/api/procesos': { body: { procesos: procesosBase, ultimaRevision: null } } });
    render(<VistaLista />);

    expect(await screen.findByRole('link', { name: /Pérez vs. Aseguradora/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Gómez laboral/ })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar' }), { target: { value: 'pérez' } });
    expect(screen.queryByRole('link', { name: /Gómez laboral/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pérez vs. Aseguradora/ })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Solo con novedades' }));
    expect(screen.queryByRole('link', { name: /Pérez vs. Aseguradora/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Gómez laboral/ })).toBeInTheDocument();
  });

  it('muestra el mensaje de la API cuando el proceso ya está en la lista (409)', async () => {
    stubApi({
      '/api/procesos': { body: { procesos: procesosBase, ultimaRevision: null } },
      'POST /api/procesos': { status: 409, body: { error: 'Ese proceso ya está en la lista.' } },
    });
    render(<VistaLista />);
    await screen.findByRole('link', { name: /Pérez vs. Aseguradora/ });

    fireEvent.change(screen.getByLabelText(/Radicado/), { target: { value: '11001310300120240001200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ese proceso ya está en la lista.');
  });

  it('valida que el radicado tenga 23 dígitos antes de llamar a la API', async () => {
    const llamadas = stubApi({ '/api/procesos': { body: { procesos: procesosBase, ultimaRevision: null } } });
    render(<VistaLista />);
    await screen.findByRole('link', { name: /Pérez vs. Aseguradora/ });

    fireEvent.change(screen.getByLabelText(/Radicado/), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El radicado debe tener 23 dígitos.');
    expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);
  });

  it('muestra un estado vacío que explica cómo agregar el primer proceso', async () => {
    stubApi({ '/api/procesos': { body: { procesos: [], ultimaRevision: null } } });
    render(<VistaLista />);

    expect(await screen.findByText('Aún no hay procesos')).toBeInTheDocument();
    expect(screen.getByText(/Escribe arriba el radicado de 23 dígitos/)).toBeInTheDocument();
  });

  it('muestra los encabezados de columna del listado en escritorio', async () => {
    stubApi({ '/api/procesos': { body: { procesos: procesosBase, ultimaRevision: null } } });
    render(<VistaLista />);
    await screen.findByRole('link', { name: /Pérez vs. Aseguradora/ });

    for (const columna of ['Proceso', 'Despacho', 'Última actuación', 'Estado']) {
      expect(screen.getByRole('columnheader', { name: columna })).toBeInTheDocument();
    }
  });

  it('muestra los estados sin ver de un proceso privado y lo cuenta como novedad', async () => {
    const privado = proceso({ idProceso: '3', alias: 'Reservado', esPrivado: true, estadosNoVistos: 2 });
    stubApi({ '/api/procesos': { body: { procesos: [privado], ultimaRevision: null } } });
    render(<VistaLista />);

    expect(await screen.findByText('2 estado(s) nuevo(s)')).toBeInTheDocument();
    expect(screen.getByText('Privado en la Rama, vigilado por estados')).toBeInTheDocument();
    expect(screen.queryByText('Al día')).not.toBeInTheDocument();
  });
});
