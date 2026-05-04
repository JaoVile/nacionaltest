/**
 * LGPD art. 18, II — Direito de acesso.
 *
 * GET /api/lgpd/acesso?tel=<telefone>
 *
 * Busca disparos onde o titular foi destinatário (campo `destinoReal`) e
 * retorna metadados sumarizados. Telefone é normalizado para apenas dígitos
 * antes da busca.
 *
 * Para dados pós-redação (Fase 4a), o telefone vive como `hash:...:••••XXXX`
 * em campos JSON — esta busca cobre `destinoReal` que continua em claro
 * (dados operacionais necessários para reenvio). Pra anonimizar tudo de
 * uma vez use POST /api/lgpd/anonimizar.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '../../../../lib/db';
import { requireUser } from '../../../../lib/auth';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { writeAudit } from '../../../../lib/audit';
import { sanitizeError } from '../../../../lib/errors';
import { hashTelefone } from '../../../../lib/pii';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const QuerySchema = z.object({
  tel: z.string().regex(/^\+?\d{10,15}$/, 'Telefone em E.164 (10–15 dígitos)'),
});

export async function GET(req: NextRequest) {
  const authed = await requireUser(req);
  if (authed instanceof NextResponse) return authed;

  const rl = checkRateLimit(authed.email, '/api/lgpd');
  if (!rl.ok) return rl.response!;

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({ tel: searchParams.get('tel') ?? '' });
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const tel = parsed.data.tel.replace(/\D/g, '');
  const hash = hashTelefone(tel);

  try {
    const disparos = await prisma.disparo.findMany({
      where: {
        OR: [
          { destinoReal:    tel },
          { destinoEfetivo: tel },
        ],
      },
      select: {
        id: true,
        createdAt: true,
        ultimoStatus: true,
        placa: true,
        modelo: true,
        prestador: true,
        testMode: true,
        origem: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    await writeAudit({
      user: authed,
      action: 'lgpd.acesso',
      req,
      metadata: { telefoneHash: hash, encontrados: disparos.length },
      statusCode: 200,
    });

    return NextResponse.json({
      telefoneHash: hash,
      encontrados: disparos.length,
      disparos: disparos.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    await writeAudit({
      user: authed,
      action: 'lgpd.acesso',
      req,
      statusCode: 500,
      errorMsg: (e as Error).message,
    });
    return sanitizeError(e, 500, 'Falha ao consultar disparos');
  }
}
