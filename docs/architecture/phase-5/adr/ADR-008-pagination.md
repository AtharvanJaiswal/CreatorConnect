# ADR-008: Keyset Cursor Pagination for Message History

## 1. Context & Problem Statement

Active conversations can accumulate tens of thousands of messages. Paginating message history using standard SQL `OFFSET / LIMIT` (e.g. `OFFSET 10000 LIMIT 50`) causes severe performance degradation because PostgreSQL must scan and discard all 10,000 previous rows before returning the result.

Furthermore, `OFFSET` pagination suffers from the **page drift anomaly**: if new messages are inserted while a user is scrolling backwards, offsets shift, causing duplicate or skipped messages.

## 2. Options Considered

- **Option 1**: SQL `OFFSET / LIMIT` pagination.
- **Option 2**: Client-side full history download.
- **Option 3**: **Deterministic Keyset Cursor Pagination on `(conversation_id, sequence DESC)`**.

## 3. Decision

**Adopt Option 3: Keyset Cursor Pagination on `(conversation_id, sequence DESC)` utilizing opaque base64-encoded cursors.**

## 4. Evaluation & Rejection Rationale

- _Option 1 Rejected_: $O(N)$ execution complexity, buffer cache thrashing, and page drift anomalies on high-traffic chat feeds.
- _Option 2 Rejected_: Fails on memory constraints for long-lived conversations with thousands of messages.
- _Option 3 Selected_: By querying directly on the indexed monotonic sequence:
  ```sql
  SELECT * FROM messages
  WHERE conversation_id = $1
    AND sequence < $cursor_sequence
  ORDER BY sequence DESC
  LIMIT $limit;
  ```
  PostgreSQL executes an $O(\log N + K)$ B-tree index seek directly to the target record, independent of total table size. Query latency remains $<2\text{ms}$ whether fetching the 10th or 1,000,000th message.

## 5. Consequences & Implications

- **Algorithmic Complexity**: Query performance is invariant to conversation depth ($O(\log N)$ index seek).
- **Page Drift Immunity**: New incoming messages increment higher sequence numbers and have zero impact on backward pagination queries for older messages.
- **Cursor Contract**: Cursors are serialized as opaque base64 strings containing the sequence number and HMAC signature to prevent client tampering.
