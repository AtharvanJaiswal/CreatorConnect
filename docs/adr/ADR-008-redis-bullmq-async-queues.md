# ADR-008: Redis 7 and BullMQ for Asynchronous Queues & Event Processing

## Status
Approved

## Context
Asynchronous processing is critical for platform smoothness: media transcoding, video thumbnail generation, push notifications, email dispatches, webhook retries, and transactional outbox event relays. Implementing custom setTimeout/setInterval loops or naive in-memory queues is unreliable and loses jobs upon container restarts.

## Decision
Standardize on **Redis 7** and **BullMQ** as the unified queue and asynchronous task orchestration engine across CreatorConnect:
1. **Queues Defined**: `media-processing`, `notifications-fcm`, `notifications-email`, `outbox-relay`, `payout-processing`, `analytics-events`.
2. **Standard Job Guarantees**:
   - Explicit **idempotency keys** (`jobId: {aggregateId}-{version}`).
   - Exponential backoff retry strategy (5 attempts with exponential jitter).
   - Dead-letter queues (DLQ) with automated alerting via Sentry.
   - Structured logging with propagated `correlationId`.

## Alternatives Evaluated
- **Apache Kafka**: Rejected as massive enterprise overengineering for Phase 0–14. Kafka requires ZooKeeper/KRaft clusters, dedicated partition management, and high memory footprints without providing simple delayed jobs.
- **RabbitMQ / AMQP**: Rejected because BullMQ leverages Redis (which the platform already uses for session caching and Socket.IO backplanes), eliminating an additional infrastructure container.
- **Custom In-Memory / SQL Polling Queue**: Rejected because BullMQ provides battle-tested Lua scripts for atomic locks, parent-child job workflows, rate limiting, and pause/resume capabilities.

## Consequences
- **Positive**: Zero data loss on crashes; high throughput (>10,000 jobs/sec); built-in delayed jobs and recurring cron capabilities; shared infrastructure with Redis cache.
- **Negative**: Redis memory must be monitored to prevent out-of-memory (OOM) states (mitigated by configuring Redis `maxmemory-policy: noeviction` for queue databases).

## Security Impact
Redis connection is secured via TLS and authenticated with strong passwords; worker jobs only pass entity IDs and minimal metadata, never raw credentials or secrets.

## Performance Impact
Offloads high-latency network operations (FCM, Resend, FFmpeg) from the HTTP API thread pool, guaranteeing fast REST response times.

## Migration Implications
If the platform scales to millions of daily events in Phase 15+, specific high-throughput event queues can be migrated to Kafka or AWS SQS while keeping the BullMQ API abstraction intact.
