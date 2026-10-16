/**
 * Colombian radicación rules (Acuerdo 201/1997 and 1463/2002 of the Consejo
 * Superior de la Judicatura): the 23 digits are
 * `DDDDD|CC|EE|JJJ|AAAA|SSSSS|RR` = DANE municipality, corporation, specialty,
 * court, year, consecutivo de radicación and consecutivo de recursos.
 *
 * The last two digits are the only ones a recurso changes: `00` is first
 * instance and `01`, `02`, `03` are the later instances before the superior
 * court. The consecutivo itself "no cambia", so the case keeps one key for its
 * whole life and the full radicado must never be used as the case identity.
 */

/** The case key: the radicado without the two digits of its recurso. */
export function claveCaso(radicado: string): string {
  return radicado.length === 23 ? radicado.slice(0, 21) : radicado;
}
