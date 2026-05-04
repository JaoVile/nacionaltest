/**
 * Rate-limit HTTP simples — token bucket in-memory por (user, route).
 *
 * Uso:
 *   const rl = checkRateLimit(user.email, '/api/run');
 *   if (!rl.ok) return rl.response; // 429 com Retry-After
 *
 * Buckets por rota são definidos em `BUCKETS` abaixo. Estado vive em
 * globalThis para sobreviver HMR. Single-instance only — em multi-replica
 * cada instância tem seu próprio contador (aceitável pra defesa básica
 * contra spam, não pra throttling preciso).
 *
 * Estratégia: token bucket com refill linear. `tokens` decai a cada uso;
 * `lastRefill` calcula quantos tokens repor desde o último acesso.
 */
import { NextResponse } from 'next/server';

interface Bucket {
  /** Tokens disponíveis no momento. */
  tokens: number;
  /** Timestamp ms do último refill. */
  lastRefill: number;
}

interface BucketConfig {
  /** Capacidade máxima do bucket. */
  capacity: number;
  /** Tokens repostos por segundo. */
  refillPerSec: number;
}

/**
 * Configuração por rota. Capacidade = burst inicial; refill define a taxa.
 *
 * Ex: `/api/run` 3 tokens, refill 0.05/s = 1 token a cada 20s, total 3/min.
 */
const BUCKETS: Record<string, BucketConfig> = {
  '/api/run':                    { capacity: 3,  refillPerSec: 3 / 60 },
  '/api/disparos/stream':        { capacity: 10, refillPerSec: 10 / 60 },
  '/api/historico/refresh':      { capacity: 10, refillPerSec: 10 / 60 },
  '/api/agendamento/run-now':    { capacity: 3,  refillPerSec: 3 / 60 },
  '/api/lgpd':                   { capacity: 5,  refillPerSec: 5 / 60 },
};

declare global {
  // eslint-disable-next-line no-var
  var __nacionalRateLimit: Map<string, Bucket> | undefined;
}

function store(): Map<string, Bucket> {
  if (!globalThis.__nacionalRateLimit) {
    globalThis.__nacionalRateLimit = new Map();
  }
  return globalThis.__nacionalRateLimit;
}

export interface RateLimitResult {
  ok: boolean;
  /** Resposta 429 pronta quando `ok=false`. */
  response: NextResponse | null;
  /** Tokens restantes após este check (apenas quando ok). */
  remaining: number;
  /** Segundos até o próximo token estar disponível (quando bloqueado). */
  retryAfterSec: number;
}

/**
 * Aplica rate-limit pra uma chave (userEmail) numa rota específica.
 *
 * @param userKey - identificador estável do usuário (email). Use `'anon'` se anônimo.
 * @param routeKey - chave do bucket em BUCKETS. Match exato.
 */
export function checkRateLimit(
  userKey: string,
  routeKey: string,
): RateLimitResult {
  const cfg = BUCKETS[routeKey];
  if (!cfg) {
    return { ok: true, response: null, remaining: Infinity, retryAfterSec: 0 };
  }

  const key = `${userKey}:${routeKey}`;
  const map = store();
  const now = Date.now();
  const existing = map.get(key);

  const bucket: Bucket = existing ?? { tokens: cfg.capacity, lastRefill: now };

  // Refill linear desde o último acesso.
  if (existing) {
    const deltaSec = (now - existing.lastRefill) / 1000;
    bucket.tokens = Math.min(
      cfg.capacity,
      existing.tokens + deltaSec * cfg.refillPerSec,
    );
    bucket.lastRefill = now;
  }

  if (bucket.tokens < 1) {
    const tokensNeeded = 1 - bucket.tokens;
    const retryAfterSec = Math.ceil(tokensNeeded / cfg.refillPerSec);
    map.set(key, bucket);
    return {
      ok: false,
      response: NextResponse.json(
        { erro: 'Muitas requisições, tente novamente mais tarde', retryAfterSec },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
      ),
      remaining: 0,
      retryAfterSec,
    };
  }

  bucket.tokens -= 1;
  map.set(key, bucket);

  return {
    ok: true,
    response: null,
    remaining: Math.floor(bucket.tokens),
    retryAfterSec: 0,
  };
}

/** Reseta o store (uso em testes). */
export function resetRateLimit(): void {
  globalThis.__nacionalRateLimit = new Map();
}
