import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import { loadConfig } from '../src/config';
import { logger } from '../src/logger';

/**
 * Sonda GET /devsul/integracao/atendimentos/regionais
 * Grava amostra em tmp/devsul_regionais.json para travar o shape
 * (esperado: array de { DocumentoCliente, NomeCliente, ... }).
 */
async function main() {
  const cfg = loadConfig();
  const base = cfg.DEVSUL_API_URL.replace(/\/atendimentos\/resumo\/?$/, '');
  const url = `${base}/atendimentos/regionais`;

  logger.info({ url }, 'probe-regionais: chamando API');
  const { data, status } = await axios.get(url, {
    timeout: 30_000,
    headers: { Authorization: `Bearer ${cfg.DEVSUL_BEARER_TOKEN}` },
  });

  const outDir = path.resolve(process.cwd(), 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'devsul_regionais.json');
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2), 'utf-8');

  logger.info(
    {
      outFile,
      status,
      total: Array.isArray(data) ? data.length : null,
      preview: JSON.stringify(data).slice(0, 300),
    },
    'probe-regionais: arquivo salvo',
  );
}

main().catch((err) => {
  logger.fatal({ err: (err as Error).message }, 'probe-regionais falhou');
  process.exit(1);
});
