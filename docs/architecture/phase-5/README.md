# CreatorConnect — Phase 5 Architecture Gate Index

## Overview

This directory contains the complete, rigorous architectural blueprint, specifications, security threat models, state machines, database schemas, and Architecture Decision Records (ADRs) for **CreatorConnect Phase 5: Direct Messaging, Realtime Infrastructure, Transactional Outbox, Notifications Foundation, Media Security & Moderation**.

> [!IMPORTANT]
> **READ-ONLY ARCHITECTURE GATE**  
> Per Platform Governance Standards, no Phase 5 production application code or database migrations are to be created until this Architecture Gate is independently reviewed and formally approved.

---

## Document Index

| Document                                                               | Scope & Purpose                                                                                         |
| :--------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| [PHASE_5_EXISTING_CAPABILITIES.md](./PHASE_5_EXISTING_CAPABILITIES.md) | Part A: Detailed audit of existing packages, runtime modules, and reusable abstractions.                |
| [PHASE_5_ARCHITECTURE.md](./PHASE_5_ARCHITECTURE.md)                   | Complete Phase 5 high-level architecture, component topology, and Mermaid diagrams.                     |
| [PHASE_5_DOMAIN_MODEL.md](./PHASE_5_DOMAIN_MODEL.md)                   | Bounded contexts, domain invariants, aggregate roots, and SOLID decomposition.                          |
| [PHASE_5_DATABASE_DESIGN.md](./PHASE_5_DATABASE_DESIGN.md)             | PostgreSQL / Prisma schema, indexes, constraints, audit triggers, and retention policies.               |
| [PHASE_5_REALTIME_DESIGN.md](./PHASE_5_REALTIME_DESIGN.md)             | Socket.IO engine, Redis adapter scaling, room authorization, heartbeat, and reconnect protocol.         |
| [PHASE_5_OUTBOX_DESIGN.md](./PHASE_5_OUTBOX_DESIGN.md)                 | Transactional outbox engine, `SKIP LOCKED` worker polling, event schemas, and DLQ semantics.            |
| [PHASE_5_NOTIFICATION_DESIGN.md](./PHASE_5_NOTIFICATION_DESIGN.md)     | Multi-channel notification pipeline (In-App, FCM Push, Email), preferences, and backoff retries.        |
| [PHASE_5_MEDIA_SECURITY.md](./PHASE_5_MEDIA_SECURITY.md)               | Messaging attachment lifecycle, ClamAV antivirus daemon gateway, and parent authorization.              |
| [PHASE_5_MODERATION_DESIGN.md](./PHASE_5_MODERATION_DESIGN.md)         | Bidirectional blocking, abuse reporting categories, moderation state machine, and audit logs.           |
| [PHASE_5_SECURITY_MODEL.md](./PHASE_5_SECURITY_MODEL.md)               | Threat boundaries, server-derived identities, token expiry/revocation, and fail-closed policies.        |
| [PHASE_5_THREAT_MODEL.md](./PHASE_5_THREAT_MODEL.md)                   | STRIDE security threat analysis across 23 threat vectors with mitigations and detection.                |
| [PHASE_5_FAILURE_MATRIX.md](./PHASE_5_FAILURE_MATRIX.md)               | Exhaustive failure matrix for network partitions, crashes, outages, and poison pills.                   |
| [PHASE_5_RELIABILITY.md](./PHASE_5_RELIABILITY.md)                     | Retry policies, exponential backoff with full jitter, idempotency keys, and circuit breakers.           |
| [PHASE_5_OBSERVABILITY.md](./PHASE_5_OBSERVABILITY.md)                 | Structured logs (Pino), trace context propagation, OpenTelemetry spans, and Prometheus metric formulas. |
| [PHASE_5_TEST_STRATEGY.md](./PHASE_5_TEST_STRATEGY.md)                 | Testing pyramid (Unit, Integration, Contract, Concurrency, Security, E2E), property testing.            |
| [PHASE_5_LOAD_TEST_STRATEGY.md](./PHASE_5_LOAD_TEST_STRATEGY.md)       | Realistic scale targets, k6 / Artillery scripts, WebSocket connection churn, and bottleneck limits.     |
| [PHASE_5_MIGRATION_STRATEGY.md](./PHASE_5_MIGRATION_STRATEGY.md)       | Zero-downtime expand-and-contract migration plans, backfill scripts, and reversible rollbacks.          |
| [PHASE_5_DEPLOYMENT.md](./PHASE_5_DEPLOYMENT.md)                       | Docker Compose and Kubernetes deployment specs, health/readiness probes, and graceful drains.           |
| [PHASE_5_LIBRARY_DECISIONS.md](./PHASE_5_LIBRARY_DECISIONS.md)         | Library audit evaluating production-grade packages vs custom code per ADR-016.                          |
| [PHASE_5_REUSE_AUDIT.md](./PHASE_5_REUSE_AUDIT.md)                     | Cross-repository reuse mapping preventing code duplication across services.                             |
| [PHASE_5_SOLID_REVIEW.md](./PHASE_5_SOLID_REVIEW.md)                   | Explicit audit of SOLID principles (SRP, OCP, LSP, ISP, DIP) across every Phase 5 domain module.        |

---

## Architecture Decision Records (ADRs)

Located in [adr/](./adr/):

- [ADR-001: Realtime Engine & Scaling](./adr/ADR-001-realtime.md)
- [ADR-002: Transactional Outbox Pattern](./adr/ADR-002-outbox.md)
- [ADR-003: Monotonic Message Sequence Ordering](./adr/ADR-003-message-ordering.md)
- [ADR-004: Client Idempotency Strategy](./adr/ADR-004-idempotency.md)
- [ADR-005: Antivirus Media Scanning Gateway](./adr/ADR-005-media-scanning.md)
- [ADR-006: Multi-Channel Notification Pipeline](./adr/ADR-006-notifications.md)
- [ADR-007: Ephemeral Presence Architecture](./adr/ADR-007-presence.md)
- [ADR-008: Keyset Cursor Pagination](./adr/ADR-008-pagination.md)
