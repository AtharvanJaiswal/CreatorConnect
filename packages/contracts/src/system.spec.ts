import { describe, it, expect } from 'vitest';
import { Value } from '@sinclair/typebox/value';
import '@creatorconnect/validation';
import { HealthCheckResponseSchema, ReadinessCheckResponseSchema } from './system.js';

describe('System Contracts', () => {
  it('validates a compliant HealthCheckResponse', () => {
    const validHealth = {
      status: 'ok',
      timestamp: '2026-09-13T21:00:00.000Z',
      service: 'api',
      version: '0.1.0',
      uptimeSeconds: 120,
    };
    expect(Value.Check(HealthCheckResponseSchema, validHealth)).toBe(true);
  });

  it('validates a compliant ReadinessCheckResponse', () => {
    const validReadiness = {
      status: 'ready',
      checks: {
        database: 'connected',
        redis: 'connected',
      },
      timestamp: '2026-09-13T21:00:00.000Z',
    };
    expect(Value.Check(ReadinessCheckResponseSchema, validReadiness)).toBe(true);
  });
});
