# =============================================
# INVOICER - Multi-stage Dockerfile
# Auto-detects MySQL vs SQLite from DATABASE_URL
# =============================================

# ---- Stage 1: Dependencies ----
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json bun.lock* ./
RUN npm install -g bun && \
    bun install --frozen-lockfile 2>/dev/null || bun install

# ---- Stage 2: Build ----
FROM node:20-alpine AS builder
RUN npm install -g bun
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

# Auto-detect DB provider from DATABASE_URL and swap schema accordingly
# Prisma Client bakes in the provider at generate time
RUN if echo "$DATABASE_URL" | grep -qi "^mysql"; then \
      echo "[BUILD] Detected MySQL, swapping schema..."; \
      mv prisma/schema.mysql.prisma prisma/schema.prisma; \
    else \
      echo "[BUILD] Using SQLite schema (default)"; \
    fi

RUN bun run db:generate && \
    bun run build

# ---- Stage 3: Production ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma: schema + generated client only (NOT the CLI)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy seed script and CSV data for auto-seed
COPY --from=builder /app/prisma/seed.ts ./prisma/seed.ts
COPY --from=builder /app/upload/itens.csv ./upload/itens.csv

# Create data directories
RUN mkdir -p /app/data /app/data/uploads /app/data/pdfs /app/upload && \
    chown -R nextjs:nodejs /app

# Install bun (for seed) and prisma CLI (for db push) globally
RUN npm install -g bun && npm install -g prisma@6

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy and set entrypoint
COPY --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]
