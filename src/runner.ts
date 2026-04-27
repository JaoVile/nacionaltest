import { format, subDays } from 'date-fns';
import { assertAtomosReady, loadConfig } from './config';
import { logger } from './logger';
import { fetchAtendimentos } from './devsul/client';
import { getCnpjPorRegional } from './devsul/regionais';
import { sendTemplate, getMessageStatus } from './atomos/client';
import { normalizarAtendimento, toTemplateValues } from './mapper';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RunSummary {
  total: number;
  enviados: number;
  falhas: number;
  ignorados: number;
}

export async function runOnce(): Promise<RunSummary> {
  const cfg = loadConfig();
  assertAtomosReady(cfg);

  const today = new Date();
  const inicio = subDays(today, cfg.DEVSUL_LOOKBACK_DAYS);

  const req = {
    DataInicial: format(inicio, 'yyyy-MM-dd'),
    DataFinal:   format(today,  'yyyy-MM-dd'),
    Situacoes:   cfg.DEVSUL_SITUACOES,
  };

  logger.info({ req, testMode: cfg.TEST_MODE }, 'Iniciando rodada de cobrança');

  const atendimentos = await fetchAtendimentos(req);
  const cnpjMap = await getCnpjPorRegional();
  const summary: RunSummary = { total: atendimentos.length, enviados: 0, falhas: 0, ignorados: 0 };
  let tentativas = 0;

  for (const bruto of atendimentos) {
    if (cfg.MAX_SENDS_PER_RUN > 0 && tentativas >= cfg.MAX_SENDS_PER_RUN) {
      logger.info({ limite: cfg.MAX_SENDS_PER_RUN, tentativas }, 'MAX_SENDS_PER_RUN atingido — encerrando rodada');
      break;
    }
    const norm = normalizarAtendimento(bruto);
    if (!norm) {
      summary.ignorados++;
      logger.warn({ preview: JSON.stringify(bruto).slice(0, 200) }, 'Atendimento ignorado (campos ausentes no mapeamento)');
      continue;
    }

    if (!norm.cnpj) norm.cnpj = cnpjMap.get(norm.associacao) ?? '';

    const destino = cfg.TEST_MODE ? cfg.TEST_PHONE_NUMBER : norm.telefone;
    const values = toTemplateValues(norm);

    logger.info(
      {
        id: norm.id,
        destinoReal: norm.telefone,
        destinoEfetivo: destino,
        testMode: cfg.TEST_MODE,
        values,
      },
      'Disparando template',
    );

    tentativas++;
    const result = await sendTemplate({ to: destino, values, senderId: norm.id });

    if (result.ok) {
      summary.enviados++;
      logger.info(
        { id: norm.id, status: result.status, response: result.response },
        'Envio OK (aceito pela fila)',
      );
      // Consulta status real ~2s depois para distinguir QUEUED de SENT/FAILED.
      const resp = result.response as { id?: string } | null;
      const messageId = typeof resp?.id === 'string' ? resp.id : null;
      if (messageId) {
        await sleep(2000);
        const check = await getMessageStatus(messageId);
        logger.info(
          { id: norm.id, messageId, statusAtomos: check?.status, failureReason: check?.failureReason },
          'Status pós-envio',
        );
      }
    } else {
      summary.falhas++;
      logger.error({ id: norm.id, status: result.status, error: result.error, response: result.response }, 'Envio FALHOU');
    }

    await sleep(cfg.SEND_DELAY_MS);
  }

  logger.info({ summary }, 'Rodada concluída');
  return summary;
}
