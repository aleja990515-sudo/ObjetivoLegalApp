import { ahoraIso, epochMsAhora, fechaCalendario, isoMs } from './temporal.js';

describe('isoMs (wire format of Date#toISOString)', () => {
  it('keeps the three millisecond digits for an exact-second instant', () => {
    expect(isoMs(Temporal.Instant.from('2026-10-10T12:00:00Z'))).toBe('2026-10-10T12:00:00.000Z');
  });

  it('prints the milliseconds of a fractional instant', () => {
    expect(isoMs(Temporal.Instant.from('2026-10-10T12:00:00.123Z'))).toBe('2026-10-10T12:00:00.123Z');
  });

  it('pads sub-second values to exactly three digits', () => {
    expect(isoMs(Temporal.Instant.from('2026-10-10T12:00:00.5Z'))).toBe('2026-10-10T12:00:00.500Z');
  });

  it('ahoraIso is always YYYY-MM-DDTHH:mm:ss.sssZ', () => {
    expect(ahoraIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe('epochMsAhora', () => {
  it('returns integer epoch milliseconds of the current clock', () => {
    const antes = Temporal.Now.instant().epochMilliseconds;
    const ahora = epochMsAhora();
    expect(Number.isInteger(ahora)).toBe(true);
    expect(ahora).toBeGreaterThanOrEqual(antes);
  });
});

describe('fechaCalendario (legacy Date parsing of YYYY-MM-DD)', () => {
  it('rolls days past the end of the month over, as the legacy parser did', () => {
    expect(fechaCalendario('2026-02-30').toString()).toBe('2026-03-02');
    expect(fechaCalendario('2026-02-29').toString()).toBe('2026-03-01');
    expect(fechaCalendario('2026-04-31').toString()).toBe('2026-05-01');
  });

  it('keeps valid dates unchanged', () => {
    expect(fechaCalendario('2024-02-29').toString()).toBe('2024-02-29');
    expect(fechaCalendario('2026-12-31').toString()).toBe('2026-12-31');
  });

  it('rejects months outside 1-12 and days outside 1-31 with a RangeError', () => {
    expect(() => fechaCalendario('2026-13-01')).toThrow(RangeError);
    expect(() => fechaCalendario('2026-00-10')).toThrow(RangeError);
    expect(() => fechaCalendario('2026-10-00')).toThrow(RangeError);
    expect(() => fechaCalendario('2026-10-32')).toThrow(RangeError);
  });
});
