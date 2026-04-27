import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '../../../lib/db';
import { parseJsonBody } from '../../../lib/api-validation';
import { requireUser } from '../../../lib/auth';
import { writeAudit } from '../../../lib/audit';
import { aplicarAgendamento, montarCronExpr, proximaExecucao } from '../../../lib/scheduler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_ID = 'default';

async function getOrCreate() {
  const found = await prisma.agendamento.findUnique({ where: { id: DEFAULT_ID } });
  if (found) return found;
  return prisma.agendamento.create({ data: { id: DEFAULT_ID } });
}

function shape(a: Awaited<ReturnType<typeof getOrCreate>>) {
  const placas = a.placas ? (JSON.parse(a.placas) as string[]) : [];
  const cronExpr = montarCronExpr(a.diasSemana, a.hora, a.minuto);
  const proxima = a.ativo ? proximaExecucao(a.diasSemana, a.hora, a.minuto) : null;
  return {
    id: a.id,
    ativo: a.ativo,
    modo: a.modo,
    diasSemana: a.diasSemana.split(',').filter(Boolean).map(Number),
    hora: a.hora,
    minuto: a.minuto,
    placas,
    cronExpr,
    proximaExec: proxima ? proxima.toISOString() : null,
    ultimaExec: a.ultimaExec ? a.ultimaExec.toISOString() : null,
    ultimoTotal: a.ultimoTotal,
    ultimoOk:    a.ultimoOk,
    ultimoFalha: a.ultimoFalha,
    ultimoErro:  a.ultimoErro,
    updatedAt:   a.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const authed = await requireUser(req);
  if (authed instanceof NextResponse) return authed;
  const a = await getOrCreate();
  return NextResponse.json(shape(a));
}

const PatchSchema = z.object({
  ativo:      z.boolean().optional(),
  modo:       z.enum(['massa', 'selecionados']).optional(),
  diasSemana: z.array(z.number().int().min(0).max(6)).optional(),
  hora:       z.number().int().min(0).max(23).optional(),
  minuto:     z.number().int().min(0).max(59).optional(),
  placas:     z.array(z.string().min(1)).optional(),
}).strict();

export async function PATCH(req: NextRequest) {
  const authed = await requireUser(req);
  if (authed instanceof NextResponse) return authed;

  const parsed = await parseJsonBody(req, PatchSchema);
  if (!parsed.ok) {
    await writeAudit({ user: authed, action: 'agendamento.patch', req, statusCode: 400, errorMsg: 'payload inválido' });
    return parsed.response;
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.ativo !== undefined)      data.ativo = parsed.data.ativo;
  if (parsed.data.modo !== undefined)       data.modo = parsed.data.modo;
  if (parsed.data.diasSemana !== undefined) data.diasSemana = parsed.data.diasSemana.join(',');
  if (parsed.data.hora !== undefined)       data.hora = parsed.data.hora;
  if (parsed.data.minuto !== undefined)     data.minuto = parsed.data.minuto;
  if (parsed.data.placas !== undefined)     data.placas = JSON.stringify(parsed.data.placas);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true, aviso: 'Nenhum campo alterado' });
  }

  await getOrCreate();
  const a = await prisma.agendamento.update({ where: { id: DEFAULT_ID }, data });

  // Re-registra o cron com a nova config
  const status = await aplicarAgendamento();

  await writeAudit({
    user: authed,
    action: 'agendamento.patch',
    req,
    metadata: { keys: Object.keys(data), schedulerAtivo: status.ativo, cronExpr: status.cronExpr },
    statusCode: 200,
  });

  return NextResponse.json({ ok: true, agendamento: shape(a), scheduler: status });
}
