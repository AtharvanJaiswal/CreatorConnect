# CreatorConnect Admin Web Console — Integration & Operations Runbook

**Document Reference:** `docs/frontend/INTEGRATION_RUNBOOK.md`  
**Milestone:** Phase 4 Admin Web Console Verification & Integration Audit  
**Audience:** SREs, DevOps Engineers, Full-Stack Developers, Support Administrators  
**Audit Date:** November 2026  
**Status:** PRODUCTION OPERATIONAL RUNBOOK

---

## 1. System Overview & Architecture

The CreatorConnect Admin Web Console (`apps/web-shell`) serves as the administrative mission-control center for the platform. It operates alongside the Fastify API backend (`apps/api`), PostgreSQL primary database, Redis cluster, and Supabase Auth.

```
+--------------------------------------------------------------------------+
|                        CreatorConnect Architecture                       |
+--------------------------------------------------------------------------+
  Staff Browser
       │
       ▼ (HTTPS / WSS)
  Next.js 15 Web Shell (apps/web-shell :3002)
       │  Edge Middleware: enforces /admin/login redirect
       │  AuthProvider: session management via Supabase Auth
       │
       ▼ (REST JSON / Bearer JWT)
  Fastify API Gateway (apps/api :3000)
       ├── Authentication Plugin (RS256 JWKS verification)
       ├── RBAC / CASL Ability Evaluation
       ├── Admin Modules (/api/v1/admin/*)
       │
       ├── PostgreSQL (Authoritative Status, Ledger, Profiles)
       ├── Redis (Cache & BullMQ Job Queues)
       └── Cloudflare R2 / S3 (Encrypted Storage)
```

---

## 2. Environment Configuration

The following environment variables are required across development, staging, and production environments:

### 2.1. Frontend (`apps/web-shell/.env.local` or `.env.production`)

```bash
# Public API Gateway
NEXT_PUBLIC_API_URL=http://localhost:3000

# Supabase Auth Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# Node Environment
NODE_ENV=production
PORT=3002
```

### 2.2. Backend (`apps/api/.env`)

```bash
# Server Port & Host
PORT=3000
HOST=0.0.0.0

# Database & Cache
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/creatorconnect?schema=public
REDIS_URL=redis://localhost:6379

# Supabase JWT & Secret Verification
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# High-Risk Financial & Operational Thresholds
HIGH_VALUE_REFUND_THRESHOLD_PAISA=5000000 # 50,000 INR
```

---

## 3. Local Development & Staging Startup

### Step 1: Install Dependencies

```bash
pnpm install
```

### Step 2: Build Shared Packages

```bash
pnpm --filter @creatorconnect/database build
pnpm --filter @creatorconnect/contracts build
pnpm --filter @creatorconnect/utils build
```

### Step 3: Start Authoritative Backend

```bash
pnpm --filter @creatorconnect/api dev
# Fastify listens at http://127.0.0.1:3000
# Health check: curl http://127.0.0.1:3000/health
```

### Step 4: Start Admin Web Shell

```bash
pnpm --filter @creatorconnect/web-shell dev
# Next.js listens at http://127.0.0.1:3002
```

### Step 5: Access the Admin Console

- Open browser to `http://localhost:3002`.
- You will be automatically redirected to `http://localhost:3002/admin/login`.
- Sign in with provisioned staff credentials.

---

## 4. Administrative User Provisioning Runbook

To grant an employee access to the Admin Web Console:

### Step 1: Create Supabase Auth Account

Create the user in Supabase Auth (or allow them to register). Note their email and UUID.

### Step 2: Assign Administrative Role via Backend Service / CLI

Using the interactive console or database migration script:

```typescript
import { adminRbacService } from './modules/admin/rbac/admin-rbac.service.js';

await adminRbacService.assignRole(
  targetUserId,
  'SUPER_ADMIN', // or 'SUPPORT_AGENT', 'FINANCIAL_OPERATOR', 'CONTENT_MODERATOR'
  { id: superAdminActorId, adminRoles: ['SUPER_ADMIN'] },
);
```

_Note: Redis identity cache is invalidated automatically upon role assignment._

---

## 5. Incident Response & Emergency Procedures

### 5.1. Emergency Platform Maintenance Mode

- **Navigation**: `/admin/config`
- **Key**: `PLATFORM_MAINTENANCE_MODE`
- **Action**: Set value to `true` with mandatory incident ticket ID in reason field.
- **Effect**: API blocks non-admin traffic immediately across mobile apps.

### 5.2. Malicious User Lockout

- **Navigation**: `/admin/users/[id]`
- **Action**: Click `Suspend Account`. Enter reason.
- **Effect**: PostgreSQL updates status to `SUSPENDED`. Redis cache is evicted. Any subsequent API request from the user's mobile or web device is rejected with HTTP 403 `UserSuspendedError`.

### 5.3. Disputed High-Value Refund Dual Approval

- **Step 1 (Initiation)**: Financial operator navigates to `/admin/finance/refunds`, clicks `Issue Refund`, enters details. A pending `AdminActionApproval` is created.
- **Step 2 (Dual Sign-Off)**: A _different_ authorized administrator navigates to `/admin/finance/refunds`, reviews the request notes and project escrow balance, and clicks `Approve Refund`.
- **Ledger Posting**: The system debits project escrow liabilities and credits processor clearing assets automatically.

---

## 6. Verification & Automated CI Commands

```bash
# Typecheck entire monorepo
pnpm turbo typecheck

# Execute all frontend unit and integration tests (288 tests)
pnpm --filter @creatorconnect/web-shell test

# Production build test
pnpm --filter @creatorconnect/web-shell build

# Run Playwright E2E suites
pnpm test:e2e
```
