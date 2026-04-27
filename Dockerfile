# IRBA Manager — Next.js + Prisma (PostgreSQL adapter)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
# `npm ci`'s postinstall hook (in package.json) runs `prisma generate`, so a
# separate `npx prisma generate` step here would be redundant.
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Cap heap so a runaway TypeScript validation can't OOM the build host.
ENV NODE_OPTIONS=--max-old-space-size=1024
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
COPY --chown=nextjs:nodejs --from=builder /app/prisma ./prisma
COPY --chown=nextjs:nodejs --from=builder /app/prisma.config.ts ./
# Install ONLY the packages the entrypoint needs at startup (`prisma migrate
# deploy` requires the prisma CLI + @prisma/client). Avoids dragging the full
# 800MB+ deps node_modules — Next.js standalone already bundles everything the
# app itself imports.
COPY --chown=nextjs:nodejs --from=builder /app/package.json /app/package-lock.json ./
# `prisma migrate deploy` loads prisma.config.ts at startup, which imports
# `dotenv/config` and `prisma/config`. Install just those three packages
# instead of the full deps tree (~800MB → ~70MB). Postinstall must run so
# Prisma can fetch the migration engine binary at build time — otherwise it
# tries to download it at container start, which fails because node_modules
# is root-owned and the container runs as `nextjs`. After install, chown the
# tree so the runtime user can read it.
RUN npm install --omit=dev --no-save --no-audit --no-fund \
      prisma @prisma/client dotenv \
    && npm cache clean --force \
    && chown -R nextjs:nodejs /app/node_modules
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
