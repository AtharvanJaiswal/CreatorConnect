# CreatorConnect — Phase 3B.9 Engineering Change Register

## Architecture Traceability, Technical Remediation & Roadmap Backlog

> **Document Status**: `STAGE A TRACEABILITY SPECIFICATION — AWAITING STAGE B AUTHORIZATION`  
> **Evaluation Date**: November 24, 2026  
> **Target Subsystem**: Lifecycle, Retention, Privacy, Storage, and Concurrency Architecture  
> **Related Phase**: Phase 3B.9 (Stage A Deliverable)  
> **Reviewing Directorate**: Principal Software Architect, Senior Backend Engineer, Application Security Lead

---

## 1. Executive Summary & Change Management Framework

The **Phase 3B.9 Engineering Change Register** provides end-to-end requirement traceability across all architectural remediations, code quality refactorings, database schema updates, and security hardening items identified during the Phase 3B.9 readiness review.

Every engineering change adheres to the rigorous traceability chain:
$$\mathbf{Requirement} \longrightarrow \mathbf{Design\ Decision} \longrightarrow \mathbf{Implementation\ File} \longrightarrow \mathbf{Test\ Case} \longrightarrow \mathbf{Evidence} \longrightarrow \mathbf{Approval}$$

No code modification or schema alteration is permitted until its entry conditions, design specification, and governance prerequisites are formally fulfilled.

---

## 2. Core Traceability Matrix (GAP-01 through GAP-10)

The following matrix records all 10 verified technical findings and engineering remediations:

