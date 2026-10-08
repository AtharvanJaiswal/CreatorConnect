FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache libc6-compat curl
RUN npm install -g pnpm@9.15.4

WORKDIR /app

FROM base AS builder
ARG API_URL=http://api:3000
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL=http://localhost:3000

ENV API_URL=$API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/web-shell/ ./apps/web-shell/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @creatorconnect/web-shell... build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002

COPY --from=builder /app ./

EXPOSE 3002

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=15s \
  CMD curl -f http://localhost:3002/ || exit 1

CMD ["pnpm", "--filter", "@creatorconnect/web-shell", "start"]
