# CreatorConnect — Phase 4.3.1 Privacy Governance Gate Review (`PHASE_3B9_GOVERNANCE_APPROVED`)

**Scope:** Runtime gate audit for Phase 3B.9 destructive account erasure workflows across `apps/api`, `apps/worker`, and `apps/web-shell`  
**Safety Compliance:** Stage A blocker verified **100% intact** (neither weakened, bypassed, nor removed).

---

## 1. Codebase & Runtime Audit Findings

A workspace-wide scan across `apps/*/src` and `packages/*/src` established every read site and control point:

| Component / Layer                       | File & Reference                                                                                                                          | Current Behavior                                                                                                                                                                                                                                                           | Fail-Closed Status                                                  |
| :-------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------ |
| **HTTP Execution Endpoint**             | [`lifecycle.routes.ts#L458-L503`](file:///f:/CreatorConnect/apps/api/src/modules/lifecycle/lifecycle.routes.ts#L458-L503)                 | `POST /api/v1/admin/privacy/requests/:id/execute` requires `authenticate`, `requireAdminPermission('users.privacy')`, and checks `process.env.PHASE_3B9_GOVERNANCE_APPROVED !== 'true'`, returning **HTTP `403`** (`code: 'STAGE_A_GOVERNANCE_BLOCKED'`).                  | **Fail-closed** (defaults blocked when unset, empty, or `'false'`). |
| **Frontend Admin UI**                   | [`lifecycle/page.tsx#L313-L327`](file:///f:/CreatorConnect/apps/web-shell/src/app/admin/lifecycle/page.tsx#L313-L327)                     | Displays explicit `"Stage A Hard-Stop Active"` badge and `"0/12 LDR Decisions Approved — BLOCKED"` governance banner; exposes **zero** execute button or `PHASE_3B9_GOVERNANCE_APPROVED` toggle.                                                                           | **Fail-closed** (legal-hold inspection/apply/release only).         |
| **Background Worker**                   | `apps/worker/src/**`                                                                                                                      | Zero callers of `DataErasureOrchestrator` or `executeErasure` exist in `apps/worker/src`. `CleanupScheduler` only expires quarantined media, expired assignments, and expired message requests.                                                                            | **Inactive / Not Wired**.                                           |
| **Erasure Orchestrator Domain Service** | [`data-erasure-orchestrator.ts#L79-L330`](file:///f:/CreatorConnect/apps/api/src/modules/lifecycle/data-erasure-orchestrator.ts#L79-L330) | Performs `SELECT ... FOR UPDATE` on `users`, transactional `assertNoActiveHolds`, DB pseudonymization, S3 purge, Supabase identity deletion, and receipt issuance. **Does NOT check `PHASE_3B9_GOVERNANCE_APPROVED` internally** (guarded only by the HTTP route wrapper). | **Defense-in-depth gap identified** _(HTTP-only check)_.            |

---

## 2. Security, Bypass & Auditability Assessment

1. **Default Behavior & Env Flag Risk:**
   - `PHASE_3B9_GOVERNANCE_APPROVED` defaults to `undefined` -> blocked (`!== 'true'`).
   - However, a plain runtime environment variable is **mutable, unsigned, and un-audited**: if any staging/prod container env var were flipped without formal sign-off, HTTP execution would immediately unlock all 12 LDR domains without checking which `LDR-001`..`LDR-012` approvals actually exist.
2. **Internal Service Bypass Surface:**
   - Because `DataErasureOrchestrator.executeErasure(requestId)` checks only privacy-request confirmation state and legal holds — not governance approval — any future CLI script, cron job, or background worker importing `dataErasureOrchestrator` directly would bypass `lifecycle.routes.ts:484` completely. (Existing integration spec `legal-hold-concurrency.spec.ts` exercises `orchestrator.executeErasure()` directly in 8 tests; therefore the orchestrator signature/behavior was preserved without altering existing tests in Phase 4.3.1.)
3. **Blocked & Allowed Attempt Auditability:**
   - **HTTP Route Rejection (`403 STAGE_A_GOVERNANCE_BLOCKED`):** `errorHandler.ts:16-19` logs a Pino `warn` (`{ code: 'STAGE_A_GOVERNANCE_BLOCKED', statusCode: 403, reqId }`), **but does not write a durable row to `audit_logs`**.
   - **Allowed Orchestrator Execution:** Emits outbox events (`user.erasure.stage_completed.v1`, `user.erasure.completed.v1`), privacy receipt records, and Pino structured info logs (`ERASURE_WORKFLOW_COMPLETED`).
4. **Runtime Verification:**
   - Verified in [`admin-authorization-closure.spec.ts#L477-L483`](file:///f:/CreatorConnect/apps/api/src/modules/admin/rbac/admin-authorization-closure.spec.ts#L477-L483): `SUPER_ADMIN` calling `POST /api/v1/admin/privacy/requests/:id/execute` returns **HTTP `403` (`STAGE_A_GOVERNANCE_BLOCKED`)**.

---

## 3. Recommended Long-Term Governance Model (Before Phase 3B.9 Activation)

1. **Immutable Database-Backed Sign-Off Registry (`governance_decision_approvals`):**
   - Replace bare boolean `PHASE_3B9_GOVERNANCE_APPROVED` with an append-only table tracking `LDR-001`..`LDR-012`, approver user IDs (Legal, DPO, Finance, Security), approval SHA-256 checksums over policy documents, dual-approval enforcement (`approver_1 !== approver_2`), and revocation timestamps.
2. **Mandatory Orchestrator-Layer & Worker-Layer Enforcement:**
   - Inject a `GovernancePolicyGate` check directly at the start of `DataErasureOrchestrator.executeErasure()` (and any future worker consumer) verifying `12/12` active LDR approvals in PostgreSQL under transaction lock before redacting any row.
3. **Durable Audit Trail for Blocked Governance Calls:**
   - Persist an explicit `AuditLog` (`action: 'PRIVACY_ERASURE_BLOCKED_GOVERNANCE'`, `userId`, `entityId: requestId`) whenever a blocked execution is attempted.
