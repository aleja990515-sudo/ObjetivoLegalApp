// Text layer of the PDFs the court publishes (the `LISTADO <n>.pdf` attached to
// an estado) and the radicados inside them. Node built-ins only (`node:zlib`):
// the deploy host has no `pdftotext`/poppler and a PDF dependency was rejected.
// Only a PDF with a text layer is readable; a scanned listing yields no radicado
// and the caller must record that as "unreadable", never as "case not found".

import { inflateSync } from 'node:zlib';

const KW_STREAM = Buffer.from('stream');
const KW_ENDSTREAM = Buffer.from('endstream');

/** A literal string, a hex string or a text-showing operator, in document order. */
const TOKEN = /\((?:\\.|[^\\()])*\)|<(?:[0-9A-Fa-f]\s*)+>|\bTj\b|\bTJ\b|'|"/g;

/** Radicado: 23 digits, not glued to another digit (never guess a partial one). */
const RADICADO = /(?<!\d)\d{23}(?!\d)/g;

const ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };

/**
 * Text shown by the text-showing operators of a PDF with a text layer, one
 * operator per line. Never throws: bytes that are not a PDF, an empty buffer or
 * a corrupted stream answer an empty or partial string instead.
 */
export function extraerTextoPdf(data: Buffer): string {
  try {
    return flujos(data)
      .map(textoDelFlujo)
      .filter(Boolean)
      .join('\n');
  } catch {
    return '';
  }
}

/** The unique 23-digit radicados of a text, in order of first appearance. */
export function radicadosEnTexto(texto: string): string[] {
  return [...new Set(texto.match(RADICADO) ?? [])];
}

/** Body of every `stream` ... `endstream` of the file, in order, already inflated when compressed. */
function flujos(data: Buffer): Buffer[] {
  const out: Buffer[] = [];
  let desde = 0;
  for (;;) {
    const ini = data.indexOf(KW_STREAM, desde);
    if (ini < 0) break;
    desde = ini + KW_STREAM.length;
    // `endstream` carries the keyword too. A stream body always starts on a new line.
    if (data.subarray(ini - 3, ini).toString('latin1') === 'end') continue;
    if (data[desde] !== 0x0a && data[desde] !== 0x0d) continue;
    let cuerpo = desde;
    if (data[cuerpo] === 0x0d) cuerpo++;
    if (data[cuerpo] === 0x0a) cuerpo++;
    const fin = data.indexOf(KW_ENDSTREAM, cuerpo);
    if (fin < 0) break;
    let hasta = fin;
    while (hasta > cuerpo && (data[hasta - 1] === 0x0a || data[hasta - 1] === 0x0d)) hasta--;
    out.push(descomprimir(data.subarray(cuerpo, hasta)));
    desde = fin + KW_ENDSTREAM.length;
  }
  return out;
}

/** A stream inside a PDF is compressed unless it is not: keep the raw bytes then. */
function descomprimir(flujo: Buffer): Buffer {
  try {
    return inflateSync(flujo);
  } catch {
    return flujo;
  }
}

/** Lines built from the `Tj`/`TJ`/`'`/`"` operators of one (inflated) stream. */
function textoDelFlujo(flujo: Buffer): string {
  // One char per byte: operators and escapes are ASCII, and a raw binary stream
  // (a font, an image) shows no operator and yields no line.
  const contenido = flujo.toString('latin1');
  const lineas: string[] = [];
  let linea = '';
  for (const m of contenido.matchAll(TOKEN)) {
    const token = m[0];
    if (token.startsWith('(')) linea += textoLiteral(token.slice(1, -1));
    else if (token.startsWith('<')) linea += textoHexadecimal(token.slice(1, -1));
    else {
      // A text-showing operator closes the line: inside a `TJ` array the parts are
      // already concatenated, so a radicado split by kerning stays contiguous.
      if (linea) lineas.push(linea);
      linea = '';
    }
  }
  if (linea) lineas.push(linea);
  return lineas.join('\n');
}

/** A literal string with the escapes of the PDF syntax resolved (`\n`, `\(`, `\ddd`...). */
function textoLiteral(contenido: string): string {
  return contenido.replace(/\\(?:([nrtbf()\\])|([0-7]{1,3})|\r?\n|[\s\S])/g, (_todo, simple?: string, octal?: string) => {
    if (simple !== undefined) return ESCAPES[simple] ?? simple;
    if (octal !== undefined) return String.fromCharCode(parseInt(octal, 8) & 0xff);
    return '';
  });
}

/** A hex string (`<48656C6C6F>`) as bytes, one char per byte; a lone last digit is dropped. */
function textoHexadecimal(contenido: string): string {
  const digitos = contenido.replace(/\s+/g, '');
  let salida = '';
  for (let i = 0; i + 1 < digitos.length; i += 2) salida += String.fromCharCode(parseInt(digitos.slice(i, i + 2), 16));
  return salida;
}
