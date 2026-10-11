import { LIMITE_FALLOS, LoginRateLimiter, VENTANA_LIMITE_MS } from './login-rate-limiter.js';

describe('LoginRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('blocks a key after five failures and only that key', () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < LIMITE_FALLOS - 1; i++) limiter.registrarFallo('ip|ana@example.com');
    expect(limiter.bloqueado('ip|ana@example.com')).toBe(false);
    limiter.registrarFallo('ip|ana@example.com');
    expect(limiter.bloqueado('ip|ana@example.com')).toBe(true);
    expect(limiter.bloqueado('ip|luis@example.com')).toBe(false);
  });

  it('forgets failures older than the 15-minute window', () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < LIMITE_FALLOS; i++) limiter.registrarFallo('k');
    expect(limiter.bloqueado('k')).toBe(true);
    vi.setSystemTime(Date.now() + VENTANA_LIMITE_MS);
    expect(limiter.bloqueado('k')).toBe(false);
  });

  it('clears a key on demand', () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < LIMITE_FALLOS; i++) limiter.registrarFallo('k');
    limiter.limpiar('k');
    expect(limiter.bloqueado('k')).toBe(false);
  });
});
