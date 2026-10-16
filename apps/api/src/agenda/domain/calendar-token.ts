import { createHmac } from 'node:crypto';

/**
 * Token of the calendar subscription link: calendar clients send no cookies, so
 * the link carries this value instead (legacy `tokenAgenda`). It is bound to one
 * user — `<usuarioId>.<firma>` — so a link only ever unlocks that user's calendar.
 */
export function tokenAgenda(secret: string, usuarioId: string): string {
  const firma = createHmac('sha256', secret).update(`agenda-ics:${usuarioId}`).digest('hex').slice(0, 32);
  return `${usuarioId}.${firma}`;
}
