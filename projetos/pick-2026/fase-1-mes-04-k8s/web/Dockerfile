# syntax=docker/dockerfile:1.6
#
# PICKStack — web (SvelteKit + adapter-node).
# Multi-stage: deps → builder → runtime.
# Imagem final < 200MB, roda como usuário não-root, expõe 3000.

# ---------------------------------------------------------------------------
# Stage 1 — deps (cache de node_modules via pnpm store)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml* .npmrc* ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile || pnpm install

# ---------------------------------------------------------------------------
# Stage 2 — builder (compila o SvelteKit)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# PUBLIC_API_URL é necessária no build (envs PUBLIC_* são bundled no client).
ARG PUBLIC_API_URL=http://localhost:8080
ENV PUBLIC_API_URL=$PUBLIC_API_URL

RUN pnpm build && pnpm prune --prod

# ---------------------------------------------------------------------------
# Stage 3 — runtime (node:20-alpine slim)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    BODY_SIZE_LIMIT=10485760

# Usuário não-root + healthcheck binário.
RUN apk add --no-cache curl tini \
 && addgroup -S app && adduser -S app -G app

COPY --from=builder --chown=app:app /app/build ./build
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/package.json ./package.json

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "build/index.js"]
