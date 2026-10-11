import { agendaFixture, AHORA } from '../testing/agenda.fixtures.js';
import { legacyGenerarIcs } from '../testing/legacy-ics.fixture.js';
import { generarIcs } from './ics.js';
import { proceso, tarea } from '../../procesos/testing/proceso.fixtures.js';

describe('generarIcs (legacy ICS output)', () => {
  // The frozen legacy copy reads the clock itself, so only Date is faked.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AHORA.epochMilliseconds);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('matches the legacy output byte-for-byte for the same data', () => {
    expect(generarIcs(agendaFixture(), AHORA)).toBe(legacyGenerarIcs(agendaFixture()));
  });

  it('uses CRLF line endings and no trailing line break', () => {
    const out = generarIcs(agendaFixture(), AHORA);
    expect(out.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(out.endsWith('\r\nEND:VCALENDAR')).toBe(true);
    expect(out).not.toMatch(/(^|[^\r])\n/);
  });

  it('writes timed tasks in UTC from Colombia time (UTC-5) and untimed tasks as DATE values', () => {
    const out = generarIcs(agendaFixture(), AHORA);
    expect(out).toContain('DTSTAMP:20261010T120000Z');
    expect(out).toContain('DTSTART:20261012T140000Z\r\nDTEND:20261012T150000Z');
    expect(out).toContain('DTSTART;VALUE=DATE:20261015\r\nDTEND;VALUE=DATE:20261016');
    expect(out).toContain('DTSTART:20270101T043000Z\r\nDTEND:20270101T053000Z');
    expect(out).toContain('DTSTART;VALUE=DATE:20270102\r\nDTEND;VALUE=DATE:20270103');
  });

  it('skips done tasks and dates that are not YYYY-MM-DD', () => {
    const out = generarIcs(agendaFixture(), AHORA);
    expect(out).not.toContain('UID:a1b2c5@misprocesos');
    expect(out).not.toContain('UID:a1b2c6@misprocesos');
    expect(out.match(/BEGIN:VEVENT/g)).toHaveLength(4);
  });

  it('escapes backslashes, commas, semicolons and newlines in SUMMARY and DESCRIPTION', () => {
    const out = generarIcs(agendaFixture(), AHORA);
    expect(out).toContain('SUMMARY:Contestar demanda – Caso Pérez\\; Ruiz\\, S.A.');
    expect(out).toContain('SUMMARY:Audiencia\\nfinal\\, 2ª parte – Caso Pérez\\; Ruiz\\, S.A.');
    expect(out).toContain('DESCRIPTION:Radicado 11001310300120190012300\\nJUZGADO 001 CIVIL\\nResponsable: Luz');
  });

  it('falls back to the radicado and the search court name, with the VALARM block', () => {
    const out = generarIcs(agendaFixture(), AHORA);
    expect(out).toContain('SUMMARY:Término: traslado – 11001310300120190099999');
    expect(out).toContain('DESCRIPTION:Radicado 11001310300120190099999\\nJUZGADO 002\r\n');
    expect(out).toContain('BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Recordatorio\r\nTRIGGER:-P1D\r\nEND:VALARM');
  });

  it('matches the legacy output for day rollover (2026-02-30), 24:00 and year-end all-day tasks', () => {
    const borde = [
      proceso('7', {
        radicado: '11001310300120190000007',
        tareas: [
          tarea('b1', { titulo: 'Rollover', fecha: '2026-02-30', hora: '23:30' }),
          tarea('b2', { titulo: 'Medianoche', fecha: '2026-11-01', hora: '24:00' }),
          tarea('b3', { titulo: 'Abril', fecha: '2026-04-31' }),
        ],
      }),
    ];
    expect(generarIcs(borde, AHORA)).toBe(legacyGenerarIcs(borde));
  });

  it('keeps the legacy behaviour of not folding lines longer than 75 octets (known gap, preserved)', () => {
    const largo = [proceso('9', { radicado: '11001310300120190000001', tareas: [tarea('z1', { titulo: 'x'.repeat(120), fecha: '2026-10-12' })] })];
    const out = generarIcs(largo, AHORA);
    expect(out.split('\r\n').some((linea) => linea.startsWith('SUMMARY:') && linea.length > 75)).toBe(true);
    expect(out).toBe(legacyGenerarIcs(largo));
  });
});
