# CreatorConnect — Phase 4.3 Known Limitations & Residual Risks

**Transparency Standard:** All known environment boundaries, unaddressed UI polish items, and deferred architecture tasks are itemized below.

---

## 1. Environmental & Test-Isolation Boundaries

1. **Docker `creatorconnect-worker` Contention During `apps/realtime` Cluster Spec:**
   - In the local development environment, running `pnpm --filter @creatorconnect/realtime exec vitest run` while the persistent `creatorconnect-worker` Docker container was concurrently polling shared PostgreSQL `outbox_events` and Redis caused **3 of 7 tests** in `apps/realtime/src/cluster-integration.spec.ts` to time out / miss local worker event consumption (`38/41` passed across `4` files in `@creatorconnect/realtime`). Reproducing `cluster-integration.spec.ts` in CI requires an isolated ephemeral test environment without an external background worker competing for test queue events.
2. **Legacy Pre-4.0 E2E Suites:**
   - Non-admin E2E files in `tests/e2e/` (`brand-*`, `messaging-*`, `milestone-2e*`, `module-c*`, `profile-*`) test creator/brand web routes that were intentionally removed/redirected to `/admin/login` in Phase 4.0 and were not executed in Phase 4.3.
3. **Pre-Existing Repo-Wide Prettier Drift (`72` Untouched Legacy Files):**
   - Phase 4.3 remediated all 5 Phase 4.2 TS/TSX formatting warnings plus every Phase 4.3 file; untouched legacy files across `docs/admin`, `docs/compliance`, older API modules, and Phase 4.1 docs still carry pre-existing formatting drift and were left untouched to keep diff scope minimal and clean.
4. **Vitest Parallel JIT Timeout on `community-support.spec.ts`:**
   - Inside `apps/web-shell`, running all 26 test files concurrently with default worker pool contention triggered a `5008ms` cold-start AJV/TypeBox schema compile timeout in `community-support.spec.ts` (`1/315`); running cleanly standalone (`25/25`) and with `--no-file-parallelism` (`315/315`) passes reliably.

---

## 2. Architecture, Security & UI Residuals

1. **Legacy Consumer-Route `roles.includes('ADMIN')` Overrides (`7` Files):**
   - Existing creator/brand-facing modules (`payments.routes.ts`, `cancellations.routes.ts`, `projects.routes.ts`, `reviews.routes.ts`, `messaging.routes.ts`, `profiles.routes.ts`, `account-lifecycle.service.ts`) retain `roles.includes('ADMIN')` bypass/visibility flags for backward compatibility with existing Phase 6 integration tests (`PLATFORM_ADMIN` / bare `ADMIN` test fixtures). Tracked for targeted domain-by-domain cleanup in a dedicated backward-compatible API milestone.
2. **Non-Applied Database Indexes (`audit_logs`):**
   - Read-only `EXPLAIN (ANALYZE, BUFFERS)` benchmarks confirmed `audit_logs` lacks composite `(created_at DESC, id DESC)`, `(action, created_at DESC, id DESC)`, and `(user_id, created_at DESC, id DESC)` indexes (causing `Incremental Sort` and `130` filtered-out rows on action queries). Index DDL is proposed in [`PHASE_4_3_DATABASE_QUERY_REVIEW.md`](./PHASE_4_3_DATABASE_QUERY_REVIEW.md) but intentionally **not applied** without migration authorization.
3. **Mobile Viewport Admin Shell Overflow (`390x844`) & `/admin/refunds` Borderline CLS (`0.1011`):**
   - Admin Console `AdminSidebar.tsx:212` uses a fixed `w-64` (`256px`) sticky sidebar without a mobile drawer, causing `499–529px` horizontal width on WebKit/Chromium `390x844` mobile emulations. `/admin/refunds` measured `CLS = 0.1011` on Chromium desktop during initial async table hydration.
   - **No Real Device or Field CrUX Data:** All Web Vitals are headless lab captures on `127.0.0.1`.
4. **Phase 3B.9 Erasure Governance Remains Blocked:**
   - Legal Decision Register approvals remain `0/12`; `POST /api/v1/admin/privacy/requests/:id/execute` returns `403 STAGE_A_GOVERNANCE_BLOCKED` and Migration `0014` remains unapplied.
5. **Dev-Only Dependency Advisories (`pnpm audit`):**
   - While `pnpm audit --prod` passes with **0 vulnerabilities**, dev/test tooling still reports 22 advisories in `vitest@2.1.9`, `vite@5.4.21`, `@testcontainers`, and `minimatch@9.0.9`.
6. **Legacy `/admin/login` Email/Password Auth Flow & Test Token Helper:**
   - Browser E2E injects `ES256` JWTs signed for local `jwks-stub`; live Supabase Auth email/password login flow and MFA remain external staging/prod verification items.
