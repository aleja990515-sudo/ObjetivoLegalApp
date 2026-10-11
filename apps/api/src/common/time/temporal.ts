// Temporal helpers shared by the domain, application and infrastructure layers.
// They pin the legacy wire formats: ISO strings always carry milliseconds
// (`Instant#toString` drops them when zero), and calendar dates follow the
// rules of the legacy `new Date('YYYY-MM-DDT...')` parser (see fechaCalendario).

/** `YYYY-MM-DDTHH:mm:ss.sssZ`, the format of the former `Date#toISOString()`. */
export function isoMs(instante: Temporal.Instant): string {
  return instante.toString({ fractionalSecondDigits: 3 });
}

/** Current instant in the `isoMs` format (stored timestamps and API output). */
export function ahoraIso(): string {
  return isoMs(Temporal.Now.instant());
}

/** Current epoch milliseconds, equal to the former `Date.now()`. */
export function epochMsAhora(): number {
  return Temporal.Now.instant().epochMilliseconds;
}

/** True when `valor` has month 1-12 and day 1-31, the range the legacy parser accepted. */
export function enRangoCalendario(valor: string): boolean {
  const mes = Number(valor.slice(5, 7));
  const dia = Number(valor.slice(8, 10));
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31;
}

/**
 * Calendar date of a `YYYY-MM-DD` string with the legacy `Date` rules: a day past
 * the end of its month rolls over (`2026-02-30` is `2026-03-02`). Out-of-range
 * months and days throw a RangeError, as the legacy parser did.
 */
export function fechaCalendario(fecha: string): Temporal.PlainDate {
  if (!enRangoCalendario(fecha)) throw new RangeError('Invalid time value');
  const dia = Number(fecha.slice(8, 10));
  const mes = Number(fecha.slice(5, 7));
  return Temporal.PlainDate.from({ year: Number(fecha.slice(0, 4)), month: 1, day: 1 }).add({
    months: mes - 1,
    days: dia - 1,
  });
}
