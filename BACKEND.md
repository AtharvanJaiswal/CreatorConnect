# CreatorConnect Backend — Authoritative Engineering & Integration Manual

> **CRITICAL ARCHITECTURAL MANDATE**:  
> The CreatorConnect Backend is the **single authoritative business and data layer** for the platform.  
> It serves **Web**, **Android**, **iOS**, and **Web Admin** clients uniformly.  
> Client applications (Web/Mobile) are API consumers and **MUST NOT** implement marketplace business logic, escrow state machines, pricing algorithms, or contract transitions independently.

---

## 1. Overview & Verified System Status

The CreatorConnect backend powers an enterprise-grade, multi-sided creator economy platform orchestrating five ecosystem participant personas:

1. **Creators / Influencers**
2. **Production Professionals** (Videographers, Editors, Audio Engineers, Thumbnail Artists)
3. **Brands & Companies**
4. **Podcasters** (Hosts, Producers, Sponsors)
5. **Platform Administrators** (Operations, Trust & Safety, Compliance)

### Current Architecture State (Verified at Release Commit `58e8ae0`):

- **Phase 0–3**: Foundation, authentication, JWKS JWT verification, 3-tier RBAC & CASL authorization (**COMPLETED**).
- **Phase 4**: Profiles, portfolio CRUD, brand assignments, atomic hiring acceptance, and PostgreSQL FTS + `pg_trgm` search (**COMPLETED**).
- **Phase 5**: Realtime Socket.IO WebSockets cluster, `@socket.io/redis-adapter`, monotonic message sequencing, client idempotency, transactional outbox relay, ClamAV antivirus scanning, and trust/moderation (**COMPLETED & PROMOTED** to `dev` and `main`).
- **Phase 5 Operational Verification**: Evaluated Gates A–D. Gate A (isolated DB restore drill PASS: RTO 1.4s, RPO 0.4s, SHA-256 match) and Gate D (CI PASS & promoted to dev/main). Gate B (external alert delivery NOT_VERIFIED) and Gate C (production secrets BLOCKED) remain pending external production credentials; production deployment is NOT authorized.
- **Phase 6 (Increment 1)**: Projects & Deliverable Escrow Foundation (**IMPLEMENTED & LOCALLY VERIFIED** on branch `feature/phase-6-projects-deliverables`). Execution contract lifecycle for accepted proposals, milestone deliverables, submit/review workflows, optimistic concurrency locking, and transactional outbox events (`project.created.v1`, `project.deliverable.submitted.v1`, `project.deliverable.revision_requested.v1`, `project.deliverable.approved.v1`).
- **Phase 6 (Increment 2)**: Payments, Ledger & Escrow Foundation (**IMPLEMENTED & LOCALLY VERIFIED** on branch `feature/phase-6-payments-ledger`). Immutable double-entry balanced ledger ($\sum \text{debits} \equiv \sum \text{credits}$), integer minor units (paisa), idempotent payment intent lifecycle with SHA-256 payload hash verification, provider abstraction (Sandbox Mock & Razorpay Orders/Route compliance for Indian market), HMAC SHA-256 signed webhook ingestion with event deduplication, and transactional outbox events (`payment.intent.created.v1`, `payment.intent.succeeded.v1`, `ledger.transaction.posted.v1`, `escrow.released.v1`). Live payouts and real-money nodal escrow remain strictly simulated in sandbox mode pending RBI Payment Aggregator compliance and production nodal onboarding.

### Core Technologies & Runtimes:

- **Language / Runtime**: Node.js 20 LTS + TypeScript 5.5+
- **HTTP Engine**: Fastify v4.x (High throughput, native TypeBox JSON Schema compilation)
- **Database**: PostgreSQL 16 managed with Prisma ORM 5.18 (40 models, 6 applied migrations)
- **In-Memory Cache & Broker**: Redis 7
- **Asynchronous Task Queues**: BullMQ v5.x
- **Realtime Gateway**: Socket.IO v4.x with `@socket.io/redis-adapter`
- **Identity Provider**: Supabase Auth (Managed OAuth, OTP, RS256/ES256 asymmetric JWT tokens)
- **Object Storage**: S3-compatible (Cloudflare R2 / MinIO in local dev)
- **Antivirus Scanner**: ClamAV daemon (`clamd` on port 3310)
- **Monorepo Tooling**: pnpm 9.15 workspaces + Turborepo 2.1

