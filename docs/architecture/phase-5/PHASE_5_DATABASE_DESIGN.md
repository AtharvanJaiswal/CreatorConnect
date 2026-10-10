# CreatorConnect — Phase 5 Database Design Specification

## 1. Relational Database Strategy

In accordance with Platform Architecture Standards, **PostgreSQL 16** is the single authoritative source of truth for all business transactions, conversation structures, monotonic sequences, block lists, and outbox events.

Prisma ORM (`@creatorconnect/database`) manages model definitions, migrations, and client generation.

---

## 2. Phase 5 Schema Extension (Prisma SDL)

The following schema extensions integrate seamlessly with the existing Phase 4 `schema.prisma`.

```prisma
// ==============================================================================
// Phase 5 Enums
// ==============================================================================

enum ConversationType {
  DIRECT
  GROUP
}

enum ParticipantRole {
  MEMBER
  ADMIN
}

enum MessageStatus {
  SENT
  EDITED
  DELETED
}

enum ReportCategory {
  SPAM
  HARASSMENT
  ABUSE
  SCAM
  INAPPROPRIATE_CONTENT
  MALICIOUS_FILE
  OTHER
}

enum ReportStatus {
  PENDING
  INVESTIGATING
  RESOLVED
  DISMISSED
}

enum ModerationActionType {
  WARN
  MUTE
  SUSPEND
  BAN
  CONTENT_REMOVED
}

enum OutboxStatus {
  PENDING
  PROCESSING
  PUBLISHED
  FAILED
  DEAD_LETTER
}

enum NotificationChannel {
  IN_APP
  PUSH
  EMAIL
}

enum NotificationType {
  MESSAGE_RECEIVED
  APPLICATION_ACCEPTED
  APPLICATION_REJECTED
  ASSIGNMENT_OFFER
  SYSTEM_ANNOUNCEMENT
}

// ==============================================================================
// Phase 5 Models
// ==============================================================================

model Conversation {
  id              String           @id @db.Uuid
  type            ConversationType @default(DIRECT)
  title           String?          @db.VarChar(150)
  currentSequence BigInt           @default(0) @map("current_sequence")
  deletedAt       DateTime?        @map("deleted_at")
  createdAt       DateTime         @default(now()) @map("created_at")
  updatedAt       DateTime         @updatedAt @map("updated_at")

  participants    ConversationParticipant[]
  messages        Message[]

  @@index([deletedAt, createdAt])
  @@map("conversations")
}

model ConversationParticipant {
  id               String          @id @db.Uuid
  conversationId   String          @map("conversation_id") @db.Uuid
  userId           String          @map("user_id") @db.Uuid
  role             ParticipantRole @default(MEMBER)
  lastReadSequence BigInt          @default(0) @map("last_read_sequence")
  mutedUntil       DateTime?       @map("muted_until")
  leftAt           DateTime?       @map("left_at")
  joinedAt         DateTime        @default(now()) @map("joined_at")
  updatedAt        DateTime        @updatedAt @map("updated_at")

  conversation     Conversation    @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user             User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([conversationId, userId])
  @@index([userId, leftAt])
  @@index([conversationId, lastReadSequence])
  @@map("conversation_participants")
}

model Message {
  id              String            @id @db.Uuid
  conversationId  String            @map("conversation_id") @db.Uuid
  senderId        String            @map("sender_id") @db.Uuid
  sequence        BigInt
  clientMessageId String            @map("client_message_id") @db.VarChar(64)
  content         String            @db.Text
  status          MessageStatus     @default(SENT)
  deletedAt       DateTime?         @map("deleted_at")
  createdAt       DateTime          @default(now()) @map("created_at")
  updatedAt       DateTime          @updatedAt @map("updated_at")

  conversation    Conversation      @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender          User              @relation(fields: [senderId], references: [id], onDelete: Restrict)
  attachments     MessageAttachment[]
  reactions       MessageReaction[]

  @@unique([conversationId, sequence])
  @@unique([senderId, conversationId, clientMessageId])
  @@index([conversationId, sequence(sort: Desc)])
  @@index([senderId, createdAt])
  @@map("messages")
}

model MessageAttachment {
  id           String     @id @db.Uuid
  messageId    String     @map("message_id") @db.Uuid
  mediaAssetId String     @map("media_asset_id") @db.Uuid
  createdAt    DateTime   @default(now()) @map("created_at")

  message      Message    @relation(fields: [messageId], references: [id], onDelete: Cascade)
  mediaAsset   MediaAsset @relation(fields: [mediaAssetId], references: [id], onDelete: Restrict)

  @@unique([messageId, mediaAssetId])
  @@index([mediaAssetId])
  @@map("message_attachments")
}

model MessageReaction {
  id        String   @id @db.Uuid
  messageId String   @map("message_id") @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  emoji     String   @db.VarChar(16)
  createdAt DateTime @default(now()) @map("created_at")

  message   Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([messageId, userId, emoji])
  @@index([messageId])
  @@map("message_reactions")
}

model UserBlock {
  id        String   @id @db.Uuid
  blockerId String   @map("blocker_id") @db.Uuid
  blockedId String   @map("blocked_id") @db.Uuid
  reason    String?  @db.VarChar(255)
  createdAt DateTime @default(now()) @map("created_at")

  blocker   User     @relation("UserBlocksInitiated", fields: [blockerId], references: [id], onDelete: Cascade)
  blocked   User     @relation("UserBlocksReceived", fields: [blockedId], references: [id], onDelete: Cascade)

  @@unique([blockerId, blockedId])
  @@index([blockerId])
  @@index([blockedId])
  @@map("user_blocks")
}

model Report {
  id          String         @id @db.Uuid
  reporterId  String         @map("reporter_id") @db.Uuid
  targetType  String         @map("target_type") @db.VarChar(32) // USER, MESSAGE, ASSIGNMENT
  targetId    String         @map("target_id") @db.Uuid
  category    ReportCategory
  details     String         @db.Text
  status      ReportStatus   @default(PENDING)
  createdAt   DateTime       @default(now()) @map("created_at")
  updatedAt   DateTime       @updatedAt @map("updated_at")

  reporter    User           @relation(fields: [reporterId], references: [id], onDelete: Cascade)

  @@index([status, createdAt])
  @@index([targetType, targetId])
  @@index([reporterId])
  @@map("reports")
}

model ModerationAction {
  id           String               @id @db.Uuid
  moderatorId  String               @map("moderator_id") @db.Uuid
  targetUserId String               @map("target_user_id") @db.Uuid
  actionType   ModerationActionType @map("action_type")
  reason       String               @db.Text
  expiresAt    DateTime?            @map("expires_at")
  createdAt    DateTime             @default(now()) @map("created_at")

  moderator    User                 @relation("ModerationActionsTaken", fields: [moderatorId], references: [id], onDelete: Restrict)
  targetUser   User                 @relation("ModerationActionsReceived", fields: [targetUserId], references: [id], onDelete: Cascade)

  @@index([targetUserId, createdAt])
  @@index([moderatorId])
  @@map("moderation_actions")
}

model OutboxEvent {
  id            String       @id @db.Uuid
  eventType     String       @map("event_type") @db.VarChar(100)
  aggregateType String       @map("aggregate_type") @db.VarChar(64)
  aggregateId   String       @map("aggregate_id") @db.Uuid
  payload       Json         @db.JsonB
  status        OutboxStatus @default(PENDING)
  attempts      Int          @default(0)
  nextAttemptAt DateTime     @default(now()) @map("next_attempt_at")
  lastError     String?      @map("last_error") @db.Text
  publishedAt   DateTime?    @map("published_at")
  createdAt     DateTime     @default(now()) @map("created_at")

  @@index([status, nextAttemptAt])
  @@index([createdAt])
  @@map("outbox_events")
}

model ProcessedEvent {
  eventId      String   @map("event_id") @db.Uuid
  consumerName String   @map("consumer_name") @db.VarChar(64)
  processedAt  DateTime @default(now()) @map("processed_at")

  @@id([eventId, consumerName])
  @@index([processedAt])
  @@map("processed_events")
}

model Notification {
  id        String           @id @db.Uuid
  userId    String           @map("user_id") @db.Uuid
  type      NotificationType
  title     String           @db.VarChar(150)
  body      String           @db.Text
  data      Json?            @db.JsonB
  readAt    DateTime?        @map("read_at")
  createdAt DateTime         @default(now()) @map("created_at")

  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, readAt, createdAt(sort: Desc)])
  @@map("notifications")
}

model NotificationPreference {
  id      String              @id @db.Uuid
  userId  String              @map("user_id") @db.Uuid
  type    NotificationType
  channel NotificationChannel
  enabled Boolean             @default(true)

  user    User                @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, type, channel])
  @@index([userId])
  @@map("notification_preferences")
}
```

