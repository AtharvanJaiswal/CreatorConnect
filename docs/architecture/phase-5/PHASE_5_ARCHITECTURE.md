# CreatorConnect — Phase 5 System Architecture Blueprint

## 1. Architectural Philosophy & Strategy

Phase 5 introduces **Direct Messaging, Realtime Infrastructure, Transactional Outbox, Notifications Foundation, Media Security & Moderation** to the CreatorConnect platform.

To maintain the architectural integrity established in Phases 0 through 4.5, Phase 5 adheres strictly to:

1. **Modular Monolith Core with Specialist Runtimes**: The core business domains (Conversations, Messages, Moderation, Notifications) reside within the modular monolith (`apps/api`). Physically isolated runtimes are maintained strictly where justified:
   - `apps/realtime`: Specialist runtime managing persistent WebSocket / Socket.IO connections and distributed fanout.
   - `apps/worker`: Specialist runtime executing CPU-intensive background tasks (malware scanning, image processing, outbox publishing, notification delivery).
2. **PostgreSQL as Sole Business Authority**: All transactional state, sequence numbers, conversation memberships, block lists, and outbox events are committed to PostgreSQL 16.
3. **Redis as Ephemeral Infrastructure**: Redis 7 is strictly utilized for the Socket.IO distributed adapter, ephemeral presence keys, dual-key rate limiting counters, and BullMQ queue coordination. Redis is **never** authoritative for business truth.
4. **Reliability via Transactional Outbox**: The database dual-write anomaly is eliminated. Any domain mutation committing to PostgreSQL atomically writes an event to `outbox_events`. Asynchronous workers read and deliver these events to Redis/BullMQ/Realtime.
5. **Fail-Closed Security**: Every ingress vector (REST and WebSocket) enforces server-derived identity, CASL authorization, and strict schema validation. Missing authorization or unverified states fail closed (DENY).

---

## 2. Comprehensive System Architecture (Diagram 1)

```mermaid
flowchart TB
    subgraph Clients["Client Tier"]
        WebShell["Web Shell Microfrontend<br/>(Next.js 15 SSR)"]
        MobileClient["Mobile Apps / SPA"]
    end

    subgraph Edge["Ingress & Edge Security"]
        LB["Cloudflare / Reverse Proxy<br/>TLS Termination & WAF"]
    end

    subgraph Services["Application Runtimes"]
        API["Core REST API (:3000)<br/>Fastify 4 / OpenAPI / CASL"]
        Realtime["Realtime Engine (:3001)<br/>Socket.IO 4.7 / Fastify"]
        Worker["Background Worker<br/>BullMQ / Outbox / Media / AV"]
    end

    subgraph Storage["State & Infrastructure Tier"]
        PG[("PostgreSQL 16<br/>(Sole Business Authority)")]
        Redis[("Redis 7<br/>(PubSub / Adapter / Cache / RL)")]
        R2[("Cloudflare R2 / MinIO<br/>(Encrypted S3 Storage)")]
        ClamAV["ClamAV Daemon (:3310)<br/>Antivirus Scanning Gateway"]
    end

    subgraph External["External Integrations"]
        FCM["Firebase Cloud Messaging / APNs"]
        SMTP["Email Gateway (SendGrid/SES)"]
        Supabase["Supabase Auth / JWKS"]
    end

    %% Client traffic
    WebShell -->|HTTPS / REST| LB
    WebShell -->|WSS / Socket.IO| LB
    MobileClient -->|HTTPS / REST| LB
    MobileClient -->|WSS / Socket.IO| LB

    LB -->|/api/v1/*| API
    LB -->|/socket.io/*| Realtime

    %% API interactions
    API -->|Read/Write ACID Tx| PG
    API -->|Dual-Key Rate Limit| Redis
    API -->|Presigned URLs| R2
    API -->|Verify Token JWKS| Supabase

    %% Realtime interactions
    Realtime -->|Handshake Auth JWKS| Supabase
    Realtime -->|Membership & State Cache| Redis
    Realtime -->|Redis Adapter Pub/Sub| Redis
    Realtime -.->|Read Fallback / Auth| PG

    %% Worker interactions
    Worker -->|Outbox Poll SKIP LOCKED| PG
    Worker -->|BullMQ Job Processing| Redis
    Worker -->|Fetch Quarantined Files| R2
    Worker -->|Stream File TCP:3310| ClamAV
    Worker -->|Promote Clean Assets| R2
    Worker -->|Publish Realtime Events| Redis
    Worker -->|Dispatch Push Notifications| FCM
    Worker -->|Dispatch Transactional Mail| SMTP
```

