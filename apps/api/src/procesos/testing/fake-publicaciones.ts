import type { ArchivoPublicado, BusquedaEstados, EstadoPublicado, PublicacionesPort } from '../application/ports/publicaciones.port.js';

/**
 * Programmable Publicaciones Procesales port for tests: set `estados` by
 * despacho code, `archivos` by estado URL and `descargas` by document URL, or put
 * an `Error` to make the call fail. A URL missing from `descargas` answers
 * `null`, like a document the portal did not hand back. Never touches the network.
 */
export class FakePublicaciones implements PublicacionesPort {
  estados = new Map<string, EstadoPublicado[] | Error>();
  archivos = new Map<string, ArchivoPublicado[] | Error>();
  descargas = new Map<string, Buffer | Error>();
  readonly calls: string[] = [];

  async buscarEstados({ despacho, desde, hasta }: BusquedaEstados): Promise<EstadoPublicado[]> {
    this.calls.push(`buscar:${despacho}:${desde}:${hasta}`);
    return unwrap(this.estados.get(despacho) ?? []);
  }

  async listarArchivos(estado: EstadoPublicado): Promise<ArchivoPublicado[]> {
    this.calls.push(`archivos:${estado.urlEstado}`);
    return unwrap(this.archivos.get(estado.urlEstado) ?? []);
  }

  async descargar(url: string): Promise<Buffer | null> {
    this.calls.push(`descargar:${url}`);
    const documento = this.descargas.get(url);
    if (documento === undefined) return null;
    if (documento instanceof Error) throw documento;
    return Buffer.from(documento);
  }
}

function unwrap<T>(value: T | Error): T {
  if (value instanceof Error) throw value;
  return structuredClone(value);
}
