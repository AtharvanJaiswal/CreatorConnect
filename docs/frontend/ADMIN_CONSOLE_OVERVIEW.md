# CreatorConnect Admin Console Overview

## 1. Executive Summary

The CreatorConnect Admin Console is a high-density, production-grade operational command center designed for platform administrators, trust & safety agents, financial controllers, and customer support engineers.

Unlike the mobile-first creator and brand applications, the Admin Console is exclusively web-native, engineered for desktop productivity, rapid bulk triage, multi-step adjudication, and strict security compliance.

---

## 2. Architecture & Tech Stack

- **Framework**: Next.js 15 (App Router) with React 18 and TypeScript 5.5
- **Monorepo Structure**: Exclusively hosted within `apps/web-shell`; public consumer routes retired in favor of native mobile applications.
- **Design Language**: **Warm Editorial Neo-Pop** (Warm Cream `#FAF6EF`, Brand Yellow `#FFD64A`, Ink Black `#14110F`, Fine Borders `#E7E0D5`)
- **Backend API**: Fastify v4 + TypeScript backend (`apps/api`)
- **API Contracts**: Strongly typed shared schemas from `@creatorconnect/contracts`
- **Authentication**: Supabase Auth (asymmetric JWKS JWT) + Asymmetric API gateway token validation
- **Authorization**: CASL Ability Engine + 21 granular administrative permissions + Dual-approval safeguards

---

## 3. Navigation & Information Architecture

The Admin Console layout (`/admin/*`) is organized into five functional groups within a persistent, high-density sidebar:

### 3.1 Overview

- **Dashboard (`/admin/dashboard`)**: Real-time KPI telemetry (active users, GMV, escrow volume, open abuse reports, dispute rate, BullMQ worker health) and system status badges.

### 3.2 Trust & Safety

- **Users Directory (`/admin/users`)**: Searchable user directory with role, status, and verification filtering; direct user inspection (`/admin/users/[id]`); user suspension modal with reason and duration selection.
- **Verification Desk (`/admin/verification`)**: Dual-tab queue for creator showreel/identity approvals and brand business registration verifications.
- **Content Moderation (`/admin/moderation`)**: Priority queue for reported UGC, spam flags, and abusive interactions with resolve/dismiss workflows.
- **Reviews & Ratings (`/admin/reviews`)**: Rating distribution analyzer and user feedback moderation queue (flag, hide, remove, restore).

### 3.3 Operations

- **Marketplace Assignments (`/admin/assignments`)**: Real-time assignment inspection across all statuses (`OPEN`, `ASSIGNED`, `IN_ESCROW`, `COMPLETED`, `CANCELLED`); administrative cancel/pause/flag controls.
- **Dispute Resolution (`/admin/disputes`)**: Contractual dispute arbitration desk; evidence inspection, creator/brand statement comparison, and escrow resolution tools (full refund, creator release, or split settlement).
- **Notifications & Broadcasts (`/admin/notifications`)**: Platform-wide announcement and push campaign manager with live mobile preview and audience targeting.
- **Support Helpdesk (`/admin/support`)**: Customer support ticket triage and response console.

### 3.4 Finance & Ledger

- **Escrow Transactions (`/admin/payments`)**: Read-only ledger of milestone escrows, payment intentions, currency tracking, and settlement records.
- **Refund Dual-Approval (`/admin/refunds`)**: Four-eyes financial risk management queue; strictly enforces that the proposing admin cannot approve their own refund request.
- **Ledger Reconciliation (`/admin/reconciliation`)**: Real-time double-entry parity audit verifying that system credits equal system debits down to the zero-sum ledger invariant.
- **Subscriptions & Referrals (`/admin/referrals`)**: Roadmap and platform configuration overview for subscription plans and referral growth incentives.

### 3.5 Platform & Governance

- **BullMQ Worker Queues (`/admin/jobs`)**: Distributed job queue telemetry (`email`, `notifications`, `payouts`, `retention`, `media`); job inspection and dead-letter retry actions.
- **Platform Configuration (`/admin/config`)**: Hot-reconfigurable platform settings (fees, rate limits, feature flags) with audit history and version rollback.
- **Staff Directory (`/admin/admins`)**: Platform staff user listing, role assignment, and privilege revocation guarded by the Last Superadmin Protection rule.
- **RBAC Roles & Permissions (`/admin/roles`)**: Complete 21-permission dictionary and custom role designer.
- **Audit Trail (`/admin/audit`)**: Immutable chronological log of all administrative actions, target entities, IP addresses, and metadata.
- **Privacy & Lifecycle (`/admin/lifecycle`)**: Read-only console for statutory legal holds, cooling-off timers, and cryptographic privacy receipts. Destructive PII pseudonymization buttons are permanently disabled pending Stage A Governance approval.

---

## 4. Operational Guardrails & Safeguards

1. **Four-Eyes Dual-Approval on Refunds**: Any refund exceeding financial thresholds requires two distinct administrative authorizations. The initiating staff member cannot approve their own refund.
2. **Last Superadmin Invariant**: The console enforces that the final remaining Super Admin account cannot have their administrative privileges revoked or deleted, preventing platform lockout.
3. **Stage A Privacy Governance Gate**: Irreversible data destruction and PII erasure cannot be executed from the web console until cryptographic governance sign-off is completed.
4. **Authoritative Backend As Truth**: All actions perform direct asynchronous calls to Fastify routes; no optimistic state changes or simulated actions are accepted without backend acknowledgment.
