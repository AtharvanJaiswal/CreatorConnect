# CreatorConnect — Administration Security Model

## Threat Model, Authorization Guards & Hardening Specifications

**Phase:** Phase 4 Platform Administration  
**Status:** IMPLEMENTED & AUDITED  
**Audience:** Platform Architects, Security Engineers & DevOps

---

## 1. Threat Modeling & Attack Surfaces

The administrative interface controls high-impact capabilities: account deactivations, financial refunds, ledger reconciliation, user data exports, and platform configuration. The administrative threat model addresses six principal attack vectors:

|  Threat Code  | Threat Description                               | Attack Vector                                                                                                                        | Mitigation in CreatorConnect                                                                                                                                                                                                                                                       |
| :-----------: | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **THREAT-01** | **Privilege Escalation**                         | Low-privilege user or support agent attempts to assign themselves `SUPER_ADMIN` or call financial APIs.                              | Two-tier RBAC (`RoleType.ADMIN` + `requireAdminPermission`). Server-side validation rejects any attempt by non-super-admins to grant `SUPER_ADMIN`. Client-provided roles are never trusted.                                                                                       |
| **THREAT-02** | **Account Lockout / DoS**                        | Malicious or rogue administrator deactivates or revokes the last remaining Super Administrator, rendering the platform unmanageable. | Database-level pessimistic row locking (`SELECT ... FOR UPDATE OF u`) inside PostgreSQL transactions enforces the last active Super Admin and last active Admin invariants.                                                                                                        |
| **THREAT-03** | **Unauthorized Financial Drainage**              | Compromised admin account issues unauthorized refunds directly to client accounts.                                                   | All refunds pass through `LedgerService` and `IdempotencyService`. High-value refunds require dual approval from an independent administrator (`AdminActionApproval`). Anti-self-approval rule prevents administrators from approving their own refund requests.                   |
| **THREAT-04** | **Stale Credential / Suspended Operator Access** | Revoked or suspended administrator continues executing API calls using cached JWTs or Redis sessions.                                | PostgreSQL is the sole, authoritative source of truth for account status. `fastify.authenticate` queries PostgreSQL directly on every privileged request. `SUSPENDED` and `DEACTIVATED` accounts are immediately blocked. Role updates trigger immediate Redis cache invalidation. |
| **THREAT-05** | **Sensitive Data Leakage / PII Exfiltration**    | Admin directory search leaks user passwords, raw tokens, or private messages.                                                        | Passwords and provider tokens are never stored in the application database. Private chat messages are excluded from general admin views. Responses are filtered through strict TypeBox serialization schemas.                                                                      |
| **THREAT-06** | **Audit Log Tampering / Repudiation**            | Operator performs unauthorized actions and deletes audit log entries to prevent forensic detection.                                  | The `AuditLog` table is append-only from the application perspective. No update or delete methods exist in the API or repository layer. All administrative mutations record actor ID, target entity, timestamp, IP, and reason.                                                    |

---

## 2. Authorization Enforcement Protocol

Every administrative request to `/api/v1/admin/*` must pass through the following sequential security pipeline:

```
[Incoming HTTP Request]
          │
          ▼
1. Transport & Network Security
   - Enforce HTTPS / TLS 1.3
   - CORS validation (Wildcard '*' strictly rejected in production)
   - Helmet HTTP header sanitization
   - Distributed Redis rate-limiting (Token-bucket per IP / actor)
          │
          ▼
2. Cryptographic Authentication (`fastify.authenticate`)
   - Extract Bearer JWT from Authorization header
   - Validate token signature against cached Supabase JWKS
   - Check token expiration (exp), issuer (iss), and audience (aud)
          │
          ▼
3. PostgreSQL Authoritative Account Status Check
   - Resolve user's supabaseAuthId
   - Query `userRepo.getStatusBySub(sub)` directly in PostgreSQL
   - IF status == 'SUSPENDED' ──► REJECT (HTTP 403 USER_SUSPENDED)
   - IF status == 'DEACTIVATED' ─► REJECT (HTTP 403 USER_DEACTIVATED)
   - IF status != 'ACTIVE' ──────► REJECT (HTTP 403)
          │
          ▼
4. Identity Hydration & CASL Compilation
   - Load UserIdentity (roles, adminRoles, adminPermissions)
   - Compile CASL AppAbility rules
   - Attach to request context (`request.user`, `request.ability`)
          │
          ▼
5. Global Admin Role Gate
   - Check IF 'ADMIN' in request.user.roles
   - IF NOT ──► REJECT (HTTP 403 AUTH_INSUFFICIENT_ROLE)
          │
          ▼
6. Granular Administrative Permission Gate (`requireAdminPermission(perm)`)
   - Check IF request.user.adminRoles contains 'SUPER_ADMIN' ──► PASS
   - Check IF request.user.adminPermissions contains '*' ─────► PASS
   - Check IF request.user.adminPermissions contains 'perm' ───► PASS
   - ELSE ──► REJECT (HTTP 403 AUTH_INSUFFICIENT_ROLE: Access requires administrative permission: {perm})
          │
          ▼
7. Schema Validation & Domain Execution
   - Compile TypeBox request body, query, and params schemas
   - Execute domain operation within PostgreSQL transaction if mutating
   - Transactionally record immutable AuditLog entry
          │
          ▼
[HTTP 200 / 201 Response with Filtered DTO]
```

---

## 3. Financial Integrity & Anti-Fraud Controls

1. **Balanced Double-Entry Accounting**:
   - Every financial state change (deposits, escrow locks, deliverable releases, refunds, platform commissions) creates balanced debit and credit entries ($\sum \text{debits} \equiv \sum \text{credits}$) in the immutable ledger.
   - Balances are never modified through direct `UPDATE` statements on balance columns.
2. **Minor Currency Units**:
   - All amounts are stored and calculated as integers in the lowest currency denomination (paisa for INR).
   - Floating-point arithmetic (`Math.round(a * b)`) is strictly prohibited for money to prevent cumulative rounding discrepancies.
3. **Dual Approval for High-Value Mutations**:
   - High-value refunds (e.g. $> \text{₹}50,000$ / $5,000,000$ paisa) require two independent administrators:
     1. Administrator A initiates the refund (`payments.refund.request`), creating a `PENDING` `AdminActionApproval` record.
     2. Administrator B reviews and approves/rejects the request (`payments.refund.approve`).
   - Anti-Self-Approval: The system strictly validates that `decidedById !== requestedById`. An administrator cannot approve their own financial requests.

---

## 4. Privacy & Data Handling Controls

1. **Role-Based Data Redaction**:
   - User email and phone numbers are visible only to roles with `users.read` clearance.
   - Financial ledger account details are visible only to roles with `payments.read` clearance.
   - Support internal notes (`isInternal: true`) are stripped by database query projection from all customer-facing endpoints and returned only to authorized staff.
2. **Legal Holds & Statutory Retention**:
   - If an account is placed under a statutory legal hold (`LegalHoldService`), data erasure workflows are permanently blocked until an authorized compliance officer formally releases the hold.
   - Financial records are retained for the mandatory statutory period (e.g. 8 years under Income Tax and Companies Act regulations) regardless of GDPR/DPDP account deletion requests.
