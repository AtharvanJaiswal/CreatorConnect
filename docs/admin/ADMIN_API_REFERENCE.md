# CreatorConnect: Admin REST API Reference

Authoritative documentation for all platform administration REST endpoints exposed by `apps/api` under `/api/v1/admin/*`.

---

## 1. Security & Authentication Architecture

All administrative endpoints require:

1. Valid asymmetric RS256 Bearer JWT emitted by Supabase Auth (or test key set).
2. Presence of a synchronized platform `User` with `RoleType.ADMIN`.
3. Possession of the specific fine-grained permission checked via `fastify.requireAdminPermission(permission)`.
4. Deny-by-default: If a permission is missing, requests fail immediately with `403 Forbidden` (`AUTH_INSUFFICIENT_ROLE`).

---

## 2. Admin RBAC & Identity Management

### 2.1 List All Admin Permissions

- **Method**: `GET`
- **Path**: `/api/v1/admin/permissions`
- **Permission**: `admins.read`
- **Response**: `200 OK`

```json
[
  {
    "id": "01948320-...",
    "name": "users.read",
    "description": "View user profiles and account records",
    "module": "users",
    "createdAt": "2026-11-24T10:00:00.000Z"
  }
]
```

### 2.2 List Admin Roles

- **Method**: `GET`
- **Path**: `/api/v1/admin/roles`
- **Permission**: `admins.read`
- **Response**: `200 OK`

```json
[
  {
    "id": "01948320-...",
    "name": "SUPER_ADMIN",
    "description": "Full unconstrained administrative authority",
    "isSystem": true,
    "permissions": ["*"],
    "userCount": 2,
    "createdAt": "2026-11-24T10:00:00.000Z",
    "updatedAt": "2026-11-24T10:00:00.000Z"
  }
]
```

### 2.3 Create Custom Admin Role

- **Method**: `POST`
- **Path**: `/api/v1/admin/roles`
- **Permission**: `admins.manage`
- **Body**:

```json
{
  "name": "REGIONAL_COMPLIANCE_OFFICER",
  "description": "Compliance staff with audit and moderation authority",
  "permissions": ["users.read", "projects.read", "audit.read"]
}
```

### 2.4 Assign Admin Role to User

- **Method**: `POST`
- **Path**: `/api/v1/admin/users/:id/roles`
- **Permission**: `admins.manage`
- **Body**:

```json
{
  "roleId": "01948320-..."
}
```

### 2.5 Revoke Admin Role from User (with Last Super Admin Guard)

- **Method**: `DELETE`
- **Path**: `/api/v1/admin/users/:id/roles/:roleId`
- **Permission**: `admins.manage`
- **Safety Guard**: Protected by `SELECT ... FOR UPDATE OF u` in PostgreSQL. Returns `409 Conflict` (`LAST_SUPER_ADMIN_LOCKOUT`) if attempting to remove the last active Super Admin.

---

## 3. Dashboard & Aggregated Analytics

### 3.1 Platform Overview

- **Method**: `GET`
- **Path**: `/api/v1/admin/dashboard/overview?period=month`
- **Permission**: `analytics.read`
- **Cache**: 60-second Redis cache with stale-while-revalidate.
- **Metrics**: Total users, active creators, completed projects, gross volume in minor units (paisa), revenue in minor units, pending disputes.

---

## 4. User Directory & Lifecycle Governance

### 4.1 Search User Directory

- **Method**: `GET`
- **Path**: `/api/v1/admin/users?search=john&status=ACTIVE&page=1&limit=20`
- **Permission**: `users.read`

### 4.2 Get User Admin Details

- **Method**: `GET`
- **Path**: `/api/v1/admin/users/:id`
- **Permission**: `users.read`

### 4.3 Suspend User Account

- **Method**: `POST`
- **Path**: `/api/v1/admin/users/:id/suspend`
- **Permission**: `users.suspend`
- **Body**:

```json
{
  "reason": "Violating community safety guidelines regarding external contact."
}
```

### 4.4 Reactivate User Account

- **Method**: `POST`
- **Path**: `/api/v1/admin/users/:id/reactivate`
- **Permission**: `users.reactivate`
- **Body**:

```json
{
  "reason": "Identity verification completed following manual appeal."
}
```

