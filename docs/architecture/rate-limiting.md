# CreatorConnect — Rate Limiting & Proxy Architecture (F-14)

## 1. Threat Model & Proxy Topology

### 1.1 Network Architecture

In CreatorConnect, incoming HTTP traffic traverses the following path:

```
Client Browser / API Consumer
              │
              ▼
   Edge Reverse Proxy / CDN (Cloudflare / Nginx)
              │
              ▼
   Next.js Web-Shell (Reverse Proxy / Rewrites at :3002)
              │
              ▼
   Fastify REST API Monolith (:3000)
```

Next.js (`apps/web-shell`) executes client-side and server-side rewrites forwarding `/api/:path*` directly to Fastify (`apps/api`). Consequently:

- Every request routed through the Next.js shell reaches Fastify with a socket remote address originating from Next.js (`127.0.0.1` locally or `172.x.x.x` in Docker bridge networks).
- If Fastify's `trustProxy` were disabled (`false`), **every user accessing via Next.js would share the single loopback/bridge IP**, causing one user's requests to exhaust rate limits for all users.
- Conversely, if `trustProxy: true` was set blindly, **any untrusted client could spoof `X-Forwarded-For: <fake-ip>`**, bypassing IP-based rate limiting entirely.

---

## 2. Fastify `trustProxy` Configuration

### 2.1 Implementation

To resolve both risks, Fastify is configured with a strict, CIDR-based whitelist using `proxy-addr`:

```typescript
const defaultTrustProxy = process.env.TRUST_PROXY
  ? (process.env.TRUST_PROXY === 'true'
      ? true
      : process.env.TRUST_PROXY === 'false'
      ? false
      : process.env.TRUST_PROXY.split(',').map((s) => s.trim()))
  : ['127.0.0.1', '::1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];

const app = fastify({
  trustProxy: opts.trustProxy !== undefined ? opts.trustProxy : defaultTrustProxy,
  ...
});
```

### 2.2 Security Invariants

1. **Loopback & RFC 1918 Private Subnets Only**: Fastify trusts hops originating from local loopback (`127.0.0.1`, `::1`) or private container/VPC networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
2. **Untrusted External Hops Rejected**: When a direct external client connects from a public IP, `proxy-addr` identifies the direct peer as untrusted and **ignores** any client-forged `X-Forwarded-For` headers.
3. **Multi-User Isolation**: When requests arrive through Next.js, Fastify walks back across the trusted Next.js internal hop and accurately extracts the client's actual public IP from `X-Forwarded-For`. Each client receives their own rate limit bucket.

---

## 3. Tiered Rate Limiting Architecture

| Tier                       | Primary Key                           | Secondary Protection         | Redis Failure Policy                    | Endpoints                                     |
| -------------------------- | ------------------------------------- | ---------------------------- | --------------------------------------- | --------------------------------------------- |
| **Auth Sync**              | Supabase `sub` / Client IP            | `ep:auth-sync:<ip>`          | `bounded-fallback` (Max 30)             | `POST /api/v1/auth/sync`                      |
| **Upload URL**             | Authenticated `usr:<id>`              | `ep:upload-url:<ip>`         | `fail-closed` (503 Service Unavailable) | `POST /api/v1/media/upload-url`               |
| **Discovery / Search**     | Authenticated `usr:<id>` or `ip:<ip>` | `ep:discovery-search:<ip>`   | `bounded-fallback` (Max 20)             | `GET /api/v1/discovery/*`                     |
| **Application Submission** | Authenticated `usr:<id>`              | `ep:application-create:<ip>` | `fail-closed` (503 Service Unavailable) | `POST /api/v1/assignments/:id/apply`          |
| **Expensive Mutations**    | Authenticated `usr:<id>`              | `ep:expensive-mutation:<ip>` | `fail-closed` (503 Service Unavailable) | Profile PUT, Assignment Create, Hiring Accept |

### 3.1 Authenticated vs. Anonymous Keys

- **Authenticated Requests**: Keyed on verified internal UUID `usr:<id>`. IP rotation (e.g. rotating proxies, cellular handover) cannot bypass the limit.
- **Anonymous Requests**: Keyed on verified client IP `ip:<ip>`.
- **Secondary Protection**: Secondary key `ep:<endpoint>:<ip>` throttles burst abuse from single networks even across distinct identity pools.

---

## 4. Redis Failure & Degradation Semantics

In accordance with architectural principles:

1. **Security-Sensitive Routes (`fail-closed`)**:
   - If Redis connection drops, upload issuance, assignment creation, and hiring acceptance fail closed by throwing `RateLimiterDegradedError` (HTTP 503 RFC 7807 problem details with code `RATE_LIMIT_UNAVAILABLE`).
2. **Standard & Read Routes (`bounded-fallback`)**:
   - Falls back to strict in-memory LRU token counters with reduced ceilings, ensuring platform availability while capping request floods.
3. **Client Headers**:
   - All evaluated requests emit `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`.
   - On limit violations, HTTP 429 RFC 7807 problem details is returned with `Retry-After: <seconds>`.
