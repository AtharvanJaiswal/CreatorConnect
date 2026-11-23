# CreatorConnect — Migration 0014 Technical Design Proposal

## Data Retention, Account Erasure & Privacy Schema Architecture

> **Document Status**: `DESIGN SPECIFICATION ONLY — NOT APPLIED (PHASE 3B.8.4 AUDITED)`  
> **Target Release**: Future Phase 3B.9 (Post Legal & Security Approval)  
> **Related Phase**: Phase 3B.8 / Phase 3B.8.1 / Phase 3B.8.2 / Phase 3B.8.3 / Phase 3B.8.4  
> **Strict Change Control**: This document represents a technical proposal. **Migration 0014 has NOT been created, generated, or executed.** Applying this migration remains strictly blocked until formal written sign-offs are obtained from Legal & Compliance, Information Security, and Engineering Leadership. All 18 `ON DELETE RESTRICT` foreign key constraints remain active in production.

---

# 1. DESIGN OBJECTIVES & CORE RATIONALE

The existing database schema (migrations `0001` through `0013`) lacks:

1. A user-level soft-deletion indicator on the `users` table (`deleted_at` is absent).
2. A formal state machine for handling statutory cooling-off windows during Right to Erasure requests.
3. A relational structure to record and enforce litigation holds and statutory audit exemptions.
4. A tamper-evident audit ledger to record proof of erasure compliance without storing plaintext personal data.

### 1.1 Architectural Principle: Relational Preservation Over Destruction

Direct execution of `DELETE FROM users WHERE id = :id` fails with PostgreSQL error `23503` due to `ON DELETE RESTRICT` constraints across 18 models (Support ticket messages, audits, applications, projects, deliverable submissions, disputes, reviews).

Rather than degrading foreign key constraints to `SET NULL` (which breaks business accountability) or `CASCADE` (which destroys financial and dispute history), **Migration 0014 evaluates an in-place irreversible pseudonymization model**:

- Relational foreign keys are preserved intact (`ON DELETE RESTRICT` remains active).
- Personal identifiers in `users` and profile models are overwritten with irreversible cryptographic tombstones.
- Transactional and audit integrity is maintained for tax and legal compliance.

### 1.2 Explicit Rejection of Universal Zero-UUID Tombstone Pattern

An alternative proposal suggested repointing all foreign keys referencing a deleted user to a single shared sentinel UUID (e.g., `00000000-0000-0000-0000-000000000000`). **This proposal is strictly rejected** for the following architectural and database integrity reasons:

1. **Unique Constraint Collisions**: Several junction and attribution tables enforce compound uniqueness including the `user_id` column (e.g., `user_roles(user_id, role_id)`, `saved_creators(brand_id, creator_id)`). Repointing multiple deleted users to a single zero-UUID violates these unique constraints and causes database write aborts.
2. **Self-Referential Relational Corruption**: In contracts, messages, and disputes involving two distinct deleted users (e.g., a dispute between a deleted brand and a deleted creator), repointing both foreign keys to the zero-UUID creates impossible self-disputes (`creator_id == brand_id == 00000000-0000-0000-0000-000000000000`), breaking reporting, bilateral ledger guarantees, and dispute audits.
3. **Severe Hot-Spot Lock Contention**: Every subsequent query, cascade, or check touching the shared zero-UUID would contend for row-level locks on the single sentinel record in `users`, creating an extreme database throughput bottleneck.
4. **Attribution Indistinguishability**: Collapsing distinct historical entities into one identifier makes it impossible to verify whether two historical activities were conducted by the same or different counter-parties.

**Adopted Design**: Each deleted user retains their distinct, immutable UUID. The user record undergoes **in-place pseudonymization** with randomized tombstone values, and relational links remain preserved without collisions.

### 1.3 Concurrency Control & Parent-Row Locking Protocol

In PostgreSQL under `READ COMMITTED` or `REPEATABLE READ`, executing:

```sql
SELECT count(*) FROM legal_holds WHERE user_id = :userId AND status = 'ACTIVE' FOR UPDATE;
```

when **zero legal holds currently exist** acquires **zero row-level locks**. This introduces a critical **phantom insert vulnerability / TOCTOU race condition**: a concurrent transaction can insert a new legal hold immediately after the check, while the erasure worker proceeds to sanitize or delete data, resulting in unlawful spoliation of evidence.

