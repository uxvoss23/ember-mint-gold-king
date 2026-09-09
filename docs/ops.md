# Upset City — env and migrations

Canonical env list: `env.example` (keep `.env.example` identical if you keep a local copy). Never commit secrets. Never put server secrets in `VITE_*` (those are public).

## Environment

| Variable | Where | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | server | unset | Required on Vercel. Unset → PGLite in preview/dev only. |
| `VITE_AUTH_ENABLED` | client | on | `"false"` disables sign-in (dev user). Refuse this against a real DB. |
| `VITE_DEMO_MODE` | client | off | `"true"` allows labeled seed/demo data. |
| `VITE_MATCH_MODE` | client | on | `"false"` hides Match Mode. Likes persist on the server. |
| `VITE_PUBLIC_HOSTNAME` | inject | — | Set on publish. Do not invent a local `.env` for it. |
| `ALLOW_PGLITE` | server | unset | Emergency local production-mode preview only. |
| `MODERATOR_EMAILS` | server | unset | Extra emails granted `player.role = moderator` on first admin action. |

Admin court editing uses `player.role = moderator` (migration `0011_moderator_role.sql`). Bootstrap emails: `seanvoss23@gmail.com` plus `MODERATOR_EMAILS`. Enforced in `requireModerator` (`src/lib/auth/moderator.server.ts`). Regular accounts never see the pencil. Role is omitted from public player payloads.

## Migrations

Additive SQL in `migrations/`, applied in name order.

| File | What |
|---|---|
| `0001_auth.sql` | Better Auth tables |
| `0002_core_loop.sql` | Players, games, messages |
| `0003_integrity.sql` | Score submission locks |
| `0004_moderation.sql` | Block / report |
| `0005_checkin.sql` | Check-in / no-show |
| `0006_profile.sql` | Profile completion |
| `0007_court_social.sql` | Reviews, work orders, hoop check-ins |
| `0008_court_admin.sql` | Court overrides + photos |
| `0009_friends_dm.sql` | Friends / DMs |
| `0010_court_search_cache.sql` | Durable Overpass cache |
| `0011_moderator_role.sql` | `player.role` moderator |
| `0012_match_mode.sql` | Match Mode availability + likes |
| `0013_rate_limit.sql` | Application rate-limit counters |

Federated OAuth secrets live in `GROK_AUTH_CLIENT_SECRET` (or `GROK_PREVIEW_CLIENT_SECRET`). They are never committed. If unset, Google/X is disabled. Rotate any previously leaked preview secret as an owner action.

- Production: `npm run db:migrate` (also runs at the end of `npm run build`).
- Preview: PGLite applies the same files on startup (`src/lib/db.ts`).
- Never edit an already-applied file. Add `0012_….sql`.

## Logging

Server logs are JSON lines from `appLog` (`src/lib/log.ts`). Events: `auth.*`, `game.*`, `courts.*`, `profile.*`. Emails, tokens, cookies, photos, and raw GPS are stripped.

## Repo hygiene

`.gitignore` excludes `artifacts/`, `screenshots/`, `attachments/`, `.vercel/output/`, and `.env`. Do not commit those.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, lint (`src`, max 50 warnings), unit tests, migrations, production build, preview smoke, and Playwright acceptance (`npm run test:e2e`).

