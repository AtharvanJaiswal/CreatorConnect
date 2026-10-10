# CreatorConnect — Multi-Sided Creator Economy Platform

[![PR Validation & Quality Gates](https://github.com/nikhilkr004/CreatorConnect/actions/workflows/pr-validation.yml/badge.svg)](https://github.com/nikhilkr004/CreatorConnect/actions/workflows/pr-validation.yml)
[![CodeQL Analysis](https://github.com/nikhilkr004/CreatorConnect/actions/workflows/codeql.yml/badge.svg)](https://github.com/nikhilkr004/CreatorConnect/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript: 5.5+](https://img.shields.io/badge/TypeScript-5.5+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js: 20 LTS](https://img.shields.io/badge/Node.js-20_LTS-green.svg)](https://nodejs.org/)
[![Fastify: 4.x](https://img.shields.io/badge/Fastify-4.x-black.svg)](https://fastify.dev/)
[![Next.js: 15.5](https://img.shields.io/badge/Next.js-15.5-black.svg)](https://nextjs.org/)
[![PostgreSQL: 16](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Prisma: 5.18](https://img.shields.io/badge/Prisma-5.18-2D3748.svg)](https://www.prisma.io/)
[![Redis: 7](https://img.shields.io/badge/Redis-7-red.svg)](https://redis.io/)

Welcome to **CreatorConnect**, an enterprise-grade multi-sided creator economy platform designed to orchestrate discovery, assignments, contracts, media deliverables, realtime collaboration, and escrow settlements between creators, production specialists, brands, and podcasters.

---

## 1. Project Overview

CreatorConnect is built to solve fragmented workflows across the creator economy. Instead of juggling disparate messaging apps, unverified file links, manual invoicing, and unsecured agreements, CreatorConnect provides a centralized, secure, and compliant marketplace platform.

### Supported Personas

1. **Creator**: Content creators producing video, audio, imagery, and interactive digital content who showcase media portfolios, apply to brand briefs, collaborate on milestones, and receive escrowed payouts.
2. **Professional**: Technical and creative production specialists (video editors, colorists, sound designers, graphic artists, thumbnail designers, copywriters) who provide specialized services to creators and brands.
3. **Brand / Company**: Businesses and marketing teams seeking verified talent, posting structured assignment briefs, managing deliverables, and funding secure escrow milestones.
4. **Podcaster**: Audio and video show hosts booking verified guests, coordinating episode sponsorships, and collaborating with audio engineers and editors.
5. **Admin**: Platform operations and trust & safety team members handling dispute arbitration, fraud prevention, compliance enforcement, and user lifecycle moderation.

---

## 2. Current Implementation Status

CreatorConnect follows a sequential, gated engineering roadmap. Below is the authoritative status of currently implemented phases:

| Phase           | Milestone Name                               | Implementation Status              | Key Implemented Capabilities                                                                                                                                                                                                                      |
| :-------------- | :------------------------------------------- | :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Phase 0**     | **Product & Architecture Lock**              | **COMPLETED**                      | 20 Architecture Decision Records (ADRs), C4 architecture diagrams, canonical data models, RFC 7807 error envelopes, risk register.                                                                                                                |
| **Phase 1**     | **Monorepo & Engineering Foundation**        | **COMPLETED**                      | pnpm 9 workspaces, Turborepo 2, strict TypeScript 5.5, Prettier, ESLint, Vitest, Playwright, Docker Compose stacks (PostgreSQL 16, Redis 7, MinIO).                                                                                               |
| **Phase 2**     | **Design System & Microfrontend Foundation** | **COMPLETED**                      | Tailwind CSS token preset (`@creatorconnect/design-system`), accessible UI component library (`@creatorconnect/ui`), responsive Next.js 15.5 `apps/web-shell` shell layout.                                                                       |
| **Phase 3**     | **Authentication & Identity Foundation**     | **COMPLETED**                      | Managed Supabase Auth integration, asymmetric JWKS JWT verification, internal UUIDv7 user identity, 3-tier RBAC & CASL authorization, user lifecycle management, audit logging, Redis session caching, web auth flows.                            |
| **Phase 4**     | **Core Business Domains & Discovery**        | **COMPLETED**                      | 15-model schema, 4 profile personas, portfolio CRUD, S3/R2 presigned media pipeline, BullMQ magic-byte worker, brand assignments, atomic hiring acceptance, PostgreSQL FTS & pg_trgm discovery, Next.js UI console.                               |
| **Phase 5**     | **Realtime Messaging, Outbox & Moderation**  | **COMPLETED**                      | 32-model schema (migrations 0001–0004), Socket.IO WebSockets cluster, Redis adapter, monotonic sequencing, client idempotency, transactional outbox relay, ClamAV antivirus scanning, user blocking & moderation.                                 |
| **Stage 5 Ops** | **Operational Verification & Readiness**     | **GATES EVALUATED (PROD BLOCKED)** | Gate A (isolated DB restore drill PASS: RTO 1.4s, RPO 0.4s, SHA-256 match), Gate B (local probes PASS, external alerts NOT_VERIFIED), Gate C (local PASS, prod secrets BLOCKED), Gate D (CI & Git promotion PASS). Production deployment BLOCKED. |
| **Phases 6–15** | **Escrow, Payments & Production Scale**      | **PLANNED**                        | Deliverable Escrow, Razorpay double-entry ledger, reviews & dispute arbitration, multi-region ECS deployment (see [Roadmap](#12-roadmap)).                                                                                                        |

### Phase 5 Technical Highlights (Implemented & Verified)

- **32-Model Relational Schema**: 32 database entities in PostgreSQL 16 via Prisma across 4 applied migrations (`0001`–`0004`) covering messaging, reactions, attachments, user blocks, moderation actions, audit logs, outbox events, and notifications.
- **Realtime WebSockets Engine (`apps/realtime`)**: Dedicated Socket.IO v4 gateway with `@socket.io/redis-adapter` for multi-node horizontal scaling, room authorization, connection lifecycle management, and socket session reconciliation.
- **Monotonic Sequence & Idempotent Messaging**: Atomic conversation sequence numbers (`messages_conversation_id_sequence_key`) preventing race conditions, and client-generated message IDs (`messages_sender_id_conversation_id_client_message_id_key`) for complete duplicate prevention.
- **Transactional Outbox Architecture (`apps/worker`)**: Transactionally coupled database writes and outbox event dispatch in a single ACID transaction, with bounded worker polling, stale lease recovery, exponential backoff, and dead-letter protection.
- **Trust, Safety & Moderation**: Bidirectional user blocking (`user_blocks`) with fail-closed delivery inhibition, report submission, and administrative moderation actions (`WARN`, `MUTE`, `SUSPEND`) with full audit trails.
- **Media Quarantine & ClamAV Pipeline**: Presigned upload flow, magic-byte inspection, Sharp WebP derivative generation, and ClamAV antivirus scanning with fail-closed quarantine enforcement.
- **Operational Verification Engine (`packages/testing/src/operational`)**: Automated gates evaluating backup SHA-256 integrity, real isolated container restore drill (RTO 1.44s vs 900s SLA; RPO 0.44s vs 5s SLA), health probe inspection, and zero-disclosure production secret validation.

### Phase 4 Technical Highlights (Implemented)

- **15-Model Relational Schema**: 15 database entities and 7 enums in PostgreSQL 16 via Prisma with canonical role names (`CREATOR`, `PROFESSIONAL`, `BRAND`, `PODCASTER`, `ADMIN`), money non-negative `CHECK` constraints, and strictly brand-owned assignments.
- **Profiles Domain**: Comprehensive profile management across `CreatorProfile`, `ProfessionalProfile`, `BrandProfile`, and `PodcasterProfile`, taxonomy categories, skills with controlled `SkillProficiency`, visibility controls (`PUBLIC`, `UNLISTED`, `PRIVATE`), and role-gated ownership.
- **Portfolio Domain**: Full portfolio item CRUD, attachment validation allowing strictly `ACTIVE` media, `(portfolioItemId, mediaAssetId)` uniqueness constraint, deterministic display ordering, and IDOR protection.
- **Secure Media Pipeline**: S3/Cloudflare R2 presigned upload URLs with server-authoritative quarantine keys (`quarantine/{userId}/{assetId}.ext`), `HeadObject` byte-size validation CAS (`QUARANTINED` → `PENDING_SCAN`), BullMQ background processing worker with magic-byte verification, Sharp image derivative generation (256x256 WebP thumbnail, 640x360 16:9 WebP card preview), PDF validation, idempotent promotion to `ACTIVE`, and quarantine cleanup scheduler.
- **Assignments Domain**: Brand-owned assignments with lifecycle states (`DRAFT` → `PUBLISHED` → `IN_PROGRESS` → `COMPLETED` / `CLOSED`), optimistic concurrency control (`version`), deliverables requirements, deadline validation, and soft deletion.
- **Applications & Atomic Hiring**: Proposal submission protected by real PostgreSQL database row lock (`SELECT ... FOR UPDATE`) checking active deadlines and duplicate submission rejection (`409 Conflict`).
- **Concurrency-Safe Acceptance Algorithm**: Atomic hiring transaction executing conditional update on assignment (`id + PUBLISHED + expectedVersion`), conditional update on application (`id + assignmentId + SHORTLISTED + expectedApplicationVersion`), and non-overwriting competitor auto-rejection (`where: id + assignmentId + observedStatus + observedVersion`, inserting `POSITION_FILLED` history strictly when update `count === 1`).
- **Hybrid Discovery Engine**: PostgreSQL Full-Text Search (`tsvector`) combined with `pg_trgm` trigram fuzzy matching (`%` operator with 0.3 similarity threshold) and deterministic 3-field keyset cursor pagination `(computedRank, createdAt, id)` with fully parameterized raw SQL.
- **Phase 4 Frontend Consoles**: Next.js 15.5 web routes for `/discovery` (full-text search, filter pills, keyset pagination), `/assignments/[id]` (brief details, deadline countdown, proposal modal), `/assignments/[id]/applications` (brand review cockpit, shortlist, atomic accept & hire), and `/profiles/me` (profile editing, visibility, presigned file uploads).

---

## 3. Architecture

CreatorConnect adheres to an **API-First, Event-Driven Modular Monolith** architecture with physically isolated specialist runtimes for high-throughput REST, realtime WebSockets, and background asynchronous workloads.

### High-Level Architecture Diagram

```mermaid
flowchart TB
    subgraph Clients["Client Tier"]
        WS["Next.js Web-Shell (apps/web-shell)"]
        Mobile["Mobile Apps (Android / iOS - Future)"]
    end

    subgraph Edge["Security & Ingress"]
        Cloudflare["Cloudflare Edge (WAF / CDN)"]
    end

    subgraph Gateway["Identity Provider"]
        SupaAuth["Supabase Auth (Managed IdP)"]
    end

    subgraph Backend["CreatorConnect Backend Services"]
        API["Core REST API (apps/api - Fastify 4)"]
        Realtime["Realtime Service (apps/realtime - Socket.IO)"]
        Worker["Background Worker (apps/worker - BullMQ)"]
    end

    subgraph Data["Persistence & Cache Tier"]
        PG[("PostgreSQL 16\n(Prisma ORM)")]
        Redis[("Redis 7\n(BullMQ & Cache)")]
        MinIO[("Object Storage\n(MinIO / Cloudflare R2)")]
    end

    Clients --> Cloudflare
    Cloudflare --> WS
    WS -.->|Login / Register| SupaAuth
    SupaAuth -.->|JWT Bearer Token| Clients

    Clients -->|Bearer JWT + HTTPS| API
    Clients -.->|WSS Connection| Realtime

    API -->|JWKS Public Key Fetch| SupaAuth
    API -->|ACID Transactions| PG
    API -->|Session Cache & Queues| Redis
    API -.->|Presigned URLs| MinIO

    Worker -->|Process Jobs| Redis
    Worker -->|Read / Write| PG

    Realtime -->|Pub/Sub Adapter| Redis
```

### Runtime Breakdown

1. **`apps/api` (Core REST Engine)**: Fastify v4 HTTP engine compiling schemas natively with `@sinclair/typebox`, enforcing RFC 7807 problem details, and executing database transactions with Prisma.
2. **`apps/realtime` (Realtime Gateway)**: Physically isolated Socket.IO server designed for persistent WebSocket connections and room-based collaboration with `@socket.io/redis-adapter`.
3. **`apps/worker` (Background Worker Tier)**: Physically isolated BullMQ execution runtime consuming asynchronous queues, media processing jobs, and transactional outbox events.
4. **`apps/web-shell` (Frontend Shell)**: Next.js 15.5 App Router web application providing discovery, marketing, and user onboarding/authentication experiences.

---

## 4. Repository Structure

CreatorConnect is organized as a Turborepo monorepo using pnpm workspaces:

```
CreatorConnect/
├── .github/
│   └── workflows/
│       ├── pr-validation.yml          # Lint, typecheck, tests, Gitleaks, Semgrep, Playwright
│       └── codeql.yml                 # GitHub CodeQL SAST semantic security analysis
├── apps/
│   ├── api/                           # Core Fastify REST API modular monolith
│   ├── realtime/                      # Socket.IO Realtime Gateway service
│   ├── web-shell/                     # Next.js 15.5 web frontend and authentication flows
│   └── worker/                        # BullMQ background worker service
├── packages/
│   ├── auth/                          # CASL abilities, permissions, and RBAC rules
│   ├── config/                        # Shared TypeScript, ESLint, Prettier configurations
│   ├── contracts/                     # TypeBox API schemas, DTOs, and TypeScript models
│   ├── database/                      # Prisma schema, migrations, seed scripts, and client
│   ├── design-system/                 # Tailwind CSS tokens, color palettes, typography
│   ├── testing/                       # Shared testing utilities, factories, and helpers
│   ├── ui/                            # Accessible React UI component library
│   ├── utils/                         # UUIDv7 generation, date, and string formatting
│   └── validation/                    # Shared validation schemas and RFC 7807 problem details
├── tests/
│   └── e2e/                           # Cross-browser Playwright end-to-end smoke test suite
├── docs/                              # Authoritative architectural documentation & ADRs
├── docker-compose.yml                 # Local Docker services (PostgreSQL, Redis, MinIO)
├── package.json                       # Workspace root package manifest and scripts
├── pnpm-workspace.yaml                # Monorepo package inclusion definitions
└── turbo.json                         # Turborepo task pipeline configuration
```

---

## 5. Technology Stack

| Layer                  | Canonical Technology        | Version    | Purpose in CreatorConnect                                                      |
| :--------------------- | :-------------------------- | :--------- | :----------------------------------------------------------------------------- |
| **Package Manager**    | `pnpm`                      | `^9.15.4`  | Strict workspace protocol, deterministic lockfile, fast symlinked installation |
| **Monorepo Tooling**   | Turborepo                   | `^2.1.2`   | High-performance task orchestration, incremental caching                       |
| **Language**           | TypeScript                  | `^5.5.4`   | Strict type safety across all backend, frontend, and shared packages           |
| **Backend Framework**  | Fastify                     | `^4.29.1`  | High-throughput HTTP REST engine with native JSON schema validation            |
| **Frontend Framework** | Next.js                     | `^15.5.25` | React 18 / 19 web-shell, server and client components, Tailwind CSS            |
| **Database & ORM**     | PostgreSQL 16 + Prisma      | `^5.18.0`  | Relational persistence, migrations, type-safe queries, UUIDv7 primary keys     |
| **Cache & Queues**     | Redis 7 + BullMQ            | `^5.8.7`   | In-memory session cache, rate-limiting store, job queue broker                 |
| **Realtime Engine**    | Socket.IO                   | `^4.7.5`   | WebSocket gateway with Redis Pub/Sub adapter                                   |
| **Auth & Identity**    | Supabase Auth + `jose`      | `^5.6.3`   | Managed OAuth/credentials IdP, asymmetric RS256/ES256 JWKS verification        |
| **Authorization**      | `@casl/ability`             | `^6.7.1`   | Attribute- and ownership-based access control policies                         |
| **Validation & DTOs**  | `@sinclair/typebox`         | `^0.32.34` | JSON Schema-compliant DTO definition and fast compilation                      |
| **Styling**            | Tailwind CSS                | `^3.4.10`  | Design token-driven atomic styling and responsive components                   |
| **Unit Testing**       | Vitest                      | `^2.1.1`   | Fast unit and integration test runner with isolated worker forks               |
| **E2E Testing**        | Playwright                  | `^1.46.0`  | Cross-browser automated browser testing (Chromium, Firefox, WebKit)            |
| **Security Scanning**  | Gitleaks + Semgrep + CodeQL | Latest     | Automated secret detection, SAST, and semantic code analysis                   |

---

## 6. Development Setup

### Prerequisites

- **Node.js**: `v20.x` LTS (recommended: `v20.14.0` or later)
- **pnpm**: `v9.15.4` (install via Corepack: `corepack enable && corepack prepare pnpm@9.15.4 --activate`)
- **Docker & Docker Compose**: For containerized PostgreSQL, Redis, and MinIO

### Step-by-Step Setup

```bash
# 1. Clone the repository
git clone https://github.com/nikhilkr004/CreatorConnect.git
cd CreatorConnect

# 2. Configure environment variables
# Copy template to .env.local (or root .env) and populate mock/local values
cp .env.example .env

# 3. Start local infrastructure (PostgreSQL 16, Redis 7, MinIO)
pnpm docker:up

# 4. Install dependencies across all monorepo workspaces
pnpm install

# 5. Generate Prisma client and deploy database migrations
pnpm --filter @creatorconnect/database db:generate
pnpm --filter @creatorconnect/database db:migrate

# 6. Seed platform roles into the local database
pnpm --filter @creatorconnect/database db:seed

# 7. Start development servers across all workspaces
pnpm dev
```

### Available Development Commands

- `pnpm dev`: Runs all applications in watch mode via Turborepo.
- `pnpm build`: Builds all packages and applications for production.
- `pnpm lint`: Runs ESLint across all workspaces.
- `pnpm typecheck`: Executes TypeScript compiler (`tsc --noEmit`) across all packages.
- `pnpm format:check`: Validates formatting using Prettier.
- `pnpm format`: Re-formats code and documentation with Prettier.
- `pnpm test:unit`: Runs Vitest test suites across all packages.
- `pnpm test:e2e`: Runs Playwright end-to-end smoke tests.
- `pnpm docker:up`: Starts local Docker Compose background containers.
- `pnpm docker:down`: Stops local Docker Compose containers.

---

## 7. Environment Variables

All environment variables follow strict security guidelines:

- Real production credentials are **never** committed to version control.
- Copy `.env.example` to `.env` or `.env.local` for local execution.
- Variables are grouped by category as detailed below:

```ini
# --- Server Environment ---
NODE_ENV=development
PORT=3000
REALTIME_PORT=3001
LOG_LEVEL=debug
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# --- Persistence & Cache (Local Docker Defaults) ---
DATABASE_URL=postgresql://postgres:postgres_local_password@localhost:5432/creatorconnect_dev?schema=public
REDIS_URL=redis://localhost:6379/0

# --- Supabase Auth & Identity (Managed IdP) ---
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<public-anon-key>
SUPABASE_JWT_ISSUER=https://<your-project-ref>.supabase.co/auth/v1
SUPABASE_JWKS_URL=https://<your-project-ref>.supabase.co/auth/v1/.well-known/jwks.json

# --- Cloudflare R2 / S3 Storage (Future / Mock) ---
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key-id>
R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
R2_BUCKET_NAME=creatorconnect-dev-media
R2_PUBLIC_DOMAIN=https://dev-media.creatorconnect.com

# --- Payment & Notifications (Future / Mock) ---
RAZORPAY_KEY_ID=<razorpay-key-id>
RAZORPAY_KEY_SECRET=<razorpay-key-secret>
RAZORPAY_WEBHOOK_SECRET=<razorpay-webhook-secret>
FIREBASE_PROJECT_ID=<firebase-project-id>
RESEND_API_KEY=<resend-api-key>
```

---

## 8. Authentication & Authorization

CreatorConnect employs a 3-tier security model:

```
[ Incoming Request ]
        │
        ▼
[ Tier 1: Identity & Signature Verification ]
  • Extracts Bearer JWT from Authorization header
  • Validates signature against remote/cached JWKS public key set
  • Validates algorithm allowlist (RS256, ES256)
  • Enforces non-empty SUPABASE_JWT_ISSUER & aud
  • Decodes supabase_auth_id (sub) and email
        │
        ▼
[ Tier 2: Account Lifecycle & RBAC Role Assertion ]
  • Resolves internal User record by supabase_auth_id
  • Checks account status: ACTIVE (passes), SUSPENDED (403), DEACTIVATED (403)
  • Checks required role membership (CREATOR, PROFESSIONAL, BRAND, PODCASTER, ADMIN)
        │
        ▼
[ Tier 3: CASL Scoped Resource Authorization ]
  • Evaluates declarative CASL ability rules (e.g. can('update', 'User', { id }))
  • Prevents horizontal privilege escalation / IDOR
```

---

## 9. API Architecture & Implemented Endpoints

CreatorConnect implements an **API-First** contract model. All schemas are defined in `@creatorconnect/contracts` using TypeBox and validated at runtime with Fastify schema compilation.

### Standard RFC 7807 Problem Details

Error responses are returned in standard RFC 7807 envelope format:

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

### Authoritative Implemented Endpoints (v1)

| Method  | Endpoint                         | Auth Required        | Description                                                                                                                | Status Codes                      |
| :------ | :------------------------------- | :------------------- | :------------------------------------------------------------------------------------------------------------------------- | :-------------------------------- |
| `POST`  | `/api/v1/auth/sync`              | Bearer JWT           | Synchronizes Supabase identity to internal UUIDv7 user profile, assigning initial self-selected persona role.              | `200`, `201`, `400`, `401`, `409` |
| `GET`   | `/api/v1/users/me`               | Bearer JWT           | Retrieves authenticated user profile, assigned roles, and current account status.                                          | `200`, `401`, `403`               |
| `PATCH` | `/api/v1/users/me`               | Bearer JWT           | Updates authenticated user profile details (`firstName`, `lastName`, `avatarUrl`) with CASL ownership assertion.           | `200`, `400`, `401`, `403`        |
| `PATCH` | `/api/v1/admin/users/:id/status` | Bearer JWT (`ADMIN`) | Administratively updates user account status (`ACTIVE`, `SUSPENDED`, `DEACTIVATED`) with audit logging and lockout guards. | `200`, `400`, `401`, `403`, `404` |

---

## 10. Testing & Quality Assurance

CreatorConnect enforces automated quality gates in local environments and GitHub Actions CI:

```
                  ┌──────────────────────┐
                  │    Playwright E2E    │  Smoke journeys, cross-browser
                  ├──────────────────────┤
                  │   Integration Specs  │  Vitest + Prisma + Redis Isolation
                  ├──────────────────────┤
                  │      Unit Tests      │  Contract validation, CASL abilities
                  ├──────────────────────┤
                  │ Static Verification  │  TypeScript strict, Prettier, ESLint
                  └──────────────────────┘
```

1. **Unit & Spec Tests**: Executed via `pnpm test:unit` (`vitest run --workspace=vitest.workspace.ts`). Includes regression test suites for JWT verification, CASL abilities, user services, and concurrency controls.
2. **End-to-End Tests**: Executed via `pnpm test:e2e` (`playwright test`), verifying authentication route accessibility and self-selectable onboarding personas.
3. **Continuous Integration**: `.github/workflows/pr-validation.yml` triggers on every pull request to `dev` and `main`, running:
   - Dependency validation (`pnpm install --frozen-lockfile`)
   - Prettier format checks (`pnpm format:check`)
   - Monorepo linting (`pnpm lint`)
   - TypeScript compilation (`pnpm typecheck`)
   - Database migrations and test execution (`pnpm test:unit`)
   - Production workspace builds (`pnpm build`)
   - Secret scanning via Gitleaks (`gitleaks-action@v2`)
   - SAST analysis via Semgrep (`semgrep-action@v1`)
   - Playwright browser execution
4. **CodeQL Semantic Analysis**: `.github/workflows/codeql.yml` runs scheduled and pull-request semantic taint analysis for JavaScript and TypeScript.

---

## 11. Security Architecture

1. **JWT Algorithm Allowlisting**: Only asymmetric RS256/ES256 algorithms are permitted; symmetric HMAC or `none` algorithms are rejected.
2. **Fail-Closed Configuration**: Missing or empty issuer/JWKS environment settings cause token verification to fail closed.
3. **Self-Escalation Safeguards**: The registration schema explicitly rejects `ADMIN` in the onboarding payload (`RoleEscalationAttemptError`).
4. **Administrative Protection**: Administrators cannot change their own account status, and the system enforces a non-zero count of active administrators (`LastAdminLockoutError`).
5. **Concurrency Conflict Defense**: Optimistic concurrency checks and isolated transactions protect user updates from race conditions.
6. **Secret Scanning Enforcement**: Gitleaks actively monitors every PR to prevent secret exposure.
7. **Input Validation**: All incoming requests are validated against TypeBox JSON schemas before reaching route handlers.

---

## 12. Operational Verification & Production Readiness

CreatorConnect enforces an automated operational readiness framework (`packages/testing/src/operational`) evaluating four strict operational gates before any production deployment can be authorized. All mandatory gates must return `PASS` ($G_{\text{ready}} = \bigwedge g_i$):

```
┌────────────────────────────────────────────────────────────────────────┐
│                   CREATORCONNECT READINESS ENGINE                      │
│                                                                        │
│   Gate A: Backup & Restore Integrity      [PASS - Drill Verified]     │
│   Gate B: Monitoring & Telemetry          [PASS (Local) / NOT_VERIFIED]│
│   Gate C: Production Configuration        [PASS (Local) / BLOCKED]    │
│   Gate D: CI, Security & Release Gates   [PASS - Promoted 58e8ae0]    │
│                                                                        │
│   Fail-Closed Readiness Decision:         BLOCKED                      │
│   (Requires production credentials & external alerting configuration)  │
└────────────────────────────────────────────────────────────────────────┘
```

### Operational Gates Breakdown

1. **Gate A — Database Backup & Restore Drill (`PASS`)**:
   - **Verification Algorithm**: Custom PostgreSQL format dump with SHA-256 digest matching: $H(B_{\text{source}}) = H(B_{\text{verified}})$.
   - **Isolated Recovery Target**: Ephemeral container database `creatorconnect_restore_drill` provisioned and verified without touching production data.
   - **Integrity Validation**: All 32 public tables, 4 Prisma migrations (`0001`–`0004`), critical indexes (`notifications_user_id_created_at_id_idx`, `idx_assignments_search`, `users_email_key`), and relational foreign keys validated.
   - **Empirical Recovery Metrics**:
     - Measured RTO = **1.44 seconds** (SLA target: $< 900$ seconds / 15 minutes) $\rightarrow$ **PASS**.
     - Measured RPO = **0.44 seconds** (SLA target: $< 5$ seconds) $\rightarrow$ **PASS**.

2. **Gate B — Telemetry, Observability & Alert Delivery (`PASS (Test) / NOT_VERIFIED (Prod)`)**:
   - **Liveness & Readiness Probes**: `/health` (liveness: 200 OK, uptime) and `/ready` (readiness: 200 OK, service dependencies) verified locally.
   - **Alert Delivery Formula**: $(\text{Alerts received} / \text{Alerts sent}) \times 100\%$ with strict 100% threshold and severity-based latency SLAs ($P1 \le 60\text{s}$, $P2 \le 300\text{s}$).
   - **Production Status**: Unit and local testing pass; live external notification delivery (PagerDuty, Slack webhook) is `NOT_VERIFIED` pending production infrastructure access.

3. **Gate C — Production Secrets & Configuration (`PASS (Test) / BLOCKED (Prod)`)**:
   - **Zero Secret Disclosure**: `ConfigurationVerifier` redacts all credentials in logs and reports (`postgresql://***:***@***:***/***`).
   - **Security Invariants**: Enforces HTTPS JWKS URLs, forbids wildcard CORS (`*`), and prohibits development/mock connection strings in production mode.
   - **Production Status**: Automated validation ready; live verification against production secrets manager requires release-owner credentials.

4. **Gate D — Application Readiness & Release Compatibility (`PASS`)**:
   - **Candidate Commit**: `58e8ae0007188e25fc7d9f144e1e10a6ec7ce6ba` promoted to `origin/dev` and `origin/main` via verified fast-forward promotion.
   - **Automated CI Gates**: Strict TypeScript, ESLint, Prettier, Gitleaks, Semgrep, CodeQL AST analysis, Vitest unit/integration suites, and Playwright E2E suites.

> [!IMPORTANT]
> **Production Deployment Boundary**: A successful Git promotion or documentation update **DOES NOT** authorize automated production deployment. Production deployment remains a separate, explicit authorization boundary requiring release-owner approval.

---

## 13. Roadmap

The complete platform roadmap is structured into 16 phases. Below is the separation between verified implemented milestones and planned future work:

### Implemented Milestones

- [x] **Phase 0: Product & Architecture Lock**: Completed and documented in `docs/`.
- [x] **Phase 1: Monorepo & Development Foundation**: Workspaces, tooling, and database containerization.
- [x] **Phase 2: Design System & Microfrontend Foundation**: Shared UI components and Next.js web-shell.
- [x] **Phase 3: Authentication & Identity Foundation**: Supabase Auth, JWT verification, RBAC, and CASL authorization.
- [x] **Phase 4: Profiles, Portfolio, Assignments & Discovery**: 4 personas, portfolio CRUD, presigned media, assignments, atomic hiring, and pg_trgm/tsvector search.
- [x] **Phase 5: Realtime Messaging, Outbox Events & Moderation**: 32-table database schema, Socket.IO WebSockets cluster with Redis adapter, monotonic sequencing, client idempotency, transactional outbox relay, ClamAV antivirus scanning, user blocking, reports & moderation.
- [x] **Phase 5 Operational Verification**: Evaluated Gates A–D. Gate A (isolated DB restore drill PASS: RTO 1.4s, RPO 0.4s, SHA-256 match) and Gate D (CI passed & promoted to dev/main). Gate B (external alert delivery NOT_VERIFIED) and Gate C (production secrets BLOCKED) remain pending external production credentials; production deployment is NOT authorized.

### Planned Milestones

- [ ] **Phase 6: Projects & Deliverable Escrow (Planned)**: Milestone sign-offs, revision workflows, and deliverable watermarking.
- [ ] **Phase 7: Payments, Ledger & Subscriptions (Planned)**: Razorpay double-entry ledger, webhook verification, and platform fees.
- [ ] **Phase 8: Reviews, Advanced Moderation & Dispute Arbitration (Planned)**: Double-blind feedback loops and Admin dispute center.
- [ ] **Phase 9: Observability, Resilience & Load Testing (Planned)**: External SaaS APM integration, PagerDuty alerting delivery, and k6 stress testing.
- [ ] **Phase 10: Staging Rehearsal & Production Deployment (Planned)**: Multi-AZ AWS ECS deployment with zero-downtime blue/green rollouts.
- [ ] **Phase 11: Post-Launch Scale & AI Semantic Matching (Planned)**: Vector embeddings (`pgvector`) for natural language creator discovery.

---

## 14. Contributing & Development Standards

All contributions must adhere to platform engineering rules:

1. **SOLID Principles**: Single-responsibility domain services; business rules reside in services, not route controllers or React components.
2. **Library-First Mandate**: Evaluate vetted open-source solutions before writing custom utility code (per ADR-016).
3. **No Duplicate Libraries**: Enforce single approved libraries across workspaces (e.g. Fastify for REST, Prisma for ORM, TypeBox for validation).
4. **Strict TypeScript**: Compiler options `noImplicitAny`, `strictNullChecks`, and `noUnusedLocals` are strictly enforced across all workspaces.
5. **Backward-Compatible Database Migrations**: Schema alterations must follow Expand-Migrate-Contract patterns; destructive column drops are prohibited without prior deprecation cycles.
6. **Definition of Done**: A PR may merge only if all CI status checks (lint, typecheck, format, unit tests, E2E tests, Gitleaks, Semgrep, CodeQL) are green.

---

## 15. Git Branching & Promotion Strategy

- **`main`**: Production-ready release branch. Direct commits and force-pushes are strictly prohibited.
- **`dev`**: Primary integration branch where verified features converge.
- **`feature/<name>`**: Scoped feature development branches originating from `dev`.
- **`bugfix/<name>`**: Issue remediation branches targeting `dev`.
- **Promotion Flow**: Feature branches merge to `dev` via PR; `dev` promotes to `main` via fast-forward release gates after passing all security and quality checks.

---

## 16. License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.
