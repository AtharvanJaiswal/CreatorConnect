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

  describe('CompositeEventDispatcher Routing & Failure Semantics (Milestone 2C.3)', () => {
    it('successfully dispatches notification-only events without rejection from socketIoDispatcher', async () => {
      runtime = await createWorkerRuntime({
        config,
        logger,
      });

      const event: ClaimedOutboxEvent = {
        id: '01912952-4a00-7000-8000-000000000101',
        eventType: 'project.created.v1',
        aggregateType: 'Project',
        aggregateId: '01912952-4a00-7000-8000-000000000102',
        payload: {
          projectId: '01912952-4a00-7000-8000-000000000102',
          title: 'Brand Campaign',
        },
        attempts: 1,
        createdAt: new Date(),
        claimToken: {
          id: '01912952-4a00-7000-8000-000000000101',
          attempt: 1,
          claimExpiresAt: new Date(Date.now() + 60000),
        },
      };

      const result = await runtime.compositeDispatcher.dispatch(event);

      expect(result.success).toBe(true);
    });

    it('propagates actual failures from notification handler through composite dispatcher', async () => {
      runtime = await createWorkerRuntime({
        config,
        logger,
      });

      // Spy on notificationHandler to simulate a database failure
      vi.spyOn(runtime.notificationHandler, 'dispatch').mockResolvedValueOnce({
        success: false,
        error: 'Database connection lost',
        isTransient: true,
      });

      const event: ClaimedOutboxEvent = {
        id: '01912952-4a00-7000-8000-000000000103',
        eventType: 'project.created.v1',
        aggregateType: 'Project',
        aggregateId: '01912952-4a00-7000-8000-000000000104',
        payload: {
          projectId: '01912952-4a00-7000-8000-000000000104',
        },
        attempts: 1,
        createdAt: new Date(),
        claimToken: {
          id: '01912952-4a00-7000-8000-000000000103',
          attempt: 1,
          claimExpiresAt: new Date(Date.now() + 60000),
        },
      };

      const result = await runtime.compositeDispatcher.dispatch(event);

      expect(result.success).toBe(false);
      expect(result.isTransient).toBe(true);
      expect(result.error).toContain('Database connection lost');
    });

    it('successfully routes message_request.created.v1 through composite dispatcher to socketIoDispatcher', async () => {
      runtime = await createWorkerRuntime({
        config,
        logger,
      });

      const emitted: Array<{ room: string; event: string; payload: any }> = [];
      (runtime.bridge.emitter as any).to = (room: string) => ({
        emit: (event: string, ...args: unknown[]) => {
          emitted.push({ room, event, payload: args[0] });
          return true;
        },
      });

      const senderId = '01912952-4a00-7000-8000-000000000105';
      const recipientId = '01912952-4a00-7000-8000-000000000106';
      const requestId = '01912952-4a00-7000-8000-000000000107';

      const event: ClaimedOutboxEvent = {
        id: '01912952-4a00-7000-8000-000000000108',
        eventType: 'message_request.created.v1',
        aggregateType: 'MessageRequest',
        aggregateId: requestId,
        payload: {
          requestId,
          senderId,
          recipientId,
          initialMessage: 'Secret pitch text',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          createdAt: new Date().toISOString(),
        },
        attempts: 1,
        createdAt: new Date(),
        claimToken: {
          id: '01912952-4a00-7000-8000-000000000108',
          attempt: 1,
          claimExpiresAt: new Date(Date.now() + 60000),
        },
      };

      const result = await runtime.compositeDispatcher.dispatch(event);

      expect(result.success).toBe(true);
      expect(emitted).toHaveLength(1);
      expect(emitted[0].room).toBe(`user:${recipientId}`);
      expect(emitted[0].event).toBe('message_request:created');
      // Privacy: initialMessage must not be leaked into realtime payload
      expect(emitted[0].payload.initialMessage).toBeUndefined();
    });

    it('rejects genuinely unknown events through the composite pipeline', async () => {
      runtime = await createWorkerRuntime({
        config,
        logger,
      });

      const event: ClaimedOutboxEvent = {
        id: '01912952-4a00-7000-8000-000000000109',
        eventType: 'totally.unknown.event.v99',
        aggregateType: 'Unknown',
        aggregateId: '01912952-4a00-7000-8000-000000000110',
        payload: { foo: 'bar' },
        attempts: 1,
        createdAt: new Date(),
        claimToken: {
          id: '01912952-4a00-7000-8000-000000000109',
          attempt: 1,
          claimExpiresAt: new Date(Date.now() + 60000),
        },
      };

      const result = await runtime.compositeDispatcher.dispatch(event);

      expect(result.success).toBe(false);
      expect(result.isTransient).toBe(false);
      expect(result.error).toContain('Unsupported outbox event type: totally.unknown.event.v99');
    });
  });
});
