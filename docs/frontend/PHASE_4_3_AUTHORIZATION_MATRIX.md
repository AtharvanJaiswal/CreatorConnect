# CreatorConnect — Phase 4.3 Authorization Matrix

**Audit Basis:** Full source inspection of `apps/api/src` for `requireRole`, `requireAdminPermission`, `requireAnyAdminPermission`, `hasAnyAdminPermission`, and `roles.includes('ADMIN')`.

---

## 1. Admin Console & Operations Endpoints Closed in Phase 4.3

| Module                 | Endpoint                                                  | Previous Guard                               | Phase 4.3 Granular Guard & IDOR Controls                                                                                                                                                        | Authorized System Role(s)                                                                             |
| :--------------------- | :-------------------------------------------------------- | :------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **Lifecycle**          | `GET /api/v1/admin/users/:id/legal-holds`                 | `requireRole(['ADMIN'])`                     | `requireAdminPermission('users.privacy')` + verified target user existence (`404 NotFoundError`)                                                                                                | `USER_ADMIN`, `SUPER_ADMIN`                                                                           |
| **Lifecycle**          | `POST /api/v1/admin/users/:id/legal-holds`                | `requireRole(['ADMIN'])`                     | `requireAdminPermission('users.privacy')` + `users FOR UPDATE` row lock                                                                                                                         | `USER_ADMIN`, `SUPER_ADMIN`                                                                           |
| **Lifecycle**          | `DELETE /api/v1/admin/users/:id/legal-holds/:holdId`      | `requireRole(['ADMIN'])`                     | `requireAdminPermission('users.privacy')` + `expectedUserId` cross-user IDOR rejection (`404`)                                                                                                  | `USER_ADMIN`, `SUPER_ADMIN`                                                                           |
| **Lifecycle**          | `POST /api/v1/admin/privacy/requests/:id/execute`         | `requireRole(['ADMIN'])`                     | `requireAdminPermission('users.privacy')` + Stage A hard-stop (`403 STAGE_A_GOVERNANCE_BLOCKED` unless `PHASE_3B9_GOVERNANCE_APPROVED=true`) + transactional `assertNoActiveHolds`              | **BLOCKED** pending LDR sign-off (`USER_ADMIN`/`SUPER_ADMIN` otherwise)                               |
| **Community**          | `PATCH /api/v1/admin/community/posts/:id/moderate`        | `requireRole(['ADMIN'])`                     | `requireAdminPermission(['reports.resolve', 'reviews.moderate', 'projects.moderate'])` + service permission validation                                                                          | `TRUST_SAFETY_ADMIN`, `PLATFORM_ADMIN`, `SUPER_ADMIN`                                                 |
| **Community**          | `GET /api/v1/community/posts/:id` (hidden post exception) | `roles.includes('ADMIN')`                    | `hasAnyAdminPermission(user, ['reports.review', 'reports.resolve', 'reviews.moderate', 'projects.moderate'])`                                                                                   | `TRUST_SAFETY_ADMIN`, `PLATFORM_ADMIN`, `SUPER_ADMIN` (+ author)                                      |
| **Users**              | `PATCH /api/v1/admin/users/:id/status`                    | `requireRole(['ADMIN'])`                     | PreHandler `requireAdminPermission(['users.suspend', 'users.reactivate'])` + transition check (`ACTIVE` -> `users.reactivate`, else `users.suspend`) + lock-ordered last-active-admin safeguard | `USER_ADMIN`, `PLATFORM_ADMIN` (`suspend` only), `TRUST_SAFETY_ADMIN` (`suspend` only), `SUPER_ADMIN` |
| **Support (Staff)**    | `GET /api/v1/staff/support/tickets`                       | `requireRole(['ADMIN'])`                     | `requireAdminPermission('support.manage')`                                                                                                                                                      | `SUPPORT_ADMIN`, `PLATFORM_ADMIN`, `SUPER_ADMIN`                                                      |
| **Support (Staff)**    | `GET /api/v1/staff/support/tickets/:id`                   | `requireRole(['ADMIN'])`                     | `requireAdminPermission('support.manage')`                                                                                                                                                      | `SUPPORT_ADMIN`, `PLATFORM_ADMIN`, `SUPER_ADMIN`                                                      |
| **Support (Staff)**    | `PATCH /api/v1/staff/support/tickets/:id`                 | `requireRole(['ADMIN'])`                     | `requireAdminPermission('support.manage')`                                                                                                                                                      | `SUPPORT_ADMIN`, `PLATFORM_ADMIN`, `SUPER_ADMIN`                                                      |
| **Support (Staff)**    | `POST /api/v1/staff/support/tickets/:id/messages`         | `requireRole(['ADMIN'])`                     | `requireAdminPermission('support.reply')`                                                                                                                                                       | `SUPPORT_ADMIN`, `PLATFORM_ADMIN`, `SUPER_ADMIN`                                                      |
| **Support (Staff)**    | `POST /api/v1/staff/support/tickets/:id/notes`            | `requireRole(['ADMIN'])`                     | `requireAdminPermission('support.notes')`                                                                                                                                                       | `SUPPORT_ADMIN`, `PLATFORM_ADMIN`, `SUPER_ADMIN`                                                      |
| **Support (Staff)**    | `PATCH /api/v1/staff/support/tickets/:id/resolve`         | `requireRole(['ADMIN'])`                     | `requireAdminPermission('support.manage')`                                                                                                                                                      | `SUPPORT_ADMIN`, `PLATFORM_ADMIN`, `SUPER_ADMIN`                                                      |
| **Support (Customer)** | `GET /api/v1/support/tickets/:id/messages`                | `roles.includes('ADMIN')` (`isStaff` bypass) | `isStaff = hasAnyAdminPermission(user, ['support.manage', 'support.reply', 'support.notes'])` — prevents unrelated admins from reading other users' tickets or internal notes                   | Ticket owner (no internal notes) OR `SUPPORT_ADMIN`, `PLATFORM_ADMIN`, `SUPER_ADMIN`                  |
| **Support (Customer)** | `POST /api/v1/support/tickets/:id/resolve` & `/reopen`    | `roles.includes('ADMIN')` (`isStaff` bypass) | `isStaff = hasAnyAdminPermission(user, ['support.manage'])` — prevents unauthorized admins from resolving/reopening arbitrary customer tickets                                                  | Ticket owner OR `SUPPORT_ADMIN`, `PLATFORM_ADMIN`, `SUPER_ADMIN`                                      |

