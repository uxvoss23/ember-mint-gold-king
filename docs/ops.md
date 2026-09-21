# Upset City — env and migrations

Canonical env list: `env.example` (keep `.env.example` identical if you keep a local copy). Never commit secrets. Never put server secrets in `VITE_*` (those are public).

## Environment

| Variable | Where | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | server | unset | Required in production (`NODE_ENV=production` or `VERCEL`). Unset in `vite dev` → PGLite. |
| `ALLOW_PGLITE` | server | unset | Must be exactly `true` to use PGLite when running a production-mode preview (`npm run preview`). CI sets this deliberately. |
| `VITE_AUTH_ENABLED` | client | on | `"false"` disables sign-in (dev user). Refuse this against a real DB. |
| `VITE_DEMO_MODE` | client | off | `"true"` allows labeled seed/demo data. |
| `VITE_MATCH_MODE` | client | on | `"false"` hides Match Mode. Likes persist on the server. |
| `VITE_PUBLIC_HOSTNAME` | inject | — | Set on publish. Do not invent a local `.env` for it. |
| `MODERATOR_EMAILS` | server | unset | Extra emails granted `player.role = moderator` on first admin action. |
| `RESEND_API_KEY` | server | unset | Sends password-reset, verification, and game-alert email. |
| `MAIL_FROM` | server | `Upset City <noreply@upsetcity.app>` | Verified Resend from-address. |
| `VAPID_PUBLIC_KEY` | server | unset | Web Push public key. Required for iPhone PWA push in production. |
| `VAPID_PRIVATE_KEY` | server | unset | Web Push private key. Never put in `VITE_*`. |

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
| `0014_court_photo.sql` | Court photo blobs (`court_photo`) |
| `0015_test_users.sql` | Admin test users + impersonation |
| `0016_game_chat_threads.sql` | Private host↔player game threads |
| `0017_notices.sql` | In-app alerts: invite, opponent lock-in, score confirm, DM |
| `0018_safety.sql` | Report kind / game / message refs |
| `0019_push.sql` | Web push subscriptions |

Federated OAuth secrets live in `GROK_AUTH_CLIENT_SECRET` (or `GROK_PREVIEW_CLIENT_SECRET`). They are never committed. If unset, Google/X is disabled. Rotate any previously leaked preview secret as an owner action.

- Production: `npm run db:migrate` (also runs at the end of `npm run build`).
- Preview: PGLite applies the same files on startup (`src/lib/db.ts`).
- Never edit an already-applied file. Add `0012_….sql`.

## Functional baseline

Known-good checkpoint for UI/design work:

- Git tag: `checkpoint/e2e-47-two-account`
- Restore branch: `baseline/e2e-47-two-account`
- Commit: `a8f741a` (`Keep signed-in players, fail closed without DATABASE_URL, and prove the two-account confirm loop.`)
- `npm run test:e2e` — **47 required checks, 0 fail**

Do not change competitive rules, auth/session behavior, rating timing, score validation, or persistence in a design pass. Restore with `git checkout checkpoint/e2e-47-two-account` if a visual refactor breaks the journey.

Required two-account path that must keep passing:

account isolation → discover/join → messaging → invalid 1–0/1–0 rejected → valid series submitted → opponent confirmation → ratings update only after confirmation.

## Logging

Server logs are JSON lines from `appLog` (`src/lib/log.ts`). Events: `auth.*`, `game.*`, `courts.*`, `profile.*`. Emails, tokens, cookies, photos, and raw GPS are stripped.

## Repo hygiene

`.gitignore` excludes `artifacts/`, `screenshots/`, `attachments/`, `.vercel/output/`, and `.env`. Do not commit those.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, lint (`src`, max 50 warnings), unit tests, migrations, production build, then `npm run preview` against **that artifact** (not `vite dev`). `scripts/wait-http.mjs` waits for HTTP 200 before Playwright.

Local production:

```
npm run build
npm run preview          # node .output/server/index.mjs on 0.0.0.0:8080
node scripts/wait-http.mjs http://127.0.0.1:8080/
```

`npm run build` copies PGLite’s `pglite.wasm` / `pglite.data` / `initdb.wasm` next to the bundled server module (needed for local/CI PGLite; Neon production does not use them). Do not use `vite preview` for the production app.

Vercel builds with `VERCEL=1` and still emit `.vercel/output`.