---

## 2. Backend Monorepo Topology

```
f:\CreatorConnect/
├── apps/
│   ├── api/                     # Core Modular REST API Engine (Fastify 4)
│   │   ├── src/
│   │   │   ├── modules/         # Clean Architecture Domain Modules
│   │   │   │   ├── auth/        # Identity sync & session context (/api/v1/auth)
│   │   │   │   ├── users/       # User accounts & RBAC management (/api/v1/users)
│   │   │   │   ├── profiles/    # Creator, Pro, Brand, Podcaster rate cards & bio
│   │   │   │   ├── portfolio/   # Media portfolio CRUD with ACTIVE media validation
│   │   │   │   ├── media/       # S3/R2 presigned upload pipeline & quarantine lifecycle
│   │   │   │   ├── assignments/ # Brand briefs, requirements, budget bounds
│   │   │   │   ├── applications/# Proposal submissions & atomic hiring state machine
│   │   │   │   ├── projects/    # Project contracts & milestone deliverables (/api/v1/projects)
│   │   │   │   ├── payments/    # Double-entry ledger, payment intents & escrow (/api/v1/payments)
│   │   │   │   ├── discovery/   # PostgreSQL tsvector FTS + pg_trgm fuzzy matching
│   │   │   │   ├── messaging/   # Direct chat threads, message history, read receipts
│   │   │   │   └── notifications/# User notification preference management
│   │   │   ├── routes/          # System routes (/health, /ready)
│   │   │   ├── plugins/         # Fastify plugins (CORS, Helmet, Rate-Limit, Swagger)
│   │   │   ├── services/        # Cross-cutting services (rate-limiter, auth)
│   │   │   └── app.ts / main.ts # Fastify server entry point & graceful shutdown
│   │   └── Dockerfile           # Production container definition
│   ├── realtime/                # Realtime WebSocket Gateway (Socket.IO + Fastify)
│   │   ├── src/
│   │   │   ├── auth/            # Socket handshake token validation
│   │   │   ├── handlers/        # Message events, typing indicators, room management
│   │   │   ├── services/        # Connection registry & multi-instance reconciliation
│   │   │   └── server.ts / main.ts # Server bootstrap on dedicated port (3001)
│   │   └── Dockerfile
│   └── worker/                  # Background Worker & Asynchronous Tasks (BullMQ)
│       ├── src/
│       │   ├── outbox/          # Transactional outbox polling & event relay
│       │   ├── notifications/   # Push and email notification workers
│       │   ├── scanners/        # ClamAV antivirus stream scanner
│       │   ├── processors/      # Sharp image derivative generation (WebP thumbnail/card)
│       │   ├── supervisor.ts    # Worker process supervisor & lease manager
│       │   └── main.ts          # Worker startup
│       └── Dockerfile
├── packages/
│   ├── contracts/               # TypeBox contract definitions & OpenAPI models
│   ├── validation/              # Shared TypeBox schemas, formats, and RFC 7807 problem details
│   ├── auth/                    # Supabase JWT verifier, CASL abilities, and role hierarchy
│   ├── database/                # Prisma client, 32-model schema, repositories & migrations
│   ├── utils/                   # Currency minor units, UUIDv7 generators, sanitizers
│   └── testing/                 # Operational readiness verifiers & test fixtures
```

---

## 3. Service Directory & Verified Ports

| Service                 | Repository Location | Primary Responsibility                                                  | Port                   | Verified Status |
| :---------------------- | :------------------ | :---------------------------------------------------------------------- | :--------------------- | :-------------- |
| **Core REST API**       | `apps/api/`         | Stateless REST APIs, OpenAPI, RBAC, domain transactions                 | `3000`                 | **VERIFIED**    |
| **Realtime Gateway**    | `apps/realtime/`    | Stateful WebSockets, presence, typing, room routing via Redis           | `3001`                 | **VERIFIED**    |
| **Background Worker**   | `apps/worker/`      | Outbox event polling, ClamAV scanning, Sharp transcoding, notifications | N/A                    | **VERIFIED**    |
| **PostgreSQL Database** | Docker container    | Authoritative relational persistence (32 tables)                        | `5433` (host) / `5432` | **VERIFIED**    |
| **Redis Broker**        | Docker container    | Distributed cache, BullMQ queues, Socket.IO adapter                     | `6379`                 | **VERIFIED**    |

