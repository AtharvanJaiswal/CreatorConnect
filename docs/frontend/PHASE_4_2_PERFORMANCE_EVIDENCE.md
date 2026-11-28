# CreatorConnect Phase 4.2 — Reproducible Performance & CWV Evidence

**Document Reference:** `docs/frontend/PHASE_4_2_PERFORMANCE_EVIDENCE.md`  
**Base Branch:** `dev` (baseline commit `fd12228ff787c5d9295e64d0dea4a4a77c532218`)  
**Measurement Environment:** Local Windows workstation (`Node v24.12.0`), PostgreSQL on `127.0.0.1:5433` (`audit_logs` table with >5,173 seeded rows + E2E test entries), Redis on `127.0.0.1:6379`, compiled Fastify server (`node apps/api/dist/main.js` on port `3000`), production Next.js server (`next start -p 3002` built cleanly in `3.1s`).

---

## 1. Core Web Vitals & CSP Remediation Before/After Comparison

| Metric / Route                    | Phase 4.1.2 Baseline                                  | Phase 4.2 Measured Result                                                        | Delta / Outcome                                                                                               |
| :-------------------------------- | :---------------------------------------------------- | :------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| **`/admin/audit` CLS**            | `0.4269` (`> 0.25` Poor threshold)                    | **`0.0156`** (`<= 0.1` Good threshold)                                           | **-96.3% layout shift** via 8 fixed-height `h-14` skeleton rows & `min-h-[440px]` wrapper in `AdminTable.tsx` |
| **External Google Font Requests** | `3` external `fonts.googleapis.com` requests per page | **`0`** external requests (`externalUrls: []`) across all 5 measured routes      | **100% eliminated**                                                                                           |
| **CSP Console Errors**            | `3` `style-src` CSP errors per page load              | **`0`** CSP console errors across all measured routes & Playwright `Journey 7.1` | **100% eliminated**                                                                                           |
| **`/admin/audit` Next Click**     | `55.77 ms`                                            | **`51.77 ms`** (`[aria-busy="true"]` detached after API response)                | Preserved sub-60ms local responsiveness                                                                       |

---

## 2. Production Next.js Build Bundle Telemetry (`next build`, Next.js 15.5.28)

- Total App Router routes compiled: **`25/25`** (`3.1s` compile time)
- Shared JS by all routes: **`102 kB`** (`chunks/168-6822c4f39f5c1ece.js` `46.2 kB`, `chunks/9432511c-35e124876dfb63f5.js` `54.2 kB`, other shared `2 kB`)
- Edge Middleware: **`34.3 kB`**
- Selected Route First Load JS:
  - `/admin/login`: `5.64 kB` route / `178 kB` First Load JS
  - `/admin/dashboard`: `6.99 kB` route / `113 kB` First Load JS
  - `/admin/audit`: `6.49 kB` route / `187 kB` First Load JS
  - `/admin/disputes`: `4.34 kB` route / `181 kB` First Load JS
  - `/admin/referrals`: `2.68 kB` route / `105 kB` First Load JS
  - `/admin/reconciliation`: `6.52 kB` route / `112 kB` First Load JS
  - `/admin/refunds`: `4.08 kB` route / `188 kB` First Load JS
  - `/admin/lifecycle`: `4.62 kB` route / `188 kB` First Load JS

---

## 3. Live Headless Chromium Runtime Measurements (`measure-perf.ts`)

Measured via headless Chromium `PerformanceNavigationTiming`, buffered `PerformanceObserver` (`paint`, `largest-contentful-paint`, `layout-shift`), and `resource` transfer sizes against `http://127.0.0.1:3002` after `networkidle` + `400ms` settle:

| Route              |   TTFB    | DOMContentLoaded | Load Event |   FCP   |   LCP    |     CLS      | JS Files / Transfer (kB) | Total Transfer (kB) |                          External Blocked / CSP Errors                           |
| :----------------- | :-------: | :--------------: | :--------: | :-----: | :------: | :----------: | :----------------------: | :-----------------: | :------------------------------------------------------------------------------: |
| `/admin/login`     | `5.9 ms`  |    `29.5 ms`     | `88.8 ms`  | `88 ms` | `88 ms`  |     `0`      |    `13` / `193.29 kB`    |     `207.86 kB`     |                                     `0 / 0`                                      |
| `/admin/dashboard` | `11.1 ms` |    `36.8 ms`     | `72.5 ms`  | `40 ms` | `148 ms` |   `0.0528`   |    `30` / `278.58 kB`    |     `324.28 kB`     | `0 / 0` (1 expected `403` console log for `USER_ADMIN` lacking `analytics.read`) |
| `/admin/audit`     | `3.5 ms`  |    `22.8 ms`     | `65.0 ms`  | `68 ms` | `136 ms` | **`0.0156`** |    `22` / `236.58 kB`    |     `267.48 kB`     |                                     `0 / 0`                                      |
| `/admin/disputes`  | `3.5 ms`  |    `27.7 ms`     | `73.5 ms`  | `32 ms` | `140 ms` |     `0`      |    `23` / `241.11 kB`    |     `272.21 kB`     |                                     `0 / 0`                                      |
| `/admin/referrals` | `2.9 ms`  |    `26.6 ms`     | `76.4 ms`  | `32 ms` | `152 ms` |     `0`      |    `22` / `236.58 kB`    |     `265.37 kB`     |                                     `0 / 0`                                      |

_Note on `/admin/dashboard`_: `measure-perf.ts` authenticates as `USER_ADMIN` (which holds `audit.read` and `users.read`, not `analytics.read`). Accordingly, `/api/v1/admin/dashboard/overview` returned HTTP `403`, logged 1 browser `403 (Forbidden)` resource message, and rendered `<AdminErrorBanner>` cleanly (`0.0528` CLS — still within Good `<= 0.1` threshold).

---

## 4. Live Local Fastify API Keyset Latency (`GET /api/v1/admin/audit?limit=25`)

Sequential benchmark after 5 warm-up calls (`N = 30` authenticated requests each, HTTP `200` on all 60 calls):

| Benchmark Case                                      | Samples (`N`) |    Min    |    p50    |    p95    |    p99    |    Max    |
| :-------------------------------------------------- | :-----------: | :-------: | :-------: | :-------: | :-------: | :-------: |
| **Page 1 (`limit=25`, no cursor)**                  |     `30`      | `5.16 ms` | `5.89 ms` | `8.24 ms` | `8.28 ms` | `8.28 ms` |
| **Deep Keyset Cursor (`offset ~4000`, `limit=25`)** |     `30`      | `5.20 ms` | `5.92 ms` | `8.02 ms` | `8.85 ms` | `8.85 ms` |

---

## 5. Font Fallback & Accessibility Implementation Notes

- System sans-serif, heading, and monospace stacks in `apps/web-shell/src/styles/admin.css` use `font-size-adjust: from-font` and eliminate render-blocking/CSP-violating external CSS `@import` requests.
- `AdminTable.tsx` uses `<div role="region" aria-label="..." tabIndex={0} className="... min-h-[440px]">`, semantic `<th scope="col">`, `aria-busy={isLoading}`, and `motion-reduce:animate-none` on 8 fixed-height `h-14` loading skeleton rows (`data-testid="admin-table-skeleton-row"`).
- **Explicitly Unmeasured Metrics**: Hardware `INP` (Lighthouse / Web Vitals field telemetry across mobile CPU throttling) and synthetic multi-million-row `audit_logs` loads remain unmeasured locally; composite `(created_at DESC, id DESC)` index deferred because schema migrations are prohibited in Phase 4.2.