---

## 3. Realtime Engine Architecture (Diagram 2)

The Realtime runtime is scaled horizontally across multiple stateless nodes backed by `@socket.io/redis-adapter`.

```mermaid
flowchart TB
    subgraph ClientLayer["Clients"]
        ClientA["User A Socket<br/>(Node 1)"]
        ClientB["User B Socket<br/>(Node 2)"]
    end

    subgraph RealtimeNodes["Realtime Cluster (:3001)"]
        Node1["Realtime Node 1<br/>Socket.IO Instance"]
        Node2["Realtime Node 2<br/>Socket.IO Instance"]
    end

    subgraph RedisCluster["Distributed Coordination"]
        RedisAdapter["Redis Pub/Sub<br/>@socket.io/redis-adapter"]
        RedisPresence["Redis Ephemeral Cache<br/>user:{id}:presence (TTL 60s)"]
    end

    ClientA -->|Connect w/ Bearer JWT| Node1
    ClientB -->|Connect w/ Bearer JWT| Node2

    Node1 -->|Publish Event to Room| RedisAdapter
    RedisAdapter -->|Fanout to Cluster| Node2
    Node2 -->|Deliver to Socket| ClientB

    Node1 <-->|Heartbeat Ping/Pong| RedisPresence
    Node2 <-->|Heartbeat Ping/Pong| RedisPresence
```

---

## 4. Message Send Flow (Diagram 3)

The message send lifecycle is strictly ordered, deterministic, and idempotent.

```mermaid
sequenceDiagram
    autonumber
    actor User as Client (User A)
    participant API as Core REST API (:3000)
    participant PG as PostgreSQL 16
    participant Worker as Outbox Worker
    participant Redis as Redis Pub/Sub
    participant RT as Realtime Node (:3001)
    actor Peer as Client (User B)

    User->>API: POST /api/v1/conversations/:id/messages<br/>{ clientMessageId, content, attachments }
    Note over API: 1. Validate JWT & load UserIdentity<br/>2. Rate Limit Check (usr:A, ep:send)<br/>3. Verify conversation membership & blocks

    API->>PG: BEGIN TRANSACTION
    API->>PG: Check Idempotency (actorId, convId, clientMessageId)
    alt Already Processed
        API->>PG: ROLLBACK
        API-->>User: 200 OK (Return existing message)
    else New Message
        API->>PG: SELECT current_sequence FROM conversations WHERE id = :id FOR UPDATE
        API->>PG: next_sequence = current_sequence + 1
        API->>PG: UPDATE conversations SET current_sequence = next_sequence, updated_at = NOW()
        API->>PG: INSERT INTO messages (id, conversation_id, sender_id, sequence, content, ...)
        API->>PG: INSERT INTO outbox_events (event_type: 'message.created.v1', payload, ...)
        API->>PG: COMMIT
        API-->>User: 201 Created { messageId, sequence, clientMessageId, createdAt }
    end

    loop Every 50ms (or via pg_notify)
        Worker->>PG: SELECT * FROM outbox_events WHERE status = 'PENDING' FOR UPDATE SKIP LOCKED
        Worker->>Redis: PUBLISH 'realtime:events' { type: 'message:created', ... }
        Worker->>PG: UPDATE outbox_events SET status = 'PUBLISHED', published_at = NOW()
    end

    Redis->>RT: Realtime Event Fanout
    RT->>Peer: socket.emit('message:created', messagePayload)
```

