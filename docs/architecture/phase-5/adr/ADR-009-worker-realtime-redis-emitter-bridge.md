# ADR-009: Worker-to-Realtime Redis Emitter Bridge & Multi-Node Cluster Hardening

## Status

Accepted

## Context

In Phase 5, the transactional outbox pattern guarantees durable, ordered persistence of domain events (e.g. `message.created`, `user.blocked`). However, background processing of these events occurs within an independent standalone process (`apps/worker`), whereas client WebSockets connect to independently running `apps/realtime` cluster nodes.

The Phase 5 audit identified an architectural production gap:

1. `BlockEvictionDispatcher` was instantiated in `apps/worker` without a production `IBlockEvictionService`.
2. `SocketIoEventDispatcher` was not composed into the worker's production `CompositeEventDispatcher`.
3. The worker had no cross-process transport mechanism to instruct remote Socket.IO nodes to broadcast new messages or evict blocked users' sockets from conversation rooms.
4. Realtime nodes did not report Redis adapter connectivity in their `/health` endpoint, making cluster partition and fallback states opaque.

## Decision

1. **Emitter Selection:** Install and adopt `@socket.io/redis-emitter@^5.1.0` exclusively in `@creatorconnect/worker`.
   - Verified that `@socket.io/redis-emitter` v5.1.0 communicates directly with the `@socket.io/redis-adapter` protocol v8.3.0 already installed in `apps/realtime`.
   - Verified that `emitter.in(userRoom).socketsLeave(conversationRoom)` publishes standard `RequestType.REMOTE_LEAVE` requests to the Redis request channel, natively processed by the adapter's `delSockets()` on every cluster node. This eliminates the need for an unverified, ad-hoc custom Redis pub/sub command protocol.
2. **Bridge Abstraction:** Introduce `RealtimeBridge` in `apps/worker/src/outbox/realtime-bridge.ts`, wrapping the dedicated `ioredis` publisher and `Emitter`. Expose lifecycle (`close()`), readiness (`getHealth()`), and event dispatch methods.
3. **Remote Eviction Implementation:** Implement `RedisBlockEvictionService` conforming to `IBlockEvictionService`, utilizing `Emitter.in('user:' + id).socketsLeave('conversation:' + convId)` to remotely evict active sockets across all cluster nodes, and emitting minimal `conversation:blocked` alerts to user-scoped rooms.
4. **Production Composition Root:** Refactor `apps/worker/src/main.ts` with `createWorkerRuntime()`, composing `CompositeEventDispatcher` with all three dispatchers:
   - `NotificationEventHandler`
   - `SocketIoEventDispatcher` (backed by `RealtimeBridge`)
   - `BlockEvictionDispatcher` (backed by `RedisBlockEvictionService`)
5. **Realtime Health & Observability:** Enrich `apps/realtime/src/server.ts` `/health` endpoint to reflect:
   - Process status: `ready`
   - `redisAdapter`: `{ status: 'connected' | 'connecting' | 'disconnected', mode: 'cluster' | 'in-memory-fallback', clusterOperationsAvailable: boolean }`
   - Attach connection/error listeners to Redis pub/sub clients to maintain continuous status tracking.
6. **Multi-Process Testing:** Add `apps/realtime/src/cluster-integration.spec.ts` executing real child processes across distinct OS process IDs (Worker PID, Realtime A PID, Realtime B PID), proving cross-node broadcast and active-socket eviction over Docker Redis.

7. **Stale Block-Event Safety (Maintenance Remediation FIND-10D-01):** Enforce authoritative `isBlocked` verification via `IConversationAuthorizationService` (defaulting to `conversationAuthorizationService.isBlocked()`) inside `RedisBlockEvictionService.evictBlockedPair()` before querying conversations or broadcasting eviction. If a block was removed prior to event processing (e.g. unblock committed while event was delayed), the event is safely treated as a no-op without false room eviction or misleading notifications.
8. **Bounded Retry Backoff Mathematics (Maintenance Remediation FIND-10D-03):** Implemented `calculateRetryDelayMs()` in `@creatorconnect/database`, strictly enforcing the configured `maxDelayMs` cap:
   - Exponent: $e = \max(0, \min(a - 1, 30))$
   - Exponential Delay: $d_{\mathrm{exp}} = \min(d_{\max}, d_0 \cdot 2^e)$
   - Additive Jitter: $j = \lfloor U \cdot j_{\max} \rfloor$ where $U \in [0, 1)$
   - Total Delay: $d_{\mathrm{retry}} = \min(d_{\max}, d_{\mathrm{exp}} + j)$
   - Timestamp: $t_{\mathrm{next}} = t_{\mathrm{now}} + d_{\mathrm{retry}}$
   - The total delay is guaranteed never to exceed $d_{\max}$ under any configuration, with $d_{\max} \ge d_0$ enforced when positive $d_{\max}$ is supplied.
9. **Redis Recovery & Stale-Room Reconciliation (Maintenance Remediation FIND-10D-02 & FIND-10D-04):**
   - Implemented bounded `reconcileLocalSockets()` in `BlockEvictionService` operating exclusively on locally connected sockets (`io.sockets.sockets`).
   - Complexity bound: $T = O(S + R + Q)$ with $Q = 2$ batched queries per chunk of 100 conversations, completely eliminating N+1 database queries.
   - Dual-client tracking: monitors both `pubClient` and `subClient` for `ready` state before declaring cluster operations available.
   - Revalidates account status: disconnects sockets whose account status transitioned to `SUSPENDED` or `DEACTIVATED`.
   - Single-flight concurrency guard prevents overlapping reconciliation runs during network flappers.
   - Added integration test `Test F` in `apps/realtime/src/cluster-integration.spec.ts` executing real Redis `CLIENT KILL` on the subscriber TCP connection, proving post-reconnection reconciliation and stale socket eviction across child processes.

## Consequences

- **Positive:**
  - Standalone worker and realtime cluster operate completely decoupled across container boundaries.
  - Active-socket eviction is enforced across all running Socket.IO instances without custom protocols or security bypasses.
  - Delayed historical block events are guaranteed not to disrupt unblocked users.
  - Outbox retry backoff strictly adheres to configured upper bounds with zero numerical overflow: $0 \le d_{\mathrm{retry}} \le d_{\max}$.
  - Socket reconciliation is strictly bounded ($O(S + R + Q)$) and audits both room participation and bidirectional blocks.
  - Health checks provide transparent observability into distributed cluster readiness vs degraded mode, exposing dual pub/sub readiness and `lastReconciledAt`.
- **Negative / Considerations (TOCTOU & Partition Boundaries):**
  - **Time-of-Check to Time-of-Use (TOCTOU) Race:** If an unblock commits immediately after worker block verification but before Redis eviction emission, sockets may be temporarily evicted. This conservative eviction is fail-closed and recoverable: the unblocked user can immediately rejoin via `conversation:join`, where PostgreSQL authoritatively permits entry.
  - **Redis Partition Window:** During a Redis partition, remote broadcast cannot propagate. Protected API mutations (messages, joins, attachments) remain fail-closed via authoritative PostgreSQL checks. Upon partition resolution, `reconcileLocalSockets()` restores consistency across local sockets.
