# CreatorConnect — Authoritative Architecture Diagrams Catalog

This document compiles the 14 core Mermaid architectural diagrams defining the CreatorConnect platform.

---

## 1. System Context Diagram (C4 Level 1)

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

## 2. High-Level System Architecture (C4 Level 2)

```mermaid
graph TB
    subgraph Clients ["Client Applications"]
        WebShell["Web App (Next.js Multi-Zone)"]
        MobileApp["Mobile Apps (iOS & Android)"]
        AdminPortal["Admin Portal (Next.js App)"]
    end

    subgraph Edge ["Edge & Ingress Tier"]
        Cloudflare["Cloudflare Edge & WAF (DDoS, SSL, Edge Caching)"]
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

## 3. Microservice / Physical Service Topology

```mermaid
graph TD
    subgraph Target1 ["1. Core Modular API (Fastify REST Service)"]
        D1[Identity & Users]
        D2[Profiles & Portfolios]
        D3[Campaigns & Applications]
        D4[Projects, Deliverables & Escrow]
        D5[Reviews, Disputes & Admin]
        D6[PostgreSQL FTS Search & Rule Matcher]
    end

    subgraph Target2 ["2. Realtime Gateway (Fastify + Socket.IO Service)"]
        D7[WebSocket Handshake & Heartbeats]
        D8[Ephemeral Presence & Typing Indicators]
        D9[Direct Chat Messaging Delivery]
        D10[Redis Adapter Backplane]
    end

    subgraph Target3 ["3. Background Processing (BullMQ Worker Tier)"]
        D11[Outbox Event Publisher Daemon]
        D12[Media Processing & Video Thumbnails (Sharp/FFmpeg)]
        D13[Multi-Channel Notification Dispatcher (FCM/Resend)]
        D14[Payment Webhook Reconciliation & Payouts]
    end
