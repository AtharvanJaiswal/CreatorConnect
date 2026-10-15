# CreatorConnect — Phase 6 Disaster Recovery, Backup & Restoration Runbook

**Document Version:** 1.2.0
**Baseline Branch:** `dev`
**Evaluation Commit SHA:** `2dd20f9bb93793317065fb0c9cf7860a5c148d6e`
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

1. **Continuous Synthetic Canary Ingestion:** A background synthetic worker commits timestamped canary records to `audit_logs` every $1.0\text{ second}$ with sequence numbers and client timestamps $t_{\text{client commit}}$.
2. **Failure Injection ($T_{\text{incident start}} \equiv T_{\text{failure}}$):** Primary instance failure is triggered. The RTO clock begins at this exact millisecond. The last acknowledged client write is recorded as $(S_{\text{client last}}, t_{\text{client last}})$.
3. **Cloud Restoration to Latest Restorable State:** AWS Aurora Point-in-Time Recovery restores the cluster using `--use-latest-restorable-time` (or targeting $T_{\text{failure}}$), replaying streaming WAL to the crash boundary.
4. **Validation & Ledger Reconciliation ($T_{\text{recovery complete}}$):**
   - Verify all 48 tables and foreign key constraints exist.
   - Execute double-entry ledger balancing: $\sum \text{Debit} - \sum \text{Credit} \equiv 0$ (must balance to 0 paise).
   - Inspect recovered canaries: find latest recovered canary $(S_{\text{recovered}}, t_{\text{latest recoverable}})$.
   - The RTO clock stops when all validations and ledger reconciliation complete successfully.
5. **Exact Formulas & Acceptance Criteria:**
   - $\text{RPO}_{\text{measured}} = T_{\text{failure}} - t_{\text{latest recoverable}} \le 5.0\text{ seconds}$.
   - $\text{RTO}_{\text{measured}} = T_{\text{recovery complete}} - T_{\text{incident start}} \le 900.0\text{ seconds}$.
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
