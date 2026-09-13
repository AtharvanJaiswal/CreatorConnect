# CreatorConnect — System Architecture Specification

## 1. Architectural Philosophy: Pragmatic Enterprise Architecture

CreatorConnect adheres to the principle of:
> **"Enterprise architecture without unnecessary enterprise overengineering."**

Rather than introducing 20+ physically separated container services communicating across complex network meshes on Day 1, CreatorConnect organizes capabilities into **strict logical domains** hosted within a **Modular Monolithic API Engine** alongside physically isolated specialist runtimes where independent scaling or runtime persistence is non-negotiable (Realtime WebSocket Server, Background Workers).

---

## 2. C4 Model — System Architecture

### 2.1 C4 Level 1: System Context

```mermaid
C4Context
    title System Context Diagram for CreatorConnect

    Person(creator, "Creator", "Content creator looking for brand deals and production crew.")
    Person(pro, "Production Pro", "Videographer, editor, or designer seeking project contracts.")
    Person(brand, "Brand Manager", "Enterprise brand seeking creators and production talent.")
    Person(admin, "Platform Admin", "Trust & safety, financial auditor, and system operator.")

    System(cc, "CreatorConnect Platform", "Multi-sided creator marketplace orchestrating discovery, escrow contracts, deliverables, and collaboration.")

    System_Ext(supabase, "Supabase Auth", "Identity provider for OAuth, OTP, password hashing, and token issuance.")
    System_Ext(razorpay, "Razorpay", "Payment gateway for escrow capture, payouts, and webhooks.")
    System_Ext(r2, "Cloudflare R2", "S3-compatible object storage with global edge CDN delivery.")
    System_Ext(fcm, "Firebase Cloud Messaging", "Push notification delivery to Web and Mobile clients.")
    System_Ext(resend, "Resend / React Email", "Transactional email delivery.")

    Rel(creator, cc, "Finds deals, hires crew, delivers content", "HTTPS / WSS")
    Rel(pro, cc, "Applies to campaigns, submits work, receives payouts", "HTTPS / WSS")
    Rel(brand, cc, "Posts campaigns, funds escrow, approves work", "HTTPS / WSS")
    Rel(admin, cc, "Audits transactions, resolves disputes, moderates content", "HTTPS")

    Rel(cc, supabase, "Validates JWTs, syncs identities", "HTTPS / JWKS")
    Rel(cc, razorpay, "Creates payment orders, verifies webhooks, executes payouts", "HTTPS")
    Rel(cc, r2, "Generates presigned upload URLs, serves media via CDN", "HTTPS / S3 API")
    Rel(cc, fcm, "Dispatches push notifications", "HTTPS")
    Rel(cc, resend, "Dispatches transactional emails", "HTTPS")
```

---

### 2.2 C4 Level 2: Container Architecture

```mermaid
graph TB
    subgraph Clients ["Client Applications"]
        WebShell["Web App (Next.js Microfrontends)"]
        MobileApp["Mobile Apps (iOS & Android)"]
        AdminPortal["Admin Portal (Next.js App)"]
    end

    subgraph Edge ["Edge & Ingress Tier"]
        Cloudflare["Cloudflare CDN & WAF (DDoS, SSL, Edge Caching)"]
    end

    subgraph CoreBackend ["Backend Container Tier"]
        ApiGateway["Fastify Core Modular API Engine<br/>(Stateless REST API, OpenAPI 3.1, RBAC Engine)"]
        RealtimeGateway["Fastify + Socket.IO Realtime Gateway<br/>(Stateful WebSockets, Presence, Ephemeral Chat)"]
        AsyncWorker["BullMQ Background Processing Worker<br/>(Outbox relay, Media jobs, Notifications, Payouts)"]
    end

    subgraph DataStorage ["Data & Cache Infrastructure"]
        Postgres[(PostgreSQL 16 Primary + Replicas<br/>Transactional store, FTS, Outbox table)]
        RedisCache[(Redis 7 Cluster<br/>Session cache, Socket.IO adapter, BullMQ state)]
        ObjectStore[(Cloudflare R2 Object Storage<br/>Images, Video stems, Project files, Audits)]
    end

    Clients -->|HTTPS| Cloudflare
    Cloudflare -->|Proxy / Reverse Proxy| ApiGateway
    Cloudflare -->|Sticky WSS| RealtimeGateway

    ApiGateway -->|Read/Write ACID Transactions| Postgres
    ApiGateway -->|Cache / Rate Limits / Lock| RedisCache
    ApiGateway -->|Write Outbox Events| Postgres
    ApiGateway -->|Generate Presigned URLs| ObjectStore

    RealtimeGateway -->|Pub/Sub Adapter & Presence| RedisCache
    RealtimeGateway -->|Authorize JWT| ApiGateway

    AsyncWorker -->|Poll Outbox & BullMQ Queues| RedisCache
    AsyncWorker -->|Update Job States & Data| Postgres
    AsyncWorker -->|Process & Transcode Media| ObjectStore
```

---

## 3. Communication Patterns & Service Protocols

The architecture strictly delineates between synchronous and asynchronous operations to preserve platform responsiveness:

| Communication Flow | Protocol | Mechanism | Failure Handling & Semantics |
| :--- | :--- | :--- | :--- |
| **Client to API Gateway** | HTTP/2 & HTTPS | REST with OpenAPI 3.1 contract validation | Fast failure (RFC 7807), client retries with exponential backoff on 5xx. |
| **Client to Realtime Gateway** | WSS (WebSocket) | Socket.IO binary & JSON events | Auto-reconnect, state sync on reconnection, persistent backplane via Redis. |
| **Core API to Database** | TCP / SSL | Prisma ORM with connection pooling | Optimistic locking, 5-second query timeouts, read replica offloading. |
| **API to Outbox (Event Generation)** | Internal SQL | Same ACID database transaction as domain entity | Guaranteed persistence; 0% chance of event loss or dual-write failure. |
| **Outbox Relay to BullMQ** | TCP / Redis | Polling / notify daemon publishing to BullMQ | At-least-once delivery; consumer idempotency keys enforced. |
| **Worker to External Providers** | HTTPS | Provider SDK with timeout (Razorpay, FCM, Resend) | Exponential backoff retries, dead-letter queue (DLQ) after 5 attempts. |

---

## 4. Cross-Platform Unified API Consumer Pattern

The same backend API serves all client platforms without custom forks:

```mermaid
flowchart LR
    API_SPEC["OpenAPI 3.1 Spec<br/>(Generated by Fastify + TypeBox)"]
    
    TOOLING["openapi-typescript & Orval"]
    
    WEB_CLIENT["@creatorconnect/api-client<br/>(TanStack Query Hooks for Web)"]
    MOBILE_CLIENT["@creatorconnect/mobile-api<br/>(Typed Client for React Native / iOS / Android)"]
    ADMIN_CLIENT["@creatorconnect/admin-api<br/>(Admin Dashboard Client Hooks)"]

    API_SPEC --> TOOLING
    TOOLING --> WEB_CLIENT
    TOOLING --> MOBILE_CLIENT
    TOOLING --> ADMIN_CLIENT
```

1. **Deterministic Single Source of Truth**: The Fastify schema definitions (`TypeBox` / `Zod`) automatically emit an unambiguous OpenAPI 3.1 specification at build time.
2. **Zero Hand-Written DTOs**: Frontend and mobile engineers consume automatically generated TypeScript client packages containing full endpoint typings, payload validation, and TanStack Query hooks.
3. **No Drift**: Changes to backend contracts break client builds immediately during CI, preventing runtime regression.
