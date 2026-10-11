import { fechaValida, horaValida, normalizarEtiquetas, texto } from './validation.js';

describe('validation (legacy helpers)', () => {
  describe('texto', () => {
    it('trims and truncates like the legacy helper', () => {
      expect(texto('  hola mundo  ', 4)).toBe('hola');
      expect(texto(null, 10)).toBe('');
      expect(texto(undefined, 10)).toBe('');
      expect(texto(12, 10)).toBe('12');
    });
  });

  describe('fechaValida', () => {
    it.each(['2026-03-10', '2026-12-31'])('accepts %s', (fecha) => {
      expect(fechaValida(fecha)).toBe(true);
    });

    it.each(['2026-3-1', '10/03/2026', '', null, undefined, 20260310, 'hoy'])('rejects %p', (fecha) => {
      expect(fechaValida(fecha)).toBe(false);
    });
  });

  describe('horaValida', () => {
    it('keeps HH:MM and drops anything else to an empty string', () => {
      expect(horaValida('09:30')).toBe('09:30');
      expect(horaValida('9:30')).toBe('');
      expect(horaValida('09:30:00')).toBe('');
      expect(horaValida(undefined)).toBe('');
      expect(horaValida(930)).toBe('');
    });
  });

  describe('normalizarEtiquetas', () => {
    it('splits a comma-separated string, trims, drops empties and removes duplicates', () => {
      expect(normalizarEtiquetas('urgente, civil,, urgente ,  ')).toEqual(['urgente', 'civil']);
    });

    it('accepts an array as-is', () => {
      expect(normalizarEtiquetas(['a', ' b ', 'a'])).toEqual(['a', 'b']);
    });

    it('turns null and undefined into an empty list (deliberate fix: never the tag "null")', () => {
      expect(normalizarEtiquetas(null)).toEqual([]);
      expect(normalizarEtiquetas(undefined)).toEqual([]);
    });

    it('truncates each tag to 30 characters and keeps at most 10 tags', () => {
      const largo = 'x'.repeat(40);
      const once = normalizarEtiquetas(Array.from({ length: 12 }, (_, i) => (i === 0 ? largo : `t${i}`)));
      expect(once).toHaveLength(10);
      expect(once[0]).toBe('x'.repeat(30));
    });
  });
});
