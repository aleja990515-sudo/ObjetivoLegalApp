import type { AutoPublicado, AutoPublicadoRepository } from '../domain/auto-publicado.repository.js';
import type { EstadoPublicado } from '../domain/autos.js';
import { FakePublicaciones } from '../testing/fake-publicaciones.js';
import { InMemoryProcesoRepository } from '../testing/in-memory-proceso.repository.js';
import { actuacion, proceso } from '../testing/proceso.fixtures.js';
import { AutosService, MAX_ESTADOS_REVISADOS } from './autos.service.js';

class MemoriaAutos implements AutoPublicadoRepository {
  readonly filas = new Map<string, AutoPublicado>();
  async buscar(idProceso: string, idActuacion: number) {
    return this.filas.get(`${idProceso}:${idActuacion}`) ?? null;
  }
  async guardar(auto: AutoPublicado) {
    this.filas.set(`${auto.idProceso}:${auto.idActuacion}`, auto);
    return true;
  }
}

const estado = (dia: string): EstadoPublicado => ({
  titulo: `Notificación por Estado No.1 de ${Number(dia.slice(8))} de septiembre de 2026`,
  tipo: 'Notificaciones por Estados',
  fechaPublicacion: dia,
  urlEstado: `https://portal.test/web/publicaciones-procesales/inicio?d=${dia}`,
});

describe('AutosService', () => {
  let portal: FakePublicaciones;
  let autos: MemoriaAutos;
  let servicio: AutosService;

  beforeEach(() => {
    portal = new FakePublicaciones();
    autos = new MemoriaAutos();
    const procesos = new InMemoryProcesoRepository([
      proceso('1', {
        radicado: '05001311001520260010000',
        actuaciones: [actuacion(11, { actuacion: 'Auto Decide', fecha: '2026-09-10T00:00:00' })],
      }),
    ]);
    servicio = new AutosService(procesos, autos, portal);
  });

  it('searches the portal once for concurrent requests of the same actuación', async () => {
    const [a, b] = await Promise.all([servicio.auto('1', 11), servicio.auto('1', 11)]);
    expect(a).toEqual(b);
    expect(portal.calls.filter((c) => c.startsWith('buscar:'))).toHaveLength(1);
  });

  it(`reads at most ${MAX_ESTADOS_REVISADOS} estado pages and then links the closest estado`, async () => {
    const dias = ['2026-09-11', '2026-09-14', '2026-09-15', '2026-09-10', '2026-09-16', '2026-09-17'];
    portal.estados.set('050013110015', dias.map(estado));
    const resultado = await servicio.auto('1', 11);
    expect(portal.calls.filter((c) => c.startsWith('archivos:'))).toHaveLength(MAX_ESTADOS_REVISADOS);
    // No fijación in CPNU: the next business day (2026-09-11) is the reference.
    expect(resultado).toMatchObject({ confianza: 'estado', urlEstado: estado('2026-09-11').urlEstado });
    expect(portal.calls[0]).toBe('buscar:050013110015:2026-09-10:2026-09-15');
  });
});
