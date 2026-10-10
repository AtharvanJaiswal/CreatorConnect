# ADR-001: Realtime Engine & Scaling Strategy

## 1. Context & Problem Statement

CreatorConnect requires real-time bidirectional communication for direct messaging, typing indicators, read receipts, and live status updates across web and mobile clients.

WebSockets require persistent TCP connections, which display fundamentally different resource profiles (file descriptors, memory per socket, connection churn) than stateless REST endpoints. Furthermore, when the Realtime service scales across multiple instances, messages sent to an instance must reliably reach recipients connected to other instances.

## 2. Options Considered

- **Option 1**: Co-locate WebSockets inside `apps/api` using raw Node.js `ws` library with custom Redis pub/sub routing.
- **Option 2**: Physically isolate Realtime runtime in `apps/realtime` using **Socket.IO 4.7** and `@socket.io/redis-adapter` 8.3.
- **Option 3**: Outsource real-time messaging to a third-party managed SaaS (e.g. Pusher, Ably).

## 3. Decision

**Adopt Option 2: Physically isolate Realtime runtime (`apps/realtime`) using Socket.IO 4.7 backed by `@socket.io/redis-adapter` 8.3.**

## 4. Evaluation & Rejection Rationale

- _Option 1 Rejected_: Raw `ws` lacks out-of-the-box reconnection management, room primitives, binary transport fallbacks, and typed event dispatching. Co-locating persistent sockets inside `apps/api` causes HTTP request throughput to degrade during connection storms and memory pressure.
- _Option 3 Rejected_: Third-party SaaS introduces vendor lock-in, recurring operational costs, GDPR/compliance data sovereignty risks, and latency overheads.

## 5. Consequences & Implications

- **Security**: WebSocket handshakes enforce Supabase JWT validation using the shared `JwtVerifier`. Room joins strictly require server-verified conversation participant status.
- **Scalability**: Multiple `apps/realtime` nodes run behind an ALB with sticky sessions for HTTP long-polling handshake upgrade. Node-to-node event routing is handled automatically by Redis pub/sub.
- **Reliability**: If a node crashes, clients reconnect automatically with exponential backoff and catch up on missed messages using the monotonic sequence sync protocol.
- **Testing**: Realtime flows are tested with Vitest client mocks and multi-page Playwright browser sessions.
