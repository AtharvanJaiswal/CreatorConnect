# CreatorConnect — Frontend Architecture & API Capability Audit

**Document:** `docs/frontend/FRONTEND_ARCHITECTURE_AUDIT.md`  
**Milestone:** Phase 0 — Pre-Implementation Architecture Audit  
**Target Applications:** `apps/web-shell` (Next.js 15 App Router) & Shared Monorepo Packages  
**Author:** Staff Software Architect & Lead Frontend Engineer  
**Date:** November 2026  
**Status:** APPROVED FOR PHASE 1 FOUNDATION

---

## 1. Executive Summary & Monorepo Context

CreatorConnect is primarily a mobile application ecosystem designed for Creators, Production Talent, and Brand Sponsors. Web properties in the repository are strictly scoped to two distinct user journeys:

1. **Public App Download Website (`/`)**: A fast, lightweight, editorial landing page introducing CreatorConnect, explaining its value proposition (milestone escrow, verified showreels, direct messaging), and directing users to official Android Google Play and Apple App Store downloads.
2. **Admin Web Console (`/admin/*`)**: A high-density, secure, mission-critical operations dashboard utilized by platform administrators, finance officers, trust & safety moderators, and customer support representatives to govern the platform.

### Monorepo Baseline Inventory

| Package / App            | Version            | Technology Stack                              | Role in Frontend Ecosystem                                                      |
| :----------------------- | :----------------- | :-------------------------------------------- | :------------------------------------------------------------------------------ |
| `apps/web-shell`         | Next.js `~15.5.28` | React `18.3.1`, TS `5.5.4`, Tailwind `3.4.10` | Host microfrontend / App Router container for Public + Admin experiences        |
| `apps/api`               | Fastify `~4.28`    | Node.js, Prisma, PostgreSQL, Redis, BullMQ    | Authoritative backend REST API source of truth                                  |
| `packages/contracts`     | Workspace          | TypeBox `@sinclair/typebox`                   | Canonical schema definitions, DTOs, query contracts, and response types         |
| `packages/auth`          | Workspace          | `@casl/ability`                               | Unified authorization logic, role-to-ability mapping, and permission checks     |
| `packages/design-system` | Workspace          | Tailwind Preset, CSS Variables, Theme Tokens  | Canonical visual styling rules, color palettes, typography, spacing tokens      |
| `packages/ui`            | Workspace          | Radix UI, React Primitives                    | Accessible UI primitives (`Button`, `Card`, `Badge`, `Dialog`, `Table`, `Tabs`) |
| `packages/validation`    | Workspace          | TypeBox Validators, RFC 7807 Problem Details  | Parameter schemas, UUID validation, error response structures                   |

---

## 2. Dual Web Experience Architecture

```mermaid
flowchart TD
    subgraph Client Experiences
        A["Visitor / Search Engine"] -->|Route: /| B["Public App Download Website"]
        C["Staff / Ops / Admin"] -->|Route: /admin/*| D["Admin Console Shell"]
    end

    subgraph Authentication Gate
        D -->|Unauthenticated| E["/admin/login"]
        E -->|Supabase Auth / Session| F{"Staff Permission Check"}
        F -->|Unauthorized (403)| G["/admin/unauthorized"]
        F -->|Authorized (RBAC)| H["Admin Protected Routes"]
    end

    subgraph Backend APIs (Authoritative Source of Truth)
        H -->|Bearer JWT| I["/api/v1/admin/* (Fastify API)"]
        H -->|Bearer JWT| J["/api/v1/disputes/* & /api/v1/reviews/*"]
        H -->|Bearer JWT| K["/api/v1/lifecycle/* (Read-Only)"]
    end
```

### Architectural Guardrails

1. **No Duplication of Mobile Capabilities**: The web shell must NOT implement creator discovery feeds, in-browser mobile chat, video upload pipelines, or bid placement workflows. Mobile remains the client of choice for end users.
2. **Backend is the Sole Source of Truth**: No synthetic mock data, faked success notifications, or bypassed validation. All mutations map directly to Fastify endpoints.
3. **Strict Separation of Public and Admin Bundles**: Public download page contains zero admin dependencies, ensuring lightning-fast First Contentful Paint (FCP) and optimal SEO.

---

## 3. Visual Design System & Tokens Specification

The visual language adheres strictly to the **Warm Editorial Neo-Pop** specification (`creatorconnect-admin-panel-ui.html`).

### Core Design Tokens

