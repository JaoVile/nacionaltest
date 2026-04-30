/**
 * Política de retenção LGPD — purga periódica.
 *
 * Bases:
 * - `Disparo` (+ cascade `StatusEvento`): 180 dias.
 * - `AuditLog`: 365 dias (auditoria é mantida mais tempo por compliance interno).
 *
 * Justificativa: histórico de cobrança útil pra disputas/conferência costuma
 * ter validade ≤ 6 meses. AuditLog não contém PII em claro (só hash) então
 * pode ficar mais tempo.
 *
 * Roda 1x por dia via cron (ver lib/scheduler.ts::aplicarPurga). Boot recovery
 * em instrumentation-node.ts pra não perder rodadas.
 */
import { prisma } from './db';
import { logger } from '../src/logger';

export const RETENCAO_DISPAROS_DIAS = 180;
export const RETENCAO_AUDIT_DIAS    = 365;

export interface PurgaResultado {
  disparosDeletados: number;
  statusEventosDeletados: number;
  auditLogsDeletados: number;
  cortes: {
    disparoAntesDe: string; // ISO
    auditAntesDe: string;
  };
  dryRun: boolean;
}

/**
 * Executa a purga conforme retenção definida. Idempotente.
 *
 * @param opts.dryRun - se true, conta sem deletar.
 */
export async function purgarLgpd(opts: { dryRun?: boolean } = {}): Promise<PurgaResultado> {
  const dryRun = !!opts.dryRun;
  const now = Date.now();
  const corteDisparo = new Date(now - RETENCAO_DISPAROS_DIAS * 86400 * 1000);
  const corteAudit   = new Date(now - RETENCAO_AUDIT_DIAS    * 86400 * 1000);

  if (dryRun) {
    const [disparos, eventos, audit] = await Promise.all([
      prisma.disparo.count({ where: { createdAt: { lt: corteDisparo } } }),
      prisma.statusEvento.count({ where: { disparo: { createdAt: { lt: corteDisparo } } } }),
      prisma.auditLog.count({ where: { createdAt: { lt: corteAudit } } }),
    ]);
    return {
      disparosDeletados: disparos,
      statusEventosDeletados: eventos,
      auditLogsDeletados: audit,
      cortes: {
        disparoAntesDe: corteDisparo.toISOString(),
        auditAntesDe:   corteAudit.toISOString(),
      },
      dryRun: true,
    };
  }

  // StatusEvento tem onDelete: Cascade no schema, mas conta-se antes pra reportar.
  const eventosCount = await prisma.statusEvento.count({
    where: { disparo: { createdAt: { lt: corteDisparo } } },
  });

  const [disparosResult, auditResult] = await Promise.all([
    prisma.disparo.deleteMany({ where: { createdAt: { lt: corteDisparo } } }),
    prisma.auditLog.deleteMany({ where: { createdAt: { lt: corteAudit } } }),
  ]);

  const result: PurgaResultado = {
    disparosDeletados: disparosResult.count,
    statusEventosDeletados: eventosCount,
    auditLogsDeletados: auditResult.count,
    cortes: {
      disparoAntesDe: corteDisparo.toISOString(),
      auditAntesDe:   corteAudit.toISOString(),
    },
    dryRun: false,
  };

  logger.info(result, 'lgpd: purga executada');
  return result;
}
