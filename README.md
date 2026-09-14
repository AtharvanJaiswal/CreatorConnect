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

| Phase           | Milestone Name                               | Implementation Status | Key Implemented Capabilities                                                                                                                                                                                           |
| :-------------- | :------------------------------------------- | :-------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 0**     | **Product & Architecture Lock**              | **COMPLETED**         | 20 Architecture Decision Records (ADRs), C4 architecture diagrams, canonical data models, RFC 7807 error envelopes, risk register.                                                                                     |
| **Phase 1**     | **Monorepo & Engineering Foundation**        | **COMPLETED**         | pnpm 9 workspaces, Turborepo 2, strict TypeScript 5.5, Prettier, ESLint, Vitest, Playwright, Docker Compose stacks (PostgreSQL 16, Redis 7, MinIO).                                                                    |
| **Phase 2**     | **Design System & Microfrontend Foundation** | **COMPLETED**         | Tailwind CSS token preset (`@creatorconnect/design-system`), accessible UI component library (`@creatorconnect/ui`), responsive Next.js 15.5 `apps/web-shell` shell layout.                                            |
| **Phase 3**     | **Authentication & Identity Foundation**     | **COMPLETED**         | Managed Supabase Auth integration, asymmetric JWKS JWT verification, internal UUIDv7 user identity, 3-tier RBAC & CASL authorization, user lifecycle management, audit logging, Redis session caching, web auth flows. |
| **Phases 4–15** | **Domain Features & Production Scale**       | **PLANNED**           | Profile portfolios, R2 presigned media, FTS matching, campaign briefs, escrow payments, realtime messaging, push notifications (see [Roadmap](#12-roadmap)).                                                           |

### Phase 3 Technical Highlights (Implemented)

- **Supabase Auth Integration**: External managed Identity Provider (IdP) handling registration, authentication, OAuth sessions, and password recovery.
- **Asymmetric JWKS JWT Verification**: Fastify API validates RS256/ES256 bearer tokens against remote or local JWKS endpoints using `jose` with in-memory public key set caching.
- **Fail-Closed Security Invariant**: Token verification strictly enforces configured `SUPABASE_JWT_ISSUER` and `aud`; requests without configured issuer or invalid signatures fail closed immediately.
- **Internal UUIDv7 Identity**: Decouples external Supabase identity (`supabase_auth_id`) from internal database foreign keys using timestamp-ordered UUIDv7 identifiers.
- **Role-Based Access Control (RBAC)**: Baseline platform roles (`CREATOR`, `PROFESSIONAL`, `BRAND`, `PODCASTER`, `ADMIN`) seeded with strict self-selection guards (e.g., `ADMIN` role can never be self-assigned during onboarding).
- **CASL Scoped Authorization**: Fine-grained subject-based permissions (`@creatorconnect/auth`) with runtime policy checks for resource ownership.
- **User Lifecycle Management**: Three-state account lifecycle (`ACTIVE`, `SUSPENDED`, `DEACTIVATED`) enforced at the API authentication boundary.
- **Administrative Safeguards**: Last-admin lockout protection and self-status mutation prevention on administrative endpoints.
- **Structured Audit Logging**: Transactional, tamper-evident audit records capturing `actor_id`, `action`, `resource_type`, `resource_id`, `before_state`, `after_state`, `ip_address`, and `user_agent`.
- **Redis Identity & Session Caching**: High-performance caching layer for verified user identities and role assignments with graceful fallback when cache is unreachable.
- **Web Authentication Flows**: Complete Next.js client pages for `/login`, `/register` (with persona selection), `/reset-password`, and `/unauthorized`, backed by an active `AuthProvider` React context.

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

## 12. Roadmap

The complete platform roadmap is structured into 16 phases. Below is the separation between verified implemented milestones and planned future work:

### Implemented Milestones

- [x] **Phase 0: Product & Architecture Lock**: Completed and documented in `docs/`.
- [x] **Phase 1: Monorepo & Development Foundation**: Workspaces, tooling, and database containerization.
- [x] **Phase 2: Design System & Microfrontend Foundation**: Shared UI components and Next.js web-shell.
- [x] **Phase 3: Authentication & Identity Foundation**: Supabase Auth, JWT verification, RBAC, and CASL authorization.

### Planned Milestones

- [ ] **Phase 4: Profiles & Portfolio (Planned)**: Creator and Professional media showcases with Cloudflare R2 direct uploads.
- [ ] **Phase 5: Discovery & Matching Engine (Planned)**: Full-text search (PostgreSQL `tsvector`), trigram filters, and rule-based candidate matching.
- [ ] **Phase 6: Campaigns & Applications (Planned)**: Brand assignment briefs and structured application workflows.
- [ ] **Phase 7: Projects & Deliverable Escrow (Planned)**: Milestone sign-offs, revision workflows, and deliverable watermarking.
- [ ] **Phase 8: Realtime Messaging & Collaboration (Planned)**: Persistent chat rooms via the isolated Socket.IO Realtime Gateway.
- [ ] **Phase 9: Background Worker & Notifications (Planned)**: BullMQ background processing with Firebase Cloud Messaging (FCM) and Resend emails.
- [ ] **Phase 10: Payments, Ledger & Subscriptions (Planned)**: Razorpay double-entry ledger, webhook verification, and platform fees.
- [ ] **Phase 11: Reviews, Moderation & Dispute Arbitration (Planned)**: Double-blind feedback loops and Admin dispute center.
- [ ] **Phase 12: Observability, Resilience & Load Testing (Planned)**: Pino redaction verification, Sentry APM, and k6 stress testing.
- [ ] **Phase 13: Staging Rehearsal & Production Deployment (Planned)**: Multi-AZ AWS ECS deployment with zero-downtime blue/green rollouts.
- [ ] **Phase 14: Post-Launch Scale & AI Semantic Matching (Planned)**: Vector embeddings (`pgvector`) for natural language creator discovery.

---

## 13. Contributing & Development Standards

All contributions must adhere to platform engineering rules:

1. **SOLID Principles**: Single-responsibility domain services; business rules reside in services, not route controllers or React components.
2. **Library-First Mandate**: Evaluate vetted open-source solutions before writing custom utility code (per ADR-016).
3. **No Duplicate Libraries**: Enforce single approved libraries across workspaces (e.g. Fastify for REST, Prisma for ORM, TypeBox for validation).
4. **Strict TypeScript**: Compiler options `noImplicitAny`, `strictNullChecks`, and `noUnusedLocals` are strictly enforced across all workspaces.
5. **Backward-Compatible Database Migrations**: Schema alterations must follow Expand-Migrate-Contract patterns; destructive column drops are prohibited without prior deprecation cycles.
6. **Definition of Done**: A PR may merge only if all CI status checks (lint, typecheck, format, unit tests, E2E tests, Gitleaks, Semgrep, CodeQL) are green.

---

## 14. Git Branching & Promotion Strategy

- **`main`**: Production-ready release branch. Direct commits and force-pushes are strictly prohibited.
- **`dev`**: Primary integration branch where verified features converge.
- **`feature/<name>`**: Scoped feature development branches originating from `dev`.
- **`bugfix/<name>`**: Issue remediation branches targeting `dev`.
- **Promotion Flow**: Feature branches merge to `dev` via PR; `dev` promotes to `main` via fast-forward release gates after passing all security and quality checks.

---

## 15. License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.
