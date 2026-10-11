/** Error devuelto por la API con el estado HTTP y el mensaje `error` del cuerpo. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, mensaje: string) {
    super(mensaje);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface Opciones {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

/**
 * Llama a la API a través del mismo origen (`/api/*`, reenviado por Next).
 * Lanza `ApiError` con el mensaje del servidor cuando la respuesta no es 2xx.
 */
export async function apiFetch<T>(ruta: string, { method = 'GET', body }: Opciones = {}): Promise<T> {
  const init: RequestInit = { method, credentials: 'same-origin', cache: 'no-store' };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }

  const res = await fetch(`/api${ruta}`, init);
  const datos = (await res.json().catch(() => ({}))) as { error?: unknown };

  if (!res.ok) {
    const mensaje = typeof datos.error === 'string' ? datos.error : `Error ${res.status}`;
    throw new ApiError(res.status, mensaje);
  }
  return datos as T;
}
