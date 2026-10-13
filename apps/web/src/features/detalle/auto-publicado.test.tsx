import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import type { Actuacion, AutoPublicado, ProcesoDetalle } from '@/features/procesos/modelo';
import { Actuaciones } from './actuaciones';
import { ResultadoAutoPublicado } from './auto-publicado';

const PDF = 'https://publicacionesprocesales.ramajudicial.gov.co/c/document_library/get_file?uuid=1&groupId=2';
const ESTADO = 'https://publicacionesprocesales.ramajudicial.gov.co/web/publicaciones-procesales/inicio?articleId=3';

function auto(parcial: Partial<AutoPublicado> = {}): AutoPublicado {
  return {
    confianza: 'exacto',
    urlPdf: PDF,
    nombreArchivo: '031202600100Concede.pdf',
    urlEstado: ESTADO,
    numeroEstado: '132',
    fechaPublicacion: '2026-09-15',
    ...parcial,
  };
}

function actuacion(id: number, nombre: string): Actuacion {
  return {
    id,
    cons: id,
    fecha: '2026-09-14T00:00:00',
    actuacion: nombre,
    anotacion: null,
    fechaInicial: null,
    fechaFinal: null,
    fechaRegistro: '2026-09-14T00:00:00',
    conDocumentos: false,
  } as Actuacion;
}

const proceso = {
  idProceso: '7',
  radicado: '11001310300120240001200',
  noVistasIds: [],
  actuaciones: [actuacion(11, 'Auto Concede'), actuacion(12, 'Fijación Estado')],
} as unknown as ProcesoDetalle;

function enlaces() {
  return screen.getAllByRole('link').map((a) => ({
    texto: a.textContent,
    href: a.getAttribute('href'),
    target: a.getAttribute('target'),
    rel: a.getAttribute('rel'),
  }));
}

describe('ResultadoAutoPublicado', () => {
  it('muestra el PDF exacto en una pestaña nueva', () => {
    render(<ResultadoAutoPublicado auto={auto()} />);
    expect(enlaces()).toEqual([{ texto: 'PDF exacto', href: PDF, target: '_blank', rel: 'noopener noreferrer' }]);
    expect(screen.getByText(/031202600100Concede\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/Estado No\. 132, publicado/)).toBeInTheDocument();
  });

  it('pide revisar el PDF del día y enlaza también el estado', () => {
    render(<ResultadoAutoPublicado auto={auto({ confianza: 'del_dia', nombreArchivo: 'AUTOS20260611.pdf' })} />);
    expect(enlaces()).toEqual([
      { texto: 'PDF del día, revisar', href: PDF, target: '_blank', rel: 'noopener noreferrer' },
      { texto: 'Ver estado', href: ESTADO, target: '_blank', rel: 'noopener noreferrer' },
    ]);
    expect(screen.getByText(/Busca el radicado dentro del documento/)).toBeInTheDocument();
  });

  it('enlaza el estado cuando no se identificó el PDF', () => {
    render(<ResultadoAutoPublicado auto={auto({ confianza: 'estado', urlPdf: null, nombreArchivo: null })} />);
    expect(enlaces()).toEqual([{ texto: 'Ver estado', href: ESTADO, target: '_blank', rel: 'noopener noreferrer' }]);
  });

  it('dice "No encontrado" sin enlaces cuando no hay publicaciones', () => {
    render(
      <ResultadoAutoPublicado
        auto={{ confianza: 'sin_resultado', urlPdf: null, nombreArchivo: null, urlEstado: null, numeroEstado: null, fechaPublicacion: null }}
      />,
    );
    expect(screen.queryAllByRole('link')).toEqual([]);
    expect(screen.getByText('No encontrado')).toBeInTheDocument();
  });

  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = render(<ResultadoAutoPublicado auto={auto({ confianza: 'del_dia' })} />);
    const resultado = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(resultado.violations).toEqual([]);
  });
});

describe('Ver auto en las actuaciones', () => {
  function stubFetch(respuesta: () => Promise<Response>) {
    const llamadas: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        llamadas.push(url);
        return respuesta();
      }),
    );
    return llamadas;
  }

  const renderizar = () => render(<Actuaciones proceso={proceso} onAgendar={vi.fn()} onAviso={vi.fn()} />);

  it('solo se ofrece en providencias', () => {
    renderizar();
    expect(screen.getAllByRole('button', { name: 'Ver auto' })).toHaveLength(1);
  });

  it('busca el auto, muestra el estado de carga y luego el resultado', async () => {
    let responder: (r: Response) => void = () => undefined;
    const llamadas = stubFetch(() => new Promise<Response>((r) => (responder = r)));
    renderizar();

    fireEvent.click(screen.getByRole('button', { name: 'Ver auto' }));
    const cargando = await screen.findByRole('button', { name: 'Buscando auto…' });
    expect(cargando).toBeDisabled();
    expect(cargando).toHaveAttribute('aria-busy', 'true');
    expect(llamadas).toEqual(['/api/procesos/7/actuaciones/11/auto']);

    responder(new Response(JSON.stringify(auto()), { status: 200 }));
    const grupo = await screen.findByRole('group', { name: 'Auto en Publicaciones Procesales' });
    expect(within(grupo).getByRole('link', { name: 'PDF exacto' })).toHaveAttribute('href', PDF);
    expect(screen.getByRole('button', { name: 'Ver auto' })).toBeDisabled();
  });

  it('muestra el error del servidor y permite reintentar', async () => {
    let fallar = true;
    stubFetch(async () =>
      fallar
        ? new Response(JSON.stringify({ error: 'Publicaciones Procesales no está disponible en este momento. Intenta más tarde.' }), {
            status: 503,
          })
        : new Response(JSON.stringify(auto({ confianza: 'estado', urlPdf: null })), { status: 200 }),
    );
    renderizar();

    fireEvent.click(screen.getByRole('button', { name: 'Ver auto' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Publicaciones Procesales no está disponible');

    fallar = false;
    fireEvent.click(screen.getByRole('button', { name: 'Ver auto' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Ver estado' })).toHaveAttribute('href', ESTADO));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