| Token Category    | CSS Variable           | Hex / Value              | Semantic Role                                                 |
| :---------------- | :--------------------- | :----------------------- | :------------------------------------------------------------ |
| **Canvas**        | `--bg-primary`         | `#FAF6EF`                | Warm cream background for all viewports                       |
| **Surface**       | `--surface`            | `#FFFFFF`                | Clean white elevated cards and data tables                    |
| **Sub-surface**   | `--surface-secondary`  | `#F2ECE1`                | Muted card backgrounds, table headers, search inputs          |
| **Brand Accent**  | `--primary`            | `#FFD64A`                | High-visibility primary action buttons, active tabs           |
| **Accent Press**  | `--primary-press`      | `#F0C52F`                | Active click/tap states for primary interactive elements      |
| **Ink Black**     | `--navy` / `--text`    | `#14110F`                | Deep contrast text, dark status buttons, high-contrast badges |
| **Secondary Ink** | `--text-secondary`     | `#6F675E`                | Supporting captions, table column headers, metadata           |
| **Muted Ink**     | `--text-muted`         | `#A39A8F`                | Placeholders, inactive icons, disabled states                 |
| **Border**        | `--border`             | `#E7E0D5`                | Subtle warm dividers and card outlines                        |
| **Success**       | `--success`            | `#2E9E6B` (`#E6F4EC` bg) | Verified badges, successful payments, resolved disputes       |
| **Warning**       | `--warning`            | `#C98A16` (`#FBF1DC` bg) | Pending dual-approvals, under review, evidence requested      |
| **Danger**        | `--danger`             | `#D8483C` (`#FBE9E7` bg) | Suspended users, rejected refunds, dismissed reports          |
| **Info / Pastel** | `--sky` / `--lavender` | `#A6CCF7` / `#C9B6F7`    | Module accents, analytics metrics, role chips                 |

### Typography Hierarchy

- **Headings & Editorial Titles**: `Instrument Serif` (serif, italic options for elegance).
- **UI Labels, Navigation & Tables**: `Archivo` (sans-serif, geometric, highly legible at small sizes).
- **Financial Minor Units, IDs & Logs**: `JetBrains Mono` (tabular numbers, monospace precision for UUIDs and hashes).

### Geometry & Interaction Standards

- **Pill-First Controls**: All interactive buttons, status badges, filter chips, and navigation links utilize `border-radius: 9999px` (`rounded-full`).
- **Cards & Dialogs**: Large radii `rounded-2xl` (16px) or `rounded-3xl` (24px) with subtle warm shadows (`rgba(20, 17, 15, 0.06)`).
- **WCAG 2.2 AA Contrast Compliance**: Minimum 4.5:1 contrast ratio across all text and interactive controls. High-contrast focus rings (`ring-2 ring-[#FFD64A] ring-offset-2`).

---

## 4. Comprehensive 13-Module API Capability Matrix

The table below catalogs every administrative feature against the actual backend Fastify implementation in `apps/api/src/modules/admin/` and complementary modules.

