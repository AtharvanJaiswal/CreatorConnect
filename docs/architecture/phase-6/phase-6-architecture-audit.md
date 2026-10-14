# CreatorConnect — Phase 6 Architecture & Dependency Audit

**Audit Baseline Commit:** `4e5cb2241aae58dbf605e2ffd8a2793a7db09fbb`  
**Integration Branch:** `dev` (Audit Branch: `audit/phase-6-financial-security-readiness`)  
**Auditor Roles:** Principal Software Architect & SRE Lead  
**Scope:** Complete request-to-database execution path across Projects, Deliverables, Payments, Ledger, Disputes, Cancellations, Refunds, Reviews, Reputation, and Concurrency Hardening.

---

## 1. Executive Summary & System Overview

CreatorConnect Phase 6 integrates five sequential business increments into the core modular monolith architecture:

1. **Increment 1:** Projects and Deliverables (`projects`, `deliverables`, `assignments`)
2. **Increment 2:** Payments, Double-Entry Ledger, and Escrow Foundation (`payment_intents`, `ledger_accounts`, `ledger_entries`, `ledger_transactions`)
3. **Increment 3:** Disputes, Cancellations, and Refunds (`disputes`, `dispute_evidence`, `project_cancellations`, `refunds`)
4. **Increment 4:** Reviews, Reputation, and Governance (`reviews`, `review_reports`, `reputation_scores`)
5. **Increment 5:** Financial Concurrency, Reconciliation, and Release Hardening (`PostgresContainerResolver`, transactional refund reservation, cumulative fee reversal reconciliation, admin reconciliation API)

The architecture strictly adheres to established architectural boundaries:

- **Durable Source of Truth:** PostgreSQL (48 relational tables, Prisma ORM with additive migrations).
- **Core Business Engine:** Fastify modular monolith (`apps/api`), partitioned into distinct business domains (`projects`, `payments`, `disputes`, `reviews`, `users`, `auth`).
- **Asynchronous Transport & PubSub:** Redis 7 (used strictly for ephemeral distributed locking, rate-limiting, and PubSub socket delivery).
- **Domain Event Reliability:** Transactional Outbox pattern (`outbox_events` table) with BullMQ workers (`apps/worker`), ensuring zero domain-event loss across process restarts.
- **Contract Integrity:** TypeBox validation schemas (`packages/contracts`) shared across server routes and frontend consumers.
- **Authentication & RBAC:** Supabase Auth JWTs verified with asymmetric JWKS via `@creatorconnect/auth`, using CASL-based authorization rules.

---

## 2. Request-to-Database Execution Paths

Across all Phase 6 workflows, the system enforces a uniform unidirectional execution flow:

