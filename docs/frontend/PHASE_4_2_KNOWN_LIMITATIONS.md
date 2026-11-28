# CreatorConnect Phase 4.2 — Known Limitations & Deferred Scope Register

**Document Reference:** `docs/frontend/PHASE_4_2_KNOWN_LIMITATIONS.md`  
**Base Branch:** `dev` (baseline commit `fd12228ff787c5d9295e64d0dea4a4a77c532218`)  
**Policy:** Transparent engineering accounting of deferred migrations, pre-existing code outside Phase 4.2 remediation scope, unmeasured telemetry bounds, and Stage A governance prerequisites.

---

## 1. Stage A Governance & Blocked Product Areas

### 1.1. Phase 3B.9 Lifecycle & Erasure Workflows Remain `BLOCKED`

- **Status**: `0/12` Legal & Compliance Decision Register (LDR) approvals exist in the repository (`docs/compliance/PHASE_3B_9_APPROVAL_GAP_REPORT.md`).
- **UI State (`/admin/lifecycle`)**: Phase 4.2 enables verified **per-user Legal Hold inspection, creation, and release** (`GET/POST/DELETE /api/v1/admin/users/:id/legal-holds`) and read-only `User` audit log viewing (`GET /api/v1/admin/audit?entity=User`). Unapproved features — **Global Privacy Erasure Request Queue**, **Retention Policy Matrix**, **Automated Batch Purge Execution**, and **Media Purge Triggers** — remain explicitly marked `BLOCKED` with zero synthetic records or unsafe mutation buttons.

### 1.2. Referrals & Affiliate Operations (`/admin/referrals`)

- **Status**: Remains `Planned Feature` with zero backend Prisma models, routes, or network requests until referral domain contracts are authored and approved.

---

## 2. Database & Infrastructure Constraints (No-Migration Policy)

### 2.1. Deferred `audit_logs` Composite Index

- `audit_logs` retains single-column indexes (`audit_logs_created_at_idx`, `audit_logs_action_idx`, `audit_logs_user_id_idx`, PK `id`) without a composite `(created_at DESC, id DESC)` index because schema migrations are prohibited in Phase 4.2.
- Bounded keyset filtering (`createdAt: { lte: decodedCursor.createdAt }`) keeps local latency at ~5.9 ms p50 (`8.02 ms` p95 at offset ~4,000 across >5,173 rows); a future migration should add `(created_at DESC, id DESC)` before multi-million-row growth.

### 2.2. Fixed 25-Permission RBAC Catalog

- Because adding new permissions requires database seed/migration updates (`No migrations`), Disputes RBAC reuses existing seeded permissions (`projects.moderate`, `reports.resolve`, `payments.refund.approve` for mutations; plus `reports.review`, `payments.read` for read) rather than introducing a dedicated `disputes.*` permission namespace. Consequently, `SUPPORT_ADMIN` (`projects.read`) is excluded from dispute list/detail/resolution, while roles carrying `projects.moderate` or `reports.resolve` retain dispute access.

---

## 3. Residual Security & Formatting Items Outside Phase 4.2 Scope

### 3.1. Three Pre-Existing Routes Retaining `requireRole(['ADMIN'])`

The following pre-existing routes outside the remediated admin/disputes modules still enforce global `RoleType.ADMIN` rather than granular permissions and were left backward-compatible with existing tests/specs:

1. `/api/v1/admin/users/:id/legal-holds*` and `/api/v1/admin/privacy/requests/:id/execute` (`apps/api/src/modules/lifecycle/lifecycle.routes.ts`) — mitigated in the console via `admin/layout.tsx` (blocks bare `ADMIN`) and `<PermissionGate permission="users.privacy">` on `/admin/lifecycle`.
2. `/api/v1/admin/community/posts/:id/moderate` (pre-existing community moderation handler).
3. `/api/v1/admin/users/:id/status` (legacy admin status route; `/admin/users` and `/admin/users/[id]` exclusively call `/suspend` and `/reactivate` guarded by `users.suspend` and `users.reactivate`).

### 3.2. CSP `script-src` Inline Allowance (`apps/web-shell/src/middleware.ts`)

- While all external Google Fonts `<link>` / `@import` dependencies and `style-src` CSP violations are **eliminated (`0` external requests, `0` console CSP errors)**, `middleware.ts` continues to allow `'unsafe-inline'` in `script-src` (and `'unsafe-eval'` outside non-nonce SSR config) until per-request Next.js CSP nonces are adopted repo-wide.

### 3.3. Prettier Formatting Debt

- All six Phase 4.2 markdown reports (`docs/frontend/PHASE_4_2_*.md`) pass `pnpm exec prettier --check` cleanly.
- Five Phase 4.2 modified/added TypeScript files (`packages/auth/src/abilities.ts`, `apps/api/src/modules/admin/rbac/admin-rbac.repository.ts`, `apps/web-shell/src/lib/admin-finance-helpers.ts`, `apps/web-shell/src/components/admin/ui/PermissionGate.tsx`, `apps/web-shell/src/components/admin/ui/AdminTable.tsx`) carry non-functional line-wrapping style warnings left unedited after the final build/test runs so no verified source code was altered, alongside pre-existing repository formatting debt across historical docs and backend files.

---

## 4. Test & Runtime Environment Scope Boundaries

- **Authentication Fixture vs Live Cloud Supabase**: Automated unit, integration, and Chromium E2E runs authenticate using the local asymmetric ES256 JWKS server (`127.0.0.1:8080`, `ALLOW_HTTP_JWKS=true`); live Supabase cloud `signInWithPassword` flows were not exercised against external cloud credentials.
- **Single-Browser & Unmeasured Telemetry**: E2E verification targeted local headless Chromium (`--project=chromium`); Firefox/WebKit runs, Kubernetes/cluster load tests, and field/Lighthouse mobile-throttled hardware `INP` remain unmeasured locally.
- **Unmodified Consumer/Mobile Surfaces**: Non-admin mobile screens/APIs and Phase 3B.9 background worker erasure paths were intentionally left unmodified per Phase 4.2 scope boundaries.
