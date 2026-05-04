import { loadConfig, assertAtomosReady } from '../src/config';
import { logger } from '../src/logger';
import { sendTemplate, getMessageStatus } from '../src/atomos/client';
import { carregarAtendimentos, type AtendimentoView } from './atendimentos';
import { prisma } from './db';
import { agendarAutoConclusao } from './autocomplete';
import { redactPayload } from './pii';

export interface ExecutarAgendamentoOpts {
  modo: 'massa' | 'selecionados';
  /** Quando modo='selecionados', lista de atendimentoIds. Ignorada se modo='massa'. */
  placasIds?: string[];
  origem?: string; // 'AUTO' por padrão
}

export interface ExecutarAgendamentoResumo {
  total: number;       // mapeáveis no período
  processados: number; // tentativas de envio
  enviadosOk: number;
  falhas: number;
  testMode: boolean;
  destinoTeste: string | null;
  ignorados: string[]; // ids requisitados mas não encontrados (modo=selecionados)
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function safeJson(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  try {
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * Executa uma rodada de disparos respeitando o modo.
 * Mirror do flow do /api/run/route.ts mas extraído pra ser reutilizado pelo scheduler.
 * Persiste cada envio em Prisma `Disparo` com `origem='AUTO'` por padrão.
 */
export async function executarAgendamento(
  opts: ExecutarAgendamentoOpts,
): Promise<ExecutarAgendamentoResumo> {
  const cfg = loadConfig();
  assertAtomosReady(cfg);

  const { mapeaveis, erro } = await carregarAtendimentos();
  if (erro && mapeaveis.length === 0) {
    throw new Error(`DevSul indisponível: ${erro}`);
  }

  let fila: AtendimentoView[];
  const ignorados: string[] = [];

  if (opts.modo === 'selecionados') {
    const ids = new Set(opts.placasIds ?? []);
    const indexada = new Map(mapeaveis.map((m) => [m.id, m]));
    fila = [];
    for (const id of ids) {
      const m = indexada.get(id);
      if (m) fila.push(m);
      else ignorados.push(id);
    }
  } else {
    fila = [...mapeaveis];
  }

  const limite = cfg.MAX_SENDS_PER_RUN > 0 ? cfg.MAX_SENDS_PER_RUN : fila.length;
  fila = fila.slice(0, limite);

  const origem = opts.origem ?? 'AUTO';
  const resumo: ExecutarAgendamentoResumo = {
    total: mapeaveis.length,
    processados: 0,
    enviadosOk: 0,
    falhas: 0,
    testMode: cfg.TEST_MODE,
    destinoTeste: cfg.TEST_MODE ? cfg.TEST_PHONE_NUMBER : null,
    ignorados,
  };

  for (const m of fila) {
    resumo.processados++;
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

    let disparoCriadoId: string | null = null;
    try {
      const created = await prisma.disparo.create({
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
          // LGPD: redact telefones em payloads salvos. Ver lib/pii.ts.
          requestPayload:     safeJson(redactPayload(send.request)),
          responseBody:       safeJson(redactPayload(send.response)),
          httpStatus:         send.status,
          statusCheckBody:    safeJson(redactPayload(statusCheck)),
          rawAtendimento:     safeJson(redactPayload(m.raw)),
          elapsedMs:          send.elapsedMs,
          origem,
          eventos: { create: { status: statusRegistrado, failureReason } },
        },
      });
      disparoCriadoId = created.id;
    } catch (e) {
      logger.error({ err: (e as Error).message, id: m.id }, 'Falha ao gravar Disparo no banco');
    }

    const okEnvio = send.ok && statusFinal !== 'FAILED';
    if (okEnvio) resumo.enviadosOk++;
    else resumo.falhas++;

    // Agenda PUT complete da conversa após delay (ver lib/autocomplete.ts).
    if (okEnvio && disparoCriadoId && sessionId) {
      void agendarAutoConclusao(disparoCriadoId, sessionId);
    }

    await sleep(cfg.SEND_DELAY_MS);
  }

  return resumo;
}
