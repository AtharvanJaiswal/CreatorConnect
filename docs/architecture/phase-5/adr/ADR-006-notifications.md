# ADR-006: Multi-Channel Notification Pipeline

## 1. Context & Problem Statement

Users require timely notifications across multiple devices:

1. In-App real-time toast and badge updates when logged in.
2. Push notifications to mobile/web browsers when backgrounded or offline.
3. Transactional email summaries for high-priority contract and offer events.

The notification system must not degrade API latency, must respect user preferences, must never leak confidential message content in push payloads, and must gracefully handle third-party gateway downtime (e.g. Firebase or SES outages).

## 2. Options Considered

- **Option 1**: Synchronous delivery inside API mutation handlers.
- **Option 2**: Commercial notification orchestration SaaS (e.g. Novu, Courier).
- **Option 3**: **Asynchronous BullMQ Worker Pipeline consuming Transactional Outbox Events with User Preference Routing**.

## 3. Decision

**Adopt Option 3: Asynchronous BullMQ Notification Pipeline in `apps/worker` triggered by Transactional Outbox domain events.**

## 4. Evaluation & Rejection Rationale

- _Option 1 Rejected_: Fatal architectural violation. Synchronous external API calls (FCM/SES) block database connections, degrade API throughput, and fail business transactions if FCM is unreachable.
- _Option 2 Rejected_: Introduces recurring external SaaS dependencies and transfers user PII across additional vendor boundaries.
- _Option 3 Selected_: Reuses the existing BullMQ and Redis infrastructure in `apps/worker`. Provides exponential backoff, per-channel throttling, and durable dead-letter handling.

## 5. Consequences & Implications

- **Decoupling**: Business transactions commit cleanly regardless of external notification gateway status.
- **Privacy**: Push notification payloads are sanitized at the worker level; external push notifications contain only coarse descriptions (e.g. "New message from Brand"), never private message text or contract terms.
- **Preferences**: Respects user toggles stored in `notification_preferences` per channel and per event type.
