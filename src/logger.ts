import pino from 'pino';
import { loadConfig } from './config';

const cfg = loadConfig();

export const logger = pino(
  cfg.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
        },
      }
    : { level: 'info' },
);
