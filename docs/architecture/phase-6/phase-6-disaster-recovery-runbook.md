# CreatorConnect — Phase 6 Disaster Recovery, Backup & Restoration Runbook

**Document Version:** 1.5.0
**Baseline Branch:** `dev`
**Evaluation Commit SHA:** `e869fb0d2ffbb19cdc14f2e430a1c4de28bcbee2`
**Target Environment:** Isolated Test / Staging Database Rehearsal
**Auditor Roles:** Site Reliability Engineer (SRE), Database Administrator (DBA), and Financial Systems Engineer

---

## 1. Disaster Recovery Objectives (RPO & RTO)

### 1.1 Formal Mathematical Definitions

#### Recovery Point Objective (RPO)

$$\text{RPO} = T_{\text{failure}} - t_{\text{latest recoverable consistent committed data point}}$$

- **Authoritative Production Target:** $\text{RPO} \le 5\text{ seconds}$ (near-zero data loss for financial ledgers via continuous PostgreSQL Write-Ahead Log [WAL] streaming to Aurora multi-AZ storage).
- **Authoritative Approval:** Formally confirmed by Staff Database Reliability Engineer on October 15, 2026.
- **Cloud Disaster Recovery Status:** **`NOT_VERIFIED`** (Cloud multi-region WAL archiving, S3 storage replication, and cross-region failover have not been exercised in this local/CI test environment; cloud drill required on staging).
- **Measured Local Snapshot Metric:** In the isolated rehearsal drill (`database-restore-drill.spec.ts`), the snapshot generation execution duration was measured at $\approx 0.5\text{ seconds}$ ($520\text{ ms}$). This measurement represents the storage dump execution window, not an end-to-end cloud RPO. In the drill scenario where no writes occurred post-snapshot, zero transactions were lost between snapshot creation and verification.

#### Recovery Time Objective (RTO)

$$\text{RTO} = T_{\text{recovery complete}} - T_{\text{incident start}}$$

- **Production SLA Target:** $\text{RTO} \le 900\text{ seconds}$ (15 minutes) for full database restoration, schema verification, and double-entry ledger reconciliation.
- **Measured Local Drill Metric:** Complete containerized dump, SHA-256 digest computation, isolated database provisioning, `pg_restore` execution, schema verification (48 tables), foreign key integrity checks, and double-entry ledger reconciliation completed in **$6.9\text{ seconds}$** (measured locally between $6.3\text{s}$ and $7.3\text{s}$ across test runs).
- **Cloud RTO Extrapolation:** Local restore timing confirms tooling and schema automation efficiency, but production cloud RTO remains subject to EBS volume snapshot hydration and network transfer latency. Cloud disaster recovery validation is scheduled for isolated Staging.

### 1.2 Authoritative Cloud PITR Measurement Protocol

To ensure that empirical testing strictly demonstrates the $\le 5\text{s}$ RPO target rather than an arbitrary historical rollback:

1. **Clock Synchronization & Continuous Synthetic Canary Ingestion:**
   - Both the canary probe client and PostgreSQL Aurora cluster synchronize against the AWS Time Sync Service (`chrony` NTP server `169.254.169.123`) with enforced drift bound $|\Delta t_{\text{drift}}| \le 1.0\text{ ms}$.
   - Timestamps are rigorously distinguished across three domains:
     - **Client Dispatch Timestamp ($t_{\text{client\_dispatch}, s}$):** Generated from the client's local synchronized clock before issuing the synthetic write transaction for sequence number $s$.
     - **Database Row Insertion Timestamp ($t_{\text{db\_insert}, s}$):** Generated on the PostgreSQL primary using server-side **`clock_timestamp()`** at row insertion.
       > **Critical Distiction:** A timestamp recorded at row insertion (`db_inserted_at`) marks statement evaluation time on the primary; it is **not** an exact commit completion timestamp. The true commit occurs when PostgreSQL writes and flushes the commit record to the Write-Ahead Log (WAL). The client acknowledgement timestamp ($t_{\text{client\_ack}, s}$) bounds when the transaction was guaranteed committed and durable.
     - **Acknowledged Commit Outcome ($t_{\text{client\_ack}, s}$):** Recorded on the client when the database confirms commit completion over the wire. Transactions receiving confirmation prior to failure injection ($T_{\text{failure}}$) are classified as **acknowledged writes**. Transactions without confirmation before connection severance are classified as **in-flight / unacknowledged**.
   - Canary worker commits probe records every $1.0\text{ second}$ with monotonically increasing sequence numbers $s$ into `audit_logs`:
     ```sql
     INSERT INTO "audit_logs" (id, action, entity, entity_id, metadata, created_at)
     VALUES (
       gen_random_uuid(),
       'DR_CANARY_PROBE',
       'CanaryHeartbeat',
       'canary-heartbeat-01',
       jsonb_build_object(
         'sequence', 4210,
         'client_dispatched_at', '2026-10-16T11:30:00.000Z',
         'db_inserted_at', clock_timestamp()
       ),
       NOW()
     )
     RETURNING
       (metadata->>'sequence')::bigint AS committed_sequence,
       (metadata->>'db_inserted_at')::timestamptz AS db_inserted_at;
     ```
   - The canary client records an acknowledged stream of tuples: $(s_n, t_{\text{client\_dispatch}, n}, t_{\text{db\_insert}, n}, t_{\text{client\_ack}, n})$.
