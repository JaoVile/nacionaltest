import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // DevSul
  DEVSUL_API_URL: z.string().url(),
  DEVSUL_BEARER_TOKEN: z.string().min(1, 'DEVSUL_BEARER_TOKEN obrigatório'),

  // AtomosChat — credenciais só exigidas em tempo de envio (ver assertAtomosReady).
  ATOMOS_BASE_URL: z.string().url(),
  ATOMOS_SEND_ENDPOINT: z.string().min(1),
  ATOMOS_BEARER_TOKEN: z.string().default(''),
  ATOMOS_CHANNEL_ID: z.string().default(''),
  ATOMOS_TEMPLATE_ID: z.string().default(''),

  // Teste / execução
  TEST_MODE: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  TEST_PHONE_NUMBER: z.string().regex(/^\d{10,15}$/, 'TEST_PHONE_NUMBER em E.164 sem "+" (só dígitos)'),

  // Janela de busca padrão (dias atrás a partir de hoje)
  DEVSUL_LOOKBACK_DAYS: z.coerce.number().int().positive().default(30),
  DEVSUL_SITUACOES: z.string().default('1282'),

  // Rate limit entre envios (ms)
  SEND_DELAY_MS: z.coerce.number().int().nonnegative().default(1000),

  // Limite de envios por rodada. 0 = sem limite. Útil para testes iniciais.
  MAX_SENDS_PER_RUN: z.coerce.number().int().nonnegative().default(0),

  // Agendamento (opcional). Ex: "0 9 * * *" = todo dia às 09:00
  CRON_SCHEDULE: z.string().optional(),
});

export type AppConfig = z.infer<typeof schema>;

let cached: AppConfig | null = null;

export function clearConfigCache(): void {
  cached = null;
}

export function loadConfig(): AppConfig {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Config inválida (.env):\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * Valida credenciais da Atomos só na hora de disparar. Scripts de sondagem
 * (ex: probe-devsul) não precisam de Atomos configurado.
 */
export function assertAtomosReady(cfg: AppConfig): void {
  const faltando: string[] = [];
  if (!cfg.ATOMOS_BEARER_TOKEN) faltando.push('ATOMOS_BEARER_TOKEN');
  if (!cfg.ATOMOS_CHANNEL_ID)   faltando.push('ATOMOS_CHANNEL_ID');
  if (!cfg.ATOMOS_TEMPLATE_ID)  faltando.push('ATOMOS_TEMPLATE_ID');
  if (faltando.length) {
    throw new Error(
      `Credenciais do AtomosChat ausentes no .env: ${faltando.join(', ')}`,
    );
  }
}
