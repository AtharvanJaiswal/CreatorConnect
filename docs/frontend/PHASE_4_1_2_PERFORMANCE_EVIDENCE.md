# CreatorConnect Phase 4.1.2 — Reproducible Performance & Database Evidence

**Document Reference:** `docs/frontend/PHASE_4_1_2_PERFORMANCE_EVIDENCE.md`  
**Branch:** `dev` (`fd12228ff787c5d9295e64d0dea4a4a77c532218`)  
**Environment Scope:** All timings below were measured on the **local development workstation** (Windows, Node `v24.12.0`, PostgreSQL on `127.0.0.1:5433` with `5,173` seeded `audit_logs` rows, Redis on `127.0.0.1:6379`, compiled `node apps/api/dist/main.js`, production `next start -p 3002`). They are not production-cluster SLAs.

---

## 1. PostgreSQL Schema, Indexes & Real `EXPLAIN (ANALYZE, BUFFERS)` Plans

### 1.1. Verified `audit_logs` Table & Index Inventory

Query against local PostgreSQL (`5,173` rows):

- `audit_logs_pkey`: `CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id)`
- `audit_logs_action_idx`: `CREATE INDEX audit_logs_action_idx ON public.audit_logs USING btree (action)`
- `audit_logs_created_at_idx`: `CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at)`
- `audit_logs_user_id_idx`: `CREATE INDEX audit_logs_user_id_idx ON public.audit_logs USING btree (user_id)`

> **Note:** No composite `(created_at DESC, id DESC)` index currently exists in `schema.prisma`.

### 1.2. Measured Query Plans (`audit_logs`, `N = 5,173` rows, cursor anchor at offset 4,000)

| Query Strategy                                                                | Postgres Plan Summary                                                                        | Rows Removed by Filter |          Buffers (`shared hit`)           | Planning Time | Execution Time |
| :---------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- | :--------------------: | :---------------------------------------: | :-----------: | :------------: |
| **Page 1 (`ORDER BY created_at DESC, id DESC LIMIT 26`)**                     | `Limit -> Incremental Sort -> Index Scan Backward using audit_logs_created_at_idx`           |          `0`           | `10` (`7` index/heap + `3` sort overhead) |  `0.198 ms`   |   `0.130 ms`   |
| **Phase 4.1.2 Bounded Keyset (`created_at <= $1 AND (...)`) at Offset 4,000** | `Index Scan Backward using audit_logs_created_at_idx` with `Index Cond: (created_at <= ...)` |        **`1`**         |                  **`7`**                  |  `0.552 ms`   | **`0.121 ms`** |
| **Pre-Fix Unbounded Keyset (`(created_at < $1) OR (...)`) at Offset 4,000**   | `Index Scan Backward using audit_logs_created_at_idx` scanning all newer rows via filter     |        `4,001`         |                   `372`                   |  `0.120 ms`   |   `1.195 ms`   |
| **Naive `OFFSET 4000 LIMIT 26`**                                              | `Incremental Sort` (`quicksort`, `32kB`) reading 4,027 rows                                  | N/A (`4,000` skipped)  |                   `372`                   |  `0.072 ms`   |   `2.323 ms`   |

Adding the single inequality predicate `createdAt: { lte: decodedCursor.createdAt }` in `apps/api/src/modules/admin/audit/admin-audit.service.ts` changed PostgreSQL's plan from scanning `4,001` newer rows (`372` buffers) to a direct backward index seek (`7` buffers, ~10x faster execution at offset 4,000; ~19x faster than `OFFSET 4000`).

---

## 2. Live Local Fastify API Latency (`GET /api/v1/admin/audit?limit=25`)

Measured sequentially after 5 warm-up calls (`N = 30` authenticated requests each against `node apps/api/dist/main.js` on `127.0.0.1:3000` + PostgreSQL + Redis, HTTP `200` on all 60 calls):

| Benchmark Case                                      | Sample Count (`N`) |    Min    |    p50    |    p95    |    p99    |    Max    |
| :-------------------------------------------------- | :----------------: | :-------: | :-------: | :-------: | :-------: | :-------: |
| **Page 1 (`limit=25`, no cursor)**                  |        `30`        | `4.97 ms` | `5.80 ms` | `7.58 ms` | `8.40 ms` | `8.40 ms` |
| **Deep Keyset Cursor (`offset ~4000`, `limit=25`)** |        `30`        | `5.16 ms` | `5.83 ms` | `7.31 ms` | `8.32 ms` | `8.32 ms` |

