import { Injectable } from '@nestjs/common';

export const LIMITE_FALLOS = 5;
export const VENTANA_LIMITE_MS = 15 * 60_000;

/**
 * Límite de intentos fallidos por clave (IP + correo). Vive en memoria: sirve
 * para una sola instancia del servidor; con varias instancias cada una cuenta aparte.
 */
@Injectable()
export class LoginRateLimiter {
  private readonly fallos = new Map<string, number[]>();

  /** True cuando la clave ya acumuló `LIMITE_FALLOS` fallos dentro de la ventana. */
  bloqueado(clave: string): boolean {
    return this.recientes(clave).length >= LIMITE_FALLOS;
  }

  registrarFallo(clave: string): void {
    const ahora = Date.now();
    this.fallos.set(clave, [...this.recientes(clave), ahora]);
  }

  limpiar(clave: string): void {
    this.fallos.delete(clave);
  }

  private recientes(clave: string): number[] {
    const limite = Date.now() - VENTANA_LIMITE_MS;
    const vigentes = (this.fallos.get(clave) ?? []).filter((instante) => instante > limite);
    if (vigentes.length === 0) this.fallos.delete(clave);
    else this.fallos.set(clave, vigentes);
    return vigentes;
  }
}
