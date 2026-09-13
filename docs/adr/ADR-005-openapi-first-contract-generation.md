# ADR-005: OpenAPI 3.1 Contract-First Architecture & Automated Client Generation

## Status

Approved

## Context

CreatorConnect must support multiple client platforms (Web Microfrontends, iOS, Android, Admin Portal, and third-party integrations) without API divergence, manually duplicated DTOs, or runtime payload errors.

## Decision

Establish an **API-First Architecture** anchored on **OpenAPI 3.1**:

1. **Schema Source of Truth**: Route contracts defined using **TypeBox (`@sinclair/typebox`)** in Fastify route definitions.
2. **Spec Generation**: Fastify automatically compiles and exports the authoritative `openapi.json` at build time via `@fastify/swagger`.
3. **Client Code Generation**: **Orval** and **`openapi-typescript`** automatically generate typed Fetch clients, TypeScript models, and TanStack Query hooks into `@creatorconnect/api-client` and `@creatorconnect/contracts`.
4. **Interactive Documentation**: Embedded **Scalar** interface (`@scalar/fastify-api-reference`) exposed at `/docs`.
5. **Local API Testing**: Text-based **Bruno** collections (`.bru`) versioned in Git.

## Alternatives Evaluated

- **tRPC**: Evaluated for full-stack TypeScript safety. Rejected because tRPC cannot natively support mobile clients (iOS/Android native or Swift/Kotlin without complex bridges), public third-party webhooks, or multi-language external consumers.
- **GraphQL**: Rejected due to high caching complexity, N+1 query overhead, lack of HTTP-level caching at Cloudflare edge, and excessive client runtime bundle size.
- **Hand-written TypeScript Interfaces**: Rejected because manual typing inevitably drifts from actual backend responses, causing silent production bugs.

## Consequences

- **Positive**:
  - 100% type safety across Web, Mobile, and Admin with zero manual typing.
  - OpenAPI 3.1 specification serves as live, interactive documentation via Scalar.
  - Breaking API changes immediately fail CI builds when client types are regenerated.
- **Negative**: Requires running a code generation step (`pnpm generate:api`) whenever backend route schemas are modified.

## Security Impact

Enforces strict input validation at the edge before route handlers execute; disallows unknown query parameters and malformed bodies automatically.

## Performance Impact

TypeBox compiles down to native JavaScript functions that execute at near C-level speed, drastically outperforming runtime reflection libraries.

## Migration Implications

Mobile apps consume standard OpenAPI JSON specs, allowing native Android and iOS developers to generate Retrofit / URLSession clients effortlessly.
