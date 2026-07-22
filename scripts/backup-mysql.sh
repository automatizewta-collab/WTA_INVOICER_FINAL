#!/bin/bash
# INVOICER - MySQL Backup Script
# Usage: ./scripts/backup-mysql.sh [output_file.sql]
#
# Must be run from the project root where docker-compose.yml is located.
# Reads MYSQL credentials from .env file.

set -euo pipefail

# Load .env if exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep -v '^$' | xargs)
fi

DB_USER="${MYSQL_USER:-invoicer}"
DB_PASS="${MYSQL_PASSWORD:-invoicerpassword}"
DB_NAME="invoicer"
OUTPUT="${1:-backup_$(date +%Y%m%d_%H%M%S).sql}"

# Find the running MySQL container
CONTAINER=$(docker compose ps -q invoicer-db 2>/dev/null || echo "")

if [ -z "$CONTAINER" ]; then
  echo "ERROR: MySQL container not running. Start with 'docker compose up -d'"
  exit 1
fi

docker exec "$CONTAINER" mysqldump -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$OUTPUT"
gzip "$OUTPUT"
echo "✅ Backup saved: ${OUTPUT}.gz"
echo "   To restore: gunzip -c ${OUTPUT}.gz | ./scripts/restore-mysql.sh"