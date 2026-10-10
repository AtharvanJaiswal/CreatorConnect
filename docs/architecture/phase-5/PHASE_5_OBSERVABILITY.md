# CreatorConnect — Phase 5 Observability & Metrics Specification

## 1. Observability Architecture

Phase 5 implements end-to-end distributed observability across HTTP, WebSocket, Outbox polling, BullMQ workers, and storage systems using **Pino 9**, **OpenTelemetry**, and **Prometheus**.

---

## 2. Distributed Tracing & Correlation Context

Every request or socket interaction initiates a distributed trace context propagated across asynchronous boundaries:

```typescript
export interface TraceContext {
  traceId: string; // W3C Trace Context traceparent
  spanId: string; // Current operation span
  correlationId: string; // End-to-end client session identifier
  actorId?: string; // Authenticated user ID (if present)
}
```

- **REST Requests**: Extracted from `traceparent` or `x-correlation-id` headers; generated via `generateUuidV7()` if absent.
- **WebSocket Events**: Propagated through Socket.IO handshake headers and event envelopes.
- **Outbox Events**: Outbox table stores `payload._traceContext`. Workers restore the trace context when processing asynchronous jobs to maintain unified distributed traces.

---

## 3. Strict Logging Privacy Policy (Redaction Rules)

Under no circumstances may sensitive data or private user communications be written to stdout or log aggregators:

| Prohibited in Logs                             | Permitted Log Equivalent                                                     |
| :--------------------------------------------- | :--------------------------------------------------------------------------- |
| **Passwords, Refresh Tokens, JWTs**            | `"[REDACTED_SECRET]"`                                                        |
| **Authorization Headers**                      | Redacted by Pino serializer: `req.headers.authorization = '[REDACTED]'`      |
| **Private Message Content**                    | Message ID, conversation ID, and character length only (`contentLength: 42`) |
| **Attachment Binary Streams / Presigned URLs** | Asset ID, storage key prefix, byte size, and MIME type                       |
| **Bank Details / Tax IDs**                     | Masked (e.g. `****1234`)                                                     |

---

## 4. Key Performance Formulas & Health Metrics

### 4.1 Transactional Outbox Lag

$$\text{outboxLag} = \text{now}() - \min(\text{unprocessedOutboxEvents}.\text{created\_at})$$

- **Target**: $< 500\text{ms}$
- **Alert**: Trigger PagerDuty warning if $\text{outboxLag} > 5.0\text{s}$ for $>2$ minutes.

### 4.2 Queue Depth Formula

$$\text{queueDepth} = \text{waiting} + \text{active} + \text{delayed}$$

- Monitored per BullMQ queue (`media-processing`, `push-notifications`, `email-notifications`).

### 4.3 Message Transaction Success Rate

$$\text{messageSuccessRate} = \left(\frac{\text{successfulMessages}}{\text{totalMessageCreationAttempts}}\right) \times 100\%$$

- **Target**: $> 99.95\%$

### 4.4 Realtime Delivery Rate

$$\text{deliveryRate} = \left(\frac{\text{acknowledgedDeliveries}}{\text{persistedMessages}}\right) \times 100\%$$

- Reflects percentage of messages acknowledged by at least one recipient socket within 5 seconds.

### 4.5 Notification Failure Rate

$$\text{notificationFailureRate} = \left(\frac{\text{failedNotificationAttempts}}{\text{totalNotificationAttempts}}\right) \times 100\%$$

- Monitored by channel (`IN_APP`, `PUSH`, `EMAIL`).

---

## 5. Standard Prometheus Metrics Catalog

| Metric Name                      | Type      | Labels                                   | Description                                        |
| :------------------------------- | :-------- | :--------------------------------------- | :------------------------------------------------- |
| `http_request_duration_seconds`  | Histogram | `method`, `route`, `status`              | REST API request latency (p50, p95, p99).          |
| `socket_connections_active`      | Gauge     | `node_id`, `transport`                   | Current active WebSocket connections per node.     |
| `socket_event_duration_seconds`  | Histogram | `event_name`, `status`                   | Realtime event processing and ack latency.         |
| `outbox_lag_seconds`             | Gauge     | `aggregate_type`                         | Time lag of the oldest pending outbox record.      |
| `outbox_events_published_total`  | Counter   | `event_type`, `status`                   | Total outbox events successfully dispatched.       |
| `outbox_dead_letter_total`       | Counter   | `event_type`                             | Total poison pill events routed to DLQ.            |
| `media_scans_total`              | Counter   | `verdict` (`CLEAN`, `INFECTED`, `ERROR`) | Antivirus scanner verdicts from ClamAV gateway.    |
| `notifications_dispatched_total` | Counter   | `channel`, `type`, `status`              | Total notification delivery attempts and outcomes. |
| `rate_limit_hits_total`          | Counter   | `key_type`, `endpoint`, `action`         | Total requests throttled by dual-key rate limiter. |