To eliminate this vulnerability, Migration 0014 establishes a **mandatory parent-row locking protocol**:

1. **Lock Common Parent First**: Both hold creation and erasure execution must acquire an exclusive row-level lock on the common parent record in `users`:
   ```sql
   SELECT id FROM users WHERE id = :userId FOR UPDATE;
   ```
2. **Strict Lock Order to Prevent Deadlocks**: All transactions modifying user lifecycle, legal holds, or privacy requests must acquire locks in the exact hierarchical order:
   $$\text{users} \longrightarrow \text{legal\_holds} \longrightarrow \text{privacy\_requests}$$
   Acquiring locks in any other order is prohibited.
3. **Transaction Isolation**: Operations run under PostgreSQL `READ COMMITTED` isolation with explicit parent row-level locking (`FOR UPDATE`), ensuring serial execution for any single user without serializable snapshot conflicts.
4. **Fail-Closed on Unavailability**: If PostgreSQL or the legal hold verification service is unavailable, all erasure and hold mutations must abort and fail closed.

### 1.4 Phase 3B.8.3 Operational Schema Strategy (Zero-Migration Execution)

In Phase 3B.8.3, Migration 0014 is strictly **NOT authorized for creation or execution**. To deliver production-ready business logic, state machines, parent-row locking, and privacy audit certificates against migrations `0001` through `0013`, the platform implements an `AuditLog` metadata adapter architecture:

- `AuditLogLegalHoldRepository` stores and queries legal holds in the existing `audit_logs` table under action `USER_LEGAL_HOLD_APPLIED` and `USER_LEGAL_HOLD_RELEASED`.
- `AuditLogPrivacyRequestRepository` manages DSAR requests in `audit_logs`.
- `AuditLogPrivacyAuditCertificateRepository` records cryptographic proof receipts in `audit_logs`.
- All parent-row locking (`SELECT id FROM users WHERE id = :userId FOR UPDATE`) executes against the live `users` table.
- All in-place PII pseudonymization updates the existing columns of `users`, `creator_profiles`, and `brand_profiles`.

When Migration 0014 is approved in Phase 3B.9, the repository layer will transition from the `AuditLog` adapters to the dedicated `legal_holds`, `privacy_requests`, and `privacy_audit_certificates` tables with zero business logic rewrite.

---

# 2. CRITICAL FIELD & TABLE NECESSITY AUDIT

Before proposing new database objects, each candidate field and table was evaluated against existing schema equivalents to eliminate unnecessary schema bloat:

| Proposed Schema Object            | Business Justification                                                                                               | Existing Equivalent in Current Schema                                                   | Necessity Evaluation                                                                                                                                                                                                                               | Architectural Alternative                                                                                 | Approval Status                 |
| :-------------------------------- | :------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- | :------------------------------ |
| **`User.deleted_at`**             | Records the exact timestamp when a user entered terminal deletion state.                                             | None on `User`. Exists on `CreatorProfile`, `BrandProfile`, `Message`, `CommunityPost`. | **JUSTIFIED**: Standardizes soft-delete filtering across the platform.                                                                                                                                                                             | Reusing `User.status = 'DEACTIVATED'` and tracking deletion timestamp in `privacy_requests.completed_at`. | `REQUIRES_ENGINEERING_APPROVAL` |
| **`User.is_anonymized`**          | Boolean flag indicating whether personal profile data has been overwritten with tombstones.                          | None.                                                                                   | **POTENTIALLY REDUNDANT**: Can be derived from `status == 'DEACTIVATED'` combined with `privacy_requests.status == 'COMPLETED'`. If kept, strictly indicates destructive in-place pseudonymization has finalized.                                  | Omit column; rely on `users.status` and `privacy_requests.status == 'COMPLETED'`.                         | `REQUIRES_ENGINEERING_APPROVAL` |
| **`UserStatus.PENDING_DELETION`** | Allows the authentication middleware to reject user login with specific "Pending Deletion" error during cooling-off. | `UserStatus.DEACTIVATED` already exists.                                                | **OPTIONAL**: Can be achieved by setting `status = 'DEACTIVATED'` and storing deletion request state in `privacy_requests`.                                                                                                                        | Reuse `DEACTIVATED` status; look up active privacy request only during login.                             | `REQUIRES_ENGINEERING_APPROVAL` |
| **`privacy_requests`**            | Manages DSAR / Erasure lifecycle (confirmation codes, cooling-off end dates, cancellation).                          | None.                                                                                   | **JUSTIFIED**: Decouples multi-step erasure workflow from core user identity table.                                                                                                                                                                | Storing request state in `User` table (rejected: violates SRP and pollutes user model).                   | `REQUIRES_ENGINEERING_APPROVAL` |
| **`legal_holds`**                 | Records active litigation holds, dispute freezes, and statutory exceptions preventing erasure.                       | None.                                                                                   | **JUSTIFIED**: Supports multiple concurrent holds with distinct case references and audit trails. Prevents TOCTOU spoliation.                                                                                                                      | Offline ticketing (rejected: causes TOCTOU race conditions and spoliation risk).                          | `REQUIRES_LEGAL_APPROVAL`       |
| **`privacy_audit_certificates`**  | Proof of compliance ledger (Accountability Principle under GDPR Art. 5(2)). Stores zero personal data.               | `audit_logs` exists.                                                                    | **JUSTIFIED**: `audit_logs` has `userId` set to null on delete; dedicated certificate table provides non-repudiable receipt tokens using a **256-bit CSPRNG token** (`certificate_token VARCHAR(64)`), completely decoupled from user identifiers. | Writing compliance event to `audit_logs` with structured metadata.                                        | `REQUIRES_LEGAL_APPROVAL`       |

