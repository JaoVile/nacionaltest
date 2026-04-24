import { createHash } from 'crypto';
import { prisma } from './db';
import { logger } from '../src/logger';
import { getClientIp, type AuthUser } from './auth';

export interface AuditInput {
  user: AuthUser | null;
  action: string;
  req: Request;
  payload?: unknown;
  metadata?: Record<string, unknown>;
  statusCode?: number;
  errorMsg?: string | null;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Registra uma ação sensível em `AuditLog`.
 *
 * Nunca bloqueia o fluxo: se a DB falhar, só loga warning.
 * Não grava o payload em claro — só o hash SHA-256, pra preservar privacidade
 * mas permitir provar que algo não foi alterado.
 */
export async function writeAudit({
  user,
  action,
  req,
  payload,
  metadata,
  statusCode,
  errorMsg,
}: AuditInput): Promise<void> {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers.get('user-agent') ?? null;
    const payloadHash =
      payload !== undefined ? sha256(JSON.stringify(payload)) : null;
    const metadataStr = metadata ? JSON.stringify(metadata) : null;

    await prisma.auditLog.create({
      data: {
        userEmail:   user?.email ?? null,
        action,
        ip,
        userAgent,
        payloadHash,
        metadata:    metadataStr,
        statusCode:  statusCode ?? null,
        errorMsg:    errorMsg ?? null,
      },
    });
  } catch (e) {
    logger.warn(
      { err: (e as Error).message, action, user: user?.email ?? null },
      'audit: falha ao gravar — continuando',
    );
  }
}
