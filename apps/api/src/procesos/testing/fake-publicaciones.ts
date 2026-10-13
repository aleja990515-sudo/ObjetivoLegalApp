import type { ArchivoPublicado, BusquedaEstados, EstadoPublicado, PublicacionesPort } from '../application/ports/publicaciones.port.js';

/**
 * Programmable Publicaciones Procesales port for tests: set `estados` by
 * despacho code and `archivos` by estado URL, or put an `Error` to make the
 * call fail. Never touches the network.
 */
export class FakePublicaciones implements PublicacionesPort {
  estados = new Map<string, EstadoPublicado[] | Error>();
  archivos = new Map<string, ArchivoPublicado[] | Error>();
  readonly calls: string[] = [];

  async buscarEstados({ despacho, desde, hasta }: BusquedaEstados): Promise<EstadoPublicado[]> {
    this.calls.push(`buscar:${despacho}:${desde}:${hasta}`);
    return unwrap(this.estados.get(despacho) ?? []);
  }

  async listarArchivos(estado: EstadoPublicado): Promise<ArchivoPublicado[]> {
    this.calls.push(`archivos:${estado.urlEstado}`);
    return unwrap(this.archivos.get(estado.urlEstado) ?? []);
  }
}

function unwrap<T>(value: T | Error): T {
  if (value instanceof Error) throw value;
  return structuredClone(value);
}