---

## 3. Index Justifications & Cardinality Analysis

| Table                       | Index Columns                                     | Sort Order         | Target Query Pattern                                                                                                                                      |
| :-------------------------- | :------------------------------------------------ | :----------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `messages`                  | `(conversation_id, sequence DESC)`                | Descending         | Keyset pagination: Fetch $N$ latest messages in a conversation where `sequence < cursor`. High cardinality, sub-millisecond index seek.                   |
| `messages`                  | `(sender_id, conversation_id, client_message_id)` | Unique             | Idempotent message deduplication: Guarantees no duplicate message insertion on client retries.                                                            |
| `conversation_participants` | `(user_id, left_at)`                              | Standard           | Fetch all active conversations for a user's inbox list.                                                                                                   |
| `conversation_participants` | `(conversation_id, last_read_sequence)`           | Standard           | Fast unread message calculation: compare `conversations.current_sequence` with participant's `last_read_sequence`.                                        |
| `user_blocks`               | `(blocker_id, blocked_id)`                        | Unique             | Fast bidirectional block evaluation during conversation send or join: `WHERE (blocker_id = A AND blocked_id = B) OR (blocker_id = B AND blocked_id = A)`. |
| `outbox_events`             | `(status, next_attempt_at)`                       | Partial / Filtered | Fast polling query: `SELECT ... WHERE status = 'PENDING' AND next_attempt_at <= NOW() FOR UPDATE SKIP LOCKED`.                                            |
| `processed_events`          | `(event_id, consumer_name)`                       | Primary Key        | Consumer deduplication: Prevents double-processing of events delivered via at-least-once queues.                                                          |
| `notifications`             | `(user_id, read_at, created_at DESC)`             | Composite          | Fetch unread notifications for a user, sorted newest first.                                                                                               |

---

## 4. Concurrency & Row-Level Locking Strategy

### Monotonic Sequence Allocation

To ensure zero gaps and strict ordering without race conditions:

```sql
BEGIN;

-- 1. Acquire exclusive row lock on the conversation
SELECT current_sequence
FROM conversations
WHERE id = $1
FOR UPDATE;

-- 2. Compute next sequence
-- next_seq = current_sequence + 1

-- 3. Update conversation aggregate
UPDATE conversations
SET current_sequence = current_sequence + 1, updated_at = NOW()
WHERE id = $1;

-- 4. Insert message with guaranteed sequence
INSERT INTO messages (id, conversation_id, sender_id, sequence, client_message_id, content, ...)
VALUES ($2, $1, $3, next_seq, $4, $5, ...);

-- 5. Atomically insert outbox event
INSERT INTO outbox_events (id, event_type, aggregate_type, aggregate_id, payload, ...)
VALUES ($6, 'message.created.v1', 'Message', $2, $7, ...);

COMMIT;
```

If two users send messages to the same conversation concurrently, the second transaction waits on the row lock for conversation `$1`. Because the transaction does not perform any network calls, the lock duration is $<2\text{ms}$.
