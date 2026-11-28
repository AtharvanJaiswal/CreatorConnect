# CreatorConnect: Admin Testing Strategy & Verification Harness

Authoritative testing guide, test suite organization, and execution methodology for the CreatorConnect administration system.

---

## 1. Quality Assurance Philosophy & Guardrails

The administrative test suite verifies both the positive business logic and negative security barriers:

1. **Deny-by-Default Authentication & Authorization**: Every endpoint is explicitly tested for `401 Unauthorized` without credentials and `403 Forbidden` when called by unauthorized authenticated users or administrators lacking the specific fine-grained permission.
2. **Deterministic Anti-Self-Approval Verification**: The finance test suite deterministically verifies that attempting to self-approve an administrative refund fails with `403 Conflict Of Interest`.
3. **Concurrency & Lockout Guards**: The RBAC suite executes concurrent mutual role revocation requests to prove that PostgreSQL row-level locking (`SELECT ... FOR UPDATE OF u`) prevents race conditions that could eliminate the last active Super Administrator.
4. **Data Isolation Tests**: Support ticket test suites prove that internal notes (`isInternal: true`) are never returned to customer inquiries while remaining visible to staff.
5. **Exact Integer Arithmetic**: Financial reconciliation tests prove balance calculations using integer minor units (paisa) without floating-point artifacts.

---

## 2. Test Suite Inventory

| Test File                                                 | Milestone   | Focus Area                                                          | Tests  | Status        |
| :-------------------------------------------------------- | :---------- | :------------------------------------------------------------------ | :----- | :------------ |
| `src/modules/admin/rbac/admin-rbac.spec.ts`               | Milestone 1 | Roles, permissions, assignments, last super admin guard             | 9      | **PASS**      |
| `src/modules/admin/dashboard/admin-dashboard.spec.ts`     | Milestone 2 | Aggregations, Redis caching, period filters                         | 7      | **PASS**      |
| `src/modules/admin/users/admin-users.spec.ts`             | Milestone 2 | Directory search, suspension, reactivation                          | 9      | **PASS**      |
| `src/modules/admin/marketplace/admin-marketplace.spec.ts` | Milestone 3 | Creator verification, client verification, project moderation       | 9      | **PASS**      |
| `src/modules/admin/finance/admin-finance.spec.ts`         | Milestone 4 | Payments, dual-approval refunds, anti-self-approval, reconciliation | 9      | **PASS**      |
| `src/modules/admin/moderation/admin-moderation.spec.ts`   | Milestone 5 | Reports queue, moderation actions, review audits, support isolation | 10     | **PASS**      |
| `src/modules/admin/config/admin-config.spec.ts`           | Milestone 6 | Settings versioning, rollback, campaigns, worker queues             | 12     | **PASS**      |
| **TOTAL**                                                 | —           | —                                                                   | **65** | **100% PASS** |

---

## 3. How to Execute Tests

### 3.1 Running the Complete Admin Suite Sequentially

Because administrative tests verify PostgreSQL transactional invariants and user state against local PostgreSQL (`localhost:5433`), sequential execution (`--fileParallelism=false`) prevents database cross-talk:

```bash
pnpm --filter @creatorconnect/api exec vitest run --fileParallelism=false src/modules/admin/
```

### 3.2 Running an Individual Module Test

```bash
# Admin RBAC & Security
pnpm --filter @creatorconnect/api exec vitest run src/modules/admin/rbac/admin-rbac.spec.ts

# Financial & Escrow Operations
pnpm --filter @creatorconnect/api exec vitest run src/modules/admin/finance/admin-finance.spec.ts

# Trust, Safety & Support Isolation
pnpm --filter @creatorconnect/api exec vitest run src/modules/admin/moderation/admin-moderation.spec.ts

# Platform Settings & Broadcasts
pnpm --filter @creatorconnect/api exec vitest run src/modules/admin/config/admin-config.spec.ts
```

### 3.3 Running Monorepo Typecheck

```bash
pnpm turbo typecheck
```
