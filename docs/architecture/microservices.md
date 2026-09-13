# CreatorConnect — Microservices & Domain Boundary Analysis

## 1. Domain Decomposition & Architecture Direction

CreatorConnect avoids the anti-pattern of premature physical microservices. Splitting an unvalidated system into 25 independent services introduces high distributed tracing overhead, network latency, distributed transaction failure modes, and deployment friction.

Instead, CreatorConnect applies **Logical Domain Separation (Modular Monolith)** with physical extraction executed exclusively when driven by:

1. **Independent Scaling Requirements** (e.g., persistent WebSocket connections vs. compute-heavy video transcoding).
2. **Failure Isolation & Blast Radius** (e.g., background job queue crashes must not take down the checkout flow).
3. **Security & Compliance Boundaries** (e.g., financial ledger & escrow secrets isolated from user content).
4. **Independent Deployment Velocity** (e.g., frequent notification template iterations vs. stable core ledger).

---

## 2. Service Boundary Decision Matrix

The following matrix evaluates all 26 candidate functional domains across the platform:

| Domain / Proposed Service       | Business Capability Owned                          | Data Owned                                       | Critical Dependencies | Scaling Pattern                   | Failure Isolation Requirement           | Initial Deployment Strategy                               | Extraction Trigger (Physical Microservice)                                                                        |
| :------------------------------ | :------------------------------------------------- | :----------------------------------------------- | :-------------------- | :-------------------------------- | :-------------------------------------- | :-------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| **1. Identity & Auth**          | Authentication, sessions, token validation         | External Supabase IDs, user sessions, auth audit | Supabase Auth, Redis  | Moderate (read-heavy)             | High (Platform access point)            | **Modular Monolith Core**                                 | Auth traffic exceeds 20k req/sec or compliance mandates isolated auth proxy.                                      |
| **2. Users & Roles**            | Core user entity, RBAC mappings, account states    | `users`, `roles`, `user_roles`                   | Identity              | Moderate                          | High                                    | **Modular Monolith Core**                                 | Remains core domain.                                                                                              |
| **3. Creator Profiles**         | Rate cards, social links, genres, bio              | `creator_profiles`, `social_accounts`            | Users                 | Read-heavy                        | Medium                                  | **Modular Monolith Core**                                 | Shared profile schema extraction if traffic saturates DB pool.                                                    |
| **4. Professional Profiles**    | Equipment list, day rates, creative titles         | `professional_profiles`, `user_skills`           | Users                 | Read-heavy                        | Medium                                  | **Modular Monolith Core**                                 | Unified Profile Service extraction if profile views > 50M/month.                                                  |
| **5. Brand Profiles**           | Company details, verification status, billing info | `brand_profiles`                                 | Users                 | Low-moderate                      | High                                    | **Modular Monolith Core**                                 | Unified Profile Service.                                                                                          |
| **6. Podcaster Profiles**       | Show topics, guest criteria, listener stats        | `podcaster_profiles`                             | Users                 | Low-moderate                      | Medium                                  | **Modular Monolith Core**                                 | Unified Profile Service.                                                                                          |
| **7. Portfolio**                | Showcases, reel metadata, media links              | `portfolio_items`, `portfolio_media`             | Cloudflare R2         | Read-heavy (CDN cached)           | Low                                     | **Modular Monolith Core**                                 | Media metadata traffic justifies independent CDN origin microservice.                                             |
| **8. Discovery & Search**       | Full-text query, trigram search, catalog filter    | PostgreSQL FTS indices / materialized views      | Profiles, Skills      | High read spikes                  | Medium                                  | **Modular Monolith Core**                                 | Search latency on PostgreSQL exceeds 150ms under peak index size.                                                 |
| **9. Matching Engine**          | Rule-based scoring, recommendation ranking         | Transient match score caches                     | Discovery, Profiles   | Burst compute                     | Low                                     | **Modular Monolith Core**                                 | Migration from rule-based to vector/AI embeddings.                                                                |
| **10. Campaigns / Assignments** | Campaign briefs, deliverables scope, budgets       | `campaigns`, `campaign_requirements`             | Brands, Categories    | Moderate                          | High                                    | **Modular Monolith Core**                                 | High volume campaign API access by external enterprise integrations.                                              |
| **11. Applications**            | Candidate submissions, rates, proposals            | `applications`, `application_status_history`     | Campaigns, Users      | High write bursts                 | High                                    | **Modular Monolith Core**                                 | Monolith handles easily; extraction not warranted in Phase 1–3.                                                   |
| **12. Projects & Milestones**   | Active engagement workspace, timeline state        | `projects`, `project_deliverables`               | Applications, Escrow  | Moderate                          | Critical (Transactional)                | **Modular Monolith Core**                                 | Core marketplace engine; remains consolidated.                                                                    |
| **13. Deliverables**            | Asset submissions, revisions, sign-offs            | `deliverable_revisions`, asset metadata          | Projects, R2          | Moderate                          | High                                    | **Modular Monolith Core**                                 | Unified with Projects engine.                                                                                     |
| **14. Realtime Messaging**      | Direct messaging, typing indicators, presence      | `conversations`, `messages`, attachments         | Redis, Users          | Persistent stateful sockets       | Critical (Isolate socket leaks)         | **PHYSICAL MICROSERVICE (Realtime Gateway)**              | **Physically isolated from Day 1** to prevent long-lived WebSocket connections from starving HTTP worker threads. |
| **15. Community**               | Creator forums, post feeds, discussion threads     | `communities`, `community_posts`, `comments`     | Users                 | Read-heavy social                 | Low                                     | **Modular Monolith Core**                                 | Community engagement traffic dominates marketplace transactions by 10x.                                           |
| **16. Reviews & Ratings**       | Double-blind reviews, score aggregations           | `reviews`                                        | Projects, Users       | Low write, high read              | High                                    | **Modular Monolith Core**                                 | Calculation offloaded to background BullMQ workers.                                                               |
| **17. Payments & Escrow**       | Order creation, webhook verification, escrow hold  | `payments`, `payment_orders`, `ledger_entries`   | Razorpay, Redis       | Transactional, strict consistency | Critical (Zero tolerance for data loss) | **Modular Monolith Core** (Strict Port/Adapter isolation) | Dedicated Financial Service container when enterprise audits require dedicated VPC/DB.                            |
| **18. Subscriptions**           | Tiered platform plans, recurring billing           | `subscriptions`, `subscription_plans`            | Payments              | Low frequency                     | High                                    | **Modular Monolith Core**                                 | Bundled with Payments domain.                                                                                     |
| **19. Notifications**           | Multi-channel dispatch (FCM, Email, SMS)           | `notifications`, `device_tokens`, deliveries     | FCM, Resend, Twilio   | Burst writes (Async)              | Medium                                  | **PHYSICAL WORKER (BullMQ Worker Tier)**                  | **Physically isolated from Day 1** as background consumers to protect HTTP API responsiveness.                    |
| **20. Moderation**              | Content flagging, automated keyword screening      | `reports`, moderation flags                      | Profiles, Messages    | Moderate                          | Medium                                  | **Modular Monolith Core**                                 | Introduction of asynchronous computer vision/AI safety scanners.                                                  |
| **21. Disputes**                | Dispute claims, evidence submission, arbitration   | `disputes`, `dispute_evidence`                   | Projects, Payments    | Low volume                        | Critical                                | **Modular Monolith Core**                                 | Administrative arbitration module.                                                                                |
| **22. Referrals**               | Invite codes, rewards tracking, attribution        | `referrals`, `referral_rewards`                  | Users, Ledger         | Low-moderate                      | Low                                     | **Modular Monolith Core**                                 | Async background attribution via Outbox.                                                                          |
| **23. Analytics**               | Platform metrics, creator profile impressions      | Materialized aggregates, event logs              | Clickstream, DB       | High write (Time-series)          | Low                                     | **PHYSICAL WORKER (BullMQ Async)**                        | When event volume requires ClickHouse or dedicated analytical warehouse.                                          |
| **24. Admin Governance**        | Audit logs, platform configuration, overrides      | `audit_logs`, `admin_actions`                    | All domains           | Low volume                        | Critical (Zero tampering)               | **Modular Monolith Core**                                 | Protected admin route prefix with strict isolated RBAC middleware.                                                |
| **25. Media Processing**        | Image optimization, video transcoding, thumbnails  | Temp disk, R2 buffers                            | Sharp, FFmpeg, R2     | CPU/Memory intensive bursts       | High (Prevent OOM on API)               | **PHYSICAL WORKER (Dedicated Media Worker)**              | **Physically isolated from Day 1** to prevent FFmpeg/Sharp spikes from exhausting API memory.                     |
| **26. Outbox Publisher**        | Transactional outbox polling & BullMQ routing      | `outbox_events` table                            | Postgres, Redis       | Steady background poll            | Critical (Event reliability)            | **PHYSICAL WORKER (Outbox Daemon)**                       | **Physically isolated daemon** running lightweight event-relay loop.                                              |

