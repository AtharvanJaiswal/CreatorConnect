# ADR-002: Transactional Outbox Pattern

## 1. Context & Problem Statement

When business mutations commit to PostgreSQL (such as saving a message or accepting an assignment application), external downstream consumers (realtime fanout, push notifications, search indexers) must be notified.

Directly publishing events to Redis or BullMQ inside the HTTP request handler suffers from the **dual-write anomaly**: if the database commit succeeds but the network call to Redis fails, or if the process crashes between the writes, the event is permanently lost, causing inconsistent platform state.

## 2. Options Considered

- **Option 1**: Direct double-write from HTTP handler (`db.create()` followed immediately by `socket.emit()` / `queue.add()`).
- **Option 2**: Change Data Capture (CDC) using Debezium reading PostgreSQL write-ahead logs (WAL).
- **Option 3**: **Transactional Outbox Table with Worker Polling via `FOR UPDATE SKIP LOCKED`**.

## 3. Decision

**Adopt Option 3: Transactional Outbox Table committed atomically in PostgreSQL, polled asynchronously by a worker daemon using `SELECT ... FOR UPDATE SKIP LOCKED`.**

## 4. Evaluation & Rejection Rationale

- _Option 1 Rejected_: Fatal reliability defect. Network partitions or node crashes inevitably produce lost events or orphaned business records.
- _Option 2 Rejected_: Debezium requires running Apache Kafka, Zookeeper/KRaft, and dedicated JVM connectors. This introduces severe infrastructure complexity and operational overhead disproportionate to CreatorConnect's current scale.
- _Option 3 Selected_: PostgreSQL 16 natively supports row-level `SKIP LOCKED`, allowing multiple worker replicas to poll and drain pending outbox records concurrently with zero lock contention and zero additional infrastructure.

## 5. Consequences & Implications

- **Reliability**: Eliminates the dual-write problem entirely. Guarantees at-least-once delivery to downstream consumers.
- **Performance**: Transaction duration increases by $<1\text{ms}$ to write the outbox row. Poller latency is sub-50ms.
- **Consumer Idempotency**: Because delivery is at-least-once, consumers must implement the `processed_events` deduplication pattern (`UNIQUE(event_id, consumer_name)`).
- **Poison Pill Isolation**: Events that fail 5 consecutive dispatch attempts transition to `DEAD_LETTER` with automated alerts.