---

## 5. Marketplace & Project Governance

### 5.1 Creator Directory & Verification

- **Method**: `GET` / `POST`
- **Path**: `/api/v1/admin/creators`, `/api/v1/admin/creators/:id/verify`
- **Permissions**: `users.read`, `users.update`

### 5.2 Brand Client Directory & Verification

- **Method**: `GET` / `POST`
- **Path**: `/api/v1/admin/clients`, `/api/v1/admin/clients/:id/verify`
- **Permissions**: `users.read`, `users.update`

### 5.3 Project Inspection & Moderation

- **Method**: `GET` / `POST`
- **Path**: `/api/v1/admin/projects`, `/api/v1/admin/projects/:id`, `/api/v1/admin/projects/:id/moderate`
- **Permissions**: `projects.read`, `projects.moderate`
- **Actions**: `FLAG_UNDER_REVIEW`, `SUSPEND`, `RESTORE`, `RESTRICT`

---

## 6. Financial & Escrow Administration

### 6.1 Payment Intent Search & Inspection

- **Method**: `GET`
- **Path**: `/api/v1/admin/payments`, `/api/v1/admin/payments/:id`
- **Permission**: `payments.read`

### 6.2 Refund Initiation (Dual-Approval Gating)

- **Method**: `POST`
- **Path**: `/api/v1/admin/refunds`
- **Permission**: `payments.refund.request`
- **Threshold**: Refunds $\ge$ ₹50,000 (5,000,000 paisa) automatically require dual approval.

### 6.3 Dual-Approval Decision (Anti-Conflict-of-Interest)

- **Method**: `POST`
- **Path**: `/api/v1/admin/refunds/:id/approve`, `/api/v1/admin/refunds/:id/reject`
- **Permission**: `payments.refund.approve`
- **Strict Guard**: If deciding administrator == requesting administrator, returns `403 Conflict Of Interest` (`CONFLICT_OF_INTEREST`).

### 6.4 Double-Entry Ledger Reconciliation

- **Method**: `GET`
- **Path**: `/api/v1/admin/reconciliation`
- **Permission**: `payments.reconcile`
- **Integrity**: Verifies $\sum \text{Debits} \equiv \sum \text{Credits}$ across all active accounts using exact `BigInt` arithmetic.

---

## 7. Trust, Safety & Support Administration

### 7.1 Moderation Reports Queue

- **Method**: `GET` / `POST`
- **Path**: `/api/v1/admin/reports`, `/api/v1/admin/reports/:id/resolve`, `/api/v1/admin/reports/:id/dismiss`
- **Permissions**: `reports.review`, `reports.resolve`

### 7.2 Review Moderation

- **Method**: `GET` / `POST`
- **Path**: `/api/v1/admin/reviews`, `/api/v1/admin/reviews/:id/moderate`
- **Permissions**: `reviews.moderate`
- **Actions**: `FLAG`, `HIDE`, `REMOVE`, `RESTORE`

### 7.3 Support Tickets & Internal Note Isolation

- **Method**: `GET` / `POST`
- **Path**: `/api/v1/admin/support/tickets*`
- **Permissions**: `support.manage`, `support.reply`, `support.notes`
- **Privacy Guarantee**: Messages created with `isInternal: true` are exclusively returned to staff and are cryptographically filtered from customer queries.

---

## 8. Platform Configuration & Notifications

### 8.1 Dynamic Platform Settings & History

- **Method**: `GET` / `POST`
- **Path**: `/api/v1/admin/settings`, `/api/v1/admin/settings/:key`, `/api/v1/admin/settings/:key/history`, `/api/v1/admin/settings/:key/rollback`
- **Permissions**: `settings.read`, `settings.manage`

### 8.2 Broadcast Notification Campaigns

- **Method**: `GET` / `POST`
- **Path**: `/api/v1/admin/notifications/campaigns`, `/estimate`, `/:id/send`, `/:id/cancel`
- **Permissions**: `settings.read`, `settings.manage`

### 8.3 Job Queue Health & Recovery

- **Method**: `GET` / `POST`
- **Path**: `/api/v1/admin/jobs/queues`, `/api/v1/admin/jobs/queues/:queueName/retry-failed`
- **Permissions**: `settings.read`, `settings.manage`
