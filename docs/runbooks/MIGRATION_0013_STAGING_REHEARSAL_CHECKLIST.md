# CreatorConnect — Migration 0013 Staging Operational Rehearsal Runbook

## Support Ticketing Schema Deployment, Rollback Guardrails & Smoke Test Checklist

> **Document Status**: `STAGING REHEARSAL SPECIFICATION — EXECUTION PENDING CHANGE APPROVAL`  
> **Evaluation Date**: November 24, 2026  
> **Target Subsystem**: Support Ticketing Database Migration & Fastify Service Integration  
> **Related Phase**: Phase 3B.9 (Stage A Deliverable)  
> **Target Environment**: Staging VPC (`us-east-1` / `creatorconnect-staging-aurora`)  
> **Audience**: Staging Operators, SREs, DevOps Engineers, Release Managers  
> **Strict Operational Guardrail**: **This document defines the procedure for staging execution only. DO NOT EXECUTE on production. DO NOT EXECUTE on staging without an approved Change Management ticket.**

---

## 1. Executive Summary & Purpose

This operational runbook provides the audited, step-by-step procedure for authorized staging operators to rehearse the deployment, validation, and forward-recovery of **Migration 0013 (`0013_add_support_ticketing`)** on staging infrastructure.

### Rehearsal Objectives:

1. Validate additive DDL execution against a multi-gigabyte PostgreSQL 16 cluster without table rewrite locks.
2. Confirm zero schema drift against Prisma schema baseline (`0001` through `0012`).
3. Verify cluster snapshot creation and Point-In-Time Recovery (PITR) restore boundaries.
4. Execute synthetic end-to-end smoke tests (customer ticket creation, anti-IDOR isolation, staff internal note shielding, and outbox event dispatch).
5. Document all operational evidence required for final Stage A sign-off.

---

## 2. Environment Identifiers & Access Guardrails

All operations must execute strictly within the staging security boundary. Hardcoded credentials, plain-text passwords, and raw database URLs are strictly prohibited.

| Parameter                   | Approved Staging Specification                            | Verification Command                                                       |
| :-------------------------- | :-------------------------------------------------------- | :------------------------------------------------------------------------- |
| **AWS Region**              | `us-east-1`                                               | `aws configure get region`                                                 |
| **Target AWS Account**      | `<STAGING_AWS_ACCOUNT_ID>`                                | `aws sts get-caller-identity --query "Account" --output text`              |
| **IAM Execution Role**      | `arn:aws:iam::<STAGING_ACCOUNT>:role/StagingOperatorRole` | `aws sts get-caller-identity --query "Arn" --output text`                  |
| **Aurora Cluster Endpoint** | `<STAGING_AURORA_CLUSTER_ENDPOINT>`                       | Strict positive host extraction allowlist check                            |
| **Target Database Name**    | `creatorconnect_staging`                                  | Verified via in-memory connection subshell                                 |
| **ElastiCache Redis ID**    | `creatorconnect-staging-redis`                            | `aws elasticache describe-cache-clusters`                                  |
| **ECS API Service**         | `creatorconnect-staging-api`                              | `aws ecs describe-services --cluster creatorconnect-staging-ecs`           |
| **Secrets Manager Key**     | `staging/creatorconnect/db`                               | `aws secretsmanager describe-secret --secret-id staging/creatorconnect/db` |

---

## 3. Migration 0013 Technical Specification

- **Migration File**: `packages/database/prisma/migrations/0013_add_support_ticketing/migration.sql`
- **Database Engine Compatibility**: PostgreSQL 15+, PostgreSQL 16 (Aurora PostgreSQL Compatible).
- **DDL Classification**: **Strictly Additive**. Creates new objects without modifying or dropping existing columns or constraints:
  - 3 New Enum Types: `TicketStatus`, `TicketPriority`, `TicketCategory`.
  - 3 New Tables: `support_tickets`, `support_ticket_messages`, `support_ticket_audits`.
  - Foreign Keys: `requesterId -> users(id)` (`ON DELETE CASCADE`), `authorId -> users(id)` (`ON DELETE RESTRICT`), `actorId -> users(id)` (`ON DELETE RESTRICT`).
  - 6 B-Tree Indexes: `support_tickets(requester_id, status)`, `support_tickets(assigned_to_id, status)`, `support_tickets(status, priority)`, `support_ticket_messages(ticket_id, created_at)`, `support_ticket_audits(ticket_id, created_at)`, `support_ticket_audits(actor_id)`.
