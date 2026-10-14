# CreatorConnect — Phase 6 Financial & Infrastructure Incident Runbooks

**Document Version:** 1.0.0  
**Baseline Branch:** `audit/phase-6-operational-readiness`  
**Evaluation Commit SHA:** `3735fb8`  
**Auditor Roles:** Site Reliability Engineer (SRE), Incident Commander, and Financial Systems Engineer

---

## Runbook 1: Provider Timeout & Ambiguous Payment/Refund Status

### 1. Detection

- **Alert:** `RefundAmbiguityTimeout` fires when a `Refund` record remains in `PROCESSING` status for $> 15\text{ minutes}$.
- **Metric:** `refunds_total{status="PROCESSING"} > 0`.

### 2. Containment

- The system automatically contains the risk: refunds in `PROCESSING` status retain their database escrow reservation, preventing concurrent release or duplicate refund creation.

### 3. Diagnostic Evidence

- Retrieve refund details:
  ```sql
  SELECT id, "payment_intent_id", amount, status, "provider_refund_id", "created_at"
  FROM "refunds"
  WHERE status = 'PROCESSING';
  ```
- Retrieve correlation ID (`reqId`) from `audit_logs` associated with the refund entity.

### 4. Recovery Steps

1. Log in to the payment gateway dashboard (or query gateway API using provider refund ID / payment ID).
2. Determine final provider disposition:
   - **Case A (Refund Succeeded at Gateway):**  
     Call admin reconciliation endpoint:
     `POST /api/v1/payments/refunds/:id/reconcile`  
     Payload: `{ "resolution": "SUCCEEDED", "notes": "Confirmed success on gateway dashboard" }`  
     _Effect:_ Posts compensating ledger entries, releases remaining balance, and transitions status to `SUCCEEDED`.
   - **Case B (Refund Never Reached Gateway):**  
     Call admin reconciliation endpoint:
     `POST /api/v1/payments/refunds/:id/reconcile`  
     Payload: `{ "resolution": "FAILED", "notes": "Gateway confirmed request timed out before arrival" }`  
     _Effect:_ Releases escrow reservation, restores capturable balance, and transitions status to `FAILED`.

### 5. Validation Before Closure

- Assert refund status is no longer `PROCESSING`.
- Assert ledger debits equal credits for the associated payment intent.

---

## Runbook 2: Duplicate or Conflicting Webhook Ingestion

### 1. Detection

- **Alert:** `WebhookPayloadMismatchAnomaly` fires when `rate(webhook_payload_mismatch_total[5m]) > 0`.
- **Audit Action:** Audit log entry with `action: 'PAYMENT_WEBHOOK_PAYLOAD_MISMATCH_ANOMALY'`.

### 2. Containment

- The webhook ingestion service automatically preserves the existing event and rejects execution of the conflicting payload with status `PAYLOAD_MISMATCH_ANOMALY`. Zero financial mutations occur.

### 3. Diagnostic Evidence

- Query anomaly audit log:
  ```sql
  SELECT * FROM "audit_logs"
  WHERE action = 'PAYMENT_WEBHOOK_PAYLOAD_MISMATCH_ANOMALY'
  ORDER BY "created_at" DESC LIMIT 5;
  ```
- Inspect metadata for `eventId`, `provider`, and conflicting payload hash.

### 4. Recovery Steps

1. Check gateway webhook delivery logs to determine why the event ID was recycled.
2. If legitimate gateway retry with non-material formatting differences: verify whether financial effect was already completed.
3. If fraudulent injection attempt: rotate gateway webhook signing secret immediately and alert SecOps.

---

## Runbook 3: Double-Entry Ledger Discrepancy

### 1. Detection

- **Alert:** `LedgerDiscrepancyDetected` fires (`ledger_discrepancies_total > 0`).

### 2. Containment

- Immediately pause automatic escrow releases for affected project:
  ```sql
  UPDATE "projects" SET status = 'DISPUTED' WHERE id = '<project_id>';
  ```

### 3. Diagnostic Evidence

- Identify unbalanced transaction:
  ```sql
  SELECT t.id, SUM(CASE WHEN e.direction = 'DEBIT' THEN e.amount ELSE -e.amount END) AS diff
  FROM "ledger_transactions" t
  JOIN "ledger_entries" e ON e."transaction_id" = t.id
  GROUP BY t.id
  HAVING SUM(CASE WHEN e.direction = 'DEBIT' THEN e.amount ELSE -e.amount END) <> 0;
  ```

### 4. Recovery Steps

1. Never update or delete existing ledger rows (ledger entries are strictly immutable).
2. Authorize a corrective compensating journal transaction referencing the defective transaction ID.
3. Re-run reconciliation query to assert all accounts balance.

---

## Runbook 4: Stuck Refund Reservation

### 1. Detection

- Escrow release attempts fail with HTTP `400 BAD_REQUEST` (`Cannot release escrow while refunds are pending`).
- A `Refund` record is stuck in `PENDING` state for $> 30\text{ minutes}$ due to unhandled network crash.

### 2. Containment

- Existing reservation prevents overdraft; funds remain safely in escrow.

### 3. Recovery Steps

1. Inspect worker logs for the initiating `reqId`.
2. Verify with payment provider whether refund was issued.
3. Use the admin reconciliation route to resolve the stuck refund to either `SUCCEEDED` or `FAILED`.

---

## Runbook 5: Outbox Backlog & Worker Failure

### 1. Detection

- **Alert:** `OutboxBacklogSpike` fires (`outbox_events_pending_count > 100` for $> 5\text{ minutes}`).
- Worker queue lag exceeds SLA.

### 2. Containment

- Worker restarts do not cause duplicate processing: outbox dispatchers enforce idempotency via `processed_events` and database transactions.

### 3. Diagnostic Evidence

- Check worker process status:
  ```bash
  pm2 status cc-worker # or kubectl get pods -l app=cc-worker
  ```
- Query oldest pending outbox event:
  ```sql
  SELECT id, "event_type", "created_at"
  FROM "outbox_events"
  WHERE status = 'PENDING'
  ORDER BY "created_at" ASC LIMIT 5;
  ```

### 4. Recovery Steps

1. If worker process crashed: restart container or service.
2. If Redis connection failed: check Redis cluster status and failover health.
3. Once worker reconnects, pending outbox events are drained with exponential backoff and jitter.

---

## Runbook 6: Secret Compromise & Key Rotation

### 1. Detection

- Unauthorized API access detected or credentials accidentally disclosed.

### 2. Containment

- Revoke compromised credentials immediately in payment gateway / identity provider dashboard.

### 3. Recovery Steps

1. **Razorpay Key & Secret Rotation:**
   - Generate secondary key pair in Razorpay dashboard.
   - Update `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in secret manager.
   - Restart API pods with rolling deployment.
   - Revoke primary key pair after confirming zero traffic errors.
2. **Supabase JWT Secret Rotation:**
   - Update JWKS stub / Supabase secret.
   - Existing active sessions will expire or be rejected with HTTP 401; users must re-authenticate.