2. **Failure Injection ($T_{\text{incident start}} \equiv T_{\text{failure}}$):** Primary instance failure is triggered. The RTO clock begins at this exact millisecond.
   - The **last acknowledged write** is identified as $S_{\text{last\_ack}}$ (the highest sequence number $s$ acknowledged prior to $T_{\text{failure}}$), with database insertion time $t_{\text{db\_insert}}(S_{\text{last\_ack}})$ and client acknowledgment time $t_{\text{client\_ack}}(S_{\text{last\_ack}})$.
3. **Cloud Restoration to Latest Restorable State:** AWS Aurora Point-in-Time Recovery restores the cluster using `--use-latest-restorable-time` (or targeting $T_{\text{failure}}$), replaying streaming WAL to the crash boundary.
4. **Validation, Ledger Reconciliation & Recovery Completion ($T_{\text{recovery complete}}$):**
   - Verify all 48 tables and foreign key constraints exist.
   - Execute double-entry ledger balancing: $\sum \text{Debit} - \sum \text{Credit} \equiv 0$ (must balance to 0 paise).
   - Inspect recovered canaries to identify the **last recovered write**:
     ```sql
     SELECT
       (metadata->>'sequence')::bigint AS recovered_sequence,
       (metadata->>'db_inserted_at')::timestamptz AS recovered_db_insert_timestamp,
       (metadata->>'client_dispatched_at')::timestamptz AS recovered_client_dispatch_timestamp,
       created_at AS recovered_created_at
     FROM "audit_logs"
     WHERE action = 'DR_CANARY_PROBE'
     ORDER BY (metadata->>'sequence')::bigint DESC
     LIMIT 1;
     ```
     Yields $(S_{\text{recovered}}, t_{\text{db\_insert}}(S_{\text{recovered}}))$.
   - The RTO clock stops ($T_{\text{recovery complete}}$) when all validations and ledger reconciliation complete successfully.