---

## 3. Production Next.js Build & Real Chromium Web Vitals (`next start -p 3002`)

### 3.1. `next build` Bundle Output (Selected Phase 4.1 Routes & Totals)

- Total routes compiled: `25/25` (`3.2s` Webpack/SWC compile step)
- Shared JS by all routes: `102 kB` (`chunks/168-...` `46.2 kB`, `chunks/9432511c-...` `54.2 kB`, other `2 kB`)
- Edge Middleware: `34.3 kB`
- `/admin/login`: `5.61 kB` route / `178 kB` First Load JS
- `/admin/dashboard`: `6.28 kB` route / `112 kB` First Load JS
- `/admin/audit`: `6.45 kB` route / `186 kB` First Load JS
- `/admin/disputes`: `6.35 kB` route / `109 kB` First Load JS
- `/admin/referrals`: `2.68 kB` route / `105 kB` First Load JS

### 3.2. Real Headless Chromium Runtime Measurements (Local Production Server)

Collected via Chromium `PerformanceNavigationTiming`, `PerformanceObserver` (`paint`, `largest-contentful-paint`, `layout-shift`), and `resource` transfer entries against `http://127.0.0.1:3002` (`networkidle` + 400ms settle):

| Route              |   TTFB   | DOMContentLoaded | Load Event |   FCP   |   LCP    |     CLS      | JS Files / Transfer (kB) | Total Resource Transfer (kB) |        External Blocked Requests         |
| :----------------- | :------: | :--------------: | :--------: | :-----: | :------: | :----------: | :----------------------: | :--------------------------: | :--------------------------------------: |
| `/admin/login`     | `5.5 ms` |    `27.5 ms`     | `85.4 ms`  | `60 ms` | `60 ms`  |     `0`      |    `13` / `192.74 kB`    |         `207.14 kB`          | `3` (`fonts.googleapis.com` CSP blocked) |
| `/admin/dashboard` | `17 ms`  |    `35.7 ms`     | `91.3 ms`  | `52 ms` | `188 ms` |     `0`      |    `29` / `270.65 kB`    |         `322.03 kB`          | `3` (`fonts.googleapis.com` CSP blocked) |
| `/admin/audit`     | `3.5 ms` |    `28.5 ms`     | `66.9 ms`  | `32 ms` | `140 ms` | **`0.4269`** |    `27` / `264.13 kB`    |         `313.31 kB`          | `3` (`fonts.googleapis.com` CSP blocked) |
| `/admin/disputes`  | `2.8 ms` |    `24.7 ms`     | `82.5 ms`  | `72 ms` | `140 ms` |   `0.002`    |    `26` / `257.53 kB`    |         `312.27 kB`          | `3` (`fonts.googleapis.com` CSP blocked) |
| `/admin/referrals` | `3.6 ms` |    `30.8 ms`     | `77.6 ms`  | `32 ms` | `144 ms` |     `0`      |    `26` / `257.53 kB`    |         `301.46 kB`          | `3` (`fonts.googleapis.com` CSP blocked) |

Additional interaction & unmeasured telemetry disclosures:

- **`/admin/audit` Page-Next Click-to-Render Latency**: `55.77 ms` (measured from `Next` button click through `/api/v1/admin/audit?cursor=...` HTTP `200` to `Loading records...` detached).
- **Hardware `INP` (EventTiming API / Lighthouse)**: **`NOT MEASURED`** — no standalone Lighthouse / Web Vitals Chrome Extension hardware run was performed.
- **Real CLS Defect Uncovered on `/admin/audit` (`0.4269`)**: `AdminTable` collapses from 25 data rows down to a single 1-row `Loading records...` placeholder during async fetch (`apps/web-shell/src/components/admin/ui/AdminTable.tsx:54-62`) and expands downward once rows arrive, shifting the pagination footer by ~400px (`> 0.25` Core Web Vitals Poor threshold). Replacing the single loading row with fixed-height skeleton rows or reserving table `min-height` will eliminate this layout shift.
- **External Font CSP Defect**: Contrary to prior claims of zero external font requests, `apps/web-shell/src/app/layout.tsx` emits 3 `<link href="https://fonts.googleapis.com/...">` stylesheets, all of which fail cleanly/noise console logs (`CSP style-src 'self' 'unsafe-inline'`). Switching to local self-hosted fonts (`next/font/local` or removing unused Google Font links) resolves both CSP console errors and offline/intranet typography fallback.