```
HTTP / Webhook Entry Point (Fastify Route)
        ↓
Authentication & JWT Claims Verification (`@creatorconnect/auth`)
        ↓
Contract Schema Validation (`@sinclair/typebox` via Fastify schema)
        ↓
Authorization & Participant Ownership Policy (`AbilityFactory` & Route Guards)
        ↓
Application / Domain Service (`apps/api/src/modules/*/`)
        ↓
PostgreSQL Transaction & Row-Lock Hierarchy (`SELECT ... FOR UPDATE`)
        ↓
Transactional Outbox Event Creation (`outbox_events` table)
        ↓
Post-Commit Background Worker (`apps/worker`) / Provider Dispatch
        ↓
Reconciliation & Audit Trail Logging (`audit_logs` & `ledger_entries`)
```

### 2.1 Trace: Project Creation to Escrow Funding

1. **Entry Point:** `POST /api/v1/projects` & `POST /api/v1/payments/intents`
2. **Auth & Ownership:** Only authenticated `BRAND` or assigned client can initiate payment intents.
3. **Transaction Boundary:** Enclosed in `prisma.$transaction`.
4. **Lock Order:** `projects` (`SELECT ... FOR UPDATE`) $\rightarrow$ `payment_intents` $\rightarrow$ ledger accounts.
5. **Ledger Posting:** Automatically creates balanced `LedgerTransaction` credit to `PROJECT_ESCROW` and debit to `PAYMENT_CLEARING`.
6. **Outbox Event:** `PAYMENT_INTENT_SUCCEEDED` queued atomically in `outbox_events`.

### 2.2 Trace: Deliverable Submission & Approval to Escrow Release

1. **Entry Point:** `POST /api/v1/projects/:id/deliverables` (creator submission) and `POST /api/v1/projects/:id/release` (client release).
2. **State Guards:** Deliverable must be in `IN_REVIEW`; project must be `IN_PROGRESS` or `SUBMITTED`.
3. **Dispute Check:** Release endpoint actively rejects with `400` if project status is `DISPUTED` or if any `PENDING` or `PROCESSING` refund reservations exist.
4. **Ledger Movement:** Debit `PROJECT_ESCROW`, Credit `CREATOR_PAYABLE` (net milestone) and `PLATFORM_REVENUE` (fee portion).

### 2.3 Trace: Dispute, Cancellation & Dynamic Refund

1. **Entry Point:** `POST /api/v1/disputes` and `POST /api/v1/projects/:id/refunds`.
2. **Pre-Provider Reservation:** Database transaction sets `Refund.status = PENDING` and decrements releasable project escrow before calling payment gateway.
3. **Provider Call:** Isolated outside long-running database locks. If ambiguous timeout occurs, refund status remains `PROCESSING` with diagnostic error preserved.
4. **Cumulative Fee Reversal:** Calculates cumulative platform fee reversal:
   $$T(C) = \left\lfloor \frac{C \cdot F}{A} \right\rfloor$$
   Guarantees zero fractional leakage and precise final reconciliation.
5. **Ledger Reversal:** Creates compensating `LedgerTransaction` referencing original intent and refund ID.

---

## 3. Dependency Direction & Layering Audit

| Layer                   | Directory Path                     | Permitted Dependencies                 | Audit Finding                                                       | Status   |
| :---------------------- | :--------------------------------- | :------------------------------------- | :------------------------------------------------------------------ | :------- |
| **Contracts**           | `packages/contracts`               | TypeBox, zero runtime app dependencies | No internal API or DB imports discovered. Clean DTO contracts.      | **PASS** |
| **Database**            | `packages/database`                | Prisma Client, migrations              | Encapsulates schema definitions and client factory.                 | **PASS** |
| **Auth**                | `packages/auth`                    | `@casl/ability`, `jose`, contracts     | Pure token verification and authorization policies.                 | **PASS** |
| **API Domain Services** | `apps/api/src/modules/`            | Contracts, database, auth, utils       | Business rules reside strictly in services, not routes.             | **PASS** |
| **API Routes**          | `apps/api/src/modules/*/routes.ts` | Fastify, domain services, contracts    | Handlers orchestrate schema validation and delegate to services.    | **PASS** |
| **Background Worker**   | `apps/worker/src/`                 | BullMQ, database, contracts            | Workers call domain service handlers; no duplicated business logic. | **PASS** |

### Violations Checked & Verified Absent:

- **No Route-Level SQL/Prisma bypass:** All database mutations in Phase 6 execute via domain services or structured repositories.
- **No Provider SDK Leakage:** The `PaymentProvider` interface in `apps/api/src/modules/payments/provider.ts` abstracts Razorpay details behind clean generic contracts (`createOrder`, `capturePayment`, `createRefund`).
- **No Circular Imports:** Clean module graph verified by `turbo run build` and TypeScript compiler project references.

---

## 4. Code Reusability & DRY Compliance

1. **Monetary Arithmetic:** All money handling across payments, ledger, disputes, and refunds strictly uses integer minor units (paise). Verified against floating-point leakage.
2. **Idempotency Utility:** SHA-256 canonical hashing utility (`IdempotencyService`) is reused across webhook ingestion and refund dispatch.
3. **Outbox Dispatcher:** Common outbox event persistence pattern is used uniformly by Projects, Payments, Disputes, and Reviews.
4. **Error Classification:** Provider-level errors map deterministically to RFC 7807 problem details (`400 BAD_REQUEST`, `409 CONFLICT`, `422 UNPROCESSABLE_ENTITY`, `502 BAD_GATEWAY`).

---

## 5. Architectural Findings & Verdict

- **AF-01 (Info - Container Discovery in Test Runners):** Container name differences between local Docker Compose (`creatorconnect-postgres`) and CI dynamic naming (`github-actions-service-postgres`) have been cleanly resolved via `PostgresContainerResolver`, ensuring identical test behavior across local and CI environments.
- **AF-02 (Low - Lock Timeout Documentation):** Explicit `FOR UPDATE` queries utilize PostgreSQL transaction scope. Default lock timeout is governed by Postgres connection configuration.

**Architectural Audit Verdict:** **PASSED**. The Phase 6 implementation is structurally sound, adheres to SOLID principles, maintains strict layer separation, and preserves the modular monolith architecture.
