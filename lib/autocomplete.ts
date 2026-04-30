/**
 * Worker de auto-conclusão de conversas Atomos.
 *
 * Após cada disparo OK, agendamos um PUT /chat/v1/session/{id}/complete depois
 * de `ATOMOS_AUTOCOMPLETE_DELAY_MS` (default 70s). A janela existe para que o
 * prestador tenha tempo de responder antes de fecharmos a sessão.
 *
 * Como a Atomos não expõe endpoint público de "listar mensagens da conversa",
 * a detecção de resposta é INDIRETA: o response do PUT complete devolve um
 * PublicSessionDTO com `lastMessageIn` — se for posterior ao `createdAt` do
 * disparo, o prestador respondeu na janela. Essa marcação é persistida em
 * `Disparo.respostaDetectada` para análise/UX posterior.
 *
 * Persistência: `concluirEm` é gravado no Disparo na hora do envio. Tasks
 * vivem em memória (setTimeout) DURANTE a vida do processo, mas se houver
 * restart antes do delay, o `bootRecovery()` (chamado pelo instrumentation)
 * varre disparos pendentes e reagenda — sem perder envios.
 */
import { loadConfig } from '../src/config';
import { logger } from '../src/logger';
import { completeSession } from '../src/atomos/client';
import { prisma } from './db';
import { redactPayload } from './pii';

interface ScheduledTask {
  disparoId: string;
  timer: NodeJS.Timeout;
}

/** Tasks em memória, indexadas por disparoId. Sobrevive a HMR via globalThis. */
const g = globalThis as unknown as {
  __nacionalAutocompleteTasks?: Map<string, ScheduledTask>;
};
g.__nacionalAutocompleteTasks ??= new Map();
const tasks: Map<string, ScheduledTask> = g.__nacionalAutocompleteTasks;

/**
 * Agenda o complete para um disparo. Idempotente: se já tinha task em memória,
 * cancela a antiga antes de registrar a nova. Calcula `concluirEm = createdAt + delay`
 * e grava no Disparo (para recovery após restart).
 */
export async function agendarAutoConclusao(
  disparoId: string,
  sessionId: string | null,
): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.ATOMOS_AUTOCOMPLETE_ENABLED) return;
  if (!sessionId) {
    logger.info({ disparoId }, 'autocomplete: sem sessionId, pulando agendamento');
    return;
  }

  const delay = cfg.ATOMOS_AUTOCOMPLETE_DELAY_MS;
  const concluirEm = new Date(Date.now() + delay);

  try {
    await prisma.disparo.update({
      where: { id: disparoId },
      data: { concluirEm },
    });
  } catch (e) {
    logger.error(
      { err: (e as Error).message, disparoId },
      'autocomplete: falha ao gravar concluirEm',
    );
    return;
  }

  agendarTimer(disparoId, delay);
}

/** Registra (ou re-registra) o setTimeout que dispara o complete. */
function agendarTimer(disparoId: string, delayMs: number): void {
  const existing = tasks.get(disparoId);
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    tasks.delete(disparoId);
    void executarComplete(disparoId).catch((e) => {
      logger.error(
        { err: (e as Error).message, disparoId },
        'autocomplete: erro inesperado no executarComplete',
      );
    });
  }, Math.max(0, delayMs));

  tasks.set(disparoId, { disparoId, timer });
}

/**
 * Executa o PUT /complete para um disparo específico.
 * Atualiza Disparo com resultado + detecção indireta de resposta.
 */
async function executarComplete(disparoId: string): Promise<void> {
  const cfg = loadConfig();
  const disparo = await prisma.disparo.findUnique({
    where: { id: disparoId },
    select: {
      id: true,
      createdAt: true,
      atomosSessionId: true,
      concluidoEm: true,
    },
  });

  if (!disparo) {
    logger.warn({ disparoId }, 'autocomplete: disparo não encontrado');
    return;
  }
  if (disparo.concluidoEm) {
    logger.info({ disparoId }, 'autocomplete: disparo já concluído, pulando');
    return;
  }
  if (!disparo.atomosSessionId) {
    logger.info({ disparoId }, 'autocomplete: sem sessionId, marcando como concluído (skip)');
    await prisma.disparo.update({
      where: { id: disparoId },
      data: { concluidoEm: new Date(), concluidoOk: false, concluidoResponse: null },
    });
    return;
  }

  const result = await completeSession(disparo.atomosSessionId, {
    reactivateOnNewMessage: cfg.ATOMOS_AUTOCOMPLETE_REACTIVATE,
    stopBotInExecution:     cfg.ATOMOS_AUTOCOMPLETE_STOP_BOT,
  });

  // Detecção indireta de resposta:
  // lastMessageIn no PublicSessionDTO retornado, se posterior ao createdAt do disparo,
  // significa que o prestador respondeu durante a janela de espera.
  let respostaDetectada: boolean | null = null;
  if (result.ok && typeof result.response === 'object' && result.response !== null) {
    const dto = result.response as { lastMessageIn?: string | null };
    if (dto.lastMessageIn) {
      const lastIn = new Date(dto.lastMessageIn);
      if (!Number.isNaN(lastIn.getTime())) {
        respostaDetectada = lastIn.getTime() > disparo.createdAt.getTime();
      }
    } else {
      respostaDetectada = false;
    }
  }

  await prisma.disparo.update({
    where: { id: disparoId },
    data: {
      concluidoEm:        new Date(),
      concluidoOk:        result.ok,
      concluidoHttpStatus: result.status,
      // LGPD: PublicSessionDTO contém contactDetails.phonenumber — redactar.
      concluidoResponse:  safeJson(redactPayload(result.response)),
      respostaDetectada,
    },
  });

  logger.info(
    {
      disparoId,
      sessionId: disparo.atomosSessionId,
      ok: result.ok,
      httpStatus: result.status,
      respostaDetectada,
      elapsedMs: result.elapsedMs,
    },
    'autocomplete: complete executado',
  );
}

/**
 * Executado no boot do servidor (instrumentation): varre disparos com
 * `concluirEm <= now` e `concluidoEm IS NULL` e dispara complete imediato;
 * para os com `concluirEm > now`, reagenda o setTimeout para o tempo restante.
 */
export async function bootRecovery(): Promise<{ pendentes: number; reagendados: number }> {
  const cfg = loadConfig();
  if (!cfg.ATOMOS_AUTOCOMPLETE_ENABLED) {
    return { pendentes: 0, reagendados: 0 };
  }

  const now = Date.now();
  const pendentes = await prisma.disparo.findMany({
    where: {
      concluirEm:  { not: null },
      concluidoEm: null,
    },
    select: { id: true, concluirEm: true },
  });

  let reagendados = 0;
  let imediatos = 0;
  for (const d of pendentes) {
    if (!d.concluirEm) continue;
    const delta = d.concluirEm.getTime() - now;
    if (delta <= 0) {
      // Já passou — dispara imediatamente.
      void executarComplete(d.id).catch((e) => {
        logger.error(
          { err: (e as Error).message, disparoId: d.id },
          'autocomplete: erro no boot recovery (imediato)',
        );
      });
      imediatos++;
    } else {
      agendarTimer(d.id, delta);
      reagendados++;
    }
  }

  if (pendentes.length > 0) {
    logger.info(
      { total: pendentes.length, reagendados, imediatos },
      'autocomplete: boot recovery',
    );
  }

  return { pendentes: pendentes.length, reagendados };
}

function safeJson(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  try {
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}