- **Locking & Duration Impact**:
  - `CREATE TABLE` and `CREATE INDEX` on new empty tables acquire `AccessExclusiveLock` exclusively on the newly created tables.
  - Foreign key verification attaches `ShareRowExclusiveLock` on `users` table for metadata validation only ($< 5 \text{ ms}$ catalog lock).
  - Expected execution duration: **$< 250 \text{ ms}$**. Zero disruption to existing active traffic.

---

## 4. Backup & Recovery Principles: Application vs. Database Rollback

> [!WARNING]
> **CRITICAL RECOVERY DISTINCTION: CODE ROLLBACK VS. SCHEMA ROLLBACK**:
>
> 1. **Application Code Rollback**: Reverting an ECS task definition or container deployment to a prior image hash stops new application code from querying support tables. It is **safe, instantaneous, and non-destructive**.
> 2. **Prohibition on Destructive Schema Rollback**: Reversing a migration via `prisma migrate reset` or `DROP TABLE` is **STRICTLY PROHIBITED**. It permanently destroys audit history, ticket communications, and leaves dangling references.
> 3. **Forward Recovery as Primary Remedy**: Because Migration 0013 is strictly additive, older application versions that do not query support tables operate normally even if Migration 0013 is applied. If a code defect is identified, the approved operational path is an application container rollback, leaving the database tables intact.

---

## 5. Structured 6-Phase Staging Rehearsal Checklist

