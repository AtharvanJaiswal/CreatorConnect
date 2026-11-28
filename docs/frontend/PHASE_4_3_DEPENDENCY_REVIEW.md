# CreatorConnect — Phase 4.3 Dependency Vulnerability Review

**Audit Tool:** `pnpm audit --prod` & `pnpm audit` (`pnpm@9.15.4`)

---

## 1. Baseline Production Vulnerabilities (Before Remediation)

Running `pnpm audit --prod` on the baseline `dev` tree reported **8 vulnerabilities** (`2 low | 5 moderate | 1 high`):

| Package        | Vulnerable Spec         | Patched Target      |   Severity   | Advisory ID           | Dependency Path(s)                                                                                                                | Exploitability / Reachability Assessment                                                                                                                                                                                         |
| :------------- | :---------------------- | :------------------ | :----------: | :-------------------- | :-------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`zod`**      | `4.6.4` (`<4.6.6`)      | `>=4.6.6` (`4.6.7`) |   **High**   | `GHSA-mrhx-c7xc-m3w5` | `apps/api -> @scalar/fastify-api-reference@1.68.0 -> @scalar/types@0.19.0 -> zod@4.6.4`                                           | Memory exhaustion on oversized constrained collections. API request validation uses `@sinclair/typebox`/`ajv`, not `zod`; reachable only if untrusted large specs are parsed in Scalar OpenAPI UI (`@scalar/openapi-validator`). |
| **`next`**     | `15.5.28` (`<=15.5.28`) | `>=15.5.29`         | **Moderate** | `GHSA-7qx7-33qx-rqx2` | `apps/web-shell -> next@15.5.28`                                                                                                  | SVG rejection bypass in `next/image` optimization. Admin web-shell serves zero public unauthenticated UGC images, but patch is direct single-digit bump.                                                                         |
| **`next`**     | `15.5.28` (`<=15.5.28`) | `>=15.5.29`         | **Moderate** | `GHSA-f3mh-rxg3-f5g2` | `apps/web-shell -> next@15.5.28`                                                                                                  | HttpOnly cookie exposure via internal Edge runtime response headers. Web-shell middleware runs on Edge; patch resolves cleanly.                                                                                                  |
| **`next`**     | `15.5.28` (`<=15.5.28`) | `>=15.5.29`         | **Moderate** | `GHSA-pc58-hwjq-p385` | `apps/web-shell -> next@15.5.28`                                                                                                  | Cross-client response injection/disclosure when forwarding fetched responses in self-hosted Next.js. Resolved cleanly in `15.5.29`.                                                                                              |
| **`fast-uri`** | `4.2.2` (`<4.2.3`)      | `>=4.2.3` (`4.2.4`) | **Moderate** | `GHSA-w74x-v6f9-j3xg` | `fastify@5.12.7`, `@fastify/swagger@9.9.2`, `@scalar/fastify-api-reference@1.68.0` -> `ajv@8.20.0` / `json-schema-resolver@3.0.0` | URI scheme spoofing via percent-encoded decoding inside JSON schema URI resolution/AJV `uri` format validation.                                                                                                                  |
| **`fast-uri`** | `4.2.2` (`<4.2.3`)      | `>=4.2.3` (`4.2.4`) | **Moderate** | `GHSA-wjr9-j795-jxcr` | Same (`22` paths across `apps/api` & `apps/realtime`)                                                                             | Host confusion via unchecked WHATWG host canonicalization.                                                                                                                                                                       |
| **`fast-uri`** | `4.2.2` (`<4.2.3`)      | `>=4.2.3` (`4.2.4`) |   **Low**    | `GHSA-xhq7-xmqj-769h` | Same                                                                                                                              | Path equivalence mismatch in relative reference normalization.                                                                                                                                                                   |
| **`fast-uri`** | `4.2.2` (`<4.2.3`)      | `>=4.2.3` (`4.2.4`) |   **Low**    | `GHSA-333x-w4r6-6crp` | Same                                                                                                                              | Scheme injection via unescaped first-segment colon in suffix references.                                                                                                                                                         |

---

## 2. Minimal Non-Breaking Patch Remediation Applied

Inspection via `pnpm -r why zod` and `pnpm -r why fast-uri` confirmed all workspace consumers already resolved to `zod@4.6.x` and `fast-uri@4.2.x`, and npm registry verification confirmed exact semver-patch releases (`next@15.5.29`, `zod@4.6.7`, `fast-uri@4.2.4`).

Applied targeted overrides in root [`package.json`](file:///f:/CreatorConnect/package.json) (`pnpm.overrides`) and [`apps/web-shell/package.json`](file:///f:/CreatorConnect/apps/web-shell/package.json):

- `"next": "15.5.29"` (override) and `"next": "~15.5.29"` (`apps/web-shell`)
- `"zod": ">=4.6.7 <5.0.0"` (override)
- `"fast-uri": ">=4.2.4"` (override)

### Post-Patch Verification

- `pnpm.cmd install --no-frozen-lockfile` succeeded cleanly (`pnpm-lock.yaml` updated, `prisma generate` cleanly completed).
- **`pnpm.cmd audit --prod`**: **`No known vulnerabilities found` (Exit Code `0`, `0` advisories remaining)**.
- Full `apps/web-shell` `next build`, `turbo run build` (`12/12`), `turbo run typecheck` (`20/20`), `apps/api` (`58/58` files, `695/695` tests), `apps/web-shell` (`26/26` files, `315/315` tests), and `54/54` cross-browser E2E tests passed after the dependency patch.

---

## 3. Non-Production (`devDependencies`) Audit Summary

Running full `pnpm.cmd audit` (including test/build `devDependencies`) reports **22 findings** (`1 low | 16 moderate | 4 high | 1 critical`) in offline test tooling (`vitest@2.1.9`, `vite@5.4.21`, `@testcontainers/postgresql@10.28.0` -> `minimatch@9.0.9`). None of these packages ship in runtime production containers (`apps/api`, `apps/realtime`, `apps/worker`, `apps/web-shell` production bundles). Major-version upgrades (`vitest@3.x+`, `vite@6.x+`) remain deferred to a dedicated tooling upgrade task cleanly outside Phase 4.3 remediation scope.
