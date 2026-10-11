import { createHmac } from 'node:crypto';

/**
 * Token of the calendar subscription link: calendar clients send no cookies, so
 * the link carries this value instead (legacy `tokenAgenda`).
 */
export function tokenAgenda(secret: string): string {
  return createHmac('sha256', secret).update('agenda-ics').digest('hex').slice(0, 32);
}
