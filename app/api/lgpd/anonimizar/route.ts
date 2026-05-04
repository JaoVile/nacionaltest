/**
 * LGPD art. 18, IV — Direito de anonimização.
 *
 * POST /api/lgpd/anonimizar  body: { tel: "<E.164>" }
 *
 * Substitui PII em todos os disparos do telefone informado:
 * - `destinoReal` / `destinoEfetivo` → `ANON:<hash>`
 * - `prestador` → null
 * - `requestPayload` / `responseBody` / `rawAtendimento` / `statusCheckBody` / `concluidoResponse` → null
 *
 * Mantém `id`, `createdAt`, `ultimoStatus`, `placa`, `modelo`, `valor`,
 * `dataAtendimento`, `testMode`, `origem` — preservam utilidade de auditoria
 * sem reidentificar o titular.
 *
 * Operação é registrada no `AuditLog` como `lgpd.anonimizar`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '../../../../lib/db';
import { parseJsonBody } from '../../../../lib/api-validation';
import { requireUser } from '../../../../lib/auth';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { writeAudit } from '../../../../lib/audit';
import { sanitizeError } from '../../../../lib/errors';
import { hashTelefone } from '../../../../lib/pii';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  tel: z.string().regex(/^\+?\d{10,15}$/, 'Telefone em E.164 (10–15 dígitos)'),
  /** Se true, retorna count sem aplicar mudanças. */
  dryRun: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const authed = await requireUser(req);
  if (authed instanceof NextResponse) return authed;

  const rl = checkRateLimit(authed.email, '/api/lgpd');
  if (!rl.ok) return rl.response!;

  const body = await parseJsonBody(req, BodySchema);
  if (!body.ok) return body.response;

  const tel = body.data.tel.replace(/\D/g, '');
  const hash = hashTelefone(tel);
  const dryRun = body.data.dryRun;

  try {
    const where = {
      OR: [
        { destinoReal:    tel },
        { destinoEfetivo: tel },
      ],
    };

    if (dryRun) {
      const count = await prisma.disparo.count({ where });
      return NextResponse.json({ dryRun: true, telefoneHash: hash, encontrados: count });
    }

    const result = await prisma.disparo.updateMany({
      where,
      data: {
        destinoReal:       `ANON:${hash}`,
        destinoEfetivo:    `ANON:${hash}`,
        prestador:         null,
        requestPayload:    null,
        responseBody:      null,
        rawAtendimento:    null,
        statusCheckBody:   null,
        concluidoResponse: null,
      },
    });

    await writeAudit({
      user: authed,
      action: 'lgpd.anonimizar',
      req,
      metadata: { telefoneHash: hash, anonimizados: result.count },
      statusCode: 200,
    });

    return NextResponse.json({
      ok: true,
      telefoneHash: hash,
      anonimizados: result.count,
    });
  } catch (e) {
    await writeAudit({
      user: authed,
      action: 'lgpd.anonimizar',
      req,
      statusCode: 500,
      errorMsg: (e as Error).message,
    });
    return sanitizeError(e, 500, 'Falha ao anonimizar registros');
  }
}
