import { describe, expect, it } from 'vitest';
import { fecha } from '@/features/procesos/formato';
import { textoCompartir } from './texto-compartir';
import type { Actuacion, ProcesoDetalle } from '@/features/procesos/modelo';

const actuacion: Actuacion = {
  id: 9,
  cons: 1,
  fecha: '2026-10-09',
  actuacion: 'Auto admite demanda',
  anotacion: 'Se admite la demanda.',
  fechaInicial: '2026-10-09',
  fechaFinal: '2026-10-20',
  fechaRegistro: '2026-10-09',
  conDocumentos: true,
};

const proceso = { alias: 'Pérez vs. Aseguradora', radicado: '11001310300120240001200', detalle: { despacho: 'Juzgado 3 Civil' } } as unknown as ProcesoDetalle;

describe('textoCompartir', () => {
  it('arma el texto para compartir con alias, radicado, despacho, actuación y término', () => {
    expect(textoCompartir(actuacion, proceso)).toBe(
      [
        '*Pérez vs. Aseguradora*',
        'Radicado 11001-31-03-001-2024-00012-00',
        'Juzgado 3 Civil',
        `${fecha('2026-10-09')}: Auto admite demanda`,
        'Se admite la demanda.',
        `Término: ${fecha('2026-10-09')} a ${fecha('2026-10-20')}`,
      ].join('\n'),
    );
  });
});
