# CreatorConnect — Phase 4.3 CSP Nonce Review

**Framework:** Next.js `15.5.29` App Router (`apps/web-shell`)  
**Policy File:** `apps/web-shell/src/middleware.ts` & `apps/web-shell/src/app/layout.tsx`

---

## 1. Architecture Overview (Verified Against Next.js `15.5.29` Server Runtime)

Inspection of the installed Next.js server runtime (`apps/web-shell/node_modules/next/dist/esm/server/app-render/app-render.js` lines 95–96 and `get-script-nonce-from-header.js`) confirmed how App Router propagates script nonces:

1. Next.js `parseRequestHeaders` extracts the cryptographic nonce strictly from the incoming **`Content-Security-Policy`** (or `Content-Security-Policy-Report-Only`) **request header** matching `/^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/` inside `script-src`.
2. Next.js SSR only runs per-request (rather than serving static cached HTML without fresh nonces) when the root layout invokes a dynamic request API (`await headers()` + `export const dynamic = 'force-dynamic'`).
3. `middleware.ts` generates a fresh **128-bit cryptographic nonce** (`crypto.getRandomValues(new Uint8Array(16))` -> base64), forwards BOTH `x-nonce` and `Content-Security-Policy` via `NextResponse.next({ request: { headers } })`, sets `Content-Security-Policy` on the response, and enforces `Cache-Control: private, no-store, max-age=0` to prohibit intermediate/CDN HTML caching of single-use nonces.

---

## 2. Production vs Development Policy Matrix

| Directive                                                 | Production (`NODE_ENV === 'production'`)                                       | Development (`NODE_ENV !== 'production'`)                | Rationale                                                                                                     |
| :-------------------------------------------------------- | :----------------------------------------------------------------------------- | :------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| `default-src`                                             | `'self'`                                                                       | `'self'`                                                 | Restrict default resource origins                                                                             |
| `script-src`                                              | `'self' 'nonce-<random>' 'strict-dynamic'`                                     | `'self' 'nonce-<random>' 'strict-dynamic' 'unsafe-eval'` | Eliminates `'unsafe-inline'` globally; `'unsafe-eval'` strictly limited to dev HMR/Fast Refresh               |
| `style-src`                                               | `'self' 'unsafe-inline'`                                                       | `'self' 'unsafe-inline'`                                 | Retained for Next.js runtime style injection + 2 dynamic inline `style={{...}}` attributes (documented below) |
| `img-src`                                                 | `'self' data: https: blob:`                                                    | `'self' data: https: blob:`                              | Supports avatars, R2 signed images, inline data previews                                                      |
| `font-src`                                                | `'self' data:`                                                                 | `'self' data:`                                           | Self-hosted fonts only; zero `fonts.googleapis.com` / `fonts.gstatic.com`                                     |
| `connect-src`                                             | `'self' https: wss:`                                                           | `'self' https: ws: wss:`                                 | Restricts prod transport to `'self'` (`/api/*` rewrite proxy) + `https:`/`wss:`                               |
| `object-src`                                              | `'none'`                                                                       | `'none'`                                                 | Blocks Flash/Java/legacy plugins                                                                              |
| `frame-ancestors`                                         | `'none'`                                                                       | `'none'`                                                 | Clickjacking defense (`X-Frame-Options: DENY` parity)                                                         |
| `base-uri` & `form-action`                                | `'self'`                                                                       | `'self'`                                                 | Prevents `<base>` hijacking & cross-origin form exfiltration                                                  |
| `upgrade-insecure-requests` & `Strict-Transport-Security` | Added **only** when `protocol === 'https:'` or `x-forwarded-proto === 'https'` | Added **only** when HTTPS                                | Avoids Firefox/WebKit HSTS & localhost subresource breakage over local `http://127.0.0.1` tests               |

---

## 3. Inline Style & Script Inventory (`apps/web-shell/src`)

- **`<script>` / `<Script>` / `dangerouslySetInnerHTML`**: **0** hardcoded custom script tags in `apps/web-shell/src`. Next.js runtime injects bootstrap and chunk `<script>` elements automatically with `nonce="<per-request-nonce>"`.
- **JSX `style={{...}}` Audit**:
  - **Removed in Phase 4.3:** Converted `apps/web-shell/src/app/error.tsx` (4 style blocks) and `apps/web-shell/src/app/loading.tsx` (1 style block) to Tailwind CSS utility classes.
  - **Remaining (Dynamic Data-Driven Attributes Only):**
    1. `apps/web-shell/src/components/messaging/attachment-viewer.tsx:273` (`transform: scale(${zoom})`) — legacy messaging viewer dynamic zoom transform.
    2. `apps/web-shell/src/components/profile/verification-centre-panel.tsx:711` (`width: ${uploadProgress}%`) — dynamic upload percentage bar.

---

## 4. Empirical Verification Results

- **HTTP Response Inspection (`next start -p 3002`, Next.js `15.5.29`):**
  - `Cache-Control: private, no-store, max-age=0`
  - `'unsafe-inline'` in `script-src`: `false`
  - `'unsafe-eval'` in `script-src`: `false`
  - Two consecutive requests produced distinct nonces (`distinct: true`)
  - All `22` `<script>` tags emitted in `/admin/login` HTML carried matching `nonce` (`htmlNoncesCount: 22`, `htmlNonceMatch: true`)
- **Cross-Browser Playwright Verification (`Journey 7.1` & live login probe):**
  - **Chromium, Firefox, and WebKit** all hydrated, rendered forms/modals/tables across 18 journeys with **0 console CSP violations** and **0 page errors**.
