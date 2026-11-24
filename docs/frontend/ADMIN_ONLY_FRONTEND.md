# CreatorConnect Admin-Only Frontend Specification

## 1. Product Direction & Positioning

CreatorConnect has finalized its web product strategy:

> **CreatorConnect does not serve a public website or web consumer application. The web frontend serves exclusively as the administrative command center (`/admin/*`). Creator, podcaster, and brand collaborative experiences belong strictly to the native mobile applications (Android & iOS).**

### 1.1 Architectural Enforcements

1. **Server-Side Root Redirect**: Any inbound request to `/` immediately triggers an HTTP 307 server-side redirect to `/admin/login`.
2. **Edge Middleware Interception**: Next.js edge middleware (`src/middleware.ts`) intercepts any request not starting with `/admin` or `/api` and redirects it directly to `/admin/login`.
3. **Clean Route Tree**: All legacy consumer routes (`/brand`, `/creator`, `/assignments`, `/messages`, `/discovery`, `/onboarding`, `/community`, etc.) have been removed from the active web route tree.
4. **Hardened Login**: The admin authentication portal (`/admin/login`) contains no test credential autofill buttons, no demo accounts, and no links to public sites.

---

## 2. Active Route Inventory (25 Pages Total)

Every active route compiled by Next.js 15 represents an administrative capability:

| Route Path              | Type          | First Load JS | Description                                            |
| :---------------------- | :------------ | :------------ | :----------------------------------------------------- |
| `/`                     | Static (SSG)  | 103 kB        | Server-side redirect to `/admin/login`                 |
| `/_not-found`           | Static (SSG)  | 103 kB        | Admin-only 404 barrier with link to `/admin/login`     |
| `/admin`                | Static (SSG)  | 103 kB        | Redirect to `/admin/dashboard`                         |
| `/admin/login`          | Static (SSG)  | 177 kB        | Hardened Staff Authentication Portal                   |
| `/admin/dashboard`      | Static (SSG)  | 112 kB        | Real-Time Platform KPI & Worker Telemetry              |
| `/admin/users`          | Static (SSG)  | 185 kB        | User Directory & Suspension Management                 |
| `/admin/users/[id]`     | Dynamic (SSR) | 184 kB        | User Detail, Verification Badges & Activity Timeline   |
| `/admin/verification`   | Static (SSG)  | 182 kB        | Creator Showreel & Brand Registration Review Desk      |
| `/admin/assignments`    | Static (SSG)  | 181 kB        | Marketplace Assignment Oversight & Contract Moderation |
| `/admin/moderation`     | Static (SSG)  | 181 kB        | Priority Queue for Reported Content & Abuse Triage     |
| `/admin/reviews`        | Static (SSG)  | 181 kB        | User Review Moderation & Rating Analytics              |
| `/admin/payments`       | Static (SSG)  | 112 kB        | Escrow Transactions, Milestones & Payout Ledger        |
| `/admin/refunds`        | Static (SSG)  | 181 kB        | Four-Eyes Dual Approval Refund Queue                   |
| `/admin/reconciliation` | Static (SSG)  | 106 kB        | Double-Entry Zero-Sum Ledger Parity Audit              |
| `/admin/referrals`      | Static (SSG)  | 108 kB        | Referral Growth & Subscription Tier Roadmap            |
| `/admin/notifications`  | Static (SSG)  | 181 kB        | Push Broadcast Campaign Manager & Preview              |
| `/admin/disputes`       | Static (SSG)  | 108 kB        | Contractual Dispute Arbitration & Escrow Splits        |
| `/admin/jobs`           | Static (SSG)  | 178 kB        | BullMQ Worker Queue Telemetry & Retry Actions          |
| `/admin/config`         | Static (SSG)  | 180 kB        | Platform Settings Editor & Version Rollback            |
| `/admin/admins`         | Static (SSG)  | 184 kB        | Staff Directory & Last-Superadmin Protected Revocation |
| `/admin/roles`          | Static (SSG)  | 181 kB        | 21-Permission Dictionary & Custom Role Designer        |
| `/admin/audit`          | Static (SSG)  | 106 kB        | Immutable Chronological Audit Trail                    |
| `/admin/support`        | Static (SSG)  | 180 kB        | Customer Support Helpdesk & Ticket Triage              |
| `/admin/lifecycle`      | Static (SSG)  | 107 kB        | Statutory Legal Holds & Privacy Desk (Stage A Guarded) |

