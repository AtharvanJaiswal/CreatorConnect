# ADR-009: Socket.IO with Redis Adapter for Realtime Collaboration

## Status

Approved

## Context

Collaborative features—such as direct client-freelancer messaging, live typing indicators, online presence, contract offer status changes, and instant unread notification counters—require persistent, low-latency bidirectional communication.

## Decision

Deploy **Socket.IO** mounted within a dedicated **Realtime Gateway (`Fastify + Socket.IO`)** service, backed by the **`@socket.io/redis-adapter`**:

1. **Isolated Service**: Deployed as an independent container service to isolate persistent WebSocket memory usage and avoid starvation of REST HTTP event loops.
2. **Horizontal Scalability**: Sockets communicate across multiple server instances via Redis Pub/Sub backplane.
3. **Authentication**: Incoming WebSocket connection handshakes validate Supabase JWT tokens via handshake query parameters and HTTP-only cookies.
4. **Resilience**: Automatic fallback to HTTP long-polling if corporate firewalls or networks block WebSocket upgrades.

## Alternatives Evaluated

- **Raw `ws` Package**: Evaluated for minimal overhead. Rejected because `ws` lacks out-of-the-box automatic reconnection, room multiplexing, presence tracking, and multi-server Redis pub/sub adapters. Building these manually violates the library-first rule.
- **Pusher / Ably (Managed Hosted Services)**: Evaluated. Rejected due to high commercial costs that scale aggressively with concurrent connections, and the desire to maintain control over chat data latency and residency.
- **Server-Sent Events (SSE)**: Rejected because SSE is unidirectional (server-to-client only), requiring separate HTTP POST requests for every outbound message or typing indicator.

## Consequences

- **Positive**: Native room support (per project and conversation); automatic reconnection with buffered event replay; seamless cross-server broadcasts via Redis adapter.
- **Negative**: Requires sticky sessions on load balancers during HTTP long-polling handshake phase prior to WebSocket upgrade.

## Security Impact

Enforces room-level authorization checks: a user socket can only join a conversation room (`conversation:{id}`) if the backend verifies their active record in `conversation_members`.

## Performance Impact

Sub-80ms message delivery latency across connected clients. Fastify event loop protected by isolating socket connections into dedicated containers.

## Migration Implications

Clients consume standard Socket.IO client libraries available across Web, React Native, Swift (iOS), and Kotlin (Android).
