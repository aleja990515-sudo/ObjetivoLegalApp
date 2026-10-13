import { actuacion } from '../testing/proceso.fixtures.js';
import {
  esFijacionEstado,
  esNombreSoloFecha,
  esProvidencia,
  evaluarEstado,
  fechaDelTitulo,
  fechaFijacion,
  numeroDelTitulo,
  ordenarEstados,
  reglaArchivo,
  resultadoEstado,
  sumarDiasHabiles,
  ventanaBusqueda,
  type EstadoPublicado,
} from './autos.js';

// Radicados of the two despachos used in phase P (tests only).
const RAD_FAMILIA = '05001311001520260010000';
const RAD_CIVIL = '05001400302120250133300';

const estado = (overrides: Partial<EstadoPublicado> = {}): EstadoPublicado => ({
  titulo: 'Notificación por Estado No.132 de 15 de septiembre de 2026',
  tipo: 'Notificaciones por Estados',
  fechaPublicacion: '2026-09-15',
  urlEstado: 'https://portal.test/estado/132',
  ...overrides,
});

describe('esProvidencia / esFijacionEstado', () => {
  it('recognises decisions of the judge', () => {
    expect(esProvidencia('Auto Decide')).toBe(true);
    expect(esProvidencia(' Sentencia')).toBe(true);
    expect(esProvidencia('Decisión de tutela')).toBe(true);
    expect(esProvidencia('Fijación Estado')).toBe(false);
    expect(esProvidencia(null)).toBe(false);
  });

  it('recognises the CPNU fijación of an estado', () => {
    expect(esFijacionEstado('Fijación Estado')).toBe(true);
    expect(esFijacionEstado('Fijacion de estados')).toBe(true);
    expect(esFijacionEstado('Auto Decide')).toBe(false);
  });
});

describe('sumarDiasHabiles', () => {
  it('skips weekends', () => {
    expect(sumarDiasHabiles('2026-06-12', 2)).toBe('2026-06-16'); // Friday -> Tuesday
    expect(sumarDiasHabiles('2026-06-10', 1)).toBe('2026-06-11');
    expect(sumarDiasHabiles('2026-06-13', 1)).toBe('2026-06-15'); // Saturday -> Monday
    expect(sumarDiasHabiles('2026-06-10', 0)).toBe('2026-06-10');
  });
});

describe('fechaFijacion / ventanaBusqueda', () => {
  const auto = actuacion(1, { actuacion: 'Auto Decide', fecha: '2026-06-09T00:00:00' });
  const lista = [
    actuacion(4, { actuacion: 'Fijación Estado', fecha: '2026-06-16T00:00:00' }),
    actuacion(3, { actuacion: 'Fijación Estado', fecha: '2026-06-10T00:00:00' }),
    actuacion(2, { actuacion: 'Fijación Estado', fecha: '2026-06-05T00:00:00' }),
    auto,
  ];

  it('takes the first fijación on or after the auto date', () => {
    expect(fechaFijacion(auto, lista)).toBe('2026-06-10');
  });

  it('accepts a fijación on the same day as the auto', () => {
    const mismoDia = actuacion(5, { actuacion: 'Fijación Estado', fecha: '2026-06-09T00:00:00' });
    expect(fechaFijacion(auto, [...lista, mismoDia])).toBe('2026-06-09');
  });

  it('falls back to the next business day without a fijación', () => {
    const viernes = actuacion(1, { actuacion: 'Auto Decide', fecha: '2026-06-12T00:00:00' });
    expect(fechaFijacion(viernes, [viernes])).toBe('2026-06-15');
  });

  it('builds the window from the auto date to fijación + 2 business days', () => {
    expect(ventanaBusqueda(auto, lista)).toEqual({ desde: '2026-06-09', hasta: '2026-06-12', fijacion: '2026-06-10' });
  });

  it('has no window for an auto without a date', () => {
    expect(ventanaBusqueda(actuacion(9, { fecha: null }), [])).toBeNull();
  });
});

