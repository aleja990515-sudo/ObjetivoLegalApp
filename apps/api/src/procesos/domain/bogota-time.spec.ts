import { fechaBogota } from './bogota-time.js';

describe('fechaBogota', () => {
  it('uses UTC-5 all year (Colombia has no DST)', () => {
    expect(fechaBogota(Temporal.Instant.from('2026-10-10T04:59:59Z'))).toBe('2026-10-09');
    expect(fechaBogota(Temporal.Instant.from('2026-10-10T05:00:00Z'))).toBe('2026-10-10');
  });

  it('maps 00:30 UTC on day D to day D-1 in Bogotá', () => {
    expect(fechaBogota(Temporal.Instant.from('2026-01-01T00:30:00Z'))).toBe('2025-12-31');
  });
});
