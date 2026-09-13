import { Type, type Static } from '@sinclair/typebox';

/**
 * Core system endpoints contract schemas.
 */

export const HealthCheckResponseSchema = Type.Object({
  status: Type.Literal('ok'),
  timestamp: Type.String({ format: 'date-time' }),
  service: Type.String(),
  version: Type.String(),
  uptimeSeconds: Type.Number(),
});
export type HealthCheckResponse = Static<typeof HealthCheckResponseSchema>;

export const ReadinessCheckResponseSchema = Type.Object({
  status: Type.Union([Type.Literal('ready'), Type.Literal('not_ready')]),
  checks: Type.Object({
    database: Type.Union([
      Type.Literal('connected'),
      Type.Literal('disconnected'),
      Type.Literal('not_configured'),
    ]),
    redis: Type.Union([
      Type.Literal('connected'),
      Type.Literal('disconnected'),
      Type.Literal('not_configured'),
    ]),
  }),
  timestamp: Type.String({ format: 'date-time' }),
});
export type ReadinessCheckResponse = Static<typeof ReadinessCheckResponseSchema>;