5. **Rigorous Metric Definitions & Approved Acceptance Criteria:**

   - **Metric 1: Recovery-Point Age Relative to Failure ($\Delta t_{\text{age}}$):**
     $$\Delta t_{\text{age}} = T_{\text{failure}} - t_{\text{db\_insert}}(S_{\text{recovered}})$$
     - **Why this is the primary approved RPO acceptance criterion:** RPO by standard definition specifies the maximum allowable age of data that can be lost following a disaster. Under an active continuous write workload (canaries every $1.0\text{s}$), $\Delta t_{\text{age}}$ directly measures the maximum possible WAL archiving and multi-AZ storage replication lag. Using this metric prevents false-positive "zero data loss" claims that could occur during idle traffic windows.
   - **Metric 2: Span Between Lost Acknowledged Writes ($\Delta t_{\text{lost\_writes}}$):**
     $$\Delta t_{\text{lost\_writes}} = \begin{cases} 0.0\text{ seconds}, & \text{if } S_{\text{recovered}} \ge S_{\text{last\_ack}} \text{ (zero sequence gap)} \\ t_{\text{client\_ack}}(S_{\text{last\_ack}}) - t_{\text{client\_ack}}(S_{\text{recovered}}), & \text{if } S_{\text{recovered}} < S_{\text{last\_ack}} \text{ (sequence gap of } k \text{ writes)} \end{cases}$$
     - Directly measures customer-visible committed data loss between the last acknowledged write and the recovered state.
   - **Accounting for Sequence Gaps & In-Flight Writes:**
     - **Sequence Gap:** $k = S_{\text{last\_ack}} - S_{\text{recovered}}$. If $k = 0$, all acknowledged writes are restored. If $k > 0$, exactly $k$ acknowledged writes were lost.
     - **In-Flight Writes:** Transactions dispatched between $T_{\text{failure}} - \text{RTT}$ and $T_{\text{failure}}$ that did not receive commit confirmation are unacknowledged and not counted in $\Delta t_{\text{lost\_writes}}$, but are bounded within $\Delta t_{\text{age}}$.
   - **Timestamp Uncertainty ($\epsilon_{\text{uncertainty}}$):**
     - Clock drift: $|\Delta t_{\text{drift}}| \le 1.0\text{ ms}$ (enforced via AWS Time Sync / chrony).
     - Network jitter: $\epsilon_{\text{network}} \le 3.0\text{ ms}$.
     - Statement insertion to commit WAL lag: $\epsilon_{\text{commit\_lag}} \le 5.0\text{ ms}$.
     - Total measurement uncertainty: $\epsilon_{\text{uncertainty}} \le 10.0\text{ ms} \ll 5.0\text{ seconds}$.
   - **Approved Acceptance Criteria:**
     - Target $\text{RPO}_{\text{approved}} \le 5.0\text{ seconds}$ evaluated via $\Delta t_{\text{age}} \le 5.0\text{s}$ under $1.0\text{s}$ canary injection cadence, with $\Delta t_{\text{lost\_writes}} \le 5.0\text{s}$.
     - Target $\text{RTO} \le 900.0\text{ seconds}$ ($15\text{ minutes}$).
     - Double-entry ledger discrepancy must be exactly **$0\text{ paise}$**.
   - **Cloud Drill Requirement:**
     - A 5-second RPO **must not be claimed as achieved** without an empirical cloud drill.
     - **Gate H remains strictly `NOT_VERIFIED`** until executed on staging AWS Aurora.

6. **Separate Classification for Historical Rollback Tests:** Any test that intentionally restores to an older recovery point (such as $T_0 - 60\text{s}$ or $T_0 - 24\text{h}$ to recover from logical data corruption or bad migrations) is classified as a **"Historical Point-in-Time Rollback Drill"** and is tracked separately. It is **never** counted as proof of the $\le 5\text{s}$ RPO target.

---

## 2. Safe Test Environment Procedures

### 2.1 Target Identification & Protection Protocol

Before initiating any backup or restore operation, the tooling executes strict guard checks:

1. **Source vs Target Separation:** The drill runner asserts that $\text{drillDb} \ne \text{sourceDb}$. If identical, execution immediately throws `TestIsolationViolationError`.
2. **Protected Database Blacklist:** The runner rejects any target named `creatorconnect_dev`, `creatorconnect_prod`, `postgres`, or `template1`.
3. **Container Auto-Discovery:** `PostgresContainerResolver` discovers the active container ID dynamically using `docker ps --filter` (supporting both local static naming `creatorconnect-postgres` and GitHub Actions dynamic naming `github-actions-service-postgres`).

---

## 3. Step-by-Step Restoration Rehearsal Procedure

### Step 1: Create Database Snapshot

Execute custom-format compressed backup:

```bash
docker exec <container_id> pg_dump -U postgres -d creatorconnect_dev -F c -f /tmp/creatorconnect_restore_drill.dump
```

### Step 2: Cryptographic Digest & Size Validation

Compute and record SHA-256 checksum:

```bash
docker exec <container_id> sha256sum /tmp/creatorconnect_restore_drill.dump
docker exec <container_id> stat -c %s /tmp/creatorconnect_restore_drill.dump
```

- Assert file size $> 0$ bytes.
- Record checksum in `BackupMetadata`.

### Step 3: Provision Disposable Restoration Database

