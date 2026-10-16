import { deflateSync } from 'node:zlib';
import { extraerTextoPdf, radicadosEnTexto } from './texto-pdf.js';

// Built in code on purpose: a real LISTADO carries personal data, so no court PDF
// is committed. These five radicados are fake, only the shapes mimic the generator.
const RAD_TJ = '05001311000320260030200';
const RAD_KERNING = '05001311000320260032700';
const RAD_ESCAPES = '05001311000320260021800';
const RAD_PLAIN_STREAM = '05001400302120250133300';
const RAD_HEX = '05001311001520260010000';

const hexDe = (texto: string): string =>
  texto
    .split('')
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');

// The shapes seen in a real listing: a whole radicado in one `Tj`, a radicado split
// by kerning inside a `TJ` array, escapes around another one, and a repeat.
const CONTENIDO_COMPRIMIDO = [
  `BT /F1 9 Tf 40 700 Td (${RAD_TJ}) Tj ET`,
  `BT /F1 9 Tf 40 680 Td [(050013110003202600) -15 (32) 20 (700)] TJ ET`,
  String.raw`BT /F1 9 Tf 40 660 Td (Radicaci\363n \(privada\) \050${RAD_ESCAPES}\051) Tj ET`,
  `BT /F1 9 Tf 40 640 Td (${RAD_TJ}) Tj ET`,
].join('\n');

const CONTENIDO_SIN_COMPRIMIR = [`BT /F1 9 Tf 40 620 Td (${RAD_PLAIN_STREAM}) Tj ET`, `BT /F1 9 Tf 40 600 Td <${hexDe(RAD_HEX)}> Tj ET`].join('\n');

/** Minimal PDF with one stream per content (no xref: nothing opens it in a viewer). */
function construirPdf(flujos: Array<{ contenido: string; comprimido: boolean }>): Buffer {
  const partes: Buffer[] = [Buffer.from('%PDF-1.4\n')];
  flujos.forEach((flujo, i) => {
    const bytes = Buffer.from(flujo.contenido, 'latin1');
    const cuerpo = flujo.comprimido ? deflateSync(bytes) : bytes;
    partes.push(Buffer.from(`${i + 4} 0 obj\n<< /Length ${cuerpo.length}${flujo.comprimido ? ' /Filter /FlateDecode' : ''} >>\nstream\n`));
    partes.push(cuerpo, Buffer.from('\nendstream\nendobj\n'));
  });
  partes.push(Buffer.from('trailer\n<< /Root 1 0 R >>\n%%EOF\n'));
  return Buffer.concat(partes);
}

const PDF = construirPdf([
  { contenido: CONTENIDO_COMPRIMIDO, comprimido: true },
  { contenido: CONTENIDO_SIN_COMPRIMIR, comprimido: false },
]);

describe('extraerTextoPdf', () => {
  const texto = extraerTextoPdf(PDF);

  it('reads the radicados of a compressed stream and of a plain one, in order and once each', () => {
    expect(radicadosEnTexto(texto)).toEqual([RAD_TJ, RAD_KERNING, RAD_ESCAPES, RAD_PLAIN_STREAM, RAD_HEX]);
  });

  it('keeps a radicado split by kerning contiguous, and reads a hex string', () => {
    expect(texto.split('\n')).toContain(RAD_KERNING);
    expect(texto.split('\n')).toContain(RAD_HEX);
    expect(texto).toContain(`Radicación (privada) (${RAD_ESCAPES})`);
  });

  it('answers an empty string for bytes that are not a PDF, and never throws', () => {
    expect(extraerTextoPdf(Buffer.from('no soy un pdf'))).toBe('');
    expect(extraerTextoPdf(Buffer.alloc(0))).toBe('');
    expect(extraerTextoPdf(Buffer.from([0x00, 0xff, 0x1b, 0x7f, 0x80]))).toBe('');
    expect(radicadosEnTexto('')).toEqual([]);
  });

  it('uses the raw bytes of a stream that does not inflate', () => {
    const roto = construirPdf([{ contenido: `BT (${RAD_TJ}) Tj ET`, comprimido: false }]);
    const conBasura = Buffer.concat([roto, Buffer.from('\nstream\n\x00\x01\x02\xff\nendstream\n')]);
    expect(() => extraerTextoPdf(conBasura)).not.toThrow();
    expect(radicadosEnTexto(extraerTextoPdf(conBasura))).toEqual([RAD_TJ]);
  });
});

describe('radicadosEnTexto', () => {
  it('ignores a run of digits that is not exactly a radicado', () => {
    expect(radicadosEnTexto(`1${RAD_TJ}`)).toEqual([]);
    expect(radicadosEnTexto(`${RAD_TJ}0`)).toEqual([]);
    expect(radicadosEnTexto(`x ${RAD_TJ} y ${RAD_TJ} z`)).toEqual([RAD_TJ]);
  });
});
