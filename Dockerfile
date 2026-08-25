# =============================================
# INVOICER - Multi-stage Dockerfile
# Set DB_PROVIDER=mysql or DB_PROVIDER=sqlite (default)
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
ARG DB_PROVIDER=sqlite
ENV DATABASE_URL=${DATABASE_URL}

# Swap schema based on explicit DB_PROVIDER arg
RUN if [ "$DB_PROVIDER" = "mysql" ] && [ -f prisma/schema.mysql.prisma ]; then \
      cp prisma/schema.mysql.prisma prisma/schema.prisma; \
      echo "[BUILD] DB_PROVIDER=mysql -> using MySQL schema"; \
    else \
      echo "[BUILD] DB_PROVIDER=$DB_PROVIDER -> using SQLite schema"; \
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

# Copy Prisma schemas (both files for runtime swap)
COPY --from=builder /app/prisma ./prisma

# Copy @prisma/client runtime package (needed by Next.js API routes)
# Do NOT copy node_modules/.prisma — it will be generated at runtime
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy bcryptjs (needed by seed / nextauth)
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

# Copy mssql + deps (external package, not bundled by Next.js standalone)
COPY --from=builder /app/node_modules/mssql ./node_modules/mssql
COPY --from=builder /app/node_modules/tedious ./node_modules/tedious
COPY --from=builder /app/node_modules/tarn ./node_modules/tarn
COPY --from=builder /app/node_modules/debug ./node_modules/debug
COPY --from=builder /app/node_modules/ms ./node_modules/ms
COPY --from=builder /app/node_modules/@tediousjs ./node_modules/@tediousjs

# Copy seed script and CSV data for auto-seed
COPY --from=builder /app/prisma/seed.ts ./prisma/seed.ts
COPY --from=builder /app/upload/itens.csv ./upload/itens.csv

# Create data directories
RUN mkdir -p /app/data /app/data/uploads /app/data/pdfs /app/upload /app/node_modules/.prisma

# Install bun (for seed) and prisma CLI (for db push + generate) globally
RUN npm install -g bun && npm install -g prisma@6

# Fix permissions: nextjs user needs write access to /app AND global prisma
RUN chown -R nextjs:nodejs /app /usr/local/lib/node_modules/prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy and set entrypoint
COPY --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]