---

## 5. Transactional Outbox Pipeline (Diagram 4)

Guarantees at-least-once delivery from PostgreSQL to asynchronous event consumers without distributed transactions.

```mermaid
flowchart LR
    subgraph Transaction["ACID Database Transaction"]
        Mutation["Business Mutation<br/>(Message, Application, Block)"]
        OutboxTable["INSERT INTO outbox_events<br/>(status: PENDING, payload: JSONB)"]
        Mutation -.->|Atomic Commit| OutboxTable
    end

    subgraph OutboxWorker["Outbox Dispatcher Daemon"]
        Poller["Polling Loop<br/>FOR UPDATE SKIP LOCKED<br/>Batch Size: 100"]
        Dispatcher["Queue Dispatcher / Router"]
    end

    subgraph Queues["BullMQ & Redis Streams"]
        RealtimeQueue["Realtime Fanout Stream"]
        NotifQueue["Notification Delivery Queue"]
        SearchQueue["Search Indexing Queue"]
    end

    subgraph DLQ["Resilience & Poison Pill Handling"]
        DeadLetter["Dead-Letter Storage<br/>status: FAILED / DEAD_LETTER<br/>Operator Alert"]
    end

    OutboxTable -->|Drained by| Poller
    Poller --> Dispatcher
    Dispatcher -->|Publish| RealtimeQueue
    Dispatcher -->|Enqueue Job| NotifQueue
    Dispatcher -->|Enqueue Job| SearchQueue
    Dispatcher -.->|Max Retries Exceeded| DeadLetter
```

---

## 6. Notification Pipeline (Diagram 5)

Decoupled multi-channel notification architecture with user preference enforcement and per-channel backoff retries.

```mermaid
flowchart TD
    OutboxEvent["Outbox Event<br/>(e.g., 'message.created.v1', 'application.accepted.v1')"]

    subgraph Router["Notification Router Service"]
        RuleEngine["Event-to-Channel Resolver"]
        PrefCheck["User Preference Check<br/>(notification_preferences table)"]
    end

    subgraph Channels["Delivery Dispatchers"]
        InApp["In-App Notification Dispatcher<br/>INSERT INTO notifications"]
        Push["FCM / APNs Push Dispatcher<br/>HTTP/v1 API with OAuth2"]
        Email["Transactional Email Dispatcher<br/>SMTP / Provider API"]
    end

    subgraph Execution["Workers & Consumers"]
        InAppWorker["In-App Delivery<br/>(Immediate Realtime Push)"]
        PushWorker["Push Worker (BullMQ)<br/>Retry: 5x with Jitter"]
        EmailWorker["Email Worker (BullMQ)<br/>Retry: 3x Exponential Backoff"]
    end

    OutboxEvent --> RuleEngine
    RuleEngine --> PrefCheck

    PrefCheck -->|If In-App Enabled| InApp
    PrefCheck -->|If Push Enabled| Push
    PrefCheck -->|If Email Enabled| Email

    InApp --> InAppWorker
    Push --> PushWorker
    Email --> EmailWorker

    PushWorker -->|External Send| FCM["Firebase Cloud Messaging"]
    EmailWorker -->|External Send| Provider["SendGrid / AWS SES"]
```

---

## 7. Attachment Security Pipeline (Diagram 6)

