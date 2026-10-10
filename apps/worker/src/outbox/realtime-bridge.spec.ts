import { describe, it, expect, afterEach } from 'vitest';
import { RealtimeBridge } from './realtime-bridge.js';
import pino from 'pino';

describe('RealtimeBridge (Worker Redis Emitter Bridge)', () => {
  let bridge: RealtimeBridge | null = null;
  const logger = pino({ level: 'silent' });
  const redisUrl = process.env.REDIS_URL || 'redis://:redis_local_password@localhost:6379/0';

  afterEach(async () => {
    if (bridge) {
      await bridge.close();
      bridge = null;
    }
  });

  it('initializes and reports initial disconnected health before connect()', () => {
    bridge = new RealtimeBridge({ redisUrl, logger });
    const health = bridge.getHealth();

    expect(health.redisStatus).toBe('wait');
    expect(health.clusterReady).toBe(false);
    expect(health.status).toBe('disconnected');
    expect(bridge.emitter).toBeDefined();
    expect(bridge.evictionService).toBeDefined();
  });

  it('connects to real Redis cluster and transitions to connected health', async () => {
    bridge = new RealtimeBridge({ redisUrl, logger });
    await bridge.connect();

    const health = bridge.getHealth();
    expect(health.status).toBe('connected');
    expect(health.redisStatus).toBe('ready');
    expect(health.clusterReady).toBe(true);
    expect(health.timestamp).toBeDefined();
  });

  it('closes cleanly and updates health state', async () => {
    bridge = new RealtimeBridge({ redisUrl, logger });
    await bridge.connect();
    await bridge.close();

    const health = bridge.getHealth();
    expect(health.status).toBe('disconnected');
    expect(health.clusterReady).toBe(false);
  });

  it('can broadcast room eviction command via emitter without throwing', async () => {
    bridge = new RealtimeBridge({ redisUrl, logger });
    await bridge.connect();

    // Invoking emitter room control
    expect(() => {
      bridge!.emitter.in('user:test-user-id').socketsLeave('conversation:test-room');
      bridge!.emitter
        .to('user:test-user-id')
        .emit('conversation:blocked', { conversationId: 'test-room' });
    }).not.toThrow();
  });
});
