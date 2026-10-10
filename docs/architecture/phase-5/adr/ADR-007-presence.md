# ADR-007: Ephemeral Presence Architecture

## 1. Context & Problem Statement

Users in collaborative chats expect to see whether their peers are currently online. However, presence is high-churn, volatile state: users frequently lock their screens, switch browser tabs, or drop network connectivity.

Writing online/offline presence updates to a relational database like PostgreSQL creates massive write volume, table bloat, and connection pool saturation.

## 2. Options Considered

- **Option 1**: Persistent database rows in PostgreSQL (`users.last_seen_at`, `users.is_online`).
- **Option 2**: In-memory socket tracking on individual Realtime nodes.
- **Option 3**: **Ephemeral Redis Keys with Time-To-Live (TTL) and Heartbeat Refresh**.

## 3. Decision

**Adopt Option 3: Ephemeral Redis Keys (`user:{userId}:presence`) with a 60-second TTL refreshed via 25-second WebSocket heartbeats.**

## 4. Evaluation & Rejection Rationale

- _Option 1 Rejected_: PostgreSQL is the source of truth for business transactions, not high-frequency transient telemetry. Relational writes for heartbeats degrade database performance and bloat write-ahead logs (WAL).
- _Option 2 Rejected_: Fails in a multi-node cluster. If User A is connected to Node 1 and User B is connected to Node 2, in-memory maps cannot share presence.
- _Option 3 Selected_: Redis key expiration handles node crashes and abrupt disconnects automatically. If a user drops connection without sending a `disconnect` packet, Redis automatically expires the key after 60 seconds, transitioning their state to `OFFLINE`.

## 5. Consequences & Implications

- **Authority**: Presence is explicitly classified as **non-authoritative ephemeral state**. It is never treated as business truth.
- **Privacy & Safety**: Presence queries evaluate bidirectional user block lists. If User A has blocked User B, User B always sees User A's presence as `OFFLINE`.
- **Scaling**: Redis handles thousands of heartbeat updates per second with $<1\text{ms}$ latency.
