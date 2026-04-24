import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loadConfig, assertAtomosReady } from '../../../src/config';
import { logger } from '../../../src/logger';
import { sendTemplate, getMessageStatus } from '../../../src/atomos/client';
import { carregarPorIds } from '../../../lib/atendimentos';
import { prisma } from '../../../lib/db';
import { parseJsonBody } from '../../../lib/api-validation';
import { requireUser } from '../../../lib/auth';
import { writeAudit } from '../../../lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ManualSchema = z.object({
  id: z.string(),
  placa: z.string(),
  modelo: z.string(),
  valor: z.number().nullable(),
  valorFmt: z.string(),
  dataISO: z.string(),
  dataFmt: z.string(),
  telefone: z.string(),
  prestador: z.string(),
  associacao: z.string().default(''),
  cnpj: z.string().default(''),
  protocolo: z.string().default(''),
});

const BodySchema = z.object({
  ids: z.array(z.string().min(1)).min(0).max(500).default([]),
  manuais: z.array(ManualSchema).max(100).default([]),
}).refine((b) => b.ids.length + b.manuais.length > 0, {
  message: 'Envie ao menos um id ou manual',
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function safeJson(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  try {
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export interface DisparoResultado {
  disparoId: string;
  atendimentoId: string;
  placa: string;
  destinoReal: string;
  destinoEfetivo: string;
  ok: boolean;
  messageId: string | null;
  status: string | null;
  failureReason: string | null;
  error?: string;
}

export async function POST(req: NextRequest) {
  const authed = await requireUser(req);
  if (authed instanceof NextResponse) return authed;

  const cfg = loadConfig();
  try {
    assertAtomosReady(cfg);
  } catch (e) {
    await writeAudit({ user: authed, action: 'disparo.send', req, statusCode: 400, errorMsg: (e as Error).message });
    return NextResponse.json({ erro: (e as Error).message }, { status: 400 });
  }

  const body = await parseJsonBody(req, BodySchema);
  if (!body.ok) {
    await writeAudit({ user: authed, action: 'disparo.send', req, statusCode: 400, errorMsg: 'payload inválido' });
    return body.response;
  }
  const parsed = body.data;

  const mapeaveis = await carregarPorIds(parsed.ids);
  const encontrados = new Set(mapeaveis.map((m) => m.id));
  const naoEncontrados = parsed.ids.filter((id) => !encontrados.has(id));

  // Manuais: atendimentos sem telefone na DevSul que o usuário proveu manualmente
  const todosParaDisparar = [
    ...mapeaveis,
    ...parsed.manuais.map((m) => ({
      ...m,
      telefoneMask: '••••••••',
      mapeavel: true as const,
    })),
  ];

  const resultados: DisparoResultado[] = [];

  for (const m of todosParaDisparar) {
    const destinoEfetivo = cfg.TEST_MODE ? cfg.TEST_PHONE_NUMBER : m.telefone;
    const values = {
      associacao: m.associacao,
      cnpj:       m.cnpj,
      placa:      m.placa,
      protocolo:  m.protocolo ? `NO-${m.protocolo}` : '',
      modelo:     m.modelo,
      valor:      m.valorFmt,
      data:       m.dataFmt,
    };

    logger.info(
      { id: m.id, destinoEfetivo, testMode: cfg.TEST_MODE },
      'UI: disparando',
    );
    const send = await sendTemplate({ to: destinoEfetivo, values, senderId: m.id });

    let messageId: string | null = null;
    let sessionId: string | null = null;
    let statusFinal: string | null = null;
    let failureReason: string | null = null;
    let statusCheck: unknown = null;

    if (send.ok) {
      const resp = send.response as { id?: string; sessionId?: string | null } | null;
      messageId = typeof resp?.id === 'string' ? resp.id : null;
      sessionId = typeof resp?.sessionId === 'string' ? resp.sessionId : null;
      if (messageId) {
        await sleep(2000);
        const chk = await getMessageStatus(messageId);
        statusCheck = chk;
        statusFinal = chk?.status ?? null;
        failureReason = chk?.failureReason ?? null;
        if (chk?.sessionId && typeof chk.sessionId === 'string') sessionId = chk.sessionId;
      }
    }

    const statusRegistrado =
      statusFinal ?? (send.ok ? 'QUEUED' : 'ERROR');

    const disparo = await prisma.disparo.create({
      data: {
        atendimentoId:      m.id,
        placa:              m.placa,
        modelo:             m.modelo,
        valor:              m.valor ?? 0,
        dataAtendimento:    new Date(m.dataISO),
        prestador:          m.prestador || null,
        destinoReal:        m.telefone,
        destinoEfetivo,
        testMode:           cfg.TEST_MODE,
        templateId:         cfg.ATOMOS_TEMPLATE_ID,
        atomosMessageId:    messageId,
        atomosSessionId:    sessionId,
        ultimoStatus:       statusRegistrado,
        failureReason,
        errorMessage:       send.ok ? null : (send.error ?? null),
        statusAtualizadoEm: new Date(),
        vPlaca:             values.placa,
        vModelo:            values.modelo,
        vValor:             values.valor,
        vData:              values.data,
        requestPayload:     safeJson(send.request),
        responseBody:       safeJson(send.response),
        httpStatus:         send.status,
        statusCheckBody:    safeJson(statusCheck),
        rawAtendimento:     safeJson((m as { raw?: unknown }).raw ?? null),
        elapsedMs:          send.elapsedMs,
        origem:             'UI',
        eventos: {
          create: { status: statusRegistrado, failureReason },
        },
      },
    });

    resultados.push({
      disparoId:      disparo.id,
      atendimentoId:  m.id,
      placa:          m.placa,
      destinoReal:    m.telefone,
      destinoEfetivo,
      ok:             send.ok && statusFinal !== 'FAILED',
      messageId,
      status:         statusRegistrado,
      failureReason,
      ...(send.error ? { error: send.error } : {}),
    });

    await sleep(cfg.SEND_DELAY_MS);
  }

  const resumo = {
    selecionados: parsed.ids.length + parsed.manuais.length,
    encontrados: mapeaveis.length,
    naoEncontrados,
    enviadosOk: resultados.filter((r) => r.ok).length,
    falhas: resultados.filter((r) => !r.ok).length,
    testMode: cfg.TEST_MODE,
    destinoTeste: cfg.TEST_MODE ? cfg.TEST_PHONE_NUMBER : null,
  };

  await writeAudit({
    user: authed,
    action: 'disparo.send',
    req,
    payload: parsed,
    metadata: {
      selecionados: resumo.selecionados,
      enviadosOk: resumo.enviadosOk,
      falhas: resumo.falhas,
      testMode: resumo.testMode,
    },
    statusCode: 200,
  });

  return NextResponse.json({ resumo, resultados });
}