describe('fechaDelTitulo / numeroDelTitulo', () => {
  it('parses the long title format', () => {
    expect(fechaDelTitulo('Notificación por Estado No.020 de 23 de febrero de 2026')).toBe('2026-02-23');
    expect(fechaDelTitulo('Notificación por Estado No. 132 de 15 de septiembre de 2026 ')).toBe('2026-09-15');
    expect(fechaDelTitulo('Estado 5 del 3 de setiembre del 2025')).toBe('2025-09-03');
  });

  it('parses the compact title format', () => {
    expect(fechaDelTitulo('ESTADOS20250820')).toBe('2025-08-20');
    expect(fechaDelTitulo('TRASLADOS20250822')).toBe('2025-08-22');
  });

  it('returns null for titles without a valid date', () => {
    expect(fechaDelTitulo('Aviso a la comunidad')).toBeNull();
    expect(fechaDelTitulo('ESTADOS20251340')).toBeNull();
    expect(fechaDelTitulo('Estado de 31 de brumario de 2026')).toBeNull();
  });

  it('reads the estado number', () => {
    expect(numeroDelTitulo('Notificación por Estado No.020 de 23 de febrero de 2026')).toBe('020');
    expect(numeroDelTitulo('Notificación por Estado No. 132 de 15 de septiembre de 2026')).toBe('132');
    expect(numeroDelTitulo('ESTADOS20250820')).toBeNull();
  });
});

describe('reglaArchivo', () => {
  it('matches <year><consecutivo> anywhere in the name (rule a)', () => {
    expect(reglaArchivo('031202600100ConcedeApelación-NiegaSolicitud.pdf', RAD_FAMILIA)).toBe('a');
    expect(reglaArchivo('002202600100InadmiteInvestigaciónPaternidad.pdf', RAD_FAMILIA)).toBe('a');
  });

  it('matches year and consecutivo with separators or without zeros (rule b)', () => {
    expect(reglaArchivo('Auto 2025-01333.pdf', RAD_CIVIL)).toBe('b');
    expect(reglaArchivo('Auto 2025 1333.pdf', RAD_CIVIL)).toBe('b');
    expect(reglaArchivo('01333-2025 requiere.pdf', RAD_CIVIL)).toBe('b');
    expect(reglaArchivo('Auto rad 1333 de 2025.pdf', RAD_CIVIL)).toBe('b');
    expect(reglaArchivo('20251333 admite.pdf', RAD_CIVIL)).toBe('b');
  });

  it('never matches date-only names', () => {
    expect(esNombreSoloFecha('AUTOS20260611.pdf')).toBe(true);
    expect(esNombreSoloFecha('ESTADOSTYBA20260611.pdf')).toBe(true);
    expect(esNombreSoloFecha('031202600100Concede.pdf')).toBe(false);
    // 2026 + 0611 would otherwise look like a consecutivo of 2026.
    expect(reglaArchivo('AUTOS20260611.pdf', '05001400302120260061100')).toBeNull();
  });

  it('does not take dates for a consecutivo', () => {
    const consecutivo1 = '05001400302120260000100';
    expect(reglaArchivo('Estado 2026-01-15 auto.pdf', consecutivo1)).toBeNull();
    expect(reglaArchivo('Estado 15-01-2026 auto.pdf', consecutivo1)).toBeNull();
    expect(reglaArchivo('Estados N° 132 del 15-09-2026.pdf', RAD_FAMILIA)).toBeNull();
  });

  it('ignores files of other radicados', () => {
    expect(reglaArchivo('002202600589ResuelveApelacion.pdf', RAD_FAMILIA)).toBeNull();
    expect(reglaArchivo('09AutoTerminaPorDesistimientoTácitoLevantaMedida202401079.pdf', RAD_CIVIL)).toBeNull();
    expect(reglaArchivo('cualquier.pdf', 'no-es-radicado')).toBeNull();
  });
});

