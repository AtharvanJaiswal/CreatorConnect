# CreatorConnect — Environment & Containerization Strategy

## 1. Environment Topology & Isolation

CreatorConnect strictly enforces complete physical and credential isolation across four distinct environments:

| Attribute | LOCAL | DEVELOPMENT | STAGING | PRODUCTION |
| :--- | :--- | :--- | :--- | :--- |
| **Purpose** | Developer workstations & automated unit tests | Shared integration & feature branch preview | Production parity, rehearsal, full Playwright | End-user live platform |
| **Hosting** | Docker Compose (Localhost) | Cloudflare Pages + ECS Dev Cluster | Cloudflare Pages + ECS Staging Cluster | Cloudflare Pages + AWS ECS Fargate Multi-AZ |
| **Database** | Local PostgreSQL 16 container | AWS Aurora PostgreSQL Dev | AWS Aurora PostgreSQL Staging (Replica of Prod) | AWS Aurora PostgreSQL Multi-AZ Cluster |
| **Redis** | Local Redis 7 container | AWS ElastiCache Dev | AWS ElastiCache Staging | AWS ElastiCache Cluster (Multi-AZ) |
| **Object Storage** | MinIO / Local R2 dev bucket | Cloudflare R2 Dev Bucket | Cloudflare R2 Staging Bucket | Cloudflare R2 Production Bucket (CDN backed) |
| **Third-Party Mode**| Mock / Sandbox Mode | Test Mode (Test Keys) | Sandbox Mode (Razorpay Sandbox, Test FCM) | Live Mode (Real funds, Real APNs/FCM) |
| **Data Policy** | Synthetic factory fixtures | Synthetic anonymized data | Anonymized production-scale dataset | Encrypted customer live data (Zero PII in dev) |

> **Strict Isolation Rule**: No non-production environment may ever have network connectivity to, or credentials for, production databases, caches, or third-party live gateways.

---

## 2. Production-Grade Docker Containerization Standards

All services are containerized using **multi-stage builds**, **pinned base images**, and **non-root user privileges**:

```dockerfile
# syntax=docker/dockerfile:1.4
# Stage 1: Build stage
FROM node:20.18-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@9.10.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @creatorconnect/api build

# Stage 2: Minimal Distroless Production Runner
FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy only built artifacts and pruned production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/packages ./packages

USER nonroot
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --retries=3 --start-period=10s \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1))"]

CMD ["dist/main.js"]
```

### Docker Hardening Checklist:
- **Zero Root Execution**: Container runs under unprivileged `nonroot` UID 65532.
- **Pinned Base Images**: Base images pinned to specific LTS release tags; floating `:latest` tags are prohibited.
- **Zero Secrets in Layers**: Build arguments and environment secrets are never baked into Docker images. Secret injection occurs exclusively at runtime via AWS Secrets Manager / ECS Task Definitions.
- **Minimal Image Size**: Distroless node runtime produces slim container images (< 180MB), minimizing CVE attack surface.

---

## 3. Environment Variable Taxonomy & Safe Configuration Template

Configuration variables are segregated into three sensitivity tiers:
1. **Public / Client (`NEXT_PUBLIC_*`)**: Safe for browser bundling (e.g., Supabase project URL, public CDN base domain).
2. **Internal Application Config**: Operational toggles (e.g., `PORT`, `LOG_LEVEL`, `CORS_ORIGINS`).
3. **Sensitive Infrastructure Secrets**: High-security keys (e.g., `DATABASE_URL`, `RAZORPAY_KEY_SECRET`, `R2_SECRET_ACCESS_KEY`).

### Safe `.env.example` (Reference Template — Zero Real Secrets)
```bash
# ==============================================================================
# CreatorConnect — Environment Configuration Template (.env.example)
# DO NOT COMMIT REAL CREDENTIALS TO SOURCE CONTROL.
# ==============================================================================

# --- Node & Environment ---
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# --- Database & Cache ---
DATABASE_URL="postgresql://postgres:postgres_local_password@localhost:5432/creatorconnect_dev?schema=public&connection_limit=10"
REDIS_URL="redis://:redis_local_password@localhost:6379/0"

# --- Supabase Identity & Auth ---
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<SAFE_MOCK_SUPABASE_ANON_KEY>"
SUPABASE_JWT_SECRET="safe_mock_jwt_secret_min_32_characters_long"

# --- Cloudflare R2 Object Storage ---
R2_ACCOUNT_ID="safe_mock_cloudflare_account_id"
R2_ACCESS_KEY_ID="safe_mock_r2_access_key"
R2_SECRET_ACCESS_KEY="safe_mock_r2_secret_key"
R2_BUCKET_NAME="creatorconnect-dev-media"
R2_PUBLIC_DOMAIN="https://dev-media.creatorconnect.com"

# --- Razorpay Payment Gateway ---
RAZORPAY_KEY_ID="rzp_test_mock_key_id"
RAZORPAY_KEY_SECRET="safe_mock_razorpay_secret"
RAZORPAY_WEBHOOK_SECRET="safe_mock_webhook_secret"

# --- Notifications (FCM & Resend) ---
FIREBASE_PROJECT_ID="creatorconnect-mock-dev"
FIREBASE_CLIENT_EMAIL="firebase-mock@creatorconnect.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="<MOCK_FIREBASE_PRIVATE_KEY>"
RESEND_API_KEY="re_mock_resend_api_key"
EMAIL_FROM_ADDRESS="no-reply@dev.creatorconnect.com"

# --- Sentry Observability ---
SENTRY_DSN="https://mock_public_key@sentry.io/1234567"
```
