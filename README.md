# IRBA Manager

Web app for **Ilan Ramon Basketball Association** — migrate from spreadsheets and WhatsApp to a self-hosted stack. This MVP focuses on **practice RSVPs** (Hebrew / RTL UI).

## Stack

- **Frontend:** Next.js (App Router), Tailwind CSS, Lucide icons  
- **Database:** PostgreSQL + Prisma ORM  
- **Runtime:** Node.js 20+  
- **Deployment:** Docker Compose (PostgreSQL + app)

## Prerequisites

- [Node.js](https://nodejs.org/) 20+  
- [Docker](https://docs.docker.com/get-docker/) (optional but recommended for Postgres and production-like runs)

## Local setup

1. **Environment**

   Copy `.env.example` to `.env` and set:

   - `DATABASE_URL` — PostgreSQL connection string  
   - `RSVP_SESSION_SECRET` — at least **32 characters** (signs the RSVP session cookie)

2. **Start PostgreSQL**

   ```bash
   docker compose up -d db
   ```

3. **Apply schema and (optional) seed data**

   ```bash
   npm install
   npx prisma migrate deploy
   npm run db:seed
   ```

   Initial migrations live under `prisma/migrations/`. Use `migrate deploy` for existing environments; use `prisma migrate dev` when you change the schema during development.

4. **Run the app**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

### `DATABASE_URL` hostnames

| Context | Example host |
|--------|----------------|
| Next.js on your machine, Postgres in Docker (published port) | `localhost` |
| App container in Docker Compose | `db` (the Compose service name) |

## Docker: app + database

Build and run both services (app listens on **3000**):

```bash
export RSVP_SESSION_SECRET="your-long-random-secret-at-least-32-chars"
docker compose up --build
```

The app image runs `prisma migrate deploy` before `next start` (see `docker-entrypoint.sh`).

## npm scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | `prisma migrate deploy` |
| `npm run db:seed` | Seed sample data |

## Security notes

- Never commit real secrets; keep them in `.env` (gitignored).  
- `RSVP_SESSION_SECRET` is used to sign the HTTP-only RSVP session cookie.