---

# 3. PROPOSED SCHEMA CHANGES (PRISMA SPECIFICATION)

```prisma
// ==============================================================================
// 1. UserStatus Enum Extension (Proposed Option A)
// ==============================================================================
enum UserStatus {
  ACTIVE
  SUSPENDED
  DEACTIVATED
  PENDING_DELETION // Evaluated: User has requested erasure; in cooling-off window
}

// ==============================================================================
// 2. User Model Additions (Additive & Backward-Compatible)
// ==============================================================================
model User {
  // Existing fields
  id             String     @id @db.Uuid
  supabaseAuthId String     @unique @map("supabase_auth_id") @db.VarChar(64)
  email          String     @unique @db.VarChar(255)
  firstName      String?    @map("first_name") @db.VarChar(100)
  lastName       String?    @map("last_name") @db.VarChar(100)
  avatarUrl      String?    @map("avatar_url") @db.VarChar(512)
  status         UserStatus @default(ACTIVE)
  createdAt      DateTime   @default(now()) @map("created_at")
  updatedAt      DateTime   @updatedAt @map("updated_at")

  // Proposed Additive Fields for Phase 3B.9
  deletedAt      DateTime?  @map("deleted_at")
  isAnonymized   Boolean    @default(false) @map("is_anonymized")

  // Relations
  privacyRequests PrivacyRequest[]
  legalHolds      LegalHold[]

  // Existing indexes + proposed deletion index
  @@index([email])
  @@index([supabaseAuthId])
  @@index([status, deletedAt]) // Proposed: Fast lookup for active accounts & retention sweeps
  @@map("users")
}

// ==============================================================================
// 3. PrivacyRequest Model (New Table: privacy_requests)
// ==============================================================================
enum PrivacyRequestType {
  ACCOUNT_DELETION
  DATA_EXPORT
  RECTIFICATION
}

enum PrivacyRequestStatus {
  PENDING_CONFIRMATION
  COOLING_OFF
  PROCESSING
  COMPLETED
  CANCELLED
  REJECTED_LEGAL_HOLD
}

model PrivacyRequest {
  id               String               @id @db.Uuid
  userId           String               @map("user_id") @db.Uuid
  requestType      PrivacyRequestType   @map("request_type")
  status           PrivacyRequestStatus @default(PENDING_CONFIRMATION)
  confirmationCode String?              @map("confirmation_code") @db.VarChar(64)
  confirmedAt      DateTime?            @map("confirmed_at")
  coolingOffEndsAt DateTime?            @map("cooling_off_ends_at")
  scheduledPurgeAt DateTime?            @map("scheduled_purge_at")
  completedAt      DateTime?            @map("completed_at")
  cancelledAt      DateTime?            @map("cancelled_at")
  rejectionReason  String?              @map("rejection_reason") @db.Text
  certificateToken String?              @map("certificate_token") @db.VarChar(64)
  metadata         Json?                @db.JsonB
  createdAt        DateTime             @default(now()) @map("created_at")
  updatedAt        DateTime             @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@index([userId, status])
  @@index([status, scheduledPurgeAt])
  @@map("privacy_requests")
}

// ==============================================================================
// 4. LegalHold Model (New Table: legal_holds)
// ==============================================================================
enum LegalHoldReason {
  ACTIVE_DISPUTE
  FINANCIAL_AUDIT
  LAW_ENFORCEMENT_REQUEST
  TRUST_SAFETY_INVESTIGATION
  TAX_INSPECTION
}

enum LegalHoldStatus {
  ACTIVE
  RELEASED
}

model LegalHold {
  id             String          @id @db.Uuid
  userId         String          @map("user_id") @db.Uuid
  reason         LegalHoldReason
  caseReference  String          @map("case_reference") @db.VarChar(128)
  status         LegalHoldStatus @default(ACTIVE)
  appliedById    String          @map("applied_by_id") @db.Uuid
  releasedById   String?         @map("released_by_id") @db.Uuid
  notes          String          @db.Text
  releaseNotes   String?         @map("release_notes") @db.Text
  appliedAt      DateTime        @default(now()) @map("applied_at")
  releasedAt     DateTime?       @map("released_at")
  createdAt      DateTime        @default(now()) @map("created_at")
  updatedAt      DateTime        @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@index([userId, status])
  @@index([caseReference])
  @@map("legal_holds")
}

// ==============================================================================
// 5. PrivacyAuditCertificate Model (New Table: privacy_audit_certificates)
// ==============================================================================
model PrivacyAuditCertificate {
  id               String   @id @db.Uuid
  requestId        String   @unique @map("request_id") @db.Uuid
  certificateToken String   @unique @map("certificate_token") @db.VarChar(64) // 256-bit CSPRNG Token (crypto.randomBytes(32).toString('hex'))
  actionTaken      String   @map("action_taken") @db.VarChar(64) // IN_PLACE_PSEUDONYMIZATION
  recordsProcessed Int      @map("records_processed")
  mediaFilesPurged Int      @map("media_files_purged")
  completedAt      DateTime @default(now()) @map("completed_at")
  verificationSig  String   @map("verification_sig") @db.VarChar(255)

  @@index([certificateToken])
  @@index([completedAt])
  @@map("privacy_audit_certificates")
}
```

