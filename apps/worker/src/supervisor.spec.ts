import { describe, it, expect } from 'vitest';
import { loadWorkerConfig } from './config.js';
import { WorkerSupervisor } from './supervisor.js';

describe('Worker Supervisor', () => {
  it('loads default configuration when environment variables are unset', () => {
    const config = loadWorkerConfig();
    expect(config.queueName).toBeDefined();
    expect(config.concurrency).toBeGreaterThan(0);
    expect(config.redisUrl).toBeDefined();
  });

  it('instantiates WorkerSupervisor with valid configuration', () => {
    const config = loadWorkerConfig();
    const supervisor = new WorkerSupervisor(config);
    expect(supervisor).toBeDefined();
    expect(supervisor.isRunning()).toBe(false);
  });
});
