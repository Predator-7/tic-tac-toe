#!/bin/sh

# Ensure DATABASE_URL is present
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL is not set."
  exit 1
fi

echo "Running migrations..."
/nakama/nakama migrate up --database.address "$DATABASE_URL"

echo "Starting Nakama Server..."
exec /nakama/nakama \
  --name nakama-cloud \
  --database.address "$DATABASE_URL" \
  --socket.port 7350 \
  --session.token_expiry_sec 7200 \
  --logger.level INFO
