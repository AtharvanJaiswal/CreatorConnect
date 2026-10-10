# Phase 5 Architecture Gate: Existing Capabilities & Code Reuse Audit

## 1. Executive Summary

In accordance with Platform Architecture Principles (DRY, Library-First Governance per ADR-016, and Solid Reusability per ADR-017), an exhaustive audit of the CreatorConnect repository was conducted prior to designing Phase 5.

CreatorConnect already contains a robust foundation consisting of:

1. **Core REST API runtime (`apps/api`)** running Fastify 4 with strict security plugins, JWT verification, CASL RBAC, and rate limiting.
2. **Dedicated Realtime runtime (`apps/realtime`)** running Fastify + Socket.IO 4.7.5 with `@socket.io/redis-adapter` 8.3.0 and Redis pub/sub plumbing.
3. **Dedicated Asynchronous Worker runtime (`apps/worker`)** running BullMQ 5.8.6 with supervisor lifecycle handling, job retries, and media pipeline processors.
4. **Shared Monorepo Packages (`packages/*`)** encapsulating authentication (`@creatorconnect/auth`), database access (`@creatorconnect/database`), contract schemas (`@creatorconnect/contracts`), validation utilities (`@creatorconnect/validation`), and common primitives (`@creatorconnect/utils`).

Phase 5 will **NOT** create duplicate utilities or custom protocols. Every requirement is mapped to existing abstractions below.

---

## 2. Capabilities Mapping Table

| Requirement / Capability              | Existing Implementation                                                                                              | Reusable?      | Necessary Modification / Extension for Phase 5                                                                                                                            |
| :------------------------------------ | :------------------------------------------------------------------------------------------------------------------- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Authentication & JWT Verification** | `apps/api/src/services/jwt-verifier.ts` (`JwtVerifier`), `packages/auth/src/types.ts` (`UserIdentity`)               | **YES (100%)** | Extract `JwtVerifier` or instantiate in `apps/realtime` for WebSocket handshake authentication. Bind authenticated identity to `socket.data.user`.                        |
| **RBAC & Authorization**              | `packages/auth/src/abilities.ts` (`defineAbilitiesFor`), CASL `PureAbility`                                          | **YES**        | Add Phase 5 actions (`send`, `read`, `block`, `report`, `moderate`) and subjects (`Conversation`, `Message`, `UserBlock`, `Report`).                                      |
| **Database ORM & Migrations**         | `packages/database/prisma/schema.prisma`, `getPrismaClient()`                                                        | **YES**        | Add Phase 5 models (`Conversation`, `ConversationParticipant`, `Message`, `MessageAttachment`, `UserBlock`, `Report`, `ModerationAction`, `OutboxEvent`, `Notification`). |
| **Object Storage (R2/S3)**            | `apps/api/src/modules/media/storage.service.ts` (`S3StorageService`, `IStorageService`)                              | **YES (100%)** | Move `IStorageService` to a shared package or import directly into worker/messaging attachment services for quarantine and signed URL generation.                         |
| **Media Quarantine & S3 Upload**      | `apps/api/src/modules/media/media.service.ts` (15m presigned PUT, `quarantine/{userId}/{assetId}`)                   | **YES**        | Reuse presigned upload endpoint and quarantine lifecycle for message attachments.                                                                                         |
| **Magic-Byte MIME Verification**      | `apps/worker/src/processors/media-processor.ts` (`file-type`, `sharp`, `pdf-lib`)                                    | **YES**        | Reuse file validation in worker pipeline. Extend with ClamAV antivirus gateway prior to promotion.                                                                        |
| **Rate Limiting Engine**              | `apps/api/src/services/rate-limiter.service.ts` (Dual-key `usr:` + `ip:`, atomic Redis pipeline, fail-closed)        | **YES (100%)** | Use `RateLimiterService` in `apps/realtime` for connection throttling, room joins, typing events, and message ingestion.                                                  |
| **Redis Cache & Connectivity**        | `apps/api/src/services/redis-cache.ts` (`RedisCacheService`), `ioredis`                                              | **YES**        | Reuse Redis connection options, cluster/sentinel readiness, and health checks across Realtime and Worker.                                                                 |
| **Distributed Socket.IO Adapter**     | `apps/realtime/src/server.ts` (`@socket.io/redis-adapter` 8.3.0)                                                     | **YES (100%)** | Already provisioned in `apps/realtime`. Needs room joining authorization middleware and typed event dispatchers.                                                          |
| **Asynchronous Job Queues**           | `apps/worker/src/supervisor.ts`, `bullmq` 5.8.6                                                                      | **YES (100%)** | Add BullMQ queues: `outbox-dispatcher`, `notification-delivery`, `antivirus-scanning`.                                                                                    |
| **UUID Generation**                   | `packages/utils/src/id.ts` (`generateUuidV7()`, `generateId()`)                                                      | **YES (100%)** | Use `generateUuidV7()` for monotonic time-sortable IDs on all new tables (`messages`, `conversations`, `outbox_events`).                                                  |
| **TypeBox Schema Validation**         | `packages/validation/src/formats.ts`, `common.ts` (`UuidSchema`, `IsoDateTimeSchema`, `CursorPaginationQuerySchema`) | **YES (100%)** | Extend with message and conversation schemas. Reuse `CursorPaginationQuerySchema` for keyset cursor pagination.                                                           |
| **RFC 7807 Error Details**            | `apps/api/src/errors/app-error.ts`, `packages/validation/src/problem-details.ts`                                     | **YES (100%)** | Add domain-specific errors (`ConversationAccessDeniedError`, `UserBlockedError`, `MessageTooLargeError`, `RateLimitExceededError`).                                       |
| **OpenAPI & Scalar Documentation**    | `@fastify/swagger`, `@scalar/fastify-api-reference` in `apps/api/src/app.ts`                                         | **YES (100%)** | Register Phase 5 REST endpoints under OpenAPI tags: `Conversations`, `Messages`, `Moderation`, `Notifications`.                                                           |
| **Testing Utilities**                 | `packages/testing`, Vitest 2.1.1, Playwright 1.46.0                                                                  | **YES (100%)** | Author unit tests for state machines, integration tests for outbox worker, and Playwright E2E tests for multi-user chat flows.                                            |
| **Docker Compose Topology**           | `docker-compose.yml` (`postgres`, `redis`, `minio`, `jwks-stub`, `api`, `realtime`, `worker`, `web-shell`)           | **YES**        | Add `clamav` container (`clamav/clamav:latest` or lightweight daemon) to compose stack for antivirus scanning.                                                            |
| **CI / CD Pipeline**                  | `.github/workflows/ci.yml` (Lint, Format, Typecheck, Unit, E2E, CodeQL, Semgrep, Gitleaks)                           | **YES (100%)** | Maintain existing quality gates. Ensure tests execute cleanly across all packages.                                                                                        |

