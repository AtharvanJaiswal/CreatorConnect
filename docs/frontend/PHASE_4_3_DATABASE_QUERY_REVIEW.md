# CreatorConnect — Phase 4.3 Database Query & Cursor Review

**Scope:** `audit_logs` keyset pagination (`AdminAuditService`), `TimestampUuidCursor` filter binding, PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` evaluation, and financial lock ordering  
**Constraint Notice:** **Zero** database migrations or DDL statements were applied in Phase 4.3; index additions below are proposed SQL/Prisma changes pending staging migration approval.

---

## 1. Cursor Filter Binding Architecture

- **Packages Updated:**
  - `packages/contracts/src/cursor.ts`: Extended `encodeTimestampUuidCursor` and `decodeTimestampUuidCursor` with optional `filterHash?: string` (`f` key, validated against `/^[a-zA-Z0-9_-]{4,64}$/`) while remaining pure browser-compatible JS without `node:crypto` imports.
  - `packages/contracts/src/admin.ts`: Preserved `encodeAuditCursor(createdAt, id, filterHash?)` backward compatibility.
  - `apps/api/src/modules/admin/audit/admin-audit.service.ts`: Added `computeAuditFilterHash(...)` producing a 16-character SHA-256 hex digest of `{ actorId, action, entity, entityId, startDate, endDate, search }`.
- **Failure Modes & Backward Compatibility:**
  - Every `nextCursor` emitted by `AdminAuditService.listAuditLogs` binds to its active filter tuple.
  - Passing that cursor alongside any altered filter (`action`, `search`, `actorId`, `entity`, `entityId`, `startDate`, `endDate`) fails fast with `400 INVALID_AUDIT_CURSOR`.
  - Cursors lacking `f` remain decodable for legacy unit-test and transitional rolling-deploy compatibility, while tampered or malformed `f` values are rejected cleanly (`decodeTimestampUuidCursor` returns `null` -> `400`).

---

## 2. Read-Only PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` Evidence

Executed against local PostgreSQL 16 (`audit_logs` row count: **5,676 rows**; current schema indexes: `audit_logs_pkey(id)`, `audit_logs_created_at_idx(created_at)`, `audit_logs_action_idx(action)`, `audit_logs_user_id_idx(user_id)`):

| Query Pattern                                                                                    | Observed Plan Highlights                                                                                                                           | Execution Time                    | Buffers Hit     | Bottleneck at Scale (10M+ Rows)                                                                                          |
| :----------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------- | :-------------- | :----------------------------------------------------------------------------------------------------------------------- |
| **Q1 — Unfiltered First Page (`ORDER BY created_at DESC, id DESC LIMIT 21`)**                    | `Limit -> Incremental Sort (Presorted Key: created_at, Sort Key: created_at DESC, id DESC) -> Index Scan Backward using audit_logs_created_at_idx` | `0.053 ms` (`Planning: 0.145 ms`) | `6` shared hit  | `Incremental Sort` required whenever duplicate timestamps occur because `id` is absent from `audit_logs_created_at_idx`. |
| **Q2 — Keyset Page Seek (`WHERE created_at <= $1 AND (...) LIMIT 21`)**                          | `Incremental Sort -> Index Scan Backward using audit_logs_created_at_idx`; `Rows Removed by Filter: 1`                                             | `0.080 ms` (`Planning: 0.309 ms`) | `9` shared hit  | Re-evaluates `id < $2` filter on equal-timestamp boundary rows + performs incremental quicksort.                         |
| **Q3 — Action Filter + Keyset (`WHERE action = 'USER_REGISTERED' AND ... LIMIT 21`)**            | `Incremental Sort -> Index Scan Backward using audit_logs_created_at_idx`; **`Rows Removed by Filter: 130`**                                       | `0.083 ms` (`Planning: 0.147 ms`) | `32` shared hit | High amplification for rare actions: scans backward chronologically discarding every non-matching `action` row.          |
| **Q4 — Actor Filter + Keyset (`WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 21`)** | `Limit -> Sort (quicksort 27kB) -> Index Scan using audit_logs_user_id_idx`                                                                        | `0.047 ms` (`Planning: 0.054 ms`) | `4` shared hit  | Fetches and sorts _all_ historical audit rows for high-volume actors in memory before truncating to `LIMIT 21`.          |

---

## 3. Proposed Composite Index Migration (Not Applied)

To eliminate `Incremental Sort`, full per-actor memory sorts, and sparse-filter heap discards at scale, the following **online (`CONCURRENTLY`)** PostgreSQL DDL is proposed for the next authorized database migration window (cannot run inside a Prisma transaction wrapper; execute via psql/migration script outside `BEGIN/COMMIT`, paired with Prisma `@@index` declarations):

```sql
-- 1. Eliminates Incremental Sort and boundary tie-break filtering on global audit stream
CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_created_at_id_desc_idx
  ON audit_logs (created_at DESC, id DESC);

-- 2. Turns action-filtered keyset queries from chronological heap scans into O(log N) seeks
CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_action_created_at_id_desc_idx
  ON audit_logs (action, created_at DESC, id DESC);

-- 3. Eliminates in-memory quicksort for high-activity actor queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_user_id_created_at_id_desc_idx
  ON audit_logs (user_id, created_at DESC, id DESC);
```

And consider keeping `audit_logs_created_at_idx` only if ASC range queries without `id` exist; otherwise `audit_logs_created_at_id_desc_idx` subsumes single-column `created_at` backward scans.

---

## 4. Financial & Lifecycle Lock Ordering Matrix

| Flow                                         | Canonical Row Lock Acquisition Order                                                                                                                             | Timeout / Isolation Behavior                                                                                               |
| :------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| **`AdminFinanceService.createRefund`**       | `pg_advisory_xact_lock(admin_refund_create:<hash>)` (when `Idempotency-Key` present) -> `projects` -> `payment_intents`                                          | `maxWait: 5000ms, timeout: 10000ms`; full atomic rollback of refund, approval, ledger, outbox, audit, and idempotency rows |
| **`AdminFinanceService.decideRefund`**       | `pg_advisory_xact_lock(admin_refund_decide:<hash>)` (when `Idempotency-Key` present) -> `projects` -> `payment_intents` -> `refunds` -> `admin_action_approvals` | `maxWait: 5000ms, timeout: 10000ms`; conditional `updateMany` guards + escrow balance verification inside lock             |
| **`UserRepository.updateStatus`**            | `roles (ADMIN)` -> `admin_roles (SUPER_ADMIN)` -> `users (ORDER BY id ASC)`                                                                                      | Eliminated lock inversion with `admin-rbac.repository.ts` preventing last-admin lockout races                              |
| **`DataErasureOrchestrator.executeErasure`** | `users` -> active `audit_logs` hold verification (`assertNoActiveHolds(tx, userId)`)                                                                             | Prevents race between concurrent `applyHold` and erasure confirmation/execution (API route hard-blocked by Stage A gate)   |
