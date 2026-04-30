import pino from 'pino';
import pretty from 'pino-pretty';
import { config } from './config';

const isDev = config.NODE_ENV !== 'production';

const stream = isDev
  ? pretty({
      colorize: true,
      translateTime: 'HH:MM:ss.l',
      ignore: 'pid,hostname',
      messageFormat: '[{module}] {msg}',
    })
  : process.stdout;

const root = pino(
  {
    level: config.LOG_LEVEL,
    base: undefined,
    redact: {
      paths: [
        '*.privateKey',
        '*.apiKey',
        '*.secret',
        '*.passphrase',
        '*.token',
        'privateKey',
        'apiKey',
        'secret',
        'passphrase',
        'token',
      ],
      censor: '[REDACTED]',
    },
  },
  stream,
);

export const logger = root;
export const createLogger = (module: string): pino.Logger => root.child({ module });
