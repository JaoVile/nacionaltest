import pino from 'pino';
import { loadConfig } from './config';

const cfg = loadConfig();

/**
 * Paths a redactar nos logs (LGPD): tokens em headers, telefones, payloads.
 * `*.` casa qualquer chave intermediária. Ver pino docs/redact.
 */
const REDACT_PATHS = [
  // Tokens / headers de auth
  '*.token',
  '*.Authorization',
  '*.authorization',
  'headers.authorization',
  'headers.Authorization',

  // Telefones / destinatários
  '*.to',
  '*.from',
  '*.phone',
  '*.phoneNumber',
  '*.telefone',
  '*.destinoReal',
  '*.destinoEfetivo',
  '*.sentPayload.to',
  '*.payload.to',
  'request.to',
  'response.to',
];

export const logger = pino({
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  ...(cfg.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
        },
      }
    : { level: 'info' }),
});
