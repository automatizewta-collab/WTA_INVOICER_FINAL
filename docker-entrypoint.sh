#!/bin/sh
# =============================================
# INVOICER - Docker Entrypoint
# 1. Ensure correct schema (MySQL/SQLite)
# 2. Push schema to DB (skip generate)
# 3. Generate Prisma Client (explicit step)
# 4. Seed default data
# 5. Start Next.js server
# =============================================

echo "========================================"
echo "[INVOICER] Starting container..."
echo "[INVOICER] DB: ${DATABASE_URL:0:40}..."
echo "========================================"

# Step 0: Ensure correct schema based on DATABASE_URL
case "$DATABASE_URL" in
  mysql://*)
    if [ -f prisma/schema.mysql.prisma ]; then
      cp prisma/schema.mysql.prisma prisma/schema.prisma
      echo "[INVOICER] Detected MySQL URL -> swapped to MySQL schema"
    fi
    ;;
  *)
    echo "[INVOICER] Using default (SQLite) schema"
    ;;
esac

# Debug: show schema provider
echo "[INVOICER] Schema provider:"
head -15 prisma/schema.prisma

# Step 1: Push schema with retries (skip-generate to avoid permission issue)
echo "[INVOICER] Step 1/4: Syncing database schema..."
MAX_RETRIES=15
for i in $(seq 1 $MAX_RETRIES); do
    if prisma db push --skip-generate --accept-data-loss 2>&1; then
        echo "[INVOICER] Schema sync OK."
        break
    fi
    if [ "$i" -eq "$MAX_RETRIES" ]; then
        echo "[INVOICER] ERROR: Failed to sync schema after $MAX_RETRIES attempts."
        echo "[INVOICER] Starting app anyway..."
    else
        echo "[INVOICER] MySQL not ready yet, retrying in 2s... ($i/$MAX_RETRIES)"
        sleep 2
    fi
done

# Step 2: Generate Prisma Client from the correct schema on disk
echo "[INVOICER] Step 2/4: Generating Prisma Client..."
prisma generate 2>&1

# Debug: verify generated client
echo "[INVOICER] Generated client check:"
ls node_modules/.prisma/client/index.js 2>&1

# Step 3: Seed default data (idempotent - skips if data exists)
echo "[INVOICER] Step 3/4: Seeding default data..."
bun run prisma/seed.ts 2>&1
echo "[INVOICER] Seed step complete."

# Step 4: Start the application
echo "[INVOICER] Step 4/4: Starting Next.js server..."
echo "========================================"

exec node server.js
