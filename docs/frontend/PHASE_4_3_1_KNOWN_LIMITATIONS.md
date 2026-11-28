# CreatorConnect — Phase 4.3.1 Known Limitations & Residual Risks

**Transparency Boundary:** Items listed below were observed directly during Phase 4.3.1 stabilization and remain intentionally outside authorized remediation scope.

---

## 1. Environment & Test Boundary Residuals

1. **Shared Database Contention Across Unserialized Local Test Runs:**
   - Although `turbo.json` now serializes `@creatorconnect/realtime#test` after `@creatorconnect/worker#build` and `@creatorconnect/worker#test`, running `@creatorconnect/api` messaging specs (`4` files executing global `prisma.outboxEvent.deleteMany({})`) or standalone `@creatorconnect/worker` tests in a separate shell concurrently against the same `creatorconnect_dev` PostgreSQL database will still clear/claim outbox rows needed by `cluster-integration.spec.ts`. Similarly, the local `creatorconnect-worker` Docker container runs an older image (`WorkerSupervisor` + `CleanupScheduler` only); if rebuilt with an active `OutboxProcessor` against `creatorconnect_dev`, it must be paused during `cluster-integration.spec.ts` or isolated via ephemeral CI DBs.
2. **Legacy Pre-4.0 Consumer E2E Suites:**
   - Pre-4.0 creator/brand E2E suites under `tests/e2e/` (`brand-*`, `messaging-*`, `milestone-*`, `module-*`, `profile-*`) target routes intentionally redirected server-side to `/admin/login` in Phase 4.0 and were not executed.
3. **Lab Measurements vs Real Device & Field CrUX Telemetry:**
   - All Core Web Vitals (`CLS`, `LCP`, `FCP`, `TTFB`) and mobile viewport checks (`320px–430px`) were measured via headless Chromium, Firefox, and WebKit against `127.0.0.1`. Physical mobile hardware and production Chrome User Experience Report (CrUX) field data remain unmeasured until staging/production rollout.
4. **Vitest Parallel JIT Timeout on `community-support.spec.ts` & Residual `@test.invalid` Rows:**
   - `@creatorconnect/web-shell` Vitest requires `--no-file-parallelism` locally to prevent AJV/TypeBox cold-start timeout in `community-support.spec.ts` (`315/315` pass reliably with `--no-file-parallelism`).
   - Local `creatorconnect_dev` `users` still holds `555` residual `@test.invalid` accounts from repeated Vitest runs; untouched in Phase 4.3.1 per non-mutation constraint.
5. **Pre-Existing Untouched Prettier Drift & Dev-Only Dependency Advisories:**
   - Untouched legacy files across pre-Phase 4.3 docs/modules retain pre-existing formatting drift; all files touched in Phase 4.3.1 pass Prettier.
   - `pnpm audit --prod` passes with **`0` vulnerabilities**, while dev/test dependencies retain non-shipped advisories (`vitest`, `vite`, `@testcontainers`, `minimatch`).

---

## 2. Security, Governance & Schema Residuals

1. **Legacy Consumer-Route `roles.includes('ADMIN')` Overrides (`7` Files):**
   - Maintained intentionally for backward compatibility with Phase 6 consumer tests across `payments.routes.ts`, `cancellations.routes.ts`, `projects.routes.ts`, `reviews.routes.ts`, `messaging.routes.ts`, `profiles.routes.ts`, and `account-lifecycle.service.ts`.
2. **Stage A Privacy Gate Guard Surface (`PHASE_3B9_GOVERNANCE_APPROVED`):**
   - HTTP route [`lifecycle.routes.ts#L484`](file:///f:/CreatorConnect/apps/api/src/modules/lifecycle/lifecycle.routes.ts#L484) blocks all calls with `403 STAGE_A_GOVERNANCE_BLOCKED` (`0/12` LDR approved), and [`apps/worker`](file:///f:/CreatorConnect/apps/worker/src/main.ts) has no erasure consumer, **but `DataErasureOrchestrator.executeErasure()` lacks an internal DB-backed governance check and blocked attempts do not persist an `AuditLog` row**. Requires DB-signed approval governance before Phase 3B.9 activation.
3. **Unapplied PostgreSQL Indexes & Migrations:**
   - Proposed composite `audit_logs` indexes (`PHASE_4_3_DATABASE_QUERY_REVIEW.md`) and Migration `0014` remain unapplied pending formal DBA/governance sign-off.
4. **Live Supabase Email/Password Login & MFA in Staging:**
   - Browser E2E uses `ES256` JWTs signed for local `jwks-stub` (`test-key-01`). Live Supabase Auth login, MFA enforcement, TLS `HSTS` / `upgrade-insecure-requests` header verification, and CORS origin restrictions must be smoke-tested on staging.
