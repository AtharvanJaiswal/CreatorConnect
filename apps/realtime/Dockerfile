FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache libc6-compat curl
RUN npm install -g pnpm@9.15.4

WORKDIR /app

FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/realtime/ ./apps/realtime/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @creatorconnect/realtime... build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app ./

EXPOSE 3001

USER node
CMD ["node", "apps/realtime/dist/main.js"]
