# Deployment

Two production paths: **Docker** (self-hosted, one compose stack) or **Vercel + Neon** (serverless). Pick one.

## Path A - Docker (self-hosted)

`docker-compose.yml` runs the whole stack: `postgres:17-alpine` → one-shot `prisma migrate deploy` → Express API → nginx serving the SPA and proxying `/api` (same-origin cookies work unchanged).

**Zero-config (images from Docker Hub, all env baked as defaults):**

```bash
docker compose pull     # phoenixdev100/vaultory-{backend,frontend}:1.0.0
docker compose up -d    # app on http://localhost:5173
```

**Build & publish the images yourself:**

```bash
docker login
docker compose build   # multi-stage: backend node:24-alpine runtime, frontend nginx:1.27-alpine
docker compose push    # pushes both app images
```

- Every env var in the file is `${VAR:-default}` - the baked `SESSION_SECRET` / `VAULT_WRAP_SECRET` / `POSTGRES_PASSWORD` are private-install defaults; override all three for anything public.
- `SESSION_SECRET` / `VAULT_WRAP_SECRET`: generate your own with `openssl rand -base64 48` if you don't want the shipped defaults.
- The `api` container runs `prisma migrate deploy` at boot (idempotent); `depends_on: service_healthy` keeps it waiting until Postgres accepts connections.
- Data lives in the `pgdata` named volume - `docker compose down` keeps it; `down -v` wipes it.
- Behind a real domain/TLS proxy: set `APP_URL` + `CORS_ORIGINS` to `https://your-domain`, point the proxy at the `web` service port, keep `TRUST_PROXY=true` (already set in compose).
- Mail: set `EMAIL_TRANSPORT=smtp` + `SMTP_*` and `REQUIRE_EMAIL_VERIFICATION=true` in `.env`; `console` transport sends nothing and is fine for private installs.
- Upgrades: `docker compose pull && docker compose up -d` - the api entrypoint applies new migrations on each start.
- Backend image is multi-stage (`deps` → `build` → `migrate`/`runtime`), runs as a non-root user, and carries a `/api/health` healthcheck. The web image is `nginx:1.27-alpine` with `frontend/nginx.conf` (gzip, hashed-asset caching, SPA fallback, `/api` proxy, security headers).

## Path B - Vercel + Neon

Two deployables: the Express API (serverless) and the Vite SPA. Neon provides the Postgres database both dev and prod share nothing with.

### 1. Neon

1. Create a project at <https://neon.tech> - a database `vaultory` on the default `neondb` cluster is fine.
2. Copy **both** connection strings from the dashboard:
   - `DATABASE_URL` → the **-pooler** host (PgBouncer). Used by the app at runtime.
   - `DIRECT_URL` → the direct host. Used only by `prisma migrate`.
3. Apply the schema from a machine that has the repo:

   ```bash
   cd backend
   cp .env.example .env   # paste the two URLs + a SESSION_SECRET
   npm install
   npx prisma migrate deploy
   ```

4. Verify: `npx prisma studio` should open on empty `User`/`Secret` tables - or hit `/api/health` after the API deploys.

## 2. API project (backend/)

Create a Vercel project with **root directory `backend/`**.

- `api/index.ts` is discovered as a serverless function; `vercel.json` rewrites every request to it. Express still sees the original path, so `/api/health` works.
- `postinstall` runs `prisma generate`, so the generated client exists at build time. No other build step is needed (`@vercel/node` compiles the TS entrypoint).

- Environment variables (Project → Settings → Environment Variables):

  ```
  NODE_ENV=production
  DATABASE_URL=...pooler...
  DIRECT_URL=...direct...
  SESSION_SECRET=<openssl rand -base64 48>
  VAULT_WRAP_SECRET=<openssl rand -base64 48>  # escrow key for reset recovery - back it up; rotating orphans escrowed keys
  SESSION_TTL_DAYS=30
  AUTO_LOCK_MINUTES=15          # default for new accounts; users can override (0-480)
  APP_URL=https://<web-project-domain>
  CORS_ORIGINS=https://<web-project-domain>
  TRUST_PROXY=true
  CROSS_SITE_COOKIES=true         # REQUIRED - web + API are different sites on Vercel, sessions need SameSite=None
  EMAIL_TRANSPORT=smtp            # smtp | resend | console(testing only)
  EMAIL_FROM="Vaultory <verified-sender@yourdomain>"
  SMTP_HOST=smtp-relay.brevo.com  # or your provider
  SMTP_PORT=587
  SMTP_SECURE=false
  SMTP_USER=...
  SMTP_PASS=...
  REQUIRE_EMAIL_VERIFICATION=true  # needs a real transport; console + required is rejected at boot
  ```

- Deploy, then check `https://<api-domain>/api/health` → `{ "status": "ok" }`.

## 3. Web project (frontend/)

Create a second Vercel project with **root directory `frontend/`**.

- Framework preset: **Vite** (build `npm run build`, output `dist`).
- One environment variable (Project → Settings → Environment Variables):

  ```
  VITE_API_BASE_URL=https://<api-project-domain>/api
  ```

  The SPA calls the API directly on its own origin - no proxy config, no file edits.
- `vercel.json` has a single rewrite sending everything to `index.html` (SPA routing) - a refresh on `/vault/…` never 404s; Vercel still serves real files (assets, `sw.js`, `logo.png`) before falling through to it.
- Because the two projects are different sites, session cookies need `CROSS_SITE_COOKIES=true` on the API (SameSite=None + Secure) and the web origin in `CORS_ORIGINS`. Note for strict-privacy browsers: Safari/Firefox may block third-party cookies - the Docker path or a shared domain avoids that entirely.

## 4. Smoke test on the deployed pair

1. `https://<web-domain>/signup` - create an account (Argon2id takes a few seconds; that's intended).
2. Create a secret, reload the tab → the vault stays unlocked (the key is restored from IndexedDB); `Lock vault` → password unlocks.
3. In the Neon console, confirm the `Secret.ciphertext` column is opaque `v1.<nonce>.<b64>` - no plaintext fields.
4. `Settings → Sessions` lists the current session; `Sign out` then sign back in.

## Migrations on release

`prisma migrate deploy` is intentionally **not** run inside the Vercel build (serverless filesystem + pooled connection quirks). Run it from a dev machine or CI job using `DIRECT_URL` before/after deploying API changes:

```bash
cd backend && npx prisma migrate deploy
```

Schema changes are additive-only in practice (new tables/columns); deploy the migration before the API release that needs it.

## Encrypted attachments

File attachments (`.env`, PEM/PPK, keystores, VPN configs) are stored as AES-256-GCM ciphertext in the Postgres `Attachment` table - **no object storage or filesystem is required**, which keeps the Vercel + Neon path intact. Limits: 2 MiB plaintext per file (≈2.7 MB base64 over the wire, inside Vercel's ~4.5 MB request cap) and 20 files per secret. Database size grows with stored ciphertext - on Neon free tier (0.5 GB) that is roughly 150 max-size attachments; the practical answer for larger files is a dedicated object store with the same encrypt-in-browser scheme.

## Local production-mode run

```bash
cd backend && npm run build && NODE_ENV=production npm start   # serves API only
cd frontend && npm run build && npm run preview                # serves SPA
```

`npm run preview` serves the SPA on :4173 but has no `/api` proxy - for a full local prod simulation, keep `vite dev` for the frontend or add a reverse proxy.
