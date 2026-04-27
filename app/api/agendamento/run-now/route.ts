import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { writeAudit } from '../../../../lib/audit';
import { dispararAgora } from '../../../../lib/scheduler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/agendamento/run-now
 * Dispara uma rodada imediatamente (botão "Disparar agora" da UI).
 * Usa as mesmas regras do agendamento (modo, placas), mas ignora `ativo` e cron.
 */
export async function POST(req: NextRequest) {
  const authed = await requireUser(req);
  if (authed instanceof NextResponse) return authed;

  const inicio = Date.now();
  try {
    await dispararAgora();
    await writeAudit({
      user: authed,
      action: 'agendamento.run-now',
      req,
      metadata: { durMs: Date.now() - inicio },
      statusCode: 200,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = (e as Error).message;
    await writeAudit({
      user: authed,
      action: 'agendamento.run-now',
      req,
      statusCode: 500,
      errorMsg: msg,
    });
    return NextResponse.json({ ok: false, erro: msg }, { status: 500 });
  }
}
