/** Message stored on a proceso when CPNU fails (legacy `p.error = e.message`). */
export function errorMessage(error: unknown): string {
  return error instanceof Error || error instanceof DOMException ? error.message : String(error);
}
