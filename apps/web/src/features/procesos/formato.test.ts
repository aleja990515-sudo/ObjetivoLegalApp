import { describe, expect, it } from 'vitest';
import { esProvidencia, fmtRadicado } from './formato';

describe('fmtRadicado', () => {
  it('separa el radicado de 23 dígitos en el formato de la Rama Judicial', () => {
    expect(fmtRadicado('11001310300120240001200')).toBe('11001-31-03-001-2024-00012-00');
  });

  it('devuelve el texto tal cual cuando no tiene 23 dígitos', () => {
    expect(fmtRadicado('123')).toBe('123');
  });
});

describe('esProvidencia', () => {
  it('reconoce autos, sentencias, fallos y providencias al inicio de la actuación', () => {
    expect(esProvidencia('Auto admite demanda')).toBe(true);
    expect(esProvidencia('  SENTENCIA de primera instancia')).toBe(true);
    expect(esProvidencia('Decisión del despacho')).toBe(true);
    expect(esProvidencia('Radicación de memorial')).toBe(false);
    expect(esProvidencia(null)).toBe(false);
  });
});
