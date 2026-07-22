# =============================================
# INVOICER - Multi-stage Dockerfile (MySQL)
# Target image size: < 200MB
# =============================================

# ---- Stage 1: Dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json bun.lock* ./
RUN npm install -g bun && \
    bun install --frozen-lockfile 2>/dev/null || bun install

# ---- Stage 2: Build ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g bun

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# DATABASE_URL is passed at build time for Prisma generate
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

# Generate Prisma client + build Next.js
RUN bun run db:generate && \
    bun run build

# ---- Stage 3: Production Runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma: schema + migrations for runtime `migrate deploy`
COPY --from=builder /app/prisma ./prisma

# Install prisma CLI globally (includes engines, .wasm, etc.)
RUN npm install -g prisma@6

USER nextjs

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=20s CMD wget -q -O /dev/null http://localhost:3000/ || exit 1

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# devDependencies are NOT copied — standalone output only includes production deps
# Run pending migrations then start
CMD ["sh", "-c", "prisma migrate deploy && node server.js"]