---

## 4. Backend Setup & Local Development Workflow

### Prerequisites

- **Node.js**: v20 LTS (`node -v` >= 20.0.0)
- **Package Manager**: pnpm 9.15 (`corepack enable && pnpm -v`)
- **Container Engine**: Docker Desktop or Docker Engine with Docker Compose

### Step-by-Step Setup:

```bash
# 1. Clone repository
git clone https://github.com/AtharvanJaiswal/CreatorConnect.git
cd CreatorConnect

# 2. Install workspace dependencies
pnpm install

# 3. Configure local environment
cp .env.example .env

# 4. Start local infrastructure containers (PostgreSQL, Redis)
pnpm docker:up

# 5. Generate Prisma client & apply database migrations (0001–0004)
pnpm --filter @creatorconnect/database db:generate
pnpm --filter @creatorconnect/database db:migrate

# 6. Seed default platform roles
pnpm --filter @creatorconnect/database db:seed

# 7. Start development servers across all workspaces
pnpm dev
```

---

## 5. Environment Configuration & Secret Hygiene

> [!CAUTION]
> **Zero Secret Disclosure Mandate**: Real production secrets, private keys, or credentials must NEVER be committed to Git, logged to stdout, or serialized in operational health reports.

| Variable Name         | Category     | Required | Services Consuming          | Safe Example / Placeholder                                | Validation Rule                                        |
| :-------------------- | :----------- | :------- | :-------------------------- | :-------------------------------------------------------- | :----------------------------------------------------- |
| `NODE_ENV`            | Environment  | Yes      | All                         | `development` / `production`                              | Must be `development`, `test`, `staging`, `production` |
| `PORT`                | Network      | Yes      | `api`                       | `3000`                                                    | Valid integer 1–65535                                  |
| `REALTIME_PORT`       | Network      | Yes      | `realtime`                  | `3001`                                                    | Valid integer 1–65535                                  |
| `DATABASE_URL`        | Persistence  | Yes      | `api`, `worker`, `database` | `postgresql://***:***@localhost:5433/creatorconnect_dev`  | Valid PostgreSQL URI; non-mock in production           |
| `REDIS_URL`           | Cache/Broker | Yes      | `api`, `realtime`, `worker` | `redis://***:***@localhost:6379`                          | Must use `redis://` or `rediss://` protocol            |
| `SUPABASE_JWT_ISSUER` | Identity     | Yes      | `api`, `realtime`           | `https://<ref>.supabase.co/auth/v1`                       | Must be HTTPS URL in production; no localhost          |
| `SUPABASE_JWKS_URL`   | Identity     | Optional | `api`, `realtime`           | `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` | Must be HTTPS URL in production                        |
| `CORS_ORIGIN`         | Security     | Yes      | `api`, `realtime`           | `https://creatorconnect.app`                              | Wildcard (`*`) strictly rejected in production         |
| `CLAMAV_HOST`         | Antivirus    | Yes      | `worker`                    | `localhost` or `clamav.internal`                          | Valid hostname or IP                                   |
| `CLAMAV_PORT`         | Antivirus    | Yes      | `worker`                    | `3310`                                                    | Valid integer 1–65535                                  |

---

## 6. API Contracts, Authentication & Error Envelopes

### 6.1 Authentication (3-Tier Security Model)