```
================================================================================
PHASE 1: PRE-EXECUTION PREREQUISITES & ACCESS VERIFICATION
================================================================================
[ ] 1.1 Verify active AWS IAM identity:
        CALLER_ARN=$(aws sts get-caller-identity --query "Arn" --output text)
        Ensure ARN matches approved StagingOperatorRole (PROD ACCESS PROHIBITED).
[ ] 1.2 Verify workstation ambient environment is cleared:
        unset DATABASE_URL REDIS_URL SUPABASE_SERVICE_ROLE_KEY
[ ] 1.3 Verify VPN / Tailscale connection to Staging VPC CIDR.
[ ] 1.4 Verify approved Change Management Ticket ID: Ref #CHG-2026-XXXX.

================================================================================
PHASE 2: PRE-MIGRATION BACKUP & STATE CAPTURE
================================================================================
[ ] 2.1 Create pre-migration Aurora cluster snapshot:
        SNAPSHOT_ID="pre-0013-support-ticketing-$(date +%Y%m%d-%H%M%S)"
        aws rds create-db-cluster-snapshot \
          --db-cluster-identifier "<STAGING_AURORA_CLUSTER_IDENTIFIER>" \
          --db-cluster-snapshot-identifier "$SNAPSHOT_ID" \
          --tags Key=Environment,Value=Staging Key=Trigger,Value=Migration-0013
[ ] 2.2 Wait for snapshot completion:
        aws rds wait db-cluster-snapshot-available --db-cluster-snapshot-identifier "$SNAPSHOT_ID"
[ ] 2.3 Record Point-In-Time Recovery (PITR) earliest and latest restorable times.
[ ] 2.4 Execute read-only migration status check:
        pnpm --filter @creatorconnect/database exec prisma migrate status
        Verify: Migrations 0001 through 0012 applied; exactly 0013 listed as PENDING.

================================================================================
PHASE 3: MIGRATION EXECUTION REHEARSAL
================================================================================
[ ] 3.1 Retrieve database secret into memory within an isolated subshell:
        export DATABASE_URL=$(aws secretsmanager get-secret-value \
          --secret-id "staging/creatorconnect/db" \
          --query 'SecretString' --output text | jq -r .DATABASE_URL)
[ ] 3.2 Execute positive allowlist check on database host (PROHIBIT WILDCARDS):
        DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|^postgresql://[^@]+@([^:/]+).*|\1|')
        if [[ "$DB_HOST" != "<STAGING_AURORA_CLUSTER_ENDPOINT>" ]]; then
          echo "FATAL: Database host does not match approved staging endpoint! Aborting." >&2
          unset DATABASE_URL; exit 1
        fi
[ ] 3.3 Apply migration 0013:
        pnpm --filter @creatorconnect/database exec prisma migrate deploy
        Expected Output: Applying migration `0013_add_support_ticketing` (1 migration applied).
[ ] 3.4 Confirm post-migration status:
        pnpm --filter @creatorconnect/database exec prisma migrate status
        Expected Output: "Database schema is up to date!" (0 unapplied migrations, 0 schema drift).
[ ] 3.5 Clear memory environment:
        unset DATABASE_URL

================================================================================
PHASE 4: CONTAINER DEPLOYMENT & HEALTH VERIFICATION
================================================================================
[ ] 4.1 Trigger rolling deployment for ECS API service:
        aws ecs update-service --cluster creatorconnect-staging-ecs \
          --service creatorconnect-staging-api --force-new-deployment
[ ] 4.2 Trigger rolling deployment for ECS Worker service:
        aws ecs update-service --cluster creatorconnect-staging-ecs \
          --service creatorconnect-staging-worker --force-new-deployment
[ ] 4.3 Verify Liveness and Readiness probes:
        curl -fsS https://staging-api.creatorconnect.com/health  # Returns HTTP 200 {"status":"ok"}
        curl -fsS https://staging-api.creatorconnect.com/ready   # Returns HTTP 200 {"status":"ready"}

================================================================================
PHASE 5: SYNTHETIC STAGING SMOKE TEST SUITE (6 JOURNEYS)
================================================================================
[ ] 5.1 Journey 1: Customer Ticket Creation
        - Call POST /api/v1/support/tickets with customer JWT.
        - Verify HTTP 201 Created; response contains ticket number (SUP-YYYY-XXXXX), status OPEN, version 1.
[ ] 5.2 Journey 2: Anti-IDOR Authorization Enforcement
        - Call GET /api/v1/support/tickets/:id using Customer B token on Customer A ticket.
        - Verify HTTP 403 Forbidden (SUPPORT_TICKET_FORBIDDEN); zero metadata leaked.
[ ] 5.3 Journey 3: Customer Public Message Submission
        - Call POST /api/v1/support/tickets/:id/messages with customer token.
        - Verify HTTP 201 Created; authorRole CUSTOMER, isInternal false.
[ ] 5.4 Journey 4: Staff Public Response & Internal Note Shielding
        - Call POST /api/v1/staff/support/tickets/:id/messages with staff token (isInternal = true).
        - Fetch as Customer A: verify HTTP 200; public messages visible, 0 internal notes exposed.
        - Fetch as Staff: verify HTTP 200; internal notes present with actor attribution.
        - Verify Socket.IO: customer room receives public reply; zero internal note socket emissions.
[ ] 5.5 Journey 5: Optimistic Concurrency & Safe Cleanup
        - Staff updates ticket with stale expectedVersion: 1 (current is 2).
        - Verify HTTP 409 Conflict (SUPPORT_TICKET_CONFLICT).
        - Authorized transition to RESOLVED (HTTP 200, version 3). Zero destructive row deletes.
[ ] 5.6 Journey 6: Outbox Event Processing
        - Query outbox_events on staging DB: verify support.ticket.* events marked PUBLISHED.
        - Worker logs show clean event dispatch with zero unhandled rejections.

================================================================================
PHASE 6: POST-REHEARSAL EVIDENCE CAPTURE & SIGN-OFF
================================================================================
[ ] 6.1 Archive execution evidence to change management ticket:
        - Snapshot ARN: arn:aws:rds:us-east-1:<ACCOUNT>:cluster-snapshot:pre-0013-...
        - Migration terminal log output (sha256 hash of log file).
        - ECS task definition revision IDs.
        - Synthetic smoke test correlation IDs (reqId headers).
[ ] 6.2 Confirm zero stop conditions or anomalies encountered.
[ ] 6.3 Staging Lead & Release Manager record formal rehearsal completion sign-off.
================================================================================
```

---

## 6. Staging Rehearsal Readiness Determination

**Current Gate Status**: **`REHEARSAL SPECIFICATION COMPLETE — AWAITING STAGING CHANGE WINDOW`**  
The runbook is hardened, verified against source code, and ready for operator execution upon receipt of Stage A governance approvals.