Zero-trust file ingestion: uploads enter isolated quarantine, are inspected by the ClamAV antivirus gateway, and only promoted if clean.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Uploading User
    participant API as Core REST API
    participant R2 as Object Storage (R2/MinIO)
    participant Worker as Media & AV Worker
    participant ClamAV as ClamAV Daemon (:3310)
    participant PG as PostgreSQL 16

    Client->>API: POST /api/v1/media/upload-url<br/>{ originalName, mimeType, byteSize, purpose: 'ATTACHMENT' }
    Note over API: Check Rate Limit & File Limits (max 25MB)
    API->>PG: INSERT INTO media_assets (status: 'QUARANTINED', ...)
    API->>R2: Generate Presigned PUT (quarantine/{userId}/{assetId}.ext)
    API-->>Client: 200 OK { uploadUrl, assetId }

    Client->>R2: PUT binary stream (Direct to quarantine)
    Client->>API: POST /api/v1/media/confirm-upload { assetId }

    API->>PG: UPDATE media_assets SET status = 'PENDING_SCAN'
    API->>Worker: Enqueue 'antivirus-scan' Job { assetId }
    API-->>Client: 202 Accepted { status: 'PENDING_SCAN' }

    Worker->>R2: Stream quarantined file
    Worker->>ClamAV: TCP INSTREAM (Port 3310)
    ClamAV-->>Worker: Verdict: 'stream: OK' or 'stream: FOUND <virus>'

    alt Clean File
        Worker->>Worker: Verify Magic Bytes (file-type)
        Worker->>R2: CopyObject (quarantine/... -> attachments/{convId}/{assetId}.ext)
        Worker->>R2: DeleteObject (quarantine/...)
        Worker->>PG: UPDATE media_assets SET status = 'ACTIVE', storage_key = 'attachments/...'
    else Infected File
        Worker->>R2: DeleteObject (quarantine/...)
        Worker->>PG: UPDATE media_assets SET status = 'REJECTED_INFECTED'
        Worker->>PG: INSERT INTO audit_logs (action: 'MALWARE_DETECTED', ...)
    end
```

---

## 8. Authentication Flow (Diagram 7)

```mermaid
sequenceDiagram
    autonumber
    actor Client as User Client
    participant RT as Realtime Gateway (:3001)
    participant Supabase as Supabase Auth (Remote JWKS)
    participant PG as PostgreSQL 16
    participant Redis as Redis Cache

    Client->>RT: WebSocket Handshake (auth: { token: Bearer <JWT> })
    Note over RT: Extract Bearer Token from auth or headers

    RT->>Supabase: Verify Signature against Cached JWKS (ES256/RS256)
    alt Invalid Signature / Expired Token / Wrong Issuer
        RT-->>Client: Connection Rejected (Error: 'AUTH_INVALID_TOKEN')
    else Signature Valid
        RT->>Redis: Check user suspension: user:{id}:status
        alt Cache Miss
            RT->>PG: SELECT status FROM users WHERE id = :id
            RT->>Redis: SET user:{id}:status status EX 60
        end

        alt User is SUSPENDED or DEACTIVATED
            RT-->>Client: Connection Rejected (Error: 'USER_SUSPENDED')
        else User is ACTIVE
            RT->>RT: Attach identity to socket.data.user<br/>{ id, email, roles, status }
            RT-->>Client: Handshake OK (socket.id assigned)
        end
    end
```

---

## 9. Authorization Flow (Diagram 8)

Enforces strict CASL authorization, conversation membership, and active blocking checks before any room join or message read.

```mermaid
flowchart TD
    Request["Incoming Action Request<br/>(join_room, send_message, read_messages, download_attachment)"]

    AuthCheck{"Is Socket / HTTP<br/>Session Authenticated?"}
    StatusCheck{"Is User Status<br/>ACTIVE?"}
    CASLCheck{"Does CASL Policy<br/>Permit Action on Subject?"}
    MemberCheck{"Is User an Active Participant<br/>in Conversation?"}
    BlockCheck{"Is There an Active Bidirectional<br/>Block Between Participants?"}

    Allow["ALLOW ACTION<br/>Proceed to Transaction"]
    Deny["DENY ACTION<br/>Return 403 Forbidden / Socket Error"]

    Request --> AuthCheck
    AuthCheck -->|No| Deny
    AuthCheck -->|Yes| StatusCheck

    StatusCheck -->|Suspended / Deactivated| Deny
    StatusCheck -->|Active| CASLCheck

    CASLCheck -->|No| Deny
    CASLCheck -->|Yes| MemberCheck

    MemberCheck -->|No| Deny
    MemberCheck -->|Yes| BlockCheck

    BlockCheck -->|Block Exists| Deny
    BlockCheck -->|No Block| Allow
