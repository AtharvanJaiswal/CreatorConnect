# ADR-004: Client Idempotency Strategy

## 1. Context & Problem Statement

Mobile clients and web applications frequently experience transient network disconnects right as an HTTP request or WebSocket event commits on the server. When the client retries the request, duplicate records (e.g. duplicate messages or duplicate application offers) will be created unless an end-to-end idempotency mechanism exists.

## 2. Options Considered

- **Option 1**: Ephemeral Redis caching of idempotency keys with short TTLs (e.g. 60 seconds).
- **Option 2**: Database unique constraint on client-generated UUID scoped to actor and conversation.
- **Option 3**: Combination of client-generated `clientMessageId` with database unique constraint and deterministic conflict recovery.

## 3. Decision

**Adopt Option 3: Mandate client-generated `clientMessageId` (UUIDv4/v7) scoped by `UNIQUE(sender_id, conversation_id, client_message_id)` in PostgreSQL.**

## 4. Evaluation & Rejection Rationale

- _Option 1 Rejected_: Relying solely on Redis makes idempotency vulnerable to Redis eviction, partition, or restart. If Redis restarts, retried messages create duplicate rows in PostgreSQL.
- _Option 2 & 3 Selected_: PostgreSQL constraints provide durable, ACID-guaranteed deduplication. When a duplicate key collision occurs:
  1. The transaction catches Prisma/Postgres error `P2002`.
  2. The service queries the existing message record matching `(sender_id, conversation_id, client_message_id)`.
  3. The service returns the existing message payload with HTTP 200 OK (or success ACK) without incrementing the sequence or re-inserting the outbox event.

## 5. Consequences & Implications

- **Reliability Invariant**:
  $$\text{same}(clientMessageId, actorId, conversationId) \implies \text{same logical message}$$
- **Client Contract**: All message creation payloads require `clientMessageId: string (UUID)`.
- **Concurrency**: Parallel submission attempts of the same message safely collapse into a single database record.
