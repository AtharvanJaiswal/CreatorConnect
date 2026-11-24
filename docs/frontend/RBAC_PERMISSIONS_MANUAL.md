# CreatorConnect RBAC & Administrative Permissions Manual

## 1. Role-Based Access Control Architecture

CreatorConnect implements a strict Role-Based Access Control (RBAC) engine backed by CASL abilities and database-backed role assignments (`AdminRole`, `AdminUserRole`, `AdminRolePermission`).

Every administrative user is assigned one or more administrative roles, each mapped to a defined set of granular permissions.

---

## 2. Standard Administrative Roles

| Role Code            | Role Name              | Scope of Responsibility                                                        |
| :------------------- | :--------------------- | :----------------------------------------------------------------------------- |
| `SUPER_ADMIN`        | Platform Superadmin    | Full platform ownership; wildcard permission bypass; staff & role management.  |
| `FINANCE_ADMIN`      | Financial Controller   | Escrow inspection, ledger reconciliation, dispute resolution, refund approval. |
| `TRUST_SAFETY_ADMIN` | Trust & Safety Officer | User suspension, identity/brand verification, UGC moderation, review flags.    |
| `OPERATIONS_ADMIN`   | Operations Lead        | Marketplace assignment monitoring, broadcast notifications, platform settings. |
| `SUPPORT_AGENT`      | Customer Support Agent | User search, ticket responses, read-only account inspection.                   |
| `CUSTOM_ROLE`        | Custom Admin           | Tailored roles configured via the Roles & Permissions console.                 |

---

## 3. The 21 Granular Administrative Permissions

The platform defines 21 explicit permissions across 10 functional domains:

### 3.1 Dashboard & Telemetry

1. `dashboard.view`: Access to high-level platform telemetry, active user counts, GMV, and health metrics.

### 3.2 User Management & Trust

2. `users.view`: Search, inspect, and view user profiles, account metadata, and activity timelines.
3. `users.suspend`: Temporarily suspend or ban user accounts with mandatory reason logging.
4. `users.delete`: Initiate administrative user deletion workflows subject to lifecycle retention rules.
5. `verification.review`: Review, approve, or reject creator showreels and brand business registrations.

### 3.3 Content & Moderation

6. `moderation.queue`: Access reported content queues, triage spam, and moderate abusive material.
7. `moderation.dismiss`: Dismiss false-positive abuse reports.
8. `reviews.manage`: Moderate creator and brand feedback (flag, hide, remove, restore).

### 3.4 Marketplace & Disputes

9. `marketplace.assignments`: Monitor assignments, inspect contract milestones, pause or cancel contracts.
10. `disputes.view`: Read-only inspection of open and resolved arbitration disputes.
11. `disputes.resolve`: Issue binding arbitration verdicts (refund, release, or settlement splits).

### 3.5 Finance & Escrow

12. `finance.view`: Inspect milestone escrows, transactions, fee deductions, and reconciliation reports.
13. `finance.refund`: Initiate or approve escrow refunds (subject to Four-Eyes Dual Approval).

### 3.6 Communications & Support

14. `notifications.broadcast`: Compose and send platform-wide mobile push and announcement notifications.
15. `support.tickets`: View, assign, and respond to customer support tickets.

### 3.7 Background Workers & Infrastructure

16. `jobs.view`: Monitor BullMQ worker queues, queue latencies, and job throughput.
17. `jobs.retry`: Manually re-enqueue failed dead-letter jobs.

### 3.8 Platform Configuration

18. `config.view`: View system parameters, payment fee tiers, and rate limits.
19. `config.edit`: Modify platform configuration parameters and trigger version rollbacks.

### 3.9 Staff & Governance

20. `rbac.manage`: Manage platform staff, assign administrative roles, and edit custom role permissions.
21. `audit.view`: Access the immutable chronological audit log.

---

## 4. Frontend Enforcement: `<PermissionGate />`

The `<PermissionGate />` primitive declaratively protects UI actions, buttons, and views:

```tsx
import { PermissionGate } from '@/components/admin/ui/PermissionGate';

<PermissionGate permission="finance.refund" showLockedPlaceholder>
  <AdminButton variant="danger" onClick={handleApproveRefund}>
    Approve Escrow Refund
  </AdminButton>
</PermissionGate>;
```

### 4.1 Evaluation Rules

1. **Superadmin Bypass**: If the authenticated user has the `SUPER_ADMIN` role or `*` permission, access is unconditionally granted.
2. **Explicit Role Check**: If the `role` prop is supplied, access is granted if the user possesses the matching administrative role.
3. **Explicit Permission Check**: If the `permission` prop is supplied, access is granted if the user's effective permissions include that permission.
4. **Fallback Handling**: If access is denied, the component renders the optional `fallback` node, or an accessible locked notification banner if `showLockedPlaceholder` is `true`.

---

## 5. Security Safeguards & Invariants

### 5.1 Four-Eyes Dual Approval Safeguard

To eliminate financial fraud and unauthorized fund diversion, the refund management system enforces:
$$\text{Proposer ID} \neq \text{Approver ID}$$

- If a staff member creates a refund intention, the approval button is disabled for their session.
- The approval request requires the signature of a second, distinct staff member holding the `finance.refund` permission.

### 5.2 Last Superadmin Invariant

The platform prevents administrative lockout:
$$\sum \text{Active Superadmins} \ge 1$$

- The Staff Directory console detects when only one active Superadmin account exists.
- In this state, the privilege revocation button for that account is disabled, preventing accidental platform self-lockout.
