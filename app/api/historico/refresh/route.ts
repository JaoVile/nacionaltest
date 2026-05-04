import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMessageStatus } from '../../../../src/atomos/client';
import { prisma } from '../../../../lib/db';
import { parseJsonBody } from '../../../../lib/api-validation';
import { requireUser } from '../../../../lib/auth';
import { writeAudit } from '../../../../lib/audit';
import { checkRateLimit } from '../../../../lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

/**
 * Re-consulta o status no Atomos para cada disparoId recebido e atualiza a DB.
 * Útil para QUEUED/SENT que ainda podem virar DELIVERED/READ.
 */
export async function POST(req: NextRequest) {
  const authed = await requireUser(req);
  if (authed instanceof NextResponse) return authed;

  const rl = checkRateLimit(authed.email, '/api/historico/refresh');
  if (!rl.ok) return rl.response!;

  const body = await parseJsonBody(req, BodySchema);
  if (!body.ok) return body.response;
  const parsed = body.data;

  const disparos = await prisma.disparo.findMany({
    where: { id: { in: parsed.ids } },
  });

  const resultados = [];

  for (const d of disparos) {
    if (!d.atomosMessageId) {
      resultados.push({ id: d.id, status: d.ultimoStatus, atualizado: false });
      continue;
    }
    const chk = await getMessageStatus(d.atomosMessageId);
    if (!chk) {
      resultados.push({ id: d.id, status: d.ultimoStatus, atualizado: false });
      continue;
    }

    const mudou = chk.status !== d.ultimoStatus;
    if (mudou) {
      await prisma.disparo.update({
        where: { id: d.id },
        data: {
          ultimoStatus:       chk.status,
          failureReason:      chk.failureReason ?? null,
          statusAtualizadoEm: new Date(),
          eventos: {
            create: {
              status: chk.status,
              failureReason: chk.failureReason ?? null,
            },
          },
        },
      });
    }

    resultados.push({ id: d.id, status: chk.status, atualizado: mudou });
  }

  await writeAudit({
    user: authed,
    action: 'historico.refresh',
    req,
    payload: parsed,
    metadata: {
      solicitados: parsed.ids.length,
      atualizados: resultados.filter((r) => r.atualizado).length,
    },
    statusCode: 200,
  });

  return NextResponse.json({ resultados });
}
