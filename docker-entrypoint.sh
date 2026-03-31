#!/bin/sh
set -e
cd /app
# Apply migrations before serving traffic (DATABASE_URL from Compose).
npx prisma migrate deploy
exec node server.js