```

---

## 10. Failure & Recovery Flow (Diagram 9)

```mermaid
flowchart TD
    subgraph Detection["Failure Event Triggered"]
        NodeCrash["Realtime Node Crash"]
        DBTransient["PostgreSQL Transient Timeout"]
        RedisFail["Redis Partition / Outage"]
        AVCrash["ClamAV Daemon Unreachable"]
    end

    subgraph Handlers["Automated Resilience Handlers"]
        SocketReconnect["Client Automatic Backoff Reconnect<br/>Re-auth + Catch-Up Sync (sinceSequence)"]
        DBRetry["Database Retry with Jitter<br/>Max 3 Attempts for Deadlocks"]
        RateLimitFallback["Rate Limiter Enforces Fail-Closed<br/>on Mutation Endpoints"]
        AVQuarantineRetain["Worker Re-queues Job with Backoff<br/>File Remains Safely Quarantined"]
    end

    subgraph StateResolution["System State Resolution"]
        HealthyRecover["Cluster Restores State<br/>Zero Data Loss / Invariants Maintained"]
    end

    NodeCrash --> SocketReconnect
    DBTransient --> DBRetry
    RedisFail --> RateLimitFallback
    AVCrash --> AVQuarantineRetain

    SocketReconnect --> HealthyRecover
    DBRetry --> HealthyRecover
    RateLimitFallback --> HealthyRecover
    AVQuarantineRetain --> HealthyRecover
```

---

## 11. Deployment Architecture (Diagram 10)

```mermaid
flowchart TB
    subgraph IngressTier["Cloud Ingress & Security"]
        CDN["Cloudflare CDN & WAF"]
        ALB["Application Load Balancer / NGINX Ingress"]
    end

    subgraph ContainerCluster["Container Orchestration (Docker / Kubernetes)"]
        subgraph APIGroup["Core API Pods / Containers"]
            API1["API Instance 1 (:3000)"]
            API2["API Instance 2 (:3000)"]
        end

        subgraph RTGroup["Realtime Pods / Containers"]
            RT1["Realtime Instance 1 (:3001)"]
            RT2["Realtime Instance 2 (:3001)"]
        end

        subgraph WorkerGroup["Asynchronous Worker Pods"]
            W1["Worker Instance 1 (BullMQ + Outbox)"]
            W2["Worker Instance 2 (Media + Antivirus)"]
        end

        subgraph SecurityGroup["Security Daemon Pods"]
            ClamAVDaemon["ClamAV Daemon Container (:3310)"]
        end
    end

    subgraph DataTier["Managed Infrastructure Tier"]
        PostgresPrimary[("PostgreSQL 16 Primary")]
        PostgresReplica[("PostgreSQL 16 Read Replica")]
        RedisMaster[("Redis 7 Primary (AOF Enabled)")]
        R2Bucket[("Cloudflare R2 Object Store")]
    end

    CDN --> ALB
    ALB -->|/api/*| APIGroup
    ALB -->|/socket.io/* (WSS)| RTGroup

    APIGroup --> PostgresPrimary
    APIGroup --> RedisMaster
    APIGroup --> R2Bucket

    RTGroup --> RedisMaster

    WorkerGroup --> PostgresPrimary
    WorkerGroup --> RedisMaster
    WorkerGroup --> R2Bucket
    WorkerGroup --> ClamAVDaemon

    PostgresPrimary -.->|Streaming Replication| PostgresReplica
```
