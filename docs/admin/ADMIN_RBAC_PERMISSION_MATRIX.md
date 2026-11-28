# CreatorConnect — Administrative RBAC Permission Matrix

## Role & Capability Reference Manual

**Phase:** Phase 4 Platform Administration  
**Status:** IMPLEMENTED & ACTIVE  
**Engine:** CASL `PureAbility` + Fastify Route Pre-Handlers

---

## 1. Overview of Administrative RBAC Architecture

CreatorConnect employs a two-tier Role-Based Access Control (RBAC) model:

1. **Global Persona Tier (`user_roles`)**:
   - Standard ecosystem roles: `CREATOR`, `PROFESSIONAL`, `BRAND`, `PODCASTER`, `ADMIN`.
   - Any user attempting to access administrative routes (`/api/v1/admin/*`) must first hold the `ADMIN` role.
2. **Granular Administrative Tier (`admin_user_roles` $\to$ `admin_roles` $\to$ `admin_permissions`)**:
   - Administrators are assigned specific administrative roles (e.g. `FINANCE_ADMIN`, `TRUST_SAFETY_ADMIN`).
   - Every administrative endpoint validates specific permission strings via the `requireAdminPermission(permission)` route pre-handler.
   - Deny-by-default: If a permission is not explicitly granted, access is rejected with HTTP 403 `AUTH_INSUFFICIENT_ROLE`.

---

## 2. Standard Administrative Roles

| Role Name              | System Protected | Description                                                                        | Assigned Permissions                                                                                                                                                                                                          |
| ---------------------- | :--------------: | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SUPER_ADMIN**        |     **YES**      | Full platform authority, emergency recovery, administrator role management         | `*` (Universal Super-Permission)                                                                                                                                                                                              |
| **PLATFORM_ADMIN**     |     **YES**      | Day-to-day platform oversight, marketplace operations, and support                 | `users.read`, `users.update`, `users.suspend`, `projects.read`, `projects.moderate`, `reports.review`, `reports.resolve`, `support.manage`, `support.reply`, `support.notes`, `settings.read`, `analytics.read`, `audit.read` |
| **USER_ADMIN**         |     **YES**      | User directory management, account suspensions, verification, and privacy requests | `users.read`, `users.update`, `users.suspend`, `users.reactivate`, `users.export`, `users.privacy`, `audit.read`                                                                                                              |
| **FINANCE_ADMIN**      |     **YES**      | Financial reconciliation, payment audits, and refund approvals                     | `payments.read`, `payments.refund.request`, `payments.refund.approve`, `payments.reconcile`, `analytics.read`, `audit.read`                                                                                                   |
| **TRUST_SAFETY_ADMIN** |     **YES**      | Content moderation, abuse reports, review moderation, and account sanctions        | `reports.review`, `reports.resolve`, `reviews.moderate`, `users.suspend`, `projects.moderate`, `audit.read`                                                                                                                   |
| **SUPPORT_ADMIN**      |     **YES**      | Customer service operations, ticket reassignment, and SLA escalation               | `support.manage`, `support.reply`, `support.notes`, `users.read`, `projects.read`                                                                                                                                             |
| **CONTENT_MODERATOR**  |     **YES**      | Front-line review of flagged content, community posts, and media                   | `reports.review`, `reviews.moderate`, `projects.read`                                                                                                                                                                         |
| **ANALYTICS_VIEWER**   |     **YES**      | Read-only access to dashboard statistics, transaction volumes, and performance     | `analytics.read`                                                                                                                                                                                                              |

_Note: Custom roles can be created dynamically by Super Administrators with arbitrary combinations of administrative permissions._

---

## 3. Comprehensive Permission Catalog