| Change ID  | Priority | Category           | Problem Statement & Code Reference                                                                                                                                                                                                                                           | Architectural Design Decision                                                                                                         | Target Implementation File(s)                                                                      | Verification Test Suite                            | Governance Gate & Approval Status                 |
| :--------- | :------- | :----------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------- | :------------------------------------------------- | :------------------------------------------------ |
| **GAP-01** | **P0**   | **Governance**     | LDR-001 through LDR-012 lack formal legal/DPO/CFO sign-offs in [data-retention-decision-register.md](file:///f:/CreatorConnect/docs/compliance/data-retention-decision-register.md).                                                                                         | Publish Executive Approval Package; enforce strict fail-closed boundary preventing unapproved erasures.                               | `docs/compliance/PHASE_3B_9_EXECUTIVE_APPROVAL_PACKAGE.md`                                         | Preflight compliance audit                         | **STAGE A COMPLETE** (Pending Executive Sign-Off) |
| **GAP-02** | **P0**   | **Security**       | Four-Eyes Deletion Protocol (TH-06) lacks formal AppSec technical review and signature contract.                                                                                                                                                                             | Formulate dual-authorization contract ($RequesterID \ne ApproverID$) with canonical payload hashing ($H$).                            | `docs/security/FOUR_EYES_DELETION_PROTOCOL_REVIEW.md`                                              | Security test specification                        | **STAGE A COMPLETE** (Pending AppSec Sign-Off)    |
| **GAP-03** | **P1**   | **Operations**     | Migration 0013 staging operator handoff is unexecuted and marked `BLOCKED`.                                                                                                                                                                                                  | Author 6-phase operational rehearsal runbook with pre-migration snapshot, positive allowlist, and 6 smoke journeys.                   | `docs/runbooks/MIGRATION_0013_STAGING_REHEARSAL_CHECKLIST.md`                                      | Synthetic smoke journeys 1–6                       | **STAGE A COMPLETE** (Pending Staging Window)     |
| **GAP-04** | **P1**   | **Database**       | Proposal named future retention migration `0014`, colliding with existing messaging migration `0014` and admin `0015`.                                                                                                                                                       | Formally designate future additive schema migration as `0016_data_retention_and_erasure`.                                             | `docs/database/migration-0014-design-proposal.md` -> rename to 0016                                | `prisma validate` & `prisma migrate status`        | **DOCUMENTED** (Enforced for Stage C)             |
| **GAP-05** | **P2**   | **Worker**         | Automated sweep for expired cooling-off erasure requests lacks an active BullMQ worker schedule.                                                                                                                                                                             | Implement `RetentionSweeperWorker` in `apps/worker` with configurable cron (e.g. `0 2 * * *`), keyset batches, and concurrency cap.   | `apps/worker/src/schedulers/retention-sweeper.worker.ts`                                           | `retention-sweeper.worker.spec.ts`                 | **ROADMAP (STAGE D)**                             |
| **GAP-06** | **P2**   | **Code Quality**   | [supabase-admin.service.ts](file:///f:/CreatorConnect/apps/api/src/modules/lifecycle/supabase-admin.service.ts#L132) duplicates retry backoff logic already implemented in [outbox.repository.ts](file:///f:/CreatorConnect/packages/database/src/outbox.repository.ts#L54). | Extract `calculateRetryDelayMs` to `@creatorconnect/utils` and import in both `outbox.repository.ts` and `supabase-admin.service.ts`. | `packages/utils/src/retry-backoff.ts`, `apps/api/src/modules/lifecycle/supabase-admin.service.ts`  | `supabase-admin.spec.ts`, `outbox-backoff.spec.ts` | **ROADMAP (STAGE B)**                             |
| **GAP-07** | **P2**   | **Performance**    | [restore-sanitizer.ts](file:///f:/CreatorConnect/apps/api/src/modules/lifecycle/restore-sanitizer.ts#L60) reads all certificates via unpaginated `findMany` ($O(N)$ memory risk).                                                                                            | Implement keyset cursor pagination (`take: 100`, `cursor: { id }`) to guarantee $O(B)$ memory boundedness.                            | `apps/api/src/modules/lifecycle/restore-sanitizer.ts`                                              | `restore-sanitization.spec.ts`                     | **ROADMAP (STAGE B)**                             |
| **GAP-08** | **P2**   | **Data Integrity** | Predicate $PolicyApproved(P)$ is implicit; [privacy-request.service.ts](file:///f:/CreatorConnect/apps/api/src/modules/lifecycle/privacy-request.service.ts) does not persist explicit `policy_version`.                                                                     | Add `policyVersion: string` to `PrivacyRequestRecord` and assert against authoritative approved policy registry.                      | `apps/api/src/modules/lifecycle/privacy-request.service.ts`, `packages/contracts/src/lifecycle.ts` | `privacy-request.spec.ts`                          | **ROADMAP (STAGE B)**                             |
| **GAP-09** | **P3**   | **Architecture**   | [lifecycle.routes.ts](file:///f:/CreatorConnect/apps/api/src/modules/lifecycle/lifecycle.routes.ts#L45) bundles all 7 services and repositories into a single monolithic plugin options bag.                                                                                 | Split into focused sub-plugins: `userLifecycleRoutes`, `privacyRequestRoutes`, `adminLegalHoldRoutes`.                                | `apps/api/src/modules/lifecycle/routes/`                                                           | `lifecycle.routes.spec.ts`                         | **ROADMAP (STAGE B)**                             |
| **GAP-10** | **P3**   | **Testing**        | Lack of property-based invariant testing for account state transitions under randomized event sequences.                                                                                                                                                                     | Add `fast-check` to devDependencies of `@creatorconnect/testing`; assert invariant $Anonymized(u) \implies \neg Reactivatable(u)$.    | `packages/testing/src/invariants/lifecycle.invariants.spec.ts`                                     | Vitest property test suite                         | **ROADMAP (STAGE B)**                             |

---

## 3. Detailed Technical Remediation Designs (Stage B Preparation)

The following technical designs are fully specified and awaiting Stage B authorization:

### 3.1 Design Specification for GAP-06 (Retry/Backoff Consolidation)

- **Problem**: `SupabaseAdminService` defines private method `calculateDelay(attempt: number)` using exponential base 100ms and random jitter up to 50ms. `packages/database/src/outbox.repository.ts` defines `calculateRetryDelayMs(attempt, options)`.
- **Target Location**: Move `calculateRetryDelayMs` to `packages/utils/src/retry.ts`, exported via `@creatorconnect/utils`.
- **Dependency Flow**: `@creatorconnect/utils` is already a core dependency of both `@creatorconnect/database` and `@creatorconnect/api`. No cyclic dependency created.
- **Mathematical Invariant**:
  $$\forall k \ge 1, \quad 0 \le calculateRetryDelayMs(k, options) \le maxDelayMs$$
- **Backward Compatibility**: Fully backward-compatible; re-exported from `@creatorconnect/database` to preserve existing outbox processor imports.

### 3.2 Design Specification for GAP-07 (Restore Sanitizer Keyset Cursor Pagination)

- **Problem**: `RestoreSanitizerService.sanitizeRestoredDatabase` executes:
  ```typescript
  const certLogs = await this.prisma.auditLog.findMany({
    where: { action: 'PRIVACY_AUDIT_CERTIFICATE_ISSUED' },
  });
  ```
- **Remediation**: Keyset pagination with cursor on indexed `id`:
  ```typescript
  let cursor: string | undefined = undefined;
  const batchSize = 100;
  let hasMore = true;

  while (hasMore) {
    const certLogs = await this.prisma.auditLog.findMany({
      where: { action: 'PRIVACY_AUDIT_CERTIFICATE_ISSUED' },
      take: batchSize,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: 'asc' },
    });
    if (certLogs.length === 0) break;
    for (const log of certLogs) {
      // process log
    }
    cursor = certLogs[certLogs.length - 1].id;
    hasMore = certLogs.length === batchSize;
  }
  ```
- **Complexity**: Bounded memory $O(B)$ where $B=100$. Database execution plan utilizes B-tree primary key index on `audit_logs(id)`.

### 3.3 Design Specification for GAP-08 (Explicit Policy Version Binding)

- **Problem**: `PrivacyRequestRecord` stores `requestType` and timestamps, but lacks an immutable reference to the governing policy version approved by Legal.
- **Remediation**:
  1. Add `policyVersion: string` to `PrivacyRequestRecord` interface in `@creatorconnect/contracts`.
  2. In `PrivacyRequestService.requestErasure`, validate `policyVersion` against an approved policy enum:
     ```typescript
     export const APPROVED_RETENTION_POLICIES = new Set(['POL-RET-2026-V1']);
     if (!APPROVED_RETENTION_POLICIES.has(policyVersion)) {
       throw new UnapprovedPolicyError(
         `Retention policy "${policyVersion}" is not approved for execution.`,
       );
     }
     ```
  3. Fail-Closed Invariant: If `policyVersion` is unapproved or mismatched, $Eligible(R, P, t) = false$.

### 3.4 Design Specification for GAP-09 (Lifecycle Route Modularization)

- **Problem**: `lifecycle.routes.ts` is 489 lines long and passes 7 distinct services via `LifecycleRoutesOptions`.
- **Remediation**: Split into 4 sub-plugins under `apps/api/src/modules/lifecycle/routes/`:
  1. `user-lifecycle.routes.ts`: `/api/v1/users/me/deactivate`, `/api/v1/users/me/reactivate`
  2. `privacy-request.routes.ts`: `/api/v1/privacy/erasure-request`, `/confirm`, `/cancel`, `/status`
  3. `admin-legal-hold.routes.ts`: `/api/v1/admin/users/:id/legal-holds` (POST, DELETE, GET)
  4. `admin-erasure.routes.ts`: `/api/v1/admin/privacy/requests/:id/execute`
  5. `public-receipt.routes.ts`: `/api/v1/privacy/verify-receipt`
- **Compatibility**: Preserves all existing URL paths, HTTP methods, TypeBox schemas, and RFC 7807 problem details.

---

## 4. Stage A Acceptance Verification

All acceptance criteria for Stage A have been verified:

- [x] All 12 decisions (LDR-001 through LDR-012) accurately presented with neutral options and risk analysis.
- [x] Zero approvals fabricated; all determinations remain `PENDING_APPROVAL`.
- [x] Four-Eyes protocol specification formulated addressing threat TH-06 and dual-authorization.
- [x] Migration 0013 staging rehearsal runbook prepared with positive allowlist and 6 smoke journeys.
- [x] Engineering change register captures GAP-01 through GAP-10 with full traceability.
- [x] Zero application code, schema mutations, or database migrations executed.
- [x] All existing developer modifications in working tree strictly preserved.

**Stage A Status**: **`ACCEPTED — READY FOR EXECUTIVE GOVERNANCE REVIEW`**
