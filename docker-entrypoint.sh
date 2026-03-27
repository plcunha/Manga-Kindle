#!/bin/sh
set -e

echo "[entrypoint] Pushing Prisma schema to database..."
npx -w packages/api prisma db push --skip-generate

echo "[entrypoint] Starting API server..."
node packages/api/dist/index.js &

echo "[entrypoint] Starting Web server..."
npx -w packages/web next start --port 3000 &

# Wait for either process to exit
wait -n
