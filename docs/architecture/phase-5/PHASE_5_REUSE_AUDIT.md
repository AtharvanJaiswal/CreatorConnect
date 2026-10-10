# CreatorConnect — Phase 5 Code Reuse & Anti-Duplication Audit

## 1. Governance & Reusability Mandate

Platform ADR-017 states:

> "Never duplicate authorization checks, JWT validation, ownership checks, rate limiting, pagination, cursor encoding, error mapping, validation schemas, event envelopes, logging, tracing, idempotency, retry logic, storage access, signed URL generation, or notification publishing."

This audit enforces reuse of existing CreatorConnect platform modules across all Phase 5 implementations.

---

## 2. Abstraction Reuse Audit

### 2.1 Authentication & Token Verification

- **Existing Code**: `apps/api/src/services/jwt-verifier.ts` (`JwtVerifier`).
- **New Requirement**: Authenticate WebSocket handshake connections in `apps/realtime`.
- **Reusable Component**: `JwtVerifier`.
- **Why Reuse**: Prevents divergence between HTTP and WebSocket cryptographic validation rules; single place for JWKS cache and ES256/RS256 checks.
- **What Changes**: Instantiate `JwtVerifier` in `apps/realtime/src/server.ts` or expose via `@creatorconnect/auth`.

### 2.2 Authorization & CASL Rules

- **Existing Code**: `packages/auth/src/abilities.ts` (`defineAbilitiesFor`).
- **New Requirement**: Authorize message creation, message reading, conversation joins, and participant management.
- **Reusable Component**: `@creatorconnect/auth`.
- **Why Reuse**: Centralizes role-based access control and prevents ad-hoc permission checks in controllers.
- **What Changes**: Add `'Conversation'` and `'Message'` to `AppSubject`; define read/create rules based on participant status.

### 2.3 Storage & Presigned URLs

- **Existing Code**: `apps/api/src/modules/media/storage.service.ts` (`S3StorageService`).
- **New Requirement**: Generate presigned upload URLs for chat attachments and signed download URLs for private files.
- **Reusable Component**: `S3StorageService` / `IStorageService`.
- **Why Reuse**: Handles Cloudflare R2 and MinIO configuration, path-style addressing, and signature expiration uniformly.
- **What Changes**: Move `IStorageService` and `S3StorageService` to a shared package or import into messaging attachment service.

### 2.4 Rate Limiting Engine

- **Existing Code**: `apps/api/src/services/rate-limiter.service.ts` (`RateLimiterService`).
- **New Requirement**: Throttle high-frequency socket events (messages, room joins, typing indicators).
- **Reusable Component**: `RateLimiterService`.
- **Why Reuse**: Existing service already implements atomic Redis pipelining (`incr` + `ttl`), dual-key tracking (`usr:` and `ip:`), and fail-closed security.
- **What Changes**: Invoke `RateLimiterService.checkLimit` inside Socket.IO event middleware.

### 2.5 Validation Formats & Pagination

- **Existing Code**: `packages/validation/src/formats.ts` and `common.ts` (`CursorPaginationQuerySchema`, `UuidSchema`).
- **New Requirement**: Validate keyset cursor pagination query parameters for message history.
- **Reusable Component**: `@creatorconnect/validation`.
- **Why Reuse**: Existing schema defines `limit`, `cursor`, `direction` with strict type bounds and description metadata.
- **What Changes**: Direct reuse in message route schema contracts.

### 2.6 Unique ID Generation

- **Existing Code**: `packages/utils/src/id.ts` (`generateUuidV7()`).
- **New Requirement**: Generate primary keys for conversations, messages, outbox events, and notifications.
- **Reusable Component**: `generateUuidV7()`.
- **Why Reuse**: Monotonic time-ordered UUIDv7 reduces B-tree index fragmentation in PostgreSQL compared to random UUIDv4.
- **What Changes**: Zero changes; directly called across all services.

### 2.7 Asynchronous Queue Supervisor

- **Existing Code**: `apps/worker/src/supervisor.ts`.
- **New Requirement**: Supervise Outbox Dispatcher and Notification delivery queues.
- **Reusable Component**: `apps/worker` supervisor engine.
- **Why Reuse**: Contains battle-tested worker shutdown lifecycle, stalled job recovery, and concurrency management.
- **What Changes**: Register `outbox-dispatcher` and `notification-delivery` processors alongside `media-processor`.
