FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache libc6-compat openssl curl
RUN npm install -g pnpm@9.15.4

WORKDIR /app

FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/worker/ ./apps/worker/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @creatorconnect/worker... build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app ./

CMD ["node", "apps/worker/dist/main.js"]