| Module         | Permission Key            | Description                                                   | Guarded Operations                                                                           |
| -------------- | ------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Users**      | `users.read`              | View user directory, profile details, and account status      | `GET /admin/users`, `GET /admin/users/:id`                                                   |
|                | `users.update`            | Update user profile attributes and metadata                   | `PATCH /admin/users/:id`                                                                     |
|                | `users.suspend`           | Suspend user accounts                                         | `POST /admin/users/:id/suspend`, `PATCH /admin/users/:id/status`                             |
|                | `users.reactivate`        | Reactivate suspended user accounts                            | `POST /admin/users/:id/reactivate`                                                           |
|                | `users.export`            | Export user data for compliance                               | `GET /admin/users/:id/export`                                                                |
|                | `users.privacy`           | Process privacy requests and legal holds                      | `POST /admin/users/:id/legal-holds`, `DELETE /admin/users/:id/legal-holds/:holdId`           |
| **Projects**   | `projects.read`           | Search and inspect marketplace projects and deliverables      | `GET /admin/projects`, `GET /admin/projects/:id`                                             |
|                | `projects.moderate`       | Suspend or moderate suspicious projects                       | `POST /admin/projects/:id/moderate`                                                          |
| **Payments**   | `payments.read`           | View transaction history, escrow balances, and ledger entries | `GET /admin/payments`, `GET /admin/payments/:id`                                             |
|                | `payments.refund.request` | Request a refund for a transaction or project                 | `POST /admin/refunds`                                                                        |
|                | `payments.refund.approve` | Approve or reject high-value dual-approval refunds            | `POST /admin/refunds/:id/approve`                                                            |
|                | `payments.reconcile`      | Access financial reconciliation reports                       | `GET /admin/reconciliation`                                                                  |
| **Moderation** | `reports.review`          | Inspect abuse reports, evidence, and affected resources       | `GET /admin/reports`, `GET /admin/reports/:id`                                               |
|                | `reports.resolve`         | Enforce moderation actions (warnings, removals, dismissals)   | `POST /admin/reports/:id/resolve`, `POST /admin/reports/:id/dismiss`                         |
|                | `reviews.moderate`        | Arbitrate and moderate reported reviews                       | `POST /api/v1/reviews/:id/moderate`                                                          |
| **Support**    | `support.manage`          | Reassign tickets, update status, and manage SLA priorities    | `POST /admin/support/tickets/:id/assign`, `PATCH /admin/support/tickets/:id/*`               |
|                | `support.reply`           | Send public, customer-visible support replies                 | `POST /admin/support/tickets/:id/reply`                                                      |
|                | `support.notes`           | Create internal staff-only notes                              | `POST /admin/support/tickets/:id/notes`                                                      |
| **Analytics**  | `analytics.read`          | Access platform overview metrics and historical analytics     | `GET /admin/dashboard/*`                                                                     |
| **Admins**     | `admins.read`             | View administrative roster, assigned roles, and permissions   | `GET /admin/admins`, `GET /admin/roles`, `GET /admin/permissions`                            |
|                | `admins.manage`           | Create/update custom roles, assign/revoke roles to users      | `POST/PATCH/DELETE /admin/roles/*`, `POST /admin/admins/assign`, `POST /admin/admins/revoke` |
| **Settings**   | `settings.read`           | View platform settings, feature flags, and configuration      | `GET /admin/settings`, `GET /admin/settings/:key`                                            |
|                | `settings.manage`         | Update platform settings and trigger rollbacks                | `PATCH /admin/settings/:key`                                                                 |
| **Audit**      | `audit.read`              | View and export administrative audit logs                     | `GET /admin/audit-logs`, `GET /admin/security-events`                                        |
| **Wildcard**   | `*`                       | Universal administrative super-permission                     | Bypasses all granular permission checks                                                      |

---

## 4. Invariants & Security Rules

1. **Deny-by-Default**: Every administrative route explicitly requires both `fastify.authenticate` and `fastify.requireAdminPermission(...)`. Absence of permission yields HTTP 403 `AUTH_INSUFFICIENT_ROLE`.
2. **Anti-Escalation**:
   - Only administrators with the `SUPER_ADMIN` role can grant or revoke `SUPER_ADMIN`.
   - Administrators cannot grant themselves higher privileges than they currently possess.
3. **Last Active Super Admin Lockout Prevention**:
   - Revoking the `SUPER_ADMIN` role or deactivating an active Super Administrator requires acquiring a pessimistic row lock in PostgreSQL (`SELECT ... FOR UPDATE OF u`).
   - If the target is the last remaining active Super Administrator, the operation is blocked with HTTP 400 `LAST_SUPER_ADMIN_LOCKOUT_PREVENTED`.
4. **Anti-Self-Approval**:
   - In financial operations (refunds) and dispute arbitrations, an administrator cannot approve actions where `actorId === requesterId` or where the administrator is an involved participant.
