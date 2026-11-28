# CreatorConnect Phase 4.1.2 — Known Limitations, Pre-Existing Defects & Next Backlog

**Document Reference:** `docs/frontend/PHASE_4_1_2_KNOWN_LIMITATIONS.md`  
**Branch:** `dev` (`fd12228ff787c5d9295e64d0dea4a4a77c532218`)  
**Policy:** Transparent engineering accounting of every open defect, pre-existing gap, unverified condition, and Phase 4.2 prerequisite observed during Phase 4.1.2.

---

## 1. Release-Relevant Limitations & Pre-Existing Gaps

### 1.1. 16 Pre-Existing Admin Pages Still Contain Mock Fallback Data on API Errors

- **Affected Files**: `apps/web-shell/src/app/admin/{dashboard,users,users/[id],verification,assignments,payments,refunds,reconciliation,moderation,reviews,support,config,notifications,jobs,admins,roles}/page.tsx`.
- **Impact**: If an admin lacks a module permission (`403`) or the backend fails (`500`), these pre-existing pages catch the exception and display hardcoded placeholder tables/cards rather than explicit error alerts (unlike `/admin/audit` and `/admin/disputes`, which now fail honestly with retry prompts).
- **Resolution**: Out of scope for Phase 4.1.2 (preserved untouched pre-existing developer code); schedule removal in Phase 4.2.

### 1.2. Pre-Existing Financial UI Contract Mismatches (`/admin/refunds` & `/admin/reconciliation`)

- **`/admin/refunds` (`apps/web-shell/src/app/admin/refunds/page.tsx:92-96`)**: Posts `{ paymentId, amountMinor: String(...), reason }` without required `notes`, whereas backend `CreateRefundRequestSchema` (`packages/contracts/src/admin.ts:664-675`) requires `{ paymentIntentId: UuidSchema, amountMinor: Integer, reason, notes: String(min 5) }`. In addition, `refunds/page.tsx` checks `selectedRefund.requestedById`, whereas `AdminRefundListItemSchema` returns `refundedById` and `refundedByEmail`.
- **`/admin/reconciliation` (`apps/web-shell/src/app/admin/reconciliation/page.tsx:16-28`)**: Expects `isBalanced`, `auditedAt`, `totalDebitMinor`, `totalCreditMinor`, `discrepancyCount`, `auditedAccountsCount`, whereas backend `GET /api/v1/admin/reconciliation` returns `status: 'BALANCED' | 'UNBALANCED'`, `checkedAt`, `totalDebitsMinor`, `totalCreditsMinor`, `netDifferenceMinor`, `totalAccounts`.

### 1.3. Client-Side `PermissionGate.tsx` Bypass Due to Minimal `/api/v1/users/me` DTO

- **Details**: `apps/api/src/modules/users/users.service.ts` (`GET /api/v1/users/me`) omits `adminRoles` and `adminPermissions` from `UserResponse`. `PermissionGate.tsx:34` falls back to treating any user with global role `'ADMIN'` and empty `adminPermissions` as UI-visible.
- **Risk**: Low server risk (backend `requireAdminPermission` strictly returns `403` and leaks zero data), medium UX impact (e.g., `SUPPORT_ADMIN` sees `/admin/audit` mount and display a `403` error alert instead of a clean locked UI gate).

### 1.4. `/admin/audit` Cumulative Layout Shift (`CLS = 0.4269`)

- `AdminTable.tsx:54-62` replaces the 25-row body with a single compact loading row while fetching, causing a `0.4269` layout shift when rows render. Reserving fixed table body height / skeleton rows will fix this in Phase 4.2.

### 1.5. External Google Fonts Blocked by Middleware CSP

- `apps/web-shell/src/app/layout.tsx` declares 3 `https://fonts.googleapis.com/css2?...` links while `apps/web-shell/src/middleware.ts` enforces `style-src 'self' 'unsafe-inline'` and `font-src 'self' data:`, resulting in 3 CSP console errors per page load and fallback system fonts.

### 1.6. Full `apps/api` Suite PostgreSQL Connection Exhaustion (`P2037`)

- Running all 55 API test files sequentially (`pnpm --filter @creatorconnect/api test`) triggers `PrismaClientKnownRequestError [P2037]: FATAL: sorry, too many clients already` during late-running specs (`users.spec.ts`, `admin-dashboard.spec.ts` -> 7/680 tests returning HTTP 500), even though those 2 specs pass `15/15` when run standalone and `src/modules/admin` passes `79/79`. Test suites instantiating ad-hoc `PrismaClient` connections need deterministic shared client reuse / cleanup.

### 1.7. Unsanitized Metadata in Pre-Existing User Activity Endpoint

- `GET /api/v1/admin/users/:id/activity` (`apps/api/src/modules/admin/users/admin-users.service.ts:238, 339`) returns raw `AuditLog.metadata` without `sanitizeAuditMetadata()`, whereas `GET /api/v1/admin/audit` enforces full deep sanitization.

### 1.8. Unimplemented / Static Features & Missing Composite DB Index

- **`/admin/referrals`**: Planned feature with no backend schema/endpoints (safely displays `Planned Feature`).
- **`/admin/lifecycle`**: Static hardcoded `legalHolds` array (`FRONTEND ONLY`; backend privacy/retention APIs exist separately per user).
- **`audit_logs` Composite Index**: `audit_logs` currently has single-column `created_at` index (`audit_logs_created_at_idx`) and PK `id`, not `(created_at DESC, id DESC)`. Bounded `created_at <= cursor.createdAt` already eliminates the 4,001-row scan overhead on 5k rows; adding a composite `(created_at DESC, id DESC)` index should be included in a future migration when `audit_logs` scales to millions of rows or heavy millisecond timestamp collisions.
- **Prettier Format Check Debt**: `pnpm format:check` warns on 63 pre-existing backend, seed, compliance, and old documentation files (`app-error.ts`, `admin/*.service.ts`, `docs/admin/*`, `docs/compliance/*`, `docs/frontend/PHASE_4_1_*.md`, `seed.ts`). All newly added/edited Phase 4.1.2 files pass Prettier cleanly.

---

## 2. Explicit Scope Boundaries Not Exercised Here

- Real Supabase cloud `signInWithPassword` flow (Playwright used local asymmetric ES256 JWKS stub + `ApiClient` / `AuthProvider` token wiring).
- Cross-browser Firefox / WebKit E2E runs (`playwright.config.ts` enables them in CI only).
- Multi-million-row synthetic table load test (all Postgres plans measured against the actual `5,173` rows currently in local `audit_logs`).
- Production deployment, Kubernetes/Docker load testing, and remote database modifications.
