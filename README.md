# Upset City

Austin-first 1v1 basketball. Find someone near your level, pick a court, play, confirm the score, and climb toward the #1 crown.

**Who it’s for:** players 17+ in Austin. Four tabs: Courts, Play, Leaderboard, Me.

## Architecture

TanStack Start + Vite, Better Auth, Postgres (Neon in production, PGLite in local/preview). Competitive state lives in the database. Device-only: favorite courts.

## Local setup

```bash
npm ci
npm run dev
```

App listens on port 8080. Copy `env.example` for the env list. Do not commit `.env` or secrets.

Auth-off PGLite (`VITE_AUTH_ENABLED=false`) seeds a `dev-user` auth row so games can be created locally. That path is refused when `DATABASE_URL` is set.

## Environment

See `env.example` and `docs/ops.md`. Server secrets never go in `VITE_*`.

Required for production: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GROK_AUTH_CLIENT_ID`, `GROK_AUTH_CLIENT_SECRET`.

## Migrations

Additive SQL in `migrations/`, applied in name order (`npm run db:migrate`). Never edit an applied file.

## Tests

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
npm run test:smoke
npm run test:e2e
```

## Production build / start

```bash
npm run build
ALLOW_PGLITE=true npm run preview
# starts the Node production server from .output (or the Vercel artifact)
# HOST=0.0.0.0 PORT=8080
```

Production (`NODE_ENV=production` or `VERCEL`) without `DATABASE_URL` fails closed unless `ALLOW_PGLITE=true`.

## Security / privacy owner actions

- Rotate and revoke the previously committed OAuth preview secret. Inject the new secret via env only.
- Choose and configure an email provider for reset / verification (not in-repo).
- Legal review of Privacy, Terms, and Safety pages before public launch.
- Add WAF / bot protection at the host.
