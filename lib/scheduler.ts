import cron, { ScheduledTask } from 'node-cron';
import { logger } from '../src/logger';
import { prisma } from './db';
import { executarAgendamento } from './disparo-runner';
import { purgarLgpd } from './purga';

/**
 * Scheduler singleton — sobrevive HMR via globalThis.
 * Lê configuração de Prisma `Agendamento` (id='default') e registra um cron.
 * Re-registra automaticamente quando `aplicarAgendamento` é chamado após mudança.
 */

interface SchedulerState {
  task: ScheduledTask | null;
  cronExpr: string | null;
  ativo: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var __nacionalScheduler: SchedulerState | undefined;
  // eslint-disable-next-line no-var
  var __nacionalPurgaTask: ScheduledTask | undefined;
}

function state(): SchedulerState {
  if (!globalThis.__nacionalScheduler) {
    globalThis.__nacionalScheduler = { task: null, cronExpr: null, ativo: false };
  }
  return globalThis.__nacionalScheduler;
}

export function montarCronExpr(diasSemana: string, hora: number, minuto: number): string {
  // node-cron: minute hour day-of-month month day-of-week
  // diasSemana é CSV no padrão cron (0=dom .. 6=sab). Ex: "1,2,3,4,5"
  const dias = diasSemana.trim() || '*';
  return `${minuto} ${hora} * * ${dias}`;
}

/**
 * Calcula a próxima ocorrência (timezone do servidor) sem dependência externa.
 * Retorna null quando não há dias selecionados.
 */
export function proximaExecucao(diasSemana: string, hora: number, minuto: number, base = new Date()): Date | null {
  const dias = diasSemana
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  if (dias.length === 0) return null;

  for (let i = 0; i < 14; i++) {
    const candidate = new Date(base);
    candidate.setDate(candidate.getDate() + i);
    candidate.setHours(hora, minuto, 0, 0);
    if (!dias.includes(candidate.getDay())) continue;
    if (candidate > base) return candidate;
  }
  return null;
}

async function rodarAgendado(): Promise<void> {
  let agendamento;
  try {
    agendamento = await prisma.agendamento.findUnique({ where: { id: 'default' } });
  } catch (e) {
    logger.error({ err: (e as Error).message }, 'scheduler: falha ao ler Agendamento');
    return;
  }
  if (!agendamento || !agendamento.ativo) {
    logger.warn('scheduler: cron disparou mas Agendamento está inativo — pulando');
    return;
  }

  const inicio = Date.now();
  logger.info({ modo: agendamento.modo }, 'scheduler: rodando execução agendada');

  try {
    const placasIds = agendamento.placas
      ? (JSON.parse(agendamento.placas) as string[])
      : undefined;

    const resumo = await executarAgendamento({
      modo: agendamento.modo === 'selecionados' ? 'selecionados' : 'massa',
      placasIds,
      origem: 'AUTO',
    });

    await prisma.agendamento.update({
      where: { id: 'default' },
      data: {
        ultimaExec:  new Date(),
        ultimoTotal: resumo.processados,
        ultimoOk:    resumo.enviadosOk,
        ultimoFalha: resumo.falhas,
        ultimoErro:  null,
      },
    });
    logger.info({ resumo, durMs: Date.now() - inicio }, 'scheduler: execução concluída');
  } catch (e) {
    const msg = (e as Error).message;
    logger.error({ err: msg }, 'scheduler: execução agendada falhou');
    try {
      await prisma.agendamento.update({
        where: { id: 'default' },
        data: { ultimaExec: new Date(), ultimoErro: msg.slice(0, 1000) },
      });
    } catch {/* ignora */}
  }
}

/**
 * Lê config atual do DB e registra/desregistra o cron conforme `ativo`.
 * Chamada no boot (instrumentation) e após cada PATCH em /api/agendamento.
 */
export async function aplicarAgendamento(): Promise<{ ativo: boolean; cronExpr: string | null }> {
  const s = state();

  let cfg;
  try {
    cfg = await prisma.agendamento.findUnique({ where: { id: 'default' } });
  } catch (e) {
    logger.error({ err: (e as Error).message }, 'scheduler: erro lendo agendamento — desativando');
    desligar();
    return { ativo: false, cronExpr: null };
  }

  if (!cfg || !cfg.ativo) {
    desligar();
    return { ativo: false, cronExpr: null };
  }

  const expr = montarCronExpr(cfg.diasSemana, cfg.hora, cfg.minuto);
  if (!cron.validate(expr)) {
    logger.error({ expr }, 'scheduler: cron expression inválida — desativando');
    desligar();
    return { ativo: false, cronExpr: null };
  }

  if (s.task && s.cronExpr === expr && s.ativo) {
    return { ativo: true, cronExpr: expr };
  }

  desligar();
  const task = cron.schedule(expr, () => {
    rodarAgendado().catch((e) =>
      logger.error({ err: (e as Error).message }, 'scheduler: rodarAgendado throw inesperado'),
    );
  });
  s.task = task;
  s.cronExpr = expr;
  s.ativo = true;
  logger.info({ expr }, 'scheduler: cron registrado');
  return { ativo: true, cronExpr: expr };
}

export function desligar(): void {
  const s = state();
  if (s.task) {
    try { s.task.stop(); } catch {/* ignora */}
    try { (s.task as { destroy?: () => void }).destroy?.(); } catch {/* ignora */}
  }
  s.task = null;
  s.cronExpr = null;
  s.ativo = false;
}

export function statusAtual(): { ativo: boolean; cronExpr: string | null } {
  const s = state();
  return { ativo: s.ativo, cronExpr: s.cronExpr };
}

/** Dispara uma rodada agora, sem esperar o cron. Usado pelo botão "Disparar agora". */
export async function dispararAgora(): Promise<void> {
  await rodarAgendado();
}

/**
 * Cron diário de retenção LGPD — roda às 03:00 da hora local do servidor.
 * Idempotente: re-registrar não duplica. Singleton via globalThis.
 *
 * Decidi por timer separado (`__nacionalPurgaTask`) para não acoplar com
 * o ciclo do Agendamento configurável pela UI — purga é política da casa,
 * não opcional.
 */
const PURGA_CRON_EXPR = '0 3 * * *';

export function aplicarPurga(): { ativo: boolean; cronExpr: string } {
  if (globalThis.__nacionalPurgaTask) {
    return { ativo: true, cronExpr: PURGA_CRON_EXPR };
  }

  const task = cron.schedule(PURGA_CRON_EXPR, () => {
    purgarLgpd().catch((e) =>
      logger.error({ err: (e as Error).message }, 'lgpd: purga agendada falhou'),
    );
  });
  globalThis.__nacionalPurgaTask = task;
  logger.info({ expr: PURGA_CRON_EXPR }, 'lgpd: cron de purga registrado');
  return { ativo: true, cronExpr: PURGA_CRON_EXPR };
}
