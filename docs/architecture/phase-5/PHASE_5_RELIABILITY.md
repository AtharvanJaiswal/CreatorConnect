# CreatorConnect — Phase 5 Reliability, Retries & Concurrency Engineering

## 1. Retry Policies & Error Classification

Blind retries in distributed systems cause cascading failures, queue amplification, and database thrashing. Phase 5 strictly classifies all errors into three categories:

| Error Category              | Characteristics & Examples                                                                                                           | Retry Action                                            | Backoff Strategy                                        |
| :-------------------------- | :----------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------ | :------------------------------------------------------ |
| **Retryable (Transient)**   | Database deadlock (40P01), socket connection reset (ECONNRESET), Redis timeout, temporary 503 from external gateways.                | Retry immediately or with short backoff.                | Exponential backoff with full jitter. Max 3–5 attempts. |
| **Non-Retryable (Fatal)**   | 400 Bad Request, 401 Unauthorized, 403 Forbidden, schema validation failure, invalid file signature, duplicate constraint violation. | **DO NOT RETRY**. Fail fast and report error to caller. | None. Abort execution immediately.                      |
| **Dead-Letter (Exhausted)** | Malformed message payload in outbox, permanent third-party API rejection (e.g., invalid FCM device registration token).              | Move to Dead-Letter Queue (DLQ) after retry exhaustion. | Store in DLQ; alert platform on-call for manual triage. |

---

## 2. Exponential Backoff with Full Jitter

### Mathematical Formulation

To eliminate the **thundering herd problem**—where dozens of worker instances synchronize retry intervals and repeatedly overwhelm a recovering database—we apply the Full Jitter algorithm:

$$\text{calculatedDelay}_n = \min\left(\text{maxDelay}, \text{baseDelay} \times 2^n\right)$$
$$\text{actualDelay}_n = \text{random}(0, \text{calculatedDelay}_n)$$

### Why Jitter is Mathematically Essential

Without jitter, $N$ workers experiencing a transient network partition at time $t_0$ will all retry at exactly:
$$t_0 + 2^1 \times \text{baseDelay}, \quad t_0 + 2^2 \times \text{baseDelay}, \dots$$
This produces massive cyclical traffic spikes that drive recovering databases back into overload. With full jitter, the retry volume is uniformly distributed across the entire backoff window $[0, \text{calculatedDelay}_n]$, providing smooth traffic ingestion.

---

## 3. Concurrency & Race Condition Engineering

Phase 5 addresses ten distinct concurrency edge cases with deterministic database mechanisms rather than arbitrary sleeps or in-memory mutexes:

| Concurrency Scenario                    | Potential Hazard                                                                       | Architectural Resolution                                                                                                                                     |
| :-------------------------------------- | :------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Simultaneous Message Sends**       | Two users post in the same conversation at the exact same millisecond.                 | `SELECT current_sequence FROM conversations WHERE id = :id FOR UPDATE`. Serializes sequence allocation at PostgreSQL row level. Lock duration $<2\text{ms}$. |
| **2. Duplicate Send Retries**           | Network drops after server commit but before client receives HTTP 201. Client retries. | Database constraint: `UNIQUE(sender_id, conversation_id, client_message_id)`. Catches P2002; queries and returns existing message.                           |
| **3. Concurrent Block and Send**        | User A blocks User B while User B's message send transaction is in flight.             | Message creation transaction performs a read check on `user_blocks`. If block commits first, message transaction rolls back with 403.                        |
| **4. Concurrent Conversation Creation** | User A and User B both click "Message" to create a direct chat at the same instant.    | Enforce direct conversation uniqueness via sorting: `UNIQUE(LEAST(userA, userB), GREATEST(userA, userB))` for direct type.                                   |
| **5. Concurrent Read Receipts**         | User opens chat on phone and desktop simultaneously, emitting read sequence updates.   | `UPDATE conversation_participants SET last_read_sequence = GREATEST(last_read_sequence, :incomingSeq)`. Monotonically increases.                             |
| **6. Concurrent Membership Removal**    | Admin removes participant while participant is sending a message.                      | Foreign key constraint and participant check inside transaction rolls back message if membership row has `left_at IS NOT NULL`.                              |
| **7. Concurrent Moderation Actions**    | Two admins simultaneously ban the same user.                                           | Second admin's update sees user already `SUSPENDED`/`DEACTIVATED`; audit log captures both interventions cleanly.                                            |
| **8. Multi-Worker Outbox Duplication**  | Multiple outbox workers poll the outbox table at the same millisecond.                 | `SELECT ... FOR UPDATE SKIP LOCKED`. PostgreSql skips already locked rows, distributing work without lock contention.                                        |
| **9. Duplicate Outbox Event Delivery**  | Network ack drops between worker and consumer; worker re-delivers event.               | Consumer writes to `processed_events` with `PRIMARY KEY(event_id, consumer_name)`. Duplicate event exits as safe no-op.                                      |
| **10. Multi-Node Realtime Fanout**      | Recipients connected across different realtime nodes.                                  | `@socket.io/redis-adapter` publishes to Redis channel; all subscribed realtime nodes deliver to their local matching sockets.                                |

---

## 4. Circuit Breakers for External Integrations

For external network dependencies (FCM push gateway, SendGrid SMTP, and ClamAV daemon):

1. **Failure Threshold**: If 5 consecutive requests fail or time out within a 30-second window, the circuit breaker opens.
2. **Open State Behavior**: Requests fail fast without attempting network calls, immediately routing jobs to BullMQ delayed queues with a 60-second backoff.
3. **Half-Open State**: After 60 seconds, a single canary probe is sent. If successful, the circuit closes; if it fails, the circuit remains open for another 120 seconds.
