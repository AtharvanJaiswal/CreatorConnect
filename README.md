# CreatorConnect — Multi-Sided Creator Economy Platform

[![Architecture Locked](https://img.shields.io/badge/Architecture-Phase%200%20Locked-brightgreen.svg)](file:///f:/CreatorConnect/docs/README.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-blue.svg)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-v4.x-black.svg)](https://fastify.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-green.svg)](https://spec.openapis.org/oas/v3.1.0)
[![Playwright](https://img.shields.io/badge/Playwright-21%20Journeys-purple.svg)](https://playwright.dev/)

Welcome to the official repository for **CreatorConnect**, an enterprise-grade multi-sided creator economy platform orchestrating discovery, assignments, contracts, deliverables, realtime collaboration, and escrow settlements between **Creators**, **Production Professionals**, **Brands**, and **Podcasters**.

---

## 1. Project Overview & Architecture Direction

CreatorConnect operates under the architectural principle of:

> **"Enterprise architecture without unnecessary enterprise overengineering."**

The platform is designed around an **API-First, Event-Driven, Multi-Zone Microfrontend architecture** built on a **Modular Monolithic Core** with **physically isolated specialist services**:

- **Core Modular API (`Fastify REST`)**: Stateless business API managing 22 logical domains with ACID transactions in PostgreSQL 16.
- **Realtime Gateway (`Fastify + Socket.IO`)**: Physically isolated service managing 10,000+ persistent WebSocket connections, presence, and chat via Redis Pub/Sub.
- **Background Worker Tier (`BullMQ Worker`)**: Physically isolated worker tier running compute-heavy video/image transcoding (Sharp/FFmpeg), FCM push alerts, Resend emails, and transactional outbox relays.
- **Client Tier**: Web Multi-Zones (Next.js), Mobile (iOS & Android), and Admin Portal consuming a single, authoritative OpenAPI 3.1 contract.

---

## 2. Master Integration Manuals

- [**BACKEND.MD (The Definitive Backend Integration Manual)**](file:///f:/CreatorConnect/BACKEND.md)  
  _Mandatory reading for all Web, Mobile (Android/iOS), and Admin engineers. Covers authentication, 42 canonical entities, the API endpoint catalog, RFC 7807 error envelopes, cursor pagination, R2 uploads, WebSockets, and Razorpay escrow._
- [**Mobile Client Integration Manual (Android & iOS)**](file:///f:/CreatorConnect/docs/api/mobile-integration.md)  
  _20-point engineering manual covering offline handling, background WebSockets, mobile retry backoff, and FCM tokens._
- [**Web Frontend Integration Manual**](file:///f:/CreatorConnect/docs/api/web-integration.md)  
  _Covers typed TanStack Query client generation, Radix UI primitives, React Hook Form, and UX smoothness states._

---

## 3. Technology Stack

| Layer                      | Canonical Approved Technology                                     |
| :------------------------- | :---------------------------------------------------------------- |
| **Language & Runtime**     | Node.js (v20 LTS) + TypeScript (v5.5+)                            |
| **HTTP Framework**         | Fastify v4.x (High throughput, native schema compilation)         |
| **Relational Database**    | PostgreSQL 16 managed via Prisma ORM                              |
| **Cache & Task Broker**    | Redis 7 + BullMQ v5.x                                             |
| **Realtime Gateway**       | Socket.IO v4.x with `@socket.io/redis-adapter`                    |
| **Identity Provider**      | Supabase Auth (OAuth, OTP, RS256 JWTs via JWKS)                   |
| **Object Storage**         | Cloudflare R2 (S3-compatible SDK, $0 egress fees)                 |
| **Payment Gateway**        | Razorpay (Provider abstraction port, double-entry ledger)         |
| **Push & Email**           | Firebase Cloud Messaging (FCM) + Resend (React Email)             |
| **Testing Suite**          | Vitest + Testcontainers (Postgres/Redis) + Playwright             |
| **API Contract & Tooling** | OpenAPI 3.1 + TypeBox + Scalar + Bruno + Orval                    |
| **DevOps & Containers**    | Multi-stage Distroless Docker + GitHub Actions + AWS ECS Multi-AZ |
| **Observability**          | Pino JSON Logger + Sentry APM + OpenTelemetry                     |

---

## 4. Repository Structure

```
f:\CreatorConnect/
├── README.md                  # Master repository entry point (This file)
├── BACKEND.md                 # Definitive Backend Integration Manual
├── apps/
│   ├── api/                   # Core Modular API Engine (Fastify REST Service)
│   ├── realtime/              # Realtime Gateway (Fastify + Socket.IO Service)
│   ├── worker/                # Background Processing Tier (BullMQ Worker)
│   ├── web-shell/             # Next.js Public Discovery & Marketing
│   ├── app-creator/           # Next.js Creator Gig & Profile Workspace
│   ├── app-pro/               # Next.js Production Freelancer Workspace
│   ├── app-brand/             # Next.js Brand Campaign & Escrow Workspace
│   └── app-admin/             # Next.js Operations & Dispute Cockpit
├── packages/
│   ├── contracts/             # OpenAPI 3.1 JSON and generated TypeScript models
│   ├── api-client/            # Generated TanStack Query hooks & Fetch client (Orval)
│   ├── ui/                    # shadcn/ui + Radix UI accessible components
│   ├── design-system/         # Tailwind CSS tokens, colors, typography
│   ├── auth/                  # Supabase session provider & CASL authorization rules
│   ├── validation/            # Shared TypeBox & Zod validation schemas
│   ├── utils/                 # Date-fns, currency minor units, text formatters
│   ├── config/                # Shared tsconfig, ESLint, and Prettier configurations
│   └── testing/               # Testcontainers factories and Playwright fixtures
└── docs/                      # Authoritative Documentation Suite
    ├── architecture/          # Product, System, Microservices, Standards, Risk Register, Reliability
    ├── api/                   # API architecture, Mobile & Web integration manuals
    ├── database/              # Conceptual ERD, 42 canonical entities, indexing strategy
    ├── security/              # STRIDE threat model, RBAC, presigned uploads, audit logs
    ├── testing/               # Testing pyramid and 21 Playwright customer journeys
    ├── deployment/            # CI/CD, environments, disaster recovery specification
    ├── operations/            # Pino logging, metrics, traces, incident response runbook
    ├── adr/                   # 20 Architecture Decision Records (ADR-001 to ADR-020)
    └── roadmap/               # 16-Phase execution roadmap (PHASE-00 to PHASE-15)
```

---

## 5. Multi-Phase Engineering Roadmap

Execution progresses sequentially across 16 formal phases:

| Phase                                                                     | Description                                             | Status               |
| :------------------------------------------------------------------------ | :------------------------------------------------------ | :------------------- |
| [**Phase 0**](file:///f:/CreatorConnect/docs/roadmap/PHASE-00-README.md)  | **Product + Architecture Lock**                         | **COMPLETED**        |
| [**Phase 1**](file:///f:/CreatorConnect/docs/roadmap/PHASE-01-README.md)  | Development Environment + Monorepo Scaffolding          | **READY FOR REVIEW** |
| [**Phase 2**](file:///f:/CreatorConnect/docs/roadmap/PHASE-02-README.md)  | Design System + Microfrontend Foundation                | NOT STARTED          |
| [**Phase 3**](file:///f:/CreatorConnect/docs/roadmap/PHASE-03-README.md)  | Infrastructure + DevOps Foundation                      | NOT STARTED          |
| [**Phase 4**](file:///f:/CreatorConnect/docs/roadmap/PHASE-04-README.md)  | Identity + Authentication + Authorization               | NOT STARTED          |
| [**Phase 5**](file:///f:/CreatorConnect/docs/roadmap/PHASE-05-README.md)  | Profiles + Portfolio (Cloudflare R2 Direct Upload)      | NOT STARTED          |
| [**Phase 6**](file:///f:/CreatorConnect/docs/roadmap/PHASE-06-README.md)  | Discovery + Search (PostgreSQL FTS) + Matching          | NOT STARTED          |
| [**Phase 7**](file:///f:/CreatorConnect/docs/roadmap/PHASE-07-README.md)  | Assignments / Campaigns + Applications                  | NOT STARTED          |
| [**Phase 8**](file:///f:/CreatorConnect/docs/roadmap/PHASE-08-README.md)  | Projects + Deliverables + Hiring                        | NOT STARTED          |
| [**Phase 9**](file:///f:/CreatorConnect/docs/roadmap/PHASE-09-README.md)  | Messaging (Socket.IO Gateway) + Community               | NOT STARTED          |
| [**Phase 10**](file:///f:/CreatorConnect/docs/roadmap/PHASE-10-README.md) | Notifications (FCM + Resend) + Background Jobs          | NOT STARTED          |
| [**Phase 11**](file:///f:/CreatorConnect/docs/roadmap/PHASE-11-README.md) | Payments (Razorpay Escrow) + Ledger + Subscriptions     | NOT STARTED          |
| [**Phase 12**](file:///f:/CreatorConnect/docs/roadmap/PHASE-12-README.md) | Reviews (Double-Blind) + Referrals + Moderation + Admin | NOT STARTED          |
| [**Phase 13**](file:///f:/CreatorConnect/docs/roadmap/PHASE-13-README.md) | Analytics + Performance Hardening (k6) + Security       | NOT STARTED          |
| [**Phase 14**](file:///f:/CreatorConnect/docs/roadmap/PHASE-14-README.md) | Full QA + Staging Rehearsal + Production Launch         | NOT STARTED          |
| [**Phase 15**](file:///f:/CreatorConnect/docs/roadmap/PHASE-15-README.md) | Evolutionary Scale + AI Semantic Matching (`pgvector`)  | NOT STARTED          |

---

## 6. Development Setup (Phase 1+)

```bash
# 1. Clone the repository
git clone https://github.com/CreatorConnect/CreatorConnect.git
cd CreatorConnect

# 2. Launch containerized PostgreSQL, Redis, and MinIO
docker compose up -d

# 3. Install workspace dependencies
pnpm install

# 4. Generate database client and run migrations
pnpm db:migrate

# 5. Start development servers
pnpm dev
```

---

## 7. Testing Instructions

```bash
# Run unit tests across all packages (Vitest)
pnpm test:unit

# Run integration tests against real PostgreSQL/Redis (Testcontainers)
pnpm test:integration

# Validate OpenAPI 3.1 contracts against backend routes
pnpm test:contract

# Run the 21 Critical Customer Journeys (Playwright)
pnpm test:e2e
```

---

## 8. Non-Negotiable Contribution Rules

1. **SOLID Principles**: No god classes, god services, or god components. Business rules belong in domain services, not HTTP route handlers or React components.
2. **Library-First Mandate**: Before implementing functionality manually, evaluate mature open-source libraries (BullMQ, TypeBox, Radix, Sharp, FFmpeg, date-fns).
3. **No Duplicate Libraries**: Never install parallel libraries for the same job (no Axios alongside Fetch; no Drizzle alongside Prisma).
4. **Backend is the Single Truth**: Authoritative business validation, state machines, and escrow calculations live strictly on the backend.
5. **Definition of Done**: Every PR must include unit/integration tests, zero security scan errors (Trivy/Gitleaks/Semgrep), and pass CI checks.

---

## 9. Git Workflow & Branching Strategy

- **Remote**: `https://github.com/nikhilkr004/CreatorConnect.git`
- **Branch Taxonomy**:
  - `main`: Protected release branch representing production-ready releases. Direct pushes and force pushes are strictly disabled.
  - `dev`: Primary integration and active development branch. All feature branches branch off and merge into `dev`.
  - `feature/<short-description>`: New functional domain additions (e.g., `feature/profile-api`).
  - `bugfix/<short-description>`: Defect repairs against integration testing (e.g., `bugfix/webhook-replay`).
  - `hotfix/<short-description>`: Urgent production fixes branching off `main`.
  - `docs/<short-description>`: Documentation and ADR additions.
- **Commit Convention**: Enforces **Conventional Commits**:
  - `feat(domain): ...` (New functionality)
  - `fix(domain): ...` (Bug remediation)
  - `docs(domain): ...` (Documentation changes)
  - `test(domain): ...` (Test suite additions)
  - `chore(tool): ...` (Tooling and dependency configuration)
  - `security(boundary): ...` (Security hardening)
- **Pull Request Workflow**:
  1. Branch off `dev`.
  2. Implement changes with unit/integration tests.
  3. Ensure clean formatting, typechecks, and zero security vulnerabilities.
  4. Open Pull Request targeting `dev`. Require 2 peer approvals and green CI.
