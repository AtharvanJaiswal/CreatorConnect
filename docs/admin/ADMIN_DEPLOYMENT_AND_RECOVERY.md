# CreatorConnect: Admin Deployment, Seeding & Disaster Recovery Guide

Authoritative deployment, database seeding, operational runbooks, and recovery procedures for the CreatorConnect administration plane.

---

## 1. Environment Configuration

The administration module utilizes the unified environment configuration of `apps/api`:

| Variable                       | Description                            | Required? | Default / Notes                    |
| :----------------------------- | :------------------------------------- | :-------- | :--------------------------------- |
| `DATABASE_URL`                 | PostgreSQL connection pool URL         | Yes       | Must target PostgreSQL 16+         |
| `REDIS_URL`                    | Redis instance for cache & BullMQ      | Yes       | Used for 60s analytics caching     |
| `SUPABASE_URL`                 | Supabase project URL                   | Yes       | Used for JWKS identity discovery   |
| `SUPABASE_JWT_SECRET`          | Supabase JWT secret                    | Yes       | Used for token validation fallback |
| `ADMIN_REFUND_THRESHOLD_PAISA` | Dual-approval threshold in minor units | No        | Defaults to `5000000` (₹50,000)    |

---

## 2. Database Migration & Baseline Seeding

### 2.1 Applying Migration 0015

```bash
pnpm --filter @creatorconnect/database run db:migrate:deploy
```

This safely creates:

- `admin_roles`, `admin_permissions`, `admin_role_permissions`, `admin_user_roles`
- `admin_action_approvals`
- `platform_settings`, `platform_setting_audits`
- `notification_campaigns`

### 2.2 Seeding Permissions and Default System Roles

The seed script `packages/database/prisma/seed.ts` is idempotent and seeds all 21 administrative permissions and 8 standard roles:

```bash
pnpm --filter @creatorconnect/database run db:seed
```

Standard roles provisioned:

1. `SUPER_ADMIN`: Root authority with wildcard `*`.
2. `PLATFORM_ADMIN`: Operational administration across users, projects, support, settings.
3. `USER_ADMIN`: User directory, suspension, reactivation, export.
4. `FINANCE_ADMIN`: Payments reading, refund request/approval, ledger reconciliation.
5. `TRUST_SAFETY_ADMIN`: Reports resolution, account penalties, review moderation.
6. `SUPPORT_ADMIN`: Customer service inquiries, assignments, and public replies.
7. `CONTENT_MODERATOR`: Content reviews and marketplace project inspection.
8. `ANALYTICS_VIEWER`: Read-only operational metrics and financial dashboard.

---

## 3. Disaster Recovery & Emergency Runbooks

### 3.1 Emergency Break-Glass Super Admin Provisioning

In the event all active Super Administrators are lost, locked out, or corrupted, the database administrator can execute the break-glass SQL script using authoritative database credentials:

```sql
BEGIN;

-- 1. Ensure global ADMIN role is mapped
INSERT INTO "user_roles" ("id", "user_id", "role_id")
SELECT
    gen_random_uuid(),
    u.id,
    r.id
FROM "users" u, "roles" r
WHERE u.email = 'emergency-admin@creatorconnect.in'
  AND r.name = 'ADMIN'
ON CONFLICT DO NOTHING;

-- 2. Map SUPER_ADMIN role
INSERT INTO "admin_user_roles" ("id", "user_id", "role_id")
SELECT
    gen_random_uuid(),
    u.id,
    ar.id
FROM "users" u, "admin_roles" ar
WHERE u.email = 'emergency-admin@creatorconnect.in'
  AND ar.name = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- 3. Log emergency break-glass action
INSERT INTO "audit_logs" ("id", "user_id", "action", "entity", "entity_id", "metadata")
SELECT
    gen_random_uuid(),
    u.id,
    'EMERGENCY_BREAK_GLASS_SUPER_ADMIN_PROVISIONED',
    'User',
    u.id,
    jsonb_build_object('reason', 'Disaster recovery break-glass procedure executed by DBA')
FROM "users" u
WHERE u.email = 'emergency-admin@creatorconnect.in';

COMMIT;
```

### 3.2 Platform Setting Rollback via CLI

If a bad setting is deployed that impacts live customers:

```bash
# Direct API invocation using an administrative token:
curl -X POST https://api.creatorconnect.in/api/v1/admin/settings/video.transcode.codec/rollback \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetVersion": 1, "reason": "Immediate incident mitigation: rolling back codec switch"}'
```
