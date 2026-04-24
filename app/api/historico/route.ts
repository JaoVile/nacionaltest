import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '../../../lib/db';
import { parseSearchParams } from '../../../lib/api-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const QuerySchema = z.object({
  status: z.enum(['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'ERROR']).optional(),
  take:   z.coerce.number().int().min(1).max(1000).default(200),
  skip:   z.coerce.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = parseSearchParams(url, QuerySchema);
  if (!parsed.ok) return parsed.response;
  const { status, take, skip } = parsed.data;

  const where = status ? { ultimoStatus: status } : {};

  const [items, total, porStatus] = await Promise.all([
    prisma.disparo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.disparo.count({ where }),
    prisma.disparo.groupBy({
      by: ['ultimoStatus'],
      _count: true,
    }),
  ]);

  const agregado: Record<string, number> = {};
  for (const g of porStatus) agregado[g.ultimoStatus] = g._count;

  return NextResponse.json({
    items,
    total,
    agregado,
    pagina: { take, skip },
  });
}
