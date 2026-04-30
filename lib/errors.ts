/**
 * Sanitização de erros pra resposta HTTP.
 *
 * Em produção, mensagens internas (stack traces, mensagens de erro do
 * Prisma/Node) não devem vazar pro cliente — informam superfície de ataque
 * e podem conter PII em algumas situações.
 *
 * Em dev, mantém `e.message` pra debug.
 */
import { NextResponse } from 'next/server';
import { logger } from '../src/logger';

const isProd = process.env.NODE_ENV === 'production';

export interface SanitizedErrorResponse {
  status: number;
  body: { erro: string; codigo?: string };
}

/**
 * Converte um erro arbitrário em resposta JSON sanitizada.
 *
 * @param e - erro capturado.
 * @param status - código HTTP a retornar (default 500).
 * @param fallback - mensagem em prod (default "Erro interno").
 */
export function sanitizeError(
  e: unknown,
  status = 500,
  fallback = 'Erro interno',
): NextResponse {
  const msg = e instanceof Error ? e.message : String(e);

  // Sempre logamos integral pra postmortem (logger faz redact de PII).
  logger.error({ err: msg, status }, 'http error sanitized');

  if (isProd) {
    return NextResponse.json({ erro: fallback }, { status });
  }
  return NextResponse.json({ erro: msg }, { status });
}
