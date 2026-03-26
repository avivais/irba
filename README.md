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
   - `ADMIN_SESSION_SECRET` — at least **32 characters** (signs the admin session cookie; **different** from the RSVP secret). Run `npm run generate-admin-secret` to create one and write it to `.env`.  
   - `ADMIN_PASSWORD_HASH` — **bcrypt** hash of the operator password. Run `npm run hash-admin-password` to hash and **write it into `.env`** automatically (use `--print-only` to print the line instead). Use a strong password; never commit real secrets.

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

   **Development** (hot reload, large unminified bundle — use on desktop only):
   ```bash
   npm run dev
   ```

   **Production** (minified, code-split — required for mobile or tunnel testing):
   ```bash
   npm run build
   npm start
   ```

   Open [http://localhost:3000](http://localhost:3000).

   > **Important:** The dev bundle is 10–20 MB unminified. React will not hydrate
   > reliably on mobile devices or slow connections in dev mode, causing all
   > client-side interactivity (forms, theme toggle, validation) to silently break.
   > Always use `npm run build && npm start` when testing on a phone or over a tunnel.

### Admin area (`/admin`)

After setting `ADMIN_SESSION_SECRET` and `ADMIN_PASSWORD_HASH` in `.env`, open [http://localhost:3000/admin/login](http://localhost:3000/admin/login). The admin session is a separate **HttpOnly** JWT cookie (audience `irba-admin` by default), with the same `RSVP_COOKIE_SECURE` behavior as the RSVP cookie. Default session lifetime is **14 days** (override with `ADMIN_SESSION_MAX_AGE_SEC` in seconds, between 300 and 90 days).

Once logged in, the admin home shows navigation to:

- **שחקנים** (`/admin/players`) — list, add, edit, and delete players. Phone is the player's unique identifier and cannot be changed after creation. Deletion is blocked when the player has any attendance records.
- **מפגשים** (`/admin/sessions`) — list, add, edit, and delete game sessions. Each session can be toggled open/closed (affects RSVP availability on the public page). Deletion is blocked when the session has any registered attendees.

**Login fails immediately (same browser error as wrong password)?** In development, check the **terminal** where `npm run dev` is running — the server logs which case failed (password mismatch, bad/missing hash, or session cookie error). Common fixes: **restart the dev server** after changing `.env`; ensure **`ADMIN_SESSION_SECRET` is at least 32 characters** (password can be correct but cookie signing still fails); ensure **only one** `ADMIN_PASSWORD_HASH` line (re-run `npm run hash-admin-password` to rewrite). **Bcrypt hashes contain `$` characters.** Next.js loads `.env` with **dotenv-expand**, which treats `$X` as variable interpolation and corrupts the hash. The `hash-admin-password` script writes the hash in **single quotes with `\$` escaping** (e.g. `ADMIN_PASSWORD_HASH='\$2b\$12\$...'`), which is the format dotenv-expand resolves correctly. If you paste a hash by hand, use the same pattern.

In Chrome DevTools **Network**, server actions appear as **Fetch/XHR** requests to your app origin (often the document URL with a `Next-Action` header), not as a separate `/api/...` route — disable extensions or use a clean profile if the list is flooded by `chrome-extension://` noise.

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

## Exposing to the web (tunnel)

To test on a mobile device outside your local network, use a Cloudflare quick tunnel. No account is required.

**Install once:**
```bash
brew install cloudflared
```

**Start the production server and tunnel:**
```bash
npm run build
npm run startweb
```

`npm run startweb` starts the server in the background (PID saved to `.next.pid`) and then runs cloudflared in the foreground. Cloudflare prints a public HTTPS URL (e.g. `https://some-words.trycloudflare.com`). Open it on your phone.

If the server is already running, just open a tunnel:
```bash
npm run web
```

> **Notes:**
> - Always use the production build (`npm start` / `npm run startweb`), not `npm run dev`, when testing over a tunnel — see the dev vs production note above.
> - Quick tunnels have no uptime guarantee and are intended for short-lived testing only.
> - The URL changes each time you start a new tunnel.
> - To stop the tunnel: `Ctrl+C`. To stop the server: `npm stop`.

## Health check

`GET /api/health` returns JSON and **200** when PostgreSQL responds to a simple query (`SELECT 1`). If the database is unreachable, it returns **503** with a generic body (`database: "down"`) — no stack traces or connection strings.

Use it for load balancers, uptime checks, or quick local verification:

```bash
curl -sSf http://localhost:3000/api/health
```

## Testing

Tests use [Vitest](https://vitest.dev/). By default they **do not require a running Postgres** (pure unit tests and mocked DB checks).

```bash
npm test              # run once
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

**CI:** Default `npm test` is safe without `DATABASE_URL`. Optional integration tests against a real DB can be gated with `describe.skipIf(!process.env.DATABASE_URL)` or a separate `npm run test:integration` script if you add them later.

## Random local seed (QA)

For richer local data (mixed player kinds, multiple games, **waiting list** overflow), use the random seed script — **not** the same as `prisma db seed`.

**Guards (required):** set `NODE_ENV=development` **or** `IRBA_ALLOW_RANDOM_SEED=1`, otherwise the script exits without touching the database.

**Destructive reset (optional):** `IRBA_SEED_RESET=1` deletes **all** rows in `Attendance`, `Player`, and `GameSession` before inserting.

```bash
# Typical local run (append to existing data — may warn if players already exist)
IRBA_ALLOW_RANDOM_SEED=1 npm run db:seed:random

# Clean slate then random data
IRBA_ALLOW_RANDOM_SEED=1 IRBA_SEED_RESET=1 npm run db:seed:random
```

Optional environment variables:

| Variable | Purpose |
|----------|---------|
| `IRBA_RANDOM_PLAYERS` | Number of players to create (default `28`, max `80`) |
| `IRBA_SEED_FAKER_SEED` | Fixed seed for reproducible random data |

## npm scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Development server (desktop only — see note above) |
| `npm run build` | Production build |
| `npm start` | Production server — writes PID to `.next.pid` (required for mobile / tunnel testing) |
| `npm stop` | Kill the running production server (reads `.next.pid`) |
| `npm run web` | Expose the already-running server via a Cloudflare quick tunnel |
| `npm run startweb` | Start the production server in the background, then open a Cloudflare tunnel |
| `npm test` | Vitest (unit tests) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Vitest with coverage |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | `prisma migrate deploy` |
| `npm run db:seed` | Deterministic sample data (`prisma/seed.ts`) |
| `npm run db:seed:random` | Random QA seed (`scripts/seed-random.ts`) |
| `npm run hash-admin-password` | Prompts for a password, then updates `ADMIN_PASSWORD_HASH` in `.env` (add `--print-only` to stdout only; `--env-file=path` for another file) |
| `npm run generate-admin-secret` | Generates a random `ADMIN_SESSION_SECRET` and writes it to `.env` (rotating it logs the admin out) |

## Security notes

- Never commit real secrets; keep them in `.env` (gitignored). Use strong values in production for `POSTGRES_PASSWORD`, `RSVP_SESSION_SECRET`, `ADMIN_SESSION_SECRET`, `ADMIN_PASSWORD_HASH`, and any API keys.
- `RSVP_SESSION_SECRET` (min 32 characters) signs the HTTP-only RSVP session cookie (`jose` HS256). JWTs include fixed `iss` / `aud` claims (overridable via `RSVP_JWT_ISSUER` / `RSVP_JWT_AUDIENCE`) so tokens from another deployment are rejected. Rotating the secret logs everyone out until they RSVP again.
- **`RSVP_COOKIE_SECURE`**: set to `1` or `true` when the app is served over HTTPS but `NODE_ENV` is not `production` (for example staging behind a TLS proxy). Otherwise `Secure` cookies follow `NODE_ENV === "production"`.
- **TLS**: terminate HTTPS in front of the app (reverse proxy, load balancer, or PaaS). The Compose setup exposes plain HTTP on port 3000. Configure the proxy to send `X-Forwarded-Proto: https` and a correct client IP (`X-Forwarded-For`, `X-Real-IP`, or `CF-Connecting-IP` behind Cloudflare).
- **Rate limits**: RSVP attend and cancel actions, and **admin login**, are limited per client IP using an in-memory sliding window (`IRBA_RL_*` and `IRBA_RL_ADMIN_LOGIN_*` in `.env.example`). Limits apply per Node process and reset on restart; if you run multiple app replicas, add a shared store (for example Redis) later.
- **HTTP headers**: baseline security headers are set in `next.config.ts` (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`). Content Security Policy is not enabled yet to avoid breaking Next.js defaults; add it with nonces when you tighten further.
