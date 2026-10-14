# CreatorConnect — Phase 6 Observability, Telemetry & Alerting Guide

**Document Version:** 1.0.0  
**Baseline Branch:** `audit/phase-6-operational-readiness`  
**Evaluation Commit SHA:** `3735fb8`  
**Auditor Roles:** Site Reliability Engineer (SRE) & Observability Architect

---

## 1. Structured Logging Standards & Correlation

### 1.1 JSON Log Format

All services (@creatorconnect/api, @creatorconnect/worker, @creatorconnect/realtime) emit structured JSON logs via Pino to stdout:

```json
{
  "level": 30,
  "time": 1791986808400,
  "pid": 36660,
  "hostname": "cc-api-worker-1",
  "reqId": "req-9",
  "method": "POST",
  "url": "/api/v1/payments/projects/01a13abc-b5f7-7617-8801-8d668634572d/escrow/release",
  "res": { "statusCode": 403 },
  "responseTime": 72.04,
  "msg": "request completed"
}
```

### 1.2 Distributed Request Correlation

- Every incoming HTTP request is assigned a `reqId` via the `x-request-id` header or generated as a UUIDv7.
- `reqId` is attached to the Fastify request context and propagated down through domain services, Prisma transaction metadata, and audit log entries.
- Outbox events persist `correlationId` to trace background worker jobs back to the initiating HTTP request.

### 1.3 Privacy, Redaction & PII Protection

The logging system enforces strict sanitization rules:

- **Redacted Fields:** Passwords, Supabase JWTs, Razorpay secret keys, webhook signatures, bank account details, and card numbers are never logged.
- **Payload Redaction:** Full incoming raw webhook bodies and dispute private notes are excluded from standard access logs. When security anomalies occur (e.g. `PAYMENT_WEBHOOK_PAYLOAD_MISMATCH_ANOMALY`), only the SHA-256 hashes and event IDs are logged, never raw customer financial data.

---

## 2. Standardized Prometheus Metrics

Metrics follow Prometheus naming conventions and enforce bounded cardinality:

| Metric Name                      | Type      | Description                                  | Permitted Labels (Low Cardinality)                         |
| :------------------------------- | :-------- | :------------------------------------------- | :--------------------------------------------------------- |
| `http_requests_total`            | Counter   | Total HTTP requests processed                | `method`, `route`, `status_code`                           |
| `http_request_duration_seconds`  | Histogram | Request latency distribution                 | `method`, `route`, `status_code`                           |
| `payment_intents_total`          | Counter   | Total payment intents created                | `provider`, `status` (`SUCCEEDED`, `FAILED`, etc.)         |
| `refunds_total`                  | Counter   | Total refunds processed                      | `provider`, `status` (`SUCCEEDED`, `PROCESSING`, `FAILED`) |
| `ledger_discrepancies_total`     | Counter   | Unbalanced journal attempts detected         | `violation_type`                                           |
| `webhook_events_total`           | Counter   | Total webhooks ingested                      | `provider`, `event_type`, `outcome`                        |
| `webhook_payload_mismatch_total` | Counter   | Webhook conflicting payload anomalies        | `provider`                                                 |
| `outbox_events_pending_count`    | Gauge     | Current backlog of unprocessed outbox events | `aggregate_type`                                           |
| `outbox_event_age_seconds`       | Gauge     | Age of oldest unhandled outbox event         | `aggregate_type`                                           |
| `db_connection_pool_active`      | Gauge     | Active PostgreSQL connections                | `pool` (`api`, `worker`)                                   |
| `db_query_duration_seconds`      | Histogram | Database query execution latency             | `operation` (`SELECT`, `INSERT`, etc.)                     |

> [!WARNING]
> High-cardinality identifiers (such as `user_id`, `project_id`, `payment_intent_id`, or email addresses) are **strictly prohibited** as Prometheus metric labels.

---

## 3. Health & Readiness Probes

The API server exposes two standardized health probes:

1. **Liveness Probe (`GET /health`):**
   - Returns HTTP 200 with `{ "status": "ok", "uptime": 124.5, "timestamp": "2026-10-14T19:40:00.000Z" }`.
   - Used by container orchestrators to detect process crashes or deadlocks.
2. **Readiness Probe (`GET /ready`):**
   - Validates live connectivity to PostgreSQL (`SELECT 1`) and Redis (`PING`).
   - Returns HTTP 200 when all dependencies are healthy; returns HTTP 503 if any dependency is unreachable.
   - Used by load balancers to route traffic only to fully operational instances.

---

## 4. Alerting Rules & Escalation Matrix

### 4.1 Alert Thresholds

| Alert Identifier                | Severity      | Trigger Condition                                           | Notification Target           | Action / Runbook                                         |
| :------------------------------ | :------------ | :---------------------------------------------------------- | :---------------------------- | :------------------------------------------------------- |
| `LedgerDiscrepancyDetected`     | P0 (Critical) | `ledger_discrepancies_total > 0`                            | PagerDuty (Immediate Page)    | Halt release; execute `runbook-ledger-mismatch`          |
| `WebhookPayloadMismatchAnomaly` | P1 (High)     | `rate(webhook_payload_mismatch_total[5m]) > 0`              | Slack `#secops-alerts`        | Investigate replay attack / gateway key re-use           |
| `RefundAmbiguityTimeout`        | P1 (High)     | `refunds_total{status="PROCESSING"} > 0` for $> 15\text{m}$ | PagerDuty (30 min escalation) | Query gateway API; execute admin reconcile               |
| `OutboxBacklogSpike`            | P2 (Medium)   | `outbox_events_pending_count > 100` for $> 5\text{m}$       | Slack `#ops-alerts`           | Inspect worker process health & Redis queues             |
| `DatabasePoolExhaustion`        | P1 (High)     | `db_connection_pool_active / pool_max > 0.85`               | PagerDuty                     | Scale connection pool / investigate slow queries         |
| `ReadinessProbeFailure`         | P0 (Critical) | `probe_success == 0` for $> 1\text{m}`                      | PagerDuty (Immediate Page)    | Restart instance / inspect PostgreSQL/Redis reachability |

### 4.2 Gate B (Telemetry & Incident Response) Status

- **Current Status:** **NOT_VERIFIED**
- **Justification:** While telemetry endpoints, health probes, and structured logs are fully implemented and verified in code, external notification routing (live PagerDuty / Slack integrations) cannot be verified in local development without active staging webhooks.
- **Staging Prerequisite:** During Staging Validation, dispatch a synthetic test alert through the staging alert manager and verify receipt in the designated Slack channel within 60 seconds.