| Module # | Domain Area                   | Target Route (Frontend)   | Backend Fastify Endpoint                            | HTTP Method | Required Permission       |    Backend Status     | Implementation Strategy                                                                                                          |
| :------: | :---------------------------- | :------------------------ | :-------------------------------------------------- | :---------: | :------------------------ | :-------------------: | :------------------------------------------------------------------------------------------------------------------------------- |
|  **01**  | **Executive Dashboard**       | `/admin/dashboard`        | `/api/v1/admin/dashboard/overview`                  |    `GET`    | `analytics.read`          | **Fully Implemented** | KPI cards (users, volume, revenue, jobs), real-time alerts.                                                                      |
|          |                               |                           | `/api/v1/admin/dashboard/registrations`             |    `GET`    | `analytics.read`          | **Fully Implemented** | User registration trends across 7d/30d/90d.                                                                                      |
|          |                               |                           | `/api/v1/admin/dashboard/transactions`              |    `GET`    | `analytics.read`          | **Fully Implemented** | Payment volumes, success rates, fee earnings.                                                                                    |
|          |                               |                           | `/api/v1/admin/dashboard/projects`                  |    `GET`    | `analytics.read`          | **Fully Implemented** | Project completion rates, active disputes.                                                                                       |
|          |                               |                           | `/api/v1/admin/dashboard/moderation`                |    `GET`    | `analytics.read`          | **Fully Implemented** | Queue backlog metrics, pending reports.                                                                                          |
|  **02**  | **Users Management**          | `/admin/users`            | `/api/v1/admin/users`                               |    `GET`    | `users.read`              | **Fully Implemented** | Search, filter by role/status, paginated data table.                                                                             |
|          |                               | `/admin/users/[id]`       | `/api/v1/admin/users/:id`                           |    `GET`    | `users.read`              | **Fully Implemented** | Multi-role profile details, financial balances.                                                                                  |
|          |                               |                           | `/api/v1/admin/users/:id/suspend`                   |   `POST`    | `users.suspend`           | **Fully Implemented** | Suspension modal with mandatory audit reason.                                                                                    |
|          |                               |                           | `/api/v1/admin/users/:id/reactivate`                |   `POST`    | `users.reactivate`        | **Fully Implemented** | Reactivation modal with justification.                                                                                           |
|          |                               |                           | `/api/v1/admin/users/:id/activity`                  |    `GET`    | `users.read`              | **Fully Implemented** | Chronological user audit trail timeline.                                                                                         |
|  **03**  | **Verification Queue**        | `/admin/verification`     | `/api/v1/admin/creators`                            |    `GET`    | `users.read`              | **Fully Implemented** | Creator directory with verification filter.                                                                                      |
|          |                               |                           | `/api/v1/admin/creators/:id/verify`                 |   `POST`    | `users.update`            | **Fully Implemented** | Toggle verified badge with audit note.                                                                                           |
|          |                               |                           | `/api/v1/admin/clients`                             |    `GET`    | `users.read`              | **Fully Implemented** | Client brand directory with verification filter.                                                                                 |
|          |                               |                           | `/api/v1/admin/clients/:id/verify`                  |   `POST`    | `users.update`            | **Fully Implemented** | Toggle organization badge with audit note.                                                                                       |
|  **04**  | **Assignments / Projects**    | `/admin/assignments`      | `/api/v1/admin/projects`                            |    `GET`    | `projects.read`           | **Fully Implemented** | Filter by status (ESCROW_FUNDED, IN_PROGRESS, DISPUTED).                                                                         |
|          |                               | `/admin/assignments/[id]` | `/api/v1/admin/projects/:id`                        |    `GET`    | `projects.read`           | **Fully Implemented** | Milestones, escrow amounts, deliverable review.                                                                                  |
|          |                               |                           | `/api/v1/admin/projects/:id/moderate`               |   `POST`    | `projects.moderate`       | **Fully Implemented** | Moderation action (SUSPEND, RESTRICT, RESTORE).                                                                                  |
|  **05**  | **Trust & Moderation**        | `/admin/moderation`       | `/api/v1/admin/reports`                             |    `GET`    | `reports.review`          | **Fully Implemented** | Centralized abuse reports queue (User, Content).                                                                                 |
|          |                               | `/admin/moderation/[id]`  | `/api/v1/admin/reports/:id`                         |    `GET`    | `reports.review`          | **Fully Implemented** | Target preview, reporter reason, evidence links.                                                                                 |
|          |                               |                           | `/api/v1/admin/reports/:id/resolve`                 |   `POST`    | `reports.resolve`         | **Fully Implemented** | Enforce penalty (WARN, SUSPEND, BAN, CONTENT_REMOVED).                                                                           |
|          |                               |                           | `/api/v1/admin/reports/:id/dismiss`                 |   `POST`    | `reports.resolve`         | **Fully Implemented** | Dismiss report without penalty with audit reason.                                                                                |
|  **06**  | **Reviews Moderation**        | `/admin/reviews`          | `/api/v1/admin/reviews`                             |    `GET`    | `reviews.moderate`        | **Fully Implemented** | Filter by rating (1-5 stars), moderation status.                                                                                 |
|          |                               |                           | `/api/v1/admin/reviews/:id/moderate`                |   `POST`    | `reviews.moderate`        | **Fully Implemented** | Action dialog (FLAG, HIDE, REMOVE, RESTORE).                                                                                     |
|  **07**  | **Payments & Ledger**         | `/admin/payments`         | `/api/v1/admin/payments`                            |    `GET`    | `payments.read`           | **Fully Implemented** | Search payments, provider IDs, escrow status.                                                                                    |
|          |                               | `/admin/payments/[id]`    | `/api/v1/admin/payments/:id`                        |    `GET`    | `payments.read`           | **Fully Implemented** | Ledger postings, fee breakdown, refunds.                                                                                         |
|          |                               | `/admin/refunds`          | `/api/v1/admin/refunds`                             |    `GET`    | `payments.read`           | **Fully Implemented** | Dual-approval refund queue.                                                                                                      |
|          |                               |                           | `/api/v1/admin/refunds`                             |   `POST`    | `payments.refund.request` | **Fully Implemented** | Initiate refund request with mandatory justification.                                                                            |
|          |                               |                           | `/api/v1/admin/refunds/:id/approve`                 |   `POST`    | `payments.refund.approve` | **Fully Implemented** | Four-eyes approval (strict anti-self-approval).                                                                                  |
|          |                               |                           | `/api/v1/admin/refunds/:id/reject`                  |   `POST`    | `payments.refund.approve` | **Fully Implemented** | Reject refund request with rationale.                                                                                            |
|          |                               | `/admin/reconciliation`   | `/api/v1/admin/reconciliation`                      |    `GET`    | `payments.reconcile`      | **Fully Implemented** | Double-entry ledger audit & unbalance detection.                                                                                 |
|  **08**  | **Subscriptions / Referrals** | `/admin/referrals`        | N/A                                                 |     N/A     | `settings.read`           |  **Not in Backend**   | Documented gap: Model not present in Prisma schema. Render informative placeholder banner with planned Phase 5 roadmap.          |
|  **09**  | **Broadcast Notifications**   | `/admin/notifications`    | `/api/v1/admin/notifications/campaigns`             |    `GET`    | `settings.read`           | **Fully Implemented** | Campaign list with sent/delivered/failed counts.                                                                                 |
|          |                               |                           | `/api/v1/admin/notifications/campaigns/estimate`    |   `POST`    | `settings.read`           | **Fully Implemented** | Audience calculator based on user filters.                                                                                       |
|          |                               |                           | `/api/v1/admin/notifications/campaigns`             |   `POST`    | `settings.manage`         | **Fully Implemented** | Broadcast composer with mobile device preview.                                                                                   |
|  **10**  | **Disputes Governance**       | `/admin/disputes`         | `/api/v1/disputes`                                  |    `GET`    | Authenticated Staff       | **Fully Implemented** | Filter disputes by status (OPEN, UNDER_REVIEW).                                                                                  |
|          |                               | `/admin/disputes/[id]`    | `/api/v1/disputes/:id`                              |    `GET`    | Authenticated Staff       | **Fully Implemented** | Case file, submitted evidence files, claims.                                                                                     |
|          |                               |                           | `/api/v1/disputes/:id/status`                       |   `PATCH`   | Authenticated Staff       | **Fully Implemented** | Transition status (`UNDER_REVIEW`, `EVIDENCE_REQUESTED`).                                                                        |
|          |                               |                           | `/api/v1/disputes/:id/resolve`                      |   `POST`    | Authenticated Staff       | **Fully Implemented** | Adjudication: release escrow, split funds, or refund.                                                                            |
|  **11**  | **Jobs & Background Queues**  | `/admin/jobs`             | `/api/v1/admin/jobs/queues`                         |    `GET`    | `settings.read`           | **Fully Implemented** | BullMQ queue metrics (waiting, active, failed).                                                                                  |
|          |                               |                           | `/api/v1/admin/jobs/queues/:queueName/retry-failed` |   `POST`    | `settings.manage`         | **Fully Implemented** | Retry failed jobs with staff audit log.                                                                                          |
|  **12**  | **Platform Configuration**    | `/admin/config`           | `/api/v1/admin/settings`                            |    `GET`    | `settings.read`           | **Fully Implemented** | Dynamic platform settings key-value directory.                                                                                   |
|          |                               |                           | `/api/v1/admin/settings/:key`                       |    `GET`    | `settings.read`           | **Fully Implemented** | Specific config item, schema, active value.                                                                                      |
|          |                               |                           | `/api/v1/admin/settings/:key`                       |   `POST`    | `settings.manage`         | **Fully Implemented** | Update parameter value with audit reason.                                                                                        |
|          |                               |                           | `/api/v1/admin/settings/:key/history`               |    `GET`    | `settings.read`           | **Fully Implemented** | Immutable setting version history.                                                                                               |
|          |                               |                           | `/api/v1/admin/settings/:key/rollback`              |   `POST`    | `settings.manage`         | **Fully Implemented** | Roll back setting to target version.                                                                                             |
|  **13**  | **RBAC & Staff Directory**    | `/admin/admins`           | `/api/v1/admin/admins`                              |    `GET`    | `admins.read`             | **Fully Implemented** | Staff directory, role badges, active sessions.                                                                                   |
|          |                               |                           | `/api/v1/admin/admins/assign`                       |   `POST`    | `admins.manage`           | **Fully Implemented** | Assign admin role to designated user.                                                                                            |
|          |                               |                           | `/api/v1/admin/admins/revoke`                       |   `POST`    | `admins.manage`           | **Fully Implemented** | Revoke admin role (enforces last-superadmin lock).                                                                               |
|          |                               | `/admin/roles`            | `/api/v1/admin/roles`                               |    `GET`    | `admins.read`             | **Fully Implemented** | List all administrative roles and permissions.                                                                                   |
|          |                               |                           | `/api/v1/admin/roles`                               |   `POST`    | `admins.manage`           | **Fully Implemented** | Create custom administrative role.                                                                                               |
|          |                               |                           | `/api/v1/admin/roles/:id`                           |   `PATCH`   | `admins.manage`           | **Fully Implemented** | Update custom role permissions.                                                                                                  |
|          |                               |                           | `/api/v1/admin/roles/:id`                           |  `DELETE`   | `admins.manage`           | **Fully Implemented** | Delete custom role (system roles protected).                                                                                     |
|          |                               |                           | `/api/v1/admin/permissions`                         |    `GET`    | `admins.read`             | **Fully Implemented** | Full dictionary of 21 granular permissions.                                                                                      |
|  **14**  | **Audit Trail**               | `/admin/audit`            | Multiple endpoints                                  |    `GET`    | `audit.read`              | **Fully Implemented** | Aggregated view of user activity, config history, refunds.                                                                       |
|  **15**  | **Privacy & Lifecycle UI**    | `/admin/lifecycle`        | `/api/v1/lifecycle/legal-holds` etc.                |    `GET`    | `users.privacy`           | **Gated / Read-Only** | Read-only inspection of legal holds and cooling-off timers. Destructive execution buttons strictly disabled per governance gate. |