```bash
docker exec <container_id> createdb -U postgres creatorconnect_restore_drill
```

### Step 4: Restore Snapshot into Isolated Database

```bash
docker exec <container_id> pg_restore -U postgres -d creatorconnect_restore_drill --no-owner --no-privileges /tmp/creatorconnect_restore_drill.dump
```

### Step 5: Verify Schema & Constraint Integrity

Query the restored database:

- **Table Count:** Verify exactly 48 tables exist in the `public` schema.
- **Foreign Keys:** Verify all foreign key constraints are present.
- **Migrations:** Assert all 8 migrations (`0001` through `0008`) exist in `_prisma_migrations` with `rolled_back_at IS NULL`.
- **Indexes:** Confirm all primary keys and unique indexes (`@@unique([provider, eventId])`, `@@unique([projectId, reviewerId])`, etc.) exist.

---

## 4. Post-Restore Financial Reconciliation & Recovery

Once the database is restored and verified, the application must execute automated financial sanity checks prior to resuming API traffic:

### 4.1 Double-Entry Balance Verification

Execute reconciliation query across all posted transactions:

```sql
SELECT
  t.id AS transaction_id,
  SUM(CASE WHEN e.direction = 'DEBIT' THEN e.amount ELSE 0 END) AS total_debit,
  SUM(CASE WHEN e.direction = 'CREDIT' THEN e.amount ELSE 0 END) AS total_credit
FROM "ledger_transactions" t
JOIN "ledger_entries" e ON e."transaction_id" = t.id
GROUP BY t.id
HAVING SUM(CASE WHEN e.direction = 'DEBIT' THEN e.amount ELSE 0 END) <>
       SUM(CASE WHEN e.direction = 'CREDIT' THEN e.amount ELSE 0 END);
```

- **Assertion:** Must return 0 rows. Any discrepancy indicates database corruption prior to snapshot.

### 4.2 Account Balance Recomputation

Assert that every `ledger_accounts.balance` matches the sum of its entries:

```sql
SELECT
  a.id,
  a."account_code",
  a.balance AS stored_balance,
  COALESCE(SUM(CASE WHEN e.direction = 'CREDIT' THEN e.amount ELSE -e.amount END), 0) AS calculated_balance
FROM "ledger_accounts" a
LEFT JOIN "ledger_entries" e ON e."account_id" = a.id
GROUP BY a.id, a."account_code", a.balance
HAVING a.balance <> COALESCE(SUM(CASE WHEN e.direction = 'CREDIT' THEN e.amount ELSE -e.amount END), 0);
```

- **Assertion:** Must return 0 rows.

### 4.3 Recovery of In-Flight Provider Operations

Inspect payments and refunds in non-terminal states:

1. **Refunds in `PENDING` or `PROCESSING`:**
   - Query payment gateway API using `providerRefundId` or `idempotencyKey`.
   - If provider confirms refund succeeded: execute admin reconciliation script to post ledger entries and transition status to `SUCCEEDED`.
   - If provider confirms transaction never reached them: cancel `PENDING` reservation.
2. **Payment Intents in `REQUIRES_CAPTURE`:**
   - Query gateway order status. If captured at provider, ingest synthetic webhook to post clearing ledger entries.

### 4.4 Outbox Event Stream Resumption

Inspect `outbox_events` with `status = 'PENDING'`:

- Verify background worker resumes polling.
- Idempotent consumers (e.g. Socket.IO notification dispatcher) deduplicate events using `eventId` and `processed_events` table.

---

## 5. Ephemeral Resource Cleanup

Following successful drill completion:

```bash
docker exec <container_id> dropdb --if-exists -U postgres creatorconnect_restore_drill
docker exec <container_id> rm -f /tmp/creatorconnect_restore_drill.dump
```

Both cleanup commands are executed in a `finally` block in `DatabaseRestoreDrillRunner`, preventing resource leaks in CI or local developer environments.

---

## 6. Disaster Recovery Limitations

- **Local Drill vs Cloud DR:** The containerized drill demonstrates database schema and data restore capabilities. However, cloud production disaster recovery requires multi-region continuous WAL shipping, automated failover of managed PostgreSQL instances (e.g. AWS RDS Multi-AZ / Aurora Global Database), and DNS failover rehearsal.