describe('ordenarEstados', () => {
  it('puts the estado of the fijación date first and estados before traslados', () => {
    const lista = [
      estado({ titulo: 'Notificación por Estado No.134 de 17 de septiembre de 2026', fechaPublicacion: '2026-09-17' }),
      estado({ titulo: 'TRASLADOS20250820', tipo: 'Traslados', fechaPublicacion: '2025-08-20' }),
      estado({ titulo: 'ESTADOS20250820', fechaPublicacion: '2025-08-19' }),
      estado({ titulo: 'Sin fecha', fechaPublicacion: null }),
    ];
    expect(ordenarEstados(lista, '2025-08-20').map((e) => e.titulo)).toEqual([
      'ESTADOS20250820',
      'TRASLADOS20250820',
      'Notificación por Estado No.134 de 17 de septiembre de 2026',
      'Sin fecha',
    ]);
  });
});

describe('evaluarEstado', () => {
  it('returns an exacto PDF when a file carries the radicado', () => {
    const archivos = [
      { nombre: '002202600589ResuelveApelacion.pdf', url: 'https://portal.test/f/1' },
      { nombre: '031202600100ConcedeApelación-NiegaSolicitud.pdf', url: 'https://portal.test/f/2' },
    ];
    expect(evaluarEstado(estado(), archivos, RAD_FAMILIA, '2026-09-15')).toEqual({
      confianza: 'exacto',
      urlPdf: 'https://portal.test/f/2',
      nombreArchivo: '031202600100ConcedeApelación-NiegaSolicitud.pdf',
      urlEstado: 'https://portal.test/estado/132',
      numeroEstado: '132',
      fechaPublicacion: '2026-09-15',
    });
  });

  const combinado = [
    { nombre: 'ESTADOSTYBA20260611.pdf', url: 'https://portal.test/f/e' },
    { nombre: 'AUTOS20260611.pdf', url: 'https://portal.test/f/a' },
  ];
  const estado95 = estado({ titulo: 'Notificación por Estado No. 095 de 11 de junio de 2026', fechaPublicacion: '2026-06-10' });

  it('returns the combined AUTOS file of the fijación date as del_dia', () => {
    expect(evaluarEstado(estado95, combinado, RAD_CIVIL, '2026-06-11')).toMatchObject({
      confianza: 'del_dia',
      urlPdf: 'https://portal.test/f/a',
      nombreArchivo: 'AUTOS20260611.pdf',
      numeroEstado: '095',
      fechaPublicacion: '2026-06-10',
    });
  });

  it('accepts the publication date as the fijación date', () => {
    expect(evaluarEstado(estado95, combinado, RAD_CIVIL, '2026-06-10')?.confianza).toBe('del_dia');
  });

  it('does not offer a combined file of another day, of a traslado or without an AUTOS file', () => {
    expect(evaluarEstado(estado95, combinado, RAD_CIVIL, '2026-06-12')).toBeNull();
    expect(evaluarEstado({ ...estado95, tipo: 'Traslados' }, combinado, RAD_CIVIL, '2026-06-11')).toBeNull();
    expect(evaluarEstado(estado95, [combinado[0]], RAD_CIVIL, '2026-06-11')).toBeNull();
    expect(evaluarEstado(estado95, [], RAD_CIVIL, '2026-06-11')).toBeNull();
  });

  it('does not offer a combined file when other files have names', () => {
    const mixto = [...combinado, { nombre: '002202600589Resuelve.pdf', url: 'https://portal.test/f/x' }];
    expect(evaluarEstado(estado95, mixto, RAD_CIVIL, '2026-06-11')).toBeNull();
  });
});

describe('resultadoEstado', () => {
  it('links to the estado page without a PDF', () => {
    expect(resultadoEstado(estado())).toEqual({
      confianza: 'estado',
      urlPdf: null,
      nombreArchivo: null,
      urlEstado: 'https://portal.test/estado/132',
      numeroEstado: '132',
      fechaPublicacion: '2026-09-15',
    });
  });
});
