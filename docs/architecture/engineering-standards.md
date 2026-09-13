# CreatorConnect — Engineering Standards & Coding Guidelines

## 1. Core Engineering Principles (SOLID, DRY, KISS)

All code written across backend services, shared packages, and frontend applications must rigorously embody these foundational principles.

### 1.1 SOLID in TypeScript
- **Single Responsibility Principle (SRP)**:
  - Modules, classes, and React components have one, and only one, reason to change.
  - Controllers only parse HTTP requests and delegate to Domain Services.
  - Domain Services only coordinate business logic and delegate persistence to Repositories.
  - React components only render UI; queries and mutations belong in custom TanStack Query hooks.
- **Open/Closed Principle (OCP)**:
  - Core logic is open for extension, closed for modification.
  - Add new payment providers or notification channels by registering new implementations of existing interfaces, never by littering `if/else` statements across the core workflow.
- **Liskov Substitution Principle (LSP)**:
  - Subtypes or provider adapters must be substitutable for their base abstraction without breaking client expectations.
  - `RazorpayProvider` and any future `StripeProvider` must honor the exact `PaymentProvider` contract.
- **Interface Segregation Principle (ISP)**:
  - No client should be forced to depend on methods it does not use.
  - Split large provider interfaces into focused capabilities: e.g., `PaymentCaptureProvider`, `PayoutProvider`, `WebhookSignatureVerifier`.
- **Dependency Inversion Principle (DIP)**:
  - High-level business modules must not depend on low-level infrastructure modules. Both must depend on abstractions.
  - `CampaignService` depends on `NotificationDispatcherInterface`, not directly on the Firebase Cloud Messaging SDK.

---

### 1.2 DRY (Don't Repeat Yourself) & Code Reusability
1. **Search Before Implementing**: Developers must search `packages/*` before creating any helper, validator, or component.
2. **Rule of Three**: If identical logic is needed in 2 places, keep it clean and localized. If needed in 3 places, extract it immediately into a shared package (`@creatorconnect/utils`, `@creatorconnect/ui`, or `@creatorconnect/contracts`).
3. **No Duplicated DTOs**: Never write custom TypeScript types for an API response if OpenAPI/TypeBox can generate it.

---

### 1.3 KISS (Keep It Simple, Stupid)
1. Avoid speculative abstractions. Do not build generic "plugin systems" or distributed meshes until a concrete requirement emerges.
2. Favor simple, readable, explicit code over clever metaprogramming or deep inheritance hierarchies.

---

## 2. Standard Monorepo Folder Structure

Every backend domain module must adhere to the **Clean Architecture / Ports & Adapters** layout:

```
src/modules/<domain>/
├── domain/                    # Pure TypeScript domain models, value objects, business rules
│   ├── campaign.entity.ts
│   └── campaign-status.vo.ts
├── application/               # Use cases, application services, ports/interfaces
│   ├── campaign.service.ts
│   └── ports/
│       ├── campaign.repository.ts
│       └── escrow-lock.port.ts
├── infrastructure/            # Adapters: Prisma repos, external API clients, BullMQ producers
│   ├── prisma-campaign.repository.ts
│   └── bullmq-campaign-event.producer.ts
├── presentation/              # Transport tier: Fastify route handlers, TypeBox schema contracts
│   ├── campaign.routes.ts
│   └── campaign.schemas.ts
└── tests/                     # Unit and integration tests for this domain
    ├── campaign.service.spec.ts
    └── campaign.routes.spec.ts
```

---

## 3. Error Handling Architecture (RFC 7807 Problem Details)

All HTTP error responses must adhere strictly to the **RFC 7807 Problem Details for HTTP APIs** specification:

```json
{
  "type": "https://errors.creatorconnect.com/errors/RESOURCE_LOCKED",
  "title": "Campaign Escrow Locked",
  "status": 409,
  "detail": "Campaign 'cmp_01j7q6...' escrow has already been funded and cannot be modified.",
  "instance": "/api/v1/campaigns/cmp_01j7q6.../edit",
  "code": "CAMPAIGN_ESCROW_LOCKED",
  "timestamp": "2026-09-13T21:30:00.000Z",
  "requestId": "req_01j7q8w...",
  "errors": []
}
```

### Application Error Hierarchy:
```typescript
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  abstract readonly type: string;
  
  constructor(message: string, public readonly details?: unknown) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
  readonly type = 'https://errors.creatorconnect.com/errors/NOT_FOUND';
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = 'UNAUTHORIZED';
  readonly type = 'https://errors.creatorconnect.com/errors/UNAUTHORIZED';
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN';
  readonly type = 'https://errors.creatorconnect.com/errors/FORBIDDEN';
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';
  readonly type = 'https://errors.creatorconnect.com/errors/CONFLICT';
}
```

---

## 4. Structured Logging & Context Propagation

1. **Log Format**: All output must be JSON formatted using **Pino**.
2. **Context Enrichment**: Every log entry must include:
   - `requestId`: Unique ID passed or generated at Fastify ingress (`x-request-id`).
   - `correlationId`: Propagated through message queues and background workers (`x-correlation-id`).
   - `userId`: Sanitized authenticated user UUID (if authenticated).
   - `service`: Name of the service/worker container.
3. **Strict Redaction Rules**: The logger configuration must automatically redact:
   - Passwords, hashes, OTP codes
   - Authorization headers & Bearer tokens
   - Credit card numbers, CVVs, bank account credentials
   - Razorpay secret keys and webhook secrets
   - Private identity document attachments

---

## 5. Code Review & Definition of Done Checklist

Every Pull Request must satisfy the **Definition of Done (DoD)** before merging into `main`:

```markdown
### Pull Request Checklist
- [ ] **Architecture**: Conforms to domain boundaries; no cross-domain database queries.
- [ ] **SOLID & DRY**: No duplicate helpers; interfaces used for external integrations.
- [ ] **Library-First**: Uses approved libraries; no ad-hoc queue, date, or validation engines.
- [ ] **Type Safety**: Zero `any` types; no unsafe type assertions (`as unknown as T`).
- [ ] **API Contract**: Schema defined in TypeBox/OpenAPI; generated client types updated.
- [ ] **Validation**: Input payload, params, and query strings fully validated at route level.
- [ ] **Authorization**: Route is protected by RBAC middleware and resource ownership guard.
- [ ] **Error Handling**: Uses `AppError` subclasses with RFC 7807 compliance.
- [ ] **Logging**: Key state changes logged with structured fields; zero secrets logged.
- [ ] **Testing**:
  - [ ] Unit tests for business logic (>85% coverage).
  - [ ] Integration tests verifying database transactions via Testcontainers.
  - [ ] Playwright E2E test added if modifying a critical customer journey.
- [ ] **Observability**: Metrics and error tracking spans hooked into Pino/Sentry.
- [ ] **Database**: Migrations are backward-compatible; proper indexes added.
- [ ] **CI**: All automated checks pass (lint, typecheck, tests, security scan).
```
