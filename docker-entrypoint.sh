#!/bin/sh
# =============================================
# INVOICER - Docker Entrypoint
# 1. Push schema to DB (with MySQL wait retry)
# 2. Seed default data (idempotent)
# 3. Start Next.js server
# =============================================

echo "========================================"
echo "[INVOICER] Starting container..."
echo "[INVOICER] DB: ${DATABASE_URL:0:40}..."
echo "========================================"

# Step 1: Push schema with retries (also waits for MySQL)
echo "[INVOICER] Step 1/3: Syncing database schema..."
MAX_RETRIES=15
for i in $(seq 1 $MAX_RETRIES); do
    if prisma db push  --accept-data-loss 2>&1; then
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

# Step 2: Seed default data (idempotent - skips if data exists)
echo "[INVOICER] Step 2/3: Seeding default data..."
bun run prisma/seed.ts 2>&1
echo "[INVOICER] Seed step complete."

# Step 3: Start the application
echo "[INVOICER] Step 3/3: Starting Next.js server..."
echo "========================================"

exec node server.js
