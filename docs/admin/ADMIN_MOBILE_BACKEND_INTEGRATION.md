# CreatorConnect: Mobile-First Architecture & Admin-Backend Integration

Authoritative engineering guide for integrating the administrative control plane with CreatorConnect's mobile-first ecosystem.

---

## 1. Mobile-First Product Reality

CreatorConnect is built from the ground up as a **mobile-first platform** for India's digital creator economy:

- **Primary Client Experience**: Native mobile applications on Android and iOS (targeting video creators, influencers, editors, and brand managers).
- **Control Plane**: Dedicated administrative web shell (`apps/web-shell`) and internal monitoring consoles used by platform operations, trust & safety, customer support, and financial controllers.
- **Architectural Golden Rule: One Authoritative Backend, Multiple Clients**:
  - `apps/api` (Fastify + TypeScript) is the single authoritative source of truth.
  - Mobile applications and administrative web shells are pure presentation clients consuming the authoritative `/api/v1/*` contracts.
  - Zero duplicate business logic, zero duplicate databases, zero rogue admin API implementations.

---

## 2. Event Propagation from Admin Actions to Mobile Clients

When administrators execute actions in the control plane, state transitions propagate instantaneously to affected mobile clients via Socket.IO real-time events (`apps/realtime`) and transactional push notifications (`apps/worker` via BullMQ):

```
┌─────────────────────────────────┐
│     Admin Control Plane         │
│  (e.g. POST /admin/users/:id/   │
│           suspend)              │
└───────────────┬─────────────────┘
                │ HTTP Request with Admin JWT
                ▼
┌─────────────────────────────────┐
│      Authoritative API          │
│         (apps/api)              │
├─────────────────────────────────┤
│ 1. Verify fine-grained RBAC     │
│ 2. Mutate state in PostgreSQL   │
│ 3. Emit immutable AuditLog row  │
│ 4. Publish Redis Pub/Sub event  │
└───────────────┬─────────────────┘
                │ Redis Pub/Sub: `platform:events`
        ┌───────┴───────┐
        ▼               ▼
┌───────────────┐ ┌────────────────┐
│  Real-Time    │ │ Background     │
│  Service      │ │ Worker         │
│(apps/realtime)│ │ (apps/worker)  │
└───────┬───────┘ └───────┬────────┘
        │                 │
        │ Socket.IO Event │ Push Notification (FCM / APNs)
        ▼                 ▼
┌─────────────────────────────────┐
│     Mobile Client (Android/iOS) │
│ - Immediate session disconnect  │
│ - Live badge update             │
│ - In-app security toast         │
└─────────────────────────────────┘
```

---

## 3. Real-Time Admin Action Handlers on Mobile

| Administrative Mutation                                                 | Real-Time Event Name       | Mobile Client Behavior                                                                                                                 |
| :---------------------------------------------------------------------- | :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| **Account Suspension** (`POST /admin/users/:id/suspend`)                | `auth:session_terminated`  | Mobile app immediately invalidates local tokens, purges cached user state, and routes the user to the Account Suspended appeal screen. |
| **Verification Granted** (`POST /admin/creators/:id/verify`)            | `profile:badge_updated`    | Creator profile UI immediately displays the verified badge without requiring a manual pull-to-refresh.                                 |
| **Refund Processed** (`POST /admin/refunds/:id/approve`)                | `payment:refund_succeeded` | Brand client and creator project escrow widgets update immediately with transaction details and adjusted milestone balance.            |
| **Project Flagged** (`POST /admin/projects/:id/moderate`)               | `project:state_changed`    | Both participants receive real-time project lock banners preventing further asset delivery or milestone fund release.                  |
| **Broadcast Campaign** (`POST /admin/notifications/campaigns/:id/send`) | `notification:broadcast`   | In-app notification center counter increments and system notification banner displays broadcast title and deep-link.                   |

---

## 4. Administrative Security Boundaries vs Mobile Endpoints

1. **Strict Port & Network Separation**: Administrative endpoints (`/api/v1/admin/*`) are routed through reverse proxy ingress rules that enforce IP whitelisting, VPN gateway access, and internal origin validation.
2. **Permission Claim Enforcement**: Even if a customer attempts to query `/api/v1/admin/*` from a reverse-engineered mobile application, the request is rejected immediately with `403 Forbidden` (`AUTH_INSUFFICIENT_ROLE`) by `fastify.requireAdminPermission`.
3. **Internal Note Redaction**: Support ticket endpoints strictly prevent staff internal notes (`isInternal: true`) from ever being serialized or sent to customer mobile clients, preserving confidential internal deliberations.
