import 'dotenv/config';
import cron from 'node-cron';
import { loadConfig } from './config';
import { logger } from './logger';
import { runOnce } from './runner';

async function main() {
  const cfg = loadConfig();
  const args = process.argv.slice(2);
  const forceOnce = args.includes('--once');

  if (forceOnce || !cfg.CRON_SCHEDULE) {
    logger.info('Executando em modo one-shot');
    try {
      await runOnce();
      process.exit(0);
    } catch (err) {
      logger.fatal({ err: (err as Error).message }, 'Erro fatal no runOnce');
      process.exit(1);
    }
  }

  if (!cron.validate(cfg.CRON_SCHEDULE)) {
    logger.fatal({ CRON_SCHEDULE: cfg.CRON_SCHEDULE }, 'CRON_SCHEDULE inválido');
    process.exit(1);
  }

  logger.info({ schedule: cfg.CRON_SCHEDULE, testMode: cfg.TEST_MODE }, 'Agendamento ativo');
  cron.schedule(cfg.CRON_SCHEDULE, () => {
    runOnce().catch((err) =>
      logger.error({ err: (err as Error).message }, 'Rodada agendada falhou'),
    );
  });
}

main().catch((err) => {
  logger.fatal({ err: (err as Error).message }, 'Bootstrap falhou');
  process.exit(1);
});
