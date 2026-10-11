/** Colombia's civil time zone; it has no DST since 1993, so it is UTC-5 all year round. */
export const ZONA_BOGOTA = 'America/Bogota';

/** Calendar date (`YYYY-MM-DD`) in Bogotá for an instant. */
export function fechaBogota(instante: Temporal.Instant): string {
  return instante.toZonedDateTimeISO(ZONA_BOGOTA).toPlainDate().toString();
}

/** Today's calendar date (`YYYY-MM-DD`) in Bogotá. */
export function hoyBogota(): string {
  return Temporal.Now.plainDateISO(ZONA_BOGOTA).toString();
}
