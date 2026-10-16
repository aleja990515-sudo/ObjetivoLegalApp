import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VistaNovedades } from './vista-novedades';
import type { Novedad } from '@/features/procesos/modelo';

vi.mock('next/navigation', () => ({
  usePathname: () => '/novedades',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const novedades: Novedad[] = [
  {
    tipo: 'instancia',
    idProceso: '7',
    radicado: '11001310300120240001200',
    alias: 'Gómez laboral',
    despacho: 'Tribunal Superior',
    fecha: '2026-10-08T12:00:00.000Z',
  },
  {
    tipo: 'actuacion',
    idProceso: '1',
    radicado: '05001310500220240099900',
    alias: 'Pérez vs. Aseguradora',
    despacho: 'Juzgado 3 Civil',
    fecha: '2026-10-09',
    actuacion: {
      id: 55,
      cons: 1,
      fecha: '2026-10-09',
      actuacion: 'Auto admite demanda',
      anotacion: 'Se admite la demanda ordinaria.',
      fechaInicial: null,
      fechaFinal: null,
      fechaRegistro: '2026-10-09',
      conDocumentos: true,
    },
  },
];

function stubNovedades(cuerpo: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })),
  );
}

describe('VistaNovedades', () => {
  it('lista cada novedad con enlace a su proceso y su tipo', async () => {
    stubNovedades(novedades);
    render(<VistaNovedades />);

    const instancia = await screen.findByRole('link', { name: /Gómez laboral/ });
    expect(instancia).toHaveAttribute('href', '/procesos/7');
    expect(instancia.closest('li')).toHaveTextContent('Nueva instancia');

    const auto = screen.getByRole('link', { name: /Pérez vs. Aseguradora/ });
    expect(auto).toHaveAttribute('href', '/procesos/1');
    expect(auto.closest('li')).toHaveTextContent('Auto / providencia');
    expect(auto.closest('li')).toHaveTextContent('Auto admite demanda');
  });

  it('muestra un estado vacío cuando no hay novedades pendientes', async () => {
    stubNovedades([]);
    render(<VistaNovedades />);

    expect(await screen.findByText('No hay novedades pendientes')).toBeInTheDocument();
  });

  it('muestra una novedad de tipo estado con su número y enlace', async () => {
    stubNovedades([
      {
        tipo: 'estado',
        idProceso: '3',
        radicado: '05001311000320260030200',
        alias: 'Reservado',
        despacho: 'Juzgado 3 Familia',
        fecha: '2026-10-14',
        estado: { procesoId: 'u3', urlEstado: 'https://portal/e/174', numeroEstado: '174', fechaPublicacion: '2026-10-14', radicadoEncontrado: '05001311000320260030200', visto: false, detectadoEn: '2026-10-15T10:00:00.000Z' },
      },
    ] satisfies Novedad[]);
    render(<VistaNovedades />);

    const enlace = await screen.findByRole('link', { name: /Reservado/ });
    expect(enlace).toHaveAttribute('href', '/procesos/3');
    expect(enlace.closest('li')).toHaveTextContent('Estado');
    expect(enlace.closest('li')).toHaveTextContent('Estado No. 174');
  });
});