---

## 3. Authentication & Session Architecture

### 3.1 Flow & Session Integrity

- **Authentication Provider**: Supabase Auth client (`@supabase/supabase-js`) integrating with Fastify backend JWKS asymmetric verification.
- **Session Resolution**: Upon login at `/admin/login`, the client receives an asymmetric JWT access token.
- **Identity Sync**: Fastify backend extracts claims, validates against `AdminUserRole` database records, and returns effective roles and permissions.
- **Session Expiration**: Automatic redirect to `/admin/login` on token expiry or HTTP 401 response.
- **Secure Sign-Out**: Handled via `useAuth().signOut()`, which clears browser session cookies, local storage tokens, and redirects immediately to `/admin/login`.

### 3.2 Login Hardening

The `/admin/login` page has been stripped of:

- Development test account autofill buttons (`handleQuickLogin`).
- Hardcoded demo administrator emails and passwords.
- Client-side bypasses or environment-based credential exposure.
- Navigation links pointing to external or public web pages.

---

## 4. Authorization & Permission Model

### 4.1 Authoritative Backend Source of Truth

Frontend authorization is strictly a **usability and visual affordance layer**. Every state mutation or sensitive data retrieval is enforced independently by the Fastify backend via RBAC middleware and CASL abilities.

### 4.2 The `<PermissionGate />` Primitive

The declarative UI barrier (`src/components/admin/ui/PermissionGate.tsx`) evaluates permissions against the authenticated staff user:

```tsx
<PermissionGate permission="finance.refund" showLockedPlaceholder>
  <AdminButton variant="danger" onClick={handleApproveRefund}>
    Approve Escrow Refund
  </AdminButton>
</PermissionGate>
```

Evaluation logic:

1. `SUPER_ADMIN` role or `*` permission: Grants UI access unconditionally.
2. Explicit `permission`: Grants access if `user.adminPermissions` includes the permission.
3. Explicit `role`: Grants access if `user.adminRoles` or `user.roles` matches.
4. Fallback: Renders optional `fallback` element or locked accessibility banner.

### 4.3 Key Security Invariants

- **Four-Eyes Dual Approval**: On `/admin/refunds`, the system strictly prevents self-approval ($\text{Proposer ID} \neq \text{Approver ID}$).
- **Last Superadmin Invariant**: The staff directory disables role revocation on the sole remaining Super Admin account.
- **Stage A Privacy Gate**: Destructive PII pseudonymization and permanent data deletion buttons on `/admin/lifecycle` are locked pending governance sign-off.

---

## 5. API Capability & Integration Matrix

