import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { format, subDays } from 'date-fns';
import { loadConfig } from '../src/config';
import { logger } from '../src/logger';
import { fetchAtendimentos } from '../src/devsul/client';

/**
 * Script ad-hoc para sondar a API da DevSul e gravar um exemplo de resposta
 * em `tmp/devsul_sample.json`. Útil para travar o schema de mapeamento.
 *
 * Uso:  npm run probe
 */
async function main() {
  const cfg = loadConfig();
  const hoje = new Date();
  const inicio = subDays(hoje, cfg.DEVSUL_LOOKBACK_DAYS);

  const req = {
    DataInicial: format(inicio, 'yyyy-MM-dd'),
    DataFinal:   format(hoje,  'yyyy-MM-dd'),
    Situacoes:   cfg.DEVSUL_SITUACOES,
  };

  logger.info({ req }, 'probe-devsul: chamando API');
  const atendimentos = await fetchAtendimentos(req);

  const outDir = path.resolve(process.cwd(), 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'devsul_sample.json');
  fs.writeFileSync(outFile, JSON.stringify(atendimentos, null, 2), 'utf-8');

  logger.info({ outFile, total: atendimentos.length }, 'probe-devsul: arquivo salvo');
}

main().catch((err) => {
  logger.fatal({ err: (err as Error).message }, 'probe-devsul falhou');
  process.exit(1);
});
