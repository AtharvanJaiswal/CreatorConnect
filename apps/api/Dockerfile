FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache libc6-compat openssl curl
RUN npm install -g pnpm@9.15.4

WORKDIR /app

FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @creatorconnect/api... build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app ./

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=10s \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
