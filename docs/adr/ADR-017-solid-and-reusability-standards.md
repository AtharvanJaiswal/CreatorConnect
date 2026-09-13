# ADR-017: Engineering Standards: Enforcing SOLID, DRY, and Clean Architecture

## Status

Approved

## Context

Without strict architectural guardrails, TypeScript codebases quickly degenerate into giant controller files, god services, coupled database queries, and duplicated logic across frontend and backend.

## Decision

Enforce **SOLID Principles, DRY, and Clean Architecture Layers** across all code:

1. **Separation of Concerns**:
   - Presentation Tier: Fastify routes and TypeBox schemas only handle HTTP transport, validation, and status mapping.
   - Application Tier: Orchestrates use cases and domain services; depends exclusively on repository interfaces (ports).
   - Domain Tier: Pure TypeScript business logic, value objects, and domain invariants with zero external framework dependencies.
   - Infrastructure Tier: Prisma repositories, BullMQ producers, and external provider adapters.
2. **DRY & Shared Monorepo Packages**:
   - Functionality needed across multiple domains or frontend apps must reside in `@creatorconnect/*` packages.
   - No duplicate DTO definitions or API response models.
3. **Automated Enforcement**: Monorepo linting rules (`eslint-plugin-boundaries`) block invalid import paths (e.g., domain modules cannot import from Fastify presentation or Prisma infrastructure).

## Alternatives Evaluated

- **Free-form Layering (Ad-hoc Express/Next.js routes with direct DB queries)**: Rejected due to severe regression risks, impossible unit testing, and tangled domain logic.
- **Overly Verbose Enterprise DDD (Java-style Factories, Aggregate Roots, Complex Mappings for Every Entity)**: Rejected to preserve engineering velocity and avoid boilerplate paralysis.

## Consequences

- **Positive**: Isolated, 100% unit-testable business logic; easy mocking of repositories and external APIs; zero code duplication.
- **Negative**: Requires writing repository interfaces and mapping domain models when interacting with persistence layers.

## Security Impact

Business validation rules reside in pure domain services, guaranteeing that security constraints cannot be bypassed by different transport layers (REST, WebSocket, or Background Workers).

## Performance Impact

Eliminates redundant database queries and memory bloat by decoupling application state from ORM query structures.

## Migration Implications

Allows underlying persistence (Prisma/PostgreSQL) or HTTP framework (Fastify) to be upgraded or swapped without rewriting core business workflows.
