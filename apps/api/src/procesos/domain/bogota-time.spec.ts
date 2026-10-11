import { fechaBogota } from './bogota-time.js';

describe('fechaBogota', () => {
  it('uses UTC-5 all year (Colombia has no DST)', () => {
    expect(fechaBogota(new Date('2026-10-10T04:59:59Z'))).toBe('2026-10-09');
    expect(fechaBogota(new Date('2026-10-10T05:00:00Z'))).toBe('2026-10-10');
  });
});