---

## 5. Security & Authentication Architecture

### 1. Identity & Session Propagation

- **Supabase SSR**: Authentication tokens are established via Supabase Auth and stored in secure, `httpOnly`, `sameSite=lax` session cookies.
- **Bearer Token Injection**: All administrative API requests made by the typed API client include the Authorization header `Bearer <accessToken>`.
- **Automatic Token Refresh**: The client library listens to `onAuthStateChange` to refresh expired tokens seamlessly without disrupting administrative workflows.

### 2. Authorization & CASL Permission Gating

Administrative capabilities are enforced on both sides of the network boundary:

- **Server Enforcement (Fastify)**: Route preHandlers verify tokens with asymmetric JWKS and test `fastify.requireAdminPermission(perm)`.
- **Client Enforcement (Next.js)**: The `PermissionGate` component evaluates user abilities using `@casl/ability` and hides or disables unauthorized navigation elements, action buttons, and sensitive tabular data.
- **Graceful 403 Handling**: API responses with status 403 automatically trigger a permission warning dialog informing the staff member of the specific missing permission without clearing the session.

### 3. OWASP Defense-in-Depth Headers (`src/middleware.ts`)

- `Content-Security-Policy`: Restricts scripts, objects, frames, and styles.
- `X-Frame-Options: DENY`: Complete clickjacking protection.
- `X-Content-Type-Options: nosniff`: Prevents MIME-sniffing exploits.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`: Enforces TLS across all subdomains.
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`: Disables browser hardware access.

