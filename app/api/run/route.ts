import { NextRequest, NextResponse } from 'next/server';
import { loadConfig, assertAtomosReady } from '../../../src/config';
import { sendTemplate, getMessageStatus } from '../../../src/atomos/client';
import { carregarAtendimentos } from '../../../lib/atendimentos';
import { prisma } from '../../../lib/db';
import { requireUser } from '../../../lib/auth';
import { writeAudit } from '../../../lib/audit';
import { startRun, updateRun, endRun } from '../../../lib/run-state';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function safeJson(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  try {
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export async function POST(req: NextRequest) {
  const authed = await requireUser(req);
  if (authed instanceof NextResponse) return authed;

  const cfg = loadConfig();
  try {
    assertAtomosReady(cfg);
  } catch (e) {
    await writeAudit({ user: authed, action: 'disparo.run', req, statusCode: 400, errorMsg: (e as Error).message });
    return NextResponse.json({ erro: (e as Error).message }, { status: 400 });
  }

  const { mapeaveis, erro: erroDevSul } = await carregarAtendimentos();
  if (erroDevSul && mapeaveis.length === 0) {
    await writeAudit({ user: authed, action: 'disparo.run', req, statusCode: 503, errorMsg: erroDevSul });
    return NextResponse.json({ erro: `DevSul indisponível: ${erroDevSul}` }, { status: 503 });
  }

  const limite = cfg.MAX_SENDS_PER_RUN > 0 ? cfg.MAX_SENDS_PER_RUN : mapeaveis.length;
  const fila = mapeaveis.slice(0, limite);

  const resultados = [];
  let tentativas = 0;
  startRun(fila.length, 'Execução automática');

  try {
  for (const m of fila) {
    tentativas++;
    updateRun(tentativas);
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

    const statusRegistrado = statusFinal ?? (send.ok ? 'QUEUED' : 'ERROR');

    const disparo = await prisma.disparo.create({
      data: {
        atendimentoId:      m.id,
        placa:              m.placa,
        modelo:             m.modelo,
        valor:              m.valor,
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
        rawAtendimento:     safeJson(m.raw),
        elapsedMs:          send.elapsedMs,
        origem:             'AUTO',
        eventos: { create: { status: statusRegistrado, failureReason } },
      },
    });

    resultados.push({
      disparoId:     disparo.id,
      placa:         m.placa,
      ok:            send.ok && statusFinal !== 'FAILED',
      status:        statusRegistrado,
      failureReason,
      ...(send.error ? { error: send.error } : {}),
    });

    await sleep(cfg.SEND_DELAY_MS);
  }
  } finally {
    endRun();
  }

  const resumo = {
    total: mapeaveis.length,
    processados: tentativas,
    enviadosOk: resultados.filter((r) => r.ok).length,
    falhas: resultados.filter((r) => !r.ok).length,
    testMode: cfg.TEST_MODE,
    destinoTeste: cfg.TEST_MODE ? cfg.TEST_PHONE_NUMBER : null,
  };

  await writeAudit({
    user: authed,
    action: 'disparo.run',
    req,
    metadata: resumo,
    statusCode: 200,
  });

  return NextResponse.json({ resumo, resultados });
}
