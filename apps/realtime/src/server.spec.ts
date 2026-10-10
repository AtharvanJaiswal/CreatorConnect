import { describe, it, expect, afterEach } from 'vitest';
import { createRealtimeServer } from './server.js';

describe('Realtime Service Server & Health Model', () => {
  let instance: Awaited<ReturnType<typeof createRealtimeServer>> | null = null;

  afterEach(async () => {
    if (instance) {
      await instance.close();
      instance = null;
    }
  });

  it('initializes in local in-memory fallback mode and reports health', async () => {
    instance = await createRealtimeServer();
    const response = await instance.app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.status).toBe('ok');
    expect(data.connections).toBe(0);
    expect(data.uptime).toBeGreaterThanOrEqual(0);
    expect(data.realtime).toEqual({ status: 'ready' });
    expect(data.redisAdapter).toEqual({
      status: 'disconnected',
      mode: 'in-memory-fallback',
      clusterOperationsAvailable: false,
    });
  });

  it('connects to real Redis and reports operational cluster readiness in /health', async () => {
    instance = await createRealtimeServer({
      redisUrl: process.env.REDIS_URL || 'redis://:redis_local_password@localhost:6379/0',
    });

    const response = await instance.app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.status).toBe('ok');
    expect(data.realtime.status).toBe('ready');
    expect(data.redisAdapter.status).toBe('ready');
    expect(data.redisAdapter.mode).toBe('redis-adapter');
    expect(data.redisAdapter.clusterOperationsAvailable).toBe(true);
  });

  it('reports degraded health state when Redis connection fails', async () => {
    // Attempting connection to an invalid/unreachable Redis port
    instance = await createRealtimeServer({
      redisUrl: 'redis://127.0.0.1:59999/0',
    });

    const response = await instance.app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.status).toBe('degraded');
    expect(data.realtime.status).toBe('ready');
    expect(data.redisAdapter.mode).toBe('in-memory-fallback');
    expect(data.redisAdapter.clusterOperationsAvailable).toBe(false);
  });
});
