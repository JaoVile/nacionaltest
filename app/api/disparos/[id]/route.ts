import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { requireUser } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const authed = await requireUser(req);
  if (authed instanceof NextResponse) return authed;

  const disparo = await prisma.disparo.findUnique({
    where: { id: params.id },
    include: {
      eventos: { orderBy: { observadoEm: 'asc' } },
    },
  });

  if (!disparo) {
    return NextResponse.json({ erro: 'não encontrado' }, { status: 404 });
  }

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { metadata: { contains: disparo.id } },
        { metadata: { contains: disparo.atendimentoId } },
      ],
      createdAt: {
        gte: new Date(disparo.createdAt.getTime() - 60_000),
        lte: new Date(disparo.createdAt.getTime() + 5 * 60_000),
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });

  return NextResponse.json({
    disparo: {
      ...disparo,
      createdAt:          disparo.createdAt.toISOString(),
      updatedAt:          disparo.updatedAt.toISOString(),
      dataAtendimento:    disparo.dataAtendimento.toISOString(),
      statusAtualizadoEm: disparo.statusAtualizadoEm?.toISOString() ?? null,
      concluirEm:         disparo.concluirEm?.toISOString() ?? null,
      concluidoEm:        disparo.concluidoEm?.toISOString() ?? null,
      eventos: disparo.eventos.map((e) => ({
        ...e,
        observadoEm: e.observadoEm.toISOString(),
      })),
    },
    auditLogs: auditLogs.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}
