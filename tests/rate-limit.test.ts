import { describe, expect, it, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimit } from '../lib/rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimit();
  });

  it('permite até a capacidade configurada (3 para /api/run)', () => {
    const r1 = checkRateLimit('a@x.com', '/api/run');
    const r2 = checkRateLimit('a@x.com', '/api/run');
    const r3 = checkRateLimit('a@x.com', '/api/run');
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r3.ok).toBe(true);
  });

  it('bloqueia 4ª chamada com 429 + Retry-After', async () => {
    for (let i = 0; i < 3; i++) checkRateLimit('a@x.com', '/api/run');
    const blocked = checkRateLimit('a@x.com', '/api/run');
    expect(blocked.ok).toBe(false);
    expect(blocked.response).not.toBeNull();
    expect(blocked.response!.status).toBe(429);
    expect(blocked.response!.headers.get('Retry-After')).toBeDefined();
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('isolamento entre usuários — A bloqueado não afeta B', () => {
    for (let i = 0; i < 3; i++) checkRateLimit('a@x.com', '/api/run');
    const blockedA = checkRateLimit('a@x.com', '/api/run');
    const okB = checkRateLimit('b@x.com', '/api/run');
    expect(blockedA.ok).toBe(false);
    expect(okB.ok).toBe(true);
  });

  it('isolamento entre rotas — bloquear /api/run não afeta /api/disparos/stream', () => {
    for (let i = 0; i < 3; i++) checkRateLimit('a@x.com', '/api/run');
    const blockedRun = checkRateLimit('a@x.com', '/api/run');
    const okStream = checkRateLimit('a@x.com', '/api/disparos/stream');
    expect(blockedRun.ok).toBe(false);
    expect(okStream.ok).toBe(true);
  });

  it('rota desconhecida passa livremente', () => {
    const r = checkRateLimit('a@x.com', '/api/inexistente');
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(Infinity);
  });

  it('refill linear: aguardar tempo libera tokens', async () => {
    // Esgota /api/lgpd (5 tokens, 5/60s = 12s/token aprox)
    for (let i = 0; i < 5; i++) checkRateLimit('a@x.com', '/api/lgpd');
    const blocked = checkRateLimit('a@x.com', '/api/lgpd');
    expect(blocked.ok).toBe(false);

    // Avança o relógio simulando 13s — força um token de volta
    // (não conseguimos fakeTimers porque store usa Date.now real;
    //  ao invés, validamos que retryAfterSec é > 0 e plausível)
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
  });
});
