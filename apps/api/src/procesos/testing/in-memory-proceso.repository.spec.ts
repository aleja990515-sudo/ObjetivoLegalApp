import { proceso } from './proceso.fixtures.js';
import { InMemoryProcesoRepository } from './in-memory-proceso.repository.js';

const UUID = '3f2a8c10-4d5e-4a6b-8c9d-0e1f2a3b4c5d';

describe('InMemoryProcesoRepository (contract with the TypeORM adapter)', () => {
  const caso = proceso('1', { usuarioId: UUID });
  const repo = new InMemoryProcesoRepository([caso]);

  it('scopes the refs to a uuid owner', async () => {
    expect(await repo.listRefs(UUID)).toEqual([{ id: caso.id, idProceso: '1', radicado: '11001310300120190012300' }]);
  });

  it('rejects a non-uuid owner instead of quietly returning nothing', async () => {
    // `procesos.usuario_id` is a uuid: Postgres answers 22P02, so a caller that relies
    // on an empty list here is broken and only fails against the real adapter.
    await expect(repo.listRefs('')).rejects.toThrow('invalid input syntax for type uuid: ""');
    await expect(repo.listRefs('u-ana')).rejects.toThrow('invalid input syntax for type uuid: "u-ana"');
  });
});
