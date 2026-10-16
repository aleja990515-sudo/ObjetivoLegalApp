// The calendar subscription is public, so its link is the only credential: it
// must unlock exactly the calendar of the user it was built for.
import { InMemoryProcesoRepository } from '../../procesos/testing/in-memory-proceso.repository.js';
import { proceso, tarea } from '../../procesos/testing/proceso.fixtures.js';
import { tokenAgenda } from '../domain/calendar-token.js';
import { AgendaService } from './agenda.service.js';

const SECRET = 'secreto-de-sesion-de-prueba-de-32-chars';
const ANA = { id: 'u-ana', nombre: 'Ana' };
const LUIS = { id: 'u-luis', nombre: 'Luis' };

describe('AgendaService (per-user calendar)', () => {
  let repo: InMemoryProcesoRepository;
  let service: AgendaService;

  beforeEach(() => {
    repo = new InMemoryProcesoRepository([
      proceso('1', {
        usuarioId: ANA.id,
        alias: 'Caso de Ana',
        tareas: [tarea('t-ana', { titulo: 'Audiencia de Ana', fecha: '2026-03-10', hora: '14:00' })],
      }),
      proceso('2', {
        usuarioId: LUIS.id,
        alias: 'Caso de Luis',
        tareas: [tarea('t-luis', { titulo: 'Audiencia de Luis', fecha: '2026-03-11', hora: '09:00' })],
      }),
    ]);
    service = new AgendaService(repo, SECRET);
  });

  it('answers the agenda and a per-user calendar link', async () => {
    const vista = await service.agenda(ANA, 'https://misprocesos.test');
    expect(vista.ics).toBe(`https://misprocesos.test/api/agenda.ics?t=${tokenAgenda(SECRET, ANA.id)}`);
    expect(vista.tareas.map((t) => t.titulo)).toEqual(['Audiencia de Ana']);
  });

  it('never serves another user tasks in the ICS link', async () => {
    const token = tokenAgenda(SECRET, ANA.id);
    expect(service.usuarioDelToken(token)).toBe(ANA.id);
    const ics = await service.calendario(ANA.id);
    expect(ics).toContain('UID:t-ana@misprocesos');
    expect(ics).not.toContain('UID:t-luis@misprocesos');
    expect(ics).not.toContain('Caso de Luis');
  });

  it.each([
    ['a token of another user with a forged signature', 'u-luis.' + 'f'.repeat(32)],
    ['a tampered signature', `u-ana.${'0'.repeat(32)}`],
    ['the retired global token', 'a'.repeat(32)],
    ['an empty token', ''],
    ['a non-string token', undefined],
  ])('rejects %s', async (_, token) => {
    expect(service.usuarioDelToken(token)).toBeNull();
  });

  it('reads nothing for an unverified link', async () => {
    const espia = vi.spyOn(repo, 'findAll');
    expect(service.usuarioDelToken('u-ana.deadbeef')).toBeNull();
    expect(espia).not.toHaveBeenCalled();
  });

  it('derives the link from SESSION_SECRET, so a rotated secret invalidates it', () => {
    const otro = new AgendaService(repo, 'otro-secreto-de-sesion-de-32-chars');
    expect(otro.usuarioDelToken(tokenAgenda(SECRET, ANA.id))).toBeNull();
    expect(otro.usuarioDelToken(tokenAgenda('otro-secreto-de-sesion-de-32-chars', ANA.id))).toBe(ANA.id);
  });
});