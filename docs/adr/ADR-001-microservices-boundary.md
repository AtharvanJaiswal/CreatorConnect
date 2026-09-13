# ADR-001: Modular Monolith Core with Physically Isolated Specialist Services

## Status
Approved

## Context
CreatorConnect spans 26 distinct business capabilities across a multi-sided creator economy. A naive microservices approach would split the system into 20+ standalone network-separated services on Day 1. However, early-stage distributed services introduce extreme complexity: network latency, distributed 2-phase commit transactions, event loop coordination, distributed tracing overhead, and high deployment friction. Conversely, a monolithic architecture risks coupling compute-heavy media processing and long-lived WebSocket chat connections with core transactional REST endpoints.

## Decision
Adopt a **Modular Monolith Core** organized into strict domain modules within a single Fastify application codebase, while **physically isolating only two specialist runtime workloads** from Day 1:
1. **Realtime Gateway (`Fastify + Socket.IO`)**: Physically isolated to isolate long-lived WebSocket connection memory and prevent socket storms from starving HTTP worker threads.
2. **Background Worker Tier (`BullMQ Worker`)**: Physically isolated to run CPU-intensive tasks (Sharp image processing, FFmpeg video metadata extraction) and network-heavy async jobs (FCM push, email dispatch, outbox polling).

Core marketplace capabilities (Identity, Profiles, Campaigns, Projects, Escrow, Reviews, Admin) reside within the modular core sharing a single PostgreSQL database with schema-level domain partitioning.

## Alternatives Evaluated
- **Distributed Microservices (20+ containers)**: Rejected due to unnecessary enterprise overengineering, distributed transaction failure risks, and severe developer experience degradation.
- **Pure Monolith (Single process for REST, WebSockets, and Workers)**: Rejected because FFmpeg video processing bursts and 10,000 persistent WebSockets would crash or delay the main event loop handling checkout transactions.

## Consequences
- **Positive**: Simple local development with Docker Compose; atomic ACID database transactions for complex project/escrow flows; clear domain boundaries; zero distributed network hops for core marketplace APIs.
- **Negative**: Requires strict discipline and automated linting to prevent engineers from making direct cross-domain SQL joins or bypassing domain service interfaces.

## Security Impact
Enables centralized security auditing, consistent authentication middleware, and unified rate limiting at the API gateway level.

## Performance Impact
Eliminates internal network serialization latency (JSON over HTTP/gRPC between internal services), delivering sub-50ms API response times.

## Migration Implications
Domains adhere to strict Clean Architecture interfaces (`ports and adapters`), enabling seamless physical extraction into standalone microservices when specific scaling triggers are reached without rewriting domain logic.