| Module          | Route                   | Backend Endpoint                                 | Status                                 | Notes                                           |
| :-------------- | :---------------------- | :----------------------------------------------- | :------------------------------------- | :---------------------------------------------- |
| Dashboard       | `/admin/dashboard`      | `GET /api/v1/admin/dashboard/stats`              | **IMPLEMENTED AND VERIFIED**           | Telemetry, active users, GMV, health            |
| Users           | `/admin/users`          | `GET /api/v1/admin/users`                        | **IMPLEMENTED AND VERIFIED**           | Paginated users, search, filter                 |
| User Suspension | `/admin/users/[id]`     | `POST /api/v1/admin/users/:id/suspend`           | **IMPLEMENTED AND VERIFIED**           | Reason & duration logging                       |
| Verification    | `/admin/verification`   | `GET /api/v1/admin/verification/creators`        | **IMPLEMENTED AND VERIFIED**           | Creator showreels & brand verification          |
| Assignments     | `/admin/assignments`    | `GET /api/v1/admin/marketplace/assignments`      | **IMPLEMENTED AND VERIFIED**           | Contract monitoring & cancel                    |
| Moderation      | `/admin/moderation`     | `GET /api/v1/admin/moderation/reports`           | **IMPLEMENTED AND VERIFIED**           | Abuse reports resolve/dismiss                   |
| Reviews         | `/admin/reviews`        | `GET /api/v1/admin/reviews`                      | **IMPLEMENTED AND VERIFIED**           | Rating filter, flag/hide/restore                |
| Payments        | `/admin/payments`       | `GET /api/v1/admin/finance/escrow`               | **IMPLEMENTED AND VERIFIED**           | Escrow milestones & fee ledger                  |
| Refunds         | `/admin/refunds`        | `POST /api/v1/admin/finance/refunds/:id/approve` | **IMPLEMENTED AND VERIFIED**           | Four-Eyes dual approval                         |
| Reconciliation  | `/admin/reconciliation` | `GET /api/v1/admin/finance/reconciliation`       | **IMPLEMENTED AND VERIFIED**           | Double-entry zero-sum parity                    |
| Referrals       | `/admin/referrals`      | `GET /api/v1/admin/config` (keys)                | **IMPLEMENTED BUT NOT FULLY VERIFIED** | Uses PlatformSetting; no dedicated Prisma table |
| Notifications   | `/admin/notifications`  | `POST /api/v1/admin/notifications/broadcast`     | **IMPLEMENTED AND VERIFIED**           | Push campaigns with mobile preview              |
| Disputes        | `/admin/disputes`       | `POST /api/v1/admin/disputes/:id/resolve`        | **IMPLEMENTED AND VERIFIED**           | Escrow splits & binding resolutions             |
| Jobs            | `/admin/jobs`           | `GET /api/v1/admin/jobs/metrics`                 | **IMPLEMENTED AND VERIFIED**           | BullMQ queue metrics & retry                    |
| Config          | `/admin/config`         | `PUT /api/v1/admin/config/:key`                  | **IMPLEMENTED AND VERIFIED**           | Hot-reload parameters & rollback                |
| Staff           | `/admin/admins`         | `POST /api/v1/admin/rbac/staff/:id/roles`        | **IMPLEMENTED AND VERIFIED**           | Role assignments & revocation                   |
| Roles           | `/admin/roles`          | `POST /api/v1/admin/rbac/roles`                  | **IMPLEMENTED AND VERIFIED**           | 21-permission custom role creator               |
| Audit           | `/admin/audit`          | `GET /api/v1/admin/audit`                        | **IMPLEMENTED AND VERIFIED**           | Immutable chronological audit trail             |
| Support         | `/admin/support`        | `POST /api/v1/admin/support/tickets/:id/reply`   | **IMPLEMENTED AND VERIFIED**           | Customer support ticket triage                  |
| Lifecycle       | `/admin/lifecycle`      | `GET /api/v1/admin/lifecycle/holds`              | **BLOCKED** (for destructive actions)  | Read-only inspection active; erasure locked     |

---

## 6. Design System & Tokens

The console applies the **Warm Editorial Neo-Pop** visual language:

- **Canvas Background**: Warm Cream (`#FAF6EF`)
- **Card Surfaces**: Pure White (`#FFFFFF`) with 1px border (`#E7E0D5`)
- **Brand Accent**: Yellow (`#FFD64A`), Press (`#F0C52F`)
- **Typography**: Ink Black (`#14110F`) in Archivo, headings in Instrument Serif, numbers in JetBrains Mono
- **Controls**: Pill-first (`rounded-full`) for all buttons, inputs, search bars, and tags
- **Accessibility**: 100% compliant with WCAG 2.2 AA contrast ratios

---

## 7. Local Development & Testing Instructions

### 7.1 Running Locally

```powershell
# Start Fastify backend on port 3000
pnpm --filter @creatorconnect/api dev

# In a separate terminal, start the Admin Web Console on port 3002
pnpm --filter @creatorconnect/web-shell dev
```

Navigate to `http://localhost:3002`. The application will immediately redirect to `http://localhost:3002/admin/login`.

### 7.2 Running Verification Commands

```powershell
# Run TypeScript compilation check
pnpm --filter @creatorconnect/web-shell typecheck

# Run Prettier code formatting check
pnpm prettier --check "apps/web-shell/src/**/*.{ts,tsx}"

# Run Turbo monorepo linter
pnpm -w run lint

# Run Vitest automated test suite (23 files, 288 tests)
pnpm --filter @creatorconnect/web-shell test

# Run Next.js 15 production build
pnpm --filter @creatorconnect/web-shell build
```