---

# 4. RAW SQL MIGRATION PREVIEW (`0014_data_retention_and_erasure`)

```sql
-- Step 1: Add PENDING_DELETION to UserStatus enum safely
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'PENDING_DELETION';

-- Step 2: Additive fields on users table
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "is_anonymized" BOOLEAN NOT NULL DEFAULT false;

-- Step 3: Create index for active user query optimization
CREATE INDEX IF NOT EXISTS "users_status_deleted_at_idx" ON "users"("status", "deleted_at");

-- Step 4: Create Privacy Request enums
DO $$ BEGIN
    CREATE TYPE "PrivacyRequestType" AS ENUM ('ACCOUNT_DELETION', 'DATA_EXPORT', 'RECTIFICATION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PrivacyRequestStatus" AS ENUM ('PENDING_CONFIRMATION', 'COOLING_OFF', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REJECTED_LEGAL_HOLD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 5: Create privacy_requests table
CREATE TABLE IF NOT EXISTS "privacy_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "request_type" "PrivacyRequestType" NOT NULL,
    "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "confirmation_code" VARCHAR(64),
    "confirmed_at" TIMESTAMP(3),
    "cooling_off_ends_at" TIMESTAMP(3),
    "scheduled_purge_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "certificate_token" VARCHAR(64),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privacy_requests_pkey" PRIMARY KEY ("id")
);

-- Step 6: Create Legal Hold enums and table
DO $$ BEGIN
    CREATE TYPE "LegalHoldReason" AS ENUM ('ACTIVE_DISPUTE', 'FINANCIAL_AUDIT', 'LAW_ENFORCEMENT_REQUEST', 'TRUST_SAFETY_INVESTIGATION', 'TAX_INSPECTION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "LegalHoldStatus" AS ENUM ('ACTIVE', 'RELEASED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "legal_holds" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" "LegalHoldReason" NOT NULL,
    "case_reference" VARCHAR(128) NOT NULL,
    "status" "LegalHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "applied_by_id" UUID NOT NULL,
    "released_by_id" UUID,
    "notes" TEXT NOT NULL,
    "release_notes" TEXT,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_holds_pkey" PRIMARY KEY ("id")
);

-- Step 7: Create privacy_audit_certificates table
CREATE TABLE IF NOT EXISTS "privacy_audit_certificates" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "certificate_token" VARCHAR(64) NOT NULL, -- 256-bit CSPRNG token in hex format
    "action_taken" VARCHAR(64) NOT NULL,
    "records_processed" INTEGER NOT NULL,
    "media_files_purged" INTEGER NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verification_sig" VARCHAR(255) NOT NULL,

    CONSTRAINT "privacy_audit_certificates_pkey" PRIMARY KEY ("id")
);

-- Step 8: Create indexes
CREATE INDEX IF NOT EXISTS "privacy_requests_user_id_status_idx" ON "privacy_requests"("user_id", "status");
CREATE INDEX IF NOT EXISTS "privacy_requests_status_scheduled_purge_at_idx" ON "privacy_requests"("status", "scheduled_purge_at");

CREATE INDEX IF NOT EXISTS "legal_holds_user_id_status_idx" ON "legal_holds"("user_id", "status");
CREATE INDEX IF NOT EXISTS "legal_holds_case_reference_idx" ON "legal_holds"("case_reference");

CREATE UNIQUE INDEX IF NOT EXISTS "privacy_audit_certificates_request_id_key" ON "privacy_audit_certificates"("request_id");
CREATE UNIQUE INDEX IF NOT EXISTS "privacy_audit_certificates_certificate_token_key" ON "privacy_audit_certificates"("certificate_token");
CREATE INDEX IF NOT EXISTS "privacy_audit_certificates_completed_at_idx" ON "privacy_audit_certificates"("completed_at");

-- Step 9: Add foreign keys with ON DELETE RESTRICT
DO $$ BEGIN
    ALTER TABLE "privacy_requests"
      ADD CONSTRAINT "privacy_requests_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "legal_holds"
      ADD CONSTRAINT "legal_holds_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 10: Parent-Row Locking Transaction Protocol (Concurrency Control)
-- All hold additions and erasure executions must execute using this lock order:
-- 1. Lock Parent User Row:
--    SELECT id FROM users WHERE id = :userId FOR UPDATE;
-- 2. Verify / Modify Dependent Rows:
--    SELECT id, status FROM legal_holds WHERE user_id = :userId AND status = 'ACTIVE' FOR UPDATE;
-- 3. Update Request or Execute Pseudonymization:
--    UPDATE users SET email = :tombstoneEmail, is_anonymized = true, status = 'DEACTIVATED' WHERE id = :userId;
```

