# CreatorConnect — Phase 5 Pre-Flight Architecture Checklist

This document establishes the mandatory architectural invariants, security controls, and design requirements that must be verified prior to implementing Phase 5 (Direct Messaging, Multi-Channel Notifications, Financial Infrastructure, and Algorithmic Discovery).

---

## 1. Real-Time Messaging & Presence Architecture

- [ ] **JWT Handshake & Authentication**:
  - Connection handshake enforces Supabase JWT validation on initial HTTP upgrade (`socket.io` / raw WebSocket).
  - Socket context maintains decoded `UserIdentity` (user ID, roles, account status).
- [ ] **Token Expiry & Revocation Synchronization**:
  - WebSocket runtime enforces periodic token re-verification (e.g., every 15 minutes) or subscribes to Redis revocation events (`user:revoked:{userId}`).
  - Disconnects immediately if user account transitions to `SUSPENDED` or `DEACTIVATED`.
- [ ] **Room & Conversation Authorization**:
  - Joining a room (`conversation:{id}`) requires database/cache verification that `userId` is an active participant in `conversation_participants`.
  - Cross-tenant and non-participant eavesdropping is architecturally blocked at the server handler.
- [ ] **Server-Derived Sender Identity**:
  - The `senderId` field on messages is **strictly derived from the authenticated socket session**. Client-supplied sender IDs are discarded.
- [ ] **Message Ordering & Monotonicity**:
  - Messages employ monotonic timestamping and sequential sequence numbers per conversation backed by PostgreSQL auto-incrementing bigserial or deterministic UUIDv7 sort keys.
- [ ] **Client Idempotency**:
  - Ingestion accepts `clientMessageId` (client-generated UUID). Redundant submissions within a 60-second window are deduplicated.
- [ ] **Reconnect Synchronization (Catch-up Protocol)**:
  - Reconnecting clients supply `lastReadMessageId` or `sinceTimestamp`. The server delivers missed messages in order.
- [ ] **Abuse & Rate Limiting**:
  - Enforce sliding-window rate limiting on message creation via Redis (e.g., max 10 messages/sec per user).
- [ ] **Block & Report Enforcement**:
  - Bidirectional block lists prevent message delivery and presence broadcast between blocked pairs.

---

## 2. Notification Pipeline & Outbox Pattern

- [ ] **Transactional Outbox**:
  - All domain events triggering notifications (e.g., `application.accepted`, `message.sent`) write to an `outbox_events` table in the same database transaction as the business mutation.
  - Eliminates dual-write anomalies between PostgreSQL and message brokers/queues.
- [ ] **Worker Polling & CDC**:
  - Dedicated worker polls `outbox_events` (or uses logical replication) with `FOR UPDATE SKIP LOCKED` and dispatches to BullMQ.
- [ ] **Idempotent Delivery**:
  - Target notification dispatchers (Email, SMS, Push, In-App) check idempotency keys (`event_id:channel:recipient_id`) before sending.
- [ ] **Retry Strategy & Dead-Letter Handling (DLQ)**:
  - Exponential backoff with jitter (max 5 retries). Exhausted events move to a durable dead-letter queue for operator inspection.
- [ ] **Privacy-Safe Payloads**:
  - Push and external notifications omit sensitive PII and confidential terms, containing only coarse references (e.g., "You have a new offer on CreatorConnect").

---

## 3. Attachments & Asset Pipeline

- [ ] **Mandatory Multi-Stage Quarantine**:
  - Direct upload to isolated quarantine bucket (`quarantine/{userId}/{assetId}`).
  - Non-ACTIVE assets receive `null` URLs and cannot be retrieved by unauthorized peers.
- [ ] **Malware Scanner Integration**:
  - Staged transition: `QUARANTINED` -> `VALIDATION` (magic bytes) -> `ANTIVIRUS` (ClamAV / sandboxed scanner) -> `PROCESSING` -> `ACTIVE`.
- [ ] **Short-Lived Signed Delivery**:
  - Downloads always use short-lived presigned URLs (<= 3600s) or secure CDN tokens. URLs are strictly excluded from logs.
- [ ] **Retention & Automated Pruning**:
  - Quarantined or rejected assets are automatically purged by S3 lifecycle policies after 24 hours.

---

## 4. Financial Infrastructure & Double-Entry Ledger

- [ ] **Webhook Raw-Body Verification**:
  - Payment provider webhooks (Razorpay / Stripe) capture raw, unparsed request bodies before Fastify JSON serialization to compute HMAC signatures.
- [ ] **Replay & Timestamp Protection**:
  - Verify webhook signature and timestamp within tolerance (e.g., 300 seconds). Idempotency store deduplicates webhook event IDs.
- [ ] **Immutable Double-Entry Ledger**:
  - Escrow funds, platform fees, payouts, and balances are recorded as immutable debit/credit entries in a double-entry journal table.
  - Sum of debits and credits must equal zero for every financial transaction.
- [ ] **Concurrency & Row Locking**:
  - Wallet balance mutations enforce `SELECT ... FOR UPDATE` row locks to prevent balance overdrafts or duplicate withdrawals.
- [ ] **Reconciliation & Admin Audit**:
  - Nightly automated reconciliation job verifies internal platform ledger against payment gateway settlement statements.

---

## 5. Algorithmic Matching & AI Ethics Guardrails

- [ ] **Strict Authorization Post-Filtering**:
  - Recommendations generated by AI/LLMs or vector embeddings pass through deterministic SQL authorization and visibility filters (`WHERE status = 'ACTIVE' AND visibility = 'PUBLIC'`). AI cannot bypass RBAC.
- [ ] **Prompt Injection Hardening**:
  - User-supplied text (bios, briefs, messages) is segregated from system prompts via delimited schemas and structured JSON formats.
- [ ] **PII Minimization**:
  - Personal identifiable information (contact numbers, emails, addresses) is sanitized and masked before transmission to external AI model APIs.
- [ ] **Embedding Deletion & Right-to-be-Forgotten**:
  - Deleting a profile or portfolio triggers cascading deletion of corresponding vector embeddings in vector databases.
- [ ] **Model & Version Tracking**:
  - All recommendation features record model version, prompt schema version, and timestamp for auditing and reproducibility.