```

---

## 4. Microfrontend & Shared Package Architecture

```mermaid
graph TD
    subgraph Edge ["Cloudflare Edge Ingress / Reverse Proxy"]
        Router["Path & Subdomain Router"]
    end

    subgraph Applications ["Frontend Applications (apps/)"]
        ShellApp["web-shell<br/>(creatorconnect.com)<br/>Landing, Discovery, Marketing, Legal"]
        CreatorApp["app-creator<br/>(app.creatorconnect.com/creator)<br/>Creator Dashboard, Gigs, Crew Hiring"]
        ProApp["app-pro<br/>(app.creatorconnect.com/pro)<br/>Talent Workspace, Portfolio, Applications"]
        BrandApp["app-brand<br/>(app.creatorconnect.com/brand)<br/>Campaign Management, Escrow, Talent Search"]
        AdminApp["app-admin<br/>(admin.creatorconnect.com)<br/>Operations, Disputes, Finance, Moderation"]
    end

    subgraph SharedPkgs ["Shared Packages (packages/)"]
        DS["@creatorconnect/design-system<br/>(Tailwind Config, Tokens, Typography, Themes)"]
        UI["@creatorconnect/ui<br/>(shadcn/ui + Radix Primitives, Accessible Components)"]
        ApiClient["@creatorconnect/api-client<br/>(Generated TanStack Query Hooks, Fetch Engine)"]
        Contracts["@creatorconnect/contracts<br/>(OpenAPI Schemas & TypeScript Types)"]
        Auth["@creatorconnect/auth<br/>(Supabase Session Provider, Guards, Hooks)"]
        Validation["@creatorconnect/validation<br/>(Zod / TypeBox Schemas for Forms)"]
        Utils["@creatorconnect/utils<br/>(Currency, Date-fns, Formatters, Sanitizers)"]
    end

    Router -->|/ | ShellApp
    Router -->|/creator/* | CreatorApp
    Router -->|/pro/* | ProApp
    Router -->|/brand/* | BrandApp
    Router -->|admin.creatorconnect.com | AdminApp

    ShellApp -.-> SharedPkgs
    CreatorApp -.-> SharedPkgs
    ProApp -.-> SharedPkgs
    BrandApp -.-> SharedPkgs
    AdminApp -.-> SharedPkgs
```

---

## 5. Authentication Flow (Supabase Auth Decoupling)

```mermaid
sequenceDiagram
    autonumber
    actor Client as Web / Mobile Client
    participant Supabase as Supabase Auth Service
    participant Gateway as Fastify API Gateway
    participant DB as PostgreSQL Core DB

    Client->>Supabase: Login with OAuth / OTP / Password
    Supabase-->>Client: Returns Access Token (RS256 JWT) + Refresh Token
    Client->>Gateway: HTTP Request with Authorization: Bearer <JWT>
    Gateway->>Gateway: Verify JWT signature against cached JWKS public key
    Gateway->>Gateway: Extract sub (Supabase Auth ID)
    Gateway->>DB: Query User & Active Roles (Cached in Redis for 5 mins)
    DB-->>Gateway: Return User Entity + Active Roles
    Gateway->>Gateway: Execute Resource Ownership / RBAC Guard
    Gateway->>Client: 200 OK / 403 Forbidden
```

---

## 6. End-to-End API Flow & Code Generation

```mermaid
flowchart LR
    ROUTE_DEF["Fastify Route + TypeBox Schemas<br/>(Query, Params, Body, Response)"]
    SPEC_GEN["@fastify/swagger<br/>(Emits openapi.json)"]
    ORVAL_GEN["Orval Code Generator"]

    subgraph Clients ["Generated Client Artifacts"]
        WEB_HOOKS["@creatorconnect/api-client<br/>(TanStack Query Hooks for Web)"]
        MOBILE_API["@creatorconnect/mobile-api<br/>(Typed Fetch SDK for Mobile)"]
        TYPES["@creatorconnect/contracts<br/>(Full TypeScript DTO Types)"]
    end

    ROUTE_DEF --> SPEC_GEN
    SPEC_GEN --> ORVAL_GEN
    ORVAL_GEN --> WEB_HOOKS
    ORVAL_GEN --> MOBILE_API
    ORVAL_GEN --> TYPES
```

---

## 7. Event-Driven Architecture (Transactional Outbox Pattern)

```mermaid
sequenceDiagram
    autonumber
    participant Client as API Client
    participant Fastify as Fastify API Route
    participant DB as PostgreSQL Database
    participant Worker as BullMQ Outbox Daemon
    participant Redis as Redis / BullMQ Queues
    participant Consumer as BullMQ Worker Consumer

    Client->>Fastify: POST /projects/p_123/milestones/m_456/submit
    activate Fastify
    Fastify->>DB: BEGIN TRANSACTION
    Fastify->>DB: UPDATE project_deliverables SET status = 'IN_REVIEW'
    Fastify->>DB: INSERT INTO outbox_events (id, aggregate_type, payload, status='PENDING')
    Fastify->>DB: COMMIT TRANSACTION
    Fastify-->>Client: 200 OK { deliverable: ... }
    deactivate Fastify

    loop Every 500ms (Outbox Poller)
        Worker->>DB: SELECT * FROM outbox_events WHERE status = 'PENDING' LIMIT 50 FOR UPDATE SKIP LOCKED
        DB-->>Worker: Return pending event batch
        Worker->>Redis: Enqueue BullMQ Jobs (e.g. notifications, media-transcode)
        Worker->>DB: UPDATE outbox_events SET status = 'PUBLISHED', published_at = NOW()
    end

    Redis->>Consumer: Dispatch BullMQ Job with idempotency key
    Consumer->>Consumer: Process background work (FCM / Email / Transcode)
```

---

## 8. Payment Flow (Escrow & Webhook Signature Verification)

```mermaid
sequenceDiagram
    autonumber
    actor Client as Brand Client
    participant API as Fastify Core API
    participant Gateway as Razorpay Payment Gateway
    participant DB as PostgreSQL Database
    participant Worker as BullMQ Worker

    Client->>API: POST /api/v1/projects/{id}/fund-escrow
    API->>Gateway: POST /orders (amount: 500000, currency: INR, receipt: p_123)
    Gateway-->>API: Returns order_id: 'order_987xyz'
    API->>DB: INSERT INTO payment_orders (project_id, razorpay_order_id, amount, status='CREATED')
    API-->>Client: Return { orderId: 'order_987xyz', amount: 500000, key: 'rzp_live_...' }

    Client->>Gateway: Opens Razorpay Checkout Modal & Completes Payment
    Gateway-->>Client: Client Redirect / Success Modal (NOT TRUSTED FOR ESCROW UNLOCK)

    Gateway->>API: POST /api/v1/payments/webhook (Raw Body + X-Razorpay-Signature)
    API->>API: Verify HMAC-SHA256(rawBody, secret) == signature
    alt Signature Valid & Not Processed
        API->>DB: BEGIN TRANSACTION
        API->>DB: INSERT INTO payment_events (event_id, payload) UNIQUE (event_id)
        API->>DB: UPDATE payment_orders SET status = 'CAPTURED'
        API->>DB: UPDATE projects SET status = 'FUNDED'
        API->>DB: INSERT INTO ledger_entries (debit: Brand Escrow, credit: Platform Escrow)
        API->>DB: INSERT INTO outbox_events (type: 'ESCROW_FUNDED')
        API->>DB: COMMIT TRANSACTION
        API-->>Gateway: 200 OK
    else Duplicate Event
        API-->>Gateway: 200 OK (Idempotent Ignore)
    else Invalid Signature
        API-->>Gateway: 400 Bad Request (Alert Security)
    end
```

---

## 9. Notification Flow (Multi-Channel Asynchronous Dispatch)

```mermaid
flowchart TD
    E[Outbox Event: 'MILESTONE_SUBMITTED'] --> Relay[Outbox Relay Worker]
    Relay --> Bull[BullMQ 'notifications' Queue]
    Bull --> Worker[Notification Worker Consumer]

    Worker --> DB[(Read User Preferences & Device Tokens)]
    DB --> PrefCheck{Channel Enabled?}

    PrefCheck -- Push Enabled --> FCM[Firebase Cloud Messaging SDK]
    FCM --> Mobile[iOS / Android Push Notification]
    FCM --> WebPush[Browser Web Push Notification]

    PrefCheck -- Email Enabled --> Resend[Resend API / React Email]
    Resend --> Inbox[User Email Inbox]

    PrefCheck -- SMS Enabled --> SMS[SMS Provider API]
    SMS --> Phone[Mobile SMS / OTP]
```

---

## 10. Direct Media Upload Flow (Cloudflare R2 + Quarantined Scanning)

```mermaid
sequenceDiagram
    autonumber
    actor Client as Web / Mobile Client
    participant API as Fastify API
    participant R2 as Cloudflare R2
    participant Worker as BullMQ Media Worker

    Client->>API: POST /api/v1/media/upload-session (mime, size, filename)
    API->>API: Validate MIME (image/png, video/mp4), check max size (500MB)
    API->>API: Generate unique storage path: /quarantine/{uuidv7}.bin
    API->>R2: Generate Presigned PUT URL (15-min expiry)
    API-->>Client: Return presignedUrl + uploadSessionId
    Client->>R2: PUT /quarantine/{uuidv7}.bin (Direct Binary Stream)
    Client->>API: POST /api/v1/media/upload-confirm (uploadSessionId)
    API->>Worker: Enqueue 'media-scan-and-process' job
    Worker->>R2: Read binary magic bytes (verify real file type)
    Worker->>Worker: Scan with ClamAV antivirus
    alt Clean File
        Worker->>Worker: Process Sharp thumbnails / FFmpeg metadata
        Worker->>R2: Move to /public-assets/ or /private-assets/
        Worker->>API: Mark asset status = 'ACTIVE'
    else Malicious File
        Worker->>R2: Delete quarantined binary
        Worker->>API: Flag security alert & suspend user session
    end
```

---

## 11. Realtime Messaging Flow (Socket.IO + Redis Backplane)

```mermaid
sequenceDiagram
    autonumber
    actor UserA as Creator (Client A)
    participant GW1 as Realtime Gateway Node 1
    participant Redis as Redis Pub/Sub Adapter
    participant GW2 as Realtime Gateway Node 2
    actor UserB as Brand (Client B)
    participant DB as PostgreSQL DB

    UserA->>GW1: WebSocket Emit: 'send_message' { conversationId, content }
    GW1->>GW1: Verify UserA is member of conversationId
    GW1->>DB: INSERT INTO messages (id, conversation_id, sender_id, content)
    GW1->>Redis: PUBLISH room:conversation_123 { messagePayload }

    GW1-->>UserA: Emit 'message_sent_ack' { messageId, status: 'delivered' }
    Redis-->>GW2: Message received on subscription
    GW2-->>UserB: WebSocket Emit: 'new_message' { messagePayload }
```

---

## 12. Continuous Integration / Continuous Deployment Pipeline

```mermaid
flowchart TD
    subgraph PR_Pipeline ["Pull Request Validation Pipeline (Automated on PR)"]
        direction TB
        PR1[Checkout & Cache Restore]
        PR2[Typecheck - tsc --noEmit]
        PR3[Lint & Format - ESLint / Prettier]
        PR4[Unit Tests - Vitest]
        PR5[Integration Tests - Testcontainers Postgres/Redis]
        PR6[OpenAPI Contract Validation - Fastify Swagger Diff]
        PR7[Security Scanners - Gitleaks, Semgrep, CodeQL]
        PR8[Docker Multi-Stage Build & Trivy Vulnerability Scan]
        PR1 --> PR2 --> PR3 --> PR4 --> PR5 --> PR6 --> PR7 --> PR8
    end

    subgraph Staging_Pipeline ["Staging Pipeline (Automated on Merge to main)"]
        direction TB
        ST1[Database Migration Rehearsal & Validation]
        ST2[Deploy to Staging ECS / Fargate Cluster]
        ST3[Run Full Playwright E2E Suite (21 Journeys)]
        ST4[Run k6 Load Test Baseline]
        ST5[Run OWASP ZAP DAST Security Scan]
        ST1 --> ST2 --> ST3 --> ST4 --> ST5
    end

    subgraph Production_Pipeline ["Production Pipeline (Gated by Approval)"]
        direction TB
        PD1[Manual Human Approval Gate - Tech Lead / Release Mgr]
        PD2[Zero-Downtime Blue/Green Deploy & Backward Migration]
        PD3[Automated Smoke Tests & Health Check Polling]
        PD4{Health Check Passed?}
        PD5[Promote Traffic 100% to Green]
        PD6[AUTOMATIC ROLLBACK to Blue & Alert PagerDuty]
        PD1 --> PD2 --> PD3 --> PD4
        PD4 -- Yes --> PD5
        PD4 -- No --> PD6
    end

    PR8 -->|Merge PR to main| Staging_Pipeline
    ST5 -->|Staging Tests Green| Production_Pipeline
```

---

## 13. Production Deployment Topology (AWS + Cloudflare Multi-AZ)

```mermaid
graph TB
    Internet([Internet Users & Mobile Clients])

    subgraph CloudflareEdge ["Cloudflare Global Network"]
        WAF["Cloudflare WAF / DDoS Shield"]
        EdgeDNS["DNS & Geo-Routing"]
        R2Buckets["Cloudflare R2 Object Storage (Media Assets)"]
    end

    subgraph AWS_Cloud ["AWS Production VPC (Multi-AZ)"]
        ALB["Application Load Balancer (HTTPS / SSL Termination)"]

        subgraph FargateECS ["ECS Fargate Cluster"]
            API_AZ1["Fastify Core API (AZ-1)"]
            API_AZ2["Fastify Core API (AZ-2)"]
            RT_AZ1["Realtime Gateway (AZ-1)"]
            RT_AZ2["Realtime Gateway (AZ-2)"]
            Worker_AZ1["BullMQ Worker (AZ-1)"]
            Worker_AZ2["BullMQ Worker (AZ-2)"]
        end

        subgraph ManagedData ["Managed Persistence Layer"]
            RDS_Primary[("Aurora PostgreSQL 16 (Primary Writer)")]
            RDS_Replica[("Aurora PostgreSQL 16 (Read Replica)")]
            ElastiCache[("AWS ElastiCache Redis 7 (Cluster Mode)")]
        end
    end

    Internet --> EdgeDNS
    EdgeDNS --> WAF
    WAF --> ALB
    WAF -.-> R2Buckets

    ALB --> API_AZ1 & API_AZ2
    ALB --> RT_AZ1 & RT_AZ2

    API_AZ1 & API_AZ2 --> RDS_Primary
    API_AZ1 & API_AZ2 -.-> RDS_Replica
    API_AZ1 & API_AZ2 --> ElastiCache

    RT_AZ1 & RT_AZ2 <--> ElastiCache
    Worker_AZ1 & Worker_AZ2 <--> ElastiCache
    Worker_AZ1 & Worker_AZ2 --> RDS_Primary
    Worker_AZ1 & Worker_AZ2 <--> R2Buckets
```

---

## 14. Testing Pyramid & Quality Architecture

```mermaid
graph BT
    E2E["Playwright E2E Tests<br/>(21 Critical Customer Journeys across real browsers)"]
    Contract["OpenAPI Contract Tests<br/>(Dredd / Prism / Orval schema validation)"]
    Integration["Integration Tests with Testcontainers<br/>(Real PostgreSQL & Redis in Docker containers)"]
    Unit["Unit Tests with Vitest<br/>(Pure domain logic, value objects, math, validators)"]

    Unit --> Integration
    Integration --> Contract
    Contract --> E2E
```
