# CreatorConnect — Phase 4.3 Staging Readiness Checklist

**Target Promotion Boundary:** Controlled Staging Verification (after human PR review & authorization; **NOT** automated production deployment)  
**Pre-Requisites:** Phase 4.3 code reviewed and merged via authorized PR -> Staging DB backup snapshot taken before any schema/index changes.

---

## 1. Environment & Secret Configuration Gates (Staging)

- [ ] **API (`apps/api`)**:
  - `NODE_ENV=production`
  - `CORS_ORIGIN` configured explicitly to the staging Admin Web Console origin (`https://admin-staging.<domain>` — never `*` or empty; enforced by SEC-02 boot guard in `app.ts`)
  - `SUPABASE_JWT_ISSUER` set to HTTPS Supabase issuer (`https://<project-ref>.supabase.co/auth/v1` — enforced by `JwtVerifier`)
  - `SUPABASE_JWKS_URL` set to HTTPS JWKS endpoint; `ALLOW_HTTP_JWKS` **unset / false** (`jwt-verifier.ts` rejects HTTP JWKS in prod)
  - **`PHASE_3B9_GOVERNANCE_APPROVED`** remains **`false` / unset** unless formal Legal Decision Register (`0/12 -> 12/12`) sign-off has been granted for destructive erasure
- [ ] **Web Shell (`apps/web-shell`)**:
  - `NODE_ENV=production`
  - `API_URL` / `NEXT_PUBLIC_API_URL` configured for Next.js `/api/*` rewrite target to internal API URL
  - Reverse proxy terminates TLS cleanly and forwards `X-Forwarded-Proto: https` so `middleware.ts` activates `upgrade-insecure-requests` & `Strict-Transport-Security`
  - Confirm `Cache-Control: private, no-store, max-age=0` is NOT overridden by CDN/CloudFront/Cloudflare edge caching rules on HTML pages (`/admin/*`)

---

## 2. Database & Online Index Rollout Verification (Staging DB Only)

- [ ] Confirm migrations `0001` through `0015` are applied cleanly (`prisma migrate status`).
- [ ] **Optional High-Scale Audit Indexes (Non-Applied Proposal):** If `audit_logs` exceeds ~100k rows on staging/prod, schedule online `CREATE INDEX CONCURRENTLY` outside a transaction block:
  - `audit_logs_created_at_id_desc_idx` `(created_at DESC, id DESC)`
  - `audit_logs_action_created_at_id_desc_idx` `(action, created_at DESC, id DESC)`
  - `audit_logs_user_id_created_at_id_desc_idx` `(user_id, created_at DESC, id DESC)`
- [ ] Confirm **at least one** `SUPER_ADMIN` account is provisioned in staging (`admin_user_roles`), matching an active Supabase Auth admin identity (`users.supabase_auth_id`).
- [ ] Keep Phase 3B.9 Migration `0014` **BLOCKED / UNAPPLIED** until executive/legal Stage A approval is recorded.

---

## 3. Staging Smoke Verification Protocol

1. **Health & Boot Guards:** Verify `GET /health` returns HTTP `200` on API (`dist/main.js`) and `GET /` on `web-shell` redirects `307 -> /admin/login` with strict security headers.
2. **CSP Nonce Validation (Curl + Browser DevTools):**
   - Request `/admin/login` twice over HTTPS: verify two distinct cryptographic `'nonce-...'` tokens, `'strict-dynamic'`, absence of `'unsafe-inline'` and `'unsafe-eval'` in `script-src`, presence of `upgrade-insecure-requests` and `Strict-Transport-Security`, and `Cache-Control: private, no-store, max-age=0`.
3. **RBAC Negative Probe:** Sign in as `SUPPORT_ADMIN` and confirm `/admin/audit`, `/admin/refunds`, and `/admin/users/:id/legal-holds` deny UI/API cleanly (`403`).
4. **Dual-Approval Concurrency Smoke:** Verify high-value staging test refund (`>= 50,000 INR`) blocks self-approval (`403 CONFLICT_OF_INTEREST`) and handles `Idempotency-Key` retries without duplicate ledger postings.
5. **Lifecycle Stage A Hard-Stop Check:** Verify `POST /api/v1/admin/privacy/requests/:id/execute` returns HTTP `403 STAGE_A_GOVERNANCE_BLOCKED`.
6. **Observability & Pino Redaction Check:** Inspect staging API JSON logs for a test request and verify `authorization`, `cookie`, `token`, `secret`, and `password` fields are absent/removed.

---

## 4. Rollback Plan

- **Application Rollback:** Redeploy previous container image (`git` artifact prior to Phase 4.3 merge). Because **zero** schema migrations were executed in Phase 4.3, rollback requires zero destructive DB down-migrations; all cursor extensions (`f` field) and optional `Idempotency-Key` headers are strictly backward compatible.
