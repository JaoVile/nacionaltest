/**
 * Setup global do Vitest. Roda antes de cada arquivo de teste.
 *
 * Carrega `.env` para que módulos que chamam `loadConfig()` na inicialização
 * (ex: src/logger.ts) não quebrem. Se algum env obrigatório faltar, define
 * defaults seguros — testes nunca devem disparar para Atomos/DevSul reais.
 */
import 'dotenv/config';

// Defaults pra rodar testes em qualquer ambiente — não fazem chamada externa.
process.env.DEVSUL_API_URL          ??= 'https://example.invalid/devsul';
process.env.DEVSUL_BEARER_TOKEN     ??= 'test-token';
process.env.ATOMOS_BASE_URL         ??= 'https://example.invalid/atomos';
process.env.ATOMOS_SEND_ENDPOINT    ??= '/chat/v1/message/send';
process.env.TEST_PHONE_NUMBER       ??= '5581999430696';
process.env.TEST_MODE               ??= 'true';
process.env.NODE_ENV                ??= 'test';