1. **Tier 1 (Signature & Format)**: Incoming request presents `Authorization: Bearer <JWT>`. Verified against remote or cached Supabase JWKS public keys. Permitted algorithms: `RS256`, `ES256`.
2. **Tier 2 (Account Lifecycle & RBAC)**: Database user record resolved by `supabase_auth_id`. Account status checked (`ACTIVE` allowed; `SUSPENDED` / `DEACTIVATED` rejected with `403 Forbidden`). Required role membership asserted (`CREATOR`, `PROFESSIONAL`, `BRAND`, `PODCASTER`, `ADMIN`).
3. **Tier 3 (CASL Resource Authorization)**: Declarative CASL ability rules evaluated to prevent horizontal privilege escalation (IDOR) and verify tenant/resource ownership.

### 6.2 Standard RFC 7807 Problem Details

All errors follow standard RFC 7807:

```json
{
  "type": "about:blank",
  "title": "Invalid Authentication Token",
  "status": 401,
  "code": "AUTH_INVALID_TOKEN",
  "detail": "Authorization header with Bearer token is required.",
  "instance": "/api/v1/users/me"
}
```

### 6.3 System Health Endpoints

- **`GET /health`** (Liveness): Returns `200 OK` with `{ status: 'ok', timestamp, uptime }`.
- **`GET /ready`** (Readiness): Returns `200 OK` with `{ status: 'ready', services: { ... } }`.

---

## 7. Database Architecture & Operational Verification

### 7.1 Relational Schema & Migrations

- **Location**: `packages/database/prisma/schema.prisma`
- **Total Entities**: 32 public tables
- **Applied Migrations**:
  - `0001_initial_schema`: Core identity, profiles, taxonomy, assignments, applications.
  - `0002_messaging_and_moderation`: Conversations, messages, attachments, reactions, blocks, reports, moderation actions.
  - `0003_outbox_and_notifications`: Transactional outbox events, processed events, notifications, notification preferences.
  - `0004_media_assets_and_scanning`: Media assets, quarantine metadata, scan status.

### 7.2 Database Backup & Real Restore Drill (Gate A Verified)

- **Backup Command**:
  ```bash
  pg_dump -U postgres -d creatorconnect_dev -F c -f /tmp/creatorconnect_backup.dump
  ```
- **Integrity Verification**: SHA-256 cryptographic digest calculation comparing immutable backup against stored digest ($H(B_{\text{source}}) = H(B_{\text{verified}})$).
- **Isolated Restore Drill**:
  ```bash
  createdb -U postgres creatorconnect_restore_drill
  pg_restore -U postgres -d creatorconnect_restore_drill --no-owner --no-privileges /tmp/creatorconnect_backup.dump
  ```
- **Empirical Measurements**:
  - Measured Restore Duration (RTO): **1.44 seconds** (SLA: $< 900$ seconds / 15 minutes) $\rightarrow$ **PASS**.
  - Measured Recovery Point (RPO): **0.44 seconds** (SLA: $< 5$ seconds) $\rightarrow$ **PASS**.
  - Restored Schema Check: **32 tables verified, critical indexes verified, migrations verified (4)**.
  - Teardown: Drill database cleanly dropped post-verification.

---

## 8. Realtime Gateway & Messaging Architecture

### 8.1 Socket.IO & Redis Adapter

- **Runtime**: `apps/realtime/src/server.ts`
- **Horizontal Scaling**: Uses `@socket.io/redis-adapter` over Redis pub/sub. Multiple instances of `apps/realtime` broadcast to connected clients seamlessly across nodes.
- **Room Authorization**: On `join_conversation`, the socket server queries `ConversationAuthorizationService` to assert conversation participation before adding the socket to room `conversation:{id}`.

### 8.2 Monotonic Sequencing & Client Idempotency

- **Monotonic Sequences**: Each message in a conversation is assigned an atomically incremented sequence number (`messages_conversation_id_sequence_key`), eliminating race conditions in message ordering.
- **Client Idempotency**: Each message payload accepts `client_message_id`. Unique constraint `messages_sender_id_conversation_id_client_message_id_key` prevents duplicate message insertion on client network retries.

---

## 9. Background Processing & Transactional Outbox

### 9.1 Transactional Outbox Pattern

1. When a business transaction completes (e.g. sending a message, accepting an application), the domain event is inserted into `outbox_events` within the **same ACID database transaction**.
2. `apps/worker` supervisor polls unprocessed outbox events using optimistic row leases (`lease_expires_at`).
3. Events are routed to BullMQ worker queues for asynchronous dispatch (notifications, analytics, indexing).
4. Stale leases are automatically recovered after lease timeout; exhausted retries are sent to dead-letter storage.

