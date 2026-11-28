import type { LoggerOptions } from 'pino';

export const loggerConfig: LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.secret',
      '*.clientSecret',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.apiKey',
      '*.authorization',
    ],
    remove: true,
  },
};