````

---

# 5. ZERO-DOWNTIME ROLLOUT & BACKWARD COMPATIBILITY

## 5.1 Backward Compatibility

1. **Fully Additive**: All new columns on `users` are either nullable or have default values (`DEFAULT false`). Existing queries selecting user records continue functioning without error.
2. **Existing Queries Unaffected**: No existing columns or foreign keys are dropped or altered.
3. **Enum Compatibility**: Adding a value to an enum (`ALTER TYPE ... ADD VALUE`) is backward compatible in PostgreSQL 12+.

## 5.2 Rollback & Forward Recovery Strategy

### Backward Rollback Plan (If Aborted Pre-Traffic):

```sql
DROP TABLE IF EXISTS "privacy_audit_certificates" CASCADE;
DROP TABLE IF EXISTS "legal_holds" CASCADE;
DROP TABLE IF EXISTS "privacy_requests" CASCADE;

DROP TYPE IF EXISTS "LegalHoldStatus";
DROP TYPE IF EXISTS "LegalHoldReason";
DROP TYPE IF EXISTS "PrivacyRequestStatus";
DROP TYPE IF EXISTS "PrivacyRequestType";

DROP INDEX IF EXISTS "users_status_deleted_at_idx";

ALTER TABLE "users"
  DROP COLUMN IF EXISTS "deleted_at",
  DROP COLUMN IF EXISTS "is_anonymized";
````

### Forward Recovery Plan (Recommended):

In case of deployment failure, leave additive schema objects intact. Disable the background erasure worker while keeping the Fastify API operational.
