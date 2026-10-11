const UTC_OFFSET_MS = 5 * 3600e3;

/** Calendar date (`YYYY-MM-DD`) in Bogotá. Colombia is UTC-5 all year round. */
export function fechaBogota(ahora: Date): string {
  return new Date(ahora.getTime() - UTC_OFFSET_MS).toISOString().slice(0, 10);
}
