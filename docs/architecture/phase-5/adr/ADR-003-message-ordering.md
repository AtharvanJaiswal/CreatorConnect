# ADR-003: Monotonic Message Sequence Ordering

## 1. Context & Problem Statement

In direct messaging and group collaboration, message ordering must be strictly deterministic and chronological. Relying on client-generated timestamps is vulnerable to clock skew, mobile timezone shifts, and deliberate spoofing. Relying purely on server timestamps can lead to timestamp collisions and tie-breaking ambiguity during high-frequency exchanges.

## 2. Options Considered

- **Option 1**: Client-provided timestamps and UUIDs.
- **Option 2**: PostgreSQL global `BIGSERIAL` sequence across all messages.
- **Option 3**: Distributed logical clocks (Lamport Timestamps or Vector Clocks).
- **Option 4**: **Per-Conversation Monotonic Sequence Counter via PostgreSQL `SELECT FOR UPDATE`**.

## 3. Decision

**Adopt Option 4: Per-Conversation Monotonic Sequence Counter serialized atomically using PostgreSQL row-level locks (`SELECT current_sequence FROM conversations WHERE id = :id FOR UPDATE`).**

## 4. Evaluation & Rejection Rationale

- _Option 1 Rejected_: Client timestamps are untrustworthy and cause erratic ordering across participants.
- _Option 2 Rejected_: A single global auto-incrementing sequence creates heavy lock contention across the entire platform database and exposes total platform message volume metrics.
- _Option 3 Rejected_: Vector clocks add payload complexity and require client-side reconciliation logic without guaranteeing a single linear timeline.
- _Option 4 Selected_: Conversations are bounded contexts. By incrementing a sequence counter on the `conversations` row inside the message creation transaction, each conversation receives a strictly consecutive sequence ($1, 2, 3, \dots, n$) with zero gaps.

## 5. Consequences & Implications

- **Ordering Invariant**: $\text{sequence}(M_{n+1}) = \text{sequence}(M_n) + 1$.
- **Performance**: Row lock duration is $<2\text{ms}$ because no network calls or external I/O are performed inside the transaction. Two users chatting in different conversations execute completely in parallel without contention.
- **Replay / Reconnect**: Reconnecting clients pass their `lastReceivedSequence`, allowing the server to query:
  $$\texttt{SELECT * FROM messages WHERE conversation\_id = :id AND sequence > :lastReceivedSequence ORDER BY sequence ASC}$$
- **Read State**: Unread counts are computed trivially:
  $$\text{unreadCount} = \text{conversations.current\_sequence} - \text{participant.last\_read\_sequence}$$
