import { describe, it, expect, afterEach } from 'vitest';
import { createWorkerRuntime, type WorkerRuntime } from '../main.js';
import { loadWorkerConfig } from '../config.js';
import pino from 'pino';

describe('Worker Composition Root (createWorkerRuntime)', () => {
  let runtime: WorkerRuntime | null = null;
  const logger = pino({ level: 'silent' });
  const config = loadWorkerConfig();

  afterEach(async () => {
    if (runtime) {
      await runtime.stop();
      runtime = null;
    }
  });

  it('correctly wires all dispatchers into CompositeEventDispatcher', async () => {
    runtime = await createWorkerRuntime({
      config,
      logger,
    });

    expect(runtime.bridge).toBeDefined();
    expect(runtime.supervisor).toBeDefined();
    expect(runtime.outboxProcessor).toBeDefined();
    expect(runtime.compositeDispatcher).toBeDefined();
    expect(runtime.blockEvictionDispatcher).toBeDefined();
    expect(runtime.notificationHandler).toBeDefined();
    expect(runtime.socketIoDispatcher).toBeDefined();

    // Verify dispatcher wiring
    const dispatchers = (runtime.compositeDispatcher as any).dispatchers;
    expect(dispatchers).toHaveLength(3);
    expect(dispatchers[0]).toBe(runtime.blockEvictionDispatcher);
    expect(dispatchers[1]).toBe(runtime.notificationHandler);
    expect(dispatchers[2]).toBe(runtime.socketIoDispatcher);

    // Verify evictionService is wired to blockEvictionDispatcher
    expect((runtime.blockEvictionDispatcher as any).evictionService).toBe(
      runtime.bridge.evictionService,
    );

    // Verify emitter is wired to socketIoDispatcher
    expect((runtime.socketIoDispatcher as any).emitter).toBe(runtime.bridge.emitter);
  });

  it('starts and stops gracefully closing background resources', async () => {
    runtime = await createWorkerRuntime({
      config,
      logger,
    });

    await runtime.start();

    // Verify bridge is operational
    const bridgeHealth = runtime.bridge.getHealth();
    expect(bridgeHealth.clusterReady).toBe(true);

    // Verify outbox processor is running
    const status = runtime.outboxProcessor.getStatus();
    expect(status.isRunning).toBe(true);

    // Clean shutdown
    await runtime.stop();
    const stoppedStatus = runtime.outboxProcessor.getStatus();
    expect(stoppedStatus.isRunning).toBe(false);

    const stoppedBridgeHealth = runtime.bridge.getHealth();
    expect(stoppedBridgeHealth.clusterReady).toBe(false);
  });
});