---

## 2. Previously Granular Admin Modules (Verified Unchanged)

- **Admin RBAC (`admin-rbac.routes.ts`)**: `admins.read` / `admins.manage`, `SUPER_ADMIN` last-role protection.
- **Admin Audit (`admin-audit.routes.ts`)**: `audit.read`.
- **Admin Finance (`admin-finance.routes.ts`)**: `payments.read`, `payments.refund.request`, `payments.refund.approve`, `payments.reconcile` (+ Four-Eyes anti-self-approval).
- **Admin Disputes / Moderation / Users / Marketplace / Config / Notifications / Jobs / Support (`/api/v1/admin/*`)**: All enforced via `requireAdminPermission(...)`.
- **Fail-Closed Auth Plugin (`apps/api/src/plugins/auth.ts`)**: Active DB role lookup on cache miss; Redis role-revocation invalidation verified immediately; `SUSPENDED` / `DEACTIVATED` accounts rejected with `403 USER_SUSPENDED` / `USER_DEACTIVATED`.

---

## 3. Consumer-Route `roles.includes('ADMIN')` Override Sites (Explicitly Tracked Residual)

The following non-`/admin` endpoints still check `roles.includes('ADMIN')` for legacy override/visibility compatibility with existing Phase 6 integration tests:

- `apps/api/src/modules/payments/payments.routes.ts` (`isAdmin` project ledger/escrow visibility bypass)
- `apps/api/src/modules/cancellations/cancellations.routes.ts` (`isAdmin` cancellation approval override)
- `apps/api/src/modules/projects/projects.routes.ts` & `reviews.routes.ts` (`isAdmin` visibility/moderation helper flag)
- `apps/api/src/modules/messaging/messaging.routes.ts` (`isAdmin` conversation access check)
- `apps/api/src/modules/profiles/profiles.routes.ts` (`isAdmin` hidden public profile preview)
- `apps/api/src/modules/lifecycle/account-lifecycle.service.ts` (`roleName === 'ADMIN'` check inside last-admin guard / status updates)

See [`PHASE_4_3_KNOWN_LIMITATIONS.md`](./PHASE_4_3_KNOWN_LIMITATIONS.md) for the staged follow-up plan.