---

## 3. Existing Architectural Assets Detailed Inspection

### 3.1 Authentication & Token Verification (`apps/api/src/services/jwt-verifier.ts`)

- **Current State:** Implements `JwtVerifier` using `jose` with ES256/RS256 remote JWKS keyset caching, strict audience/issuer verification, clock tolerance, and environment-isolated HTTPS enforcement.
- **Phase 5 Strategy:** Realtime WebSocket connections cannot bypass authentication. `apps/realtime` will instantiate `JwtVerifier` to authenticate the initial WebSocket handshake token (`auth.token` or `headers.authorization`), extracting `sub`, `email`, and roles into `socket.data.user`.

### 3.2 Authorization System (`packages/auth`)

- **Current State:** CASL `PureAbility` with `defineAbilitiesFor(user: UserIdentity)`. Supports `can` and `cannot` rules with object-property matchers.
- **Phase 5 Strategy:** Add `Conversation`, `Message`, `UserBlock`, `Report`, and `ModerationAction` to `AppSubject`. Define rules such that:
  - Users can read/send messages only in conversations where they are active participants.
  - Blocked users cannot send messages to their blocker.
  - Only active users can interact.
  - Admins retain `manage` over all subjects for moderation.

### 3.3 Rate Limiting (`apps/api/src/services/rate-limiter.service.ts`)

- **Current State:** Evaluates dual keys (`primaryKey`: `usr:<id>` or `ip:<ip>`, `secondaryKey`: `ep:<route>:<ip>`) using an atomic Redis pipeline (`incr` + `ttl`). Supports `fail-closed` for sensitive mutations.
- **Phase 5 Strategy:** Realtime socket connections and high-frequency messaging are vulnerable to flooding. The `RateLimiterService` will be shared or mirrored to evaluate incoming socket events (e.g., max 5 messages/sec per user, max 2 typing indicators/sec, max 10 room joins/min).

### 3.4 Media & Storage Abstraction (`apps/api/src/modules/media/storage.service.ts`)

- **Current State:** `IStorageService` interface with `S3StorageService` (AWS SDK v3 S3Client configured for Cloudflare R2 and local MinIO) and `MockStorageService` for testing. Generates presigned upload URLs (15m expiration) and presigned download URLs.
- **Phase 5 Strategy:** Reused directly. Chat attachments will be uploaded to `quarantine/{userId}/{assetId}.ext`, inspected by ClamAV, and if clean, copied to `conversations/{conversationId}/{assetId}.ext`. Presigned download URLs will have short TTLs (15 minutes) and require conversation participant authorization.

### 3.5 Worker Pipeline (`apps/worker`)

- **Current State:** Supervisor manages BullMQ workers (`media-processing`) with concurrency controls, graceful shutdown drains, and connection retry handling.
- **Phase 5 Strategy:** The worker service will host the `OutboxProcessor` and `NotificationProcessor`, running on dedicated queues without introducing new external services.

---

## 4. Conflict & Gap Analysis

1. **Gap: Antivirus Malware Scanning Engine**:
   - _Current Status:_ Phase 4 verifies magic bytes (`file-type`), image parsing (`sharp`), and PDF structure (`pdf-lib`), but does **not** run an active antivirus signature engine.
   - _Resolution:_ Add a containerized ClamAV daemon (`clamav:latest`) listening on TCP port 3310. The worker will stream quarantined files via `clamdjs` / TCP socket to ClamAV before promoting them to `ACTIVE`.

2. **Gap: Transactional Outbox Table & Worker**:
   - _Current Status:_ Domain events in Phase 4 were dispatched directly via BullMQ jobs from HTTP request handlers.
   - _Resolution:_ Eliminate dual-write vulnerability. All Phase 5 domain mutations will write an `OutboxEvent` within the same PostgreSQL transaction. A dedicated worker loop will drain outbox records using `SELECT ... FOR UPDATE SKIP LOCKED`.

3. **Gap: Socket.IO Authentication & Room Governance**:
   - _Current Status:_ `apps/realtime` has basic boilerplate with Redis adapter, but no authentication middleware, no room membership verification, and no typed event handlers.
   - _Resolution:_ Implement strict handshake authentication via `JwtVerifier`, room authorization checking PostgreSQL/Redis membership before `socket.join()`, and server-derived sender identities.
