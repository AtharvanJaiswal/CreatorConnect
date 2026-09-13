import type { LoggerOptions } from 'pino';

export const loggerConfig: LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.secret',
      'body.token',
      'body.apiKey',
    ],
    remove: true,
  },
};