---

## 6. Phased Implementation Roadmap

With Phase 0 complete and verified, implementation proceeds through the following sequential phases:

1. **Phase 1: Frontend Foundation**
   - Inject Warm Editorial tokens into Tailwind & CSS variables.
   - Implement typed API client (`apps/web-shell/src/lib/api/`) with error handling for RFC 7807 Problem Details.
   - Build core pill-first UI primitives: `CCButton`, `CCBadge`, `CCCard`, `CCInput`, `CCTable`, `CCModal`, `PermissionGate`.
2. **Phase 2: Public App Download Website**
   - Build responsive landing page at `/` with hero, store badges (`NEXT_PUBLIC_PLAY_STORE_URL`, `NEXT_PUBLIC_APP_STORE_URL`), value pillars, and legal links.
3. **Phase 3: Admin Console Foundation**
   - Admin login (`/admin/login`), session guard, `AdminLayout`, collapsible sidebar, breadcrumb header, notification bell, and role selector.
4. **Phase 4: Admin Feature Modules**
   - Construct all 13 modules adhering to the API Capability Matrix.
5. **Phase 5: Privacy & Lifecycle UI**
   - Read-only dashboard for legal holds and account lifecycle states with execution strictly disabled.
6. **Phase 6: Testing, Build Verification & Documentation**
   - Vitest unit tests, Playwright E2E suite, `turbo typecheck`, and full operational documentation.
