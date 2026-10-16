import { claveCaso } from './radicado.js';

describe('claveCaso', () => {
  it('drops the last two digits of the radicado', () => {
    expect(claveCaso('05001311000320260066200')).toBe('050013110003202600662');
  });

  it('keeps the same key when a recurso moves the case to the superior court', () => {
    // Acuerdo 201/1997 + 1463/2002: the last two digits are the consecutivo de
    // recursos (00 first instance, 01/02/03 later instances).
    expect(claveCaso('05001311000320260066201')).toBe(claveCaso('05001311000320260066200'));
    expect(claveCaso('05001311000320260066202')).toBe(claveCaso('05001311000320260066200'));
  });

  it('separates different cases of the same year', () => {
    expect(claveCaso('05001311000320260066200')).not.toBe(claveCaso('05001311000320260066300'));
  });

  it('returns anything that is not a 23-digit radicado untouched', () => {
    expect(claveCaso('')).toBe('');
    expect(claveCaso('050013110003202600662')).toBe('050013110003202600662');
  });
});
