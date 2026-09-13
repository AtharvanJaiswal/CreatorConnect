FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @creatorconnect/worker build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app /app

CMD ["node", "apps/worker/dist/main.js"]
