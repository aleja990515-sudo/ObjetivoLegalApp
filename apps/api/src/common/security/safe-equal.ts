import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Constant-time comparison of two secrets of any type or length: both are
 * hashed first (legacy `iguales`), so lengths never leak.
 */
export function safeEqual(x: unknown, y: unknown): boolean {
  const digest = (v: string) => createHash('sha256').update(v).digest();
  return timingSafeEqual(digest(String(x || '')), digest(String(y)));
}
