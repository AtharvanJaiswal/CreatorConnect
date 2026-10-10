# CreatorConnect — Phase 5 Realtime Engine Specification

## 1. Realtime Infrastructure Overview

The CreatorConnect Realtime Engine (`apps/realtime`) is a horizontally scalable, distributed WebSocket cluster powered by **Socket.IO 4.7.5**, **Fastify 4**, and **`@socket.io/redis-adapter` 8.3.0**.

It delivers sub-50ms message delivery, room presence, typing indicators, and read receipts across multi-user web and mobile sessions.

---

## 2. Authentication & Connection Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Client as Web Shell / Mobile
    participant RT as Realtime Gateway (:3001)
    participant Keyset as Cached JWKS (Supabase)
    participant Redis as Redis Cache
    participant PG as PostgreSQL 16

    Client->>RT: Connect WSS /socket.io/?EIO=4&transport=websocket<br/>auth: { token: "Bearer eyJhbGci..." }

    Note over RT: Middleware: authenticateSocketHandshake
    RT->>Keyset: Verify JWT (ES256/RS256, Issuer, Audience, Exp)
    alt Token Invalid / Expired
        RT-->>Client: Connection Refused (Error: "AUTH_INVALID_TOKEN")
    else Token Valid
        RT->>Redis: Check user status: GET user:{id}:status
        alt Status Not in Redis
            RT->>PG: SELECT status FROM users WHERE id = :id
            RT->>Redis: SET user:{id}:status status EX 60
        end

        alt Status is SUSPENDED or DEACTIVATED
            RT-->>Client: Connection Refused (Error: "USER_SUSPENDED")
        else Status is ACTIVE
            RT->>RT: Attach identity: socket.data.user = { id, email, roles }
            RT->>Redis: SADD user:{id}:sockets socket.id
            RT-->>Client: CONNECTED { socketId, userId, serverTime }
        end
    end

    Client->>RT: Heartbeat Ping (Every 25s)
    RT->>Redis: SET user:{id}:presence "ONLINE" EX 60
    RT-->>Client: Heartbeat Pong
```

### 2.1 Token Expiry & Revocation Synchronization

1. **JWT Expiration Strategy**: Sockets maintain an internal timer set to `token.exp - Date.now()`. When the token is within 60 seconds of expiration:
   - Server emits `auth:token_expiring` to client.
   - Client fetches a refreshed token from Supabase Auth and sends `auth:refresh { token }`.
   - If unrefreshed when `exp` passes, server forces a graceful disconnect: `socket.disconnect(true)`.
2. **Instant Revocation via Redis Pub/Sub**: When an administrator suspends a user or changes credentials in `apps/api`:
   - API publishes to Redis channel `platform:user_revoked { userId }`.
   - All Realtime nodes listen on this channel and immediately execute:
     ```typescript
     const socketIds = await redis.smembers(`user:${userId}:sockets`);
     for (const sid of socketIds) {
       io.sockets.sockets.get(sid)?.disconnect(true);
     }
     ```

---

## 3. Room Authorization & Join Protocol

Clients cannot arbitrarily join socket rooms. Eavesdropping is architecturally blocked by server-side database checks.

```typescript
export async function handleJoinConversation(
  socket: AuthenticatedSocket,
  conversationId: string,
  callback: (res: JoinRoomResponse) => void,
) {
  const userId = socket.data.user.id;

  // 1. Verify membership in database (or cached Redis set)
  const isParticipant = await db.conversationParticipant.findFirst({
    where: {
      conversationId,
      userId,
      leftAt: null,
    },
    select: { id: true, lastReadSequence: true },
  });

  if (!isParticipant) {
    return callback({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Not an active participant in this conversation' },
    });
  }

  // 2. Authorize and join room
  await socket.join(`conversation:${conversationId}`);

  callback({
    success: true,
    data: {
      conversationId,
      lastReadSequence: isParticipant.lastReadSequence.toString(),
    },
  });
}
```

---

## 4. Reconnect & Replay Protocol (Catch-Up Synchronization)

When mobile or web clients experience network partitions or switch Wi-Fi/cellular networks, they reconnect and sync state using the **Monotonic Sequence Protocol**:

```mermaid
sequenceDiagram
    autonumber
    actor Client as Reconnecting Client
    participant RT as Realtime Gateway
    participant PG as PostgreSQL 16

    Client->>RT: Connect (auth: Bearer Token)
    RT-->>Client: Handshake OK
    Client->>RT: emit 'conversation:sync' { conversationId, sinceSequence: 142 }

    RT->>PG: SELECT * FROM messages<br/>WHERE conversation_id = :id AND sequence > 142<br/>ORDER BY sequence ASC LIMIT 100
    PG-->>RT: Return [Message 143, Message 144, Message 145]

    RT-->>Client: ACK { messages: [...], hasMore: false, latestSequence: 145 }
```

This guarantees that clients never drop messages even during prolonged disconnections, while avoiding reliance on memory-bound socket buffers.

---

## 5. Ephemeral Presence & Typing Architecture

### 5.1 Presence Key Lifecycle

- Presence is tracked via ephemeral Redis keys:
  $$\text{Key: } \texttt{user:\{userId\}:presence} \quad \text{Value: } \texttt{"ONLINE"} \quad \text{TTL: } 60\text{ seconds}$$
- Sockets send a heartbeat ping every 25 seconds, which refreshes the TTL to 60 seconds.
- Upon clean disconnect, the socket checks if any remaining sockets exist in `user:{userId}:sockets`. If empty, the presence key is deleted and an `offline` event is emitted.
- If the node or client crashes abruptly, Redis automatically expires the key after 60 seconds.

### 5.2 Typing Indicators

- Typing indicators are ephemeral and purely broadcast via Redis pub/sub.
- **Rate Limit**: Maximum 1 typing event per 3 seconds per user per conversation.
- Server validates that the sender is in the room, then emits to `conversation:${conversationId}` excluding sender.
- Clients apply an automatic 4-second timeout to reset typing state if no subsequent `typing:stop` is received.

---

## 6. Realtime Event Contracts (Shared TypeScript Interfaces)

All realtime events are strongly typed and shared across backend and frontend through `@creatorconnect/contracts`:

```typescript
export interface ServerToClientEvents {
  'message:created': (payload: MessageCreatedPayload) => void;
  'message:updated': (payload: MessageUpdatedPayload) => void;
  'message:deleted': (payload: MessageDeletedPayload) => void;
  'message:read': (payload: MessageReadReceiptPayload) => void;
  'typing:start': (payload: TypingIndicatorPayload) => void;
  'typing:stop': (payload: TypingIndicatorPayload) => void;
  'presence:update': (payload: PresenceUpdatePayload) => void;
  'auth:token_expiring': () => void;
}

export interface ClientToServerEvents {
  'message:send': (
    payload: SendMessagePayload,
    ack: (res: ApiResponse<MessageAckData>) => void,
  ) => void;
  'conversation:join': (
    payload: { conversationId: string },
    ack: (res: ApiResponse<{ conversationId: string }>) => void,
  ) => void;
  'conversation:leave': (payload: { conversationId: string }) => void;
  'conversation:sync': (
    payload: { conversationId: string; sinceSequence: string },
    ack: (res: ApiResponse<MessageSyncData>) => void,
  ) => void;
  'message:read': (payload: { conversationId: string; sequence: string }) => void;
  'typing:start': (payload: { conversationId: string }) => void;
  'typing:stop': (payload: { conversationId: string }) => void;
  'auth:refresh': (
    payload: { token: string },
    ack: (res: ApiResponse<{ success: boolean }>) => void,
  ) => void;
}
```