---

## 3. Initial Physical Service Deployment Topology

From the 26 logical domains, Phase 0 establishes **three physical deployment targets**:

```mermaid
graph TD
    subgraph Target1 ["1. Core Modular API (Fastify REST Service)"]
        D1[Identity & Users]
        D2[Profiles & Portfolios]
        D3[Campaigns & Applications]
        D4[Projects, Deliverables & Escrow]
        D5[Reviews, Disputes & Admin]
        D6[PostgreSQL FTS Search & Rule Matcher]
    end

    subgraph Target2 ["2. Realtime Gateway (Fastify + Socket.IO Service)"]
        D7[WebSocket Handshake & Heartbeats]
        D8[Ephemeral Presence & Typing Indicators]
        D9[Direct Chat Messaging Delivery]
        D10[Redis Adapter Backplane]
    end

    subgraph Target3 ["3. Background Processing (BullMQ Worker Tier)"]
        D11[Outbox Event Publisher Daemon]
        D12[Media Processing & Video Thumbnails (Sharp/FFmpeg)]
        D13[Multi-Channel Notification Dispatcher (FCM/Resend)]
        D14[Payment Webhook Reconciliation & Payouts]
    end
```

### Justification for Initial Physical Boundaries:

1. **Core Modular API**: Stateless, horizontally scalable across CPU metrics, low memory footprint.
2. **Realtime Gateway**: Holds 10,000+ persistent socket connections. Isolating this ensures WebSocket memory spikes or socket reconnect storms cannot impair checkout or project submission HTTP requests.
3. **Background Worker Tier**: Handles CPU-heavy media transcoding (Sharp/FFmpeg) and network-heavy notification bursts. Isolating this guarantees that worker failures (e.g., OOM on malformed 4K video) never impact API availability.
