#!/bin/sh

# Ensure DATABASE_URL is present
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL is not set."
  exit 1
fi

# Convert PostgreSQL URL format:
# Railway gives:  postgresql://user:password@host:port/dbname
# Nakama expects: user:password@host:port/dbname
DB_ADDR=$(echo "$DATABASE_URL" | sed 's|^postgresql://||' | sed 's|^postgres://||')

echo "Running migrations..."
/nakama/nakama migrate up --database.address "$DB_ADDR"

echo "Starting Nakama Server..."
exec /nakama/nakama \
  --name nakama-cloud \
  --database.address "$DB_ADDR" \
  --socket.port 7350 \
  --session.token_expiry_sec 7200 \
  --logger.level INFO
