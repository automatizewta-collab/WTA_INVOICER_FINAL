#!/bin/bash
# INVOICER - MySQL Restore Script
# Usage: gunzip -c backup.sql.gz | ./scripts/restore-mysql.sh
# Or: cat backup.sql | ./scripts/restore-mysql.sh
#
# Reads from stdin (piped SQL) and restores to the MySQL container.

set -euo pipefail

if [ -f .env ]; then
  export $(grep -v '^#' .env | grep -v '^$' | xargs)
fi

DB_USER="${MYSQL_USER:-invoicer}"
DB_PASS="${MYSQL_PASSWORD:-invoicerpassword}"
DB_NAME="invoicer"

CONTAINER=$(docker compose ps -q invoicer-db 2>/dev/null || echo "")
if [ -z "$CONTAINER" ]; then
  echo "ERROR: MySQL container not running. Start with 'docker compose up -d'"
  exit 1
fi

echo "⚠️  This will OVERWRITE all data in the '$DB_NAME' database. Continue? (yes/no)"
read -r CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

docker exec -i "$CONTAINER" mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME"
echo "✅ Database restored successfully."