# IRBA Manager — Next.js + Prisma (PostgreSQL adapter)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Dummy DATABASE_URL prevents module-level throw in prisma.ts during next build.
# The real URL is injected at runtime via docker-compose env.
ENV DATABASE_URL="postgresql://build:placeholder@localhost:5432/build"
ARG COMMIT_HASH=dev
ARG COMMIT_DATE=
ENV NEXT_PUBLIC_COMMIT_HASH=$COMMIT_HASH
ENV NEXT_PUBLIC_COMMIT_DATE=$COMMIT_DATE
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Standalone bundle: puts server.js and its minimal node_modules at /app
COPY --chown=nextjs:nodejs --from=builder /app/.next/standalone ./
# Static assets alongside server.js (standalone server resolves these from cwd)
COPY --chown=nextjs:nodejs --from=builder /app/.next/static ./.next/static
COPY --chown=nextjs:nodejs --from=builder /app/public ./public
# Full node_modules needed for `npx prisma migrate deploy` at startup
COPY --chown=nextjs:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs --from=builder /app/prisma ./prisma
COPY --chown=nextjs:nodejs --from=builder /app/prisma.config.ts ./
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
