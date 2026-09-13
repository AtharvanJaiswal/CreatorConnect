FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @creatorconnect/realtime build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app /app

EXPOSE 3001
CMD ["node", "apps/realtime/dist/main.js"]
