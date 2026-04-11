# IRBA Manager — Next.js + Prisma (PostgreSQL adapter)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Install deps and generate Prisma client here so this stage can be fully
# cached when only app code changes (package.json + schema unchanged).
RUN npm ci
RUN npx prisma generate

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
# Full node_modules needed for `npx prisma migrate deploy` at startup.
# Copied from the cached `deps` stage (not builder) so this layer is reused
# across deployments when package.json and schema.prisma haven't changed.
COPY --chown=nextjs:nodejs --from=deps /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs --from=builder /app/prisma ./prisma
COPY --chown=nextjs:nodejs --from=builder /app/prisma.config.ts ./
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
