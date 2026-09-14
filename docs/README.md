# CreatorConnect — Architectural Documentation Suite (Phase 0 Lock)

Welcome to the authoritative engineering and architectural documentation suite for the **CreatorConnect** multi-sided creator economy platform.

---

## Primary Integration Manuals

- [**Root Repository Entry Point**](file:///f:/CreatorConnect/README.md)
- [**BACKEND.MD (The Master Backend Integration Manual)**](file:///f:/CreatorConnect/BACKEND.md)
- [**Mobile Integration Manual (Android & iOS)**](file:///f:/CreatorConnect/docs/api/mobile-integration.md)
- [**Web Frontend Integration Manual**](file:///f:/CreatorConnect/docs/api/web-integration.md)

---

## Documentation Index

### 1. Architecture & Domain Design

- [Product Architecture](file:///f:/CreatorConnect/docs/architecture/product-architecture.md): Personas, user journeys, marketplace lifecycle, capabilities.
- [System Architecture](file:///f:/CreatorConnect/docs/architecture/system-architecture.md): C4 context and container models, sync vs async communications.
- [Microservices & Domain Boundary Analysis](file:///f:/CreatorConnect/docs/architecture/microservices.md): 26-domain Service Boundary Decision Matrix, physical extraction triggers.
- [Microfrontends & Shared Packages](file:///f:/CreatorConnect/docs/architecture/microfrontends.md): Multi-zone domain apps, shared packages, server vs client state.
- [Architecture Diagrams Catalog](file:///f:/CreatorConnect/docs/architecture/diagrams.md): All 14 authoritative Mermaid architecture and flow diagrams.
- [Dependency Governance Policy](file:///f:/CreatorConnect/docs/architecture/dependency-policy.md): Library-First mandate, 7-point vetting checklist, duplicate prevention.
- [Engineering Standards](file:///f:/CreatorConnect/docs/architecture/engineering-standards.md): SOLID, DRY, KISS, clean architecture, RFC 7807 error envelopes, Definition of Done.
- [Reliability Engineering & Fail-Safe Architecture](file:///f:/CreatorConnect/docs/architecture/reliability-engineering.md): Expand-Migrate-Contract, concurrency defense, idempotency, synthetic testing, DoD.
- [Architecture Risk Register](file:///f:/CreatorConnect/docs/architecture/risk-register.md): Quantified matrix of technical, financial, operational, and security risks.

### 2. Data & API Architecture

- [Database Architecture Specification](file:///f:/CreatorConnect/docs/database/database-architecture.md): Conceptual ERD, 42 canonical entities, indexing, ledger, UUIDv7.
- [API Architecture Specification](file:///f:/CreatorConnect/docs/api/api-architecture.md): OpenAPI 3.1, TypeBox, Fastify Swagger, Orval client generation, cursor pagination.
- [Mobile Integration Manual](file:///f:/CreatorConnect/docs/api/mobile-integration.md): 20-point guide for native/RN Android & iOS developers.
- [Web Frontend Integration Manual](file:///f:/CreatorConnect/docs/api/web-integration.md): Guide for typed TanStack Query microfrontend consumers.

### 3. Security Architecture

- [Security Architecture & Threat Model](file:///f:/CreatorConnect/docs/security/security-architecture.md): STRIDE analysis, Supabase Auth decoupling, RBAC, presigned uploads, webhook security.

### 4. Quality Assurance & Testing

- [Quality Engineering & Testing Strategy](file:///f:/CreatorConnect/docs/testing/testing-strategy.md): Testing pyramid, Vitest, Testcontainers, contract tests, k6 load testing.
- [Playwright E2E Strategy](file:///f:/CreatorConnect/docs/testing/playwright-strategy.md): Specification and fixtures for the 21 critical customer journeys.

### 5. DevOps, Deployment & Operations

- [CI/CD Pipeline Strategy](file:///f:/CreatorConnect/docs/deployment/cicd.md): Automated PR checks, staging rehearsal, blue/green production deployment, Trivy scans.
- [Environment & Containerization Strategy](file:///f:/CreatorConnect/docs/deployment/environments.md): Local/Dev/Staging/Prod isolation, multi-stage Dockerfiles, safe `.env.example`.
- [Disaster Recovery & Business Continuity](file:///f:/CreatorConnect/docs/deployment/disaster-recovery.md): RPO/RTO metrics, Aurora Multi-AZ failover, mandatory restore drills.
- [Incident Response & Security Runbook](file:///f:/CreatorConnect/docs/operations/incident-response.md): 10-step incident lifecycle, P1-P4 escalation, active attack containment playbooks.
- [Observability & Telemetry Specification](file:///f:/CreatorConnect/docs/operations/observability.md): Pino logging, Sentry error monitoring, OpenTelemetry metrics, alerting thresholds.

### 6. Engineering Roadmap & Phase README System

- [Master 16-Phase Roadmap](file:///f:/CreatorConnect/docs/roadmap/phase-roadmap.md): Milestone objectives, dependencies, deliverables, and DoD for Phases 0 through 15.
- [Phase 00 — Product & Architecture Lock](file:///f:/CreatorConnect/docs/roadmap/PHASE-00-README.md) _(COMPLETED)_
- [Phase 01 — Monorepo & Dev Environment](file:///f:/CreatorConnect/docs/roadmap/PHASE-01-README.md) _(COMPLETED)_
- [Phase 02 — Design System & MFE Foundation](file:///f:/CreatorConnect/docs/roadmap/PHASE-02-README.md) _(COMPLETED)_
- [Phase 03 — Identity & Authentication Foundation](file:///f:/CreatorConnect/docs/roadmap/PHASE-03-README.md) _(COMPLETED)_
- [Phase 04 — Identity, Auth & RBAC](file:///f:/CreatorConnect/docs/roadmap/PHASE-04-README.md) _(NOT STARTED)_
- [Phase 05 — Profiles & Portfolio (R2 Uploads)](file:///f:/CreatorConnect/docs/roadmap/PHASE-05-README.md) _(NOT STARTED)_
- [Phase 06 — Discovery, FTS & Matcher](file:///f:/CreatorConnect/docs/roadmap/PHASE-06-README.md) _(NOT STARTED)_
- [Phase 07 — Campaigns & Applications](file:///f:/CreatorConnect/docs/roadmap/PHASE-07-README.md) _(NOT STARTED)_
- [Phase 08 — Projects, Deliverables & Hiring](file:///f:/CreatorConnect/docs/roadmap/PHASE-08-README.md) _(NOT STARTED)_
- [Phase 09 — Messaging (Socket.IO) & Community](file:///f:/CreatorConnect/docs/roadmap/PHASE-09-README.md) _(NOT STARTED)_
- [Phase 10 — Notifications (FCM/Resend) & Worker](file:///f:/CreatorConnect/docs/roadmap/PHASE-10-README.md) _(NOT STARTED)_
- [Phase 11 — Payments (Razorpay Escrow) & Ledger](file:///f:/CreatorConnect/docs/roadmap/PHASE-11-README.md) _(NOT STARTED)_
- [Phase 12 — Reviews, Moderation & Admin](file:///f:/CreatorConnect/docs/roadmap/PHASE-12-README.md) _(NOT STARTED)_
- [Phase 13 — Analytics, Performance (k6) & Security](file:///f:/CreatorConnect/docs/roadmap/PHASE-13-README.md) _(NOT STARTED)_
- [Phase 14 — Full QA, Staging Rehearsal & Launch](file:///f:/CreatorConnect/docs/roadmap/PHASE-14-README.md) _(NOT STARTED)_
- [Phase 15 — Scale & AI Semantic Matching](file:///f:/CreatorConnect/docs/roadmap/PHASE-15-README.md) _(NOT STARTED)_

### 7. Architecture Decision Records (ADRs)

- [ADR-001: Modular Monolith Core with Physically Isolated Specialist Services](file:///f:/CreatorConnect/docs/adr/ADR-001-microservices-boundary.md)
- [ADR-002: Multi-Zone Domain Microfrontends with Shared Monorepo Packages](file:///f:/CreatorConnect/docs/adr/ADR-002-microfrontend-shell-architecture.md)
- [ADR-003: Adoption of Fastify as the Core HTTP Framework](file:///f:/CreatorConnect/docs/adr/ADR-003-fastify-backend-runtime.md)
- [ADR-004: PostgreSQL 16 with Prisma ORM for Persistence](file:///f:/CreatorConnect/docs/adr/ADR-004-postgresql-prisma-orm.md)
- [ADR-005: OpenAPI 3.1 Contract-First Architecture & Automated Client Generation](file:///f:/CreatorConnect/docs/adr/ADR-005-openapi-first-contract-generation.md)
- [ADR-006: Supabase Auth for Managed Identity & Token Lifecycle](file:///f:/CreatorConnect/docs/adr/ADR-006-supabase-auth-identity-provider.md)
- [ADR-007: Backend-Owned Multi-Tier RBAC & Resource Authorization](file:///f:/CreatorConnect/docs/adr/ADR-007-backend-owned-rbac-authorization.md)
- [ADR-008: Redis 7 and BullMQ for Asynchronous Queues & Event Processing](file:///f:/CreatorConnect/docs/adr/ADR-008-redis-bullmq-async-queues.md)
- [ADR-009: Socket.IO with Redis Adapter for Realtime Collaboration](file:///f:/CreatorConnect/docs/adr/ADR-009-socketio-realtime-engine.md)
- [ADR-010: Cloudflare R2 for Object Storage with Presigned Direct Uploads](file:///f:/CreatorConnect/docs/adr/ADR-010-cloudflare-r2-presigned-media.md)
- [ADR-011: Razorpay Integration with Provider Abstraction & Double-Entry Ledger](file:///f:/CreatorConnect/docs/adr/ADR-011-razorpay-idempotent-payments.md)
- [ADR-012: Multi-Channel Notification Engine with Firebase Cloud Messaging & Resend](file:///f:/CreatorConnect/docs/adr/ADR-012-fcm-multi-channel-notifications.md)
- [ADR-013: Automated Testing Framework Standardization: Vitest and Playwright](file:///f:/CreatorConnect/docs/adr/ADR-013-playwright-vitest-testing.md)
- [ADR-014: Continuous Integration & Deployment with GitHub Actions](file:///f:/CreatorConnect/docs/adr/ADR-014-github-actions-cicd-pipeline.md)
- [ADR-015: Unified Observability Stack: Pino, Sentry, and OpenTelemetry](file:///f:/CreatorConnect/docs/adr/ADR-015-pino-sentry-opentelemetry.md)
- [ADR-016: Enforcing Library-First Development & Prohibiting Reinvention](file:///f:/CreatorConnect/docs/adr/ADR-016-library-first-governance.md)
- [ADR-017: Engineering Standards: Enforcing SOLID, DRY, and Clean Architecture](file:///f:/CreatorConnect/docs/adr/ADR-017-solid-and-reusability-standards.md)
- [ADR-018: Search Architecture: PostgreSQL Full-Text Search and Trigram Matching](file:///f:/CreatorConnect/docs/adr/ADR-018-postgresql-fts-search-strategy.md)
- [ADR-019: Explainable Rule-Based Candidate Matching & Recommendation Architecture](file:///f:/CreatorConnect/docs/adr/ADR-019-explainable-rule-based-matching.md)
- [ADR-020: Microservice Extraction Strategy & Trigger Criteria](file:///f:/CreatorConnect/docs/adr/ADR-020-microservice-extraction-triggers.md)