### 9.2 Antivirus Scanning Pipeline

- New file uploads are staged into server-authoritative quarantine storage keys (`quarantine/{userId}/{assetId}.ext`).
- BullMQ worker streams the file through ClamAV daemon (`INSTREAM` command).
- If clean: file is promoted to `ACTIVE` storage key and marked `SCANNED_CLEAN`.
- If infected: file is quarantined, marked `INFECTED`, and alert is logged (fail-closed behavior).

---

## 10. Operational Runbooks & Troubleshooting

### 10.1 Database Connection Errors

- **Symptom**: `PrismaClientInitializationError: Can't reach database server`.
- **Remediation**:
  1. Verify Docker container status: `docker ps | grep postgres`.
  2. Verify host port mapping: `creatorconnect-postgres` uses port `5433` on host (mapping to container `5432`).
  3. Ensure `DATABASE_URL` in `.env` specifies port `5433` for local development.

### 10.2 Migration Recovery

- **Symptom**: `Database migration failed or drift detected`.
- **Remediation**:
  1. Check migration log: `docker exec creatorconnect-postgres psql -U postgres -d creatorconnect_dev -c "SELECT * FROM _prisma_migrations;"`.
  2. Never execute destructive `prisma migrate reset` against production or persistent staging environments.
  3. Resolve migration drift by applying forward migrations with `pnpm --filter @creatorconnect/database db:migrate`.

### 10.3 Redis Unavailability

- **Symptom**: Rate-limiter failover or Socket.IO adapter disconnections.
- **Remediation**:
  1. Restart Redis container: `docker restart creatorconnect-redis`.
  2. Rate limiter fails open for read routes and fails closed for sensitive write operations.
  3. Realtime gateway reconnects with exponential backoff and synchronizes active room memberships.

### 10.4 Outbox Worker Backlog

- **Symptom**: Growing queue depth in `outbox_events`.
- **Remediation**:
  1. Inspect unleased pending events: `SELECT count(*) FROM outbox_events WHERE processed_at IS NULL;`.
  2. Verify `apps/worker` logs for ClamAV or notification service timeout errors.
  3. Clear expired leases: Worker supervisor automatically recovers leases older than 30 seconds.

---

## 11. Automated Testing & Verification Commands

```bash
# Run unit tests across all monorepo workspaces
pnpm test:unit

# Run operational readiness test suite (Gates A, B, C)
pnpm exec vitest run packages/testing/src/operational/

# Execute live database restore drill against container
pnpm exec vitest run packages/testing/src/operational/database-restore-drill.spec.ts

# Execute typecheck across all workspaces
pnpm typecheck

# Validate code formatting
pnpm format:check

# Execute production workspace builds
pnpm build
```

---

## 12. Backend Changelog

| Phase           | Release Commit | Summary                                                                                                       | Database Changes      | Operational Status                 |
| :-------------- | :------------- | :------------------------------------------------------------------------------------------------------------ | :-------------------- | :--------------------------------- |
| **Phase 0**     | `c6080c4`      | Product & Architecture Lock, ADRs, canonical data model                                                       | Greenfield design     | Approved                           |
| **Phase 1–3**   | `aba599b`      | Monorepo setup, Fastify engine, Supabase Auth, JWKS, RBAC                                                     | Migrations 0001       | Verified in CI                     |
| **Phase 4**     | `b42ffdb`      | Profiles, portfolio CRUD, assignments, atomic hiring, FTS                                                     | 15 models             | Verified in CI                     |
| **Phase 5**     | `58e8ae0`      | Realtime Socket.IO, Outbox relay, ClamAV scanning, Moderation                                                 | 32 models (0001–0004) | Promoted to `dev` & `main`         |
| **Stage 5 Ops** | Working Tree   | Operational verification: Restore drill PASS, Probes PASS, External alerts NOT_VERIFIED, Prod secrets BLOCKED | 32 models (verified)  | **Gates Evaluated (Prod Blocked)** |
