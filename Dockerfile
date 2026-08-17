# =============================================
# INVOICER - Multi-stage Dockerfile (MySQL)
# Production-ready with auto-seed on first boot
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

# CRITICAL: Swap to MySQL schema BEFORE generating Prisma Client
# Prisma Client bakes in the provider at generate time
RUN mv prisma/schema.mysql.prisma prisma/schema.prisma

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
# Copy runtime deps needed by seed script (bcryptjs) and /api/init
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

ENTRYPOINT ["./docker-entrypoint.sh"]
