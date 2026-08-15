# Upset City — Full Source Codebase

Copy everything below. This is the complete application source as of export.
**Not included:** `node_modules/`, `package-lock.json`, binary images under `public/` (court photos / player faces).
After copy: recreate files by path, run `npm install`, then `npm run dev`.

**File count:** 91

---

## FILE: `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100
}
```

## FILE: `AGENTS.md`

```md
# App Builder Workspace

You are Grok Build, running **inside an isolated sandbox** (a Linux container)
seeded for app generation. Read this fully before writing code.

The **user only talks to you through the Grok web client**. They have **no
shell, SSH, filesystem, or tool access** to this sandbox. Your job is to build
and run the app **here** so their **in-browser live preview** — relayed from this
workspace — works, without asking them to do anything on their own machine.

User prompts are often **short and casual** (e.g. `build minecraft`, `todo app`,
`dashboard`). Interpret intent generously and ship a **playable / demo-quality**
product — not a scaffold with TODOs.

---

## 0. Two worlds (read this first)

| | **You (agent)** | **User (web client)** |
| --- | --- | --- |
| Where | This Linux sandbox (`/workspace`) | Grok chat UI in their browser |
| Can do | Run tools, edit files, start servers, curl, Playwright | Chat with you; watch a **live preview** of the app |
| Access to the other side | You never see their browser/desktop | They **cannot** run commands, open your terminal, or browse `/workspace` |
| How they see the app | You serve it on **`0.0.0.0:8080`** in this sandbox | A preview proxy auto-discovers that server and streams it into a **live preview** in the web client |

The preview **updates as you edit and save**, so the user watches the app take
shape in real time. It is their **entire** view of your work — if it's blank,
broken, or ugly, that is their whole experience.

**Implications:**

- Success = app **running on `0.0.0.0:8080`** in this sandbox, **verified by
  you**, with the **dev server left up** so their preview keeps working.
- Never treat the user as a local developer with Docker, ports, or a terminal.
- Never ask them to open `localhost`, map ports, install Node, run `npm`, paste
  screenshots, or "check if it works on their side."
- **Speak in product terms** ("your todo app is running in the preview") — never
  sandbox ops ("I bound `0.0.0.0:8080` in the container"). To the user, ports,
  paths, `localhost`, "container", tool names, and `curl` are meaningless noise.

---

## Project instructions

If `AGENTS.project.md` exists in this workspace, it contains the user's
project instructions; follow it with the same priority as this file.

---

## 1. Your environment / workspace (for you, never surfaced to the user)

### Where you are

| Item | Value |
| --- | --- |
| Working directory | `/workspace` (project root) |
| OS | Linux container, **Node 22** (not the user's OS) |
| App must listen on | **`0.0.0.0:8080`** — how the live preview finds your app |
| How you check the app | `http://127.0.0.1:8080` **from inside this container** (curl / browser tools / Playwright) |
| How the **user** sees the app | Live preview in the **web client** (automatic once something serves on 8080) — not a URL you invent for them |
| Auth / CLI | `grok` + credentials injected for you |
| Persistence | Sandbox may be **stopped, restarted, or replaced**; `/workspace` is your app state for this run |
| Process restart contract | **`/workspace/startup.sh`** — you own this file; the platform re-runs it after hibernate/revive |

**Why `0.0.0.0:8080` matters:** the preview proxy auto-discovers your dev server
by probing common ports and prefers a server bound on **all interfaces**.
Binding `0.0.0.0:8080` makes your app the reliable preview pick. Don't bind
loopback-only, and don't pick another port unless you truly must.

### `/workspace/startup.sh` (required — you maintain this)

The sandbox can **hibernate and revive** (snapshot restore). After revive, the
platform runs **`/workspace/startup.sh`** to bring long-running processes back
(dev server, workers, anything the live preview needs). You **must** keep this
file correct for the app you are building.

**Rules (non-negotiable):**

1. **Path is fixed:** always `/workspace/startup.sh` (project root). Do not
   rename, move, or replace with a different entrypoint path.
2. **You write it** — the workspace does **not** ship this file. Create
   `/workspace/startup.sh` yourself in the same turn you first bring the
   preview up; do not claim the app is running without it.
3. **Keep it in sync** with how the app actually starts. If you change the
   start command, port, env, or add background workers the preview needs,
   **update `startup.sh` in the same turn**.
4. **Idempotent:** safe to re-run when processes are already up (e.g. probe
   `http://127.0.0.1:8080/` and exit 0 if healthy; only start what is down).
5. **Non-blocking:** start long-running processes in the **background** so the
   script **returns quickly** — do not leave the script foreground-blocked on
   the dev server forever.
6. **Bind the preview:** the primary app must end up listening on
   **`0.0.0.0:8080`** (same contract as `npm run dev` in this template).
7. **No secrets in the file** that shouldn't live in the workspace snapshot.
8. **Do not delete** the file when cleaning up or re-scaffolding.

Example shape (write this yourself; adjust when your start path changes):

```sh
#!/bin/sh
set -eu
cd /workspace
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
```

When you start the dev server during a turn, write/update `startup.sh` first,
then run `sh /workspace/startup.sh` (or the same commands it contains) so
revive and live work stay identical.

### What is already here

- **`package.json`** + **`node_modules/`** — deps **preinstalled**. Avoid
  `npm install` unless you truly need a new package. The full inventory in
  `package.json` is fair game (`date-fns`, `tw-animate-css`,
  `class-variance-authority`, `@tanstack/react-table`, …) — check it before
  assuming something is missing.
- **Playwright + Chromium** — installed for **you** to open and exercise the
  running app (see §3).
- **`screenshots/`** — write agent QA screenshots here (never under `/tmp`).
- **`vite.config.ts` + `tsconfig.json`** — preconfigured (preview port
  contract, Vercel build preset, strict TS with `@/*` → `src/*`). Edit if you
  must, but keep the port and the build-gated nitro plugin (see §"Build &
  deploy target").
- **No app routes/UI yet** — only the pre-wired `src/lib` data/auth helpers
  (see "Data & auth"), `src/lib/error-component.tsx` (the router's
  `defaultErrorComponent`), and `src/components/created-with-grok-banner.tsx`
  (platform branding bar); build the app around them, don't delete them.
  `npm run dev` errors until you create the entry files — start from
  §"First scaffold" below.
- **Port contract** — `npm run dev` binds **`0.0.0.0:8080`**. Prefer 8080 over
  5173/3000 so the preview reliably picks your app.

### What you can / cannot install

| Allowed | Not available |
| --- | --- |
| `npm install` / `npm i` for **JS packages** (registry works). Prefer packages already in `package.json` when possible. | **`apt` / `apt-get` / `yum` / system package managers** — do not try; they will not work here |
| Node 22, Playwright Chromium (for your QA), preinstalled app deps | OS-level libs, compilers, or native toolchains via the shell |
| Docs / web search for APIs and how-tos | Trial-and-error install loops when something is missing — search first, then use an npm or pure-browser approach |

- Need a JS dependency (including game engines like `three` / Phaser) → **npm**
  and leave it in `package.json` for deploy.
- Dependency install scripts (`preinstall` / `postinstall`) are off by default, so
  `npm install` never runs a package's own code. `npm run dev|build|typecheck`
  are unaffected. If a package needs its postinstall — a native module that
  compiles or downloads a binary, e.g. `better-sqlite3` — install it once with
  `GROK_ALLOW_INSTALL_SCRIPTS=1 npm install <pkg>`. Prefer a pure-JS alternative.
- Prefer pure browser / Node / already-baked deps over anything that needs a
  system package.

### First scaffold — required entry files

The installed TanStack Start resolves `src/router.tsx` with a **named
`getRouter` export** (older `createRouter`-default-export / `app/`-directory
conventions are rejected by the plugin — don't trust stale priors; these
snippets match the installed version). Create these files first, exactly in this
shape, then build your app out from them.

**Shell (required before `npm run dev` works):**

```tsx
// src/router.tsx
import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen"; // generated on first dev/build

export function getRouter() {
  return createRouter({ routeTree, defaultErrorComponent: AppErrorComponent });
}
```

Always pass `defaultErrorComponent: AppErrorComponent` (baked at
`src/lib/error-component.tsx`) — without it a runtime crash shows the
framework's raw red-on-black error banner. Restyle it to match the app's
design tokens if you define them, but keep the real `error.message` visible.

```tsx
// src/routes/__root.tsx — the document shell
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { CreatedWithGrokBanner } from "@/components/created-with-grok-banner";
import appCss from "../styles.css?url";

const APP_NAME = "My App";
const host = import.meta.env.VITE_PUBLIC_HOSTNAME;
const ogImage = host
  ? `https://og.grok.me/v1/card.png?host=${encodeURIComponent(host)}&title=${encodeURIComponent(APP_NAME)}`
  : undefined;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      ...(ogImage
        ? [
            { property: "og:image", content: ogImage },
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
          ]
        : []),
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {/* Keep this banner — platform branding; visibility is deploy-controlled. Do not remove. */}
        <CreatedWithGrokBanner />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
```

Keep `og:image` in `head` when you rename the app: update `APP_NAME` (tab title and share card). `VITE_PUBLIC_HOSTNAME` is injected on publish — do not invent a `.env` for it. Live preview has no host, so no image tag (text-only unfurl is fine). See the **`og` skill** (`.grok/skills/og/SKILL.md`).

**Platform branding bar (required — do not remove).** The template ships
`src/components/created-with-grok-banner.tsx` — a fixed top bar (`h-9` /
`2.25rem`) with "Created with Grok" and an optional Remix control. Mount it
once at the top of `<body>` in `__root.tsx` as above. When the banner is
visible it sets `--grok-banner-h` on `:root` so sibling layouts can offset
content (e.g. `pt-9` on the root shell, or
`min-h-[calc(100dvh-var(--grok-banner-h))]`) and avoid a permanent scrollbar
under the bar.

Hard rules:

1. **Always keep the mount** in `__root.tsx` (`<CreatedWithGrokBanner />` near
   the top of `<body>`). Do not delete the component file, comment out the
   mount, hide it with CSS, or "clean it up" during refactors.
2. **Never remove or disable the banner in code** because the user asked to
   hide "Created with Grok", remove branding, take off the Remix button, or
   similar. That is controlled by **project settings**, not by editing the
   template.
3. **If the user asks to remove/hide the banner or Remix control**, refuse to
   change the code for that purpose. Tell them clearly to update **project
   settings** instead (e.g. turn off "Built with Grok" / forking in the app's
   project settings). You may still edit the rest of their app as requested.
4. Visibility is env-driven (do not hardcode off):
   - Banner: `VITE_SHOW_BUILT_WITH_GROK=true` (defaults **off**, including live
     preview / `vite dev`; only shown when deploy injects the flag).
   - Remix: `VITE_ALLOW_FORKING=true` (defaults **off**).
   - Remix link: `VITE_PROJECT_ID=<uuid>`.
   - Deploy injects only `VITE_*` names from project settings (required for the
     client bundle after hydration).

```tsx
// src/routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <main className="p-8">Hello</main>;
}
```

Plus `src/styles.css` starting with `@import "tailwindcss";`. Add a base rule so
buttons show a pointer cursor — Tailwind v4's Preflight makes `<button>` default
to `cursor: default`:

```css
@layer base {
  button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer; }
}
```

**Auth routes (required — sign-in is ON by default, including live preview).**
Copy the snippets from the **`auth` skill** (`.grok/skills/auth/SKILL.md`).
The live-preview popup is **already wired** by the template Vite plugin
(`vite.config.ts` → `/auth/popup` via `popup.server.ts`) — **do not create
`src/routes/auth/popup.tsx`** (a React page there shows the app in the popup).

1. `src/routes/api/auth/$.ts` — mounts Better Auth at `/api/auth/*`
2. `src/routes/login.tsx` — provider buttons via `signIn(providerId)`

Server functions: `createServerFn` + `authMiddleware`, input via `.validator()` —
the current API on the installed version (`.inputValidator()` is deprecated);
examples in the `neon` and `auth` skills.

### Stack (high level)

React 19, TypeScript, Vite 8, TanStack Start / Router / Query / Table, Tailwind
v4, core Radix set, zustand, zod + react-hook-form, lucide, sonner, cmdk, vaul,
recharts. Data + auth: Postgres (`pg` + PGLite fallback) + self-hosted Better
Auth federated to the shared Grok auth broker (Google, X; plus optional local
email/password), pre-wired in `src/lib` — see "Data & auth" below.

### Data & auth

Postgres + authentication are **preinstalled** and pre-wired in `src/lib`
(don't reinstall). The **DB** is dual-mode: real **Neon** when `DATABASE_URL` is
set, else a local **PGLite** fallback, so the preview always renders. **Auth is
real and ON by default even in the live preview** — it federates via a baked
shared preview client — so build real sign-in; do **NOT** scaffold demo/mock
users. Full guides + snippets: the **`neon` skill** (database) and the
**`auth` skill** (sign-in), under `.grok/skills/`.

- **DB (server-only):** `const sql = await getSql()` from `@/lib/db` — a **regular
  Postgres driver** (node-postgres, `pg`) when `DATABASE_URL` is set, else a local
  **PGLite** fallback. Use only in `createServerFn` / server loaders. In preview,
  PGLite **bootstraps at server start** (`ensureDbReady`) — do not remove that.
- **Security (per-user data):** authorize every server function with
  `authMiddleware` (`@/lib/auth/middleware`):
  `createServerFn().middleware([authMiddleware])` hands the handler a
  **verified** `context.userId` (resolved from the same-origin session; throws
  when signed out). Scope **every** query by that `user_id`. Never trust a
  client-sent id.
- **Migrations:** `migrations/*.sql` are the single schema source — applied to
  **Neon on deploy** (`npm run build` runs them, so Vercel ships with the schema
  ready) and to the **PGLite** preview automatically on startup. `0001_auth.sql`
  is the Better Auth schema (don't edit); add your app's tables as ordered files
  (`migrations/0002_*.sql`), not inline.
- **Auth:** this app runs its own Better Auth at `/api/auth/*` and federates to
  the shared Grok auth broker for **Google** and **X**. The only other supported
  method is this app's own **email/password** (local Better Auth, off by default —
  enable only via `src/lib/auth/email-password.ts`; **never rewrite**
  `src/lib/auth/server.ts`); no other methods are supported (no other social
  providers, magic links, passkeys, OTP/phone). Add two routes — the API route
  `src/routes/api/auth/$.ts` and a sign-in page. The live-preview popup path
  `/auth/popup` is already handled by the Vite plugin — **never** add a React
  route for it. Then read the user via `useCurrentUser()`
  (`@/lib/auth/use-current-user`) and gate UI with `SignedIn` / `SignedOut` /
  `UserButton` (`@/lib/auth/gates`). See the **`auth` skill**. Real sign-in
  works in preview, so a visitor is signed out until they sign in — don't fake
  a user.
- **Env:** do **not** create a `.env` file. Live preview needs none — auth uses
  the baked preview client and the DB falls back to PGLite. On deploy the
  platform injects `DATABASE_URL` + per-app auth creds. Set
  `VITE_AUTH_ENABLED=false` only to turn sign-in OFF. Never expose server-only
  vars to the client (only `VITE_`-prefixed reach the browser).
- **AI features (chat, images, video, voice):** when `XAI_API_KEY` is in the
  env, the app has real xAI API access (server-only; latest model `grok-4.5`,
  docs at [docs.x.ai](https://docs.x.ai)) — chat/LLM **plus Imagine
  (image/video generation) and Voice (text-to-speech)** at runtime. The key
  spends the **app owner's quota** — keep calls user-initiated and capped.
  See the **`xai-api` skill** (`.grok/skills/xai-api/SKILL.md`) before
  building any AI feature. Don't mock AI responses or use another provider.

### Build & deploy target

You never trigger the deploy yourself, **but the app you build is eventually
deployed to Vercel** by the platform — so your output must **build cleanly under
Vercel's process**. `npm run build` must succeed and emit valid output, and code
that works under `npm run dev` but breaks a production / SSR build is a bug:
watch for dev-only deps, server-only Node APIs run at import time, runtime
filesystem writes, and hard-coded ports / hosts / secrets. Before treating the
app as done, confirm `npm run build` and `npm run typecheck` pass — that's what
Vercel runs.

The workspace **ships a ready `vite.config.ts` and `tsconfig.json`** — don't
recreate them. The vite config binds the preview port and gates
`nitro({ preset: "vercel" })` on `command === "build"` so it never runs in dev
(left on in dev, nitro opens a second dev-server port, which breaks the
single-port 8080 live preview). If you edit it, preserve both properties.

```bash
npm run dev         # 0.0.0.0:8080 — run in background when ready; leave it up
npm run build
npm run typecheck
```

Helper for visual smoke (preinstalled Playwright):

```bash
# Ships in the workspace at scripts/browser-smoke.mjs:
# Writes under /workspace/screenshots/ by default (never /tmp).
node scripts/browser-smoke.mjs http://127.0.0.1:8080/
```

---

## 2. What kinds of asks you might get

| Kind | Example user text | You should deliver |
| --- | --- | --- |
| One-liner product | `build minecraft`, `clone twitter` | Full in-browser experience, polished enough to **play / demo** in preview |
| Named app genre | todo, dashboard, chat UI, landing page | Working UI + state, not wireframes |
| Game / interactive | voxels, clicker, puzzle, kart, flight | Canvas/WebGL/DOM — self-contained single-player (or + bots). For 2-8 player co-op/casual realtime, use the **`multiplayer-p2p` skill** (WebRTC mesh; not for competitive/cheat-sensitive play). For WASD / vehicle / flight, open **`.grok/skills/controls/SKILL.md`** before writing movement (inverted A/D is a common ship-blocker) and use **`building-games`** for loop/3D |
| Iterate | "make it darker", "add levels" | Edit in place; keep the dev server up so the preview stays live |
| Vague | "something cool" | Pick one coherent app and ship it |

You are an **app builder**. Success = app **running on :8080**, **verified by
you**, **server left running** for the user's live preview — not a design doc, and
not a hand-off that needs them to run anything.

### Generated art (2D only)

- When the product needs illustration (heroes, empty states, textures, icons),
  generate **2D** assets via the image tools — follow the **`imagine`** skill
  (`image_gen` / `image_edit` prompt-craft). Image tools do **not** create 3D
  models; use geometry/glTF for interactive 3D (`building-games`).
- **Game art quality (doctrine, not the pipeline):** for any game sprites, sheets,
  animations, tiles, or UI art, load **`game-asset-core`**
  (`.grok/skills/game-asset-core/SKILL.md`) plus the matching specialist:
  **`game-animation-frames`** (motion / loop laws), **`game-tilesets`** (seamless
  tiles / transitions), **`game-character-consistency`** (turnarounds / variants),
  **`game-ui-icons`** (HUD / buttons / icon sets). These cover engine-ready
  defaults, blind verify, and retry discipline — **not** a substitute for the
  sandbox pipeline skills below, and not a substitute for implementing the app.
- **2D game sprites / animation sheets** (characters, walk cycles, attacks,
  projectiles, FX, props): run **`generate2dsprite`**
  (`.grok/skills/generate2dsprite/SKILL.md`) — solid **`#FF00FF`** magenta sheets
  + local chroma postprocess scripts. That magenta key is **required** for the
  processor (do not invent a different “keyable” color when using this path).
  Layer **`game-asset-core`** (+ **`game-animation-frames`** /
  **`game-character-consistency`** when relevant) for QC and defaults. Do **not**
  ship code-drawn placeholder sprites when the game needs real art.
- **2D maps / levels / prop packs** (top-down RPG, side-scroller stages,
  layered maps, collision zones): follow **`generate2dmap`**
  (`.grok/skills/generate2dmap/SKILL.md`). Default engine target is browser
  (`raw_canvas` / Phaser), not Godot/Unity. Tileable ground/walls → also
  **`game-tilesets`** for seamlessness checks.
- **Denser motion from video** (optional, Grok-only): run **`video2dsprite`**
  (`.grok/skills/video2dsprite/SKILL.md`) — `image_to_video` → ffmpeg → magenta
  chroma scripts. Prefer `generate2dsprite` for crisp production sheets. Use
  **`game-animation-frames`** for loop / flip-test / motion laws; use
  **`video2dsprite`** (not ad-hoc ffmpeg only) for the sandbox execution path.
- For games with movement, steering, or flight: follow the **`controls`** skill
  (`.grok/skills/controls/SKILL.md`) for player-visible A/D signs and a mandatory
  self-test (A = left under a chase cam). Genre files alone are not enough.
- **Never** use a generated mock of the UI as a substitute for implementing and
  running the app for the live preview.

---

## 3. What might happen & how to execute

### Lifecycle

- Usually a **fresh** `/workspace` (template + `node_modules` only).
  **`/workspace/startup.sh` is not pre-seeded** — you create it.
- The sandbox is kept up so the user can use the **live preview** — **leave
  the app processes running** when you finish (dev server on `:8080`).
- **Hibernate / revive:** if the sandbox is snapshotted and restored, the
  platform re-runs **`/workspace/startup.sh`** (if present). Your job on every
  turn is to ensure that file exists and still starts whatever the preview needs.
- **Follow-up turns (multi-turn continuity):** when the preview is already
  running, **edit in place** — don't kill the dev server or re-scaffold unless
  truly necessary (e.g. files were wiped, or the change is too big to patch
  cleanly). Vite HMR pushes source edits to the preview instantly; restart the
  server **only** for `vite.config` / dependency changes (and update
  `startup.sh` if the restart command changes). Killing the server blanks the
  user's preview mid-session.
- A **reboot / recreate** may wipe app files back to the template; re-scaffold
  if needed and **restore `startup.sh`** before verifying the preview.
- Headless loop: no user in your TTY. Do **not** block on questions they can't
  answer from the chat UI alone (ports, paths, shell output, screenshots from
  *your* tools).

### Parallel work (subagents / multiple agents)

When you split work across subagents or parallel tasks on **one** app:

1. **Establish the shared contract first** (routes, main data types, design
   tokens / layout shell, package deps) in the main agent or a first sequential
   step — **before** parallel writes.
2. Assign **non-overlapping surfaces** (e.g. page A vs page B, or data layer vs
   one feature UI) so agents don’t invent competing schemas or duplicate
   components.
3. Do **not** launch several agents that each invent their own API shapes,
   folder layout, or visual system for the same product.
4. After parallel work: integrate, fix conflicts, and verify one coherent app.

If the shared contract isn’t ready, stay sequential.

### Execution loop (default)

1. Interpret the (possibly one-line) ask into one concrete app.
2. Scaffold TanStack Start + implement for real — working UI + state, not wireframes.
   For **any** WASD / vehicle / flight: open **`.grok/skills/controls/SKILL.md`**
   **before** writing movement (A must turn left under a chase cam; do not rely on
   genre files alone).
3. Ensure **`/workspace/startup.sh`** starts the app (edit if needed), then
   run `sh /workspace/startup.sh` (or the same commands) so the dev server is
   up in the background; leave it up.
4. **Verify yourself, before the user sees it** — the preview shows whatever you
   produce, and the user uses web preview, not your localhost:
   - At least **HTTP:** `curl -sf http://127.0.0.1:8080/`.
   - Prefer also loading the page in a **browser tool / Playwright** and looking
     at it.
   - **Games with movement:** a still frame is not enough — confirm **A = left /
     D = right** while moving forward (see `controls` skill self-test). Flip one
     steer/roll sign if inverted; retest.
5. Fix blank pages, console errors, broken layout, and inverted controls.
6. Give a brief, **user-facing** summary — what you built and what to try in the
   preview. **Never** "please open localhost and tell me if it works" or "run this
   on your machine."

### Browser QA (agent-driven only; the user is not your QA)

Use whatever browser capability you have **yourself**, so quality beats
curl-only. All of this runs **in the sandbox** against `http://127.0.0.1:8080` —
it is **not** the user's Grok chat tab.

1. **Grok browser / computer-use / MCP browser tools** if listed — open
   `http://127.0.0.1:8080`, glance at the UI, screenshot if supported.
2. **`web_fetch`** on that URL for an HTML-only check.
3. **Playwright helper (preinstalled)** — simple load + screenshot.
   **Always write QA screenshots under `/workspace/screenshots/` — never `/tmp`
   or anywhere outside the workspace.** The helper defaults there; pass an
   explicit path only if you need a different name under that directory.

```bash
mkdir -p /workspace/screenshots
node scripts/browser-smoke.mjs http://127.0.0.1:8080/ /workspace/screenshots/app-builder-preview.png
# Then Read /workspace/screenshots/app-builder-preview.png if you have an image tool, and iterate if it looks wrong.
```

Depth is **your judgment**: a landing page screenshot is usually enough. For a
game with WASD / vehicles / flight, still verify control signs (A left / D right
from a chase cam) per **`.grok/skills/controls/SKILL.md`** — you don't have to
play end-to-end, but inverted A/D must not ship.

### Communication rules (avoid confusing the user)

**Do not:**

- Ask them to open `localhost`, a host port, Docker, or any URL that only works
  on *your* network.
- Ask them to run install/build commands, check a terminal, or paste
  logs/screenshots for basic QA.
- Explain internal sandbox plumbing (container paths, ports, the preview relay,
  tool names) unless they ask.
- Imply they have access to `/workspace` or your shell.
- End with "let me know if it works" as a substitute for verifying yourself.

**Do:**

- Assume their **only** way to see the app is the **web client live preview**, fed
  by whatever you leave listening on **`0.0.0.0:8080`** in this workspace.
- Keep the server running when you finish so the preview stays available.
- Describe the product ("Here's a dark todo app with drag-and-drop; try adding a
  task in the preview"), and offer next steps ("want levels, sound, or a dark theme?").
- Iterate in place on follow-ups — your edits show up live in the preview.
- If something can't work in-browser (needs native APIs you can't polyfill), say
  so clearly and ship the best web-only version.

### Quality bar

- Cohesive UI (Tailwind + Radix + lucide where relevant).
- Demo-ready on a laptop viewport (matches the typical web-client preview).
- Dev server stays up; no broken imports.
- **Production build passes** — `npm run build` (what Vercel deploys) succeeds, not just `npm run dev`.
- Prefer at least one **browser load/screenshot** when tools allow; agent decides depth.
- **Games with movement:** A/D player-correct (chase cam, A = left) per
  **`.grok/skills/controls/SKILL.md`** — not screenshot-only.
- User never blocked on an action they can't perform from chat + preview.

---

## Quick reference

```text
you:       agent in a Linux sandbox, cwd /workspace
user:      web client only — no sandbox shell, no local Docker, no terminal
startup:   OWN /workspace/startup.sh — platform re-runs it after hibernate/revive
serve:     startup.sh / npm run dev  →  bind 0.0.0.0:8080  (live preview)
verify:    YOU drive curl / browser tools / browser-smoke.mjs inside the sandbox
controls:  WASD/vehicle/flight → .grok/skills/controls/SKILL.md; A=left self-test
og:        keep og:image in root head; rename → update APP_NAME → .grok/skills/og/SKILL.md
ai:        XAI_API_KEY in env → real xAI API: chat (grok-4.5) + Imagine image/video + voice TTS (docs.x.ai) → .grok/skills/xai-api/SKILL.md
sprites:   doctrine → game-asset-core+specialist; pipeline → generate2dsprite (#FF00FF); maps → generate2dmap; dense motion → video2dsprite
shots:     write QA PNGs under /workspace/screenshots/ — never /tmp
user sees: live, auto-updating preview in the Grok web UI (never "open localhost")
say:       product terms only — never ports, paths, localhost, container, or tool names
success:   app on :8080; processes left running; startup.sh stays correct; short summary
prompt:    often one line — expand into a full product
never:     ask the user to run commands, open localhost, or QA your environment
never:     delete or abandon /workspace/startup.sh
```
```

## FILE: `eslint.config.mjs`

```js
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Flat ESLint config for the TanStack Start app-builder template. */
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      ".output/**",
      ".vercel/**",
      ".nitro/**",
      "node_modules/**",
      "src/routeTree.gen.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Disable rules that conflict with Prettier formatting.
  prettier,
);
```

## FILE: `package.json`

```json
{
  "name": "app-builder-workspace",
  "private": true,
  "sideEffects": false,
  "type": "module",
  "overrides": {
    "nf3": "0.3.17"
  },
  "scripts": {
    "dev": "vite dev --host 0.0.0.0 --port 8080",
    "build": "vite build && npm run db:migrate",
    "db:migrate": "node scripts/migrate.mjs",
    "build:dev": "vite build --mode development",
    "preview": "vite preview --host 0.0.0.0 --port 8080",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write ."
  },
  "dependencies": {
    "@electric-sql/pglite": "^0.5.3",
    "@hookform/resolvers": "^5.0.0",
    "@radix-ui/react-accordion": "^1.2.12",
    "@radix-ui/react-alert-dialog": "^1.1.15",
    "@radix-ui/react-avatar": "^1.1.11",
    "@radix-ui/react-checkbox": "^1.3.3",
    "@radix-ui/react-collapsible": "^1.1.12",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-popover": "^1.1.15",
    "@radix-ui/react-progress": "^1.1.8",
    "@radix-ui/react-radio-group": "^1.3.8",
    "@radix-ui/react-scroll-area": "^1.2.10",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-separator": "^1.1.8",
    "@radix-ui/react-slider": "^1.3.6",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-switch": "^1.2.6",
    "@radix-ui/react-tabs": "^1.1.13",
    "@radix-ui/react-toggle": "^1.1.10",
    "@radix-ui/react-toggle-group": "^1.1.11",
    "@radix-ui/react-tooltip": "^1.2.8",
    "@tailwindcss/vite": "^4.1.0",
    "@tanstack/react-query": "^5.90.0",
    "@tanstack/react-router": "^1.160.0",
    "@tanstack/react-start": "^1.160.0",
    "@tanstack/react-table": "^8.21.0",
    "@tanstack/router-plugin": "^1.160.0",
    "better-auth": "^1.4.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "date-fns": "^4.0.0",
    "kysely": "^0.28.5",
    "leaflet": "^1.9.4",
    "lucide-react": "^0.510.0",
    "maplibre-gl": "^6.1.0",
    "pg": "^8.16.3",
    "react": "^19.1.0",
    "react-day-picker": "^9.14.0",
    "react-dom": "^19.1.0",
    "react-hook-form": "^7.54.0",
    "react-resizable-panels": "^4.6.5",
    "recharts": "^2.13.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "tailwindcss": "^4.1.0",
    "tw-animate-css": "^1.3.4",
    "vaul": "^1.1.2",
    "zod": "^4.3.6",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.20.0",
    "@types/leaflet": "^1.9.22",
    "@types/node": "^22.16.5",
    "@types/pg": "^8.11.10",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^5.0.0",
    "eslint": "^9.20.0",
    "eslint-config-prettier": "^10.1.1",
    "eslint-plugin-prettier": "^5.2.6",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.20",
    "globals": "^15.15.0",
    "lightningcss": "^1.28.0",
    "nitro": "3.0.260603-beta",
    "playwright": "^1.52.0",
    "prettier": "^3.4.0",
    "typescript": "^5.7.0",
    "typescript-eslint": "^8.56.1",
    "vite": "^8.1.0"
  }
}
```

## FILE: `scripts/browser-guard.mjs`

```js
/**
 * Target checks shared by the Playwright capture scripts.
 *
 * Both run Chromium with `--no-sandbox` as root and take their URL and output
 * path from argv, so unchecked they will render `file:///root/.grok/auth.json`
 * into a PNG the agent can read, and write it anywhere.
 */
import { resolve, sep } from "node:path";

const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/** http/https loopback only, else exit 1. `BROWSER_ALLOW_EXTERNAL_HOST=1` opts out. */
export function checkedUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail(`not a valid URL: ${url}`);
  }
  // Rules out file:, data:, chrome:, view-source:.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    fail(`only http/https URLs are allowed, got ${parsed.protocol} in ${url}`);
  }
  if (
    !LOOPBACK_HOSTNAMES.has(parsed.hostname) &&
    process.env.BROWSER_ALLOW_EXTERNAL_HOST !== "1"
  ) {
    fail(
      `${parsed.hostname} is not a loopback host; these scripts screenshot the ` +
        `local dev server. Set BROWSER_ALLOW_EXTERNAL_HOST=1 to override.`,
    );
  }
  return url;
}

/** Absolute `outPng` if it is inside `allowedDirs`, else exit 1. */
export function checkedOutputPath(outPng, allowedDirs) {
  // Resolve first so `..` cannot slip past the prefix check.
  const abs = resolve(outPng);
  const allowed = allowedDirs.some(
    (dir) => abs === dir || abs.startsWith(dir.endsWith(sep) ? dir : dir + sep),
  );
  if (!allowed) {
    fail(`screenshot path must be under ${allowedDirs.join(" or ")}, got ${abs}`);
  }
  return abs;
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}
```

## FILE: `scripts/browser-smoke.mjs`

```js
#!/usr/bin/env node
/**
 * Lightweight headless load + screenshot for http://127.0.0.1:8080 (or argv URL).
 * Does not try to "play" the app — just proves the page loads and captures a PNG
 * the agent can Read. Exit 0 on success, 1 on navigation failure, 2 if console errors.
 *
 * Screenshots default under /workspace/screenshots/ (never /tmp) so they live on
 * the workspace volume and stay readable by agent tools.
 *
 * Targets are restricted (browser-guard.mjs): http/https loopback, PNG under
 * /workspace. A rejected target exits 1.
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { chromium } from "playwright";
import { checkedOutputPath, checkedUrl } from "./browser-guard.mjs";

const url = checkedUrl(process.argv[2] || "http://127.0.0.1:8080/");
const outPng = checkedOutputPath(
  process.argv[3] || "/workspace/screenshots/app-builder-preview.png",
  ["/workspace"],
);
const timeoutMs = Number(process.env.BROWSER_SMOKE_TIMEOUT_MS || 45000);

mkdirSync(dirname(outPng), { recursive: true });

const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err?.message || err)));

  const resp = await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
  const status = resp?.status() ?? 0;
  await page.waitForTimeout(1000);

  const title = await page.title();
  const hasCanvas = (await page.locator("canvas").count()) > 0;
  const bodyTextLen = (await page.locator("body").innerText().catch(() => "")).trim().length;

  await page.screenshot({ path: outPng, fullPage: false });

  console.log(
    JSON.stringify(
      {
        url,
        status,
        title,
        hasCanvas,
        bodyTextLen,
        consoleErrors,
        pageErrors,
        screenshot: outPng,
      },
      null,
      2,
    ),
  );

  if (status >= 400 || status === 0) process.exit(1);
  if (pageErrors.length || consoleErrors.length) process.exit(2);
  process.exit(0);
} catch (err) {
  console.error(JSON.stringify({ ok: false, url, error: String(err?.message || err) }, null, 2));
  process.exit(1);
} finally {
  await browser.close();
}
```

## FILE: `scripts/migrate.mjs`

```js
#!/usr/bin/env node
/**
 * Deploy-time database migrator (node-postgres, `pg`).
 *
 * Runs during `npm run build` — on every Vercel deploy — applying pending files
 * in ../migrations to DATABASE_URL. Each file is applied in one transaction and
 * recorded in a `_migrations` table, so it runs once and is safe to re-run.
 *
 * No DATABASE_URL (local / preview builds) -> skip; the PGLite fallback applies
 * the same files at startup instead (see src/lib/db.ts).
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log(
    "[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).",
  );
  process.exit(0);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

async function main() {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    const applied = new Set(
      (await client.query("SELECT name FROM _migrations")).rows.map((r) => r.name),
    );

    let files;
    try {
      files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
    } catch {
      console.log("[migrate] no migrations/ directory — nothing to do.");
      return;
    }

    let count = 0;
    for (const name of files) {
      if (applied.has(name)) continue;
      const text = await readFile(join(migrationsDir, name), "utf8");
      try {
        await client.query("BEGIN");
        // pg's simple-query protocol runs a whole multi-statement file at once.
        await client.query(text);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
      } catch (err) {
        console.error(`[migrate] error applying ${name}`);
        try {
          await client.query("ROLLBACK");
        } catch {
          // ROLLBACK fails when the connection died — keep the original error.
        }
        throw err;
      }
      console.log(`[migrate] applied ${name}`);
      count += 1;
    }
    console.log(count ? `[migrate] done — ${count} migration(s) applied.` : "[migrate] up to date.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err?.message || err);
  // pg errors carry the context needed to debug a bad SQL file.
  for (const key of ["code", "detail", "hint", "position", "where"]) {
    if (err?.[key] != null) console.error(`[migrate]   ${key}: ${err[key]}`);
  }
  process.exit(1);
});
```

## FILE: `scripts/preview-thumbnail.mjs`

```js
#!/usr/bin/env node
// Capture a 1280x800 preview PNG of the dev server (argv[2] -> argv[3]).
// Contract with SandboxInternal.CapturePreviewThumbnail: exit 0 only after the
// PNG is written; the service treats any non-zero exit as a gated skip and does
// not download the file.
import { chromium } from "playwright";
import { checkedOutputPath, checkedUrl } from "./browser-guard.mjs";

// The service always passes a loopback URL and a /tmp path; the checks keep that
// true when the script is invoked by hand.
const url = checkedUrl(process.argv[2] || "http://127.0.0.1:8080/");
const outPng = checkedOutputPath(process.argv[3] || "/tmp/preview-thumbnail.png", [
  "/tmp",
  "/workspace",
]);
const timeoutMs = Number(process.env.PREVIEW_THUMBNAIL_TIMEOUT_MS || 45000);

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // `domcontentloaded`, not `networkidle`: Vite keeps an HMR websocket open, so
  // networkidle never settles and would burn the whole timeout.
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  const status = resp?.status() ?? 0;
  await page.waitForTimeout(1000);

  await page.screenshot({ path: outPng, fullPage: false });

  console.log(JSON.stringify({ url, status, screenshot: outPng }, null, 2));
} catch (err) {
  console.error(JSON.stringify({ ok: false, url, error: String(err?.message || err) }, null, 2));
  // Set the code rather than process.exit() so the `finally` browser teardown
  // always runs (avoids leaking Chromium across repeated capture calls).
  process.exitCode = 1;
} finally {
  await browser.close();
}
```

## FILE: `src/components/admin-court-editor.tsx`

```tsx
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  ImagePlus,
  Pencil,
  Star,
  Trash2,
  X,
} from "lucide-react";
import type { Court, CourtAmenity, CourtSurface } from "@/lib/courts/types";
import {
  mergeCourtWithOverride,
  useCourtAdmin,
  type CourtFieldOverride,
} from "@/lib/courts/admin-overrides";
import { compressWorkOrderPhoto } from "@/components/work-order-popup";
import { courtImagesFor } from "@/lib/courts/images";
import { cn } from "@/lib/utils";

const SURFACES: CourtSurface[] = ["concrete", "asphalt", "rubber", "unknown"];
const AMENITIES: { id: CourtAmenity; label: string }[] = [
  { id: "lights", label: "Lights" },
  { id: "full_court", label: "Full court" },
  { id: "half_court", label: "Half court" },
  { id: "multiple", label: "Multi-court" },
  { id: "water", label: "Water" },
  { id: "parking", label: "Parking" },
  { id: "fence", label: "Fenced" },
  { id: "shade", label: "Shaded" },
];

/**
 * Admin-only court editor: details + dedicated preview photo + gallery.
 */
export function AdminCourtEditor({
  court,
  open,
  onClose,
}: {
  court: Court;
  open: boolean;
  onClose: () => void;
}) {
  const ov = useCourtAdmin((s) => s.overrides[court.id]);
  const setFields = useCourtAdmin((s) => s.setFields);
  const setPreview = useCourtAdmin((s) => s.setPreview);
  const addGalleryPhotos = useCourtAdmin((s) => s.addGalleryPhotos);
  const replaceGalleryPhoto = useCourtAdmin((s) => s.replaceGalleryPhoto);
  const removeGalleryPhoto = useCourtAdmin((s) => s.removeGalleryPhoto);

  const merged = mergeCourtWithOverride(court, ov);
  const [name, setName] = useState(merged.name);
  const [address, setAddress] = useState(merged.address ?? "");
  const [neighborhood, setNeighborhood] = useState(merged.neighborhood ?? "");
  const [notes, setNotes] = useState(merged.notes ?? "");
  const [surface, setSurface] = useState<CourtSurface>(merged.surface);
  const [hoops, setHoops] = useState(String(merged.hoops ?? ""));
  const [amenities, setAmenities] = useState<CourtAmenity[]>([
    ...(merged.amenities ?? []),
  ]);
  const [lightsHours, setLightsHours] = useState(merged.lightsHours ?? "");
  const [hours, setHours] = useState(merged.hours ?? "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const previewCam = useRef<HTMLInputElement>(null);
  const previewLib = useRef<HTMLInputElement>(null);
  const galleryCam = useRef<HTMLInputElement>(null);
  const galleryLib = useRef<HTMLInputElement>(null);
  const replaceIdx = useRef<number | null>(null);
  const replaceCam = useRef<HTMLInputElement>(null);
  const replaceLib = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const m = mergeCourtWithOverride(court, ov);
    setName(m.name);
    setAddress(m.address ?? "");
    setNeighborhood(m.neighborhood ?? "");
    setNotes(m.notes ?? "");
    setSurface(m.surface);
    setHoops(String(m.hoops ?? ""));
    setAmenities([...(m.amenities ?? [])]);
    setLightsHours(m.lightsHours ?? "");
    setHours(m.hours ?? "");
    setSaved(false);
  }, [open, court.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || typeof document === "undefined") return null;

  const photos = ov?.photos;
  const preview = photos?.preview;
  const gallery = photos?.gallery ?? [];
  // What users currently see
  const livePreview =
    preview ?? courtImagesFor(court.id, 1, photos)[0];

  const saveDetails = () => {
    const fields: CourtFieldOverride = {
      name: name.trim() || court.name,
      address: address.trim() || undefined,
      neighborhood: neighborhood.trim() || undefined,
      notes: notes.trim() || undefined,
      surface,
      hoops: hoops.trim() ? Number(hoops) : undefined,
      amenities,
      lightsHours: lightsHours.trim() || undefined,
      hours: hours.trim() || undefined,
    };
    setFields(court.id, fields);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const pickFiles = async (
    files: FileList | File[] | null,
    mode: "preview" | "gallery" | "replace",
  ) => {
    const list = files
      ? Array.from(files).filter((f) => f.type.startsWith("image/"))
      : [];
    if (!list.length) return;
    setBusy(true);
    try {
      if (mode === "preview") {
        // preview is a single dedicated slot — use first selected
        const url = await compressWorkOrderPhoto(list[0]!);
        setPreview(court.id, url);
      } else if (mode === "gallery") {
        const urls: string[] = [];
        for (const f of list) {
          urls.push(await compressWorkOrderPhoto(f));
        }
        addGalleryPhotos(court.id, urls);
      } else if (mode === "replace" && replaceIdx.current != null) {
        const url = await compressWorkOrderPhoto(list[0]!);
        replaceGalleryPhoto(court.id, replaceIdx.current, url);
        replaceIdx.current = null;
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleAmenity = (id: CourtAmenity) => {
    setAmenities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/75 backdrop-blur-sm"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        className="slide-up relative z-10 flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-bg-elevated shadow-soft sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-wide text-court uppercase">
              Admin · edit court
            </p>
            <h3 className="truncate font-display text-base font-semibold text-fg">
              {merged.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full border border-border text-fg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-3 pb-6">
          {/* Preview slot */}
          <section>
            <div className="mb-1.5 flex items-center gap-1.5">
              <Star className="size-3.5 text-gold" strokeWidth={2} />
              <p className="text-xs font-bold text-fg">Preview photo</p>
              <span className="text-[10px] text-fg-subtle">
                · first image on cards & carousel
              </span>
            </div>
            <div className="relative overflow-hidden rounded-xl border-2 border-gold/40 bg-bg-subtle">
              {livePreview ? (
                <img
                  src={livePreview}
                  alt="Preview"
                  className="aspect-[16/10] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[16/10] items-center justify-center text-xs text-fg-muted">
                  No preview yet
                </div>
              )}
              {preview ? (
                <button
                  type="button"
                  onClick={() => setPreview(court.id, undefined)}
                  className="absolute top-2 right-2 rounded-full bg-black/55 p-1.5 text-white"
                  aria-label="Remove custom preview"
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                ref={previewCam}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  void pickFiles(e.target.files, "preview");
                  e.target.value = "";
                }}
              />
              <input
                ref={previewLib}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void pickFiles(e.target.files, "preview");
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => previewCam.current?.click()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg py-2 text-xs font-semibold"
              >
                <Camera className="size-3.5" />
                Take
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => previewLib.current?.click()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg py-2 text-xs font-semibold"
              >
                <ImagePlus className="size-3.5" />
                {preview ? "Replace" : "Upload"}
              </button>
            </div>
          </section>

          {/* Gallery */}
          <section>
            <p className="mb-1.5 text-xs font-bold text-fg">
              Gallery photos{" "}
              <span className="font-normal text-fg-subtle">
                · select multiple at once
              </span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {gallery.map((src, i) => (
                <div
                  key={`${i}-${src.slice(0, 24)}`}
                  className="relative aspect-square overflow-hidden rounded-lg border border-border bg-bg-subtle"
                >
                  <img src={src} alt="" className="size-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex gap-0.5 bg-black/50 p-0.5">
                    <button
                      type="button"
                      className="flex-1 rounded py-0.5 text-[9px] font-bold text-white"
                      onClick={() => {
                        replaceIdx.current = i;
                        replaceLib.current?.click();
                      }}
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white"
                      onClick={() => removeGalleryPhoto(court.id, i)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => galleryLib.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-bg-subtle text-[10px] font-semibold text-fg-muted"
              >
                <ImagePlus className="size-4" />
                Add
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                ref={galleryCam}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => {
                  void pickFiles(e.target.files, "gallery");
                  e.target.value = "";
                }}
              />
              <input
                ref={galleryLib}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void pickFiles(e.target.files, "gallery");
                  e.target.value = "";
                }}
              />
              <input
                ref={replaceCam}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  void pickFiles(e.target.files, "replace");
                  e.target.value = "";
                }}
              />
              <input
                ref={replaceLib}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void pickFiles(e.target.files, "replace");
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => galleryCam.current?.click()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-semibold"
              >
                <Camera className="size-3.5" />
                Take for gallery
              </button>
            </div>
          </section>

          {/* Details */}
          <section className="space-y-2.5">
            <p className="text-xs font-bold text-fg">Court details</p>
            <label className="block text-[11px] font-medium text-fg-muted">
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-court"
              />
            </label>
            <label className="block text-[11px] font-medium text-fg-muted">
              Address
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-court"
              />
            </label>
            <label className="block text-[11px] font-medium text-fg-muted">
              Neighborhood
              <input
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-court"
              />
            </label>
            <label className="block text-[11px] font-medium text-fg-muted">
              Upset City description
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-court"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] font-medium text-fg-muted">
                Surface
                <select
                  value={surface}
                  onChange={(e) => setSurface(e.target.value as CourtSurface)}
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-2 text-sm text-fg outline-none"
                >
                  {SURFACES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] font-medium text-fg-muted">
                Hoops
                <input
                  inputMode="numeric"
                  value={hoops}
                  onChange={(e) => setHoops(e.target.value.replace(/\D/g, ""))}
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-court"
                />
              </label>
            </div>
            <label className="block text-[11px] font-medium text-fg-muted">
              Lights hours
              <input
                value={lightsHours}
                onChange={(e) => setLightsHours(e.target.value)}
                placeholder="e.g. dusk–10pm"
                className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-court"
              />
            </label>
            <label className="block text-[11px] font-medium text-fg-muted">
              Park hours
              <input
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g. 6am–10pm"
                className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-court"
              />
            </label>
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-fg-muted">
                Amenities
              </p>
              <div className="flex flex-wrap gap-1.5">
                {AMENITIES.map((a) => {
                  const on = amenities.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAmenity(a.id)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        on
                          ? "bg-court text-white"
                          : "border border-border bg-bg-subtle text-fg-muted",
                      )}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t border-border p-3">
          <button
            type="button"
            onClick={saveDetails}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-fg text-sm font-semibold text-bg"
          >
            {saved ? "Saved" : "Save court details"}
          </button>
          <p className="mt-1.5 text-center text-[10px] text-fg-subtle">
            Photos save as soon as you add or replace them.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Small pencil control — only render for admin */
export function AdminEditCourtButton({
  court,
  className,
}: {
  court: Court;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "flex size-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm hover:bg-black/50",
          className,
        )}
        aria-label={`Edit ${court.name}`}
        title="Edit court (admin)"
      >
        <Pencil className="size-3.5" strokeWidth={1.75} />
      </button>
      <AdminCourtEditor
        court={court}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
```

## FILE: `src/components/admin-work-orders.tsx`

```tsx
import { useMemo, useState } from "react";
import { Archive, ClipboardList, Wrench } from "lucide-react";
import {
  useCourtSocial,
  WORK_ORDER_LABELS,
  WORK_ORDER_STATUS_LABELS,
  type WorkOrder,
  type WorkOrderStatus,
} from "@/lib/courts/social";
import { isAdminEmail } from "@/lib/auth/admin";
import { cn } from "@/lib/utils";

const ACTIVE_STATUSES: WorkOrderStatus[] = [
  "submitted",
  "received",
  "in_progress",
];

const ALL_STATUSES: WorkOrderStatus[] = [
  "submitted",
  "received",
  "in_progress",
  "resolved",
];

function OrderCard({
  w,
  setStatus,
  archived,
}: {
  w: WorkOrder;
  setStatus: (id: string, status: WorkOrderStatus) => void;
  archived?: boolean;
}) {
  return (
    <li className="rounded-xl border border-border bg-bg px-3 py-2.5">
      <div className="flex items-start gap-2">
        {(() => {
          const thumbs = w.photos?.length
            ? w.photos
            : w.photoUrl
              ? [w.photoUrl]
              : [];
          if (!thumbs.length) {
            return <Wrench className="mt-0.5 size-3.5 shrink-0 text-fg-muted" />;
          }
          return (
            <div className="flex shrink-0 gap-1">
              {thumbs.slice(0, 3).map((src, i) => (
                <a
                  key={i}
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                >
                  <img
                    src={src}
                    alt=""
                    className="size-12 rounded-lg object-cover ring-1 ring-border"
                  />
                </a>
              ))}
            </div>
          );
        })()}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">
            {WORK_ORDER_LABELS[w.kind]}
          </p>
          <p className="truncate text-xs text-fg-muted">
            {w.courtName ?? w.courtId}
            {w.reporter ? ` · ${w.reporter}` : ""}
          </p>
          {w.detail ? (
            <p className="mt-1 text-xs leading-snug text-fg-muted">{w.detail}</p>
          ) : null}
          <p className="mt-1 text-[10px] text-fg-subtle">
            {new Date(w.at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {(w.photos?.length ?? (w.photoUrl ? 1 : 0)) > 0 ? ` · ${w.photos?.length ?? 1} photo${(w.photos?.length ?? 1) === 1 ? "" : "s"}` : ""}
            {archived ? " · archived" : ""}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {(archived ? ALL_STATUSES : ACTIVE_STATUSES.concat("resolved")).map(
          (st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatus(w.id, st)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                w.status === st
                  ? st === "resolved"
                    ? "bg-success/20 text-success"
                    : "bg-court text-white"
                  : "bg-bg-subtle text-fg-muted",
              )}
            >
              {st === "resolved" && !archived
                ? "Resolve · archive"
                : WORK_ORDER_STATUS_LABELS[st]}
            </button>
          ),
        )}
      </div>
    </li>
  );
}

/**
 * Admin-only inbox. Resolved tickets leave the active list and live under Archive.
 */
export function AdminWorkOrders({ email }: { email: string | null | undefined }) {
  const workOrders = useCourtSocial((s) => s.workOrders);
  const setStatus = useCourtSocial((s) => s.setWorkOrderStatus);
  const [view, setView] = useState<"active" | "archive">("active");

  const { active, archived } = useMemo(() => {
    const active: WorkOrder[] = [];
    const archived: WorkOrder[] = [];
    for (const w of workOrders) {
      if (w.status === "resolved") archived.push(w);
      else active.push(w);
    }
    const byDate = (a: WorkOrder, b: WorkOrder) =>
      new Date(b.at).getTime() - new Date(a.at).getTime();
    active.sort(byDate);
    archived.sort(byDate);
    return { active, archived };
  }, [workOrders]);

  if (!isAdminEmail(email)) return null;

  const list = view === "active" ? active : archived;

  return (
    <section className="rounded-2xl border border-border bg-bg-elevated p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-full bg-court-soft text-court">
          <ClipboardList className="size-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-wide text-court uppercase">
            Admin only
          </p>
          <h3 className="font-display text-sm font-semibold text-fg">
            Court work orders
          </h3>
        </div>
        {active.length > 0 ? (
          <span className="rounded-full bg-court px-2 py-0.5 text-[10px] font-bold text-white tabular-nums">
            {active.length} open
          </span>
        ) : null}
      </div>

      <div className="mb-3 flex gap-1 rounded-full border border-border bg-bg p-0.5">
        <button
          type="button"
          onClick={() => setView("active")}
          className={cn(
            "flex-1 rounded-full py-1.5 text-[11px] font-semibold",
            view === "active" ? "bg-fg text-bg" : "text-fg-muted",
          )}
        >
          Open ({active.length})
        </button>
        <button
          type="button"
          onClick={() => setView("archive")}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 text-[11px] font-semibold",
            view === "archive" ? "bg-fg text-bg" : "text-fg-muted",
          )}
        >
          <Archive className="size-3" strokeWidth={2} />
          Archive ({archived.length})
        </button>
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-fg-muted">
          {view === "active"
            ? "No open work orders. Resolved ones move to Archive."
            : "No archived work orders yet. Mark a ticket Resolved to file it here."}
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((w) => (
            <OrderCard
              key={w.id}
              w={w}
              setStatus={setStatus}
              archived={view === "archive"}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
```

## FILE: `src/components/compete/atx-cup-hub.tsx`

```tsx
/** Deprecated — ATX Cup / standings removed from product. */
export {};
```

## FILE: `src/components/compete/campaign-banner.tsx`

```tsx
import { Heart } from "lucide-react";
import {
  CAMPAIGN_CHARITY,
  CAMPAIGN_TITLE,
  CAMPAIGN_YEAR,
  campaignProgress,
  formatCampaignMoney,
  useCampaign,
} from "@/lib/upset/campaign";
import { cn } from "@/lib/utils";

/** City cause progress — Play + Media */
export function CampaignBanner({
  compact,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const raised = useCampaign((s) => s.raisedDollars);
  const goal = useCampaign((s) => s.goalDollars);
  const { pct, remaining } = campaignProgress(raised, goal);

  if (compact) {
    return (
      <div
        className={cn(
          "rounded-xl border border-violet-500/25 bg-violet-500/8 px-3 py-2",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <Heart className="size-3.5 shrink-0 text-violet-600" strokeWidth={2.5} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[11px] font-bold text-fg">
                {CAMPAIGN_TITLE}
              </p>
              <p className="shrink-0 text-[11px] font-bold tabular-nums text-violet-700 dark:text-violet-300">
                {formatCampaignMoney(raised)}
                <span className="font-medium text-fg-muted">
                  {" "}
                  / {formatCampaignMoney(goal)}
                </span>
              </p>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-violet-500/15">
              <div
                className="h-full rounded-full bg-violet-600 transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/12 via-bg-elevated to-bg-elevated p-3.5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
          <Heart className="size-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-[0.14em] text-violet-700 uppercase dark:text-violet-300">
            {CAMPAIGN_YEAR} city goal
          </p>
          <h3 className="font-display text-base font-semibold text-fg">
            {CAMPAIGN_TITLE}
          </h3>
          <p className="mt-1 text-[11px] leading-snug text-fg-muted">
            Every game can feed {CAMPAIGN_CHARITY.short}. Compete hard. Give
            clean. No peer gambling — just rating, pride, and the cause.
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-medium text-fg-subtle uppercase">
              Raised
            </p>
            <p className="font-display text-2xl font-bold tabular-nums text-violet-700 dark:text-violet-300">
              {formatCampaignMoney(raised)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium text-fg-subtle uppercase">
              Goal
            </p>
            <p className="text-sm font-bold tabular-nums text-fg">
              {formatCampaignMoney(goal)}
            </p>
          </div>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-violet-500/15">
          <div
            className="h-full rounded-full bg-violet-600 transition-[width] duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-fg-muted">
          <span className="font-semibold text-fg">{pct}%</span>
          {" · "}
          {formatCampaignMoney(remaining)} to go ·{" "}
          <a
            href={CAMPAIGN_CHARITY.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
          >
            {CAMPAIGN_CHARITY.name}
          </a>
        </p>
      </div>
    </div>
  );
}
```

## FILE: `src/components/compete/community-media-feed.tsx`

```tsx
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Heart,
  ImagePlus,
  MessageCircle,
  Plus,
  Swords,
  Trophy,
  Video,
  X,
  Zap,
} from "lucide-react";
import { CampaignBanner } from "@/components/compete/campaign-banner";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import {
  applyMention,
  fileToDataUrl,
  filterMentionCandidates,
  getMentionQuery,
  resolveMentionIds,
  useMediaFeed,
  type FeedKind,
  type FeedPost,
} from "@/lib/upset/media-feed";
import { displayRating } from "@/lib/rating/engine";
import { formatLocalWhen, useUpsetStore } from "@/lib/upset/store";
import type { Match, Player } from "@/lib/upset/types";
import { cn } from "@/lib/utils";

/** Fallback court coords when we only have homeCourtId */
/** Instagram/FB-style: show a few comments, “View all” for the rest */
const COMMENT_PREVIEW = 2;

const COURT_FALLBACK: Record<string, { name: string; lat: number; lon: number }> = {
  "cat-zilker": { name: "Zilker Park", lat: 30.2669, lon: -97.7729 },
  "cat-battle-bend": { name: "Battle Bend", lat: 30.2215, lon: -97.7678 },
  "cat-givens": { name: "Givens District Park", lat: 30.2585, lon: -97.705 },
  "cat-pease": { name: "Pease Park", lat: 30.2818, lon: -97.7525 },
  "cat-bartholomew": { name: "Bartholomew", lat: 30.3025, lon: -97.6912 },
  "cat-rosewood": { name: "Rosewood", lat: 30.2708, lon: -97.7135 },
  "cat-reed": { name: "Reed Park", lat: 30.3055, lon: -97.756 },
  "cat-circle-c": { name: "Circle C", lat: 30.186, lon: -97.889 },
  "cat-west4": { name: "West 4th", lat: 30.269, lon: -97.755 },
  "cat-garrison": { name: "Garrison", lat: 30.25, lon: -97.75 },
  "cat-walnut-creek": { name: "Walnut Creek", lat: 30.38, lon: -97.68 },
  "cat-hancock": { name: "Hancock", lat: 30.295, lon: -97.725 },
  "cat-searight": { name: "Searight", lat: 30.2, lon: -97.8 },
};

/** Split text into plain runs + @mention hits */
function mentionSegments(text: string, players: Player[]) {
  const ranked = [...players].sort((a, b) => b.name.length - a.name.length);
  const segs: { kind: "text" | "mention"; value: string; player?: Player }[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "@") {
      let hit: Player | null = null;
      let hitLen = 0;
      for (const p of ranked) {
        for (const label of [p.name, p.handle, p.name.split(" ")[0] ?? ""]) {
          if (!label) continue;
          const token = `@${label}`;
          if (
            text.slice(i, i + token.length).toLowerCase() === token.toLowerCase()
          ) {
            // require boundary after token (end or non-name char) for first-name only
            const after = text[i + token.length];
            const ok =
              !after ||
              /[\s.,!?;:)\]}]/.test(after) ||
              label.includes(" ") ||
              label === p.handle;
            if (ok && token.length > hitLen) {
              hit = p;
              hitLen = token.length;
            }
          }
        }
      }
      if (hit && hitLen > 0) {
        segs.push({
          kind: "mention",
          value: text.slice(i, i + hitLen),
          player: hit,
        });
        i += hitLen;
        continue;
      }
    }
    let j = i + 1;
    while (j < text.length && text[j] !== "@") j += 1;
    segs.push({ kind: "text", value: text.slice(i, j) });
    i = j;
  }
  return segs;
}

/** Highlight @mentions in post/comment text */
function MentionText({
  text,
  players,
  onOpenPlayer,
}: {
  text: string;
  players: Player[];
  onOpenPlayer?: (p: Player) => void;
}) {
  const segs = mentionSegments(text, players);
  return (
    <>
      {segs.map((s, idx) =>
        s.kind === "mention" && s.player ? (
          <button
            key={idx}
            type="button"
            onClick={() => onOpenPlayer?.(s.player!)}
            className="font-semibold text-court hover:underline"
          >
            {s.value}
          </button>
        ) : (
          <span key={idx}>{s.value}</span>
        ),
      )}
    </>
  );
}

/** Colored mirror layer for editor (textarea/input must use transparent text) */
function MentionHighlightLayer({
  text,
  players,
  multiline,
}: {
  text: string;
  players: Player[];
  multiline?: boolean;
}) {
  const segs = mentionSegments(text, players);
  // trailing space keeps height when empty lines; zero-width space helps caret align
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-sm leading-normal text-fg",
        multiline ? "px-3 py-2.5" : "flex items-center px-3",
      )}
    >
      {text.length === 0 ? (
        <span className="text-transparent">.</span>
      ) : (
        segs.map((s, idx) =>
          s.kind === "mention" ? (
            <span key={idx} className="font-semibold text-court">
              {s.value}
            </span>
          ) : (
            <span key={idx} className="text-fg">
              {s.value}
            </span>
          ),
        )
      )}
    </div>
  );
}

function kindLabel(kind: FeedKind) {
  switch (kind) {
    case "upset":
      return "Upset";
    case "season":
      return "League";
    case "scheduled":
      return "Locked";
    case "open":
      return "Open game";
    case "streak":
      return "Streak";
    case "top10":
      return "Top 10";
    case "user":
      return "Post";
    case "win":
    default:
      return "Win";
  }
}

function KindPill({ kind }: { kind: FeedKind }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
        kind === "upset" && "bg-danger/15 text-danger",
        kind === "win" && "bg-court-soft text-court",
        kind === "season" && "bg-bg-subtle text-fg-muted",
        kind === "scheduled" && "bg-accent/15 text-accent",
        kind === "open" && "bg-court-soft text-court",
        kind === "streak" && "bg-success/15 text-success",
        kind === "top10" && "bg-fg text-bg",
        kind === "user" && "bg-bg-subtle text-fg-muted",
      )}
    >
      {kindLabel(kind)}
    </span>
  );
}

/**
 * Open listings + locked games appear in Media (capped so the feed doesn’t flood).
 * CTA jumps into Play so you can scout the listing before accepting.
 */
function postsFromMatches(matches: Match[], players: Player[]): FeedPost[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const open = matches
    .filter((m) => m.status === "open")
    .sort(
      (a, b) =>
        new Date(b.createdAt ?? b.preferredAt).getTime() -
        new Date(a.createdAt ?? a.preferredAt).getTime(),
    )
    .slice(0, 8)
    .map((m) => {
      const host = byId.get(m.hostId);
      const when = formatLocalWhen(m.scheduledAt ?? m.preferredAt);
      const first = (host?.name ?? "Someone").split(" ")[0];
      return {
        id: `auto-match-${m.id}`,
        kind: "open" as const,
        headline: `${first} posted an open 1v1 · ${m.courtName}`,
        body: `${when}${m.notes ? ` · ${m.notes}` : " · Best of 3 · games to 11"}. Tap to open the listing, scout the host, and join if it’s a fit.`,
        playerId: m.hostId,
        playerName: host?.name ?? "Host",
        matchId: m.id,
        at: m.createdAt ?? m.preferredAt,
        likes: [],
        comments: [],
      };
    });

  const locked = matches
    .filter(
      (m) =>
        (m.status === "scheduled" || m.status === "matched") &&
        !!m.opponentId,
    )
    .slice(0, 6)
    .map((m) => {
      const host = byId.get(m.hostId);
      const opp = m.opponentId ? byId.get(m.opponentId) : undefined;
      const when = formatLocalWhen(m.scheduledAt ?? m.preferredAt);
      return {
        id: `auto-match-${m.id}`,
        kind: "scheduled" as const,
        headline: `Game locked · ${m.courtName}`,
        body: `${host?.name ?? "Host"} vs ${opp?.name ?? "opponent"} · ${when}`,
        playerId: m.hostId,
        playerName: host?.name ?? "Host",
        opponentId: m.opponentId,
        opponentName: opp?.name,
        matchId: m.id,
        at: m.scheduledAt ?? m.preferredAt,
        likes: [],
        comments: [],
      };
    });

  return [...open, ...locked];
}

function postsFromStreaks(players: Player[]): FeedPost[] {
  return players
    .filter((p) => (p.streak ?? 0) >= 3)
    .slice(0, 5)
    .map((p) => ({
      id: `auto-streak-${p.id}-${p.streak}`,
      kind: "streak" as const,
      headline: `${p.name} is on a ${p.streak}-game win streak`,
      body: `Rated 1v1 only. ${displayRating(p.rating)} · ${p.wins}W–${p.losses}L. The board is watching.`,
      playerId: p.id,
      playerName: p.name,
      at: p.lastPlayedAt ?? new Date().toISOString(),
      likes: [],
      comments: [],
    }));
}

export function CommunityMediaFeed({
  me,
  players,
  matches,
  onOpenPlayer,
  onViewMatch,
}: {
  me: Player;
  players: Player[];
  matches: Match[];
  onOpenPlayer?: (p: Player) => void;
  /** Jump to Play tab and open this listing */
  onViewMatch?: (matchId: string) => void;
}) {
  const posts = useMediaFeed((s) => s.posts);
  const createPost = useMediaFeed((s) => s.createPost);
  const toggleLike = useMediaFeed((s) => s.toggleLike);
  const addComment = useMediaFeed((s) => s.addComment);
  const store = useUpsetStore();

  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | undefined>();
  const [mediaType, setMediaType] = useState<"image" | "video" | undefined>();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  /** postIds with comments fully expanded (IG “View all comments”) */
  const [expandedComments, setExpandedComments] = useState<Set<string>>(
    () => new Set(),
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const commentRef = useRef<HTMLInputElement>(null);
  const [draftCaret, setDraftCaret] = useState(0);
  const [commentCaret, setCommentCaret] = useState(0);
  const notices = useMediaFeed((s) => s.notices);
  const markNoticesRead = useMediaFeed((s) => s.markNoticesRead);

  const mentionables = useMemo(
    () =>
      players.map((p) => ({ id: p.id, name: p.name, handle: p.handle })),
    [players],
  );

  const draftMention = useMemo(
    () => getMentionQuery(draft, draftCaret),
    [draft, draftCaret],
  );
  const draftSuggestions = useMemo(() => {
    if (!draftMention) return [];
    return filterMentionCandidates(mentionables, draftMention.query, me.id);
  }, [draftMention, mentionables, me.id]);

  const commentMention = useMemo(
    () => getMentionQuery(commentText, commentCaret),
    [commentText, commentCaret],
  );
  const commentSuggestions = useMemo(() => {
    if (!commentMention) return [];
    return filterMentionCandidates(mentionables, commentMention.query, me.id);
  }, [commentMention, mentionables, me.id]);

  const myUnread = useMemo(
    () => notices.filter((n) => n.toPlayerId === me.id && !n.read),
    [notices, me.id],
  );

  useEffect(() => {
    if (myUnread.length > 0) markNoticesRead(me.id);
  }, [myUnread.length, me.id, markNoticesRead]);

  const pickDraftMention = (p: { id: string; name: string; handle: string }) => {
    if (!draftMention) return;
    const next = applyMention(draft, draftCaret, draftMention.start, p);
    setDraft(next.text);
    setDraftCaret(next.caret);
    requestAnimationFrame(() => {
      const el = draftRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };

  const pickCommentMention = (p: { id: string; name: string; handle: string }) => {
    if (!commentMention) return;
    const next = applyMention(commentText, commentCaret, commentMention.start, p);
    setCommentText(next.text);
    setCommentCaret(next.caret);
    requestAnimationFrame(() => {
      const el = commentRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };

  const challengeFromPost = (target: Player) => {
    if (target.id === me.id) {
      setFlash("That’s you — pick someone else’s streak.");
      window.setTimeout(() => setFlash(null), 2500);
      return;
    }
    const courtId = target.homeCourtId ?? "cat-battle-bend";
    const meta = COURT_FALLBACK[courtId] ?? COURT_FALLBACK["cat-battle-bend"]!;
    const first = target.name.split(" ")[0] ?? target.name;

    // Already have a live game with them? Jump to it.
    const existing = store.matches.find((m) => {
      if (
        m.status !== "scheduled" &&
        m.status !== "matched" &&
        m.status !== "open"
      )
        return false;
      return (
        (m.hostId === me.id && m.opponentId === target.id) ||
        (m.hostId === target.id && m.opponentId === me.id)
      );
    });
    if (existing) {
      setFlash(`You already have a game with ${first} — opening it.`);
      window.setTimeout(() => setFlash(null), 2500);
      if (onViewMatch) onViewMatch(existing.id);
      else onOpenPlayer?.(target);
      return;
    }

    const r = store.challengePlayer(target.id, {
      courtId,
      courtName: meta.name,
      lat: meta.lat,
      lon: meta.lon,
      preferredAt: new Date(Date.now() + 3600e3).toISOString(),
      notes: `Streak challenge · end the ${target.streak ?? 0}-game run · ${me.name}`,
    });

    if (r.ok) {
      setFlash(`Opening ${first}’s listing — join only if you want it.`);
      window.setTimeout(() => setFlash(null), 2800);
      // Detail only — do NOT auto-accept / match
      if (onViewMatch) onViewMatch(r.match.id);
      else onOpenPlayer?.(target);
      return;
    }

    setFlash(r.reason);
    window.setTimeout(() => setFlash(null), 3200);
    // Still give a destination — open their profile to challenge / DM
    onOpenPlayer?.(target);
  };

  const feed = useMemo(() => {
    const autoMatch = postsFromMatches(matches, players);
    const autoStreak = postsFromStreaks(players);
    const storedIds = new Set(posts.map((p) => p.id));
    const auto = [...autoMatch, ...autoStreak].filter(
      (p) => !storedIds.has(p.id),
    );
    return [...posts, ...auto].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [posts, matches, players]);

  const publish = () => {
    setError(null);
    const body = draft.trim();
    if (!body && !mediaUrl) {
      setError("Write something or add a photo/video.");
      return;
    }
    const mentionedIds = resolveMentionIds(body, mentionables);
    const id = createPost({
      authorId: me.id,
      authorName: me.name,
      text: body,
      mediaUrl,
      mediaType,
      mentionedIds,
    });
    if (!id) {
      setError("Couldn’t post — try again.");
      return;
    }
    setDraft("");
    setDraftCaret(0);
    setMediaUrl(undefined);
    setMediaType(undefined);
    setComposerOpen(false);
    if (mentionedIds.length > 0) {
      const names = mentionedIds
        .map((id) => players.find((p) => p.id === id)?.name.split(" ")[0] ?? "player")
        .join(", ");
      setFlash(`Posted · notified ${names}`);
    } else {
      setFlash("Posted to Media.");
    }
    window.setTimeout(() => setFlash(null), 2800);
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setPicking(true);
    setError(null);
    try {
      const isVideo = file.type.startsWith("video/");
      // Prefer data URL for images so the post survives refresh
      if (!isVideo && file.size < 1_800_000) {
        const data = await fileToDataUrl(file);
        setMediaUrl(data);
        setMediaType("image");
      } else if (isVideo && file.size < 8_000_000) {
        const data = await fileToDataUrl(file);
        setMediaUrl(data);
        setMediaType("video");
      } else {
        // Fall back to blob preview (session only)
        setMediaUrl(URL.createObjectURL(file));
        setMediaType(isVideo ? "video" : "image");
      }
    } catch {
      setError("Couldn’t load that file.");
    } finally {
      setPicking(false);
    }
  };

  return (
    <div className="space-y-3 pb-6">

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-court uppercase">
            Media
          </p>
          <p className="text-[11px] text-fg-muted">
            Wins · upsets · streaks · locked games · your posts
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setComposerOpen(true);
            setError(null);
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-court px-3 py-1.5 text-xs font-semibold text-white"
        >
          <Plus className="size-3.5" strokeWidth={2.5} />
          Post
        </button>
      </div>

      <CampaignBanner />

      {flash ? (
        <p
          className="sticky top-0 z-10 rounded-lg border border-court/30 bg-court px-3 py-2.5 text-xs font-semibold text-white shadow-sm"
          role="status"
        >
          {flash}
        </p>
      ) : null}

      {myUnread.length > 0 ? (
        <div className="rounded-xl border border-border bg-bg-elevated px-3 py-2.5">
          <p className="text-[10px] font-bold tracking-wide text-court uppercase">
            Mentions
          </p>
          <ul className="mt-1 space-y-1">
            {myUnread.slice(0, 3).map((n) => (
              <li key={n.id} className="text-xs text-fg-muted">
                <span className="font-semibold text-fg">{n.fromPlayerName}</span>{" "}
                tagged you
                {n.snippet ? (
                  <span className="text-fg-subtle"> · “{n.snippet}”</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {composerOpen ? (
        <div className="space-y-2 rounded-2xl border border-border bg-bg-elevated p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-fg">Share with ATX</p>
            <button
              type="button"
              onClick={() => {
                setComposerOpen(false);
                setDraft("");
                setMediaUrl(undefined);
                setMediaType(undefined);
                setError(null);
              }}
              className="p-1 text-fg-muted"
              aria-label="Close composer"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="relative">
            <div className="relative rounded-xl border border-border bg-bg focus-within:border-court">
              <MentionHighlightLayer text={draft} players={players} multiline />
              <textarea
                ref={draftRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setDraftCaret(e.target.selectionStart ?? e.target.value.length);
                }}
                onKeyUp={(e) =>
                  setDraftCaret(
                    (e.target as HTMLTextAreaElement).selectionStart ?? 0,
                  )
                }
                onClick={(e) =>
                  setDraftCaret(
                    (e.target as HTMLTextAreaElement).selectionStart ?? 0,
                  )
                }
                onSelect={(e) =>
                  setDraftCaret(
                    (e.target as HTMLTextAreaElement).selectionStart ?? 0,
                  )
                }
                rows={3}
                placeholder="What’s going on in ATX…"
                className="relative z-[1] w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-normal text-transparent outline-none placeholder:text-fg-subtle"
                style={{ WebkitTextFillColor: "transparent", caretColor: "var(--color-fg, #111)" }}
              />
            </div>
            {draftSuggestions.length > 0 ? (
              <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-bg-elevated py-1 shadow-lg">
                <p className="px-3 py-1 text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
                  Tag a player
                </p>
                {draftSuggestions.map((p) => {
                  const full = players.find((x) => x.id === p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickDraftMention(p);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-bg-subtle"
                    >
                      {full ? (
                        <PlayerAvatar player={full} size="sm" className="!size-7" />
                      ) : (
                        <div className="size-7 rounded-full bg-bg-subtle" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-fg">
                          {p.name}
                        </p>
                        <p className="truncate text-[11px] text-fg-muted">
                          @{p.handle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          {mediaUrl ? (
            <div className="relative overflow-hidden rounded-xl border border-border">
              {mediaType === "video" ? (
                <video
                  src={mediaUrl}
                  controls
                  className="max-h-56 w-full bg-black object-contain"
                />
              ) : (
                <img
                  src={mediaUrl}
                  alt=""
                  className="max-h-56 w-full object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => {
                  setMediaUrl(undefined);
                  setMediaType(undefined);
                }}
                className="absolute top-2 right-2 rounded-full bg-black/55 p-1.5 text-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : null}
          {error ? (
            <p className="text-xs text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                void onPickFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={picking}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-[11px] font-semibold text-fg-muted disabled:opacity-60"
            >
              <ImagePlus className="size-3.5" />
              Photo
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={picking}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-[11px] font-semibold text-fg-muted disabled:opacity-60"
            >
              <Video className="size-3.5" />
              Video
            </button>
            <button
              type="button"
              onClick={publish}
              disabled={picking || (!draft.trim() && !mediaUrl)}
              className={cn(
                "ml-auto rounded-full px-3.5 py-1.5 text-xs font-semibold",
                draft.trim() || mediaUrl
                  ? "bg-fg text-bg"
                  : "bg-bg-subtle text-fg-subtle",
              )}
            >
              Share
            </button>
          </div>
        </div>
      ) : null}

      {feed.length === 0 ? (
        <div className="rounded-2xl border border-border bg-bg-elevated px-4 py-10 text-center">
          <p className="text-sm text-fg-muted">No posts yet.</p>
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="mt-2 text-sm font-semibold text-court"
          >
            Be first to post
          </button>
        </div>
      ) : (
        feed.map((post) => {
          const liked = post.likes.includes(me.id);
          const author =
            players.find((p) => p.id === post.playerId) ??
            (post.playerId === me.id ? me : null);
          // Auto match/streak cards are ephemeral — only store posts take likes
          const canEngage = posts.some((p) => p.id === post.id);

          return (
            <article
              key={post.id}
              className="rounded-2xl border border-border bg-bg-elevated p-3.5 pb-3.5"
            >
              <div className="flex items-start gap-2.5">
                {author ? (
                  <button
                    type="button"
                    onClick={() => onOpenPlayer?.(author)}
                    className="shrink-0"
                  >
                    <PlayerAvatar player={author} size="sm" />
                  </button>
                ) : (
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-court-soft text-court">
                    <Trophy className="size-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <KindPill kind={post.kind} />
                    <span className="text-[11px] font-semibold text-fg">
                      {post.playerName}
                    </span>
                  </div>
                  <h4 className="mt-1 text-sm font-semibold leading-snug text-fg">
                    {post.headline}
                  </h4>
                  <p className="mt-1 text-sm leading-relaxed text-fg-muted">
                    <MentionText
                      text={post.body}
                      players={players}
                      onOpenPlayer={onOpenPlayer}
                    />
                  </p>
                  {(post.mentionedIds?.length ?? 0) > 0 ? (
                    <p className="mt-1 text-[10px] text-fg-subtle">
                      Tagged{" "}
                      {post.mentionedIds!
                        .map(
                          (id) =>
                            players.find((x) => x.id === id)?.name.split(" ")[0] ??
                            "player",
                        )
                        .join(", ")}
                    </p>
                  ) : null}
                  {post.mediaUrl ? (
                    <div className="mt-2 overflow-hidden rounded-xl border border-border bg-bg-subtle">
                      {post.mediaType === "video" ? (
                        <video
                          src={post.mediaUrl}
                          controls
                          className="max-h-64 w-full object-contain"
                        />
                      ) : (
                        <img
                          src={post.mediaUrl}
                          alt=""
                          className="max-h-64 w-full object-cover"
                        />
                      )}
                    </div>
                  ) : null}
                  <p className="mt-1.5 text-[10px] text-fg-subtle">
                    {new Date(post.at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {post.kind === "streak" &&
              author &&
              author.id !== me.id ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => challengeFromPost(author)}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-court py-2.5 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
                  >
                    <Swords className="size-4" strokeWidth={2.25} />
                    Challenge {author.name.split(" ")[0]} · end the streak
                  </button>
                </div>
              ) : null}

              {post.kind === "open" && post.matchId && onViewMatch ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => onViewMatch(post.matchId!)}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-fg py-2.5 text-sm font-semibold text-bg shadow-sm active:scale-[0.99]"
                  >
                    <Zap className="size-4" strokeWidth={2.25} />
                    {post.playerId === me.id
                      ? "View your listing on Play"
                      : "View listing · see if it’s a fit"}
                  </button>
                </div>
              ) : null}

              {post.kind === "scheduled" && post.matchId && onViewMatch ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => onViewMatch(post.matchId!)}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-bg-elevated py-2.5 text-sm font-semibold text-fg active:scale-[0.99]"
                  >
                    <Zap className="size-4 text-court" strokeWidth={2.25} />
                    View game on Play
                  </button>
                </div>
              ) : null}

              <div className="mt-2 flex items-center gap-3 border-t border-border pt-2">
                <button
                  type="button"
                  disabled={!canEngage}
                  onClick={() => canEngage && toggleLike(post.id, me.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-semibold",
                    liked ? "text-court" : "text-fg-muted",
                    !canEngage && "opacity-50",
                  )}
                >
                  <Heart
                    className={cn("size-3.5", liked && "fill-current")}
                    strokeWidth={2}
                  />
                  {post.likes.length}
                </button>
                <button
                  type="button"
                  disabled={!canEngage}
                  onClick={() =>
                    canEngage &&
                    setCommentFor((id) => (id === post.id ? null : post.id))
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-semibold text-fg-muted",
                    !canEngage && "opacity-50",
                  )}
                >
                  <MessageCircle className="size-3.5" strokeWidth={2} />
                  {post.comments.length}
                </button>
              </div>

              {/* IG / FB style: like row → view-all → preview comments → composer */}
              {post.comments.length > 0 ? (
                <div className="mt-1.5 space-y-1.5">
                  {post.comments.length > COMMENT_PREVIEW &&
                  !expandedComments.has(post.id) ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedComments((prev) => {
                          const next = new Set(prev);
                          next.add(post.id);
                          return next;
                        })
                      }
                      className="text-left text-xs font-medium text-fg-muted"
                    >
                      View all {post.comments.length} comments
                    </button>
                  ) : post.comments.length > COMMENT_PREVIEW &&
                    expandedComments.has(post.id) ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedComments((prev) => {
                          const next = new Set(prev);
                          next.delete(post.id);
                          return next;
                        })
                      }
                      className="text-left text-xs font-medium text-fg-muted"
                    >
                      Hide comments
                    </button>
                  ) : null}

                  <div className="space-y-1.5">
                    {(expandedComments.has(post.id)
                      ? post.comments
                      : post.comments.slice(-COMMENT_PREVIEW)
                    ).map((c) => {
                      const cAuthor =
                        players.find((p) => p.id === c.authorId) ??
                        (c.authorId === me.id ? me : null);
                      return (
                        <div key={c.id} className="flex items-start gap-2">
                          {cAuthor ? (
                            <button
                              type="button"
                              onClick={() => onOpenPlayer?.(cAuthor)}
                              className="mt-0.5 shrink-0"
                              aria-label={`${cAuthor.name} profile`}
                            >
                              <PlayerAvatar
                                player={cAuthor}
                                size="xs"
                                showRank
                                showElite
                              />
                            </button>
                          ) : (
                            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-[10px] font-bold text-fg-muted ring-1 ring-border">
                              {(c.authorName ?? "?")
                                .split(" ")
                                .map((w) => w[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1 pt-0.5">
                            {/* IG: name + body on one flowing block */}
                            <p className="text-xs leading-snug text-fg">
                              <button
                                type="button"
                                onClick={() =>
                                  cAuthor && onOpenPlayer?.(cAuthor)
                                }
                                className="mr-1 font-semibold hover:text-court"
                              >
                                {c.authorName}
                              </button>
                              <span className="text-fg-muted">
                                <MentionText
                                  text={c.text}
                                  players={players}
                                  onOpenPlayer={onOpenPlayer}
                                />
                              </span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Always-available “Add a comment…” like IG (opens composer) */}
              {canEngage && commentFor !== post.id ? (
                <button
                  type="button"
                  onClick={() => setCommentFor(post.id)}
                  className="mt-1.5 flex w-full items-center gap-2 text-left"
                >
                  <PlayerAvatar
                    player={me}
                    size="xs"
                    showRank
                    showElite
                    className="shrink-0"
                  />
                  <span className="flex-1 rounded-full border border-border bg-bg px-3 py-2 text-xs text-fg-subtle">
                    Add a comment…
                  </span>
                </button>
              ) : null}

              {commentFor === post.id && canEngage ? (
                <div className="relative mt-1.5 space-y-1.5">
                  {commentSuggestions.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-bg-elevated py-1 shadow-md">
                      {commentSuggestions.map((p) => {
                        const full = players.find((x) => x.id === p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              pickCommentMention(p);
                            }}
                            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-bg-subtle"
                          >
                            {full ? (
                              <PlayerAvatar
                                player={full}
                                size="sm"
                                className="!size-6"
                              />
                            ) : null}
                            <span className="truncate text-xs font-semibold">
                              {p.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <PlayerAvatar
                      player={me}
                      size="xs"
                      showRank
                      showElite
                      className="shrink-0"
                    />
                    <div className="relative h-10 min-w-0 flex-1 rounded-full border border-border bg-bg focus-within:border-court">
                      <MentionHighlightLayer
                        text={commentText}
                        players={players}
                      />
                      <input
                        ref={commentRef}
                        value={commentText}
                        autoFocus
                        onChange={(e) => {
                          setCommentText(e.target.value);
                          setCommentCaret(
                            e.target.selectionStart ?? e.target.value.length,
                          );
                        }}
                        onKeyUp={(e) =>
                          setCommentCaret(
                            (e.target as HTMLInputElement).selectionStart ?? 0,
                          )
                        }
                        onClick={(e) =>
                          setCommentCaret(
                            (e.target as HTMLInputElement).selectionStart ?? 0,
                          )
                        }
                        onSelect={(e) =>
                          setCommentCaret(
                            (e.target as HTMLInputElement).selectionStart ?? 0,
                          )
                        }
                        placeholder="Add a comment…"
                        className="relative z-[1] h-full w-full rounded-full bg-transparent px-3 text-sm text-transparent outline-none placeholder:text-fg-subtle"
                        style={{
                          WebkitTextFillColor: "transparent",
                          caretColor: "var(--color-fg, #111)",
                        }}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            commentSuggestions.length === 0
                          ) {
                            const mids = resolveMentionIds(
                              commentText,
                              mentionables,
                            );
                            addComment(
                              post.id,
                              me.id,
                              me.name,
                              commentText,
                              mids,
                            );
                            setCommentText("");
                            setCommentCaret(0);
                            setExpandedComments((prev) => {
                              const next = new Set(prev);
                              next.add(post.id);
                              return next;
                            });
                          }
                          if (e.key === "Escape") {
                            setCommentFor(null);
                            setCommentText("");
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const mids = resolveMentionIds(
                          commentText,
                          mentionables,
                        );
                        addComment(
                          post.id,
                          me.id,
                          me.name,
                          commentText,
                          mids,
                        );
                        setCommentText("");
                        setCommentCaret(0);
                        setExpandedComments((prev) => {
                          const next = new Set(prev);
                          next.add(post.id);
                          return next;
                        });
                      }}
                      className="text-xs font-semibold text-court disabled:text-fg-subtle"
                      disabled={!commentText.trim()}
                    >
                      Post
                    </button>
                  </div>
                </div>
              ) : null}

            </article>
          );
        })
      )}
    </div>
  );
}
```

## FILE: `src/components/compete/compete-panel.tsx`

```tsx
import { useMemo, useState } from "react";
import {
  CalendarPlus,
  Check,
  Clock,
  Swords,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { namedAustinCourts } from "@/lib/courts/catalog";
import {
  playerMatchesFilters,
  useCompeteStore,
} from "@/lib/compete/store";
import type { GameChallenge, Player } from "@/lib/compete/types";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { cn, formatHeightInches } from "@/lib/utils";

type CompeteTab = "ladder" | "games" | "create";

export function CompetePanel() {
  const [tab, setTab] = useState<CompeteTab>("ladder");
  const store = useCompeteStore();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-bg-elevated p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-court-soft text-court">
            <Swords className="size-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-fg">
              Austin 1v1 Ladder
            </h2>
            <p className="mt-0.5 text-sm leading-relaxed text-fg-muted">
              Challenge players by rating, height, and sportsmanship. You set the
              terms — they accept if they match.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-bg-subtle p-3">
          <PlayerAvatar player={store.me} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-fg">{store.me.name}</p>
            <p className="text-xs text-fg-muted">
              {store.me.rating} rating · {formatHeightInches(store.me.heightIn)} ·{" "}
              {store.me.sportsmanship.toFixed(1)}★
            </p>
          </div>
          <div className="text-right text-xs text-fg-subtle">
            <p className="font-medium text-fg-muted">
              {store.me.wins}W – {store.me.losses}L
            </p>
            <p className="capitalize">{store.me.availability}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 rounded-full border border-border bg-bg-elevated p-1">
        {(
          [
            { id: "ladder" as const, label: "Leaderboard", icon: Trophy },
            { id: "games" as const, label: "Open games", icon: Users },
            { id: "create" as const, label: "Create", icon: CalendarPlus },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-semibold transition-colors",
              tab === t.id
                ? "bg-accent text-accent-fg"
                : "text-fg-muted hover:text-fg",
            )}
          >
            <t.icon className="size-3.5" strokeWidth={2} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "ladder" && (
        <Leaderboard
          players={store.leaderboard}
          meId={store.me.id}
          onSelect={setSelectedPlayer}
        />
      )}
      {tab === "games" && (
        <OpenGames
          games={store.openGames}
          players={store.players}
          meId={store.me.id}
          onJoin={store.joinGame}
          onCancel={store.cancelGame}
        />
      )}
      {tab === "create" && (
        <CreateGameForm
          me={store.me}
          players={store.players}
          onCreate={(g) => {
            store.createGame(g);
            setTab("games");
          }}
        />
      )}

      {selectedPlayer && (
        <PlayerSheet
          player={selectedPlayer}
          isMe={selectedPlayer.id === store.me.id}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}

function Leaderboard({
  players,
  meId,
  onSelect,
}: {
  players: Player[];
  meId: string;
  onSelect: (p: Player) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="px-1 text-xs font-medium tracking-wide text-fg-subtle uppercase">
        Highest rated · Austin
      </p>
      {players.map((p, i) => {
        const isMe = p.id === meId;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
              isMe
                ? "border-court/40 bg-court-soft"
                : "border-border bg-bg-elevated hover:border-border-strong",
            )}
          >
            <span
              className={cn(
                "w-6 text-center text-sm font-semibold tabular-nums",
                i < 3 ? "text-court" : "text-fg-subtle",
              )}
            >
              {i + 1}
            </span>
            <PlayerAvatar player={p} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">
                {p.name}
                {isMe ? " · you" : ""}
              </p>
              <p className="text-xs text-fg-muted">
                {formatHeightInches(p.heightIn)} · {p.sportsmanship.toFixed(1)}★ ·{" "}
                <span
                  className={cn(
                    "capitalize",
                    p.availability === "available" && "text-success",
                    p.availability === "busy" && "text-fg-muted",
                    p.availability === "offline" && "text-fg-subtle",
                  )}
                >
                  {p.availability}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums text-fg">{p.rating}</p>
              <p className="text-[11px] text-fg-subtle">
                {p.wins}W–{p.losses}L
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function OpenGames({
  games,
  players,
  meId,
  onJoin,
  onCancel,
}: {
  games: GameChallenge[];
  players: Player[];
  meId: string;
  onJoin: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  if (games.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-bg-elevated px-6 py-12 text-center">
        <Users className="mx-auto size-8 text-fg-subtle" strokeWidth={1.5} />
        <h3 className="mt-3 font-display text-base font-semibold text-fg">
          No open games yet
        </h3>
        <p className="mt-1 text-sm text-fg-muted">
          Create a challenge with your filters — height, rating, sportsmanship.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {games.map((g) => {
        const host = byId.get(g.hostPlayerId);
        const when = new Date(g.startsAt);
        const isHost = g.hostPlayerId === meId;
        return (
          <div
            key={g.id}
            className="rounded-2xl border border-border bg-bg-elevated p-4"
          >
            <div className="flex items-start gap-3">
              {host && <PlayerAvatar player={host} size="sm" />}
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold text-fg">
                  {g.courtName}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted">
                  <Clock className="size-3" strokeWidth={2} />
                  {when.toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
                <p className="mt-1 text-xs text-fg-subtle">
                  Host {host?.name ?? "Player"} · {host?.rating ?? "—"} rating
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip>
                {formatHeightInches(g.filters.heightMinIn)}–
                {formatHeightInches(g.filters.heightMaxIn)}
              </Chip>
              <Chip>
                {g.filters.ratingMin}–{g.filters.ratingMax} rating
              </Chip>
              <Chip>{g.filters.sportsmanshipMin.toFixed(1)}★+ sports</Chip>
            </div>

            {g.notes && (
              <p className="mt-2 text-xs leading-relaxed text-fg-muted">{g.notes}</p>
            )}

            <div className="mt-3">
              {isHost ? (
                <button
                  type="button"
                  onClick={() => onCancel(g.id)}
                  className="h-10 w-full rounded-xl border border-border text-sm font-medium text-fg-muted"
                >
                  Cancel game
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onJoin(g.id)}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-fg"
                >
                  <Check className="size-4" strokeWidth={2} />
                  Accept challenge
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-bg-subtle px-2.5 py-0.5 text-[11px] font-medium text-fg-muted">
      {children}
    </span>
  );
}

function CreateGameForm({
  me,
  players,
  onCreate,
}: {
  me: Player;
  players: Player[];
  onCreate: (
    g: Omit<GameChallenge, "id" | "createdAt" | "status" | "hostPlayerId">,
  ) => void;
}) {
  const courts = useMemo(() => namedAustinCourts(), []);
  const [courtId, setCourtId] = useState(
    () => courts.find((c) => c.id === "cat-battle-bend")?.id ?? courts[0]?.id ?? "",
  );
  const defaultWhen = useMemo(() => nextFriday7pm(), []);
  const [when, setWhen] = useState(defaultWhen);
  const [hMinFt, setHMinFt] = useState(6);
  const [hMinIn, setHMinIn] = useState(0);
  const [hMaxFt, setHMaxFt] = useState(6);
  const [hMaxIn, setHMaxIn] = useState(9);
  const [ratingMin, setRatingMin] = useState(1500);
  const [ratingMax, setRatingMax] = useState(2000);
  const [sportsMin, setSportsMin] = useState(4);
  const [notes, setNotes] = useState("Clean 1v1. Call your own fouls.");

  const filters = {
    heightMinIn: hMinFt * 12 + hMinIn,
    heightMaxIn: hMaxFt * 12 + hMaxIn,
    ratingMin,
    ratingMax,
    sportsmanshipMin: sportsMin,
  };

  const eligibleCount = players.filter(
    (p) => p.id !== me.id && playerMatchesFilters(p, filters),
  ).length;

  const court = courts.find((c) => c.id === courtId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!court) return;
    onCreate({
      courtId: court.id,
      courtName: court.name,
      lat: court.lat,
      lon: court.lon,
      startsAt: new Date(when).toISOString(),
      notes: notes.trim() || undefined,
      filters,
    });
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl border border-border bg-bg-elevated p-4"
    >
      <div>
        <label className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Court
        </label>
        <select
          value={courtId}
          onChange={(e) => setCourtId(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-xl border border-border bg-bg-subtle px-3 text-sm text-fg outline-none"
        >
          {courts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          When
        </label>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-xl border border-border bg-bg-subtle px-3 text-sm text-fg outline-none"
          required
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Height range
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <HeightPick
            label="Min"
            ft={hMinFt}
            inch={hMinIn}
            onFt={setHMinFt}
            onIn={setHMinIn}
          />
          <HeightPick
            label="Max"
            ft={hMaxFt}
            inch={hMaxIn}
            onFt={setHMaxFt}
            onIn={setHMaxIn}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Rating range
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Min"
            value={ratingMin}
            onChange={setRatingMin}
            step={50}
            min={800}
            max={2400}
          />
          <NumberField
            label="Max"
            value={ratingMax}
            onChange={setRatingMax}
            step={50}
            min={800}
            max={2400}
          />
        </div>
      </fieldset>

      <div>
        <label className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Min sportsmanship · {sportsMin.toFixed(1)}★
        </label>
        <input
          type="range"
          min={3}
          max={5}
          step={0.1}
          value={sportsMin}
          onChange={(e) => setSportsMin(Number(e.target.value))}
          className="mt-2 w-full accent-[var(--color-court)]"
        />
      </div>

      <div>
        <label className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1.5 w-full resize-none rounded-xl border border-border bg-bg-subtle px-3 py-2.5 text-sm text-fg outline-none"
        />
      </div>

      <p className="text-center text-xs text-fg-muted">
        {eligibleCount} Austin player{eligibleCount === 1 ? "" : "s"} match these
        filters
      </p>

      <button
        type="submit"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-fg active:scale-[0.98]"
      >
        <Swords className="size-4" strokeWidth={2} />
        Post challenge
      </button>
    </form>
  );
}

function HeightPick({
  label,
  ft,
  inch,
  onFt,
  onIn,
}: {
  label: string;
  ft: number;
  inch: number;
  onFt: (n: number) => void;
  onIn: (n: number) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-subtle p-2">
      <p className="mb-1 text-[10px] font-medium text-fg-subtle uppercase">{label}</p>
      <div className="flex gap-1">
        <select
          value={ft}
          onChange={(e) => onFt(Number(e.target.value))}
          className="h-9 flex-1 rounded-lg border border-border bg-bg-elevated px-1 text-sm text-fg"
        >
          {[5, 6, 7].map((f) => (
            <option key={f} value={f}>
              {f} ft
            </option>
          ))}
        </select>
        <select
          value={inch}
          onChange={(e) => onIn(Number(e.target.value))}
          className="h-9 flex-1 rounded-lg border border-border bg-bg-elevated px-1 text-sm text-fg"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i}>
              {i} in
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step: number;
  min: number;
  max: number;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium text-fg-subtle uppercase">{label}</p>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full rounded-xl border border-border bg-bg-subtle px-3 text-sm text-fg outline-none"
      />
    </div>
  );
}

function PlayerSheet({
  player,
  isMe,
  onClose,
}: {
  player: Player;
  isMe: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div className="slide-up relative z-10 w-full max-w-lg rounded-t-3xl border border-border bg-bg-elevated p-5 shadow-soft sm:rounded-3xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full border border-border text-fg-muted"
        >
          <X className="size-4" />
        </button>
        <div className="flex items-center gap-4">
          <PlayerAvatar player={player} size="lg" />
          <div>
            <h3 className="font-display text-xl font-semibold text-fg">
              {player.name}
              {isMe ? " (you)" : ""}
            </h3>
            <p className="text-sm text-fg-muted">
              @{player.handle} · {player.city}
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat label="Rating" value={String(player.rating)} />
          <Stat label="Record" value={`${player.wins}–${player.losses}`} />
          <Stat label="Height" value={formatHeightInches(player.heightIn)} />
          <Stat label="Sports" value={`${player.sportsmanship.toFixed(1)}★`} />
          <Stat label="Form" value={`${player.form}`} />
          <Stat label="Status" value={player.availability} />
        </div>
        {player.bio && (
          <p className="mt-4 text-sm leading-relaxed text-fg-muted">{player.bio}</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-subtle px-3 py-2.5 text-center">
      <p className="text-[10px] font-medium tracking-wide text-fg-subtle uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold capitalize text-fg">{value}</p>
    </div>
  );
}

function nextFriday7pm(): string {
  const d = new Date();
  const day = d.getDay();
  const daysUntilFri = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilFri);
  d.setHours(19, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
```

## FILE: `src/components/compete/court-about-sheet.tsx`

```tsx
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ImageCarousel } from "@/components/image-carousel";
import type { Court } from "@/lib/courts/types";
import { courtImagesFor } from "@/lib/courts/images";
import { cn } from "@/lib/utils";

export type AboutCourt =
  | (Court & { miles?: number })
  | {
      id: string;
      name: string;
      lat?: number;
      lon?: number;
      address?: string;
      neighborhood?: string;
      notes?: string;
      surface?: string;
      hoops?: number;
      amenities?: string[];
      miles?: number;
    };

function formatMiles(mi: number) {
  if (mi < 0.1) return "<0.1 mi";
  if (mi < 10) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}

export function courtAboutText(court: {
  name: string;
  neighborhood?: string;
  notes?: string;
  surface?: string;
  hoops?: number;
  amenities?: string[];
}) {
  if (court.notes?.trim()) return court.notes.trim();
  const bits = [
    court.neighborhood
      ? `${court.neighborhood} outdoor courts`
      : "Public outdoor courts",
    court.hoops
      ? `${court.hoops} hoop${court.hoops === 1 ? "" : "s"}`
      : null,
    court.surface && court.surface !== "unknown"
      ? `${court.surface} surface`
      : null,
  ].filter(Boolean);
  return `${bits.join(" · ")}. Upset City is still writing a full take on this spot.`;
}

/**
 * Court info popup — portaled to body so it sits above map/create scroll.
 * Image stays fixed at top; notes scroll below; actions sticky at bottom.
 */
export function CourtAboutSheet({
  court,
  onClose,
  onSelectCourt,
  isSelected = false,
}: {
  court: AboutCourt | null | undefined;
  onClose: () => void;
  onSelectCourt?: (id: string) => void;
  isSelected?: boolean;
}) {
  useEffect(() => {
    if (!court) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const prevPad = body.style.paddingRight;
    const sb = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (sb > 0) body.style.paddingRight = `${sb}px`;
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      body.style.paddingRight = prevPad;
    };
  }, [court]);

  if (!court) return null;

  const images = courtImagesFor(court.id, 5);
  const about = courtAboutText(court);
  const amenityLabels: Record<string, string> = {
    lights: "Lights",
    full_court: "Full court",
    half_court: "Half court",
    multiple: "Multiple courts",
    water: "Water",
    parking: "Parking",
    fence: "Fenced",
    shade: "Shade",
  };
  const amenities = (court.amenities ?? [])
    .map((a) => amenityLabels[a] ?? a)
    .filter(Boolean);

  const sheet = (
    <div
      className="fixed inset-0 z-[400] flex items-end justify-center bg-black/65 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="court-about-title"
      onClick={onClose}
    >
      {/* Catch scroll on backdrop so page/map doesn't move */}
      <div
        className="absolute inset-0"
        onWheel={(e) => e.preventDefault()}
        onTouchMove={(e) => e.preventDefault()}
      />
      <div
        className="relative z-10 flex max-h-[min(92dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-bg shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 bg-bg-subtle">
          <ImageCarousel
            images={images}
            alt={court.name}
            className="aspect-[16/10] w-full max-h-[36dvh]"
            showControls
            priority
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2.5 pt-10">
            <p className="text-[10px] font-bold tracking-[0.14em] text-court uppercase">
              Upset City · Court notes
            </p>
            <h3
              id="court-about-title"
              className="font-display text-lg font-semibold text-white"
            >
              {court.name}
            </h3>
            <p className="text-xs text-white/85">
              {court.neighborhood ?? "Austin"}
              {"miles" in court && typeof court.miles === "number"
                ? ` · ${formatMiles(court.miles)} away`
                : ""}
              {images.length > 1 ? ` · ${images.length} photos · swipe` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 z-20 rounded-full bg-black/55 p-1.5 text-white"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div
          className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <p className="text-sm leading-relaxed text-fg">{about}</p>
          {amenities.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {amenities.map((a) => (
                <span
                  key={a}
                  className="rounded-full border border-border bg-bg-elevated px-2 py-0.5 text-[11px] font-medium text-fg-muted"
                >
                  {a}
                </span>
              ))}
            </div>
          ) : null}
          {court.address ? (
            <p className="text-xs text-fg-subtle">{court.address}</p>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-border bg-bg p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {onSelectCourt ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full border border-border py-2.5 text-sm font-semibold text-fg"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => onSelectCourt(court.id)}
                className={cn(
                  "flex-1 rounded-full py-2.5 text-sm font-semibold text-white",
                  isSelected ? "bg-fg" : "bg-court",
                )}
              >
                {isSelected ? "Selected ✓" : "Select this court"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full bg-fg py-2.5 text-sm font-semibold text-bg"
            >
              Got it
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return sheet;
  return createPortal(sheet, document.body);
}
```

## FILE: `src/components/compete/leaderboard-panel.tsx`

```tsx
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { displayRating } from "@/lib/rating/engine";
import type { Player } from "@/lib/upset/types";
import { cn } from "@/lib/utils";

type MainTab = "rankings" | "stats";
type RankingSub = "alltime" | "weekly" | "hottest";
type StatsSub = "most_wins" | "win_pct" | "longest_streak";

interface LeaderboardPanelProps {
  players: Player[];
  meId: string;
  onOpenPlayer: (p: Player) => void;
  onOpenProfile?: () => void;
}

const STAT_CHIPS: { id: StatsSub; label: string }[] = [
  { id: "most_wins", label: "Wins" },
  { id: "win_pct", label: "Win %" },
  { id: "longest_streak", label: "Longest streak" },
];

function MoveDelta({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-success">
        <ArrowUp className="size-3" strokeWidth={2.5} />
        {delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-danger">
        <ArrowDown className="size-3" strokeWidth={2.5} />
        {Math.abs(delta)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[10px] text-fg-subtle">
      <Minus className="size-3" />
    </span>
  );
}

function sortByStat(list: Player[], sub: StatsSub): Player[] {
  return [...list].sort((a, b) => {
    switch (sub) {
      case "most_wins":
        return b.wins - a.wins || b.rating - a.rating;
      case "win_pct": {
        const pa = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
        const pb = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
        return pb - pa || b.wins - a.wins;
      }
      case "longest_streak": {
        const sa = Math.max(0, Number(a.streak) || 0);
        const sb = Math.max(0, Number(b.streak) || 0);
        return sb - sa || b.wins - a.wins;
      }
      default:
        return b.rating - a.rating;
    }
  });
}

function formatStat(p: Player, sub: StatsSub): string {
  const g = p.wins + p.losses || 1;
  switch (sub) {
    case "most_wins":
      return String(p.wins);
    case "win_pct":
      return `${Math.round((p.wins / g) * 100)}%`;
    case "longest_streak": {
      const s = Math.max(0, Number(p.streak) || 0);
      return s > 0 ? `${s}W` : "—";
    }
    default:
      return String(displayRating(p.rating));
  }
}

/** Compact city 1v1 ladder. */
export function LeaderboardPanel({
  players,
  meId,
  onOpenPlayer,
  onOpenProfile,
}: LeaderboardPanelProps) {
  const [main, setMain] = useState<MainTab>("rankings");
  const [rankSub, setRankSub] = useState<RankingSub>("alltime");
  const [statsSub, setStatsSub] = useState<StatsSub>("most_wins");

  const sortedByRating = useMemo(
    () =>
      [...players]
        .filter((p) => !p.exiled)
        .sort((a, b) => b.rating - a.rating),
    [players],
  );

  const currentRankById = useMemo(() => {
    const m = new Map<string, number>();
    sortedByRating.forEach((p, i) => m.set(p.id, i + 1));
    return m;
  }, [sortedByRating]);

  const mePlayer = players.find((p) => p.id === meId);
  const myRank = mePlayer ? (currentRankById.get(mePlayer.id) ?? 0) : 0;

  const rankedList = useMemo(() => {
    const active = players.filter((p) => !p.exiled);
    if (main === "stats") return sortByStat(active, statsSub);
    if (rankSub === "weekly") {
      return [...active]
        .map((p) => ({
          p,
          gain: p.rating - p.ratingLastWeek,
        }))
        .filter((x) => x.gain > 0)
        .sort((a, b) => b.gain - a.gain || b.p.rating - a.p.rating)
        .map((x) => x.p);
    }
    if (rankSub === "hottest") {
      return [...active]
        .filter((p) => Number(p.streak) > 0)
        .sort((a, b) => {
          const sa = Math.max(0, Number(a.streak) || 0);
          const sb = Math.max(0, Number(b.streak) || 0);
          return sb - sa || b.rating - a.rating;
        });
    }
    return sortedByRating;
  }, [main, rankSub, statsSub, players, sortedByRating]);

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold tracking-tight text-fg">
            1v1 Player Rankings
          </h2>
          <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">
            Rank only moves when you play rated 1v1 matches.
          </p>
        </div>
        {mePlayer ? (
          <button
            type="button"
            onClick={() => onOpenProfile?.()}
            className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-bg-elevated py-0.5 pr-2 pl-0.5"
            aria-label="Your profile"
          >
            <PlayerAvatar
              player={mePlayer}
              size="sm"
              className="!size-8"
              showRank={false}
              showElite
            />
            {myRank ? (
              <span className="text-[10px] font-bold tabular-nums text-court">
                #{myRank}
              </span>
            ) : null}
            <span className="text-[11px] font-semibold tabular-nums text-fg">
              {displayRating(mePlayer.rating)}
            </span>
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-0.5 rounded-full border border-border bg-bg-elevated p-0.5">
        {(
          [
            ["rankings", "Rankings"],
            ["stats", "Stats"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMain(id)}
            className={cn(
              "flex-1 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors",
              main === id ? "bg-fg text-bg" : "text-fg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {main === "rankings" ? (
        <div className="flex items-center gap-1">
          {(
            [
              ["alltime", "All time"],
              ["weekly", "Weekly"],
              ["hottest", "Hottest"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setRankSub(id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                rankSub === id
                  ? "bg-court/15 text-court"
                  : "text-fg-muted hover:bg-bg-elevated",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          {STAT_CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setStatsSub(c.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                statsSub === c.id
                  ? "bg-court/15 text-court"
                  : "text-fg-muted hover:bg-bg-elevated",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1">
        {rankedList.length === 0 ? (
          <p className="rounded-xl border border-border bg-bg-elevated px-4 py-6 text-center text-xs text-fg-muted">
            {rankSub === "weekly"
              ? "No rating climbers this week yet."
              : rankSub === "hottest"
                ? "No active win streaks."
                : "No players to show."}
          </p>
        ) : (
          rankedList.map((p, i) => {
            const place = i + 1;
            const cityRank = currentRankById.get(p.id) ?? place;
            const move =
              main === "rankings" && rankSub === "alltime"
                ? p.rankLastWeek - cityRank
                : 0;
            const weeklyGain = p.rating - p.ratingLastWeek;
            const isMe = p.id === meId;

            const isCityTop1 = cityRank === 1;
            const isCityTop10 = cityRank <= 10;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpenPlayer(p)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
                  isMe
                    ? "border-court/40 bg-court/10"
                    : "border-border bg-bg-elevated",
                )}
              >
                <span
                  className={cn(
                    "w-5 shrink-0 text-center text-xs font-bold tabular-nums",
                    isCityTop1
                      ? "text-gold"
                      : "text-fg-muted",
                  )}
                >
                  {place}
                </span>
                <PlayerAvatar
                  player={p}
                  size="md"
                  showRank={false}
                  showElite
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">
                    {p.name}
                    {isMe ? (
                      <span className="ml-1 text-[10px] font-medium text-court">
                        you
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[11px] tabular-nums text-fg-muted">
                    {main === "rankings" && rankSub === "weekly" ? (
                      <>
                        {p.weeklyWins}–{p.weeklyLosses}
                        <span className="text-fg-subtle"> · </span>
                        {displayRating(p.rating)}
                      </>
                    ) : main === "rankings" && rankSub === "hottest" ? (
                      <>
                        {displayRating(p.rating)}
                        <span className="text-fg-subtle"> · </span>
                        {p.wins}–{p.losses}
                      </>
                    ) : main === "stats" ? (
                      <>
                        {p.wins}–{p.losses}
                      </>
                    ) : (
                      <>
                        {p.wins}–{p.losses}
                        {main === "rankings" && rankSub === "alltime" ? (
                          <span className="ml-1.5 inline-flex align-middle">
                            <MoveDelta delta={move} />
                          </span>
                        ) : null}
                      </>
                    )}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-sm font-bold tabular-nums",
                    main === "rankings" &&
                      (rankSub === "weekly" || rankSub === "hottest")
                      ? "text-success"
                      : "text-fg",
                  )}
                >
                  {main === "stats"
                    ? formatStat(p, statsSub)
                    : main === "rankings" && rankSub === "weekly"
                      ? `+${Math.round(weeklyGain)}`
                      : main === "rankings" && rankSub === "hottest"
                        ? p.streak > 0
                          ? `${p.streak}W`
                          : "—"
                        : displayRating(p.rating)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
```

## FILE: `src/components/compete/match-reminders-card.tsx`

```tsx
import { useEffect, useState } from "react";
import { Bell, CalendarPlus } from "lucide-react";
import {
  downloadMatchIcs,
  googleCalendarUrl,
  markReminder,
  reminderState,
  remindersCompleted,
  scheduleBrowserReminders,
  type ReminderMatch,
} from "@/lib/match-reminders";

/**
 * One-shot card: after calendar is added (or user dismisses), it stays gone.
 */
export function MatchRemindersCard({ match }: { match: ReminderMatch }) {
  const [hidden, setHidden] = useState(() => remindersCompleted(match.id));
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tip = new Date(match.whenIso);
  const tooSoon = tip.getTime() - Date.now() < 30 * 60e3;

  // If another tab already completed it, stay hidden
  useEffect(() => {
    if (remindersCompleted(match.id)) setHidden(true);
  }, [match.id]);

  const finish = (message: string) => {
    setFlash(message);
    setHidden(true);
    window.setTimeout(() => setFlash(null), 1600);
  };

  const onCalendar = () => {
    downloadMatchIcs(match);
    markReminder(match.id, "calendar");
    finish("Added — check your calendar. Alerts: 24h & 3h before.");
  };

  const onGoogle = () => {
    window.open(googleCalendarUrl(match), "_blank", "noopener,noreferrer");
    markReminder(match.id, "calendar");
    finish("Opening Google Calendar — set 1 day + 3 hour alerts if asked.");
  };

  const onBrowser = async () => {
    setBusy(true);
    const r = await scheduleBrowserReminders(match);
    setBusy(false);
    if (r.ok) {
      // Browser alone doesn't count as full complete unless they want — still hide
      // only if they also had calendar? User said after calendar done. Keep browser optional.
      const s = reminderState(match.id);
      if (s.calendar) finish("Browser alerts on.");
      else {
        setFlash(
          "Browser alerts on. Still recommend Add to calendar for phone lock-screen pings.",
        );
        window.setTimeout(() => setFlash(null), 2500);
      }
    } else {
      setFlash(r.reason ?? "Couldn’t set browser alerts.");
      window.setTimeout(() => setFlash(null), 2500);
    }
  };

  const onDismiss = () => {
    markReminder(match.id, "dismissed");
    setHidden(true);
  };

  if (hidden) {
    if (!flash) return null;
    return (
      <p
        className="rounded-xl border border-success/30 bg-success/10 px-3 py-2.5 text-center text-xs font-medium text-success"
        role="status"
      >
        {flash}
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-court/30 bg-court-soft/30 p-3.5">
      <div className="flex items-start gap-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-court text-white">
          <Bell className="size-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">Game reminders</p>
          <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">
            Ping you <span className="font-semibold text-fg">24 hours</span> and{" "}
            <span className="font-semibold text-fg">3 hours</span> before tip-off.
            Add once — this card won’t show again.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={onCalendar}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-fg text-sm font-semibold text-bg"
        >
          <CalendarPlus className="size-4" />
          Add to phone calendar
        </button>
        <button
          type="button"
          onClick={onGoogle}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-bg-elevated text-xs font-semibold text-fg"
        >
          Open in Google Calendar
        </button>
        {!tooSoon ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onBrowser()}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border text-xs font-semibold text-fg-muted disabled:opacity-60"
          >
            <Bell className="size-3.5" />
            {busy ? "Setting…" : "Also set browser alerts"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          className="py-1 text-center text-[11px] font-medium text-fg-subtle"
        >
          Not now
        </button>
      </div>

      {flash ? (
        <p className="mt-2 text-[11px] leading-snug text-fg-muted" role="status">
          {flash}
        </p>
      ) : null}
    </div>
  );
}
```

## FILE: `src/components/compete/play-hub.tsx`

```tsx
import { useState } from "react";
import { Shield, X, Zap } from "lucide-react";
import { QuickMatchFlow } from "@/components/compete/quick-match-flow";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import type { Player } from "@/lib/upset/types";
import type { Court } from "@/lib/courts/types";
import type { Match } from "@/lib/upset/types";
import { displayRating } from "@/lib/rating/engine";
import { cn } from "@/lib/utils";

interface PlayHubProps {
  me: Player;
  players: Player[];
  courts: Court[];
  matches: Match[];
  userLat?: number;
  userLon?: number;
  onOpenProfile?: () => void;
  onCreateMatch?: (input: {
    court: { id: string; name: string; lat: number; lon: number };
    preferredAt: string;
    mode: "ranked_1v1";
    format?: import("@/lib/upset/types").MatchFormat;
    notes?: string;
    stakes?: import("@/lib/upset/types").MatchStakes;
  }) => void;
  onAcceptMatch?: (matchId: string) => "ok" | "filled" | void;
  onOpenPlayer?: (p: Player) => void;
  focusMatchId?: string | null;
  onFocusMatchConsumed?: () => void;
}

/** Play hub — Quick Match live; Squads coming soon with explainer. */
export function PlayHub({
  me,
  players,
  courts,
  matches,
  userLat,
  userLon,
  onOpenProfile,
  onCreateMatch,
  onAcceptMatch,
  onOpenPlayer,
  focusMatchId,
  onFocusMatchConsumed,
}: PlayHubProps) {
  const [squadsInfo, setSquadsInfo] = useState(false);
  /** Hide Play chrome when viewing a game or create form */
  const [immersive, setImmersive] = useState(false);

  return (
    <div className="space-y-2.5">
      {!immersive ? (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-court uppercase">
                Play
              </p>
              <h2 className="font-display text-base font-semibold leading-tight tracking-tight text-fg">
                Find a run
              </h2>
              <p className="text-[11px] text-fg-subtle">
                Rated 1v1 live · teams coming soon
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenProfile}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-bg-elevated py-0.5 pr-2.5 pl-0.5"
              aria-label="Your profile"
            >
              <PlayerAvatar player={me} size="sm" />
              <span className="text-xs font-semibold tabular-nums text-fg">
                {displayRating(me.rating)}
              </span>
            </button>
          </div>

          <div className="flex gap-1 rounded-full border border-border bg-bg-elevated p-0.5">
            <div className="flex flex-1 items-center justify-center gap-1 rounded-full bg-accent py-1.5 text-[11px] font-semibold text-accent-fg">
              <Zap className="size-3.5 shrink-0" strokeWidth={2} />
              Quick Match
            </div>
            <button
              type="button"
              onClick={() => setSquadsInfo(true)}
              className={cn(
                "relative flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 text-[11px] font-semibold",
                "text-fg-subtle/70",
              )}
              aria-label="Squads coming soon"
            >
              <Shield className="size-3.5 shrink-0 opacity-60" strokeWidth={2} />
              <span className="truncate">Squads</span>
              <span className="absolute -top-1 right-0.5 rounded-full bg-bg-subtle px-1.5 py-px text-[8px] font-bold tracking-wide text-fg-muted uppercase ring-1 ring-border">
                Coming soon
              </span>
            </button>
          </div>
        </>
      ) : null}

      <QuickMatchFlow
        me={me}
        players={players}
        courts={courts}
        matches={matches}
        userLat={userLat}
        userLon={userLon}
        onCreateMatch={onCreateMatch}
        onAcceptMatch={onAcceptMatch}
        onOpenPlayer={onOpenPlayer}
        compactHeader
        onImmersiveChange={setImmersive}
        focusMatchId={focusMatchId}
        onFocusMatchConsumed={onFocusMatchConsumed}
      />

      {squadsInfo ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="squads-soon-title"
          onClick={() => setSquadsInfo(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-bg p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-10 items-center justify-center rounded-full bg-bg-elevated ring-1 ring-border">
                  <Shield className="size-5 text-court" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-court uppercase">
                    Coming soon
                  </p>
                  <h3
                    id="squads-soon-title"
                    className="font-display text-lg font-semibold text-fg"
                  >
                    Squads
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSquadsInfo(false)}
                className="rounded-full p-1.5 text-fg-muted hover:bg-bg-elevated"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-fg">
              Build a crew of 3 or 5. Name it, claim a home court, and run as a
              unit against other Austin squads.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-fg-muted">
              We’re launching 1v1 first so everyone has a clear rating. Squad
              matchmaking and tournaments come next.
            </p>
            <button
              type="button"
              onClick={() => setSquadsInfo(false)}
              className="mt-5 w-full rounded-full bg-fg py-3 text-sm font-semibold text-bg"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

## FILE: `src/components/compete/player-avatar.tsx`

```tsx
import { useMemo } from "react";
import { Crown } from "lucide-react";
import { useUpsetStore } from "@/lib/upset/store";
import { cn } from "@/lib/utils";
import type { Player } from "@/lib/upset/types";

const TOP_N = 50;

/**
 * Face-forward avatar — real photo when available, else color + initials.
 * #1: gold ring + crown
 * #2–10: cool platinum ring (elite hoopers)
 * showRank: optional #N chip left of face
 */
export function PlayerAvatar({
  player,
  size = "md",
  className,
  showRank = true,
  showElite = true,
}: {
  player: Pick<Player, "name" | "hue" | "photoUrl" | "id">;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Show #rank chip left of face (top 50). Off on leaderboard rows. */
  showRank?: boolean;
  /** Crown / gold or platinum ring for top city ranks. Default on. */
  showElite?: boolean;
}) {
  const store = useUpsetStore();

  const rank = useMemo(() => {
    if (!player.id) return null;
    if (!showRank && !showElite) return null;
    const ordered = [...store.players]
      .filter((p) => p.city === "Austin" || !p.city)
      .sort((a, b) => b.rating - a.rating);
    const list =
      ordered.length > 0
        ? ordered
        : [...store.players].sort((a, b) => b.rating - a.rating);
    const idx = list.findIndex((p) => p.id === player.id);
    if (idx < 0 || idx >= TOP_N) return null;
    return idx + 1;
  }, [store.players, player.id, showRank, showElite]);

  const dim =
    size === "xs"
      ? "size-8"
      : size === "sm"
        ? "size-10"
        : size === "lg"
          ? "size-16"
          : size === "xl"
            ? "size-24"
            : "size-12";
  const text =
    size === "xs"
      ? "text-[10px]"
      : size === "sm"
        ? "text-xs"
        : size === "lg"
          ? "text-lg"
          : size === "xl"
            ? "text-2xl"
            : "text-sm";
  const badgeText =
    size === "xs" || size === "sm"
      ? "text-[10px] px-1 py-0.5 min-w-[1.2rem]"
      : size === "xl"
        ? "text-[13px] px-1.5 py-0.5 min-w-[1.6rem]"
        : "text-[11px] px-1.5 py-0.5 min-w-[1.35rem]";

  const crownSize =
    size === "xs"
      ? "size-2.5"
      : size === "sm"
        ? "size-3"
        : size === "lg"
          ? "size-4"
          : size === "xl"
            ? "size-5"
            : "size-3.5";

  const crownWrap =
    size === "xs"
      ? "-top-3 size-3.5"
      : size === "sm"
        ? "-top-3.5 size-4"
        : size === "lg"
          ? "-top-4 size-5"
          : size === "xl"
            ? "-top-5 size-6"
            : "-top-3.5 size-5";


  const initials = player.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const src =
    player.photoUrl ??
    (player.id ? `/players/${player.id}.jpg` : undefined);

  const isTop10 = rank != null && rank <= 10;
  const isTop1 = rank === 1;
  const isElite = showElite && isTop10 && !isTop1;
  const showCrown = showElite && isTop1;
  const showGoldRing = showElite && isTop1;
  const showRankChip = showRank && rank != null;

  return (
    <div
      className={cn(
        "relative shrink-0",
        dim,
        showRankChip && "ml-3",
        // room so the crown sits fully above the head, not on the face
        showCrown &&
          (size === "xl"
            ? "mt-5"
            : size === "lg"
              ? "mt-4"
              : size === "xs"
                ? "mt-3"
                : "mt-3.5"),
        className,
      )}
    >
      {showCrown ? (
        <span
          className={cn(
            // centered above the portrait; bottom of crown just clears the gold ring
            "absolute left-1/2 z-20 flex -translate-x-1/2 items-center justify-center rounded-full bg-gold text-bg shadow-sm ring-1 ring-gold/50",
            crownWrap,
          )}
          title="City #1"
          aria-hidden
        >
          <Crown className={cn(crownSize, "fill-current")} strokeWidth={2} />
        </span>
      ) : null}

      <div
        className={cn(
          "relative z-[1] size-full overflow-hidden rounded-full shadow-sm",
          showGoldRing
            ? "ring-[2.5px] ring-gold ring-offset-1 ring-offset-bg"
            : isElite
              ? "ring-[2.5px] ring-offset-1 ring-offset-bg"
              : "ring-1 ring-border/80",
        )}
        style={
          showGoldRing
            ? {
                boxShadow:
                  "0 0 0 1px rgba(212,175,55,0.4), 0 0 10px rgba(212,175,55,0.35)",
                ...(src
                  ? {}
                  : {
                      background: `linear-gradient(145deg, oklch(0.48 0.09 ${player.hue}), oklch(0.32 0.06 ${player.hue}))`,
                    }),
              }
            : isElite
              ? {
                  // platinum ring — clean, shiny, no plate/label
                  boxShadow:
                    "0 0 0 2.5px #b8c4d6, 0 0 0 3.5px rgba(255,255,255,0.45), 0 0 10px rgba(190,205,225,0.5)",
                  ...(src
                    ? {}
                    : {
                        background: `linear-gradient(145deg, oklch(0.48 0.09 ${player.hue}), oklch(0.32 0.06 ${player.hue}))`,
                      }),
                }
              : src
                ? undefined
                : {
                    background: `linear-gradient(145deg, oklch(0.48 0.09 ${player.hue}), oklch(0.32 0.06 ${player.hue}))`,
                  }
        }
        aria-hidden
      >
        {src ? (
          <img
            src={src}
            alt=""
            width={size === "xl" ? 96 : size === "lg" ? 64 : 48}
            height={size === "xl" ? 96 : size === "lg" ? 64 : 48}
            className="size-full object-cover object-[center_20%]"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              const el = e.currentTarget;
              el.style.display = "none";
              const parent = el.parentElement;
              if (parent) {
                parent.style.background = `linear-gradient(145deg, oklch(0.48 0.09 ${player.hue}), oklch(0.32 0.06 ${player.hue}))`;
                parent.classList.add(
                  "flex",
                  "items-center",
                  "justify-center",
                  "font-semibold",
                  "text-fg",
                  text,
                );
                if (!parent.querySelector("[data-initials]")) {
                  const span = document.createElement("span");
                  span.dataset.initials = "1";
                  span.textContent = initials;
                  parent.appendChild(span);
                }
              }
            }}
          />
        ) : (
          <div
            className={cn(
              "flex size-full items-center justify-center font-semibold text-fg",
              text,
            )}
          >
            {initials}
          </div>
        )}
      </div>

      {showRankChip ? (
        <span
          className={cn(
            "absolute -bottom-1 right-full z-10 translate-x-1.5 rounded-full text-center font-black tabular-nums leading-none shadow-sm ring-1",
            badgeText,
            isTop1
              ? "bg-gold text-bg ring-gold/40"
              : isTop10
                ? "bg-court text-white ring-court/30"
                : "bg-fg text-bg ring-border",
          )}
          title={`City ranking #${rank}`}
          aria-label={`Ranked #${rank} in Austin`}
        >
          #{rank}
        </span>
      ) : null}
    </div>
  );
}
```

## FILE: `src/components/compete/player-catalog.tsx`

```tsx
import { useMemo, useState } from "react";
import { Search, Swords } from "lucide-react";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { PlayerChip } from "@/components/compete/player-chip";
import { displayRating } from "@/lib/rating/engine";
import type { Player } from "@/lib/upset/types";
import { cn, formatHeightInches } from "@/lib/utils";

export function PlayerCatalog({
  players,
  onOpen,
  onChallenge,
}: {
  players: Player[];
  onOpen: (p: Player) => void;
  onChallenge: (p: Player) => void;
}) {
  const [q, setQ] = useState("");
  const [hMin, setHMin] = useState(60);
  const [hMax, setHMax] = useState(84);
  const [rMin, setRMin] = useState(1200);
  const [rMax, setRMax] = useState(2200);
  const [activeOnly, setActiveOnly] = useState(false);

  const list = useMemo(() => {
    return players
      .filter((p) => {
        if (p.heightIn < hMin || p.heightIn > hMax) return false;
        if (p.rating < rMin || p.rating > rMax) return false;
        if (activeOnly && p.availability !== "available") return false;
        if (q.trim()) {
          const s = q.trim().toLowerCase();
          if (
            !p.name.toLowerCase().includes(s) &&
            !p.handle.toLowerCase().includes(s) &&
            !(p.neighborhood?.toLowerCase().includes(s) ?? false)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => b.rating - a.rating);
  }, [players, q, hMin, hMax, rMin, rMax, activeOnly]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search players"
          className="h-11 w-full rounded-xl border border-border bg-bg-elevated pr-3 pl-10 text-sm text-fg outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip
          active={activeOnly}
          onClick={() => setActiveOnly((v) => !v)}
          label="Available now"
        />
        <select
          value={`${hMin}-${hMax}`}
          onChange={(e) => {
            const [a, b] = e.target.value.split("-").map(Number);
            setHMin(a!);
            setHMax(b!);
          }}
          className="h-9 rounded-full border border-border bg-bg-elevated px-3 text-xs text-fg"
        >
          <option value="60-84">Any height</option>
          <option value="72-81">6′0″–6′9″</option>
          <option value="60-72">Under 6′0″</option>
          <option value="76-90">6′4″+</option>
        </select>
        <select
          value={`${rMin}-${rMax}`}
          onChange={(e) => {
            const [a, b] = e.target.value.split("-").map(Number);
            setRMin(a!);
            setRMax(b!);
          }}
          className="h-9 rounded-full border border-border bg-bg-elevated px-3 text-xs text-fg"
        >
          <option value="1200-2200">Any rating</option>
          <option value="1500-2000">1500–2000</option>
          <option value="1800-2400">1800+</option>
          <option value="800-1600">Under 1600</option>
        </select>
      </div>

      <p className="px-1 text-xs text-fg-subtle">
        {list.length} player{list.length === 1 ? "" : "s"} · neighborhood only,
        never exact location
      </p>

      <div className="space-y-2">
        {list.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-border bg-bg-elevated p-3"
          >
            <div className="flex items-start gap-3">
              <button type="button" onClick={() => onOpen(p)}>
                <PlayerAvatar player={p} size="xl" />
              </button>
              <div className="min-w-0 flex-1">
                <PlayerChip player={p} onOpen={onOpen} showRating />
                <p className="mt-1 text-[11px] text-fg-muted">
                  {formatHeightInches(p.heightIn)} · {p.weightLb} lb ·{" "}
                  {p.wins}W–{p.losses}L · streak {p.streak}
                </p>
                <p className="text-[11px] text-fg-subtle">
                  sports {p.sportsmanship.toFixed(1)}★ · show{" "}
                  {p.reliability.toFixed(1)}★ ·{" "}
                  <span className="capitalize">{p.availability}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onChallenge(p)}
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-fg"
            >
              <Swords className="size-3.5 text-court" strokeWidth={2} />
              Challenge
            </button>
          </div>
        ))}
        {list.length === 0 && (
          <div className="rounded-2xl border border-border bg-bg-elevated px-6 py-10 text-center text-sm text-fg-muted">
            No players match these filters. Widen height or rating.
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-full px-3 text-xs font-semibold",
        active
          ? "bg-accent text-accent-fg"
          : "border border-border bg-bg-elevated text-fg-muted",
      )}
    >
      {label}
    </button>
  );
}
```

## FILE: `src/components/compete/player-chip.tsx`

```tsx
import { PlayerAvatar } from "@/components/compete/player-avatar";
import type { Player } from "@/lib/upset/types";
import { displayRating } from "@/lib/rating/engine";
import { cn, formatHeightInches } from "@/lib/utils";

/**
 * One shared chip — name/photo always open the same profile destination.
 */
export function PlayerChip({
  player,
  onOpen,
  subtitle,
  showRating = true,
  size = "md",
  className,
}: {
  player: Player;
  onOpen: (p: Player) => void;
  subtitle?: string;
  showRating?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(player);
      }}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-xl text-left transition-colors hover:bg-bg-subtle/80",
        size === "sm" ? "py-1" : "py-1.5 pr-2",
        className,
      )}
    >
      <PlayerAvatar player={player} size={size === "sm" ? "sm" : "md"} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg">{player.name}</p>
        <p className="truncate text-[11px] text-fg-muted">
          {subtitle ??
            `${formatHeightInches(player.heightIn)} · ${player.neighborhood ?? player.city}`}
        </p>
      </div>
      {showRating && (
        <span className="shrink-0 text-sm font-semibold tabular-nums text-fg">
          {displayRating(player.rating)}
        </span>
      )}
    </button>
  );
}
```

## FILE: `src/components/compete/player-profile.tsx`

```tsx
import { useMemo, useState } from "react";
import { Flag, MessageSquare, Swords, X } from "lucide-react";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { namedAustinCourts } from "@/lib/courts/catalog";
import { displayRating } from "@/lib/rating/engine";
import { formatLocalWhen, useUpsetStore } from "@/lib/upset/store";
import type { Player } from "@/lib/upset/types";
import { formatHeightInches } from "@/lib/utils";

export function PlayerProfile({
  player,
  onClose,
  onChallenged,
}: {
  player: Player;
  onClose: () => void;
  onChallenged?: () => void;
}) {
  const store = useUpsetStore();
  const isMe = player.id === store.me.id;
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const courts = useMemo(() => namedAustinCourts(), []);
  const home = courts.find((c) => c.id === player.homeCourtId);
  const held = Object.values(store.courtMeta).filter(
    (m) => m.kingId === player.id,
  ).length;

  /** Already locked in with this player — no challenge option */
  const scheduledWith = useMemo(() => {
    return store.matches.find((m) => {
      if (
        m.status !== "scheduled" &&
        m.status !== "matched" &&
        m.status !== "open"
      )
        return false;
      const a = m.hostId;
      const b = m.opponentId;
      const me = store.me.id;
      // open: only if they host and I somehow joined roster, or mutual pending
      if (m.status === "open") {
        return (
          (a === me && b === player.id) ||
          (a === player.id && b === me) ||
          (a === player.id && (m.rosterIds ?? []).includes(me)) ||
          (a === me && (m.rosterIds ?? []).includes(player.id))
        );
      }
      return (
        (a === me && b === player.id) || (a === player.id && b === me)
      );
    });
  }, [store.matches, store.me.id, player.id]);

  const challenge = () => {
    if (scheduledWith) {
      setStatus("You already have a game scheduled with them.");
      return;
    }
    const court =
      courts.find((c) => c.id === player.homeCourtId) ??
      courts.find((c) => c.id === "cat-battle-bend") ??
      courts[0];
    if (!court) return;
    const r = store.challengePlayer(player.id, {
      courtId: court.id,
      courtName: court.name,
      lat: court.lat,
      lon: court.lon,
      preferredAt: new Date(Date.now() + 3600e3).toISOString(),
      notes: `Challenge from ${store.me.name}`,
    });
    if (r.ok) {
      setStatus("Challenge sent — private if they decline.");
      onChallenged?.();
    } else {
      setStatus(r.reason);
    }
  };

  const send = () => {
    const r = store.sendDm(player.id, msg);
    if (r.ok) {
      setMsg("");
      setStatus("Message sent (request inbox if first contact).");
    } else {
      setStatus(r.reason);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Dismiss"
      />
      <div className="slide-up relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-bg-elevated p-5 shadow-soft sm:rounded-3xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full border border-border text-fg-muted"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-4">
          <PlayerAvatar player={player} size="xl" />
          <div className="min-w-0">
            <h3 className="font-display text-xl font-semibold text-fg">
              {player.name}
              {isMe ? " (you)" : ""}
            </h3>
            <p className="text-sm text-fg-muted">
              @{player.handle} · {player.neighborhood ?? player.city}
            </p>
            {player.exiled ? (
              <p className="mt-1.5 rounded-lg bg-danger/15 px-2 py-1 text-[11px] font-bold text-danger">
                EXILED from the league
                {player.exiledReason ? ` · ${player.exiledReason}` : ""}
              </p>
            ) : (
              <p className="mt-1 text-xs capitalize text-fg-subtle">
                {player.availability}
                {home ? ` · home ${home.name}` : ""}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {(
            [
              ["Rating", String(displayRating(player.rating))],
              ["Record", `${player.wins}–${player.losses}`],
              ["Streak", String(player.streak)],
              ["Height", formatHeightInches(player.heightIn)],
              ["Weight", `${player.weightLb}`],
              ["Exp", `${player.experienceYears}y`],
              ["Sports", `${player.sportsmanship.toFixed(1)}★`],
              ["Show", `${player.reliability.toFixed(1)}★`],
              ["Crowns", String(held)],
            ] as const
          ).map(([l, v]) => (
            <div
              key={l}
              className="rounded-xl border border-border bg-bg-subtle px-2 py-2.5 text-center"
            >
              <p className="text-[10px] font-medium tracking-wide text-fg-subtle uppercase">
                {l}
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-fg">
                {v}
              </p>
            </div>
          ))}
        </div>

        {player.bio && (
          <p className="mt-4 text-sm leading-relaxed text-fg-muted">{player.bio}</p>
        )}

        {/* Private settle handles — only for stakes, never on map */}
        {isMe ? (
          <PayHandlesEditor
            player={player}
            onSave={(h) => {
              store.updateMyPayHandles(h);
              setStatus("Payment handles saved — only used for private settle.");
            }}
          />
        ) : player.payCashApp || player.payVenmo || player.payZelle ? (
          <div className="mt-4 rounded-2xl border border-border bg-bg-subtle px-3.5 py-3">
            <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
              Private settle
            </p>
            <p className="mt-1 text-[11px] text-fg-muted">
              For stakes games only — peer apps, not public on the map.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {player.payCashApp ? (
                <span className="rounded-full bg-bg-elevated px-2.5 py-1 text-[11px] font-semibold text-fg">
                  Cash App ${player.payCashApp.replace(/^\$/, "")}
                </span>
              ) : null}
              {player.payVenmo ? (
                <span className="rounded-full bg-bg-elevated px-2.5 py-1 text-[11px] font-semibold text-fg">
                  Venmo @{player.payVenmo.replace(/^@/, "")}
                </span>
              ) : null}
              {player.payZelle ? (
                <span className="rounded-full bg-bg-elevated px-2.5 py-1 text-[11px] font-semibold text-fg">
                  Zelle {player.payZelle}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {!isMe && (
          <div className="mt-5 space-y-3">
            {scheduledWith ? (
              <div className="rounded-xl border border-court/30 bg-court/10 px-3 py-3">
                <p className="text-sm font-semibold text-fg">
                  Game already scheduled
                </p>
                <p className="mt-0.5 text-xs text-fg-muted">
                  {scheduledWith.courtName}
                  {" · "}
                  {formatLocalWhen(
                    scheduledWith.scheduledAt ?? scheduledWith.preferredAt,
                  )}
                </p>
                <p className="mt-1 text-[11px] text-fg-subtle">
                  Challenge is disabled while you have a locked-in game with
                  them. Cancel that game first if you need to rebook.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={challenge}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-court text-sm font-semibold text-white"
                >
                  <Swords className="size-4" strokeWidth={2} />
                  Challenge
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (msg.trim()) send();
                    else setStatus("Type a message below first.");
                  }}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border-strong bg-bg-subtle text-sm font-semibold text-fg"
                >
                  <MessageSquare className="size-4" strokeWidth={2} />
                  Message
                </button>
              </div>
            )}

            {scheduledWith ? (
              <button
                type="button"
                onClick={() => {
                  if (msg.trim()) send();
                  else setStatus("Type a message below first.");
                }}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-bg-subtle text-sm font-semibold text-fg"
              >
                <MessageSquare className="size-4" strokeWidth={2} />
                Message
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                const isFriend = (store.friendIds ?? []).includes(player.id);
                if (isFriend) {
                  store.removeFriend(player.id);
                  setStatus("Removed from friends.");
                } else {
                  store.addFriend(player.id);
                  setStatus("Added as friend.");
                }
              }}
              className="flex h-10 w-full items-center justify-center rounded-xl border border-border text-sm font-semibold text-fg"
            >
              {(store.friendIds ?? []).includes(player.id)
                ? "Friends — tap to remove"
                : "Add friend"}
            </button>
            <div className="flex gap-2">
              <input
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="First message goes to requests…"
                className="h-11 flex-1 rounded-xl border border-border bg-bg-subtle px-3 text-sm text-fg outline-none"
              />
              <button
                type="button"
                onClick={send}
                className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg"
              >
                Send
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  store.blockPlayer(player.id);
                  setStatus("Blocked — removed from catalog and DMs.");
                  onClose();
                }}
                className="h-10 flex-1 rounded-xl border border-border text-xs font-medium text-fg-muted"
              >
                Block
              </button>
              <button
                type="button"
                onClick={() => {
                  store.reportPlayer(player.id, "user report");
                  setStatus("Report filed for review.");
                }}
                className="flex h-10 flex-1 items-center justify-center gap-1 rounded-xl border border-border text-xs font-medium text-fg-muted"
              >
                <Flag className="size-3.5" strokeWidth={2} />
                Report
              </button>
            </div>
          </div>
        )}

        {status && (
          <p className="mt-3 text-center text-xs text-fg-muted" role="status">
            {status}
          </p>
        )}
      </div>
    </div>
  );
}

function PayHandlesEditor({
  player,
  onSave,
}: {
  player: Player;
  onSave: (h: {
    payCashApp?: string;
    payVenmo?: string;
    payZelle?: string;
  }) => void;
}) {
  const [cash, setCash] = useState(player.payCashApp?.replace(/^\$/, "") ?? "");
  const [venmo, setVenmo] = useState(player.payVenmo?.replace(/^@/, "") ?? "");
  const [zelle, setZelle] = useState(player.payZelle ?? "");
  const [saved, setSaved] = useState(false);

  return (
    <div className="mt-4 rounded-2xl border border-border bg-bg-subtle px-3.5 py-3">
      <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
        Private settle handles
      </p>
      <p className="mt-1 text-[11px] leading-snug text-fg-muted">
        Cash App, Venmo, Zelle — only used when someone owes you on a stakes
        game. Never shown on the court map.
      </p>
      <div className="mt-2.5 space-y-2">
        <label className="block text-[10px] font-medium text-fg-muted">
          Cash App $cashtag
          <input
            value={cash}
            onChange={(e) => setCash(e.target.value.replace(/^\$/, ""))}
            placeholder="yourcashtag"
            className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-court"
          />
        </label>
        <label className="block text-[10px] font-medium text-fg-muted">
          Venmo username
          <input
            value={venmo}
            onChange={(e) => setVenmo(e.target.value.replace(/^@/, ""))}
            placeholder="username"
            className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-court"
          />
        </label>
        <label className="block text-[10px] font-medium text-fg-muted">
          Zelle (email or phone)
          <input
            value={zelle}
            onChange={(e) => setZelle(e.target.value)}
            placeholder="you@email.com"
            className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-court"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            onSave({
              payCashApp: cash || undefined,
              payVenmo: venmo || undefined,
              payZelle: zelle || undefined,
            });
            setSaved(true);
            window.setTimeout(() => setSaved(false), 1600);
          }}
          className="flex h-10 w-full items-center justify-center rounded-xl bg-fg text-xs font-semibold text-bg"
        >
          {saved ? "Saved" : "Save handles"}
        </button>
      </div>
    </div>
  );
}
```

## FILE: `src/components/compete/quick-match-flow.tsx`

```tsx
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Info,
  LocateFixed,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import { CourtAboutSheet } from "@/components/compete/court-about-sheet";
import { MatchRemindersCard } from "@/components/compete/match-reminders-card";
import {
  StakeChip,
  StakeSettleCard,
} from "@/components/compete/stake-settle-card";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { CourtMapCutout } from "@/components/court-map-cutout";
import { CourtsMap } from "@/components/courts-map";
import { ImageCarousel } from "@/components/image-carousel";
import type { Court } from "@/lib/courts/types";
import { courtImagesFor } from "@/lib/courts/images";
import { directionsUrl } from "@/lib/maps/directions";
import { suggestAustinAddresses, type GeoHit } from "@/lib/maps/geocode";
import { displayRating } from "@/lib/rating/engine";
import { CampaignBanner } from "@/components/compete/campaign-banner";
import { ALZHEIMERS_CHARITY, MAX_STAKE_DOLLARS, MIN_STAKE_DOLLARS } from "@/lib/upset/stakes";
import type { MatchFormat, MatchStakes, StakeMode } from "@/lib/upset/types";
import { formatLocalWhen, useUpsetStore } from "@/lib/upset/store";
import type { Match, Player, PlayerReview } from "@/lib/upset/types";
import { cn, formatHeightInches } from "@/lib/utils";

type View = "find" | "game" | "create";
type InviteFilter = "friends" | "available" | "active";
type InviteSortKey = "rating" | "height" | "streak";
const AUSTIN_CENTER = { lat: 30.2672, lon: -97.7431 };
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const RECOMMENDED_COURT_IDS = new Set([
  "cat-zilker","cat-battle-bend","cat-pease","cat-bartholomew",
  "cat-rosewood","cat-reed","cat-circle-c","cat-west4",
  "cat-garrison","cat-walnut-creek","cat-hancock","cat-searight",
]);
function isShadedCourt(c: { amenities?: string[] }) { return (c.amenities ?? []).includes("shade"); }
function isRecommendedCourt(c: { id: string; amenities?: string[] }) {
  if (RECOMMENDED_COURT_IDS.has(c.id)) return true;
  const a = new Set(c.amenities ?? []);
  return a.has("shade") && a.has("lights") && a.has("parking");
}
function recommendScore(c: { id: string; amenities?: string[]; miles?: number; hoops?: number }) {
  let s = 0;
  if (RECOMMENDED_COURT_IDS.has(c.id)) s += 100;
  const a = new Set(c.amenities ?? []);
  if (a.has("shade")) s += 25; if (a.has("lights")) s += 20; if (a.has("parking")) s += 15;
  if (a.has("multiple")) s += 15; if (a.has("water")) s += 10; if (a.has("fence")) s += 8;
  if ((c.hoops ?? 0) >= 4) s += 12;
  if (typeof c.miles === "number") s += Math.max(0, 10 - c.miles);
  return s;
}
interface QuickMatchFlowProps {
  me: Player; players: Player[]; courts: Court[]; matches: Match[];
  userLat?: number; userLon?: number;
  onCreateMatch?: (input: {
    court: { id: string; name: string; lat: number; lon: number };
    preferredAt: string;
    mode: "ranked_1v1";
    format?: MatchFormat;
    notes?: string;
    stakes?: MatchStakes;
  }) => void;
  onAcceptMatch?: (matchId: string) => "ok" | "filled" | void;
  onOpenPlayer?: (p: Player) => void;
  compactHeader?: boolean;
  onImmersiveChange?: (immersive: boolean) => void;
  /** Deep-link: open this match detail from Media / elsewhere */
  focusMatchId?: string | null;
  onFocusMatchConsumed?: () => void;
}
function haversineMi(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8; const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1); const dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function inAustinMetro(lat: number, lon: number) { return lat >= 30.05 && lat <= 30.55 && lon >= -98.05 && lon <= -97.45; }
function formatMiles(mi: number) { if (mi < 0.1) return "<0.1 mi"; if (mi < 10) return `${mi.toFixed(1)} mi`; return `${Math.round(mi)} mi`; }
function whenParts(iso: string) { try { const d = new Date(iso); return { day: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }), time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) }; } catch { return { day: iso, time: "" }; } }
function seriesWins(scores: { a: number; b: number }[] | undefined, side: "a" | "b") { if (!scores?.length) return 0; let w = 0; for (const g of scores) if (side === "a" ? g.a > g.b : g.b > g.a) w += 1; return w; }
function scoreLine(scores: { a: number; b: number }[] | undefined) { if (!scores?.length) return ""; return scores.map((g) => `${g.a}–${g.b}`).join(", "); }
function inviteScore(p: Player, friendIds: string[], now = Date.now()) { let score = 0; if (p.availability === "available") score += 1_000_000; else if (p.availability === "busy") score += 200_000; if (friendIds.includes(p.id)) score += 500_000; if (p.lastPlayedAt) { const age = now - new Date(p.lastPlayedAt).getTime(); score += Math.max(0, TWO_WEEKS_MS - age); } return score; }
function resolveCourt(match: Match, courts: Court[]) { const byId = courts.find((c) => c.id === match.courtId); if (byId) return byId; let best: Court | null = null; let bestD = Infinity; for (const c of courts) { const d = Math.hypot(c.lat - match.lat, c.lon - match.lon); if (d < bestD) { bestD = d; best = c; } } if (best && bestD < 0.01) return best; return { id: match.courtId, name: match.courtName, lat: match.lat, lon: match.lon }; }

export function QuickMatchFlow({
  me, players, courts, matches, userLat, userLon,
  onCreateMatch, onAcceptMatch, onOpenPlayer,
  compactHeader = false, onImmersiveChange,
  focusMatchId = null, onFocusMatchConsumed,
}: QuickMatchFlowProps) {
  const store = useUpsetStore();
  const [view, setView] = useState<View>("find");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createCourtId, setCreateCourtId] = useState("");
  const [createWhen, setCreateWhen] = useState(() => {
    const d = new Date(Date.now() + 90 * 60e3);
    d.setMinutes(0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [createNotes, setCreateNotes] = useState(
    "Best of 3 · games to 11 · make it take it. Looking for someone my size and skill level.",
  );
  const [createStakeMode, setCreateStakeMode] = useState<StakeMode>("charity");
  const [createFormat, setCreateFormat] = useState<"1v1" | "horse">("1v1");
  const [createDollarsPerPoint, setCreateDollarsPerPoint] = useState(1);
  const [createStakePrice, setCreateStakePrice] = useState("20");
  const [createCap, setCreateCap] = useState("");
  const [showPeerStakes, setShowPeerStakes] = useState(false);
  const [createHood, setCreateHood] = useState("all");
  const [createSorts, setCreateSorts] = useState<Set<string>>(() => new Set());
  const [createRadiusMi, setCreateRadiusMi] = useState(5);
  const [createPickMode, setCreatePickMode] = useState<"photos" | "map">("photos");
  const [courtInfoId, setCourtInfoId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteFilters, setInviteFilters] = useState<Set<InviteFilter>>(
    () => new Set(),
  );
  const [inviteSorts, setInviteSorts] = useState<Set<InviteSortKey>>(
    () => new Set(),
  );
  const [chatDraft, setChatDraft] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [nearOrigin, setNearOrigin] = useState<{
    lat: number; lon: number; label: string; source: "gps" | "address";
  } | null>(null);
  const [locatingNear, setLocatingNear] = useState(false);
  const [nearLocError, setNearLocError] = useState<string | null>(null);
  const [showAddressEntry, setShowAddressEntry] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressHits, setAddressHits] = useState<GeoHit[]>([]);
  const [addressSearching, setAddressSearching] = useState(false);

  // Deep-link from Media: open listing details
  useEffect(() => {
    if (!focusMatchId) return;
    const exists =
      matches.some((m) => m.id === focusMatchId) ||
      store.matches.some((m) => m.id === focusMatchId);
    if (!exists) {
      onFocusMatchConsumed?.();
      return;
    }
    setSelectedId(focusMatchId);
    setView("game");
    onFocusMatchConsumed?.();
  }, [focusMatchId, matches, store.matches, onFocusMatchConsumed]);

  const parentOrigin = {
    lat: userLat ?? AUSTIN_CENTER.lat,
    lon: userLon ?? AUSTIN_CENTER.lon,
  };
  const origin = nearOrigin
    ? { lat: nearOrigin.lat, lon: nearOrigin.lon }
    : parentOrigin;
  const hasPreciseLocation = !!nearOrigin;

  useEffect(() => {
    onImmersiveChange?.(view === "game" || view === "create");
    return () => onImmersiveChange?.(false);
  }, [view, onImmersiveChange]);

  useEffect(() => {
    if (!showAddressEntry) return;
    const q = addressQuery.trim();
    if (q.length < 3) {
      setAddressHits([]);
      setAddressSearching(false);
      return;
    }
    let cancelled = false;
    setAddressSearching(true);
    const tmr = window.setTimeout(async () => {
      const hits = await suggestAustinAddresses(q, 6);
      if (cancelled) return;
      setAddressHits(hits);
      setAddressSearching(false);
    }, 320);
    return () => { cancelled = true; window.clearTimeout(tmr); };
  }, [addressQuery, showAddressEntry]);

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const friendIds = store.friendIds ?? [];

  const courtOptions = useMemo(
    () =>
      courts
        .map((c) => ({
          ...c,
          miles: haversineMi(origin.lat, origin.lon, c.lat, c.lon),
        }))
        .sort((a, b) => a.miles - b.miles)
        .slice(0, 40),
    [courts, origin.lat, origin.lon],
  );

  const openGames = useMemo(
    () =>
      matches
        .filter(
          (m) =>
            m.status === "open" &&
            m.hostId !== me.id &&
            (m.format ?? "1v1") === "1v1" &&
            inAustinMetro(m.lat, m.lon),
        )
        .map((m) => ({
          match: m,
          miles: haversineMi(origin.lat, origin.lon, m.lat, m.lon),
        }))
        .sort(
          (a, b) =>
            a.miles - b.miles ||
            a.match.preferredAt.localeCompare(b.match.preferredAt),
        ),
    [matches, me.id, origin.lat, origin.lon],
  );

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return (
      matches.find((m) => m.id === selectedId) ??
      store.matches.find((m) => m.id === selectedId) ??
      null
    );
  }, [selectedId, matches, store.matches]);

  const upcomingGames = useMemo(
    () =>
      matches
        .filter((m) => {
          if (m.status === "cancelled") return false;
          if (m.status !== "matched" && m.status !== "scheduled") return false;
          return (
            m.hostId === me.id ||
            m.opponentId === me.id ||
            (m.rosterIds ?? []).includes(me.id)
          );
        })
        .sort((a, b) =>
          (a.scheduledAt ?? a.preferredAt).localeCompare(b.scheduledAt ?? b.preferredAt),
        ),
    [matches, me.id],
  );

  const myHostingOpen = useMemo(
    () => matches.filter((m) => m.hostId === me.id && m.status === "open"),
    [matches, me.id],
  );

  const inviteCandidates = useMemo(() => {
    const now = Date.now();
    let list = players.filter((p) => p.id !== me.id);
    if (inviteQuery.trim()) {
      const q = inviteQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.handle.toLowerCase().includes(q) ||
          (p.neighborhood ?? "").toLowerCase().includes(q),
      );
    }
    // Multi-select filters (AND when multiple)
    if (inviteFilters.has("friends")) {
      list = list.filter((p) => friendIds.includes(p.id));
    }
    if (inviteFilters.has("available")) {
      list = list.filter((p) => p.availability === "available");
    }
    if (inviteFilters.has("active")) {
      list = list.filter(
        (p) =>
          p.availability === "available" ||
          (p.lastPlayedAt &&
            now - new Date(p.lastPlayedAt).getTime() < TWO_WEEKS_MS),
      );
    }
    // Multi-select sorts — apply selected keys in order: rating → height → streak
    // (only keys the user turned on). Unselected keys are ignored.
    return [...list].sort((a, b) => {
      if (inviteSorts.has("rating")) {
        const d = b.rating - a.rating;
        if (d !== 0) return d;
      }
      if (inviteSorts.has("height")) {
        const d = b.heightIn - a.heightIn;
        if (d !== 0) return d;
      }
      if (inviteSorts.has("streak")) {
        const d = (b.streak ?? 0) - (a.streak ?? 0);
        if (d !== 0) return d;
      }
      // Default / tie-break: online + friends + recent activity
      return inviteScore(b, friendIds, now) - inviteScore(a, friendIds, now);
    });
  }, [players, me.id, inviteQuery, inviteFilters, inviteSorts, friendIds]);

  const requestNearLocation = () => {
    setNearLocError(null);
    if (!navigator.geolocation) {
      setNearLocError("Location isn’t available on this device.");
      setShowAddressEntry(true);
      return;
    }
    setLocatingNear(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNearOrigin({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: "Near you",
          source: "gps",
        });
        setLocatingNear(false);
        setShowAddressEntry(false);
        setNearLocError(null);
      },
      (err) => {
        setLocatingNear(false);
        setNearLocError(
          err.code === 1
            ? "Location permission denied."
            : "Couldn’t get GPS. Try typing an address.",
        );
        setShowAddressEntry(true);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    );
  };

  const pickAddressHit = (hit: GeoHit) => {
    setNearOrigin({
      lat: hit.lat,
      lon: hit.lon,
      label: hit.label,
      source: "address",
    });
    setAddressQuery(hit.label);
    setAddressHits([]);
    setShowAddressEntry(false);
    setNearLocError(null);
  };

  const startCreate = () => {
    setCreateCourtId("");
    setCreateSorts(new Set());
    setCourtInfoId(null);
    setView("create");
  };

  const submitCreate = () => {
    if (me.exiled) {
      setStatusMsg("You’re exiled from the league — cannot post games.");
      return;
    }
    if (!createCourtId) {
      setStatusMsg("Pick a court before posting.");
      return;
    }
    const court = courts.find((c) => c.id === createCourtId);
    if (!court) {
      setStatusMsg("Pick a court before posting.");
      return;
    }
    if (createStakeMode === "stakes") {
      const price = Number(createStakePrice);
      if (!Number.isFinite(price) || price < MIN_STAKE_DOLLARS) {
        setStatusMsg("Name your price — enter a dollar amount.");
        return;
      }
      if (price > MAX_STAKE_DOLLARS) {
        setStatusMsg(`Max stake is $${MAX_STAKE_DOLLARS.toLocaleString()}.`);
        return;
      }
    }
    const stakes: MatchStakes =
      createStakeMode === "stakes"
        ? {
            mode: "stakes",
            dollarsPerPoint: 1,
            fixedPriceDollars: Math.min(
              MAX_STAKE_DOLLARS,
              Math.max(MIN_STAKE_DOLLARS, Number(createStakePrice) || 20),
            ),
          }
        : createStakeMode === "charity"
          ? {
              mode: "charity",
              dollarsPerPoint: Math.max(0.5, Number(createDollarsPerPoint) || 1),
              ...(createCap.trim()
                ? { capDollars: Math.max(1, Number(createCap) || 0) }
                : {}),
              charityName: ALZHEIMERS_CHARITY.name,
              charityUrl: ALZHEIMERS_CHARITY.url,
            }
          : { mode: "fun", dollarsPerPoint: 1 };
    const formatLabel = createFormat === "horse" ? "HORSE" : "1v1";
    onCreateMatch?.({
      court: { id: court.id, name: court.name, lat: court.lat, lon: court.lon },
      preferredAt: new Date(createWhen).toISOString(),
      mode: "ranked_1v1",
      format: createFormat,
      notes: createNotes.trim(),
      stakes,
    });
    const postedPrice = Math.min(
      MAX_STAKE_DOLLARS,
      Math.max(MIN_STAKE_DOLLARS, Number(createStakePrice) || 20),
    );
    setStatusMsg(
      createStakeMode === "fun"
        ? `${formatLabel} posted — just for fun / rating.`
        : createStakeMode === "charity"
          ? `${formatLabel} for Alzheimer's posted — feeds the $50k city goal.`
          : `$${postedPrice} peer stakes posted.`,
    );
    setView("find");
  };

  const openGame = (id: string) => {
    setSelectedId(id);
    setView("game");
    setChatDraft("");
  };

  const joinGame = (id: string) => {
    if (me.exiled) {
      setStatusMsg("You’re exiled from the league — cannot join games.");
      return;
    }
    const r = onAcceptMatch?.(id);
    if (r === "filled") setStatusMsg("That game just filled.");
    else {
      setStatusMsg("You’re in — add phone reminders on the game page.");
      setSelectedId(id);
      setView("game");
    }
  };

  const aboutSheet =
    courtInfoId ? (
      <CourtAboutSheet
        court={
          courtOptions.find((c) => c.id === courtInfoId) ??
          courts.find((c) => c.id === courtInfoId) ??
          null
        }
        onClose={() => setCourtInfoId(null)}
        onSelectCourt={(id) => {
          setCreateCourtId(id);
          setCourtInfoId(null);
        }}
        isSelected={createCourtId === courtInfoId}
      />
    ) : null;

  // CREATE
  if (view === "create") {
    const hoods = Array.from(
      new Set(courtOptions.map((c) => c.neighborhood).filter((n): n is string => !!n && n.length > 0)),
    ).sort();
    const wantHighestRated = createSorts.has("highest_rated");
    const wantShaded = createSorts.has("shaded");
    const wantNearest = createSorts.has("nearest");

    let filteredCourts = [...courtOptions];
    if (createHood !== "all") {
      filteredCourts = filteredCourts.filter((c) => c.neighborhood === createHood);
    }
    if (wantShaded) filteredCourts = filteredCourts.filter((c) => isShadedCourt(c));
    if (wantNearest && hasPreciseLocation) {
      filteredCourts = filteredCourts.filter((c) => c.miles <= createRadiusMi + 0.05);
    }
    filteredCourts.sort((a, b) => {
      if (wantHighestRated) {
        const d = recommendScore(b) - recommendScore(a);
        if (d !== 0) return d;
      }
      return a.miles - b.miles;
    });

    const selectedCreateCourt = createCourtId
      ? filteredCourts.find((c) => c.id === createCourtId) ??
        courtOptions.find((c) => c.id === createCourtId)
      : undefined;
    const selectedThumb = selectedCreateCourt
      ? courtImagesFor(selectedCreateCourt.id, 1)[0]
      : null;

    return (
      <div className="space-y-2.5">
        <CampaignBanner compact />

        <button type="button" onClick={() => setView("find")} className="text-xs font-medium text-fg-muted">
          ← Back
        </button>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold text-fg">Create 1v1</h3>
            <p className="mt-0.5 text-[11px] text-fg-muted">Pick a court by photo or on the map.</p>
          </div>
          <div className="flex shrink-0 rounded-full border border-border bg-bg-elevated p-0.5">
            <button type="button" onClick={() => setCreatePickMode("photos")}
              className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", createPickMode === "photos" ? "bg-fg text-bg" : "text-fg-muted")}>
              Photos
            </button>
            <button type="button" onClick={() => setCreatePickMode("map")}
              className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", createPickMode === "map" ? "bg-fg text-bg" : "text-fg-muted")}>
              Map
            </button>
          </div>
        </div>

        {selectedCreateCourt ? (
          <div className="flex items-center gap-2 rounded-xl border border-court/40 bg-court/10 px-2 py-1.5">
            {selectedThumb ? (
              <img src={selectedThumb} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="size-10 shrink-0 rounded-lg bg-bg-subtle" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="truncate text-[13px] font-semibold text-fg">
                  {selectedCreateCourt.name.replace(/\s*Courts?\s*$/i, "") || selectedCreateCourt.name}
                </p>
                <button type="button" onClick={() => setCourtInfoId(selectedCreateCourt.id)}
                  className="flex size-5 shrink-0 items-center justify-center rounded-full bg-court/20 text-court" aria-label="About this court">
                  <Info className="size-3" strokeWidth={2.25} />
                </button>
              </div>
              <p className="truncate text-[11px] text-fg-muted">
                {selectedCreateCourt.neighborhood ?? "Austin"} · {formatMiles(selectedCreateCourt.miles)}
              </p>
            </div>
          </div>
        ) : null}

        <div className="space-y-1">
          <p className="text-[10px] font-medium text-fg-subtle">Optional filters · none selected is fine</p>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {([
              { id: "highest_rated", label: "Highest rated" },
              { id: "shaded", label: "Shaded" },
              { id: "nearest", label: "Near me" },
            ] as const).map((opt) => {
              const on = createSorts.has(opt.id);
              return (
                <button key={opt.id} type="button"
                  onClick={() => {
                    setCreateSorts((prev) => {
                      const next = new Set(prev);
                      if (next.has(opt.id)) next.delete(opt.id);
                      else next.add(opt.id);
                      return next;
                    });
                  }}
                  className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    on ? "bg-court text-white" : "border border-border bg-bg-elevated text-fg-muted")}>
                  {on ? "✓ " : ""}{opt.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button type="button" onClick={() => setCreateHood("all")}
              className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                createHood === "all" ? "border border-border bg-bg-elevated text-fg" : "bg-bg-elevated text-fg-muted")}>
              All areas
            </button>
            {hoods.map((h) => (
              <button key={h} type="button"
                onClick={() => setCreateHood((prev) => (prev === h ? "all" : h))}
                className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  createHood === h ? "bg-fg text-bg" : "border border-border bg-bg-elevated text-fg-muted")}>
                {h}
              </button>
            ))}
          </div>
        </div>

        {createSorts.has("nearest") ? (
          <div className="space-y-2 rounded-xl border border-border bg-bg-elevated px-2.5 py-2.5">
            {!hasPreciseLocation ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-fg">Near me needs your location</p>
                <p className="text-[11px] leading-snug text-fg-muted">
                  Share GPS or type an address if location isn’t available.
                </p>
                <button type="button" onClick={requestNearLocation} disabled={locatingNear}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-court py-2.5 text-xs font-semibold text-white disabled:opacity-70">
                  <LocateFixed className="size-3.5" strokeWidth={2.25} />
                  {locatingNear ? "Getting location…" : "Share my location"}
                </button>
                {nearLocError ? <p className="text-[11px] text-danger" role="alert">{nearLocError}</p> : null}
                <button type="button" onClick={() => setShowAddressEntry(true)}
                  className="w-full text-center text-[11px] font-semibold text-court">
                  Type an address instead
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold tracking-wide text-court uppercase">
                      {nearOrigin?.source === "gps" ? "GPS" : "Address"}
                    </p>
                    <p className="truncate text-[12px] font-semibold text-fg">{nearOrigin?.label ?? "Near you"}</p>
                  </div>
                  <button type="button" onClick={() => { setNearOrigin(null); setShowAddressEntry(true); setAddressQuery(""); }}
                    className="shrink-0 text-[11px] font-semibold text-fg-muted">Change</button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-fg">Radius</p>
                  <p className="text-[12px] font-bold tabular-nums text-court">{createRadiusMi} mi</p>
                </div>
                <input type="range" min={1} max={25} step={1} value={createRadiusMi}
                  onChange={(e) => setCreateRadiusMi(Number(e.target.value))} className="w-full" aria-label="Search radius in miles" />
                <div className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {[1, 3, 5, 8, 10, 15, 20, 25].map((mi) => (
                    <button key={mi} type="button" onClick={() => setCreateRadiusMi(mi)}
                      className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                        createRadiusMi === mi ? "bg-court text-white" : "bg-bg text-fg-muted")}>
                      {mi} mi
                    </button>
                  ))}
                </div>
              </div>
            )}
            {(showAddressEntry || (!hasPreciseLocation && nearLocError)) && (
              <div className="space-y-1.5 border-t border-border pt-2">
                <p className="text-[11px] font-semibold text-fg">Type an address</p>
                <div className="relative">
                  <input type="text" value={addressQuery}
                    onChange={(e) => { setAddressQuery(e.target.value); setShowAddressEntry(true); }}
                    placeholder="Street, park, or Austin address…" autoComplete="street-address"
                    className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg outline-none focus:border-court" />
                  {addressSearching ? <p className="mt-1 text-[10px] text-fg-subtle">Looking up addresses…</p> : null}
                  {addressHits.length > 0 ? (
                    <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-bg shadow-xl">
                      {addressHits.map((hit) => (
                        <li key={`${hit.lat}-${hit.lon}-${hit.label}`}>
                          <button type="button" onClick={() => pickAddressHit(hit)}
                            className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-bg-elevated">
                            <MapPin className="mt-0.5 size-3.5 shrink-0 text-court" />
                            <span className="block text-[12px] font-semibold text-fg">{hit.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : addressQuery.trim().length >= 3 && !addressSearching ? (
                    <p className="mt-1 text-[10px] text-fg-subtle">No matches — try a street or landmark.</p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {createPickMode === "photos" ? (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filteredCourts.map((c) => {
                const thumb = courtImagesFor(c.id, 1)[0];
                const selected = c.id === createCourtId;
                return (
                  <button key={c.id} type="button" onClick={() => setCreateCourtId(c.id)}
                    className={cn("w-[44%] max-w-[10.5rem] shrink-0 snap-start overflow-hidden rounded-2xl border text-left",
                      selected ? "border-court ring-2 ring-court/50 shadow-md" : "border-border bg-bg-elevated")}>
                    <div className="relative aspect-[5/4] bg-bg-subtle">
                      {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setCourtInfoId(c.id); }}
                        className="absolute top-1.5 left-1.5 z-10 flex size-7 items-center justify-center rounded-full bg-black/55 text-white"
                        aria-label={`About ${c.name}`}>
                        <Info className="size-3.5" strokeWidth={2.25} />
                      </button>
                      <div className="absolute top-1.5 right-1.5 z-10 flex flex-col items-end gap-0.5">
                        {selected ? <span className="rounded-full bg-court px-1.5 py-0.5 text-[9px] font-bold text-white">✓</span> : null}
                        {isRecommendedCourt(c) ? <span className="rounded-full bg-fg/90 px-1.5 py-0.5 text-[8px] font-bold text-bg uppercase">Top</span> : null}
                        {isShadedCourt(c) ? <span className="rounded-full bg-black/55 px-1.5 py-0.5 text-[8px] font-bold text-white uppercase">Shade</span> : null}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-6">
                        <p className="text-[10px] font-bold tracking-wide text-white uppercase">{c.neighborhood ?? "Austin"}</p>
                        <p className="text-[10px] font-medium text-white/90">{formatMiles(c.miles)} away</p>
                      </div>
                    </div>
                    <div className="px-2 py-1.5">
                      <p className="line-clamp-1 text-[12px] font-semibold text-fg">
                        {c.name.replace(/\s*Courts?\s*$/i, "") || c.name}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            {filteredCourts.length === 0 ? (
              <p className="py-2 text-center text-xs text-fg-muted">No courts match. Expand radius or turn a filter off.</p>
            ) : !createCourtId ? (
              <p className="text-center text-[11px] text-fg-muted">Swipe and tap a court — or ⓘ for details.</p>
            ) : null}
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-fg-muted">
              Tap a pin to open court info. Select it from the popup if you want that court.
            </p>
            <CourtsMap
              courts={filteredCourts}
              location={{ lat: origin.lat, lon: origin.lon, label: "You" }}
              selectedId={createCourtId || courtInfoId || null}
              onSelect={(c) => setCourtInfoId(c.id)}
              variant="finder"
            />
            {!createCourtId ? (
              <p className="text-center text-[11px] text-fg-muted">No court selected yet.</p>
            ) : null}
          </div>
        )}

        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-fg-muted">When</span>
          <input type="datetime-local" value={createWhen} onChange={(e) => setCreateWhen(e.target.value)}
            className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm text-fg" />
          {createStakeMode === "charity" ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  d.setHours(18, 0, 0, 0);
                  setCreateWhen(d.toISOString().slice(0, 16));
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[11px] font-bold",
                  (() => {
                    try {
                      const d = new Date(createWhen);
                      const t = new Date();
                      t.setDate(t.getDate() + 1);
                      return (
                        d.getFullYear() === t.getFullYear() &&
                        d.getMonth() === t.getMonth() &&
                        d.getDate() === t.getDate()
                      );
                    } catch {
                      return false;
                    }
                  })()
                    ? "bg-violet-600 text-white"
                    : "border border-violet-500/30 bg-violet-500/10 text-violet-800 dark:text-violet-200",
                )}
              >
                Play tomorrow · 6pm
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  d.setHours(10, 0, 0, 0);
                  setCreateWhen(d.toISOString().slice(0, 16));
                }}
                className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-fg-muted"
              >
                Tomorrow morning
              </button>
            </div>
          ) : null}
        </label>
        
        <div className="space-y-2 rounded-xl border border-border bg-bg-elevated p-3">
          <p className="text-[11px] font-bold text-fg">Game type</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                { id: "1v1" as const, label: "1v1", sub: "Games to 11" },
                { id: "horse" as const, label: "HORSE", sub: "Classic letters" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setCreateFormat(opt.id);
                  if (opt.id === "horse") {
                    setCreateNotes((n) =>
                      n.includes("HORSE")
                        ? n
                        : "HORSE · outdoor · clean calls. Looking for a fun competitive run.",
                    );
                  }
                }}
                className={cn(
                  "rounded-xl border px-2 py-2.5 text-left",
                  createFormat === opt.id
                    ? "border-court bg-court-soft text-fg"
                    : "border-border bg-bg text-fg-muted",
                )}
              >
                <p className="text-[12px] font-bold">{opt.label}</p>
                <p className="text-[10px] opacity-80">{opt.sub}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-violet-500/25 bg-violet-500/5 p-3">
          <p className="text-[11px] font-bold text-fg">This game counts toward</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setCreateStakeMode("charity");
                setShowPeerStakes(false);
              }}
              className={cn(
                "rounded-xl border px-2 py-2.5 text-left",
                createStakeMode === "charity"
                  ? "border-violet-500 bg-violet-500/15 text-fg"
                  : "border-border bg-bg text-fg-muted",
              )}
            >
              <p className="text-[12px] font-bold">Alzheimer's $50k</p>
              <p className="text-[10px] opacity-80">City goal · give clean</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateStakeMode("fun");
                setShowPeerStakes(false);
              }}
              className={cn(
                "rounded-xl border px-2 py-2.5 text-left",
                createStakeMode === "fun"
                  ? "border-court bg-court-soft text-fg"
                  : "border-border bg-bg text-fg-muted",
              )}
            >
              <p className="text-[12px] font-bold">Just for fun</p>
              <p className="text-[10px] opacity-80">Rating only</p>
            </button>
          </div>

          {createStakeMode === "charity" ? (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] leading-snug text-fg-muted">
                Loser donates $ per point of series margin to Alzheimer's
                research (ex: 10–2 + 10–5 = $13). It adds to Austin's{" "}
                <span className="font-semibold text-fg">$50,000</span> goal —
                not a peer bet.
              </p>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  d.setHours(18, 0, 0, 0);
                  setCreateWhen(d.toISOString().slice(0, 16));
                  setStatusMsg(
                    "Tomorrow 6pm · charity run — pick a court and post.",
                  );
                }}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-violet-600 text-sm font-semibold text-white"
              >
                Play tomorrow for Alzheimer's
              </button>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[10px] font-medium text-fg-muted">
                  $/point of margin
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={createDollarsPerPoint}
                    onChange={(e) =>
                      setCreateDollarsPerPoint(Number(e.target.value) || 1)
                    }
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg"
                  />
                </label>
                <label className="block text-[10px] font-medium text-fg-muted">
                  Cap $ (optional)
                  <input
                    type="number"
                    min={1}
                    placeholder="None"
                    value={createCap}
                    onChange={(e) => setCreateCap(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg"
                  />
                </label>
              </div>
            </div>
          ) : createStakeMode === "fun" ? (
            <p className="text-[11px] text-fg-muted">
              Compete for rating and pride only. You can still join the $50k
              cause on your next run.
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setShowPeerStakes((v) => !v);
              if (!showPeerStakes) setCreateStakeMode("stakes");
              else setCreateStakeMode("charity");
            }}
            className="text-[10px] font-medium text-fg-subtle underline-offset-2 hover:underline"
          >
            {showPeerStakes || createStakeMode === "stakes"
              ? "Hide peer cash options"
              : "Advanced: peer cash (not recommended)"}
          </button>

          {(showPeerStakes || createStakeMode === "stakes") && (
            <div className="space-y-2 rounded-xl border border-border bg-bg p-2.5">
              <p className="text-[11px] leading-snug text-fg-muted">
                Peer-to-peer cash is not the Upset City path. Prefer
                Alzheimer's so every game builds the city goal.
              </p>
              <button
                type="button"
                onClick={() => setCreateStakeMode("stakes")}
                className={cn(
                  "w-full rounded-xl border py-2 text-xs font-semibold",
                  createStakeMode === "stakes"
                    ? "border-fg bg-fg text-bg"
                    : "border-border text-fg-muted",
                )}
              >
                Peer stakes (name a $ price)
              </button>
              {createStakeMode === "stakes" ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-emerald-600">$</span>
                    <input
                      type="number"
                      min={MIN_STAKE_DOLLARS}
                      max={MAX_STAKE_DOLLARS}
                      value={createStakePrice}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n)) {
                          setCreateStakePrice(e.target.value);
                          return;
                        }
                        setCreateStakePrice(
                          String(Math.min(MAX_STAKE_DOLLARS, Math.max(0, n))),
                        );
                      }}
                      className="h-11 min-w-0 flex-1 border-0 border-b-2 border-border bg-transparent font-display text-2xl font-bold tabular-nums text-emerald-600 outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-fg-subtle">
                    Max ${MAX_STAKE_DOLLARS.toLocaleString()} · unpaid = exile
                  </p>
                </>
              ) : null}
            </div>
          )}
        </div>

        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-fg-muted">Notes · who you want</span>
          <textarea value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} rows={2}
            placeholder="Size, skill band, vibe…"
            className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm text-fg" />
        </label>
        <button type="button" onClick={submitCreate} disabled={!createCourtId}
          className={cn("w-full rounded-full py-3 text-sm font-semibold",
            createCourtId ? "bg-court text-white" : "cursor-not-allowed bg-bg-elevated text-fg-subtle")}>
          {createCourtId ? "Post open 1v1" : "Select a court to continue"}
        </button>

        {aboutSheet}
      </div>
    );
  }

  // GAME DETAIL
  if (view === "game" && selected) {
    const host = playerById.get(selected.hostId);
    const miles = haversineMi(origin.lat, origin.lon, selected.lat, selected.lon);
    const court = resolveCourt(selected, courts);
    const images = courtImagesFor(court.id, 4);
    const mapsHref = directionsUrl(court.lat, court.lon, court.name);
    const canInvite = selected.hostId === me.id && selected.status === "open";
    const canCancel =
      (selected.hostId === me.id || selected.opponentId === me.id) &&
      (selected.status === "open" || selected.status === "matched" || selected.status === "scheduled");
    const isHostView = selected.hostId === me.id;
    const someoneJoined =
      !!selected.opponentId ||
      selected.status === "matched" ||
      selected.status === "scheduled" ||
      (selected.rosterIds ?? []).some((id) => id !== selected.hostId);
    const hostEmptyCancel = isHostView && !someoneJoined;
    const opp = selected.opponentId ? playerById.get(selected.opponentId) : null;
    const { day, time } = whenParts(selected.scheduledAt ?? selected.preferredAt);

    return (
      <div className="space-y-3">
        <button type="button" onClick={() => { setView("find"); setSelectedId(null); }}
          className="text-xs font-medium text-fg-muted">← Back to open games</button>

        <div className="overflow-hidden rounded-2xl border border-border shadow-card">
          <div className="relative">
            <ImageCarousel images={images} alt={court.name} className="aspect-[16/9] w-full" priority />
            <div className="absolute top-1.5 left-1.5 z-20">
              <CourtMapCutout lat={court.lat} lon={court.lon} name={court.name}
                address={"address" in court ? court.address : undefined} size={56} zoom={12} />
            </div>
            <div className="absolute top-2 right-2 z-20 rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-semibold tracking-wide text-white uppercase">
              {selected.format === "horse" ? "HORSE" : "Rated 1v1"}
                {selected.stakes?.mode === "charity" ? " · charity" : ""}
                {selected.status === "open" ? " · open" : ""}
            </div>
            <div className="absolute inset-x-0 bottom-2.5 z-20 flex items-center justify-center gap-3">
              <button type="button" onClick={() => host && onOpenPlayer?.(host)} disabled={!host} className="shrink-0">
                {host ? <PlayerAvatar player={host} size="md" className="!size-11 shadow-md ring-2 ring-white" />
                  : <div className="size-11 rounded-full bg-black/40 ring-2 ring-white/70" />}
              </button>
              <span className="font-display text-sm font-black tracking-[0.18em] text-court drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">VS</span>
              <button type="button" onClick={() => opp && onOpenPlayer?.(opp)} disabled={!opp} className="shrink-0">
                {opp ? <PlayerAvatar player={opp} size="md" className="!size-11 shadow-md ring-2 ring-white" />
                  : <div className="flex size-11 items-center justify-center rounded-full border-2 border-dashed border-white/70 bg-black/35">
                      <span className="text-[8px] font-bold text-white uppercase">Open</span>
                    </div>}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2.5 rounded-2xl border border-border bg-bg-elevated p-3.5">
          <div>
            <h3 className="font-display text-base font-semibold text-fg">{court.name}</h3>
            <p className="mt-0.5 text-xs font-medium text-court">
              {formatMiles(miles)} away
              {"neighborhood" in court && court.neighborhood ? (
                <span className="font-normal text-fg-muted"> · {court.neighborhood}</span>
              ) : null}
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-fg px-2.5 py-1.5 text-bg">
            <span className="text-xs font-bold tabular-nums">{day}</span>
            <span className="text-[10px] opacity-50">·</span>
            <span className="text-xs font-bold tabular-nums">{time}</span>
          </div>
          <p className="text-sm font-semibold text-fg">
            {selected.format === "horse"
              ? "HORSE · outdoor · clean calls"
              : "Best of 3 · games to 11 · make it take it"}
          </p>
          {selected.stakes ? (
            <StakeSettleCard
              match={selected}
              me={me}
              host={host}
              opp={opp}
              onMarkSettled={(method) =>
                store.markStakeSettled(selected.id, method)
              }
              onRequestExtension={(note) =>
                store.requestStakeExtension(selected.id, note)
              }
              onReportUnpaid={() => store.reportStakeUnpaid(selected.id)}
            />
          ) : (
            <p className="text-[11px] text-fg-muted">Just for fun · rating only</p>
          )}
          {"address" in court && court.address ? (
            <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="flex items-start gap-1 text-sm text-fg-muted">
              <MapPin className="mt-0.5 size-3.5 shrink-0 opacity-70" />
              <span className="line-clamp-2">{court.address}</span>
            </a>
          ) : null}
        </div>

        {(selected.status === "matched" || selected.status === "scheduled") &&
        host &&
        opp ? (
          <MatchRemindersCard
            match={{
              id: selected.id,
              courtName: court.name,
              lat: selected.lat,
              lon: selected.lon,
              whenIso: selected.scheduledAt ?? selected.preferredAt,
              hostName: host.name,
              oppName: opp.name,
              notes: selected.notes,
            }}
          />
        ) : null}

        {selected.status === "open" ? (
          <HostScouting match={selected} host={host} me={me} players={players} matches={matches}
            reviews={store.playerReviews ?? []} isHost={selected.hostId === me.id}
            onSaveNotes={(notes) => store.updateMatchNotes(selected.id, notes)} onOpenPlayer={onOpenPlayer} />
        ) : null}

        <div className="space-y-2 rounded-xl border border-border bg-bg-elevated p-3">
          <div className="flex items-center gap-2">
            {host ? (
              <button type="button" onClick={() => onOpenPlayer?.(host)}>
                <PlayerAvatar player={host} size="sm" className="!size-8" />
              </button>
            ) : <MessageCircle className="size-3.5 text-fg-muted" />}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-fg-muted">Game chat</p>
              {host ? <p className="truncate text-[11px] text-fg">Host · {host.name}</p> : null}
            </div>
          </div>
          <div className="max-h-40 space-y-2 overflow-y-auto">
            {(selected.chat ?? []).length === 0 ? (
              <p className="text-xs text-fg-subtle">No messages yet.</p>
            ) : (selected.chat ?? []).map((c) => {
              const author = c.authorId ? playerById.get(c.authorId) : undefined;
              return (
                <div key={c.id} className="flex items-start gap-2">
                  {author ? <PlayerAvatar player={author} size="xs" className="mt-0.5 !size-7" showRank={false} />
                    : <div className="mt-0.5 size-7 rounded-full bg-bg-subtle" />}
                  <p className="min-w-0 flex-1 text-xs">
                    <span className="font-semibold text-fg">{c.authorName}</span>
                    <span className="text-fg-muted"> · {c.text}</span>
                  </p>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <PlayerAvatar player={me} size="xs" className="!size-7 shrink-0" showRank={false} />
            <input value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} placeholder="Message…"
              className="min-w-0 flex-1 rounded-full border border-border bg-bg px-3 py-2 text-sm" />
            <button type="button" onClick={() => { store.postMatchChat(selected.id, chatDraft); setChatDraft(""); }}
              className="rounded-full bg-fg px-3 py-2 text-xs font-semibold text-bg">Send</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {selected.status === "open" && selected.hostId !== me.id ? (
            <button type="button" onClick={() => joinGame(selected.id)}
              className="min-w-[40%] flex-1 rounded-full bg-court py-3 text-sm font-semibold text-white">
              Join {selected.format === "horse" ? "HORSE" : "1v1"}
            </button>
          ) : null}
          {canInvite ? (
            <button type="button" onClick={() => setInviteOpen(true)}
              className="min-w-[40%] flex-1 rounded-full border border-border bg-bg-elevated py-3 text-sm font-semibold">Invite opponent</button>
          ) : null}
          {canCancel ? (
            <button type="button" onClick={() => { setCancelOpen(true); setCancelReason(""); setCancelError(null); }}
              className="min-w-[40%] flex-1 rounded-full border border-danger/40 bg-danger/10 py-3 text-sm font-semibold text-danger">
              {hostEmptyCancel ? "Close listing" : "Cancel game"}
            </button>
          ) : null}
        </div>

        {cancelOpen ? (
          <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/50 p-3 sm:items-center">
            <div className="w-full max-w-md rounded-2xl border border-border bg-bg p-4 shadow-xl">
              <p className="text-sm font-semibold text-fg">{hostEmptyCancel ? "Close this listing?" : "Cancel this game?"}</p>
              {!hostEmptyCancel ? (
                <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3}
                  className="mt-3 w-full rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm" placeholder="Why?" />
              ) : (
                <p className="mt-1 text-xs text-fg-muted">No one joined — free close, no penalty.</p>
              )}
              {cancelError ? <p className="mt-2 text-xs text-danger">{cancelError}</p> : null}
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setCancelOpen(false)} className="flex-1 rounded-full border border-border py-2.5 text-sm font-semibold">Keep</button>
                <button type="button" onClick={() => {
                  const r = store.cancelMatch(selected.id, hostEmptyCancel ? "" : cancelReason);
                  if (!r.ok) { setCancelError(r.reason); return; }
                  setCancelOpen(false); setStatusMsg("Game cancelled."); setView("find"); setSelectedId(null);
                }} className="flex-1 rounded-full bg-danger py-2.5 text-sm font-semibold text-white">Confirm</button>
              </div>
            </div>
          </div>
        ) : null}

        {inviteOpen ? (
          <InviteSheet
            candidates={inviteCandidates}
            query={inviteQuery}
            onQuery={setInviteQuery}
            filters={inviteFilters}
            onToggleFilter={(id) => {
              setInviteFilters((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            sorts={inviteSorts}
            onToggleSort={(id) => {
              setInviteSorts((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            invitedIds={selected.guestInviteIds ?? []}
            friendIds={friendIds}
            onInvite={(pid) => {
              const r = store.inviteToMatch(selected.id, pid);
              if (!r.ok) setStatusMsg(r.reason);
            }}
            onAddFriend={(pid) => store.addFriend(pid)}
            onClose={() => setInviteOpen(false)}
          />
        ) : null}
      </div>
    );
  }

  // FIND
  return (
    <div className="space-y-2.5">
      {statusMsg ? (
        <p className="rounded-lg bg-court/15 px-3 py-2 text-xs font-medium text-court">
          {statusMsg}
          <button type="button" className="ml-2 underline" onClick={() => setStatusMsg(null)}>dismiss</button>
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        {!compactHeader ? (
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-court uppercase">Quick Match</p>
            <h3 className="font-display text-lg font-semibold text-fg">Find a run</h3>
          </div>
        ) : (
          <p className="text-[11px] text-fg-muted">{openGames.length} open 1v1s citywide</p>
        )}
        <button type="button" onClick={startCreate} className="shrink-0 rounded-full bg-court px-3 py-1.5 text-xs font-semibold text-white">
          <span className="inline-flex items-center gap-1"><Plus className="size-3.5" strokeWidth={2.5} />Create</span>
        </button>
      </div>
      <div className="flex rounded-xl border border-border bg-bg-elevated p-0.5">
        <div className="flex-1 rounded-lg bg-fg py-2 text-center text-[12px] font-semibold text-bg">1v1</div>
        {(["3v3", "5v5"] as const).map((label) => (
          <div key={label} className="flex flex-1 flex-col items-center justify-center py-1.5 opacity-40">
            <span className="text-[12px] font-semibold text-fg-muted">{label}</span>
            <span className="text-[8px] font-bold uppercase text-fg-subtle">Coming soon</span>
          </div>
        ))}
      </div>

      <CampaignBanner className="mb-1" />

      {upcomingGames.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-bold tracking-wide text-court uppercase">Upcoming games</p>
          {upcomingGames.map((m) => {
            const host = playerById.get(m.hostId);
            const oppP = m.opponentId ? playerById.get(m.opponentId) : null;
            const { day, time } = whenParts(m.scheduledAt ?? m.preferredAt);
            return (
              <button key={m.id} type="button" onClick={() => openGame(m.id)}
                className="flex w-full items-center gap-2.5 rounded-xl border border-court/40 bg-court/10 p-2.5 text-left">
                <div className="flex shrink-0 items-center gap-1">
                  {host ? <PlayerAvatar player={host} size="sm" /> : <div className="size-10 rounded-full bg-bg-subtle" />}
                  <span className="px-0.5 text-[10px] font-bold text-court uppercase">vs</span>
                  {oppP ? <PlayerAvatar player={oppP} size="sm" /> : (
                    <div className="flex size-10 items-center justify-center rounded-full border border-dashed border-border text-[9px]">?</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">{m.courtName}</p>
                  <div className="mt-0.5"><StakeChip stakes={m.stakes} /></div>
                  <div className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-fg px-2 py-1 text-bg">
                    <span className="text-[11px] font-bold">{day}</span><span className="opacity-50">·</span>
                    <span className="text-[11px] font-bold">{time}</span>
                  </div>
                </div>
                <ChevronRight className="size-4 text-fg-subtle" />
              </button>
            );
          })}
        </div>
      ) : null}

      {myHostingOpen.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase text-fg-subtle">Your open posts</p>
          {myHostingOpen.map((m) => {
            const { day, time } = whenParts(m.preferredAt);
            return (
              <button key={m.id} type="button" onClick={() => openGame(m.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-bg-elevated p-2.5 text-left">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.courtName}</p>
                  <div className="mt-0.5"><StakeChip stakes={m.stakes} /></div>
                  <div className="mt-1 inline-flex gap-1.5 rounded-lg bg-fg/90 px-2 py-1 text-bg">
                    <span className="text-[11px] font-bold">{day}</span><span className="opacity-50">·</span>
                    <span className="text-[11px] font-bold">{time}</span>
                  </div>
                </div>
                <span className="text-[11px] text-fg-subtle">Open</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="relative py-1">
        <div className="border-t border-border" />
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
          <span className="bg-bg px-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-fg-subtle">Open games · city</span>
        </div>
      </div>

      {openGames.length === 0 ? (
        <div className="rounded-xl border border-border bg-bg-elevated px-4 py-8 text-center">
          <p className="text-sm text-fg-muted">No open 1v1s right now.</p>
          <button type="button" onClick={startCreate} className="mt-3 text-sm font-semibold text-court">Create one</button>
        </div>
      ) : (
        <div className="space-y-2">
          {openGames.map(({ match: m, miles }) => {
            const host = playerById.get(m.hostId);
            const { day, time } = whenParts(m.preferredAt);
            return (
              <button key={m.id} type="button" onClick={() => openGame(m.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-bg-elevated p-2.5 text-left">
                {host ? <PlayerAvatar player={host} size="lg" className="!size-12" /> : <div className="size-12 rounded-full bg-bg-subtle" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {host?.name ?? "Host"}
                    {host ? <span className="ml-1.5 text-[11px] text-fg-muted">{displayRating(host.rating)}</span> : null}
                    {m.format === "horse" ? (
                      <span className="ml-1.5 text-[10px] font-bold text-court">HORSE</span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-fg-muted">{m.courtName}</p>
                  <div className="mt-0.5"><StakeChip stakes={m.stakes} /></div>
                  <div className="mt-1.5 inline-flex gap-1.5 rounded-lg border border-border bg-bg-subtle px-2 py-1">
                    <span className="text-[11px] font-bold">{day}</span><span className="text-fg-subtle">·</span>
                    <span className="text-[11px] font-bold">{time}</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-fg-subtle">
                    <MapPin className="size-3" />{formatMiles(miles)} · rated 1v1
                  </p>
                </div>
                <ChevronRight className="size-4 text-fg-subtle" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HostScouting({
  match, host, me, players, matches, reviews, isHost, onSaveNotes, onOpenPlayer,
}: {
  match: Match; host?: Player; me: Player; players: Player[]; matches: Match[];
  reviews: PlayerReview[]; isHost: boolean; onSaveNotes: (notes: string) => void;
  onOpenPlayer?: (p: Player) => void;
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [noteDraft, setNoteDraft] = useState(match.notes ?? "");
  const [histOpen, setHistOpen] = useState(true);
  const [revOpen, setRevOpen] = useState(true);
  const [expandedMutualId, setExpandedMutualId] = useState<string | null>(null);
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [historyDetailId, setHistoryDetailId] = useState<string | null>(null);
  useEffect(() => { setNoteDraft(match.notes ?? ""); }, [match.id, match.notes]);
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const hostHistory = useMemo(() => {
    if (!host) return [];
    return matches
      .filter((m) => m.status === "confirmed" && m.opponentId && (m.hostId === host.id || m.opponentId === host.id))
      .sort((a, b) => (b.scheduledAt ?? b.preferredAt).localeCompare(a.scheduledAt ?? a.preferredAt));
  }, [matches, host]);
  const myPastOpponents = useMemo(() => {
    const ids = new Set<string>();
    for (const m of matches) {
      if (m.status !== "confirmed" || !m.opponentId) continue;
      if (m.hostId === me.id) ids.add(m.opponentId);
      if (m.opponentId === me.id) ids.add(m.hostId);
    }
    return ids;
  }, [matches, me.id]);
  const mutual = useMemo(() => {
    if (!host) return [] as Array<{
      player: Player; hostResult: "W" | "L"; myResult: "W" | "L";
      hostWins: number; hostLosses: number; myWins: number; myLosses: number;
      hostScores: string; myScores: string; hostCourt: string; myCourt: string;
    }>;
    const out = [];
    for (const oppId of myPastOpponents) {
      if (oppId === host.id) continue;
      const hostMatch = hostHistory.find((m) => m.hostId === oppId || m.opponentId === oppId);
      if (!hostMatch) continue;
      const myMatch = matches.find(
        (m) => m.status === "confirmed" &&
          ((m.hostId === me.id && m.opponentId === oppId) || (m.opponentId === me.id && m.hostId === oppId)),
      );
      if (!myMatch) continue;
      const opp = playerById.get(oppId);
      if (!opp) continue;
      const hostIsA = hostMatch.hostId === host.id;
      const hostWins = seriesWins(hostMatch.scores, hostIsA ? "a" : "b");
      const hostLosses = seriesWins(hostMatch.scores, hostIsA ? "b" : "a");
      const meIsA = myMatch.hostId === me.id;
      const myWins = seriesWins(myMatch.scores, meIsA ? "a" : "b");
      const myLosses = seriesWins(myMatch.scores, meIsA ? "b" : "a");
      out.push({
        player: opp,
        hostResult: (hostWins > hostLosses ? "W" : "L") as "W" | "L",
        myResult: (myWins > myLosses ? "W" : "L") as "W" | "L",
        hostWins, hostLosses, myWins, myLosses,
        hostScores: scoreLine(hostMatch.scores), myScores: scoreLine(myMatch.scores),
        hostCourt: hostMatch.courtName, myCourt: myMatch.courtName,
      });
    }
    return out;
  }, [host, hostHistory, myPastOpponents, matches, me.id, playerById]);
  const hostReviews = useMemo(() => {
    if (!host) return [];
    return reviews.filter((r) => r.targetId === host.id).sort((a, b) => b.at.localeCompare(a.at));
  }, [reviews, host]);
  const avgStars = hostReviews.length > 0
    ? hostReviews.reduce((s, r) => s + r.stars, 0) / hostReviews.length : null;

  return (
    <div className="space-y-2.5">
      <div className="rounded-xl border border-border bg-bg-elevated p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">Host notes · who they want</p>
          {isHost ? (
            <button type="button" onClick={() => {
              if (editingNotes) { onSaveNotes(noteDraft); setEditingNotes(false); }
              else setEditingNotes(true);
            }} className="text-[11px] font-semibold text-court">{editingNotes ? "Save" : "Edit"}</button>
          ) : null}
        </div>
        {editingNotes && isHost ? (
          <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3}
            className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm" />
        ) : (
          <p className="mt-1.5 text-sm leading-snug text-fg">
            {(match.notes ?? "").replace(/^Best of 3\s*[·•]\s*games to 11\s*[·•]\s*make it take it\.?\s*/i, "").trim() || "No notes yet."}
          </p>
        )}
      </div>
      {!isHost ? (
        <div className="rounded-xl border border-border bg-bg-elevated p-3">
          <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">Players you’ve both faced</p>
          {!host || mutual.length === 0 ? (
            <p className="mt-2 text-xs text-fg-muted">No shared opponents yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {mutual.map((row) => {
                const open = expandedMutualId === row.player.id;
                const first = row.player.name.split(" ")[0] ?? row.player.name;
                return (
                  <div key={row.player.id} className="overflow-hidden rounded-xl border border-border bg-bg">
                    <button type="button" onClick={() => setExpandedMutualId(open ? null : row.player.id)}
                      className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left">
                      <PlayerAvatar player={row.player} size="sm" className="!size-9" showRank={false} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{row.player.name}</p>
                        <p className="text-[11px] text-fg-muted">Host {row.hostResult} · You {row.myResult}</p>
                      </div>
                      <span className="text-[11px] text-fg-muted">{open ? "Hide" : "Results"}</span>
                    </button>
                    {open ? (
                      <div className="space-y-2 border-t border-border px-2.5 py-3">
                        <div className="rounded-xl bg-bg-elevated p-3">
                          <p className="text-[10px] font-bold uppercase text-fg-subtle">When {host.name.split(" ")[0]} played {first}</p>
                          <p className="mt-1 text-sm font-semibold">{row.hostResult} {row.hostWins}–{row.hostLosses}</p>
                          <p className="text-xs text-fg-muted">{row.hostScores || "—"} · {row.hostCourt}</p>
                        </div>
                        <div className="rounded-xl bg-bg-elevated p-3">
                          <p className="text-[10px] font-bold uppercase text-fg-subtle">When you played {first}</p>
                          <p className="mt-1 text-sm font-semibold">{row.myResult} {row.myWins}–{row.myLosses}</p>
                          <p className="text-xs text-fg-muted">{row.myScores || "—"} · {row.myCourt}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
      {!isHost ? (
        <>
          <div className="rounded-xl border border-border bg-bg-elevated p-3">
            <button type="button" onClick={() => setHistOpen((v) => !v)} className="flex w-full items-center justify-between">
              <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
                Host history{host ? ` · ${host.wins}W–${host.losses}L · ${hostHistory.length}` : ""}
              </p>
              <span className="text-[11px] text-fg-muted">{histOpen ? "Hide" : "Show"}</span>
            </button>
            {histOpen ? (
              !host || hostHistory.length === 0 ? (
                <p className="mt-2 text-xs text-fg-muted">No games yet.</p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {hostHistory.slice(0, 3).map((m) => {
                    const hostIsA = m.hostId === host.id;
                    const oppId = hostIsA ? m.opponentId! : m.hostId;
                    const opp = playerById.get(oppId);
                    const wins = seriesWins(m.scores, hostIsA ? "a" : "b");
                    const losses = seriesWins(m.scores, hostIsA ? "b" : "a");
                    const won = wins > losses;
                    return (
                      <button key={m.id} type="button" onClick={() => { setHistoryDetailId(m.id); setHistorySheetOpen(true); }}
                        className="flex w-full items-center gap-2 rounded-lg bg-bg px-2.5 py-2 text-left">
                        {opp ? <PlayerAvatar player={opp} size="xs" className="!size-8" showRank={false} /> : <div className="size-8 rounded-full bg-bg-subtle" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">vs {opp?.name ?? "Opponent"}</p>
                          <p className="truncate text-[10px] text-fg-muted">{m.courtName} · {scoreLine(m.scores)}</p>
                        </div>
                        <span className={won ? "text-xs font-bold text-success" : "text-xs font-bold text-danger"}>
                          {won ? "W" : "L"} {wins}–{losses}
                        </span>
                      </button>
                    );
                  })}
                  <button type="button" onClick={() => { setHistoryDetailId(null); setHistorySheetOpen(true); }}
                    className="w-full rounded-lg border border-border py-2.5 text-center text-xs font-semibold text-court">
                    View complete history ({hostHistory.length})
                  </button>
                </div>
              )
            ) : null}
          </div>
          {historySheetOpen && host ? (
            <HostHistorySheet host={host} games={hostHistory} playerById={playerById} focusId={historyDetailId}
              onClose={() => { setHistorySheetOpen(false); setHistoryDetailId(null); }} onOpenPlayer={onOpenPlayer} />
          ) : null}
        </>
      ) : null}
      {!isHost ? (
        <div className="rounded-xl border border-border bg-bg-elevated p-3">
          <button type="button" onClick={() => setRevOpen((v) => !v)} className="flex w-full items-center justify-between">
            <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
              What players say{avgStars != null ? ` · ${avgStars.toFixed(1)}★ · ${hostReviews.length}` : ""}
            </p>
            <span className="text-[11px] text-fg-muted">{revOpen ? "Hide" : "Show"}</span>
          </button>
          {revOpen ? (
            hostReviews.length === 0 ? <p className="mt-2 text-xs text-fg-muted">No reviews yet.</p> : (
              <div className="mt-2 space-y-2">
                {hostReviews.map((r) => {
                  const author = playerById.get(r.authorId);
                  return (
                    <div key={r.id} className="rounded-lg border border-border bg-bg px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        {author ? <PlayerAvatar player={author} size="xs" className="!size-7" showRank={false} /> : <div className="size-7 rounded-full bg-bg-subtle" />}
                        <p className="min-w-0 flex-1 truncate text-xs font-semibold">{r.authorName}</p>
                        <span className="text-[11px] font-bold text-court">{"★".repeat(r.stars)}</span>
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">{r.text}</p>
                    </div>
                  );
                })}
              </div>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function HostHistorySheet({
  host, games, playerById, focusId, onClose, onOpenPlayer,
}: {
  host: Player; games: Match[]; playerById: Map<string, Player>; focusId: string | null;
  onClose: () => void; onOpenPlayer?: (p: Player) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(focusId);
  useEffect(() => { setExpandedId(focusId); }, [focusId]);
  return (
    <div className="fixed inset-0 z-[88] flex items-end justify-center bg-black/55 sm:items-center sm:p-4">
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-bg shadow-xl sm:rounded-2xl">
        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <PlayerAvatar player={host} size="md" className="!size-12" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase text-court">Complete game history</p>
            <h3 className="truncate font-display text-lg font-semibold">{host.name}</h3>
            <p className="text-xs text-fg-muted">{host.wins}W–{host.losses}L · {displayRating(host.rating)}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5"><X className="size-4" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {games.map((m) => {
            const hostIsA = m.hostId === host.id;
            const oppId = hostIsA ? m.opponentId! : m.hostId;
            const opp = playerById.get(oppId);
            const wins = seriesWins(m.scores, hostIsA ? "a" : "b");
            const losses = seriesWins(m.scores, hostIsA ? "b" : "a");
            const won = wins > losses;
            const open = expandedId === m.id;
            return (
              <div key={m.id} className="overflow-hidden rounded-xl border border-border bg-bg-elevated">
                <button type="button" onClick={() => setExpandedId(open ? null : m.id)}
                  className="flex w-full items-center gap-2.5 p-2.5 text-left">
                  {opp ? <PlayerAvatar player={opp} size="sm" className="!size-10" /> : <div className="size-10 rounded-full bg-bg-subtle" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">vs {opp?.name ?? "Opponent"}</p>
                    <p className="truncate text-[11px] text-fg-muted">{formatLocalWhen(m.scheduledAt ?? m.preferredAt)}</p>
                  </div>
                  <p className={won ? "text-sm font-black text-success" : "text-sm font-black text-danger"}>
                    {won ? "W" : "L"} {wins}–{losses}
                  </p>
                </button>
                {open ? (
                  <div className="space-y-1 border-t border-border px-3 py-2.5">
                    <p className="text-xs text-fg-muted">{m.courtName}</p>
                    {(m.scores ?? []).map((g, i) => {
                      const hostPts = hostIsA ? g.a : g.b;
                      const oppPts = hostIsA ? g.b : g.a;
                      return (
                        <div key={i} className="flex justify-between rounded-lg bg-bg px-2.5 py-1.5 text-xs">
                          <span className="text-fg-muted">Game {i + 1}</span>
                          <span className="font-semibold">{hostPts}–{oppPts}</span>
                        </div>
                      );
                    })}
                    {opp ? (
                      <button type="button" onClick={() => onOpenPlayer?.(opp)}
                        className="w-full pt-1 text-center text-[11px] font-semibold text-court">View profile</button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="border-t border-border p-3">
          <button type="button" onClick={onClose} className="w-full rounded-full bg-fg py-2.5 text-sm font-semibold text-bg">Done</button>
        </div>
      </div>
    </div>
  );
}

function InviteSheet({
  candidates,
  query,
  onQuery,
  filters,
  onToggleFilter,
  sorts,
  onToggleSort,
  invitedIds,
  friendIds,
  onInvite,
  onAddFriend,
  onClose,
}: {
  candidates: Player[];
  query: string;
  onQuery: (q: string) => void;
  filters: Set<InviteFilter>;
  onToggleFilter: (id: InviteFilter) => void;
  sorts: Set<InviteSortKey>;
  onToggleSort: (id: InviteSortKey) => void;
  invitedIds: string[];
  friendIds: string[];
  onInvite: (id: string) => void;
  onAddFriend: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-bg shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Invite opponent</p>
          <button type="button" onClick={onClose} className="p-2">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-2 border-b border-border px-3 py-2">
          <div className="flex items-center gap-2 rounded-full border border-border bg-bg-elevated px-3 py-2">
            <Search className="size-3.5 text-fg-subtle" />
            <input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search by name…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
              Filter · pick any combo
            </p>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["friends", "Friends"],
                  ["available", "Available"],
                  ["active", "Active"],
                ] as const
              ).map(([id, label]) => {
                const on = filters.has(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onToggleFilter(id)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      on ? "bg-fg text-bg" : "bg-bg-elevated text-fg-muted",
                    )}
                  >
                    {on ? "✓ " : ""}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
              Sort · pick any combo
            </p>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["rating", "Player rating"],
                  ["height", "Height"],
                  ["streak", "Win streak"],
                ] as const
              ).map(([id, label]) => {
                const on = sorts.has(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onToggleSort(id)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      on ? "bg-court text-white" : "border border-border bg-bg-elevated text-fg-muted",
                    )}
                  >
                    {on ? "✓ " : ""}
                    {label}
                  </button>
                );
              })}
            </div>
            {sorts.size > 0 ? (
              <p className="text-[10px] text-fg-subtle">
                Order:{" "}
                {[
                  sorts.has("rating") ? "rating" : null,
                  sorts.has("height") ? "height" : null,
                  sorts.has("streak") ? "streak" : null,
                ]
                  .filter(Boolean)
                  .join(" → ")}{" "}
                (high → low)
              </p>
            ) : (
              <p className="text-[10px] text-fg-subtle">
                Default: online & recent first
              </p>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {candidates.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs text-fg-muted">
              No players match these filters.
            </p>
          ) : null}
          {candidates.map((p) => {
            const invited = invitedIds.includes(p.id);
            const isFriend = friendIds.includes(p.id);
            return (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-xl border border-border bg-bg-elevated px-2.5 py-2"
              >
                <PlayerAvatar player={p} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="truncate text-[11px] text-fg-muted">
                    {formatHeightInches(p.heightIn)}
                    {" · "}
                    {displayRating(p.rating)}
                    {(p.streak ?? 0) > 0 ? (
                      <span className="text-success">
                        {" · "}
                        {p.streak} streak
                      </span>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onAddFriend(p.id)}
                  className="p-1.5 text-fg-muted"
                >
                  <UserPlus
                    className={cn("size-3.5", isFriend && "text-court")}
                  />
                </button>
                <button
                  type="button"
                  disabled={invited}
                  onClick={() => onInvite(p.id)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    invited ? "bg-bg text-fg-subtle" : "bg-court text-white",
                  )}
                >
                  {invited ? "Invited" : "Invite"}
                </button>
              </div>
            );
          })}
        </div>
        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-fg py-2.5 text-sm font-semibold text-bg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
```

## FILE: `src/components/compete/scene-panel.tsx`

```tsx
import { useMemo, useState } from "react";
import {
  Calendar,
  Check,
  Clock,
  Swords,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import { namedAustinCourts } from "@/lib/courts/catalog";
import { displayRating, handicapLine } from "@/lib/rating/engine";
import {
  formatLocalWhen,
  useUpsetStore,
} from "@/lib/upset/store";
import type { Match, Player } from "@/lib/upset/types";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { PlayerCatalog } from "@/components/compete/player-catalog";
import { PlayerChip } from "@/components/compete/player-chip";
import { PlayerProfile } from "@/components/compete/player-profile";
import { cn, formatHeightInches } from "@/lib/utils";

type SceneTab = "ladder" | "pending" | "scheduled" | "quick" | "catalog" | "messages";

export function ScenePanel({
  onQuickAtCourt,
}: {
  onQuickAtCourt?: (courtId: string) => void;
}) {
  const [tab, setTab] = useState<SceneTab>("pending");
  const store = useUpsetStore();
  const [selected, setSelected] = useState<Player | null>(null);
  const [matchDetail, setMatchDetail] = useState<Match | null>(null);
  const [raceMsg, setRaceMsg] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-bg-elevated p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-court-soft text-court">
            <Swords className="size-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-fg">
              Austin 1v1 scene
            </h2>
            <p className="mt-0.5 text-sm leading-relaxed text-fg-muted">
              Rated best-of-3. Crowns on courts. Quick Match broadcasts — not a
              queue.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-bg-subtle p-3">
          <PlayerAvatar player={store.me} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-fg">{store.me.name}</p>
            <p className="text-xs text-fg-muted">
              {displayRating(store.me.rating)} ·{" "}
              {formatHeightInches(store.me.heightIn)} ·{" "}
              {store.me.sportsmanship.toFixed(1)}★ sports ·{" "}
              {store.me.reliability.toFixed(1)}★ show
            </p>
          </div>
          <div className="text-right text-xs text-fg-subtle">
            <p className="font-medium text-fg-muted">
              {store.me.wins}W–{store.me.losses}L
            </p>
            <p className="capitalize">{store.me.availability}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-full border border-border bg-bg-elevated p-1 no-scrollbar">
        {(
          [
            { id: "pending" as const, label: "Pending", icon: Users },
            { id: "scheduled" as const, label: "Scheduled", icon: Calendar },
            { id: "quick" as const, label: "Quick Match", icon: Zap },
            { id: "catalog" as const, label: "Players", icon: Users },
            { id: "messages" as const, label: "Messages", icon: Users },
            { id: "ladder" as const, label: "Ladder", icon: Trophy },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-semibold transition-colors",
              tab === t.id ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            <t.icon className="size-3.5" strokeWidth={2} />
            {t.label}
          </button>
        ))}
      </div>

      {raceMsg && (
        <div className="rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm text-fg-muted">
          {raceMsg}
        </div>
      )}

      {tab === "ladder" && (
        <Ladder
          players={store.leaderboard}
          meId={store.me.id}
          onSelect={setSelected}
        />
      )}
      {tab === "pending" && (
        <PendingList
          matches={store.openMatches}
          players={store.players}
          meId={store.me.id}
          onAccept={(id) => {
            const r = store.tryAcceptRace(id);
            if (r === "filled") {
              setRaceMsg(
                "That one just filled — here are other open games near you.",
              );
            } else {
              setRaceMsg(null);
              const m = store.matches.find((x) => x.id === id);
              if (m) setMatchDetail({ ...m, status: "scheduled", opponentId: store.me.id });
            }
          }}
          onOpen={setMatchDetail}
          onCancel={(id) => {
            store.cancelMatch(id, "Cancelled from open games list.");
          }}
        />
      )}
      {tab === "scheduled" && (
        <ScheduledList
          matches={store.scheduledMatches}
          players={store.players}
          meId={store.me.id}
          onOpen={setMatchDetail}
          onPredict={store.predict}
          onComment={store.commentOnMatch}
        />
      )}
      
      {tab === "catalog" && (
        <PlayerCatalog
          players={store.catalogPlayers}
          onOpen={setSelected}
          onChallenge={(p) => {
            setSelected(p);
          }}
        />
      )}
      {tab === "messages" && (
        <MessagesPanel
          threads={store.dmThreads}
          players={store.players}
          meId={store.me.id}
          onOpenPlayer={(id) => {
            const p = store.playerById(id);
            if (p) setSelected(p);
          }}
          onAccept={store.acceptDmRequest}
          onSend={store.sendDm}
        />
      )}

      {tab === "quick" && (
        <QuickMatchForm
          me={store.me}
          onCreate={(input) => {
            store.createQuickMatch(input);
            setTab("pending");
          }}
        />
      )}

      {selected && (
        <PlayerProfile
          player={selected}
          onClose={() => setSelected(null)}
          onChallenged={() => setTab("pending")}
        />
      )}
      {matchDetail && (
        <MatchSheet
          match={store.matches.find((m) => m.id === matchDetail.id) ?? matchDetail}
          meId={store.me.id}
          players={store.players}
          onClose={() => setMatchDetail(null)}
          onEnterScore={store.enterScore}
          onConfirm={store.confirmScore}
          onPredict={store.predict}
          onComment={store.commentOnMatch}
        />
      )}
    </div>
  );
}

function Ladder({
  players,
  meId,
  onSelect,
}: {
  players: Player[];
  meId: string;
  onSelect: (p: Player) => void;
}) {
  return (
    <div className="space-y-2">
      {players.map((p, i) => {
        const isMe = p.id === meId;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left",
              isMe
                ? "border-court/40 bg-court-soft"
                : "border-border bg-bg-elevated hover:border-border-strong",
            )}
          >
            <span
              className={cn(
                "w-6 text-center text-sm font-semibold tabular-nums",
                i < 3 ? "text-court" : "text-fg-subtle",
              )}
            >
              {i + 1}
            </span>
            <PlayerChip
              player={p}
              onOpen={onSelect}
              size="sm"
              subtitle={`${formatHeightInches(p.heightIn)} · ${p.availability}${isMe ? " · you" : ""}`}
            />
            <div className="hidden" />
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums text-fg">
                {displayRating(p.rating)}
              </p>
              <p className="text-[11px] text-fg-subtle">
                {p.wins}W–{p.losses}L
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PendingList({
  matches,
  players,
  meId,
  onAccept,
  onOpen,
  onCancel,
}: {
  matches: Match[];
  players: Player[];
  meId: string;
  onAccept: (id: string) => void;
  onOpen: (m: Match) => void;
  onCancel: (id: string) => void;
}) {
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-bg-elevated px-6 py-12 text-center">
        <Users className="mx-auto size-8 text-fg-subtle" strokeWidth={1.5} />
        <h3 className="mt-3 font-display text-base font-semibold text-fg">
          No open games
        </h3>
        <p className="mt-1 text-sm text-fg-muted">
          Nobody’s free right now. Post a Quick Match for tonight — 6 players
          nearby usually run weekday evenings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {matches.map((g) => {
        const host = byId.get(g.hostId);
        const isHost = g.hostId === meId;
        return (
          <div key={g.id} className="rounded-2xl border border-border bg-bg-elevated p-4">
            <button type="button" className="w-full text-left" onClick={() => onOpen(g)}>
              <div className="flex items-start gap-3">
                {host && <PlayerAvatar player={host} size="sm" />}
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-semibold text-fg">
                    {g.courtName}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted">
                    <Clock className="size-3" strokeWidth={2} />
                    {formatLocalWhen(g.preferredAt)}
                  </p>
                  <p className="mt-1 text-xs text-fg-subtle">
                    {host?.name} · {host ? displayRating(host.rating) : "—"} ·{" "}
                    {host ? formatHeightInches(host.heightIn) : ""}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Chip>
                  {formatHeightInches(g.filters.heightMinIn)}–
                  {formatHeightInches(g.filters.heightMaxIn)}
                </Chip>
                <Chip>
                  {g.filters.ratingMin}–{g.filters.ratingMax}
                </Chip>
                <Chip>{g.filters.sportsmanshipMin.toFixed(1)}★+</Chip>
              </div>
              {g.notes && (
                <p className="mt-2 text-xs text-fg-muted">{g.notes}</p>
              )}
            </button>
            <div className="mt-3">
              {isHost ? (
                <button
                  type="button"
                  onClick={() => onCancel(g.id)}
                  className="h-10 w-full rounded-xl border border-border text-sm font-medium text-fg-muted"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onAccept(g.id)}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-fg"
                >
                  <Check className="size-4" strokeWidth={2} />
                  Accept
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScheduledList({
  matches,
  players,
  meId,
  onOpen,
  onPredict,
  onComment,
}: {
  matches: Match[];
  players: Player[];
  meId: string;
  onOpen: (m: Match) => void;
  onPredict: (id: string, winnerId: string) => void;
  onComment: (id: string, text: string) => void;
}) {
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-bg-elevated px-6 py-12 text-center">
        <Calendar className="mx-auto size-8 text-fg-subtle" strokeWidth={1.5} />
        <h3 className="mt-3 font-display text-base font-semibold text-fg">
          No scheduled games
        </h3>
        <p className="mt-1 text-sm text-fg-muted">
          When two players lock a time, it shows up here for the city to follow.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {matches.map((g) => {
        const a = byId.get(g.hostId);
        const b = g.opponentId ? byId.get(g.opponentId) : undefined;
        const myPick = g.predictions[meId];
        return (
          <div key={g.id} className="rounded-2xl border border-border bg-bg-elevated p-4">
            <button type="button" className="w-full text-left" onClick={() => onOpen(g)}>
              <p className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
                {formatLocalWhen(g.scheduledAt ?? g.preferredAt)}
              </p>
              <p className="mt-1 font-display text-sm font-semibold text-fg">
                {a?.name ?? "?"} vs {b?.name ?? "TBD"}
              </p>
              <p className="mt-0.5 text-xs text-fg-muted">{g.courtName}</p>
              {a && b && (
                <p className="mt-2 text-xs text-fg-subtle">
                  {displayRating(a.rating)} · {formatHeightInches(a.heightIn)} vs{" "}
                  {displayRating(b.rating)} · {formatHeightInches(b.heightIn)}
                </p>
              )}
            </button>
            {a && b && g.status === "scheduled" && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onPredict(g.id, a.id)}
                  className={cn(
                    "flex-1 rounded-xl border py-2 text-xs font-semibold",
                    myPick === a.id
                      ? "border-court bg-court-soft text-fg"
                      : "border-border text-fg-muted",
                  )}
                >
                  {a.name.split(" ")[0]}
                </button>
                <button
                  type="button"
                  onClick={() => onPredict(g.id, b.id)}
                  className={cn(
                    "flex-1 rounded-xl border py-2 text-xs font-semibold",
                    myPick === b.id
                      ? "border-court bg-court-soft text-fg"
                      : "border-border text-fg-muted",
                  )}
                >
                  {b.name.split(" ")[0]}
                </button>
              </div>
            )}
            <p className="mt-2 text-[11px] text-fg-subtle">
              {Object.keys(g.predictions).length} prediction
              {Object.keys(g.predictions).length === 1 ? "" : "s"} ·{" "}
              {g.comments.length} comment{g.comments.length === 1 ? "" : "s"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function QuickMatchForm({
  me,
  onCreate,
}: {
  me: Player;
  onCreate: (input: {
    courtId: string;
    courtName: string;
    lat: number;
    lon: number;
    preferredAt: string;
    notes?: string;
    filters: Match["filters"];
  }) => void;
}) {
  const courts = useMemo(() => namedAustinCourts(), []);
  const [courtId, setCourtId] = useState(
    () => courts.find((c) => c.id === "cat-battle-bend")?.id ?? courts[0]?.id ?? "",
  );
  const [whenMode, setWhenMode] = useState<"now" | "later">("now");
  const [when, setWhen] = useState(() => nextFridayLocal());
  const [hMinFt, setHMinFt] = useState(6);
  const [hMinIn, setHMinIn] = useState(0);
  const [hMaxFt, setHMaxFt] = useState(6);
  const [hMaxIn, setHMaxIn] = useState(9);
  const [ratingMin, setRatingMin] = useState(1500);
  const [ratingMax, setRatingMax] = useState(2000);
  const [sportsMin, setSportsMin] = useState(4);
  const [radius, setRadius] = useState(15);
  const [notes, setNotes] = useState("Best of 3 · make it take it · call your fouls");

  const court = courts.find((c) => c.id === courtId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!court) return;
    const preferredAt =
      whenMode === "now"
        ? new Date(Date.now() + 20 * 60e3).toISOString()
        : new Date(when).toISOString();
    onCreate({
      courtId: court.id,
      courtName: court.name,
      lat: court.lat,
      lon: court.lon,
      preferredAt,
      notes: notes.trim() || undefined,
      filters: {
        heightMinIn: hMinFt * 12 + hMinIn,
        heightMaxIn: hMaxFt * 12 + hMaxIn,
        ratingMin,
        ratingMax,
        sportsmanshipMin: sportsMin,
        radiusMiles: radius,
      },
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-bg-elevated p-4">
      <p className="text-sm text-fg-muted">
        Right now is the default. Broadcast goes to eligible players within your
        radius — first accept wins.
      </p>

      <div className="flex gap-1 rounded-full border border-border bg-bg-subtle p-1">
        <button
          type="button"
          onClick={() => setWhenMode("now")}
          className={cn(
            "flex-1 rounded-full py-2 text-xs font-semibold",
            whenMode === "now" ? "bg-accent text-accent-fg" : "text-fg-muted",
          )}
        >
          Right now
        </button>
        <button
          type="button"
          onClick={() => setWhenMode("later")}
          className={cn(
            "flex-1 rounded-full py-2 text-xs font-semibold",
            whenMode === "later" ? "bg-accent text-accent-fg" : "text-fg-muted",
          )}
        >
          Schedule
        </button>
      </div>

      <div>
        <label className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Preferred court
        </label>
        <select
          value={courtId}
          onChange={(e) => setCourtId(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-xl border border-border bg-bg-subtle px-3 text-sm text-fg"
        >
          {courts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {whenMode === "later" && (
        <div>
          <label className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
            When
          </label>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-border bg-bg-subtle px-3 text-sm text-fg"
            required
          />
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Height range
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <HeightPick label="Min" ft={hMinFt} inch={hMinIn} onFt={setHMinFt} onIn={setHMinIn} />
          <HeightPick label="Max" ft={hMaxFt} inch={hMaxIn} onFt={setHMaxFt} onIn={setHMaxIn} />
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="mb-1 text-[10px] font-medium text-fg-subtle uppercase">Rating min</p>
          <input
            type="number"
            value={ratingMin}
            step={50}
            onChange={(e) => setRatingMin(Number(e.target.value))}
            className="h-11 w-full rounded-xl border border-border bg-bg-subtle px-3 text-sm text-fg"
          />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium text-fg-subtle uppercase">Rating max</p>
          <input
            type="number"
            value={ratingMax}
            step={50}
            onChange={(e) => setRatingMax(Number(e.target.value))}
            className="h-11 w-full rounded-xl border border-border bg-bg-subtle px-3 text-sm text-fg"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Sportsmanship · {sportsMin.toFixed(1)}★+ · radius {radius} mi
        </label>
        <input
          type="range"
          min={3}
          max={5}
          step={0.1}
          value={sportsMin}
          onChange={(e) => setSportsMin(Number(e.target.value))}
          className="mt-2 w-full accent-[var(--color-court)]"
        />
        <input
          type="range"
          min={5}
          max={25}
          step={1}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="mt-2 w-full accent-[var(--color-court)]"
        />
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="w-full resize-none rounded-xl border border-border bg-bg-subtle px-3 py-2.5 text-sm text-fg"
      />

      <button
        type="submit"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-court text-sm font-semibold text-white"
      >
        <Zap className="size-4" strokeWidth={2} />
        Broadcast Quick Match
      </button>
    </form>
  );
}

function MatchSheet({
  match,
  meId,
  players,
  onClose,
  onEnterScore,
  onConfirm,
  onPredict,
  onComment,
}: {
  match: Match;
  meId: string;
  players: Player[];
  onClose: () => void;
  onEnterScore: (id: string, scores: { a: number; b: number }[]) => void;
  onConfirm: (id: string, dispute?: boolean) => void;
  onPredict: (id: string, winnerId: string) => void;
  onComment: (id: string, text: string) => void;
}) {
  const host = players.find((p) => p.id === match.hostId);
  const opp = match.opponentId
    ? players.find((p) => p.id === match.opponentId)
    : undefined;
  const isParty = match.hostId === meId || match.opponentId === meId;
  const [g1a, setG1a] = useState(11);
  const [g1b, setG1b] = useState(7);
  const [g2a, setG2a] = useState(11);
  const [g2b, setG2b] = useState(9);
  const [comment, setComment] = useState("");

  const line =
    host && opp
      ? handicapLine(
          meId === host.id ? host.rating : opp.rating,
          meId === host.id ? opp.rating : host.rating,
        )
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-bg/70 backdrop-blur-sm" onClick={onClose} />
      <div className="slide-up relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-bg-elevated p-5 shadow-soft sm:rounded-3xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full border border-border text-fg-muted"
        >
          <X className="size-4" />
        </button>

        <p className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          {match.status.replace("_", " ")} · {formatLocalWhen(match.scheduledAt ?? match.preferredAt)}
        </p>
        <h3 className="mt-1 font-display text-xl font-semibold text-fg">
          {host?.name ?? "?"} vs {opp?.name ?? "waiting…"}
        </h3>
        <p className="text-sm text-fg-muted">{match.courtName}</p>

        {host && opp && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <PlayerStatCard player={host} />
            <PlayerStatCard player={opp} />
          </div>
        )}

        {line && isParty && (
          <p className="mt-3 rounded-xl border border-border bg-bg-subtle px-3 py-2 text-sm text-fg-muted">
            {line.display}
          </p>
        )}

        {match.status === "scheduled" && host && opp && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-fg-subtle uppercase">Pick a winner</p>
            <div className="flex gap-2">
              {[host, opp].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPredict(match.id, p.id)}
                  className={cn(
                    "flex-1 rounded-xl border py-2.5 text-xs font-semibold",
                    match.predictions[meId] === p.id
                      ? "border-court bg-court-soft"
                      : "border-border text-fg-muted",
                  )}
                >
                  {p.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        {isParty && (match.status === "scheduled" || match.status === "matched") && (
          <div className="mt-4 space-y-2 rounded-xl border border-border bg-bg-subtle p-3">
            <p className="text-xs font-medium text-fg-subtle uppercase">
              Enter score (winner submits)
            </p>
            <p className="text-[11px] text-fg-muted">You = left column</p>
            <div className="grid grid-cols-2 gap-2">
              <ScorePair label="Game 1" a={g1a} b={g1b} setA={setG1a} setB={setG1b} />
              <ScorePair label="Game 2" a={g2a} b={g2b} setA={setG2a} setB={setG2b} />
            </div>
            <button
              type="button"
              onClick={() =>
                onEnterScore(match.id, [
                  { a: g1a, b: g1b },
                  { a: g2a, b: g2b },
                ])
              }
              className="h-10 w-full rounded-xl bg-accent text-sm font-semibold text-accent-fg"
            >
              Submit score
            </button>
          </div>
        )}

        {match.status === "played_pending" && isParty && match.scoreEnteredBy !== meId && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-fg">
              Opponent submitted:{" "}
              {match.scores?.map((g) => `${g.a}–${g.b}`).join(", ")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onConfirm(match.id, false)}
                className="h-10 flex-1 rounded-xl bg-accent text-sm font-semibold text-accent-fg"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => onConfirm(match.id, true)}
                className="h-10 flex-1 rounded-xl border border-border text-sm font-medium text-fg-muted"
              >
                Dispute
              </button>
            </div>
          </div>
        )}

        {match.status === "confirmed" && (
          <p className="mt-4 text-sm text-success">
            Confirmed. Ratings updated
            {match.ratingDeltaHost != null && host
              ? ` · ${host.name} ${match.ratingDeltaHost >= 0 ? "+" : ""}${match.ratingDeltaHost.toFixed(1)}`
              : ""}
          </p>
        )}

        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-fg-subtle uppercase">Comments</p>
          {match.comments.map((c) => (
            <div key={c.id} className="rounded-lg bg-bg-subtle px-3 py-2 text-sm">
              <span className="text-xs font-medium text-fg-subtle">{c.authorName}</span>
              <p className="text-fg-muted">{c.text}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comment…"
              className="h-10 flex-1 rounded-xl border border-border bg-bg-subtle px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                if (!comment.trim()) return;
                onComment(match.id, comment.trim());
                setComment("");
              }}
              className="h-10 rounded-xl bg-bg-soft px-3 text-sm font-medium"
            >
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerStatCard({ player }: { player: Player }) {
  return (
    <div className="rounded-xl border border-border bg-bg-subtle p-3">
      <div className="flex items-center gap-2">
        <PlayerAvatar player={player} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{player.name}</p>
          <p className="text-[11px] text-fg-muted">
            {displayRating(player.rating)} · {formatHeightInches(player.heightIn)} ·{" "}
            {player.weightLb} lb
          </p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-fg-subtle">
        {player.wins}W–{player.losses}L · streak {player.streak} · {player.experienceYears}y exp
      </p>
      <p className="text-[11px] text-fg-subtle">
        sports {player.sportsmanship.toFixed(1)}★ · show {player.reliability.toFixed(1)}★
      </p>
    </div>
  );
}

function ScorePair({
  label,
  a,
  b,
  setA,
  setB,
}: {
  label: string;
  a: number;
  b: number;
  setA: (n: number) => void;
  setB: (n: number) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] text-fg-subtle">{label}</p>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={a}
          onChange={(e) => setA(Number(e.target.value))}
          className="h-9 w-full rounded-lg border border-border bg-bg-elevated px-2 text-sm"
        />
        <span className="text-fg-subtle">–</span>
        <input
          type="number"
          value={b}
          onChange={(e) => setB(Number(e.target.value))}
          className="h-9 w-full rounded-lg border border-border bg-bg-elevated px-2 text-sm"
        />
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-bg-subtle px-2.5 py-0.5 text-[11px] font-medium text-fg-muted">
      {children}
    </span>
  );
}

function HeightPick({
  label,
  ft,
  inch,
  onFt,
  onIn,
}: {
  label: string;
  ft: number;
  inch: number;
  onFt: (n: number) => void;
  onIn: (n: number) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-subtle p-2">
      <p className="mb-1 text-[10px] font-medium text-fg-subtle uppercase">{label}</p>
      <div className="flex gap-1">
        <select
          value={ft}
          onChange={(e) => onFt(Number(e.target.value))}
          className="h-9 flex-1 rounded-lg border border-border bg-bg-elevated px-1 text-sm"
        >
          {[5, 6, 7].map((f) => (
            <option key={f} value={f}>
              {f}′
            </option>
          ))}
        </select>
        <select
          value={inch}
          onChange={(e) => onIn(Number(e.target.value))}
          className="h-9 flex-1 rounded-lg border border-border bg-bg-elevated px-1 text-sm"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i}>
              {i}″
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function PlayerSheet({
  player,
  isMe,
  onClose,
}: {
  player: Player;
  isMe: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-bg/70" onClick={onClose} />
      <div className="slide-up relative z-10 w-full max-w-lg rounded-t-3xl border border-border bg-bg-elevated p-5 sm:rounded-3xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full border border-border"
        >
          <X className="size-4" />
        </button>
        <div className="flex items-center gap-4">
          <PlayerAvatar player={player} size="lg" />
          <div>
            <h3 className="font-display text-xl font-semibold">
              {player.name}
              {isMe ? " (you)" : ""}
            </h3>
            <p className="text-sm text-fg-muted">@{player.handle}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            ["Rating", String(displayRating(player.rating))],
            ["Record", `${player.wins}–${player.losses}`],
            ["Height", formatHeightInches(player.heightIn)],
            ["Weight", `${player.weightLb}`],
            ["Sports", `${player.sportsmanship.toFixed(1)}★`],
            ["Show", `${player.reliability.toFixed(1)}★`],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-border bg-bg-subtle px-2 py-2 text-center">
              <p className="text-[10px] text-fg-subtle uppercase">{l}</p>
              <p className="text-sm font-semibold">{v}</p>
            </div>
          ))}
        </div>
        {player.bio && (
          <p className="mt-4 text-sm text-fg-muted">{player.bio}</p>
        )}
      </div>
    </div>
  );
}


function MessagesPanel({
  threads,
  players,
  meId,
  onOpenPlayer,
  onAccept,
  onSend,
}: {
  threads: import("@/lib/upset/types").DirectThread[];
  players: Player[];
  meId: string;
  onOpenPlayer: (id: string) => void;
  onAccept: (id: string) => void;
  onSend: (toId: string, text: string) => { ok: true } | { ok: false; reason: string };
}) {
  const [active, setActive] = useState<string | null>(threads[0]?.id ?? null);
  const [text, setText] = useState("");
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const th = threads.find((t) => t.id === active);

  if (threads.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-bg-elevated px-6 py-12 text-center text-sm text-fg-muted">
        No messages yet. Open a profile and hit Message — first contact goes to
        requests.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {threads.map((t) => {
          const other = t.participantIds.find((id) => id !== meId)!;
          const p = byId.get(other);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold",
                active === t.id
                  ? "border-court bg-court-soft text-fg"
                  : "border-border text-fg-muted",
              )}
            >
              {p ? p.name.split(" ")[0] : "Player"}
              {t.isRequest ? " · req" : ""}
            </button>
          );
        })}
      </div>
      {th && (
        <div className="rounded-2xl border border-border bg-bg-elevated p-4">
          {th.isRequest && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-bg-subtle px-3 py-2">
              <p className="text-xs text-fg-muted">Message request</p>
              <button
                type="button"
                onClick={() => onAccept(th.id)}
                className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-fg"
              >
                Accept
              </button>
            </div>
          )}
          <div className="mb-3 max-h-48 space-y-2 overflow-y-auto">
            {th.messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm",
                  m.authorId === meId
                    ? "ml-6 bg-court-soft text-fg"
                    : "mr-6 bg-bg-subtle text-fg-muted",
                )}
              >
                <button
                  type="button"
                  className="text-[11px] font-medium text-fg-subtle"
                  onClick={() => m.authorId && onOpenPlayer(m.authorId)}
                >
                  {m.authorName}
                </button>
                <p>{m.text}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message…"
              className="h-10 flex-1 rounded-xl border border-border bg-bg-subtle px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                const other = th.participantIds.find((id) => id !== meId)!;
                const r = onSend(other, text);
                if (r.ok) setText("");
              }}
              className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function nextFridayLocal() {
  const d = new Date();
  const day = d.getDay();
  const daysUntilFri = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilFri);
  d.setHours(19, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
```

## FILE: `src/components/compete/scene-shell.tsx`

```tsx
import { useMemo, useState } from "react";
import {
  MapPinned,
  Trophy,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import { CourtsFinder } from "@/components/courts-finder";
import { CourtDetail } from "@/components/court-detail";
import { CommunityMediaFeed } from "@/components/compete/community-media-feed";
import { LeaderboardPanel } from "@/components/compete/leaderboard-panel";
import { PlayHub } from "@/components/compete/play-hub";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { AdminWorkOrders } from "@/components/admin-work-orders";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { signOut, authEnabled } from "@/lib/auth/client";
import { isAdminEmail } from "@/lib/auth/admin";
import { Link } from "@tanstack/react-router";
import { PlayerProfile } from "@/components/compete/player-profile";
import type { Court, UserLocation } from "@/lib/courts/types";
import { displayRating } from "@/lib/rating/engine";
import { formatLocalWhen, useUpsetStore } from "@/lib/upset/store";
import type { Match, Player } from "@/lib/upset/types";
import { cn } from "@/lib/utils";

type SceneHome = "leaderboard" | "games" | "community" | "you" | "courts";

interface SceneShellProps {
  courts: Court[];
  location: UserLocation;
  courtsLoading?: boolean;
  courtsLocating?: boolean;
  courtsError?: string | null;
  courtsLocError?: string | null;
  radiusMi?: number;
  dataSource?: string;
  onRadiusChange?: (mi: number) => void;
  onRefreshCourts?: () => void;
  onNearMe?: () => void;
}

export function SceneShell({
  courts,
  location,
  courtsLoading = false,
  courtsLocating = false,
  courtsError = null,
  courtsLocError = null,
  radiusMi = 8,
  dataSource = "",
  onRadiusChange,
  onRefreshCourts,
  onNearMe,
}: SceneShellProps) {
  const store = useUpsetStore();
  const [home, setHome] = useState<SceneHome>("leaderboard");
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [matchDetail, setMatchDetail] = useState<Match | null>(null);
  const [raceMsg, setRaceMsg] = useState<string | null>(null);
  const [focusMatchId, setFocusMatchId] = useState<string | null>(null);

  const startQuickAtCourt = (court: Court) => {
    setSelectedCourt(court);
    setHome("games");
  };

  const title =
    home === "leaderboard"
      ? "Leaderboard"
      : home === "games"
        ? "Play"
        : home === "community"
          ? "Social"
          : home === "courts"
            ? "Courts"
            : "You";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {home !== "games" && home !== "leaderboard" && (
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            {home !== "courts" ? (
              <>
                <p className="text-[11px] font-semibold tracking-[0.14em] text-court uppercase">
                  Upset City
                </p>
                <h2 className="font-display text-lg font-semibold tracking-tight text-fg">
                  {title}
                </h2>
              </>
            ) : (
              <h2 className="font-display text-lg font-semibold tracking-tight text-fg">
                Courts
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSelectedPlayer(store.me)}
            className={cn(
              "flex items-center gap-2 rounded-full border border-border bg-bg-elevated py-1 pr-3 pl-1",
              home === "courts" && "hidden",
            )}
            aria-label="Your profile"
          >
            <PlayerAvatar player={store.me} size="sm" />
            <span className="text-sm font-semibold tabular-nums text-fg">
              {displayRating(store.me.rating)}
            </span>
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 pb-20">
        {home === "leaderboard" && (
          <LeaderboardPanel
            players={store.players}
            meId={store.me.id}
            onOpenPlayer={setSelectedPlayer}
            onOpenProfile={() => setSelectedPlayer(store.me)}
          />
        )}

        {home === "games" && (
          <PlayHub
            me={store.me}
            players={store.players}
            courts={courts}
            matches={store.matches}
            userLat={location.lat}
            userLon={location.lon}
            onOpenProfile={() => setSelectedPlayer(store.me)}
            onCreateMatch={({
              court,
              preferredAt,
              format,
              notes,
              stakes,
            }) => {
              store.createQuickMatch({
                courtId: court.id,
                courtName: court.name,
                lat: court.lat,
                lon: court.lon,
                preferredAt,
                format: format ?? "1v1",
                notes,
                stakes,
                allowGuestInvites: false,
                filters: {
                  heightMinIn: 60,
                  heightMaxIn: 84,
                  ratingMin: 800,
                  ratingMax: 2500,
                  sportsmanshipMin: 3,
                  radiusMiles: 50,
                },
              });
              setRaceMsg("Your game is live on open games.");
            }}
            onAcceptMatch={(id) => {
              const r = store.tryAcceptRace(id);
              if (r === "filled") setRaceMsg("That game just filled.");
              else setRaceMsg("Game accepted.");
              return r;
            }}
            onOpenPlayer={setSelectedPlayer}
            focusMatchId={focusMatchId}
            onFocusMatchConsumed={() => setFocusMatchId(null)}
          />
        )}

        {home === "community" && (
          <CommunitySection
            store={store}
            onOpenPlayer={setSelectedPlayer}
            onViewMatch={(id) => {
              setFocusMatchId(id);
              setHome("games");
            }}
          />
        )}

        {home === "you" && (
          <YouSection
            me={store.me}
            onOpenProfile={() => setSelectedPlayer(store.me)}
          />
        )}

        {home === "courts" && (
          <CourtsFinder
            courts={courts}
            location={location}
            loading={courtsLoading}
            locating={courtsLocating}
            error={courtsError}
            locError={courtsLocError}
            radiusMi={radiusMi}
            dataSource={dataSource}
            onRadiusChange={(mi) => onRadiusChange?.(mi)}
            onRefresh={() => onRefreshCourts?.()}
            onNearMe={() => onNearMe?.()}
            onQuickMatch={startQuickAtCourt}
          />
        )}

        {raceMsg && (
          <p className="mt-3 text-center text-xs text-fg-muted" role="status">
            {raceMsg}
          </p>
        )}
      </div>

      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-2.5 safe-pb">
        <div className="pointer-events-auto relative mb-1.5 flex w-full max-w-lg items-end rounded-2xl border border-border-strong bg-bg-elevated/95 px-0.5 py-0.5 shadow-soft backdrop-blur-md">
          {(
            [
              { id: "leaderboard" as const, label: "Board", icon: Trophy },
              { id: "games" as const, label: "Play", icon: Zap },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setHome(t.id)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0 rounded-xl py-1.5 text-[9px] font-semibold leading-tight",
                home === t.id ? "bg-bg-soft text-fg" : "text-fg-muted",
              )}
            >
              <t.icon className="size-3.5" strokeWidth={1.75} />
              {t.label}
            </button>
          ))}

          <div className="relative flex w-14 shrink-0 flex-col items-center justify-end">
            <button
              type="button"
              onClick={() => setHome("courts")}
              className="flex -translate-y-1.5 flex-col items-center gap-0 transition-transform active:scale-95"
              aria-label="Nearby courts"
              aria-pressed={home === "courts"}
            >
              <span
                className={cn(
                  "flex size-11 items-center justify-center rounded-full border-[3px] border-bg shadow-soft",
                  home === "courts"
                    ? "bg-court text-white"
                    : "bg-court/90 text-white hover:bg-court",
                )}
              >
                <MapPinned className="size-4" strokeWidth={2} />
              </span>
              <span
                className={cn(
                  "text-[9px] font-semibold leading-tight",
                  home === "courts" ? "text-court" : "text-fg-muted",
                )}
              >
                Courts
              </span>
            </button>
          </div>

          {(
            [
              { id: "community" as const, label: "Social", icon: Users },
              { id: "you" as const, label: "You", icon: User },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setHome(t.id)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0 rounded-xl py-1.5 text-[9px] font-semibold leading-tight",
                home === t.id ? "bg-bg-soft text-fg" : "text-fg-muted",
              )}
            >
              <t.icon className="size-3.5" strokeWidth={1.75} />
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {selectedPlayer && (
        <PlayerProfile
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}

      {selectedCourt && home !== "courts" && (
        <CourtDetail
          court={selectedCourt}
          onClose={() => setSelectedCourt(null)}
          onQuickMatch={() => {
            setSelectedCourt(null);
            setHome("games");
          }}
        />
      )}

      {matchDetail && (
        <MatchSheet
          match={
            store.matches.find((m) => m.id === matchDetail.id) ?? matchDetail
          }
          meId={store.me.id}
          players={store.players}
          onClose={() => setMatchDetail(null)}
          onOpenPlayer={(id) => {
            const p = store.playerById(id);
            if (p) setSelectedPlayer(p);
          }}
        />
      )}
    </div>
  );
}

function CommunitySection({
  store,
  onOpenPlayer,
  onViewMatch,
}: {
  store: ReturnType<typeof useUpsetStore>;
  onOpenPlayer: (p: Player) => void;
  onViewMatch?: (matchId: string) => void;
}) {
  const [sub, setSub] = useState<"media" | "more">("media");

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-full border border-border bg-bg-elevated p-1">
        <button
          type="button"
          onClick={() => setSub("media")}
          className={cn(
            "flex-1 rounded-full py-2 text-xs font-semibold",
            sub === "media" ? "bg-accent text-accent-fg" : "text-fg-muted",
          )}
        >
          Media
        </button>
        <button
          type="button"
          onClick={() => setSub("more")}
          className={cn(
            "flex-1 rounded-full py-2 text-xs font-semibold",
            sub === "more" ? "bg-accent text-accent-fg" : "text-fg-muted",
          )}
        >
          More
        </button>
      </div>

      {sub === "media" ? (
        <CommunityMediaFeed
          me={store.me}
          players={store.players}
          matches={store.matches}
          onOpenPlayer={onOpenPlayer}
          onViewMatch={onViewMatch}
        />
      ) : (
        <div className="rounded-2xl border border-border bg-bg-elevated px-4 py-12 text-center">
          <p className="font-display text-base font-semibold text-fg">
            More coming soon
          </p>
          <p className="mt-1.5 text-sm text-fg-muted">
            This second tab is reserved — decide what belongs here and we’ll
            build it next.
          </p>
          <button
            type="button"
            onClick={() => setSub("media")}
            className="mt-4 text-sm font-semibold text-court"
          >
            Back to Media
          </button>
        </div>
      )}
    </div>
  );
}

function YouSection({
  me,
  onOpenProfile,
}: {
  me: Player;
  onOpenProfile: () => void;
}) {
  const { user, isPending } = useCurrentUserState();
  const admin = isAdminEmail(user?.primaryEmail);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onOpenProfile}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-bg-elevated p-4 text-left"
      >
        <PlayerAvatar player={me} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-fg">{me.name}</p>
          <p className="text-sm text-fg-muted">
            {displayRating(me.rating)} · {me.wins}W–{me.losses}L
          </p>
        </div>
      </button>

      {/* Account */}
      <section className="rounded-2xl border border-border bg-bg-elevated p-3.5">
        <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
          Account
        </p>
        {isPending ? (
          <p className="mt-2 text-xs text-fg-muted">Checking session…</p>
        ) : user ? (
          <div className="mt-2 space-y-2">
            <p className="text-sm font-semibold text-fg">
              {user.displayName ?? "Signed in"}
            </p>
            <p className="text-xs text-fg-muted">{user.primaryEmail}</p>
            {admin ? (
              <p className="text-[11px] font-semibold text-court">
                Admin access · work orders & court editor
              </p>
            ) : null}
            {authEnabled ? (
              <button
                type="button"
                onClick={() => void signOut("/")}
                className="mt-1 text-xs font-semibold text-fg-muted underline-offset-2 hover:underline"
              >
                Sign out
              </button>
            ) : null}
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-fg-muted">
              Sign in to save favorites and manage your account.
            </p>
            <Link
              to="/login"
              className="inline-flex h-10 items-center justify-center rounded-full bg-court px-4 text-xs font-semibold text-white"
            >
              Sign in / Create account
            </Link>
          </div>
        )}
      </section>

      {/* Admin inbox — only for seanvoss23@gmail.com */}
      <AdminWorkOrders email={user?.primaryEmail} />
    </div>
  );
}

function MatchSheet({
  match,
  meId,
  players,
  onClose,
  onOpenPlayer,
}: {
  match: Match;
  meId: string;
  players: Player[];
  onClose: () => void;
  onOpenPlayer: (id: string) => void;
}) {
  void meId;
  const host = players.find((p) => p.id === match.hostId);
  const opp = match.opponentId
    ? players.find((p) => p.id === match.opponentId)
    : null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Dismiss"
      />
      <div className="slide-up relative z-10 max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-bg-elevated p-5 shadow-soft sm:rounded-3xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-court uppercase">
              Match
            </p>
            <p className="font-display text-lg font-semibold text-fg">
              {match.courtName}
            </p>
            <p className="text-xs text-fg-muted">
              {formatLocalWhen(match.scheduledAt ?? match.preferredAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full border border-border text-fg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          {host ? (
            <button type="button" onClick={() => onOpenPlayer(host.id)}>
              <PlayerAvatar player={host} size="md" />
            </button>
          ) : null}
          <span className="text-xs font-bold text-court">VS</span>
          {opp ? (
            <button type="button" onClick={() => onOpenPlayer(opp.id)}>
              <PlayerAvatar player={opp} size="md" />
            </button>
          ) : (
            <span className="text-sm text-fg-muted">Open</span>
          )}
        </div>
      </div>
    </div>
  );
}
```

## FILE: `src/components/compete/squads-hub.tsx`

```tsx
import { useMemo, useState } from "react";
import {
  ChevronLeft,
  MapPin,
  Plus,
  Swords,
  Users,
  X,
} from "lucide-react";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { namedAustinCourts } from "@/lib/courts/catalog";
import {
  useSquads,
  type Squad,
  type SquadSize,
} from "@/lib/upset/squads";
import type { Player } from "@/lib/upset/types";
import { displayRating } from "@/lib/rating/engine";
import { cn, formatHeightInches } from "@/lib/utils";

const LOGOS = ["🏀", "🔥", "⚡", "👑", "🐺", "🦅", "💪", "🌟", "🎯", "🖤", "🧡", "🟢"];

interface SquadsHubProps {
  me: Player;
  players: Player[];
}

export function SquadsHub({ me, players }: SquadsHubProps) {
  const store = useSquads();
  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players],
  );
  const mySquad =
    store.squads.find((s) => s.id === store.mySquadId) ??
    store.squads.find((s) => s.captainId === me.id) ??
    store.squads.find((s) =>
      s.members.some((m) => m.playerId === me.id && m.status === "active"),
    );

  const [creating, setCreating] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [challengeTarget, setChallengeTarget] = useState<Squad | null>(null);

  if (creating) {
    return (
      <CreateSquad
        me={me}
        onCancel={() => setCreating(false)}
        onCreated={() => setCreating(false)}
      />
    );
  }

  if (!mySquad) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-court uppercase">
            Squads
          </p>
          <h3 className="font-display text-lg font-semibold text-fg">
            Build your team
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-fg-muted">
            Create a 3- or 5-player squad, pick a logo and home court, then
            challenge other Austin crews.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-court text-sm font-semibold text-white"
        >
          <Plus className="size-4" strokeWidth={2} />
          Create a squad
        </button>

        <OtherSquadsPreview squads={store.squads.slice(0, 3)} />
      </div>
    );
  }

  const activeMembers = mySquad.members.filter((m) => m.status === "active");
  const invited = mySquad.members.filter((m) => m.status === "invited");
  const spotsLeft = mySquad.size - activeMembers.length - invited.length;
  const others = store.squads.filter((s) => s.id !== mySquad.id);

  const myChallenges = store.challenges.filter(
    (c) => c.fromSquadId === mySquad.id || c.toSquadId === mySquad.id,
  );

  return (
    <div className="space-y-4">
      {/* Squad header card */}
      <div className="rounded-2xl border border-border bg-bg-elevated p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-bg-subtle text-3xl">
            {mySquad.logo}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-semibold text-fg">
              {mySquad.name}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-fg-muted">
              <MapPin className="size-3" strokeWidth={1.75} />
              {mySquad.homeCourtName}
            </p>
            <p className="mt-1 text-xs text-fg-subtle">
              {mySquad.size}-man · {mySquad.record.wins}W–{mySquad.record.losses}L
              · captain
            </p>
          </div>
        </div>
      </div>

      {/* Roster */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
            Roster · {activeMembers.length}/{mySquad.size}
          </p>
          {spotsLeft > 0 && (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="text-xs font-semibold text-court"
            >
              + Invite
            </button>
          )}
        </div>
        <div className="space-y-2">
          {activeMembers.map((m) => {
            const p = playerMap.get(m.playerId);
            if (!p) return null;
            return (
              <div
                key={m.playerId}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-3 py-2.5",
                  m.playerId === me.id
                    ? "border-court/40 bg-court-soft"
                    : "border-border bg-bg-elevated",
                )}
              >
                <PlayerAvatar player={p} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">
                    {p.name}
                    {m.role === "captain" ? " · C" : ""}
                    {m.playerId === me.id ? " · you" : ""}
                  </p>
                  <p className="text-[11px] text-fg-muted">
                    {displayRating(p.rating)} · {formatHeightInches(p.heightIn)}
                  </p>
                </div>
              </div>
            );
          })}
          {invited.map((m) => {
            const p = playerMap.get(m.playerId);
            if (!p) return null;
            return (
              <div
                key={m.playerId}
                className="flex items-center gap-2.5 rounded-xl border border-dashed border-border-strong px-3 py-2.5"
              >
                <PlayerAvatar player={p} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">{p.name}</p>
                  <p className="text-[11px] text-fg-muted">Invite pending</p>
                </div>
              </div>
            );
          })}
          {Array.from({ length: Math.max(0, spotsLeft) }).map((_, i) => (
            <button
              key={`open-${i}`}
              type="button"
              onClick={() => setInviteOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-border-strong px-3 py-2.5 text-left"
            >
              <div className="flex size-9 items-center justify-center rounded-full border border-dashed border-border-strong text-fg-subtle">
                <Users className="size-4" strokeWidth={1.5} />
              </div>
              <span className="text-sm text-fg-muted">Open roster spot</span>
            </button>
          ))}
        </div>
      </div>

      {/* Challenges out/in */}
      {myChallenges.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
            Challenges
          </p>
          {myChallenges.slice(0, 5).map((c) => {
            const from = store.squads.find((s) => s.id === c.fromSquadId);
            const to = store.squads.find((s) => s.id === c.toSquadId);
            const isIncoming = c.toSquadId === mySquad.id;
            const other = isIncoming ? from : to;
            if (!other) return null;
            return (
              <div
                key={c.id}
                className="rounded-xl border border-border bg-bg-elevated px-3 py-2.5"
              >
                <p className="text-sm font-semibold text-fg">
                  {other.logo} {other.name}
                </p>
                <p className="text-[11px] text-fg-muted">
                  {isIncoming ? "Challenged you" : "You challenged them"} ·{" "}
                  {c.status}
                  {c.courtName ? ` · ${c.courtName}` : ""}
                </p>
                {isIncoming && c.status === "pending" && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => store.respondChallenge(c.id, "declined")}
                      className="h-9 rounded-xl border border-border text-xs font-semibold text-fg-muted"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => store.respondChallenge(c.id, "accepted")}
                      className="h-9 rounded-xl bg-court text-xs font-semibold text-white"
                    >
                      Accept
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Challenge other squads */}
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Challenge a squad
        </p>
        {others.map((sq) => (
          <div
            key={sq.id}
            className="flex items-center gap-3 rounded-2xl border border-border bg-bg-elevated p-3"
          >
            <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-bg-subtle text-2xl">
              {sq.logo}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">{sq.name}</p>
              <p className="text-[11px] text-fg-muted">
                {sq.size}-man · {sq.record.wins}W–{sq.record.losses}L ·{" "}
                {sq.homeCourtName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setChallengeTarget(sq)}
              className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-fg"
            >
              Challenge
            </button>
          </div>
        ))}
      </div>

      {inviteOpen && (
        <InviteRosterSheet
          squad={mySquad}
          me={me}
          players={players}
          onInvite={(id) => {
            store.inviteMember(mySquad.id, id);
          }}
          onClose={() => setInviteOpen(false)}
        />
      )}

      {challengeTarget && (
        <ChallengeModal
          mine={mySquad}
          target={challengeTarget}
          onConfirm={() => {
            store.challengeSquad(
              mySquad.id,
              challengeTarget.id,
              mySquad.homeCourtName,
            );
            setChallengeTarget(null);
          }}
          onClose={() => setChallengeTarget(null)}
        />
      )}
    </div>
  );
}

function CreateSquad({
  me,
  onCancel,
  onCreated,
}: {
  me: Player;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const createSquad = useSquads((s) => s.createSquad);
  const courts = useMemo(() => namedAustinCourts(), []);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState(LOGOS[0]);
  const [size, setSize] = useState<SquadSize>(5);
  const [courtId, setCourtId] = useState(courts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const court = courts.find((c) => c.id === courtId) ?? courts[0];

  const submit = () => {
    const n = name.trim();
    if (n.length < 2) {
      setError("Give your squad a name.");
      return;
    }
    if (!court) {
      setError("Pick a home court.");
      return;
    }
    createSquad({
      name: n,
      logo,
      size,
      homeCourtId: court.id,
      homeCourtName: court.name,
      captainId: me.id,
    });
    onCreated();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex size-9 items-center justify-center rounded-full border border-border bg-bg-elevated text-fg-muted"
          aria-label="Back"
        >
          <ChevronLeft className="size-4" strokeWidth={2} />
        </button>
        <h3 className="font-display text-lg font-semibold text-fg">
          Create squad
        </h3>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Team name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Southside 5"
          maxLength={24}
          className="h-12 w-full rounded-2xl border border-border bg-bg-elevated px-4 text-sm text-fg outline-none focus:border-border-strong"
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Logo
        </p>
        <div className="flex flex-wrap gap-2">
          {LOGOS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLogo(l)}
              className={cn(
                "flex size-11 items-center justify-center rounded-xl border text-xl",
                logo === l
                  ? "border-court bg-court-soft ring-2 ring-court/30"
                  : "border-border bg-bg-elevated",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Squad size
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { n: 3 as SquadSize, label: "3 players", blurb: "3v3 crew" },
              { n: 5 as SquadSize, label: "5 players", blurb: "Full team" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.n}
              type="button"
              onClick={() => setSize(opt.n)}
              className={cn(
                "rounded-2xl border p-3 text-left",
                size === opt.n
                  ? "border-court bg-court-soft"
                  : "border-border bg-bg-elevated",
              )}
            >
              <p className="text-sm font-semibold text-fg">{opt.label}</p>
              <p className="text-[11px] text-fg-muted">{opt.blurb}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Home court
        </p>
        <div className="max-h-40 space-y-1.5 overflow-y-auto">
          {courts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCourtId(c.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm",
                courtId === c.id
                  ? "border-court bg-court-soft font-semibold text-fg"
                  : "border-border bg-bg-elevated text-fg-muted",
              )}
            >
              <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-border bg-bg-subtle p-3">
        <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-bg-elevated text-2xl">
          {logo}
        </div>
        <div>
          <p className="text-sm font-semibold text-fg">
            {name.trim() || "Your squad"}
          </p>
          <p className="text-xs text-fg-muted">
            {size}-man · {court?.name ?? "Home court"} · you captain
          </p>
        </div>
      </div>

      {error && (
        <p className="text-center text-xs text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-court text-sm font-semibold text-white"
      >
        Create squad
      </button>
    </div>
  );
}

function InviteRosterSheet({
  squad,
  me,
  players,
  onInvite,
  onClose,
}: {
  squad: Squad;
  me: Player;
  players: Player[];
  onInvite: (id: string) => void;
  onClose: () => void;
}) {
  const taken = new Set(squad.members.map((m) => m.playerId));
  const candidates = players
    .filter((p) => p.id !== me.id && !taken.has(p.id) && p.city === "Austin")
    .sort((a, b) => b.rating - a.rating);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[80dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-bg-elevated shadow-soft sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display text-base font-semibold text-fg">
            Fill roster
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full border border-border text-fg-muted"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {candidates.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-bg-subtle px-3 py-2.5"
            >
              <PlayerAvatar player={p} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-fg">{p.name}</p>
                <p className="text-[11px] text-fg-muted">
                  {displayRating(p.rating)} · {formatHeightInches(p.heightIn)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onInvite(p.id)}
                className="rounded-full bg-court px-3 py-1.5 text-[11px] font-semibold text-white"
              >
                Invite
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChallengeModal({
  mine,
  target,
  onConfirm,
  onClose,
}: {
  mine: Squad;
  target: Squad;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-t-3xl border border-border bg-bg-elevated p-5 shadow-soft sm:rounded-3xl">
        <p className="text-[11px] font-semibold tracking-wide text-court uppercase">
          Challenge
        </p>
        <h3 className="mt-1 font-display text-lg font-semibold text-fg">
          {mine.logo} {mine.name}{" "}
          <span className="text-fg-muted">vs</span> {target.logo} {target.name}
        </h3>
        <p className="mt-2 text-sm text-fg-muted">
          {mine.size}-man vs {target.size}-man · proposed at your home court (
          {mine.homeCourtName}). They’ll accept or decline.
        </p>
        {mine.size !== target.size && (
          <p className="mt-2 text-xs text-fg-subtle">
            Different roster sizes — agree on rules when you both show.
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-border text-sm font-semibold text-fg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-court text-sm font-semibold text-white"
          >
            <Swords className="size-4" strokeWidth={2} />
            Send challenge
          </button>
        </div>
      </div>
    </div>
  );
}

function OtherSquadsPreview({ squads }: { squads: Squad[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
        Squads already running Austin
      </p>
      {squads.map((sq) => (
        <div
          key={sq.id}
          className="flex items-center gap-3 rounded-2xl border border-border bg-bg-elevated p-3 opacity-90"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-bg-subtle text-xl">
            {sq.logo}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg">{sq.name}</p>
            <p className="text-[11px] text-fg-muted">
              {sq.record.wins}W–{sq.record.losses}L · {sq.homeCourtName}
            </p>
          </div>
        </div>
      ))}
      <p className="text-center text-[11px] text-fg-subtle">
        Create yours to challenge them
      </p>
    </div>
  );
}
```

## FILE: `src/components/compete/stake-settle-card.tsx`

```tsx
import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Check,
  Copy,
  ExternalLink,
  Heart,
  Shield,
  Smartphone,
} from "lucide-react";
import type { Match, Player } from "@/lib/upset/types";
import {
  ALZHEIMERS_CHARITY,
  formatMoney,
  settleTargets,
  stakesChipLabel,
  stakesChipParts,
  stakesExplain,
  type SettleMethodId,
} from "@/lib/upset/stakes";
import { cn } from "@/lib/utils";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

const METHODS: {
  id: SettleMethodId;
  label: string;
  sub: string;
  icon: "cashapp" | "venmo" | "zelle" | "cash" | "charity";
}[] = [
  { id: "cashapp", label: "Cash App", sub: "Fast · private", icon: "cashapp" },
  { id: "venmo", label: "Venmo", sub: "Set to Private", icon: "venmo" },
  { id: "zelle", label: "Zelle", sub: "Bank-to-bank", icon: "zelle" },
  { id: "cash", label: "Cash", sub: "At the court", icon: "cash" },
];

/**
 * Premium settle experience — peer apps / cash / charity.
 * Upset City never holds money.
 */
export function StakeSettleCard({
  match,
  me,
  host,
  opp,
  onMarkSettled,
  onRequestExtension,
  onReportUnpaid,
  compact,
}: {
  match: Match;
  me: Player;
  host?: Player | null;
  opp?: Player | null;
  onMarkSettled: (method: SettleMethodId | "other") => void;
  onRequestExtension?: (note: string) => { ok: boolean; reason?: string };
  onReportUnpaid?: () => { ok: boolean; reason?: string };
  compact?: boolean;
}) {
  const stakes = match.stakes;
  const [method, setMethod] = useState<SettleMethodId | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [extOpen, setExtOpen] = useState(false);
  const [extNote, setExtNote] = useState("");
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (!stakes || stakes.mode === "fun") return;
    if (stakes.mode === "charity") setMethod("charity");
    else setMethod("cashapp");
  }, [stakes?.mode, match.id]);

  if (!stakes || stakes.mode === "fun") {
    if (compact) return null;
    return (
      <p className="text-[11px] text-fg-muted">Just for fun · rating only</p>
    );
  }

  const amount =
    stakes.mode === "stakes"
      ? (stakes.amountDollars ?? stakes.fixedPriceDollars)
      : stakes.amountDollars;
  /** Stakes: price is known up front. Charity: amount after scores. */
  const hasPayout =
    amount != null &&
    amount > 0 &&
    (stakes.mode === "stakes" || stakes.loserId != null);
  const scoreLocked = stakes.loserId != null;
  const payeeId = stakes.mode === "charity" ? null : stakes.winnerId;
  const payee =
    payeeId === host?.id ? host : payeeId === opp?.id ? opp : null;
  const iOwe =
    scoreLocked && hasPayout && stakes.loserId === me.id && !stakes.settled;
  const iWon =
    scoreLocked &&
    hasPayout &&
    stakes.winnerId === me.id &&
    stakes.mode === "stakes";
  const isParty =
    me.id === match.hostId || me.id === match.opponentId;

  const note = `Upset City · ${match.courtName}`;
  const targets = useMemo(() => {
    if (!method || amount == null) return null;
    return settleTargets(method, amount, payee, stakes, note);
  }, [method, amount, payee, stakes, note]);

  const doCopy = async (value: string, key: string) => {
    const ok = await copyText(value);
    if (ok) {
      setCopied(key);
      setFlash("Copied");
      window.setTimeout(() => {
        setCopied(null);
        setFlash(null);
      }, 1400);
    } else {
      setFlash("Couldn’t copy — long-press instead");
      window.setTimeout(() => setFlash(null), 2000);
    }
  };

  const methods =
    stakes.mode === "charity"
      ? ([
          {
            id: "charity" as const,
            label: "Donate",
            sub: ALZHEIMERS_CHARITY.short,
            icon: "charity" as const,
          },
        ] as const)
      : METHODS;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border",
        stakes.mode === "charity"
          ? "border-violet-500/25 bg-gradient-to-b from-violet-500/10 to-bg-elevated"
          : "border-amber-500/25 bg-gradient-to-b from-amber-500/10 to-bg-elevated",
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-3.5 pt-3.5 pb-2">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm",
            stakes.mode === "charity" ? "bg-violet-600" : "bg-amber-600",
          )}
        >
          {stakes.mode === "charity" ? (
            <Heart className="size-4" strokeWidth={2} />
          ) : (
            <Banknote className="size-4" strokeWidth={2} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-[0.12em] text-fg-subtle uppercase">
            {stakes.mode === "charity" ? "Charity game" : "Stakes game"}
          </p>
          <p className="text-sm font-semibold text-fg">
            {(() => {
              const parts = stakesChipParts(stakes);
              if (!parts) return null;
              return (
                <>
                  {parts.kind}
                  {parts.money ? (
                    <>
                      {" · "}
                      <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {parts.money}
                      </span>
                    </>
                  ) : null}
                </>
              );
            })()}
          </p>
          {!hasPayout ? (
            <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">
              {stakesExplain(stakes)}
            </p>
          ) : null}
        </div>
      </div>

      {/* Amount hero — stakes show named price immediately; charity after scores */}
      {hasPayout ? (
        <div className="mx-3.5 mb-3 rounded-2xl border border-border/80 bg-bg px-4 py-4 text-center shadow-sm">
          <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
            {stakes.settled
              ? "Settled"
              : stakes.mode === "charity"
                ? "Donation due"
                : !scoreLocked
                  ? "On the line"
                  : iOwe
                    ? "You owe"
                    : iWon
                      ? "You’re owed"
                      : "Amount"}
          </p>
          <p className="mt-1 font-display text-[2.75rem] leading-none font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums drop-shadow-sm">
            {formatMoney(amount!)}
          </p>
          <p className="mt-2 text-[11px] font-medium text-fg-muted">
            {stakes.mode === "stakes"
              ? scoreLocked
                ? payee
                  ? `Named price · to ${payee.name}`
                  : "Named price"
                : "Named price · winner takes it"
              : `${stakes.totalMarginPoints} pt series margin${
                  stakes.dollarsPerPoint !== 1
                    ? ` · ${formatMoney(stakes.dollarsPerPoint)}/pt`
                    : ""
                }`}
          </p>
          {stakes.settled || stakes.paymentStatus === "settled" ? (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-semibold text-success">
              <Check className="size-3.5" strokeWidth={2.5} />
              Marked complete
              {stakes.settleMethod ? ` · ${stakes.settleMethod}` : ""}
            </p>
          ) : stakes.paymentStatus === "exiled" ? (
            <p className="mt-2 text-[11px] font-bold text-danger">
              Non-payment · player permanently exiled from the league
            </p>
          ) : stakes.paymentStatus === "extension_requested" ? (
            <p className="mt-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              More time requested
              {stakes.payDeadlineAt
                ? ` · due ${new Date(stakes.payDeadlineAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                : ""}
            </p>
          ) : stakes.payDeadlineAt ? (
            <p className="mt-2 text-[11px] text-fg-muted">
              Settle by{" "}
              {new Date(stakes.payDeadlineAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Pre-game rules for charity only (stakes already show price) */}
      {!hasPayout ? (
        <div className="mx-3.5 mb-3 rounded-xl bg-bg/70 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <Shield className="mt-0.5 size-3.5 shrink-0 text-fg-muted" />
            <p className="text-[11px] leading-snug text-fg-muted">
              {stakes.mode === "charity"
                ? "After scores confirm, the loser donates the margin total to Alzheimer's research. That amount is added to Austin's $50k city goal. Upset City never holds money."
                : "After scores confirm, settle privately (Cash App, Venmo Private, Zelle, or cash). Upset City never holds money."}
            </p>
          </div>
        </div>
      ) : stakes.mode === "stakes" && !scoreLocked ? (
        <div className="mx-3.5 mb-3 rounded-xl bg-bg/70 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <Shield className="mt-0.5 size-3.5 shrink-0 text-fg-muted" />
            <p className="text-[11px] leading-snug text-fg-muted">
              Fixed stake. Loser pays winner{" "}
              <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatMoney(amount!)}
              </span>{" "}
              after scores
              confirm — Cash App, Venmo (Private), Zelle, or cash. Upset City
              never holds money.
            </p>
          </div>
        </div>
      ) : null}

      {/* Settle actions — only after score lock */}
      {hasPayout && scoreLocked && !stakes.settled && isParty ? (
        <div className="space-y-3 border-t border-border/60 px-3.5 py-3">
          {iOwe || stakes.mode === "charity" ? (
            <>
              <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
                {stakes.mode === "charity"
                  ? "Donate privately"
                  : "Settle privately"}
              </p>
              <div
                className={cn(
                  "grid gap-1.5",
                  methods.length === 1 ? "grid-cols-1" : "grid-cols-2",
                )}
              >
                {methods.map((m) => {
                  const on = method === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id)}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left transition-colors",
                        on
                          ? "border-fg bg-fg text-bg"
                          : "border-border bg-bg text-fg hover:border-border-strong",
                      )}
                    >
                      <p className="text-xs font-semibold">{m.label}</p>
                      <p
                        className={cn(
                          "text-[10px]",
                          on ? "text-bg/70" : "text-fg-muted",
                        )}
                      >
                        {m.sub}
                      </p>
                    </button>
                  );
                })}
              </div>

              {method && targets ? (
                <div className="space-y-2 rounded-xl border border-border bg-bg p-3">
                  <p className="text-[11px] leading-snug text-fg-muted">
                    {targets.hint}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void doCopy(moneyOrHandle(targets.copyPrimary), "p")
                      }
                      className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-elevated px-3 text-xs font-semibold text-fg"
                    >
                      {copied === "p" ? (
                        <Check className="size-3.5 text-success" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      {targets.copyLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void doCopy(moneyAmountString(amount!), "a")
                      }
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-elevated px-3 text-xs font-semibold text-fg"
                    >
                      {copied === "a" ? (
                        <Check className="size-3.5 text-success" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatMoney(amount!)}
                      </span>
                    </button>
                  </div>
                  {targets.openUrl ? (
                    <a
                      href={targets.openUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-fg text-sm font-semibold text-bg active:scale-[0.99]"
                    >
                      {stakes.mode === "charity" ? (
                        <Heart className="size-4" />
                      ) : (
                        <Smartphone className="size-4" />
                      )}
                      {stakes.mode === "charity"
                        ? "Open donate page"
                        : method === "cashapp"
                          ? "Open Cash App"
                          : method === "venmo"
                            ? "Open Venmo"
                            : "Open"}
                      <ExternalLink className="size-3.5 opacity-70" />
                    </a>
                  ) : null}
                  {(iOwe || (stakes.mode === "charity" && stakes.loserId === me.id)) && (
                    <button
                      type="button"
                      onClick={() => onMarkSettled(method)}
                      className={cn(
                        "flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white active:scale-[0.99]",
                        stakes.mode === "charity"
                          ? "bg-violet-600"
                          : "bg-court",
                      )}
                    >
                      <Check className="size-4" strokeWidth={2.5} />
                      {stakes.mode === "charity"
                        ? "I donated — mark complete"
                        : "I paid — mark settled"}
                    </button>
                  )}
                  {iOwe && onRequestExtension ? (
                    <button
                      type="button"
                      onClick={() => setExtOpen((v) => !v)}
                      className="w-full py-1.5 text-center text-[11px] font-semibold text-fg-muted underline-offset-2 hover:underline"
                    >
                      Need more time? Tell us what’s going on
                    </button>
                  ) : null}
                  {extOpen && iOwe ? (
                    <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                      <p className="text-[11px] leading-snug text-fg-muted">
                        Communicate and we can work with you. Silence after a
                        confirmed game can lead to permanent exile.
                      </p>
                      <textarea
                        value={extNote}
                        onChange={(e) => setExtNote(e.target.value)}
                        rows={3}
                        placeholder="What’s going on? When can you settle?"
                        className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-fg outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const r = onRequestExtension?.(extNote);
                          if (r && !r.ok) {
                            setFlash(r.reason ?? "Couldn’t send");
                            return;
                          }
                          setExtOpen(false);
                          setExtNote("");
                          setFlash("Extension posted — community & winner notified");
                          window.setTimeout(() => setFlash(null), 2200);
                        }}
                        className="flex h-10 w-full items-center justify-center rounded-xl bg-fg text-xs font-semibold text-bg"
                      >
                        Request more time
                      </button>
                    </div>
                  ) : null}
                  {flash ? (
                    <p className="text-center text-[11px] font-medium text-success">
                      {flash}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
                    ) : iWon ? (
            <div className="space-y-2 rounded-xl border border-border bg-bg px-3 py-3">
              <p className="text-xs font-semibold text-fg">Waiting on them</p>
              <p className="mt-1 text-[11px] leading-snug text-fg-muted">
                They’ll settle{" "}
                <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatMoney(amount!)}
                </span>{" "}
                privately
                {me.payCashApp || me.payVenmo || me.payZelle
                  ? " using your payment handles."
                  : ". Add Cash App / Venmo / Zelle on your profile so this is seamless next time."}
              </p>
              {stakes.paymentStatus === "extension_requested" && stakes.extensionNote ? (
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-2">
                  <p className="text-[10px] font-bold uppercase text-amber-800 dark:text-amber-200">
                    They asked for more time
                  </p>
                  <p className="mt-0.5 text-[11px] text-fg-muted">
                    “{stakes.extensionNote}”
                  </p>
                </div>
              ) : null}
              {(me.payCashApp || me.payVenmo || me.payZelle) && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {me.payCashApp ? (
                    <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-[10px] font-semibold text-fg">
                      ${me.payCashApp.replace(/^\$/, "")}
                    </span>
                  ) : null}
                  {me.payVenmo ? (
                    <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-[10px] font-semibold text-fg">
                      @{me.payVenmo.replace(/^@/, "")}
                    </span>
                  ) : null}
                  {me.payZelle ? (
                    <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-[10px] font-semibold text-fg">
                      Zelle · {me.payZelle}
                    </span>
                  ) : null}
                </div>
              )}
              <div className="border-t border-border pt-2">
                <p className="text-[10px] leading-snug text-fg-subtle">
                  No pay after a confirmed game = permanent exile from the
                  league. The community is notified. Only report if they truly
                  ghosted payment.
                </p>
                {!reportOpen ? (
                  <button
                    type="button"
                    onClick={() => setReportOpen(true)}
                    className="mt-2 w-full rounded-xl border border-danger/40 py-2.5 text-xs font-semibold text-danger"
                  >
                    They didn’t pay — report & exile
                  </button>
                ) : (
                  <div className="mt-2 space-y-2">
                    <p className="text-[11px] font-medium text-danger">
                      This permanently exiles them and posts to Media for the
                      whole league. Continue?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setReportOpen(false)}
                        className="flex-1 rounded-xl border border-border py-2 text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const r = onReportUnpaid?.();
                          if (r && !r.ok) {
                            setFlash(r.reason ?? "Failed");
                            return;
                          }
                          setReportOpen(false);
                          setFlash("Reported — they are exiled. Community notified.");
                        }}
                        className="flex-1 rounded-xl bg-danger py-2 text-xs font-semibold text-white"
                      >
                        Confirm exile
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
) : (
            <p className="text-[11px] text-fg-muted">
              Settlement is between the two players after scores lock.
            </p>
          )}
        </div>
      ) : null}

      <p className="px-3.5 pb-3 text-center text-[9px] text-fg-subtle">
        Private peer settle · Upset City never processes payments
      </p>
    </div>
  );
}

function moneyAmountString(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function moneyOrHandle(s: string) {
  return s;
}

/** Compact list label — green money only, no pill background */
export function StakeChip({ stakes }: { stakes?: Match["stakes"] }) {
  const parts = stakesChipParts(stakes);
  if (!parts) return null;
  const charity = stakes?.mode === "charity";
  return (
    <span className="inline-flex max-w-full items-baseline gap-1.5 text-[11px] font-semibold">
      <span className={charity ? "text-violet-700 dark:text-violet-300" : "text-fg-muted"}>
        {parts.kind}
      </span>
      {parts.money ? (
        <span
          className={cn(
            "tabular-nums tracking-tight",
            charity
              ? "text-[12px] font-bold text-violet-700 dark:text-violet-300"
              : "text-[13px] font-extrabold text-emerald-600 dark:text-emerald-400",
          )}
        >
          {parts.money}
        </span>
      ) : null}
    </span>
  );
}
```

## FILE: `src/components/compete/tournament-bracket.tsx`

```tsx
import { useMemo, useRef } from "react";
import { ChevronLeft, Crown, Radio } from "lucide-react";
import {
  buildBracket,
  roundLabel,
  type BracketMatch,
  type TournamentBracket,
} from "@/lib/upset/tournament-bracket";
import type { Player } from "@/lib/upset/types";
import type { GameMode } from "@/lib/upset/tournament-bracket";
import { cn } from "@/lib/utils";

interface TournamentBracketViewProps {
  tournamentId: string;
  name: string;
  mode: GameMode;
  size: number;
  progressRounds?: number;
  players: Player[];
  meId: string;
  onBack: () => void;
}

const MATCH_H = 72;
const MATCH_GAP = 12;
const COL_W = 168;
const COL_GAP = 28;

export function TournamentBracketView({
  tournamentId,
  name,
  mode,
  size,
  progressRounds,
  players,
  meId,
  onBack,
}: TournamentBracketViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const bracket = useMemo(
    () =>
      buildBracket({
        tournamentId,
        name,
        mode,
        size,
        players,
        meId,
        progressRounds,
      }),
    [tournamentId, name, mode, size, players, meId, progressRounds],
  );

  const totalRounds = bracket.rounds.length;
  // vertical spacing doubles each round so connectors meet
  const unit = MATCH_H + MATCH_GAP;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onBack}
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-bg-elevated text-fg-muted"
          aria-label="Back to tournaments"
        >
          <ChevronLeft className="size-4" strokeWidth={2} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-court uppercase">
            Bracket · {size}-player
          </p>
          <h3 className="font-display text-lg font-semibold tracking-tight text-fg">
            {name}
          </h3>
          {bracket.championName ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-gold">
              <Crown className="size-3.5" strokeWidth={2} />
              Champion · {bracket.championName}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-fg-muted">
              Single elimination · swipe to see later rounds
            </p>
          )}
        </div>
      </div>

      {/* Round chips — jump scroll */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {bracket.rounds.map((_, r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              const el = scrollRef.current;
              if (!el) return;
              el.scrollTo({
                left: r * (COL_W + COL_GAP),
                behavior: "smooth",
              });
            }}
            className="shrink-0 rounded-full border border-border bg-bg-elevated px-3 py-1.5 text-[11px] font-semibold text-fg-muted"
          >
            {roundLabel(r, totalRounds)}
          </button>
        ))}
      </div>

      {/* Scrollable bracket canvas */}
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-hidden rounded-2xl border border-border bg-bg-elevated no-scrollbar"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div
          className="relative"
          style={{
            width: totalRounds * (COL_W + COL_GAP) + 16,
            height: (size / 2) * unit + 40,
            padding: "16px 12px",
          }}
        >
          {/* Connector lines */}
          <svg
            className="pointer-events-none absolute inset-0"
            width="100%"
            height="100%"
            aria-hidden
          >
            {bracket.rounds.slice(0, -1).map((round, r) =>
              round.map((m, i) => {
                if (i % 2 !== 0) return null;
                const nextI = Math.floor(i / 2);
                const y1 = matchCenterY(r, i, unit) + 16;
                const y2 = matchCenterY(r, i + 1, unit) + 16;
                const yMid = matchCenterY(r + 1, nextI, unit) + 16;
                const x0 = 12 + r * (COL_W + COL_GAP) + COL_W;
                const x1 = x0 + COL_GAP / 2;
                const x2 = 12 + (r + 1) * (COL_W + COL_GAP);
                return (
                  <g key={`line-${r}-${i}`} stroke="var(--color-border-strong)" fill="none" strokeWidth="1.5">
                    <path
                      d={`M ${x0} ${y1} H ${x1} V ${y2} H ${x0}`}
                      opacity={0.7}
                    />
                    <path d={`M ${x1} ${(y1 + y2) / 2} H ${x2}`} opacity={0.7} />
                    <circle cx={x2} cy={yMid} r="2" fill="var(--color-border-strong)" />
                  </g>
                );
              }),
            )}
          </svg>

          {bracket.rounds.map((round, r) => (
            <div
              key={r}
              className="absolute top-4"
              style={{ left: 12 + r * (COL_W + COL_GAP), width: COL_W }}
            >
              <p className="mb-2 text-center text-[10px] font-semibold tracking-wide text-fg-subtle uppercase">
                {roundLabel(r, totalRounds)}
              </p>
              {round.map((m, i) => {
                const top = matchTopY(r, i, unit);
                return (
                  <div
                    key={m.id}
                    className="absolute left-0 w-full"
                    style={{ top: top + 18 }}
                  >
                    <MatchCard match={m} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <Legend />
      <MyPath bracket={bracket} meId={meId} />
    </div>
  );
}

function matchTopY(round: number, index: number, unit: number) {
  const span = 2 ** round;
  return index * span * unit + ((span - 1) * unit) / 2;
}

function matchCenterY(round: number, index: number, unit: number) {
  return matchTopY(round, index, unit) + MATCH_H / 2;
}

function MatchCard({ match }: { match: BracketMatch }) {
  const live = match.status === "live";
  const done = match.status === "final" || match.status === "bye";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-bg-subtle shadow-sm",
        live ? "border-court ring-1 ring-court/30" : "border-border",
      )}
      style={{ height: MATCH_H }}
    >
      {live && (
        <div className="flex items-center justify-center gap-1 border-b border-court/20 bg-court-soft py-0.5 text-[9px] font-semibold tracking-wide text-court uppercase">
          <Radio className="size-2.5 animate-pulse" strokeWidth={2.5} />
          Live
        </div>
      )}
      <SlotRow slot={match.top} done={done} compact={live} />
      <div className="h-px bg-border" />
      <SlotRow slot={match.bottom} done={done} compact={live} />
    </div>
  );
}

function SlotRow({
  slot,
  done,
  compact,
}: {
  slot: BracketMatch["top"];
  done: boolean;
  compact?: boolean;
}) {
  const winner = done && slot.isWinner;
  const loser = done && !slot.isWinner && slot.name !== "TBD" && slot.name !== "BYE";

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2",
        compact ? "py-1" : "py-1.5",
        winner && "bg-court-soft/50",
        slot.isYou && !winner && "bg-bg-soft",
      )}
    >
      {slot.seed != null ? (
        <span className="w-3.5 shrink-0 text-[9px] font-semibold tabular-nums text-fg-subtle">
          {slot.seed}
        </span>
      ) : (
        <span className="w-3.5" />
      )}
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[11px] font-semibold",
          winner ? "text-fg" : loser ? "text-fg-subtle line-through decoration-fg-subtle/50" : "text-fg",
          slot.name === "TBD" && "font-normal text-fg-subtle",
          slot.isYou && "text-court",
        )}
      >
        {slot.name}
        {slot.isYou ? " · you" : ""}
      </span>
      {slot.score != null && (
        <span
          className={cn(
            "tabular-nums text-[11px] font-semibold",
            winner ? "text-fg" : "text-fg-muted",
          )}
        >
          {slot.score}
        </span>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[10px] text-fg-subtle">
      <span className="inline-flex items-center gap-1">
        <span className="size-2 rounded-full bg-court" /> Live
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="font-semibold text-court">You</span> highlighted
      </span>
      <span>Winners bold · losers struck</span>
    </div>
  );
}

function MyPath({
  bracket,
  meId,
}: {
  bracket: TournamentBracket;
  meId: string;
}) {
  const path = useMemo(() => {
    const hits: string[] = [];
    for (const round of bracket.rounds) {
      for (const m of round) {
        if (m.top.playerId === meId || m.bottom.playerId === meId) {
          const opp =
            m.top.playerId === meId ? m.bottom.name : m.top.name;
          const result =
            m.status === "final" || m.status === "bye"
              ? (m.top.playerId === meId ? m.top.isWinner : m.bottom.isWinner)
                ? "W"
                : "L"
              : m.status === "live"
                ? "LIVE"
                : "TBD";
          hits.push(`${roundLabel(m.round, bracket.rounds.length)} vs ${opp} · ${result}`);
        }
      }
    }
    return hits;
  }, [bracket, meId]);

  if (path.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-xs text-fg-muted">
        You’re not seeded in this field yet — register to claim a slot.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-bg-elevated px-3 py-2.5">
      <p className="text-[10px] font-semibold tracking-wide text-fg-subtle uppercase">
        Your path
      </p>
      <ul className="mt-1.5 space-y-1">
        {path.map((line) => (
          <li key={line} className="text-xs text-fg-muted">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## FILE: `src/components/compete/tournament-detail.tsx`

```tsx
import { useMemo, useState } from "react";
import {
  Calendar,
  Check,
  ChevronLeft,
  Clock,
  MapPin,
  Trophy,
  Users,
} from "lucide-react";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { TournamentBracketView } from "@/components/compete/tournament-bracket";
import type { GameMode } from "@/lib/upset/tournament-bracket";
import type { Player } from "@/lib/upset/types";
import { displayRating } from "@/lib/rating/engine";
import { cn } from "@/lib/utils";

export type TournamentStatus = "open" | "full" | "live" | "finals" | "complete";

export interface TournamentEvent {
  id: string;
  name: string;
  mode: GameMode;
  when: string;
  startsAt: string;
  checkIn: string;
  location: string;
  address: string;
  capacity: number;
  registered: number;
  entryFee: string;
  prizes: string[];
  rules: string[];
  status: TournamentStatus;
  description?: string;
  registeredIds?: string[];
}

const MODE_LABEL: Partial<Record<GameMode, string>> = {
  "1v1": "1v1",
};

interface TournamentDetailProps {
  event: TournamentEvent;
  players: Player[];
  meId: string;
  onBack: () => void;
  onRegister?: (eventId: string) => void;
}

/** Kept for future events — app is 1v1-only right now. */
export function TournamentDetail({
  event,
  players,
  meId,
  onBack,
  onRegister,
}: TournamentDetailProps) {
  const [showBracket, setShowBracket] = useState(
    event.status === "live" ||
      event.status === "finals" ||
      event.status === "complete" ||
      event.status === "full",
  );
  const registered = useMemo(() => {
    const ids = event.registeredIds ?? [];
    return ids
      .map((id) => players.find((p) => p.id === id))
      .filter(Boolean) as Player[];
  }, [event.registeredIds, players]);
  const isIn = (event.registeredIds ?? []).includes(meId);
  const fieldFull =
    event.registered >= event.capacity ||
    event.status === "full" ||
    event.status === "live" ||
    event.status === "finals" ||
    event.status === "complete";
  const bracketReady = fieldFull;

  if (showBracket && bracketReady) {
    return (
      <TournamentBracketView
        tournamentId={event.id}
        name={event.name}
        mode={event.mode}
        size={event.capacity >= 16 ? 16 : 8}
        players={players}
        meId={meId}
        onBack={() => setShowBracket(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted"
      >
        <ChevronLeft className="size-3.5" />
        Back
      </button>

      <div>
        <p className="text-[10px] font-semibold tracking-[0.14em] text-court uppercase">
          {MODE_LABEL[event.mode] ?? "1v1"} · {event.status}
        </p>
        <h2 className="font-display text-xl font-semibold text-fg">
          {event.name}
        </h2>
        {event.description ? (
          <p className="mt-1 text-sm text-fg-muted">{event.description}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-bg-elevated p-3">
          <Calendar className="mb-1 size-3.5 text-court" />
          <p className="text-[10px] text-fg-subtle">Starts</p>
          <p className="text-xs font-semibold text-fg">{event.startsAt}</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-elevated p-3">
          <Clock className="mb-1 size-3.5 text-court" />
          <p className="text-[10px] text-fg-subtle">Check-in</p>
          <p className="text-xs font-semibold text-fg">{event.checkIn}</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-elevated p-3">
          <MapPin className="mb-1 size-3.5 text-court" />
          <p className="text-[10px] text-fg-subtle">Where</p>
          <p className="text-xs font-semibold text-fg">{event.location}</p>
          <p className="text-[10px] text-fg-muted">{event.address}</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-elevated p-3">
          <Users className="mb-1 size-3.5 text-court" />
          <p className="text-[10px] text-fg-subtle">Field</p>
          <p className="text-xs font-semibold text-fg">
            {event.registered}/{event.capacity}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-bg-elevated p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-fg-muted">
          <Trophy className="size-3.5 text-court" />
          Prizes
        </p>
        <ul className="mt-2 space-y-1">
          {event.prizes.map((p) => (
            <li key={p} className="text-sm text-fg">
              {p}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-fg-subtle">Entry {event.entryFee}</p>
      </div>

      <div className="rounded-xl border border-border bg-bg-elevated p-3">
        <p className="text-[11px] font-semibold text-fg-muted">Rules</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-fg">
          {event.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      {registered.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-fg-muted">
            Registered ({registered.length})
          </p>
          {registered.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-bg-elevated px-3 py-2"
            >
              <PlayerAvatar player={p} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{p.name}</p>
                <p className="text-[11px] text-fg-muted">
                  {displayRating(p.rating)} rating
                </p>
              </div>
              {p.id === meId ? (
                <span className="text-[10px] font-semibold text-court">you</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        {!isIn && !fieldFull ? (
          <button
            type="button"
            onClick={() => onRegister?.(event.id)}
            className="flex-1 rounded-full bg-court py-3 text-sm font-semibold text-white"
          >
            Register
          </button>
        ) : isIn ? (
          <div className="flex flex-1 items-center justify-center gap-1 rounded-full border border-court/40 bg-court/10 py-3 text-sm font-semibold text-court">
            <Check className="size-4" />
            Registered
          </div>
        ) : null}
        {bracketReady ? (
          <button
            type="button"
            onClick={() => setShowBracket(true)}
            className={cn(
              "flex-1 rounded-full py-3 text-sm font-semibold",
              "border border-border bg-bg-elevated text-fg",
            )}
          >
            View bracket
          </button>
        ) : (
          <p className="flex-1 text-center text-[11px] text-fg-muted">
            Bracket locks when the field is full
          </p>
        )}
      </div>
    </div>
  );
}
```

## FILE: `src/components/court-card.tsx`

```tsx
import { useState } from "react";
import { Heart, MapPin, Wrench } from "lucide-react";
import type { Court } from "@/lib/courts/types";
import { courtImagesFor } from "@/lib/courts/images";
import { useFavorites } from "@/lib/courts/favorites";
import {
  mergeCourtWithOverride,
  useCourtAdmin,
} from "@/lib/courts/admin-overrides";
import { isAdminEmail } from "@/lib/auth/admin";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { CourtMapCutout } from "@/components/court-map-cutout";
import { ImageCarousel } from "@/components/image-carousel";
import { WorkOrderPopup } from "@/components/work-order-popup";
import { AdminEditCourtButton } from "@/components/admin-court-editor";
import { directionsUrl } from "@/lib/maps/directions";
import { cn, formatDistance } from "@/lib/utils";

const AMENITY_LABEL: Record<string, string> = {
  lights: "Lights",
  full_court: "Full court",
  half_court: "Half court",
  multiple: "Multi-court",
  water: "Water",
  parking: "Parking",
  fence: "Fenced",
  shade: "Shaded",
};

interface CourtCardProps {
  court: Court;
  index: number;
  selected?: boolean;
  onSelect: (court: Court) => void;
}

export function CourtCard({ court, index, selected, onSelect }: CourtCardProps) {
  const favorites = useFavorites();
  const authUser = useCurrentUser();
  const admin = isAdminEmail(authUser?.primaryEmail);
  const ov = useCourtAdmin((s) => s.overrides[court.id]);
  const display = mergeCourtWithOverride(court, ov);
  const [woOpen, setWoOpen] = useState(false);
  const isFav = favorites.ids.includes(court.id);
  const images = courtImagesFor(court.id, 4, ov?.photos);
  const mapsHref = directionsUrl(display.lat, display.lon, display.name);

  return (
    <article
      className={cn(
        "group slide-up relative overflow-hidden rounded-2xl border bg-bg-elevated shadow-card transition-[border-color] duration-200",
        selected ? "border-court/50" : "border-border hover:border-border-strong",
        `stagger-${Math.min(index + 1, 4)}`,
      )}
    >
      <div className="relative">
        <ImageCarousel
          images={images}
          alt={display.name}
          className="aspect-[16/10]"
          priority={index < 2}
        />
        <div className="absolute top-1.5 left-1.5 z-20">
          <CourtMapCutout
            lat={display.lat}
            lon={display.lon}
            name={display.name}
            address={display.address}
            size={72}
            zoom={12}
          />
        </div>
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
          {admin ? <AdminEditCourtButton court={display} /> : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setWoOpen(true);
            }}
            className="flex size-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
            aria-label={`Report issue at ${display.name}`}
            title="Work order"
          >
            <Wrench className="size-3.5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              favorites.toggle(court.id);
            }}
            className={cn(
              "flex size-8 items-center justify-center rounded-full backdrop-blur-sm transition-colors",
              isFav
                ? "bg-court/90 text-white"
                : "bg-black/35 text-white hover:bg-black/50",
            )}
            aria-label={isFav ? "Remove favorite" : "Save favorite"}
          >
            <Heart
              className={cn("size-3.5", isFav && "fill-current")}
              strokeWidth={1.75}
            />
          </button>
        </div>
      </div>

      <div className="space-y-2 p-3.5">
        <button
          type="button"
          onClick={() => onSelect(display)}
          className="min-w-0 w-full text-left"
        >
          <h2 className="truncate font-display text-base font-semibold tracking-tight text-fg">
            {display.name}
          </h2>
          <p className="mt-0.5 text-xs font-medium text-court">
            {formatDistance(display.distanceMeters)}
            {display.neighborhood ? (
              <span className="font-normal text-fg-muted">
                {" "}
                · {display.neighborhood}
              </span>
            ) : null}
          </p>
        </button>

        {display.address ? (
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-start gap-1 text-sm text-fg-muted underline-offset-2 hover:text-court hover:underline"
          >
            <MapPin
              className="mt-0.5 size-3.5 shrink-0 opacity-70"
              strokeWidth={1.75}
            />
            <span className="line-clamp-1">{display.address}</span>
          </a>
        ) : null}

        <button
          type="button"
          onClick={() => onSelect(display)}
          className="block w-full text-left"
        >
          <div className="flex flex-wrap gap-1">
            {display.amenities.slice(0, 3).map((a) => (
              <span
                key={a}
                className="rounded-full border border-border bg-bg-subtle px-2 py-0.5 text-[10px] text-fg-muted"
              >
                {AMENITY_LABEL[a] ?? a}
              </span>
            ))}
            {display.hoops != null && (
              <span className="rounded-full border border-border bg-bg-subtle px-2 py-0.5 text-[10px] text-fg-muted">
                {display.hoops} hoop{display.hoops === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </button>
      </div>

      <WorkOrderPopup
        courtId={court.id}
        courtName={display.name}
        open={woOpen}
        onClose={() => setWoOpen(false)}
      />
    </article>
  );
}
```

## FILE: `src/components/court-detail.tsx`

```tsx
import { useRef, useState } from "react";
import {
  ExternalLink,
  Flag,
  Heart,
  MapPin,
  Navigation,
  Star,
  Swords,
  Camera,
  ImagePlus,
  Wrench,
  X,
} from "lucide-react";
import type { Court } from "@/lib/courts/types";
import { courtImagesFor } from "@/lib/courts/images";
import { useFavorites } from "@/lib/courts/favorites";
import {
  favoriteCountFor,
  reviewsFor,
  useCourtSocial,
  WORK_ORDER_LABELS,
  type WorkOrderKind,
} from "@/lib/courts/social";
import { CourtMapCutout } from "@/components/court-map-cutout";
import { AdminEditCourtButton } from "@/components/admin-court-editor";
import {
  mergeCourtWithOverride,
  useCourtAdmin,
} from "@/lib/courts/admin-overrides";
import { isAdminEmail } from "@/lib/auth/admin";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { compressWorkOrderPhoto } from "@/components/work-order-popup";
import { ImageCarousel } from "@/components/image-carousel";
import { directionsUrl } from "@/lib/maps/directions";
import { cn, formatDistance } from "@/lib/utils";

const AMENITY_LABEL: Record<string, string> = {
  lights: "Lights",
  full_court: "Full court",
  half_court: "Half court",
  multiple: "Multi-court",
  water: "Water",
  parking: "Parking",
  fence: "Fenced",
  shade: "Shaded",
};

interface CourtDetailProps {
  court: Court | null;
  onClose: () => void;
  onQuickMatch?: (court: Court) => void;
}

export function CourtDetail({ court, onClose, onQuickMatch }: CourtDetailProps) {
  const favorites = useFavorites();
  const social = useCourtSocial();
  const [tab, setTab] = useState<"info" | "reviews" | "report">("info");
  const [reviewText, setReviewText] = useState("");
  const [reviewStars, setReviewStars] = useState(5);
  const [woKind, setWoKind] = useState<WorkOrderKind>("broken_rim");
  const [woOther, setWoOther] = useState("");
  const [woMsg, setWoMsg] = useState<string | null>(null);
  const [woPhotos, setWoPhotos] = useState<string[]>([]);
  const [woPicking, setWoPicking] = useState(false);
  const woCamRef = useRef<HTMLInputElement>(null);
  const woLibRef = useRef<HTMLInputElement>(null);

  const authUser = useCurrentUser();
  const ov = useCourtAdmin((s) => (court ? s.overrides[court.id] : undefined));
  const admin = isAdminEmail(authUser?.primaryEmail);

  if (!court) return null;

  const display = mergeCourtWithOverride(court, ov);
  const isFav = favorites.ids.includes(court.id);
  const images = courtImagesFor(court.id, 5, ov?.photos);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${display.lat},${display.lon}`;
  const favCount = favoriteCountFor(court.id, isFav, social.favoriteBonus);
  const courtReviews = reviewsFor(social.reviews, court.id);
  const avgReview =
    courtReviews.reduce((s, r) => s + r.rating, 0) / Math.max(1, courtReviews.length);
  const courtOrders = social.workOrders.filter((w) => w.courtId === court.id);

  const toggleFav = () => {
    const was = favorites.ids.includes(court.id);
    favorites.toggle(court.id);
    if (!was) social.bumpFavorite(court.id);
  };

  const submitReview = () => {
    if (!reviewText.trim()) return;
    social.addReview(court.id, reviewStars, reviewText);
    setReviewText("");
    setReviewStars(5);
  };

  const submitWorkOrder = () => {
    if (woKind === "other" && !woOther.trim()) {
      setWoMsg("Please describe the issue.");
      return;
    }
    social.addWorkOrder(
      court.id,
      woKind,
      woKind === "other" ? woOther : undefined,
      {
        courtName: display.name,
        reporter: "You",
        photos: woPhotos.length ? woPhotos : undefined,
        photoUrl: woPhotos[0],
      },
    );
    setWoMsg("Work order submitted — parks staff will review.");
    setWoOther("");
    setWoPhotos([]);
  };

  const pickWoPhoto = async (files: FileList | File[] | null) => {
    const list = files
      ? Array.from(files).filter((f) => f.type.startsWith("image/"))
      : [];
    if (!list.length) return;
    setWoPicking(true);
    setWoMsg(null);
    try {
      const urls: string[] = [];
      for (const f of list) urls.push(await compressWorkOrderPhoto(f));
      setWoPhotos((prev) => [...prev, ...urls]);
    } catch {
      setWoMsg("Couldn’t read one of those photos — try again.");
    } finally {
      setWoPicking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm fade-in"
        aria-label="Dismiss"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="court-detail-title"
        className="slide-up relative z-10 flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-bg-elevated shadow-soft sm:rounded-3xl"
      >
        <div className="relative shrink-0">
          <ImageCarousel
            images={images}
            alt={display.name}
            className="h-[min(28dvh,176px)] w-full"
            priority
          />
          <div className="absolute top-1.5 left-1.5 z-20">
            <CourtMapCutout
              lat={display.lat}
              lon={display.lon}
              name={display.name}
              address={display.address}
              size={64}
              zoom={12}
            />
          </div>
          <div className="absolute top-3 right-3 z-20 flex gap-2">
            {admin ? <AdminEditCourtButton court={display} /> : null}
            <button
              type="button"
              onClick={toggleFav}
              className={cn(
                "flex size-10 items-center justify-center rounded-full border backdrop-blur-md",
                isFav
                  ? "border-court/40 bg-court/25 text-court"
                  : "border-border bg-bg/55 text-fg",
              )}
            >
              <Heart className={cn("size-4", isFav && "fill-current")} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex size-10 items-center justify-center rounded-full border border-border bg-bg/55 text-fg backdrop-blur-md"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pt-2.5 pb-5 safe-pb">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-court">
              <span className="inline-flex items-center gap-1">
                <Navigation className="size-3.5" strokeWidth={2.25} />
                {formatDistance(display.distanceMeters)} away
              </span>
              {display.neighborhood && (
                <span className="text-fg-subtle">· {display.neighborhood}</span>
              )}
            </div>
            <h2
              id="court-detail-title"
              className="font-display text-2xl font-semibold tracking-tight text-fg"
            >
              {display.name}
            </h2>
            {display.address && (
              <a
                href={directionsUrl(display.lat, display.lon, display.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex items-start gap-1.5 text-sm text-court underline-offset-2 hover:underline"
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
                <span>
                  <span className="underline decoration-court/40">{display.address}</span>
                  <span className="mt-0.5 block text-[11px] font-medium text-fg-subtle no-underline">
                    Open in Maps for directions
                  </span>
                </span>
              </a>
            )}
          </div>

          {/* Compact social strip */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-fg-muted">
            <span className="inline-flex items-center gap-1 font-medium">
              <Heart className="size-3 text-court" strokeWidth={2} />
              <span className="tabular-nums text-fg">{favCount}</span>
              favorited
            </span>
            <span className="text-fg-subtle">·</span>
            <span className="inline-flex items-center gap-1 font-medium">
              <Star className="size-3 text-gold" strokeWidth={2} />
              <span className="tabular-nums text-fg">{avgReview.toFixed(1)}</span>
              <span>({courtReviews.length})</span>
            </span>
          </div>

          <div className="flex gap-1 overflow-x-auto rounded-full border border-border bg-bg-subtle p-1 no-scrollbar">
            {(
              [
                { id: "info" as const, label: "Details" },
                { id: "reviews" as const, label: "Reviews" },
                { id: "report" as const, label: "Work order" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition-colors",
                  tab === t.id ? "bg-accent text-accent-fg" : "text-fg-muted",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "info" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {display.amenities.map((a) => (
                  <span
                    key={a}
                    className="rounded-full border border-border bg-bg-subtle px-3 py-1 text-xs font-medium text-fg-muted"
                  >
                    {AMENITY_LABEL[a] ?? a}
                  </span>
                ))}
                {display.surface !== "unknown" && (
                  <span className="rounded-full border border-border bg-bg-subtle px-3 py-1 text-xs font-medium capitalize text-fg-muted">
                    {display.surface}
                  </span>
                )}
                {display.hoops ? (
                  <span className="rounded-full border border-border bg-bg-subtle px-3 py-1 text-xs font-medium text-fg-muted">
                    {display.hoops} hoops
                  </span>
                ) : null}
              </div>
              {display.notes && (
                <p className="text-sm leading-relaxed text-fg-muted">{display.notes}</p>
              )}
              {display.hours && (
                <p className="text-xs text-fg-subtle">Hours · {display.hours}</p>
              )}
              {display.lightsHours && (
                <p className="text-xs text-fg-subtle">Lights · {display.lightsHours}</p>
              )}
            </div>
          )}

          {tab === "reviews" && (
            <div className="space-y-3">
              <div className="space-y-2">
                {courtReviews.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-border bg-bg-subtle px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-fg">{r.author}</p>
                      <span className="flex items-center gap-0.5 text-xs font-medium text-gold">
                        {Array.from({ length: r.rating }, (_, i) => (
                          <Star key={i} className="size-3 fill-current" strokeWidth={0} />
                        ))}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-fg-muted">{r.text}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-border bg-bg-subtle p-3 space-y-2">
                <p className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
                  Write a review
                </p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setReviewStars(n)}
                      className={cn(
                        "p-1",
                        n <= reviewStars ? "text-gold" : "text-fg-subtle",
                      )}
                    >
                      <Star
                        className={cn("size-5", n <= reviewStars && "fill-current")}
                        strokeWidth={1.75}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  rows={2}
                  placeholder="How’s the court?"
                  className="w-full resize-none rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm text-fg outline-none"
                />
                <button
                  type="button"
                  onClick={submitReview}
                  className="h-10 w-full rounded-xl bg-accent text-sm font-semibold text-accent-fg"
                >
                  Post review
                </button>
              </div>
            </div>
          )}

          {tab === "report" && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-xl border border-border bg-bg-subtle px-3 py-3">
                <Wrench className="mt-0.5 size-4 shrink-0 text-fg-muted" strokeWidth={1.75} />
                <p className="text-sm text-fg-muted">
                  Request maintenance for this court. Pick an issue or describe
                  something else.
                </p>
              </div>
              <div className="space-y-2">
                {(
                  [
                    { id: "broken_rim" as const, label: "Broken rim" },
                    { id: "replace_net" as const, label: "Replace net" },
                    { id: "other" as const, label: "Something else" },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm",
                      woKind === opt.id
                        ? "border-court bg-court-soft text-fg"
                        : "border-border bg-bg-subtle text-fg-muted",
                    )}
                  >
                    <input
                      type="radio"
                      name="wo"
                      checked={woKind === opt.id}
                      onChange={() => setWoKind(opt.id)}
                      className="accent-[var(--color-court)]"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              {woKind === "other" && (
                <textarea
                  value={woOther}
                  onChange={(e) => setWoOther(e.target.value)}
                  rows={3}
                  placeholder="Describe the issue…"
                  className="w-full resize-none rounded-xl border border-border bg-bg-subtle px-3 py-2.5 text-sm text-fg outline-none"
                  required
                />
              )}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-fg-muted">
                  Photos (optional) · select many at once
                </p>
                {woPhotos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {woPhotos.map((src, i) => (
                      <div
                        key={`${i}-${src.slice(0, 16)}`}
                        className="relative aspect-square overflow-hidden rounded-lg border border-border"
                      >
                        <img src={src} alt="" className="size-full object-cover" />
                        <button
                          type="button"
                          onClick={() =>
                            setWoPhotos((prev) => prev.filter((_, j) => j !== i))
                          }
                          className="absolute top-1 right-1 rounded-full bg-black/55 p-1 text-white"
                          aria-label="Remove photo"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <input
                    ref={woCamRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      void pickWoPhoto(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={woLibRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void pickWoPhoto(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    disabled={woPicking}
                    onClick={() => woCamRef.current?.click()}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-subtle py-2.5 text-xs font-semibold text-fg disabled:opacity-60"
                  >
                    <Camera className="size-3.5" />
                    Take photo
                  </button>
                  <button
                    type="button"
                    disabled={woPicking}
                    onClick={() => woLibRef.current?.click()}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-subtle py-2.5 text-xs font-semibold text-fg disabled:opacity-60"
                  >
                    <ImagePlus className="size-3.5" />
                    {woPhotos.length ? "Add more" : "Upload"}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={submitWorkOrder}
                disabled={woPicking}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-fg disabled:opacity-60"
              >
                <Wrench className="size-4" strokeWidth={2} />
                Submit work order
              </button>
              {woMsg && (
                <p className="text-center text-xs text-fg-muted" role="status">
                  {woMsg}
                </p>
              )}
              {courtOrders.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
                    Your requests
                  </p>
                  {courtOrders.map((w) => (
                    <div
                      key={w.id}
                      className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-fg-muted"
                    >
                      <div className="flex gap-2">
                        {(w.photos?.length ? w.photos : w.photoUrl ? [w.photoUrl] : []).slice(0, 3).map((src, i) => (
                          <img
                            key={i}
                            src={src}
                            alt=""
                            className="size-12 shrink-0 rounded-md object-cover"
                          />
                        ))}
                        <div className="min-w-0">
                          {WORK_ORDER_LABELS[w.kind]}
                          {w.detail ? ` — ${w.detail}` : ""} · {w.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => onQuickMatch?.(display)}
              className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-xl bg-court text-sm font-semibold text-white active:scale-[0.98]"
            >
              <Swords className="size-4" strokeWidth={2} />
              Create game here
            </button>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border-strong bg-bg-subtle text-sm font-medium text-fg"
            >
              Directions
              <ExternalLink className="size-3.5 opacity-70" strokeWidth={1.75} />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 items-center justify-center rounded-xl border border-border-strong bg-bg-subtle text-sm font-medium text-fg"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## FILE: `src/components/court-map-cutout.tsx`

```tsx
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Navigation, X } from "lucide-react";
import { directionsUrl } from "@/lib/maps/directions";
import { cn } from "@/lib/utils";

const AUSTIN = { lat: 30.2672, lon: -97.7431 };

/**
 * Small city-map cutout on court photos. Tap expands to full map.
 */
export function CourtMapCutout({
  lat,
  lon,
  name,
  address,
  className,
  size = 56,
  zoom = 12,
}: {
  lat: number;
  lon: number;
  name?: string;
  address?: string;
  neighborhood?: string;
  className?: string;
  size?: number;
  zoom?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const focus = useMemo(() => {
    const t = 0.25;
    return {
      lat: lat * (1 - t) + AUSTIN.lat * t,
      lon: lon * (1 - t) + AUSTIN.lon * t,
    };
  }, [lat, lon]);
  const layout = useMemo(
    () => tileMosaic(focus.lat, focus.lon, zoom, lat, lon),
    [focus.lat, focus.lon, zoom, lat, lon],
  );
  const labelId = useId();

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(true);
        }}
        className={cn(
          "relative block overflow-hidden rounded-lg border border-white/40 bg-bg-subtle shadow-sm ring-1 ring-black/15 transition-transform active:scale-[0.98]",
          className,
        )}
        style={{ width: size, height: size }}
        aria-label={
          name ? `Open Austin map of ${name}` : "Open full Austin map of this court"
        }
        aria-expanded={expanded}
        aria-controls={labelId}
      >
        <div
          className="absolute"
          style={{
            width: size * 2,
            height: size * 2,
            left: -layout.offsetX * size,
            top: -layout.offsetY * size,
          }}
        >
          {[0, 1].map((row) =>
            [0, 1].map((col) => {
              const tx = layout.baseX + col;
              const ty = layout.baseY + row;
              const host = ["a", "b", "c", "d"][(tx + ty) % 4];
              const url = `https://${host}.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${tx}/${ty}.png`;
              return (
                <img
                  key={`${tx}-${ty}`}
                  src={url}
                  alt=""
                  width={size}
                  height={size}
                  className="absolute object-cover"
                  style={{
                    left: col * size,
                    top: row * size,
                    width: size,
                    height: size,
                  }}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              );
            }),
          )}
        </div>
        <div
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${layout.pinX * 100}%`,
            top: `${layout.pinY * 100}%`,
          }}
        >
          <span className="block size-2.5 rounded-full border-2 border-white bg-court shadow-sm" />
        </div>
      </button>

      {expanded &&
        typeof document !== "undefined" &&
        createPortal(
          <CourtMapExpand
            id={labelId}
            lat={lat}
            lon={lon}
            name={name}
            address={address}
            onClose={() => setExpanded(false)}
          />,
          document.body,
        )}
    </>
  );
}

function CourtMapExpand({
  id,
  lat,
  lon,
  name,
  address,
  onClose,
}: {
  id: string;
  lat: number;
  lon: number;
  name?: string;
  address?: string;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let map: import("maplibre-gl").Map | null = null;
    let ro: ResizeObserver | null = null;

    (async () => {
      try {
        if (!containerRef.current || mapRef.current) return;
        const maplibregl = await import("maplibre-gl");
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled || !containerRef.current) return;

        map = new maplibregl.Map({
          container: containerRef.current,
          style: {
            version: 8,
            sources: {
              carto: {
                type: "raster",
                tiles: [
                  "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
                  "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
                ],
                tileSize: 256,
                attribution: "© OSM © CARTO",
              },
            },
            layers: [
              {
                id: "bg",
                type: "background",
                paint: { "background-color": "#d4cfc4" },
              },
              { id: "carto", type: "raster", source: "carto" },
            ],
          },
          center: [lon, lat],
          zoom: 13.5,
          attributionControl: { compact: true },
        });

        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          "top-right",
        );

        const pin = document.createElement("div");
        pin.innerHTML =
          '<div style="width:16px;height:16px;border-radius:999px;background:#c45c26;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>';
        new maplibregl.Marker({ element: pin, anchor: "center" })
          .setLngLat([lon, lat])
          .addTo(map);

        mapRef.current = map;

        const finish = () => {
          if (cancelled || !map) return;
          setReady(true);
          map.resize();
          map.jumpTo({ center: [lon, lat], zoom: 14.2 });
        };
        if (map.loaded()) finish();
        else map.once("load", finish);
        map.on("error", () => {
          if (!cancelled) setFailed(true);
        });

        ro = new ResizeObserver(() => map?.resize());
        ro.observe(containerRef.current);
        window.setTimeout(() => map?.resize(), 120);
        window.setTimeout(() => map?.resize(), 400);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, [lat, lon]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const routeUrl = directionsUrl(lat, lon, name ?? address);

  return (
    <div
      id={id}
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={name ? `Map of ${name}` : "Court map"}
    >
      <button
        type="button"
        className="absolute inset-0 bg-bg/80 backdrop-blur-sm fade-in"
        aria-label="Close map"
        onClick={onClose}
      />
      <div
        className="slide-up relative z-10 flex h-[min(90dvh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-bg-elevated shadow-soft sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-court uppercase">
              Austin, TX
            </p>
            <p className="truncate font-display text-base font-semibold text-fg">
              {name ?? "Court"}
            </p>
            {address && (
              <a
                href={routeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 flex items-start gap-1 text-xs text-court underline-offset-2 hover:underline"
              >
                <ExternalLink className="mt-0.5 size-3 shrink-0" />
                <span className="line-clamp-2">{address}</span>
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-bg-subtle text-fg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="relative min-h-0 w-full flex-1 overflow-hidden bg-[#d4cfc4]">
          <div
            ref={containerRef}
            className="absolute inset-0 h-full w-full"
            style={{ minHeight: 240 }}
          />
          {!ready && !failed && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-9 w-9 animate-pulse rounded-full bg-bg/40" />
            </div>
          )}
          {failed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm text-fg-muted">Map couldn’t load.</p>
              <a
                href={routeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-court underline"
              >
                Open in Maps instead
              </a>
            </div>
          )}
        </div>

        <div className="relative z-20 shrink-0 border-t border-border bg-bg-elevated p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <a
            href={routeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-court text-sm font-semibold text-white shadow-sm"
          >
            <Navigation className="size-4" strokeWidth={2.25} />
            Get directions
          </a>
        </div>
      </div>
    </div>
  );
}

function tileMosaic(
  focusLat: number,
  focusLon: number,
  zoom: number,
  courtLat: number,
  courtLon: number,
) {
  const n = 2 ** zoom;
  const toXY = (la: number, lo: number) => {
    const xFloat = ((lo + 180) / 360) * n;
    const latRad = (la * Math.PI) / 180;
    const yFloat =
      ((1 -
        Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
        2) *
      n;
    return { xFloat, yFloat };
  };

  const focus = toXY(focusLat, focusLon);
  const court = toXY(courtLat, courtLon);
  const baseX = Math.floor(focus.xFloat - 0.5);
  const baseY = Math.floor(focus.yFloat - 0.5);
  const fracX = focus.xFloat - baseX;
  const fracY = focus.yFloat - baseY;
  const offsetX = Math.min(1, Math.max(0, fracX - 0.5));
  const offsetY = Math.min(1, Math.max(0, fracY - 0.5));
  const pinX = Math.min(
    0.92,
    Math.max(0.08, court.xFloat - baseX - offsetX),
  );
  const pinY = Math.min(
    0.88,
    Math.max(0.12, court.yFloat - baseY - offsetY),
  );

  return {
    baseX: Math.max(0, baseX),
    baseY: Math.max(0, baseY),
    offsetX,
    offsetY,
    pinX,
    pinY,
  };
}
```

## FILE: `src/components/courts-finder.tsx`

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Heart,
  List,
  LocateFixed,
  Map as MapIcon,
  Search,
  TreePine,
  X,
} from "lucide-react";
import { CourtCard } from "@/components/court-card";
import { CourtDetail } from "@/components/court-detail";
import { CourtsMap } from "@/components/courts-map";
import type { Court, UserLocation } from "@/lib/courts/types";
import { useFavorites } from "@/lib/courts/favorites";
import { cn } from "@/lib/utils";

type ViewMode = "list" | "map";

const RADIUS_MILES = [1, 2, 3, 5, 8, 10, 15, 20, 25] as const;

const RECOMMENDED_COURT_IDS = new Set([
  "cat-zilker",
  "cat-battle-bend",
  "cat-pease",
  "cat-bartholomew",
  "cat-rosewood",
  "cat-reed",
  "cat-circle-c",
  "cat-west4",
  "cat-garrison",
  "cat-walnut-creek",
  "cat-hancock",
  "cat-searight",
]);

function recommendScore(c: Court & { distanceMeters: number }) {
  let s = 0;
  if (RECOMMENDED_COURT_IDS.has(c.id)) s += 100;
  const a = new Set(c.amenities ?? []);
  if (a.has("shade")) s += 25;
  if (a.has("lights")) s += 20;
  if (a.has("parking")) s += 15;
  if (a.has("multiple")) s += 15;
  if (a.has("water")) s += 10;
  if (a.has("fence")) s += 8;
  if ((c.hoops ?? 0) >= 4) s += 12;
  s += Math.max(0, 15 - c.distanceMeters / 1609.34);
  return s;
}

export interface CourtsFinderProps {
  courts: Court[];
  location: UserLocation;
  loading: boolean;
  locating: boolean;
  error: string | null;
  locError: string | null;
  radiusMi: number;
  dataSource: string;
  onRadiusChange: (mi: number) => void;
  onRefresh: () => void;
  onNearMe: () => void;
  onQuickMatch?: (court: Court) => void;
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function geocodeAustinAddress(
  q: string,
): Promise<{ lat: number; lon: number; label: string } | null> {
  const query = q.trim();
  if (query.length < 3) return null;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${query}, Austin, Texas`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("viewbox", "-98.05,30.55,-97.45,30.05");
  url.searchParams.set("bounded", "1");
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    const hit = data[0];
    if (!hit) return null;
    return {
      lat: Number(hit.lat),
      lon: Number(hit.lon),
      label: hit.display_name.split(",").slice(0, 2).join(","),
    };
  } catch {
    return null;
  }
}

export function CourtsFinder({
  courts,
  location,
  loading,
  locating,
  error,
  locError,
  radiusMi,
  dataSource,
  onRadiusChange,
  onRefresh,
  onNearMe,
  onQuickMatch,
}: CourtsFinderProps) {
  const favorites = useFavorites();
  const [filters, setFilters] = useState<Set<string>>(() => new Set());
  const [view, setView] = useState<ViewMode>("list");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Court | null>(null);
  const [searchOrigin, setSearchOrigin] = useState<{
    lat: number;
    lon: number;
    label: string;
  } | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchMiss, setSearchMiss] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  void dataSource;

  const toggleFilter = (id: string) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearFilters = () => setFilters(new Set());

  useEffect(() => {
    const q = query.trim();
    if (q.length < 4) {
      setSearchOrigin(null);
      setSearchMiss(false);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setSearching(true);
      const hit = await geocodeAustinAddress(q);
      if (cancelled) return;
      setSearching(false);
      if (hit) {
        setSearchOrigin(hit);
        setSearchMiss(false);
      } else {
        setSearchOrigin(null);
        setSearchMiss(true);
      }
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    if (searchOpen) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [searchOpen]);

  const origin = searchOrigin ?? {
    lat: location.lat,
    lon: location.lon,
  };

  const filtered = useMemo(() => {
    let list = courts.map((c) => ({
      ...c,
      distanceMeters: haversineM(origin.lat, origin.lon, c.lat, c.lon),
    }));

    if (filters.has("favorites")) {
      list = list.filter((c) => favorites.ids.includes(c.id));
    }
    if (filters.has("shade")) {
      list = list.filter((c) => c.amenities.includes("shade"));
    }

    list.sort((a, b) => {
      if (filters.has("highest_rated")) {
        const d = recommendScore(b) - recommendScore(a);
        if (d !== 0) return d;
      }
      return a.distanceMeters - b.distanceMeters;
    });
    return list;
  }, [courts, filters, favorites.ids, origin.lat, origin.lon]);

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
    setSearchOrigin(null);
    setSearchMiss(false);
  };

  return (
    <div className="space-y-3">
      {locError && (
        <p className="text-center text-xs text-fg-muted" role="status">
          {locError}
        </p>
      )}

      <div className="flex items-center gap-1.5">
        {searchOpen ? (
          <div className="relative flex min-w-0 flex-1 items-center">
            <Search
              className="pointer-events-none absolute left-2.5 size-3.5 text-fg-subtle"
              strokeWidth={1.75}
            />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type an address…"
              className="h-9 w-full rounded-xl border border-border bg-bg-elevated pr-9 pl-8 text-sm text-fg placeholder:text-fg-subtle outline-none focus:border-border-strong"
              aria-label="Search by address"
            />
            <button
              type="button"
              onClick={closeSearch}
              className="absolute right-1.5 flex size-7 items-center justify-center rounded-lg text-fg-muted"
              aria-label="Close search"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-bg-elevated text-fg-muted hover:text-fg"
              aria-label="Search by address"
            >
              <Search className="size-4" strokeWidth={1.75} />
            </button>
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={clearFilters}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-medium",
                  filters.size === 0
                    ? "bg-accent text-accent-fg"
                    : "bg-bg-elevated text-fg-muted hover:text-fg",
                )}
              >
                All
              </button>
              {(
                [
                  { id: "favorites", label: "Saved", icon: Heart },
                  { id: "shade", label: "Shaded", icon: TreePine },
                  { id: "highest_rated", label: "Highest rated" },
                ] as const
              ).map((f) => {
                const on = filters.has(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFilter(f.id)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium",
                      on
                        ? "bg-accent text-accent-fg"
                        : "bg-bg-elevated text-fg-muted hover:text-fg",
                    )}
                  >
                    {"icon" in f && f.icon ? (
                      <f.icon
                        className={cn(
                          "size-3",
                          f.id === "favorites" && on && "fill-current",
                        )}
                        strokeWidth={1.75}
                      />
                    ) : null}
                    {on ? "✓ " : ""}
                    {f.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-[11px] text-fg-subtle">
          {searching
            ? "Finding that address…"
            : searchOrigin
              ? `Closest to ${searchOrigin.label}`
              : searchMiss
                ? "Address not found — try a street in Austin"
                : loading
                  ? "Loading…"
                  : `${filtered.length} court${filtered.length === 1 ? "" : "s"}${
                      filters.has("highest_rated")
                        ? " · highest rated first"
                        : " · nearest first"
                    }`}
        </p>

        <div className="flex shrink-0 items-center gap-1.5">
          <select
            value={radiusMi}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-[11px] font-medium text-fg outline-none"
            aria-label="Radius"
          >
            {RADIUS_MILES.map((m) => (
              <option key={m} value={m}>
                {m} mi
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onNearMe}
            disabled={locating}
            className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-fg disabled:opacity-60"
            aria-label="Near me"
          >
            <LocateFixed className="size-3.5" strokeWidth={1.75} />
          </button>

          <div className="flex rounded-lg bg-bg-subtle p-0.5">
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "flex size-7 items-center justify-center rounded-md",
                view === "list"
                  ? "bg-bg-elevated text-fg shadow-sm"
                  : "text-fg-subtle",
              )}
              aria-label="List view"
            >
              <List className="size-3.5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setView("map")}
              className={cn(
                "flex size-7 items-center justify-center rounded-md",
                view === "map"
                  ? "bg-bg-elevated text-fg shadow-sm"
                  : "text-fg-subtle",
              )}
              aria-label="Map view"
            >
              <MapIcon className="size-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm">
          {error}
          <button
            type="button"
            className="ml-2 font-medium text-court underline-offset-2 hover:underline"
            onClick={onRefresh}
          >
            Retry
          </button>
        </div>
      )}

      {loading && courts.length === 0 ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-border bg-bg-elevated"
            >
              <div className="aspect-[16/10] animate-pulse bg-bg-subtle" />
              <div className="space-y-2 p-3">
                <div className="h-4 w-2/3 animate-pulse rounded bg-bg-subtle" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-bg-subtle" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          filters={filters}
          onClear={clearFilters}
          onRefresh={onRefresh}
        />
      ) : view === "map" ? (
        <CourtsMap
          courts={filtered}
          location={
            searchOrigin
              ? {
                  lat: searchOrigin.lat,
                  lon: searchOrigin.lon,
                  label: searchOrigin.label,
                }
              : location
          }
          selectedId={selected?.id}
          onSelect={setSelected}
          variant="finder"
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((court, i) => (
            <CourtCard
              key={court.id}
              court={court}
              index={i}
              selected={selected?.id === court.id}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}

      <CourtDetail
        court={selected}
        onClose={() => setSelected(null)}
        onQuickMatch={(c) => {
          setSelected(null);
          onQuickMatch?.(c);
        }}
      />
    </div>
  );
}

function EmptyState({
  filters,
  onClear,
  onRefresh,
}: {
  filters: Set<string>;
  onClear: () => void;
  onRefresh: () => void;
}) {
  const hasFav = filters.has("favorites");
  const hasShade = filters.has("shade");
  return (
    <div className="fade-in flex flex-col items-center rounded-2xl border border-border bg-bg-elevated px-6 py-10 text-center">
      <h2 className="font-display text-base font-semibold text-fg">
        {hasFav && !hasShade
          ? "No saved courts yet"
          : hasShade || filters.size > 0
            ? "No courts match these filters"
            : "No courts in range"}
      </h2>
      <p className="mt-1.5 max-w-xs text-sm text-fg-muted">
        {hasFav && filters.size === 1
          ? "Tap the heart on a court to save it."
          : "Widen the radius, clear a filter, or search an address."}
      </p>
      <div className="mt-4 flex gap-2">
        {filters.size > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-fg"
          >
            Clear filters
          </button>
        )}
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-full bg-court px-3.5 py-1.5 text-sm font-semibold text-white"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
```

## FILE: `src/components/courts-map.tsx`

```tsx
import { useEffect, useRef, useState } from "react";
import type { Court, UserLocation } from "@/lib/courts/types";
import type { Player } from "@/lib/upset/types";
import { cn } from "@/lib/utils";

interface CourtsMapProps {
  courts: Court[];
  location: UserLocation;
  selectedId?: string | null;
  onSelect: (court: Court) => void;
  kings?: Record<string, Player | null | undefined>;
  openGames?: Record<string, number>;
  /** Finder mode: simple pins + hover name labels */
  variant?: "scene" | "finder";
}

type MapStyle = "satellite" | "street";

export function CourtsMap({
  courts,
  location,
  selectedId,
  onSelect,
  kings = {},
  openGames = {},
  variant = "scene",
}: CourtsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markersRef = useRef<import("maplibre-gl").Marker[]>([]);
  const [style, setStyle] = useState<MapStyle>("street");
  const [ready, setReady] = useState(false);
  const [zoomTick, setZoomTick] = useState(0);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!containerRef.current || mapRef.current) return;
      const maplibregl = await import("maplibre-gl");
      await import("maplibre-gl/dist/maplibre-gl.css");
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: STREET_STYLE,
        center: [location.lon, location.lat],
        zoom: 11.2,
        attributionControl: { compact: true },
      });
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "bottom-right",
      );
      mapRef.current = map;
      map.on("load", () => {
        if (!cancelled) {
          setReady(true);
          map.resize();
        }
      });
      map.on("zoomend", () => setZoomTick((t) => t + 1));
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const center = map.getCenter();
    const zoom = map.getZoom();
    map.setStyle(style === "satellite" ? SATELLITE_STYLE : STREET_STYLE);
    map.once("style.load", () => {
      map.setCenter(center);
      map.setZoom(zoom);
    });
  }, [style, ready]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    let cancelled = false;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      const map = mapRef.current;
      if (!map || cancelled) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const youEl = document.createElement("div");
      youEl.innerHTML = `<div class="uc-you"></div>`;
      markersRef.current.push(
        new maplibregl.Marker({ element: youEl, anchor: "center" })
          .setLngLat([location.lon, location.lat])
          .addTo(map),
      );

      const zoom = map.getZoom();
      const cluster = zoom < 11.5 && courts.length > 8;

      const placePin = (c: Court) => {
        const king = kings[c.id];
        const open = openGames[c.id] ?? 0;
        const selected = c.id === selectedId;
        const el = document.createElement("div");
        el.className = [
          "uc-pin",
          variant === "finder" ? "uc-pin-finder-wrap" : "",
          selected ? "uc-pin-selected" : "",
          variant !== "finder" && !king ? "uc-pin-open" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const initials = king
          ? king.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
          : "";

        const isFinder = variant === "finder";
        el.innerHTML = isFinder
          ? `
          <div class="uc-pin-face uc-pin-finder">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="10" r="3"/><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/></svg>
          </div>
          <div class="uc-pin-hover">${esc(c.name)}</div>
          ${selected ? `<div class="uc-pin-label">${esc(c.name)}</div>` : ""}
        `
          : `
          <div class="uc-pin-face" style="${king ? `background:oklch(0.42 0.08 ${king.hue})` : ""}">
            ${
              king
                ? `<span>${initials}</span>`
                : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`
            }
          </div>
          ${open > 0 ? `<span class="uc-badge">${open}</span>` : ""}
          <div class="uc-pin-hover">${esc(c.name)}</div>
          ${
            selected
              ? `<div class="uc-pin-label">${esc(c.name)}${king ? ` · ${esc(king.name)} runs this court` : " · Unclaimed"}</div>`
              : !king
                ? `<div class="uc-pin-sub">Unclaimed</div>`
                : ""
          }
        `;
        // Hover / focus label for finder (and scene when not selected)
        const labelEl = el.querySelector(".uc-pin-hover") as HTMLElement | null;
        el.addEventListener("mouseenter", () => {
          el.classList.add("uc-pin-hovering");
        });
        el.addEventListener("mouseleave", () => {
          el.classList.remove("uc-pin-hovering");
        });
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectRef.current(c);
        });
        void labelEl;
        markersRef.current.push(
          new maplibregl.Marker({ element: el, anchor: "center" })
            .setLngLat([c.lon, c.lat])
            .addTo(map),
        );
      };

      if (cluster) {
        const buckets = new Map<string, Court[]>();
        for (const c of courts) {
          const key = `${c.lat.toFixed(2)},${c.lon.toFixed(2)}`;
          const arr = buckets.get(key) ?? [];
          arr.push(c);
          buckets.set(key, arr);
        }
        for (const group of buckets.values()) {
          if (group.length === 1) {
            placePin(group[0]!);
          } else {
            const lat = group.reduce((s, c) => s + c.lat, 0) / group.length;
            const lon = group.reduce((s, c) => s + c.lon, 0) / group.length;
            const el = document.createElement("div");
            el.className = "uc-cluster";
            el.textContent = String(group.length);
            el.onclick = () =>
              map.easeTo({ center: [lon, lat], zoom: Math.min(zoom + 2.2, 14) });
            markersRef.current.push(
              new maplibregl.Marker({ element: el, anchor: "center" })
                .setLngLat([lon, lat])
                .addTo(map),
            );
          }
        }
      } else {
        for (const c of courts.slice(0, 50)) placePin(c);
      }

      // neighborhood banners
      if (zoom < 13) {
        const zones = new Map<string, { lat: number; lon: number; n: number }>();
        for (const c of courts) {
          if (!c.neighborhood) continue;
          const z = zones.get(c.neighborhood) ?? { lat: 0, lon: 0, n: 0 };
          z.lat += c.lat;
          z.lon += c.lon;
          z.n += 1;
          zones.set(c.neighborhood, z);
        }
        for (const [name, z] of zones) {
          const el = document.createElement("div");
          el.className = "uc-zone";
          el.textContent = name;
          markersRef.current.push(
            new maplibregl.Marker({ element: el, anchor: "center" })
              .setLngLat([z.lon / z.n, z.lat / z.n])
              .addTo(map),
          );
        }
      }

      if (courts.length > 0 && zoomTick === 0) {
        const bounds = new maplibregl.LngLatBounds();
        bounds.extend([location.lon, location.lat]);
        for (const c of courts.slice(0, 40)) bounds.extend([c.lon, c.lat]);
        map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 500 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courts, location, selectedId, kings, openGames, ready, zoomTick, variant]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-bg-elevated">
      <div ref={containerRef} className="uc-map aspect-[4/5] w-full sm:aspect-[16/11]" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-elevated">
          <div className="h-8 w-8 animate-pulse rounded-full bg-bg-subtle" />
        </div>
      )}
      <div className="absolute top-3 left-3 z-10 flex rounded-full border border-border bg-bg/90 p-0.5 shadow-soft backdrop-blur-md">
        {(
          [
            { id: "street" as const, label: "Street" },
            { id: "satellite" as const, label: "Satellite" },
          ] as const
        ).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStyle(s.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              style === s.id ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="absolute right-3 bottom-10 z-10 rounded-full border border-border bg-bg/85 px-2.5 py-1 text-[11px] font-medium text-fg-muted backdrop-blur-sm">
        {courts.length} courts
      </div>
    </div>
  );
}

function esc(s: string) {
  return s
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;")
    .replace(/'/g, "&#39;");
}

const STREET_STYLE: import("maplibre-gl").StyleSpecification = {
  version: 8,
  name: "Upset City Street",
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "&copy; OSM &copy; CARTO",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#e8e0d4" } },
    {
      id: "carto",
      type: "raster",
      source: "carto",
      paint: {
        "raster-saturation": -0.35,
        "raster-contrast": -0.08,
        "raster-brightness-min": 0.04,
        "raster-brightness-max": 0.9,
        "raster-opacity": 0.94,
      },
    },
  ],
};

const SATELLITE_STYLE: import("maplibre-gl").StyleSpecification = {
  version: 8,
  name: "Upset City Satellite",
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles &copy; Esri",
    },
  },
  layers: [
    {
      id: "esri",
      type: "raster",
      source: "esri",
      paint: { "raster-saturation": -0.12, "raster-contrast": 0.06 },
    },
  ],
};
```

## FILE: `src/components/created-with-grok-banner.tsx`

```tsx
/**
 * Top branding bar for deployed apps. Visibility is deploy-controlled via
 * VITE_* env (inlined by Vite at build time). Defaults off.
 */

import { useLayoutEffect } from "react";

const BANNER_HEIGHT = "2.25rem";
const BANNER_HEIGHT_VAR = "--grok-banner-h";

function readEnv(key: string): string | undefined {
  const vite = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const fromVite = vite?.[key];
  if (fromVite !== undefined && fromVite !== "") return fromVite;
  return undefined;
}

function envFlag(key: string, defaultValue: boolean): boolean {
  const raw = readEnv(key);
  if (raw === undefined) return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return defaultValue;
}

function RemixIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="block size-3.5 shrink-0"
      aria-hidden
    >
      <path
        d="M2.85059 3.5C3.42171 3.49757 3.9879 3.74949 4.36816 4.17562C5.82851 5.79822 7.28852 7.42134 8.74886 9.04394C8.91014 9.22468 9.14982 9.3323 9.39201 9.33333C9.39445 9.33335 9.39697 9.33333 9.39941 9.33333C9.69335 9.33354 9.98729 9.34136 10.2812 9.35612L9.50423 8.5791L10.3291 7.75423L12.4915 9.91667L10.3291 12.0791L9.50423 11.2542L10.2812 10.4766C9.98728 10.4914 9.69336 10.4998 9.39941 10.5C9.39371 10.5 9.38802 10.5 9.38232 10.5C8.81697 10.4976 8.25832 10.2462 7.88184 9.82438C6.42149 8.20178 4.96148 6.57866 3.50114 4.95605C3.33823 4.77345 3.09529 4.66561 2.85059 4.66667H1.75V3.5H2.85059Z"
        fill="#417CFF"
      />
      <path
        d="M5.53597 8.52612C5.14663 8.95882 4.75754 9.39174 4.36816 9.82438C3.9879 10.2505 3.42171 10.5024 2.85059 10.5H1.75V9.33333H2.85059C3.09529 9.33439 3.33823 9.22655 3.50114 9.04394C3.91804 8.58073 4.33469 8.11725 4.75155 7.65397L5.53597 8.52612Z"
        fill="#417CFF"
      />
      <path
        d="M12.4915 4.08333L10.3291 6.24577L9.50423 5.4209L10.2801 4.64445C9.99185 4.65884 9.70361 4.66667 9.41536 4.66667H9.39941C9.15471 4.66561 8.91177 4.77346 8.74886 4.95605C8.33197 5.41926 7.91473 5.88219 7.49788 6.34546L6.71346 5.47331C7.10279 5.04063 7.49247 4.60825 7.88184 4.17562C8.2621 3.74949 8.8283 3.49757 9.39941 3.5H9.41536C9.7036 3.5 9.99186 3.50726 10.2801 3.52165L9.50423 2.74577L10.3291 1.9209L12.4915 4.08333Z"
        fill="#417CFF"
      />
    </svg>
  );
}

export function CreatedWithGrokBanner() {
  const showBanner = envFlag("VITE_SHOW_BUILT_WITH_GROK", false);

  useLayoutEffect(() => {
    if (!showBanner || typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty(BANNER_HEIGHT_VAR, BANNER_HEIGHT);
    return () => {
      root.style.removeProperty(BANNER_HEIGHT_VAR);
    };
  }, [showBanner]);

  if (!showBanner) return null;

  const projectId = (readEnv("VITE_PROJECT_ID") ?? "").trim();
  const showRemix = envFlag("VITE_ALLOW_FORKING", false) && projectId.length > 0;

  return (
    <>
      <div className="h-9 w-full shrink-0" aria-hidden />
      <div
        className="fixed top-0 left-0 right-0 z-[100] flex h-9 w-full items-center justify-center gap-4 bg-black px-3 text-[13px] leading-none text-white/90"
        data-created-with-grok-banner
      >
        <a
          href="https://grok.com?m=build"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0"
          aria-label="Created with Grok"
        />
        <span className="relative z-10 pointer-events-none select-none font-medium tracking-tight text-white/80">
          Created with Grok
        </span>
        {showRemix ? (
          <a
            href={`https://grok.com/remix?app_id=${encodeURIComponent(projectId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 inline-flex h-6 items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2.5 text-[12px] font-medium text-white transition-colors hover:bg-white/15"
          >
            <RemixIcon />
            Remix
          </a>
        ) : null}
      </div>
    </>
  );
}
```

## FILE: `src/components/image-carousel.tsx`

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageCarouselProps {
  images: string[];
  alt?: string;
  className?: string;
  priority?: boolean;
  showControls?: boolean;
}

/**
 * Swipeable photo strip — swipe, dots, or edge-tucked chevrons.
 */
export function ImageCarousel({
  images,
  alt = "",
  className,
  priority,
  showControls = true,
}: ImageCarouselProps) {
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startScroll = useRef(0);

  const count = images.length;

  const goTo = useCallback(
    (i: number) => {
      const next = ((i % count) + count) % count;
      setIndex(next);
      const el = scrollerRef.current;
      if (!el) return;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    },
    [count],
  );

  const go = useCallback(
    (dir: -1 | 1) => {
      goTo(index + dir);
    },
    [goTo, index],
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const w = el.clientWidth || 1;
        const i = Math.round(el.scrollLeft / w);
        setIndex((prev) => (i !== prev && i >= 0 && i < count ? i : prev));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [count]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      el.scrollLeft = index * el.clientWidth;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [index]);

  if (count === 0) return null;

  return (
    <div
      className={cn(
        "group/carousel relative isolate overflow-hidden bg-bg-subtle",
        className,
      )}
    >
      <div
        ref={scrollerRef}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          dragging.current = true;
          startX.current = e.clientX;
          startScroll.current = scrollerRef.current?.scrollLeft ?? 0;
        }}
        onPointerMove={(e) => {
          if (!dragging.current || !scrollerRef.current) return;
          if (e.pointerType === "mouse") {
            scrollerRef.current.scrollLeft =
              startScroll.current - (e.clientX - startX.current);
          }
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        {images.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className="h-full w-full shrink-0 grow-0 basis-full snap-center snap-always"
          >
            <img
              src={src}
              alt={i === 0 ? alt : ""}
              draggable={false}
              className="h-full w-full object-cover object-center select-none"
              loading={priority && i === 0 ? "eager" : "lazy"}
              decoding="async"
            />
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/30 to-transparent" />
      )}

      {count > 1 && (
        <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goTo(i);
              }}
              className={cn(
                "h-1 rounded-full transition-all",
                i === index ? "w-3 bg-white" : "w-1 bg-white/50",
              )}
              aria-label={`Photo ${i + 1} of ${count}`}
            />
          ))}
        </div>
      )}

      {/* Edge-tucked arrows — flush to sides, low contrast */}
      {showControls && count > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              go(-1);
            }}
            className="absolute top-1/2 left-0 z-20 flex h-12 w-7 -translate-y-1/2 items-center justify-start rounded-r-full bg-black/25 pl-0.5 text-white/80 backdrop-blur-[1px] transition-colors hover:bg-black/40 hover:text-white"
            aria-label="Previous photo"
          >
            <ChevronLeft className="size-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              go(1);
            }}
            className="absolute top-1/2 right-0 z-20 flex h-12 w-7 -translate-y-1/2 items-center justify-end rounded-l-full bg-black/25 pr-0.5 text-white/80 backdrop-blur-[1px] transition-colors hover:bg-black/40 hover:text-white"
            aria-label="Next photo"
          >
            <ChevronRight className="size-4" strokeWidth={2} />
          </button>
        </>
      )}
    </div>
  );
}
```

## FILE: `src/components/location-gate.tsx`

```tsx
import { LocateFixed, MapPinned } from "lucide-react";
import { CITY_PRESETS } from "@/lib/courts/catalog";
import type { UserLocation } from "@/lib/courts/types";
import { cn } from "@/lib/utils";

interface LocationGateProps {
  onLocated: (loc: UserLocation) => void;
  onPickCity: (loc: UserLocation) => void;
  locating: boolean;
  error?: string | null;
  requestLocation: () => void;
}

export function LocationGate({
  onPickCity,
  locating,
  error,
  requestLocation,
}: LocationGateProps) {
  return (
    <div className="fade-in flex min-h-[70dvh] flex-col justify-between px-1 py-2">
      <div className="pt-6">
        <div className="mb-6 inline-flex size-14 items-center justify-center rounded-2xl border border-border bg-bg-elevated shadow-card">
          <MapPinned className="size-6 text-court" strokeWidth={1.5} />
        </div>
        <h1 className="font-display text-[2rem] leading-tight font-semibold tracking-tight text-fg text-balance">
          Outdoor courts in Austin
        </h1>
        <p className="mt-3 max-w-sm text-base leading-relaxed text-fg-muted">
          Public basketball courts across ATX — Zilker, Bartholomew, Circle C,
          and more. Use GPS for exact distance from you.
        </p>
      </div>

      <div className="space-y-6 pb-2">
        <button
          type="button"
          onClick={requestLocation}
          disabled={locating}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 text-[15px] font-semibold text-accent-fg transition-transform active:scale-[0.98] disabled:opacity-70"
          style={{ height: 52 }}
        >
          <LocateFixed className="size-5" strokeWidth={1.75} />
          {locating ? "Finding you…" : "Use my location"}
        </button>

        <button
          type="button"
          onClick={() =>
            onPickCity({
              lat: 30.2672,
              lon: -97.7431,
              label: "Austin, TX",
            })
          }
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border-strong bg-bg-elevated px-5 text-sm font-medium text-fg transition-colors hover:bg-bg-subtle"
          style={{ height: 48 }}
        >
          Browse Austin courts
        </button>

        {error && (
          <p className="text-center text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div>
          <p className="mb-3 text-xs font-medium tracking-wide text-fg-subtle uppercase">
            Or another city
          </p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {CITY_PRESETS.map((city) => {
              const isAustin = city.id === "atx";
              return (
                <button
                  key={city.id}
                  type="button"
                  onClick={() =>
                    onPickCity({
                      lat: city.lat,
                      lon: city.lon,
                      label: city.id === "atx" ? "Austin, TX" : city.label,
                    })
                  }
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors active:scale-[0.98]",
                    isAustin
                      ? "border-court/40 bg-court/15 text-fg"
                      : "border-border-strong bg-bg-elevated text-fg hover:bg-bg-subtle",
                  )}
                >
                  {city.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
```

## FILE: `src/components/work-order-popup.tsx`

```tsx
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ImagePlus, Wrench, X } from "lucide-react";
import {
  useCourtSocial,
  WORK_ORDER_LABELS,
  type WorkOrderKind,
} from "@/lib/courts/social";
import { cn } from "@/lib/utils";

const OPTIONS: { id: WorkOrderKind; label: string }[] = [
  { id: "broken_rim", label: WORK_ORDER_LABELS.broken_rim },
  { id: "replace_net", label: WORK_ORDER_LABELS.replace_net },
  { id: "other", label: WORK_ORDER_LABELS.other },
];

/** Compress for localStorage-friendly work-order photos */
export async function compressWorkOrderPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1280;
  let { width, height } = bitmap;
  if (width > max || height > max) {
    const scale = max / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.72);
}

/**
 * Quick work-order sheet — used from court cards without opening full detail.
 */
export function WorkOrderPopup({
  courtId,
  courtName,
  open,
  onClose,
}: {
  courtId: string;
  courtName: string;
  open: boolean;
  onClose: () => void;
}) {
  const social = useCourtSocial();
  const [kind, setKind] = useState<WorkOrderKind>("broken_rim");
  const [other, setOther] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  if (!open || typeof document === "undefined") return null;

  const onPick = async (files: FileList | File[] | null) => {
    const list = files
      ? Array.from(files).filter((f) => f.type.startsWith("image/"))
      : [];
    if (!list.length) return;
    setPicking(true);
    setMsg(null);
    try {
      const urls: string[] = [];
      for (const f of list) {
        urls.push(await compressWorkOrderPhoto(f));
      }
      setPhotos((prev) => [...prev, ...urls]);
    } catch {
      setMsg("Couldn’t read one of those photos — try again.");
    } finally {
      setPicking(false);
    }
  };

  const submit = () => {
    if (kind === "other" && !other.trim()) {
      setMsg("Please describe the issue.");
      return;
    }
    setSubmitting(true);
    social.addWorkOrder(courtId, kind, kind === "other" ? other : undefined, {
      courtName,
      reporter: "You",
      photos: photos.length ? photos : undefined,
      photoUrl: photos[0],
    });
    setMsg("Work order submitted — parks staff will review.");
    setOther("");
    setKind("broken_rim");
    setPhotos([]);
    setSubmitting(false);
    window.setTimeout(() => {
      setMsg(null);
      onClose();
    }, 1400);
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="wo-quick-title"
        className="slide-up relative z-10 max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-bg-elevated p-4 shadow-soft sm:rounded-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-wide text-court uppercase">
              Work order
            </p>
            <h3
              id="wo-quick-title"
              className="truncate font-display text-base font-semibold text-fg"
            >
              {courtName}
            </h3>
            <p className="mt-0.5 text-xs text-fg-muted">
              Report an issue with this court
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-fg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setKind(opt.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors",
                kind === opt.id
                  ? "border-court bg-court-soft text-fg"
                  : "border-border bg-bg-subtle text-fg-muted",
              )}
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                  kind === opt.id ? "border-court bg-court" : "border-border",
                )}
              >
                {kind === opt.id ? (
                  <span className="size-1.5 rounded-full bg-white" />
                ) : null}
              </span>
              {opt.label}
            </button>
          ))}
        </div>

        {kind === "other" ? (
          <textarea
            value={other}
            onChange={(e) => setOther(e.target.value)}
            rows={3}
            placeholder="Describe the issue…"
            className="mt-3 w-full resize-none rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg outline-none focus:border-court"
          />
        ) : null}

        {/* Photos — multi-select from library; camera still one shot at a time */}
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-semibold text-fg-muted">
            Photos (optional) · select many from your computer
          </p>
          {photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((src, i) => (
                <div
                  key={`${i}-${src.slice(0, 20)}`}
                  className="relative aspect-square overflow-hidden rounded-lg border border-border"
                >
                  <img src={src} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() =>
                      setPhotos((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="absolute top-1 right-1 rounded-full bg-black/55 p-1 text-white"
                    aria-label="Remove photo"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2">
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                void onPick(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={libraryRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void onPick(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={picking}
              onClick={() => cameraRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-subtle py-2.5 text-xs font-semibold text-fg disabled:opacity-60"
            >
              <Camera className="size-3.5" strokeWidth={2} />
              Take photo
            </button>
            <button
              type="button"
              disabled={picking}
              onClick={() => libraryRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-subtle py-2.5 text-xs font-semibold text-fg disabled:opacity-60"
            >
              <ImagePlus className="size-3.5" strokeWidth={2} />
              {photos.length ? "Add more" : "Upload"}
            </button>
          </div>
        </div>

        {msg ? (
          <p className="mt-3 text-center text-xs font-medium text-court" role="status">
            {msg}
          </p>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={submitting || picking}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-fg text-sm font-semibold text-bg active:scale-[0.99] disabled:opacity-60"
        >
          <Wrench className="size-4" strokeWidth={2} />
          Submit work order
        </button>
      </div>
    </div>,
    document.body,
  );
}
```

## FILE: `src/lib/auth/admin.ts`

```ts
/** Only this Google / email identity gets admin (work orders, court editor). */
export const ADMIN_EMAIL = "seanvoss23@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
```

## FILE: `src/lib/auth/client.ts`

```ts
import { genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { GROK_PROVIDERS } from "./providers";

/**
 * Better Auth client for this React SPA (browser-side).
 *
 * Talks to this app's OWN Better Auth at same-origin `/api/auth/*`. In the live
 * preview the app is an embedded iframe with PARTITIONED cookies, so after a
 * popup sign-in it can't read the session cookie — it authenticates with a
 * bearer token instead (captured from the popup, see `signIn`). The `onRequest`
 * hook attaches that token when present; when deployed (cookie auth) no token
 * is stored, so nothing changes.
 */
export const authClient = createAuthClient({
  plugins: [genericOAuthClient()],
  fetchOptions: {
    onRequest(ctx) {
      const token = getBearerToken();
      if (token) ctx.headers.set("Authorization", `Bearer ${token}`);
      return ctx;
    },
  },
});

/**
 * True when sign-in UI should be shown. On by default (preview via the baked
 * preview client, deployed apps via the injected per-app client); set
 * `VITE_AUTH_ENABLED=false` to force it off (dev user — see `use-current-user`).
 */
export const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";

/** The upstream providers to render sign-in buttons for. */
export { GROK_PROVIDERS };

// ── Live-preview bearer token ────────────────────────────────────────────────
// The embedded preview iframe has partitioned cookies, so we keep the session's
// bearer token in sessionStorage and attach it to every Better Auth request (and
// to server functions, via `@/lib/auth/middleware`). Empty everywhere except the
// preview after a popup sign-in, so the cookie path is untouched elsewhere.
const BEARER_KEY = "grok-auth.bearer-token";

/** The stored preview bearer token, or null. */
export function getBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(BEARER_KEY);
  } catch {
    return null;
  }
}

function setBearerToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.sessionStorage.setItem(BEARER_KEY, token);
    else window.sessionStorage.removeItem(BEARER_KEY);
  } catch {
    /* storage unavailable — ignore */
  }
}

/**
 * The sandbox live preview runs this app inside an iframe on a `*.grok-sandbox.com`
 * host, where a full-page redirect to the broker can't work — so sign-in uses a
 * popup there and a normal redirect everywhere else.
 */
function inLivePreview(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".grok-sandbox.com")
  );
}

/** Message the popup posts back to the opener once sign-in completes. */
type PopupMessage = { source: "grok-auth-popup"; token: string | null; error?: string };

/**
 * Start sign-in with one upstream provider (`providerId` from `GROK_PROVIDERS`),
 * federating through the Grok auth broker.
 *
 * - **Live preview** (`*.grok-sandbox.com` iframe): opens a POPUP to
 *   `/auth/popup`, served by the template Vite plugin (see `vite.config.ts` +
 *   `popup.server.ts`) — 302s to the broker/upstream login (no app chrome) and,
 *   on return, posts the session bearer token back. We store it and refresh the
 *   session; no top-level navigation of the iframe to the broker.
 * - **Deployed** (and local non-iframe): a normal full-page redirect into the broker.
 *
 * Either way it clears any existing local session FIRST so switching providers
 * actually switches identity.
 */
export async function signIn(
  providerId: string,
  opts: { callbackURL?: string; errorCallbackURL?: string } = {},
): Promise<void> {
  const callbackURL = opts.callbackURL ?? "/";
  const errorCallbackURL = opts.errorCallbackURL ?? "/";

  // Open the popup SYNCHRONOUSLY on the user gesture — before any await
  // (including signOut). Awaiting first drops user-gesture privilege in some
  // browsers when the opener is a cross-origin live-preview iframe.
  const popup = inLivePreview() ? openSignInPopup(providerId) : null;

  // Clear any prior session so switching providers actually switches identity.
  // In the live preview the iframe has no session cookie — only a bearer token —
  // so skip the network signOut when there's nothing to clear.
  const hadBearer = Boolean(getBearerToken());
  if (hadBearer || !inLivePreview()) {
    try {
      await authClient.signOut();
    } catch {
      // No active session (or a transient sign-out error) — proceed to sign in.
    }
  }
  setBearerToken(null);

  if (inLivePreview()) {
    if (!popup) throw new Error("Pop-up blocked — allow pop-ups for sign-in");
    const token = await waitForPopupToken(popup);
    if (!token) throw new Error("Sign-in was cancelled or failed");
    setBearerToken(token);
    // Refresh the client session store with the bearer attached (onRequest).
    // Avoid a full iframe reload when we're already on the destination — that
    // reload was the slow "still loading after the popup closed" feeling.
    try {
      await authClient.getSession();
    } catch {
      /* session store will recover on next useSession fetch */
    }
    if (typeof window !== "undefined") {
      const dest = new URL(callbackURL, window.location.origin);
      const here = window.location;
      if (dest.origin !== here.origin || dest.pathname !== here.pathname || dest.search !== here.search) {
        window.location.href = callbackURL;
      }
    }
    return;
  }

  const { data, error } = await authClient.signIn.oauth2({
    providerId,
    callbackURL,
    errorCallbackURL,
  });
  if (error) throw new Error(error.message ?? "Sign-in failed");
  if (data?.url) window.location.href = data.url;
}

/**
 * Open `/auth/popup` in a new window. Must run synchronously inside the click
 * handler (no await before this). The path is served by the template Vite
 * plugin (`authPopupPlugin` in vite.config.ts) — NOT by a React route.
 *
 * Opens the real URL directly (not about:blank → assign). From a cross-origin
 * iframe the about:blank dance often fails on the first click and the window
 * ends up showing the app shell.
 */
function openSignInPopup(providerId: string): Window | null {
  const origin = window.location.origin;
  const url = `${origin}/auth/popup?providerId=${encodeURIComponent(providerId)}`;
  // Unique name per attempt so a prior attempt stuck on the SPA is not reused.
  const name = `grok-signin-${Date.now()}`;
  return window.open(url, name, "popup,width=500,height=650");
}

/**
 * Wait for the popup's completion page to postMessage the session bearer (or
 * for the user to dismiss the popup).
 */
function waitForPopupToken(popup: Window): Promise<string | null> {
  return new Promise((resolve) => {
    const origin = window.location.origin;
    let settled = false;
    let closeTimer: number | undefined;
    const settle = (token: string | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(token);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const data = event.data as PopupMessage | undefined;
      if (!data || data.source !== "grok-auth-popup") return;
      settle(data.token ?? null);
    };
    // Fallback when the user dismisses the popup. Grace period lets the
    // completion page's postMessage win over a racing `popup.closed`.
    const pollTimer = window.setInterval(() => {
      if (!popup.closed) return;
      window.clearInterval(pollTimer);
      closeTimer = window.setTimeout(() => settle(null), 400);
    }, 300);
    function cleanup() {
      window.clearInterval(pollTimer);
      if (closeTimer !== undefined) window.clearTimeout(closeTimer);
      window.removeEventListener("message", onMessage);
    }
    window.addEventListener("message", onMessage);
  });
}

/** Sign out of THIS app's local session, clear the preview token, then redirect. */
export async function signOut(redirectTo = "/"): Promise<void> {
  try {
    await authClient.signOut();
  } finally {
    setBearerToken(null);
  }
  window.location.href = redirectTo;
}
```

## FILE: `src/lib/auth/email-password.ts`

```ts
/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * Off by default. To enable: set `emailAndPasswordEnabled` to `true` below,
 * then build sign-up / sign-in forms with `authClient.signUp.email` /
 * `authClient.signIn.email` from `@/lib/auth/client` (see the auth skill).
 *
 * Do NOT edit `server.ts` for this — that file is frozen pre-wired config.
 */
export const emailAndPasswordEnabled = true;
```

## FILE: `src/lib/auth/gates.tsx`

```tsx
import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { authEnabled, signOut } from "./client";
import { useCurrentUser, useCurrentUserState } from "./use-current-user";

/**
 * Auth state components — plain wrappers around `useCurrentUserState()`.
 *
 * Auth is ON by default (including the sandbox live preview, which does real
 * sign-in). Visitors are signed out until they authenticate. The shared dev
 * user only appears when auth is explicitly disabled (`VITE_AUTH_ENABLED=false`).
 * While the session is still resolving, gates that care about signed-out state
 * render nothing so there's no signed-out flash on hard reload.
 */

/** Where `RedirectToSignIn` sends signed-out visitors. Create this route. */
export const SIGN_IN_PATH = "/login";

/** Render children only when a user is present (real session, or the disabled-auth dev user). */
export function SignedIn({ children }: { children: ReactNode }) {
  const { user } = useCurrentUserState();
  return user ? <>{children}</> : null;
}

/**
 * Render children only once we KNOW the visitor is signed out (`isPending` has
 * cleared and there is no user). Hidden while the session is still loading.
 */
export function SignedOut({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending || user) return null;
  return <>{children}</>;
}

/**
 * Client-side redirect to the sign-in route (TanStack `<Navigate>` — NOT a full
 * `window.location` reload). A hard navigation re-bootstraps the SPA and re-runs
 * session loading, which feels like a second "Loading…" on /login.
 *
 * Guard routes by waiting out `isPending` first (see `use-current-user`), then
 * render this.
 */
export function RedirectToSignIn({ to = SIGN_IN_PATH }: { to?: string }) {
  return <Navigate to={to} />;
}

/**
 * Minimal signed-in identity chip + sign-out. Restyle freely (see the
 * `design-ui` skill). Sign-out is only shown when auth is enabled (the
 * disabled-auth dev user has nothing to sign out of).
 */
export function UserButton() {
  const user = useCurrentUser();
  if (!user) return null;
  const label = user.displayName ?? user.primaryEmail ?? "Account";
  return (
    <div className="flex items-center gap-2">
      {user.profileImageUrl ? (
        <img
          src={user.profileImageUrl}
          alt=""
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-full bg-black/10 text-sm font-medium dark:bg-white/20">
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="text-sm font-medium">{label}</span>
      {authEnabled && (
        <button
          type="button"
          onClick={() => void signOut()}
          className="cursor-pointer text-sm underline-offset-4 opacity-70 hover:underline"
        >
          Sign out
        </button>
      )}
    </div>
  );
}
```

## FILE: `src/lib/auth/isolation.server.ts`

```ts
import { getRequest } from "@tanstack/react-start/server";

/**
 * Fetch-Metadata sibling isolation — **server-only** (`.server.ts` suffix).
 *
 * MUST keep the `.server` suffix: this file imports `@tanstack/react-start/server`
 * (`getRequest` → Node `AsyncLocalStorage`). If it is imported from a dual
 * client/server module under a non-`.server` name, Vite ships it to the browser
 * and the app dies with: `AsyncLocalStorage is not a constructor`.
 *
 * Apps deployed on `*.grok.me` are "same-site" to each other but MUTUALLY
 * UNTRUSTED, and a `SameSite=Lax` session cookie IS sent on same-site
 * subrequests — so without this, a malicious sibling could make a SCRIPTED
 * (fetch/XHR/form-POST) request to this app's server functions and ride this
 * app's session cookie.
 *
 * We allow only: same-origin requests (this app's own client), non-browser
 * requests (SSR / server-to-server, which send no `Sec-Fetch-Site`), and
 * top-level GET navigations (how the OAuth callback and normal page loads
 * arrive). Every cross-site / same-site *scripted* request is rejected.
 * Together with `__Host-` cookies and Better Auth's `trustedOrigins`, this
 * closes the sibling-tenant attack surface. Enforced at the `authMiddleware`
 * chokepoint (see `middleware.ts`).
 */
export class CrossSiteRequestError extends Error {
  readonly status = 403;
  constructor() {
    super("Forbidden: cross-site request blocked");
    this.name = "CrossSiteRequestError";
  }
}

/** Throw `CrossSiteRequestError` for a scripted cross-site/sibling request. */
export function assertSameSiteRequest(): void {
  const request = getRequest();
  if (!request) return; // no request context (e.g. build) — nothing to guard
  const h = request.headers;
  const site = h.get("sec-fetch-site");
  // Non-browser client (no header), the app's own origin, or a direct
  // (address-bar/bookmark) load are all fine.
  if (!site || site === "same-origin" || site === "none") return;
  // A top-level GET navigation (e.g. the broker's OAuth callback redirect) is
  // fine even when it's cross-site; scripted requests never set navigate mode.
  const dest = h.get("sec-fetch-dest");
  const isTopLevelGet =
    h.get("sec-fetch-mode") === "navigate" &&
    request.method === "GET" &&
    dest !== "object" &&
    dest !== "embed";
  if (isTopLevelGet) return;
  throw new CrossSiteRequestError();
}
```

## FILE: `src/lib/auth/middleware.ts`

```ts
import { createMiddleware } from "@tanstack/react-start";

/**
 * Auth middleware for server functions — the standard way to get the caller's
 * verified user id. When deployed the session cookie is same-origin and rides
 * along automatically. In the live preview the client also forwards the bearer
 * token (partitioned cookies) via the `.client` hook below — call sites do not
 * thread it themselves.
 *
 *   import { createServerFn } from "@tanstack/react-start";
 *   import { getSql } from "@/lib/db";
 *   import { authMiddleware } from "@/lib/auth/middleware";
 *
 *   export const listTodos = createServerFn({ method: "GET" })
 *     .middleware([authMiddleware])
 *     .handler(async ({ context }) => {
 *       const sql = await getSql();
 *       return sql`select * from todos where user_id = ${context.userId}`;
 *     });
 *
 * Signed out (auth on — the default, including live preview) -> throws
 * `UnauthorizedError` (see `verify.server.ts`). Only when auth is explicitly
 * disabled (`VITE_AUTH_ENABLED=false`) does it resolve the shared dev user and
 * never throw. Use it on every server function that touches per-user data, and
 * scope every query by `context.userId`.
 */
export const authMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    // Live preview (partitioned iframe): the session rides a bearer token, not a
    // cookie, so forward it to the server. Null when deployed (cookie auth), so
    // this is a no-op there.
    const { getBearerToken } = await import("./client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    // ONLY import `*.server` modules here. This file is dual client/server
    // (bearer hook on the client). A plain `./isolation` path was renamed to
    // `isolation.server.ts` — keep this import in sync so image `tsc` resolves
    // it, and so Vite does not ship `@tanstack/react-start/server` to the browser.
    const { assertSameSiteRequest } = await import("./isolation.server");
    const { requireUserId } = await import("./verify.server");
    // Reject scripted cross-site/sibling requests before touching per-user data.
    assertSameSiteRequest();
    const userId = await requireUserId(context.bearerToken);
    return next({ context: { userId } });
  });
```

## FILE: `src/lib/auth/pglite-dialect.ts`

```ts
/**
 * Kysely dialect for Better Auth over the app's embedded PGLite instance.
 * Lazy: resolves `getClient` on first connection so migrations can finish first.
 */
import type { PGlite } from "@electric-sql/pglite";
import {
  CompiledQuery,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type Driver,
  type Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type QueryCompiler,
  type QueryResult,
  type TransactionSettings,
} from "kysely";

type Client = PGlite;

/** Factory used by `auth/server.ts`: `pgliteDialect(() => getPglite())`. */
export function pgliteDialect(
  getClient: () => Promise<Client> | Client,
): Dialect {
  return {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new LazyPGliteDriver(getClient),
    createQueryCompiler: (): QueryCompiler => new PostgresQueryCompiler(),
    createIntrospector: (db: Kysely<unknown>): DatabaseIntrospector =>
      new PostgresIntrospector(db),
  };
}

class LazyPGliteDriver implements Driver {
  private client: Client | undefined;
  private connection: PGliteConnection | undefined;
  private queue: Array<(con: PGliteConnection) => void> = [];

  constructor(private readonly getClient: () => Promise<Client> | Client) {}

  async init(): Promise<void> {
    this.client = await this.getClient();
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    if (this.client === undefined) {
      this.client = await this.getClient();
    }
    if (this.connection !== undefined) {
      return new Promise((resolve) => {
        this.queue.push(resolve);
      });
    }
    this.connection = new PGliteConnection(this.client);
    return this.connection;
  }

  async releaseConnection(connection: DatabaseConnection): Promise<void> {
    if (connection !== this.connection) {
      throw new Error("Invalid connection");
    }
    const next = this.queue.shift();
    if (next === undefined) {
      this.connection = undefined;
      return;
    }
    next(this.connection);
  }

  async beginTransaction(
    conn: DatabaseConnection,
    settings: TransactionSettings,
  ): Promise<void> {
    const c = conn as PGliteConnection;
    if (settings.isolationLevel) {
      await c.executeQuery(
        CompiledQuery.raw(
          `start transaction isolation level ${settings.isolationLevel}`,
        ),
      );
    } else {
      await c.executeQuery(CompiledQuery.raw("begin"));
    }
  }

  async commitTransaction(conn: DatabaseConnection): Promise<void> {
    await (conn as PGliteConnection).executeQuery(CompiledQuery.raw("commit"));
  }

  async rollbackTransaction(conn: DatabaseConnection): Promise<void> {
    await (conn as PGliteConnection).executeQuery(
      CompiledQuery.raw("rollback"),
    );
  }

  async destroy(): Promise<void> {
    // Do not close the client: it is the shared getPglite() singleton used by
    // app SQL (getSql). Only drop our local handle so auth teardown cannot
    // poison the rest of the process.
    this.client = undefined;
    this.connection = undefined;
    this.queue = [];
  }
}

class PGliteConnection implements DatabaseConnection {
  constructor(private readonly client: Client) {}

  async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const result = await this.client.query(compiledQuery.sql, [
      ...compiledQuery.parameters,
    ]);
    if (result.affectedRows) {
      return {
        numAffectedRows: BigInt(result.affectedRows),
        rows: result.rows as O[],
      };
    }
    return { rows: result.rows as O[] };
  }

  async *streamQuery<O>(
    compiledQuery: CompiledQuery,
    chunkSize: number,
  ): AsyncIterableIterator<QueryResult<O>> {
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
      throw new Error("chunkSize must be a positive integer");
    }
    const result = await this.client.query(compiledQuery.sql, [
      ...compiledQuery.parameters,
    ]);
    for (let i = 0; i < result.rows.length; i += chunkSize) {
      yield { rows: result.rows.slice(i, i + chunkSize) as O[] };
    }
  }
}
```

## FILE: `src/lib/auth/popup.server.ts`

```ts
/**
 * Live-preview sign-in popup — server-only (NEVER import from the client).
 *
 * The sandbox preview runs the app in a partitioned iframe, so OAuth must happen
 * in a top-level popup (first-party cookies). This handler is the ENTIRE popup
 * document — no React shell:
 *
 *   Phase 1 (`?providerId=…`): start OAuth server-side and 302 straight to the
 *     broker / upstream login page. The popup never paints the app.
 *   Phase 2 (`?done=1`): after the broker round-trip, emit a tiny HTML page that
 *     posts the session token to the opener and closes. No SPA hydrate, no
 *     server-fn round-trip.
 *
 * Wired automatically by the Vite `authPopupPlugin` in `vite.config.ts` during
 * `npm run dev` (live preview). Do NOT create `src/routes/auth/popup.tsx` — a
 * React route here paints the full app shell in the popup. The opener lives in
 * `client.ts` (`signIn` → `openSignInPopup`).
 */
import { auth, SESSION_TOKEN_COOKIE } from "./server";

/** Message shape the popup posts to the opener (must match `client.ts`). */
type PopupMessage = {
  source: "grok-auth-popup";
  token: string | null;
  error?: string;
};

/**
 * Handle `GET /auth/popup`. Invoked by the Vite `authPopupPlugin` (dev / live
 * preview). Do not re-export this from a React route file.
 */
export async function handleAuthPopupRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const done = url.searchParams.get("done") === "1";

  if (done) {
    const errored = url.searchParams.has("error");
    const token = errored ? null : readCookie(request, SESSION_TOKEN_COOKIE);
    const message: PopupMessage = {
      source: "grok-auth-popup",
      token,
      ...(errored ? { error: url.searchParams.get("error") ?? "sign_in_failed" } : {}),
    };
    return new Response(completionHtml(message), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        // Never cache a page that embeds a session token.
        "cache-control": "no-store",
      },
    });
  }

  const providerId = url.searchParams.get("providerId")?.trim();
  if (!providerId) {
    return new Response("Missing providerId", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // Stay first-party for the callback so the session cookie lands in THIS popup.
  const back = `${url.origin}/auth/popup?done=1`;
  try {
    const apiRes = await auth.api.signInWithOAuth2({
      body: {
        providerId,
        callbackURL: back,
        errorCallbackURL: `${back}&error=1`,
      },
      // Forward the preview host so Better Auth derives the correct baseURL /
      // redirect_uri for the dynamic `*.grok-sandbox.com` origin.
      headers: request.headers,
      asResponse: true,
    });

    if (!apiRes.ok) {
      const detail = await apiRes.text().catch(() => "");
      return completionResponse({
        source: "grok-auth-popup",
        token: null,
        error: detail || `oauth_init_failed_${apiRes.status}`,
      });
    }

    const body = (await apiRes.json().catch(() => null)) as {
      url?: string;
    } | null;
    const location = body?.url;
    if (!location) {
      return completionResponse({
        source: "grok-auth-popup",
        token: null,
        error: "oauth_init_missing_url",
      });
    }

    // 302 to the broker (which headlessly forwards to Google/X). Forward any
    // Set-Cookie (OAuth state / PKCE) so the callback can complete in this popup.
    const headers = new Headers({ location, "cache-control": "no-store" });
    for (const cookie of apiRes.headers.getSetCookie()) {
      headers.append("set-cookie", cookie);
    }
    return new Response(null, { status: 302, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "oauth_init_threw";
    return completionResponse({
      source: "grok-auth-popup",
      token: null,
      error: message,
    });
  }
}

function completionResponse(message: PopupMessage): Response {
  return new Response(completionHtml(message), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/** Minimal HTML: postMessage the token to the opener and close. No React. */
function completionHtml(message: PopupMessage): string {
  // JSON is safe inside a <script type="application/json"> block; the inline
  // script only reads it. Avoids escaping pitfalls of embedding in JS source.
  const payload = JSON.stringify(message).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Signing in…</title>
<style>
  html,body{margin:0;min-height:100%;background:#0b0b0c;color:#a1a1aa;
    font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  main{min-height:100vh;display:grid;place-items:center;padding:1.5rem;text-align:center}
</style>
</head>
<body>
<main><p>Signing you in…</p></main>
<script type="application/json" id="grok-auth-popup-msg">${payload}</script>
<script>
(function () {
  var el = document.getElementById("grok-auth-popup-msg");
  var msg = { source: "grok-auth-popup", token: null };
  try { if (el && el.textContent) msg = JSON.parse(el.textContent); } catch (e) {}
  try {
    if (window.opener) window.opener.postMessage(msg, window.location.origin);
  } catch (e) {}
  try { window.close(); } catch (e) {}
})();
</script>
</body>
</html>`;
}

/** Read a single cookie value from the request (handles `=` inside values). */
function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    const raw = trimmed.slice(eq + 1);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}
```

## FILE: `src/lib/auth/preview.ts`

```ts
/**
 * Shared LIVE-PREVIEW OAuth client (server-only — NEVER import from the client).
 *
 * The sandbox serves each live preview on a dynamic `https://*.grok-sandbox.com`
 * URL, which can't be pre-registered per app. The broker instead exposes ONE
 * shared "preview" client that accepts any
 * `https://*.grok-sandbox.com/api/auth/oauth2/callback/*`
 * (broker: `app-builder-deployer/auth/src/preview-oauth.ts`). Baking it here lets
 * the live preview do REAL sign-in — no demo/mock users — with no platform
 * injection. When deployed the deployer injects a per-app
 * `GROK_AUTH_*` that overrides these (see `server.ts`).
 *
 * These MUST equal the broker's `GROK_PREVIEW_CLIENT_ID` /
 * `GROK_PREVIEW_CLIENT_SECRET` (set in the broker's Vercel env; the broker stores
 * only the secret's `base64url(SHA-256)` hash). This is a dedicated, low-privilege
 * client (preview-only, `*.grok-sandbox.com`) — rotate it by regenerating the
 * broker env var and this constant together.
 */
export const PREVIEW_CLIENT_ID = "grok_preview";
export const PREVIEW_CLIENT_SECRET =
  "8bcdb7fc5a33874ad933ca568918d5790388a0795e44c4d1dea691f801b17ec5";

/** The shared auth broker issuer (OIDC discovery lives under it). */
export const GROK_ISSUER_DEFAULT = "https://auth.grok.me";

/**
 * Host patterns whose callbacks the preview client accepts. Better Auth derives
 * the live preview's real origin from the request host and validates it against
 * this list (wildcard-matched), so the OAuth `redirect_uri` becomes the concrete
 * `https://<preview-host>/api/auth/oauth2/callback/...` the broker allows.
 */
export const PREVIEW_ALLOWED_HOSTS = ["*.grok-sandbox.com"] as const;
```

## FILE: `src/lib/auth/provider.tsx`

```tsx
import type { ReactNode } from "react";

/**
 * App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
 *
 *   <AuthProvider><Outlet /></AuthProvider>
 *
 * Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
 * its `useSession()` works standalone — so this is a passthrough today. It's
 * kept as the single, stable mount point for any future client-side providers
 * (e.g. a toast or theme provider) without churning the root shell.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
```

## FILE: `src/lib/auth/providers.ts`

```ts
/**
 * The upstream identity providers this app offers for sign-in (via the broker).
 *
 * Source of truth for BOTH the server (`server.ts`, one `genericOAuth` provider
 * per entry) and the client (`client.ts` / sign-in buttons). Kept in its own
 * dependency-free module so the client can import it without pulling the
 * server-only Better Auth instance (and `pg`) into the browser bundle.
 *
 * Each app federates to the shared **auth broker** (`GROK_AUTH_ISSUER`), which
 * holds the real Google/X secrets. The app never sees them — it only knows its
 * own per-app client id/secret and which upstream to ask the broker for (`idp`).
 *
 * To add an upstream (e.g. GitHub) once the broker supports it: add one entry
 * here (`{ providerId: "grok-github", idp: "github", label: "GitHub" }`). The
 * `providerId` is this app's local id and the OAuth callback path segment
 * (`/api/auth/oauth2/callback/<providerId>`); `idp` is the hint the broker reads
 * to pick the upstream (Better Auth's id for X is still `twitter`).
 */
export type GrokProvider = {
  /** This app's local provider id; also the callback path segment. */
  providerId: string;
  /** Upstream hint the broker forwards to (Better Auth social id). */
  idp: string;
  /** Human label for the sign-in button. */
  label: string;
};

export const GROK_PROVIDERS: readonly GrokProvider[] = [
  { providerId: "grok-google", idp: "google", label: "Google" },
  { providerId: "grok-x", idp: "twitter", label: "X" },
];
```

## FILE: `src/lib/auth/server.ts`

```ts
/**
 * Self-hosted Better Auth for THIS app (server-only).
 *
 * Pre-wired for live preview + deploy — do not rewrite this file. To enable
 * local email/password, flip the flag in `./email-password` only (see auth skill).
 *
 * The app runs its own Better Auth at `/api/auth/*`, so the session cookie stays
 * on this app's own origin. Sign-in federates to the shared **Grok auth broker**
 * (`GROK_AUTH_ISSUER`) via the `genericOAuth` plugin — the broker brokers the
 * upstream sign-in methods (Google, X, …) and holds their shared secrets; this
 * app only holds its own client id/secret and names the upstream it wants via
 * each provider's `idp` hint.
 *
 * Tri-mode:
 *   - Deployed: the deployer injects a per-app `GROK_AUTH_*` + `BETTER_AUTH_URL`
 *     + `DATABASE_URL`, so real federated auth is persisted in Postgres.
 *   - Sandbox live preview: no injection -> falls back to the shared **preview
 *     client** (`./preview`) and derives the preview's `https://*.grok-sandbox.com`
 *     origin from the request, so real sign-in works (no demo users). Sessions
 *     and identities persist in the embedded PGLite DB (same DB as app data);
 *     the process restart wipes both. Live-preview iframe clients use a bearer
 *     token (partitioned cookies) — see `client.ts`.
 *   - Explicitly off (`VITE_AUTH_ENABLED=false`): no providers; per-user server
 *     functions fall back to a dev user (see `verify.server.ts`).
 *
 * NEVER import this from client code — it pulls in `pg` + the preview secret +
 * server-only Better Auth internals. The client uses `@/lib/auth/client`;
 * components read the user via `@/lib/auth/use-current-user`; server functions get
 * a verified id via `@/lib/auth/middleware`.
 */
import { betterAuth } from "better-auth";
import { bearer, genericOAuth } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { ensureDbReady, getPglite } from "../db";
import { emailAndPasswordEnabled } from "./email-password";
import { GROK_PROVIDERS } from "./providers";
import { pgliteDialect } from "./pglite-dialect";
import {
  GROK_ISSUER_DEFAULT,
  PREVIEW_ALLOWED_HOSTS,
  PREVIEW_CLIENT_ID,
  PREVIEW_CLIENT_SECRET,
} from "./preview";

// Kick (and share) PGLite bootstrap as soon as the auth server module loads.
void ensureDbReady();

/**
 * Preview secret must outlive module reloads: PGLite (and its session rows) is
 * stored on `globalThis`, so an HMR re-eval of this file must NOT mint a new
 * signing secret or every existing session becomes invalid mid-dev. Process
 * restart clears both the secret and PGLite together.
 */
const globalAuthRef = globalThis as typeof globalThis & {
  __grokAuthPreviewSecret__?: string;
};
function previewAuthSecret(): string {
  globalAuthRef.__grokAuthPreviewSecret__ ??= randomBytes(32).toString("hex");
  return globalAuthRef.__grokAuthPreviewSecret__;
}

/** Read an env var, treating empty/whitespace as unset. */
const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

// Explicit off-switch. The deployer sets `VITE_AUTH_ENABLED=true` when it
// provisions auth; set it to "false" to force auth off everywhere (dev user).
const authDisabled = env("VITE_AUTH_ENABLED") === "false";

// Broker federation creds: the deployer injects a per-app client when deployed;
// otherwise fall back to the shared live-preview client, which the broker accepts
// for any `*.grok-sandbox.com` callback (see `./preview`).
const grokIssuer = env("GROK_AUTH_ISSUER") ?? GROK_ISSUER_DEFAULT;
const grokClientId = env("GROK_AUTH_CLIENT_ID") ?? PREVIEW_CLIENT_ID;
const grokClientSecret = env("GROK_AUTH_CLIENT_SECRET") ?? PREVIEW_CLIENT_SECRET;

/** True when federated sign-in is active (real auth is enforced). */
export const authConfigured =
  !authDisabled && Boolean(grokClientId && grokClientSecret);

// This app's own Better Auth origin. When deployed the deployer injects the
// public URL. In the sandbox live preview there's no fixed URL (each preview gets
// a dynamic `*.grok-sandbox.com` host), so we hand Better Auth a dynamic baseURL:
// it derives the origin per-request from the (proxied) host, validated against the
// preview allowlist, which makes the OAuth `redirect_uri` the concrete preview URL
// the broker's preview client accepts.
const explicitBaseURL = env("BETTER_AUTH_URL");
// Explicit `string[]` (not a readonly tuple) — Better Auth's DynamicBaseURLConfig
// requires a mutable `allowedHosts: string[]`.
const previewAllowedHosts: string[] = [...PREVIEW_ALLOWED_HOSTS];
// Local `npm run dev` (port 8080 contract). Browsers may send Origin as any of
// these for the same server — trusting only `localhost` rejects `127.0.0.1` and
// breaks email/password with "Invalid origin".
const LOCAL_DEV_ORIGINS: string[] = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
];
const baseURL = explicitBaseURL ?? {
  // Include loopback hosts so dynamic baseURL resolves for local email/password
  // (not only the preview wildcard).
  allowedHosts: [...previewAllowedHosts, "localhost", "127.0.0.1", "[::1]"],
  // `auto` → trust both http:// and https:// expansions of allowedHosts
  // (preview is https; local dev is http).
  protocol: "auto" as const,
  fallback: "http://localhost:8080",
};

// Origins Better Auth accepts on credentialed POSTs (sign-up/sign-in, etc.).
// Missing entries here surface as FORBIDDEN "Invalid origin".
const trustedOrigins: string[] = explicitBaseURL
  ? [explicitBaseURL, ...LOCAL_DEV_ORIGINS]
  : [
      // Host wildcards (matched against Origin's host)
      ...previewAllowedHosts,
      // Full-origin wildcards (matched against Origin)
      ...previewAllowedHosts.flatMap((host) => [`https://${host}`, `http://${host}`]),
      ...LOCAL_DEV_ORIGINS,
    ];

const databaseUrl = env("DATABASE_URL");

// Static broker OAuth endpoints (skip OIDC discovery on every sign-in / callback).
// Discovery would cost an extra network hop to the broker before the popup can
// even redirect to Google/X — the live-preview popup felt stuck on the app for
// that whole round-trip. These paths match the broker's discovery document.
const issuerBase = grokIssuer.replace(/\/+$/, "");
const grokAuthorizationUrl = `${issuerBase}/api/auth/oauth2/authorize`;
const grokTokenUrl = `${issuerBase}/api/auth/oauth2/token`;
const grokUserInfoUrl = `${issuerBase}/api/auth/oauth2/userinfo`;

// Real Postgres when `DATABASE_URL` is set (deployed apps), else the app's
// embedded PGLite (preview) via a Kysely dialect — so Better Auth persists to the
// SAME DB as app data, including email/password users. Both use the Better Auth
// schema from `migrations/0001_auth.sql`.
const database = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

/** Session token cookie name — also read by the live-preview popup completion page. */
export const SESSION_TOKEN_COOKIE = "__Host-grok-auth.session_token";

// Built separately so the `betterAuth({...})` call stays easy to edit without
// breaking brackets (models often trip on the conditional plugin spread).
const grokOAuthPlugin = authConfigured
  ? genericOAuth({
      config: GROK_PROVIDERS.map(({ providerId, idp }) => ({
        providerId,
        clientId: grokClientId as string,
        clientSecret: grokClientSecret as string,
        // Prefer static endpoints over `discoveryUrl` so initiating (and
        // completing) OAuth does not wait on a broker discovery fetch.
        authorizationUrl: grokAuthorizationUrl,
        tokenUrl: grokTokenUrl,
        userInfoUrl: grokUserInfoUrl,
        scopes: ["openid", "profile", "email"],
        // `prompt: "login"` forces the broker to re-authenticate against the
        // upstream on every sign-in instead of silently reusing an existing
        // broker session. Combined with the broker sending Google
        // `prompt=select_account`, the user always gets the account chooser
        // and can pick (or switch) which account to sign in with.
        authorizationUrlParams: { idp, prompt: "login" },
      })),
    })
  : null;

export const auth = betterAuth({
  baseURL,
  // Deployed apps inject BETTER_AUTH_SECRET. Preview: process-stable secret on
  // globalThis so HMR doesn't invalidate PGLite-backed sessions (see above).
  secret: env("BETTER_AUTH_SECRET") ?? previewAuthSecret(),
  database,

  // CSRF / origin check for credentialed auth POSTs (email sign-up/sign-in, …).
  // See `trustedOrigins` construction above — must cover live preview hosts AND
  // local loopback variants, or clients get "Invalid origin".
  trustedOrigins,

  // Encrypt broker-issued OAuth tokens at rest, and treat the broker's upstreams
  // as trusted first-party identities. The broker owns identity and X emails are
  // synthetic/unverified, so WITHOUT this a login can fail with
  // `account_not_linked` (Better Auth refuses to attach an untrusted, unverified
  // identity to an existing user). Google and X carry DISTINCT emails, so this
  // never merges them into one user — they stay separate identities.
  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      trustedProviders: GROK_PROVIDERS.map((p) => p.providerId),
      // X's synthetic email is never "verified", so don't gate linking on the
      // local user's email-verified state.
      requireLocalEmailVerified: false,
    },
  },

  // Cache the session in the short-lived signed `session_data` cookie so reads
  // (incl. the client's `/get-session`) skip the DB — this shrinks the "loading"
  // window and reduces auth flicker. See the `auth` skill for the full
  // flicker-prevention guidance (gate on `isPending`; SSR the session).
  session: { cookieCache: { enabled: true, maxAge: 300 } },

  // Local email/password — toggled only via `./email-password` (not a plugin).
  ...(emailAndPasswordEnabled ? { emailAndPassword: { enabled: true } } : {}),

  // `__Host-` prefixed cookies: the browser REFUSES any same-named cookie that
  // carries a `Domain` attribute, so a sibling `*.grok.me` app cannot "toss" a
  // `Domain=.grok.me` session cookie onto this app. `__Host-` requires Secure +
  // Path=/ + no Domain; Better Auth otherwise uses `__Secure-` (which permits
  // Domain), so we drop its auto prefix (`useSecureCookies: false`) and set
  // Secure + the names ourselves. (Browsers allow Secure cookies on
  // `http://localhost`, so local dev still works.)
  advanced: {
    useSecureCookies: false,
    defaultCookieAttributes: { secure: true, sameSite: "lax", path: "/" },
    cookies: {
      session_token: { name: SESSION_TOKEN_COOKIE },
      session_data: { name: "__Host-grok-auth.session_data" },
      account_data: { name: "__Host-grok-auth.account_data" },
      dont_remember: { name: "__Host-grok-auth.dont_remember" },
    },
  },

  plugins: [
    // One genericOAuth provider per upstream (when auth is on), all federating
    // to the broker with the SAME client and differing only by the `idp` hint.
    ...(grokOAuthPlugin ? [grokOAuthPlugin] : []),

    // Accept `Authorization: Bearer <session-token>` as an alternative to the
    // cookie. Needed for the LIVE PREVIEW: the app runs in an embedded iframe
    // where cookies are partitioned, so after popup sign-in it authenticates with
    // a bearer token instead (see `client.ts` / the `auth` skill). The hook only
    // fires when an Authorization header is present, so the cookie path
    // (deployed apps) is unaffected.
    bearer(),

    // Bridges Better Auth's Set-Cookie into TanStack Start responses. MUST be
    // last so it runs after every other plugin's hooks.
    tanstackStartCookies(),
  ],
});

export function readSessionToken(): string | null {
  return getCookie(SESSION_TOKEN_COOKIE) ?? null;
}

// Re-exported for convenience; the array lives in the dependency-free
// `providers.ts` so the client can import it too.
export { GROK_PROVIDERS } from "./providers";
```

## FILE: `src/lib/auth/use-current-user.ts`

```ts
import { authClient, authEnabled } from "./client";

/** Normalized user shape used across the app, auth on or off. */
export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  /** True when this is the sandbox/dev fallback (auth not configured). */
  isDevFallback: boolean;
};

/**
 * Stable fallback user, used ONLY when auth is explicitly disabled
 * (`VITE_AUTH_ENABLED=false`). By default auth is on — the sandbox live preview
 * does real sign-in via the baked preview client. Its id is
 * `"dev-user"` — the SAME id `verify.server.ts` returns server-side — so per-user
 * rows written in that mode belong to one consistent owner.
 */
export const DEV_USER: AppUser = {
  id: "dev-user",
  displayName: "Dev User",
  primaryEmail: "dev@example.com",
  profileImageUrl: null,
  isDevFallback: true,
};

/** `useCurrentUserState()` result: the user plus the session-loading flag. */
export type CurrentUserState = {
  /** The user — `null` BOTH while the session loads and when signed out. */
  user: AppUser | null;
  /** True while the session is still resolving — don't treat `user: null` as signed out yet. */
  isPending: boolean;
};

/**
 * Current user + loading state. Same behavior in live preview and when deployed:
 *   - Auth enabled (default) -> the real signed-in user; `user` is `null` while
 *                            the session resolves (`isPending: true`) and when
 *                            signed out (`isPending: false`). Session comes from
 *                            Better Auth `useSession()` → `/api/auth/get-session`
 *                            (cookie when deployed; bearer in live preview).
 *   - Auth disabled (`VITE_AUTH_ENABLED=false`) -> `DEV_USER`, never pending.
 *
 * Protect a route by waiting out `isPending` before acting on `user` —
 * redirecting on `user: null` alone bounces signed-in visitors to sign-in on
 * every hard reload:
 *
 *   import { RedirectToSignIn } from "@/lib/auth/gates";
 *   const { user, isPending } = useCurrentUserState();
 *   if (isPending) return null;              // still resolving — don't redirect yet
 *   if (!user) return <RedirectToSignIn />;  // definitely signed out
 *
 * `authEnabled` is a module-level constant fixed at load, so the guarded hook
 * call keeps a stable hook order across every render of a given component.
 */
export function useCurrentUserState(): CurrentUserState {
  if (!authEnabled) return { user: DEV_USER, isPending: false };
  // eslint-disable-next-line react-hooks/rules-of-hooks -- authEnabled is constant for the app's lifetime
  const { data, isPending } = authClient.useSession();
  const user = data?.user;
  return {
    user: user
      ? {
          id: user.id,
          displayName: user.name ?? null,
          primaryEmail: user.email ?? null,
          profileImageUrl: user.image ?? null,
          isDevFallback: false,
        }
      : null,
    isPending,
  };
}

/**
 * Convenience view of `useCurrentUserState().user` for display (e.g.
 * `user?.displayName ?? "Guest"`). NOTE: `null` means *loading OR signed out* —
 * for redirects/guards use `useCurrentUserState()` and check `isPending`.
 */
export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
```

## FILE: `src/lib/auth/verify.server.ts`

```ts
import { getRequest } from "@tanstack/react-start/server";
import { auth, authConfigured } from "./server";

/**
 * Server-side session resolution (server-only).
 *
 * Because this app runs its OWN Better Auth at same-origin `/api/auth/*`, the
 * session cookie is sent with every request to this app — server functions AND
 * SSR loaders included. So we resolve the user straight from the request cookies
 * via `auth.api.getSession` (no client-minted JWT needed). Never trust a
 * client-supplied user id — only the result of this verification.
 */

/** True when a real database is configured server-side. */
const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());

/** Re-export so callers can branch on it without importing `server.ts`. */
export { authConfigured };

if (databaseConfigured && !authConfigured) {
  console.error(
    "[auth] DATABASE_URL is set but auth is disabled (VITE_AUTH_ENABLED=false) " +
      "— requireUserId() will reject every request (fail closed) rather than " +
      "share one dev user on a real database.",
  );
}

/** Dev fallback user id, used only when auth is disabled (VITE_AUTH_ENABLED=false). */
export const DEV_USER_ID = "dev-user";

/**
 * Thrown by `requireUserId` when the caller has no valid session. Carries
 * `status: 401`; the message is a stable contract — match
 * `err.message === "Unauthorized"` client-side to send the visitor to sign-in.
 */
export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export type VerifiedUser = { id: string; email: string | null };

/**
 * Resolve the signed-in user from the current request, or `null` when auth isn't
 * configured / nobody is signed in. Safe to call from server functions and SSR
 * loaders.
 *
 * `bearerToken` is for the LIVE PREVIEW: the app runs in a partitioned iframe
 * whose cookies don't reach the server, so `authMiddleware` forwards the session
 * as a bearer token, which we present as `Authorization: Bearer …` (the `bearer`
 * plugin resolves it). When deployed no token is passed and the cookie is used.
 */
export async function getSessionUser(
  bearerToken?: string,
): Promise<VerifiedUser | null> {
  if (!authConfigured) return null;
  const request = getRequest();
  if (!request) return null;
  let headers = request.headers;
  if (bearerToken) {
    headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${bearerToken}`);
  }
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email ?? null };
}

/**
 * Resolve the current user id for a server function, or throw when unauthorized.
 * Prefer `authMiddleware` (`./middleware`), which calls this for you.
 * - Auth enabled (default) -> the verified session user id; throws
 *   `UnauthorizedError` when signed out. Works in the sandbox preview too (real
 *   sign-in via the baked preview client).
 * - Auth disabled (`VITE_AUTH_ENABLED=false`) + `DATABASE_URL` set -> throw (fail
 *   closed): one shared dev user on a real database would let every visitor
 *   read/write everyone's rows.
 * - Auth disabled + no database -> the shared dev user id.
 */
export async function requireUserId(bearerToken?: string): Promise<string> {
  if (!authConfigured) {
    if (databaseConfigured) {
      throw new Error(
        "Auth is disabled (VITE_AUTH_ENABLED=false) but DATABASE_URL is set — " +
          "refusing to fall back to the shared dev user against a real database.",
      );
    }
    return DEV_USER_ID;
  }
  const user = await getSessionUser(bearerToken);
  if (!user) throw new UnauthorizedError();
  return user.id;
}
```

## FILE: `src/lib/compete/seed.ts`

```ts
import type { Player } from "./types";

/** Seeded Austin 1v1 ladder — demo-quality, local-first. */
export const AUSTIN_PLAYERS: Player[] = [
  {
    id: "p-you",
    name: "You",
    handle: "you",
    city: "Austin",
    heightIn: 72,
    rating: 1520,
    sportsmanship: 4.6,
    wins: 12,
    losses: 8,
    form: 68,
    availability: "available",
    bio: "Looking for clean 1v1 runs after work.",
    hue: 22,
  },
  {
    id: "p-marcus",
    name: "Marcus Hale",
    handle: "mhale",
    city: "Austin",
    heightIn: 76,
    rating: 1840,
    sportsmanship: 4.8,
    wins: 41,
    losses: 14,
    form: 82,
    availability: "available",
    bio: "Post-ups & midrange. Fair fouls only.",
    hue: 198,
  },
  {
    id: "p-jia",
    name: "Jia Nguyen",
    handle: "jia_n",
    city: "Austin",
    heightIn: 68,
    rating: 1710,
    sportsmanship: 5.0,
    wins: 33,
    losses: 19,
    form: 75,
    availability: "available",
    bio: "Handles & threes. Quiet competitor.",
    hue: 280,
  },
  {
    id: "p-devon",
    name: "Devon Brooks",
    handle: "dbrooks",
    city: "Austin",
    heightIn: 79,
    rating: 1960,
    sportsmanship: 4.2,
    wins: 58,
    losses: 22,
    form: 88,
    availability: "busy",
    bio: "Big wing. Prefer 6'3\"+.",
    hue: 12,
  },
  {
    id: "p-cam",
    name: "Cam Ortiz",
    handle: "camo",
    city: "Austin",
    heightIn: 71,
    rating: 1490,
    sportsmanship: 4.5,
    wins: 18,
    losses: 17,
    form: 61,
    availability: "available",
    bio: "Weekend warrior. Bring a ball.",
    hue: 145,
  },
  {
    id: "p-riley",
    name: "Riley Cho",
    handle: "rcho",
    city: "Austin",
    heightIn: 74,
    rating: 1625,
    sportsmanship: 4.9,
    wins: 27,
    losses: 15,
    form: 71,
    availability: "available",
    bio: "Lockdown defense, team-first 1v1.",
    hue: 210,
  },
  {
    id: "p-andre",
    name: "Andre Kline",
    handle: "akline",
    city: "Austin",
    heightIn: 81,
    rating: 2010,
    sportsmanship: 3.9,
    wins: 64,
    losses: 28,
    form: 90,
    availability: "available",
    bio: "Paint monster. Don’t soft-call.",
    hue: 35,
  },
  {
    id: "p-sam",
    name: "Sam Patel",
    handle: "spatel",
    city: "Austin",
    heightIn: 70,
    rating: 1380,
    sportsmanship: 4.7,
    wins: 9,
    losses: 11,
    form: 55,
    availability: "available",
    bio: "Learning the ladder. Fun first.",
    hue: 310,
  },
  {
    id: "p-tess",
    name: "Tess Rivera",
    handle: "tessr",
    city: "Austin",
    heightIn: 67,
    rating: 1580,
    sportsmanship: 4.8,
    wins: 22,
    losses: 16,
    form: 73,
    availability: "busy",
    bio: "Floater game. South Austin parks.",
    hue: 340,
  },
  {
    id: "p-noah",
    name: "Noah Bennett",
    handle: "nben",
    city: "Austin",
    heightIn: 75,
    rating: 1755,
    sportsmanship: 4.4,
    wins: 36,
    losses: 20,
    form: 79,
    availability: "available",
    bio: "Evenings at Zilker / Battle Bend.",
    hue: 170,
  },
  {
    id: "p-lex",
    name: "Lex Morales",
    handle: "lexm",
    city: "Austin",
    heightIn: 73,
    rating: 1660,
    sportsmanship: 4.1,
    wins: 29,
    losses: 24,
    form: 66,
    availability: "offline",
    bio: "Physical ISO ball.",
    hue: 50,
  },
  {
    id: "p-kai",
    name: "Kai Thompson",
    handle: "kait",
    city: "Austin",
    heightIn: 78,
    rating: 1895,
    sportsmanship: 4.6,
    wins: 47,
    losses: 18,
    form: 85,
    availability: "available",
    bio: "Stretch four in a 1v1 suit.",
    hue: 240,
  },
];
```

## FILE: `src/lib/compete/store.ts`

```ts
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AUSTIN_PLAYERS } from "./seed";
import type { CompeteState, GameChallenge, Player } from "./types";

const STORAGE_KEY = "court-compete-v1";

function defaultState(): CompeteState {
  return {
    players: AUSTIN_PLAYERS,
    games: [],
    meId: "p-you",
  };
}

function load(): CompeteState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as CompeteState;
    // Ensure seed players exist; merge by id
    const byId = new Map(parsed.players.map((p) => [p.id, p]));
    for (const p of AUSTIN_PLAYERS) {
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
    return {
      meId: parsed.meId || "p-you",
      players: Array.from(byId.values()),
      games: Array.isArray(parsed.games) ? parsed.games : [],
    };
  } catch {
    return defaultState();
  }
}

let state: CompeteState = defaultState();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

function setState(next: CompeteState | ((prev: CompeteState) => CompeteState)) {
  state = typeof next === "function" ? next(state) : next;
  persist();
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return defaultState();
}

export function useCompeteStore() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // hydrate from localStorage once on client
  useEffect(() => {
    const loaded = load();
    state = loaded;
    emit();
  }, []);

  const me = snap.players.find((p) => p.id === snap.meId) ?? snap.players[0]!;

  const leaderboard = [...snap.players]
    .filter((p) => p.city === "Austin")
    .sort((a, b) => b.rating - a.rating);

  const openGames = snap.games
    .filter((g) => g.status === "open")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const createGame = useCallback(
    (input: Omit<GameChallenge, "id" | "createdAt" | "status" | "hostPlayerId">) => {
      const game: GameChallenge = {
        ...input,
        id: `g-${Date.now().toString(36)}`,
        hostPlayerId: state.meId,
        status: "open",
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({ ...s, games: [game, ...s.games] }));
      return game;
    },
    [],
  );

  const joinGame = useCallback((gameId: string) => {
    setState((s) => ({
      ...s,
      games: s.games.map((g) =>
        g.id === gameId && g.status === "open" && g.hostPlayerId !== s.meId
          ? { ...g, status: "matched", challengerId: s.meId }
          : g,
      ),
    }));
  }, []);

  const cancelGame = useCallback((gameId: string) => {
    setState((s) => ({
      ...s,
      games: s.games.map((g) =>
        g.id === gameId && g.hostPlayerId === s.meId
          ? { ...g, status: "cancelled" }
          : g,
      ),
    }));
  }, []);

  const updateMe = useCallback((patch: Partial<Player>) => {
    setState((s) => ({
      ...s,
      players: s.players.map((p) => (p.id === s.meId ? { ...p, ...patch } : p)),
    }));
  }, []);

  return {
    me,
    players: snap.players,
    games: snap.games,
    openGames,
    leaderboard,
    createGame,
    joinGame,
    cancelGame,
    updateMe,
  };
}

export function playerMatchesFilters(
  player: Player,
  filters: GameChallenge["filters"],
): boolean {
  return (
    player.heightIn >= filters.heightMinIn &&
    player.heightIn <= filters.heightMaxIn &&
    player.rating >= filters.ratingMin &&
    player.rating <= filters.ratingMax &&
    player.sportsmanship >= filters.sportsmanshipMin
  );
}
```

## FILE: `src/lib/compete/types.ts`

```ts
export type Availability =
  | "available"
  | "busy"
  | "offline";

export interface Player {
  id: string;
  name: string;
  handle: string;
  city: string;
  /** Height in total inches (e.g. 74 = 6'2") */
  heightIn: number;
  /** Competitive rating (Elo-style), typically 800–2400 */
  rating: number;
  /** 1.0–5.0 sportsmanship stars */
  sportsmanship: number;
  wins: number;
  losses: number;
  /** 0–100 form / recent form */
  form: number;
  availability: Availability;
  /** Short bio */
  bio?: string;
  /** Avatar color seed */
  hue: number;
}

export interface GameChallenge {
  id: string;
  hostPlayerId: string;
  courtId: string;
  courtName: string;
  lat: number;
  lon: number;
  /** ISO datetime */
  startsAt: string;
  notes?: string;
  /** Match filters set by host */
  filters: {
    heightMinIn: number;
    heightMaxIn: number;
    ratingMin: number;
    ratingMax: number;
    sportsmanshipMin: number;
  };
  status: "open" | "matched" | "completed" | "cancelled";
  challengerId?: string;
  createdAt: string;
}

export interface CompeteState {
  players: Player[];
  games: GameChallenge[];
  /** Local “you” profile id */
  meId: string;
}
```

## FILE: `src/lib/courts/admin-overrides.ts`

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Court, CourtAmenity, CourtSurface } from "@/lib/courts/types";
import { isAdminEmail } from "@/lib/auth/admin";

export interface CourtPhotoState {
  /** Dedicated first image on cards / carousel */
  preview?: string;
  /** Additional gallery images (not including preview) */
  gallery: string[];
}

export interface CourtFieldOverride {
  name?: string;
  address?: string;
  neighborhood?: string;
  notes?: string;
  surface?: CourtSurface;
  hoops?: number;
  amenities?: CourtAmenity[];
  lightsHours?: string;
  hours?: string;
}

export interface CourtAdminOverride extends CourtFieldOverride {
  photos?: CourtPhotoState;
  updatedAt?: string;
}

interface CourtAdminState {
  overrides: Record<string, CourtAdminOverride>;
  setFields: (courtId: string, fields: CourtFieldOverride) => void;
  setPreview: (courtId: string, dataUrl: string | undefined) => void;
  addGalleryPhoto: (courtId: string, dataUrl: string) => void;
  addGalleryPhotos: (courtId: string, dataUrls: string[]) => void;
  replaceGalleryPhoto: (courtId: string, index: number, dataUrl: string) => void;
  removeGalleryPhoto: (courtId: string, index: number) => void;
  setGallery: (courtId: string, gallery: string[]) => void;
  clearOverride: (courtId: string) => void;
}

function patch(
  overrides: Record<string, CourtAdminOverride>,
  courtId: string,
  next: Partial<CourtAdminOverride>,
): Record<string, CourtAdminOverride> {
  const prev = overrides[courtId] ?? {};
  return {
    ...overrides,
    [courtId]: {
      ...prev,
      ...next,
      photos: next.photos ?? prev.photos,
      updatedAt: new Date().toISOString(),
    },
  };
}

export const useCourtAdmin = create<CourtAdminState>()(
  persist(
    (set, get) => ({
      overrides: {},
      setFields: (courtId, fields) =>
        set((s) => ({
          overrides: patch(s.overrides, courtId, fields),
        })),
      setPreview: (courtId, dataUrl) => {
        const prev = get().overrides[courtId]?.photos ?? { gallery: [] };
        set((s) => ({
          overrides: patch(s.overrides, courtId, {
            photos: { ...prev, preview: dataUrl, gallery: prev.gallery ?? [] },
          }),
        }));
      },
      addGalleryPhoto: (courtId, dataUrl) => {
        get().addGalleryPhotos(courtId, [dataUrl]);
      },
      addGalleryPhotos: (courtId, dataUrls) => {
        if (!dataUrls.length) return;
        const prev = get().overrides[courtId]?.photos ?? { gallery: [] };
        set((s) => ({
          overrides: patch(s.overrides, courtId, {
            photos: {
              preview: prev.preview,
              gallery: [...(prev.gallery ?? []), ...dataUrls],
            },
          }),
        }));
      },
      replaceGalleryPhoto: (courtId, index, dataUrl) => {
        const prev = get().overrides[courtId]?.photos ?? { gallery: [] };
        const gallery = [...(prev.gallery ?? [])];
        if (index < 0 || index >= gallery.length) return;
        gallery[index] = dataUrl;
        set((s) => ({
          overrides: patch(s.overrides, courtId, {
            photos: { preview: prev.preview, gallery },
          }),
        }));
      },
      removeGalleryPhoto: (courtId, index) => {
        const prev = get().overrides[courtId]?.photos ?? { gallery: [] };
        const gallery = (prev.gallery ?? []).filter((_, i) => i !== index);
        set((s) => ({
          overrides: patch(s.overrides, courtId, {
            photos: { preview: prev.preview, gallery },
          }),
        }));
      },
      setGallery: (courtId, gallery) => {
        const prev = get().overrides[courtId]?.photos ?? { gallery: [] };
        set((s) => ({
          overrides: patch(s.overrides, courtId, {
            photos: { preview: prev.preview, gallery },
          }),
        }));
      },
      clearOverride: (courtId) =>
        set((s) => {
          const { [courtId]: _, ...rest } = s.overrides;
          return { overrides: rest };
        }),
    }),
    {
      name: "upset-court-admin-v1",
      // Drop huge blobs if storage balloons — keep last-write overrides
      partialize: (s) => ({ overrides: s.overrides }),
    },
  ),
);

export function mergeCourtWithOverride(
  court: Court,
  ov?: CourtAdminOverride,
): Court {
  if (!ov) return court;
  return {
    ...court,
    name: ov.name ?? court.name,
    address: ov.address ?? court.address,
    neighborhood: ov.neighborhood ?? court.neighborhood,
    notes: ov.notes ?? court.notes,
    surface: ov.surface ?? court.surface,
    hoops: ov.hoops ?? court.hoops,
    amenities: ov.amenities ?? court.amenities,
    lightsHours: ov.lightsHours ?? court.lightsHours,
    hours: ov.hours ?? court.hours,
  };
}

export { isAdminEmail };
```

## FILE: `src/lib/courts/catalog.ts`

```ts
import type { Court } from "./types";
import { haversineMeters } from "@/lib/utils";
import { imageIndexFromId } from "./images";

/** Curated public outdoor courts — primary fallback when live map data is rate-limited. */
const CATALOG: Omit<Court, "distanceMeters" | "imageIndex">[] = [
  // ── Austin, TX (home city — dense coverage) ──────────────────────────
  {
    id: "cat-zilker",
    name: "Zilker Park Courts",
    lat: 30.2669,
    lon: -97.7729,
    address: "2100 Barton Springs Rd, Austin, TX",
    surface: "concrete",
    amenities: ["full_court", "parking", "water", "multiple", "shade"],
    source: "catalog",
    neighborhood: "Zilker",
    hoops: 4,
    notes: "The heartbeat of outdoor ball in Austin. Multiple full courts steps from Barton Springs, shade trees around the edges, and a weekend crowd that shows up early. Expect competition and a wait for runs when the weather is good.",
  },
  {
    id: "cat-butler",
    name: "Butler Park Courts",
    lat: 30.2634,
    lon: -97.7525,
    address: "1000 Barton Springs Rd, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking"],
    source: "catalog",
    neighborhood: "Downtown",
    hoops: 2,
    notes: "Auditorium Shores courts with the downtown skyline as your backdrop. Open asphalt, often breezy off the river — solid for evening 1v1s when you want lights and a central meetup.",
  },
  {
    id: "cat-pease",
    name: "Pease Park Courts",
    lat: 30.2819,
    lon: -97.7528,
    address: "1100 Kingsbury St, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "half_court", "water", "shade"],
    source: "catalog",
    neighborhood: "Central",
    hoops: 2,
    notes: "Shaded Lamar corridor gem. Trees take the edge off midday heat, surface is honest asphalt, and the vibe is neighborhood-friendly more than pure streetball. Easy parking nearby.",
  },
  {
    id: "cat-battle-bend",
    name: "Battle Bend Park Courts",
    lat: 30.2258,
    lon: -97.7756,
    address: "5005 Escarpment Blvd, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking", "shade", "fence"],
    source: "catalog",
    neighborhood: "South Austin",
    hoops: 2,
    notes: "South Austin favorite for evening 1v1s. Lit, fenced, and shaded enough to stay playable after work. Quiet weeknights; busier when the weather breaks cool.",
  },
  {
    id: "cat-bartholomew",
    name: "Bartholomew District Park",
    lat: 30.3045,
    lon: -97.6928,
    address: "5201 Berkman Dr, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking", "multiple", "water"],
    source: "catalog",
    neighborhood: "Northeast",
    hoops: 4,
    notes: "Northeast staple with room to run. Multiple hoops, lights for night sessions, and regulars who know the space. Good for hosting when you need a court that can hold a small crowd.",
  },
  {
    id: "cat-reed",
    name: "Reed Park Courts",
    lat: 30.3172,
    lon: -97.7654,
    address: "2614 Pecos St, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "parking", "water", "shade"],
    source: "catalog",
    neighborhood: "Northwest",
    hoops: 2,
    notes: "Northwest neighborhood courts with shade and water. Lower traffic than the big parks — a smart pick when you want a clean 1v1 without hunting for space.",
  },
  {
    id: "cat-ramsey",
    name: "Ramsey Park Courts",
    lat: 30.3278,
    lon: -97.7365,
    address: "4301 Rosedale Ave, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "fence", "shade"],
    source: "catalog",
    neighborhood: "Rosedale",
    hoops: 2,
    notes: "Rosedale-area park courts. Compact, walkable, and usually available for a spontaneous run. Surface is classic city asphalt.",
  },
  {
    id: "cat-zaragoza",
    name: "Parque Zaragoza Courts",
    lat: 30.2589,
    lon: -97.7102,
    address: "2608 Gonzales St, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking", "multiple"],
    source: "catalog",
    neighborhood: "East Austin",
    hoops: 4,
    notes: "East Austin recreation hub. Full court action with regular pickup energy. Expect a mix of ages and skill — bring your A-game or come to work on it.",
  },
  {
    id: "cat-givens",
    name: "Givens District Park",
    lat: 30.2638,
    lon: -97.6935,
    address: "3811 E 12th St, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking", "water"],
    source: "catalog",
    neighborhood: "East Austin",
    hoops: 4,
    notes: "East side district park with real room to play. Multiple hoops, parking, and a community vibe. Reliable for scheduled games when you need a clear landmark.",
  },
  {
    id: "cat-garrison",
    name: "Garrison District Park",
    lat: 30.2185,
    lon: -97.7708,
    address: "6001 Manchaca Rd, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking", "multiple", "shade"],
    source: "catalog",
    neighborhood: "South Austin",
    hoops: 4,
    notes: "South Austin district park courts. Straightforward setup, parking on site, and enough space that two games can coexist without stepping on each other.",
  },
  {
    id: "cat-northwest",
    name: "Northwest District Park",
    lat: 30.3584,
    lon: -97.7389,
    address: "7000 Ardath St, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking", "fence"],
    source: "catalog",
    neighborhood: "Northwest",
    hoops: 4,
    notes: "North-side district park workhorse. Lit courts for after-dark runs, solid parking, and a regular cast of evening players.",
  },
  {
    id: "cat-rosewood",
    name: "Rosewood Park Courts",
    lat: 30.2702,
    lon: -97.7178,
    address: "2300 Rosewood Ave, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking"],
    source: "catalog",
    neighborhood: "East Austin",
    hoops: 2,
    notes: "East Austin classic. Historic park energy with outdoor courts that see steady use. Central enough for people coming from downtown or the east side.",
  },
  {
    id: "cat-eastwoods",
    name: "Eastwoods Park Courts",
    lat: 30.2905,
    lon: -97.7312,
    address: "3001 Harris Park Ave, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "half_court", "shade"],
    source: "catalog",
    neighborhood: "University",
    hoops: 2,
    notes: "Near UT — student traffic is real between classes and after dark. Tree cover around the courts, lively atmosphere, and quick games when the campus is in session.",
  },
  {
    id: "cat-little-stacy",
    name: "Little Stacy Park Courts",
    lat: 30.2468,
    lon: -97.7465,
    address: "1500 Alameda Dr, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "water", "shade"],
    source: "catalog",
    neighborhood: "South Austin",
    hoops: 2,
    notes: "South Austin neighborhood pocket. Smaller footprint, friendly for casual 1v1s, and easy to find once you’re off the main drag.",
  },
  {
    id: "cat-circle-c",
    name: "Circle C Metro Park Courts",
    lat: 30.1889,
    lon: -97.8825,
    address: "6301 W Slaughter Ln, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking", "multiple", "water"],
    source: "catalog",
    neighborhood: "Southwest",
    hoops: 4,
    notes: "Southwest metro park — spacious, well kept, and worth the drive if you live that side of town. Parking is easy; courts feel less cramped than central parks.",
  },
  {
    id: "cat-searight",
    name: "Mary Moore Searight Metro Park",
    lat: 30.1712,
    lon: -97.8256,
    address: "907 W Slaughter Ln, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "parking", "multiple", "water", "shade"],
    source: "catalog",
    neighborhood: "Southwest",
    hoops: 4,
    notes: "Mary Moore Searight metro park courts. Big park energy south of town — good for planned sessions when you want space and a proper facility feel.",
  },
  {
    id: "cat-walnut-creek",
    name: "Walnut Creek Metro Park Courts",
    lat: 30.4068,
    lon: -97.6765,
    address: "12138 N Lamar Blvd, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "parking", "water", "shade"],
    source: "catalog",
    neighborhood: "North Austin",
    hoops: 2,
    notes: "North Austin metro park run. Wide open, multiple options, and lights when you need them. Built for people who want a destination court, not a street corner.",
  },
  {
    id: "cat-dottie-jordan",
    name: "Dottie Jordan Recreation Courts",
    lat: 30.3235,
    lon: -97.6821,
    address: "2803 Loyola Ln, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking", "fence"],
    source: "catalog",
    neighborhood: "Northeast",
    hoops: 2,
    notes: "Northeast recreation courts. Practical, lit, and used by people who live nearby. Low drama place to lock in a rated 1v1.",
  },
  {
    id: "cat-metz",
    name: "Metz Recreation Center Courts",
    lat: 30.2548,
    lon: -97.7205,
    address: "2407 Canterbury St, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking"],
    source: "catalog",
    neighborhood: "East Austin",
    hoops: 2,
    notes: "East Austin recreation center courts. Outdoor hoops with a rec-center backbone — bathrooms and parking close. Solid midweek option.",
  },
  {
    id: "cat-guerrero",
    name: "Roy G. Guerrero Metro Park",
    lat: 30.2435,
    lon: -97.6948,
    address: "400 Grove Blvd, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "parking", "water", "multiple", "shade"],
    source: "catalog",
    neighborhood: "Southeast",
    hoops: 4,
    notes: "Roy G. Guerrero metro park on the southeast side. Big park, full amenities, and courts that can handle a crowd. Plan a little drive time from central Austin.",
  },
  {
    id: "cat-onion-creek",
    name: "Onion Creek Metro Park Courts",
    lat: 30.1456,
    lon: -97.7854,
    address: "7010 S Ih 35 Frontage Rd, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "parking", "water"],
    source: "catalog",
    neighborhood: "South Austin",
    hoops: 2,
    notes: "Far south metro park courts. Quiet relative to Zilker — a calm place to get clean games in without the central city circus.",
  },
  {
    id: "cat-hancock",
    name: "Hancock Recreation Courts",
    lat: 30.2978,
    lon: -97.7225,
    address: "811 E 41st St, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking", "shade"],
    source: "catalog",
    neighborhood: "Central",
    hoops: 2,
    notes: "Central / Hancock area courts. Convenient if you’re mid-city; expect neighborhood traffic more than destination ballers.",
  },
  {
    id: "cat-wooldridge",
    name: "Wooldridge Square Courts",
    lat: 30.2728,
    lon: -97.7456,
    address: "900 Guadalupe St, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "half_court"],
    source: "catalog",
    neighborhood: "Downtown",
    hoops: 2,
    notes: "Downtown square courts — compact and convenient when you’re already central. Not a sprawling facility, but you’ll find the hoop fast.",
  },

  // New York (kept for multi-city)
  {
    id: "cat-west4",
    name: "West 4th Street Courts",
    lat: 40.7312,
    lon: -74.0011,
    address: "Greenwich Village, NY",
    surface: "asphalt",
    amenities: ["full_court", "lights", "fence", "multiple"],
    source: "catalog",
    hoops: 6,
    notes: "The Cage energy on West 4th — iconic streetball destination. Rough edges, real competition, and a reputation that draws people who want to test themselves.",
  },
  {
    id: "cat-bryant",
    name: "Bryant Park Courts",
    lat: 40.7536,
    lon: -73.9832,
    address: "New York, NY",
    surface: "asphalt",
    amenities: ["full_court", "lights", "fence"],
    source: "catalog",
    hoops: 4,
    notes: "Neighborhood park courts with a simple outdoor setup. Use it for a quiet 1v1 when the big parks are slammed.",
  },
  {
    id: "cat-rucker",
    name: "Holcombe Rucker Park",
    lat: 40.8298,
    lon: -73.9362,
    address: "Harlem, NY",
    surface: "asphalt",
    amenities: ["full_court", "lights", "multiple"],
    source: "catalog",
    hoops: 4,
    notes: "Namesake streetball legend energy — treat it as a competitive outdoor stop. Check local norms; games can get serious.",
  },
  {
    id: "cat-prospect",
    name: "Prospect Park Courts",
    lat: 40.6602,
    lon: -73.969,
    address: "Brooklyn, NY",
    surface: "asphalt",
    amenities: ["full_court", "multiple", "lights", "shade"],
    source: "catalog",
    hoops: 6,
    notes: "Open park courts with city-view vibes depending on the site. A solid alternate when primary courts are packed.",
  },
];

/** Austin first — home market for this build. */
export const CITY_PRESETS = [
  { id: "atx", label: "Austin", lat: 30.2672, lon: -97.7431 },
  { id: "nyc", label: "New York", lat: 40.7282, lon: -73.9942 },
  { id: "la", label: "Los Angeles", lat: 34.0195, lon: -118.4912 },
  { id: "chi", label: "Chicago", lat: 41.8781, lon: -87.6298 },
  { id: "sf", label: "San Francisco", lat: 37.7749, lon: -122.4194 },
  { id: "atl", label: "Atlanta", lat: 33.749, lon: -84.388 },
  { id: "mia", label: "Miami", lat: 25.7617, lon: -80.1918 },
  { id: "sea", label: "Seattle", lat: 47.6062, lon: -122.3321 },
  { id: "den", label: "Denver", lat: 39.7392, lon: -104.9903 },
  { id: "bos", label: "Boston", lat: 42.3601, lon: -71.0589 },
] as const;

export const DEFAULT_CITY = CITY_PRESETS[0]!;

export function catalogNear(
  lat: number,
  lon: number,
  radiusMeters: number,
  limit = 40,
): Court[] {
  return CATALOG.map((c) => {
    const distanceMeters = haversineMeters(lat, lon, c.lat, c.lon);
    return {
      ...c,
      distanceMeters,
      imageIndex: imageIndexFromId(c.id),
    };
  })
    .filter((c) => c.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}

/** When OSM returns few results, pad with nearby catalog entries. */
export function mergeWithCatalog(
  osmCourts: Court[],
  lat: number,
  lon: number,
  radiusMeters: number,
  minDesired = 6,
): Court[] {
  if (osmCourts.length >= minDesired) {
    const seen = new Set(osmCourts.map((c) => `${c.lat.toFixed(4)},${c.lon.toFixed(4)}`));
    const extras = catalogNear(lat, lon, radiusMeters, 30).filter((c) => {
      const key = `${c.lat.toFixed(4)},${c.lon.toFixed(4)}`;
      const nearOsm = osmCourts.some(
        (o) => haversineMeters(o.lat, o.lon, c.lat, c.lon) < 120,
      );
      if (nearOsm || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return [...osmCourts, ...extras]
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 50);
  }
  const seen = new Set(osmCourts.map((c) => `${c.lat.toFixed(4)},${c.lon.toFixed(4)}`));
  const extras = catalogNear(lat, lon, radiusMeters * 2.5, 30).filter((c) => {
    const key = `${c.lat.toFixed(4)},${c.lon.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...osmCourts, ...extras]
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 50);
}

/** Named courts for compete game creation dropdown */
export function namedAustinCourts(): Array<{
  id: string;
  name: string;
  lat: number;
  lon: number;
}> {
  return CATALOG.filter((c) => c.address?.includes("Austin") || c.id.startsWith("cat-"))
    .filter((c) => !c.address?.includes("NY") && !c.address?.includes("Brooklyn") && !c.address?.includes("Harlem") && !c.address?.includes("Manhattan") && !c.address?.includes("Greenwich"))
    .map((c) => ({ id: c.id, name: c.name, lat: c.lat, lon: c.lon }));
}
```

## FILE: `src/lib/courts/favorites.ts`

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FavoritesState {
  ids: string[];
  toggle: (id: string) => void;
  has: (id: string) => boolean;
}

export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) =>
        set((s) => ({
          ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id],
        })),
      has: (id) => get().ids.includes(id),
    }),
    { name: "court-favorites-v1" },
  ),
);
```

## FILE: `src/lib/courts/fetch-courts.ts`

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Court, CourtAmenity, CourtSurface, CourtsResult } from "./types";
import { haversineMeters } from "@/lib/utils";
import { imageIndexFromId } from "./images";
import { catalogNear, mergeWithCatalog } from "./catalog";

const inputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  radiusMeters: z.number().min(500).max(50000).default(8000),
  label: z.string().optional(),
});

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const cache = new Map<string, { at: number; courts: Court[] }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheKey(lat: number, lon: number, radius: number) {
  return `v3:${lat.toFixed(3)},${lon.toFixed(3)},${Math.round(radius / 500) * 500}`;
}

function pickCoords(el: OverpassElement): { lat: number; lon: number } | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { lat: el.lat, lon: el.lon };
  }
  if (el.center && typeof el.center.lat === "number" && typeof el.center.lon === "number") {
    return { lat: el.center.lat, lon: el.center.lon };
  }
  return null;
}

function surfaceFromTags(tags: Record<string, string> | undefined): CourtSurface {
  const s = (tags?.surface || tags?.material || "").toLowerCase();
  if (s.includes("asphalt") || s.includes("tarmac") || s.includes("paved")) return "asphalt";
  if (s.includes("concrete") || s.includes("cement")) return "concrete";
  if (s.includes("rubber") || s.includes("tartan") || s.includes("acrylic")) return "rubber";
  return "unknown";
}

function amenitiesFromTags(tags: Record<string, string> | undefined): CourtAmenity[] {
  const a: CourtAmenity[] = ["full_court"];
  if (!tags) return a;
  if (tags.lit === "yes" || tags.lighting === "yes") a.push("lights");
  const hoops = tags.hoops ? Number(tags.hoops) : NaN;
  if (Number.isFinite(hoops) && hoops >= 4) a.push("multiple");
  if (tags.barrier === "fence" || tags.fenced === "yes") a.push("fence");
  if (tags.drinking_water === "yes") a.push("water");
  if (tags.parking === "yes") a.push("parking");
  if (
    tags.covered === "yes" ||
    tags.shelter === "yes" ||
    tags.shade === "yes" ||
    tags.canopy === "yes"
  ) {
    a.push("shade");
  }
  return a;
}

function hasRealName(tags: Record<string, string> | undefined): string | null {
  const n = tags?.name || tags?.["name:en"] || tags?.ref;
  return n && n.trim() ? n.trim() : null;
}

function placeHint(tags: Record<string, string> | undefined): string | undefined {
  return (
    tags?.["addr:neighbourhood"] ||
    tags?.["addr:suburb"] ||
    tags?.["addr:city"] ||
    tags?.["addr:street"] ||
    tags?.operator ||
    undefined
  );
}

function isGenericName(name: string): boolean {
  return (
    name === "Public outdoor court" ||
    name.startsWith("Public outdoor court ·") ||
    name.startsWith("Outdoor court")
  );
}

function bearingLabel(fromLat: number, fromLon: number, toLat: number, toLon: number): string {
  const y = Math.sin(((toLon - fromLon) * Math.PI) / 180) * Math.cos((toLat * Math.PI) / 180);
  const x =
    Math.cos((fromLat * Math.PI) / 180) * Math.sin((toLat * Math.PI) / 180) -
    Math.sin((fromLat * Math.PI) / 180) *
      Math.cos((toLat * Math.PI) / 180) *
      Math.cos(((toLon - fromLon) * Math.PI) / 180);
  const brng = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(brng / 45) % 8]!;
}

function sortCourts(a: Court, b: Court): number {
  // Prefer named courts when distances are close (~400m)
  const distDiff = a.distanceMeters - b.distanceMeters;
  if (Math.abs(distDiff) < 400) {
    const aNamed = !isGenericName(a.name);
    const bNamed = !isGenericName(b.name);
    if (aNamed !== bNamed) return aNamed ? -1 : 1;
  }
  return distDiff;
}

/** Merge courts within ~55m (same facility / multi-hoop parks). Prefer named. */
function clusterCourts(courts: Court[]): Court[] {
  const sorted = [...courts].sort((a, b) => a.distanceMeters - b.distanceMeters);
  const kept: Court[] = [];

  for (const c of sorted) {
    const near = kept.find((k) => haversineMeters(k.lat, k.lon, c.lat, c.lon) < 55);
    if (!near) {
      kept.push({ ...c, amenities: [...c.amenities] });
      continue;
    }

    if (isGenericName(near.name) && !isGenericName(c.name)) {
      near.name = c.name;
      near.address = c.address ?? near.address;
      near.notes = c.notes ?? near.notes;
    } else if (!near.address && c.address) {
      near.address = c.address;
    }

    const amenitySet = new Set<CourtAmenity>([...near.amenities, ...c.amenities, "multiple"]);
    near.amenities = [...amenitySet];
    near.hoops = (near.hoops ?? 2) + (c.hoops ?? 1);
  }

  return kept;
}

async function queryOverpass(
  lat: number,
  lon: number,
  radiusMeters: number,
): Promise<Court[]> {
  const key = cacheKey(lat, lon, radiusMeters);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.courts
      .map((c) => ({
        ...c,
        distanceMeters: haversineMeters(lat, lon, c.lat, c.lon),
      }))
      .sort(sortCourts);
  }

  const query = `
[out:json][timeout:18];
(
  nwr["leisure"="pitch"]["sport"="basketball"](around:${radiusMeters},${lat},${lon});
);
out center tags 120;
`.trim();

  const endpoints = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  ];

  let lastError: unknown;
  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 16000);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "CourtApp/1.0 (public outdoor basketball finder)",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 429 || res.status === 504 || res.status === 502) {
        lastError = new Error(`Overpass ${res.status}`);
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      if (!res.ok) {
        lastError = new Error(`Overpass ${res.status}`);
        continue;
      }

      const data = (await res.json()) as { elements?: OverpassElement[] };
      const elements = data.elements ?? [];
      const courts: Court[] = [];
      const seen = new Set<string>();

      for (const el of elements) {
        const coords = pickCoords(el);
        if (!coords) continue;
        if (el.tags?.indoor === "yes" || el.tags?.building) continue;
        const keyCoord = `${coords.lat.toFixed(5)},${coords.lon.toFixed(5)}`;
        if (seen.has(keyCoord)) continue;
        seen.add(keyCoord);

        const id = `osm-${el.type}-${el.id}`;
        const distanceMeters = haversineMeters(lat, lon, coords.lat, coords.lon);
        if (distanceMeters > radiusMeters * 1.08) continue;

        const real = hasRealName(el.tags);
        const hint = placeHint(el.tags);
        const name = real ?? (hint ? `${hint} Court` : "Public outdoor court");

        courts.push({
          id,
          name,
          lat: coords.lat,
          lon: coords.lon,
          distanceMeters,
          address: el.tags?.["addr:street"]
            ? [el.tags["addr:housenumber"], el.tags["addr:street"], el.tags["addr:city"]]
                .filter(Boolean)
                .join(" ")
            : hint,
          surface: surfaceFromTags(el.tags),
          amenities: amenitiesFromTags(el.tags),
          imageIndex: imageIndexFromId(id),
          source: "osm",
          hoops: el.tags?.hoops ? Number(el.tags.hoops) || undefined : undefined,
          notes: el.tags?.description || el.tags?.note,
        });
      }

      const clustered = clusterCourts(courts)
        .map((c) => {
          if (!isGenericName(c.name)) return c;
          const dir = bearingLabel(lat, lon, c.lat, c.lon);
          return {
            ...c,
            name: `Public outdoor court · ${dir}`,
          };
        })
        .sort(sortCourts)
        .slice(0, 40);

      cache.set(key, { at: Date.now(), courts: clustered });
      return clustered;
    } catch (err) {
      lastError = err;
    }
  }

  console.warn("[courts] Overpass unavailable, using catalog", lastError);
  return [];
}

export const fetchCourtsNear = createServerFn({ method: "POST" })
  .validator((raw: unknown) => inputSchema.parse(raw))
  .handler(async ({ data }): Promise<CourtsResult> => {
    const { lat, lon, radiusMeters, label } = data;
    let osm: Court[] = [];
    try {
      osm = await queryOverpass(lat, lon, radiusMeters);
    } catch (e) {
      console.warn("[courts] query error", e);
      osm = [];
    }

    let courts: Court[];
    let source: CourtsResult["source"];

    if (osm.length === 0) {
      courts = catalogNear(lat, lon, Math.max(radiusMeters, 30000), 40);
      if (courts.length < 4) {
        courts = catalogNear(lat, lon, 20_000_000, 24);
      }
      source = "catalog";
    } else {
      courts = mergeWithCatalog(osm, lat, lon, radiusMeters, 8)
        .sort(sortCourts)
        .slice(0, 40);
      source = osm.length >= 6 ? "osm" : "mixed";
    }

    return {
      courts,
      location: { lat, lon, label },
      source,
      queryRadiusMeters: radiusMeters,
    };
  });
```

## FILE: `src/lib/courts/images.ts`

```ts
/**
 * Real outdoor court photos from the user’s basketball courts pack.
 * Served from public/basketball-courts — Austin park courts.
 */
export const COURT_IMAGES = [
  "/basketball-courts/real-2921.jpg",
  "/basketball-courts/real-2927.jpg",
  "/basketball-courts/real-2929.jpg",
  "/basketball-courts/real-2925.jpg",
  "/basketball-courts/real-2917.jpg",
  "/basketball-courts/real-2909.jpg",
  "/basketball-courts/real-2912.jpg",
  "/basketball-courts/real-2913.jpg",
  "/basketball-courts/real-2914.jpg",
  "/basketball-courts/real-2931.jpg",
  "/basketball-courts/real-2933.jpg",
  "/basketball-courts/real-2938.jpg",
  "/basketball-courts/real-2934.jpg",
  "/basketball-courts/real-2943.jpg",
  "/basketball-courts/real-2953.jpg",
  "/basketball-courts/real-2946.jpg",
  "/basketball-courts/real-2947.jpg",
  "/basketball-courts/real-2948.jpg",
] as const;

const N = COURT_IMAGES.length;

export function courtImageFor(index: number): string {
  const i = ((index % N) + N) % N;
  return COURT_IMAGES[i]!;
}

/** Stable image pick from a court id. */
export function imageIndexFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % N;
}

export type CourtImageOverride = {
  preview?: string;
  gallery?: string[];
};

/**
 * At least `count` photos for a court.
 * Admin preview is always first when set; gallery follows; pack fills the rest.
 */
export function courtImagesFor(
  id: string,
  count = 4,
  override?: CourtImageOverride | null,
): string[] {
  const start = imageIndexFromId(id);
  const n = Math.max(count, 4);
  const pack: string[] = [];
  for (let i = 0; i < n + 8; i++) {
    pack.push(COURT_IMAGES[(start + i) % N]!);
  }

  if (!override?.preview && !(override?.gallery && override.gallery.length)) {
    return pack.slice(0, n);
  }

  const out: string[] = [];
  if (override.preview) out.push(override.preview);
  for (const g of override.gallery ?? []) {
    if (g && !out.includes(g)) out.push(g);
  }
  for (const p of pack) {
    if (out.length >= n) break;
    if (!out.includes(p)) out.push(p);
  }
  return out.length > 0 ? out : pack.slice(0, n);
}
```

## FILE: `src/lib/courts/social.ts`

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WorkOrderKind = "broken_rim" | "replace_net" | "other";
export type WorkOrderStatus = "submitted" | "received" | "in_progress" | "resolved";

export interface CourtReview {
  id: string;
  courtId: string;
  author: string;
  rating: number; // 1–5
  text: string;
  at: string;
}

export interface WorkOrder {
  id: string;
  courtId: string;
  courtName?: string;
  kind: WorkOrderKind;
  detail?: string;
  at: string;
  status: WorkOrderStatus;
  /** Who filed it (display) */
  reporter?: string;
  /** Optional photo (data URL or remote) — first image */
  photoUrl?: string;
  /** All attached photos (includes photoUrl as first when present) */
  photos?: string[];
}

interface CourtSocialState {
  reviews: CourtReview[];
  favoriteBonus: Record<string, number>;
  workOrders: WorkOrder[];
  addReview: (courtId: string, rating: number, text: string, author?: string) => void;
  addWorkOrder: (
    courtId: string,
    kind: WorkOrderKind,
    detail?: string,
    meta?: {
      courtName?: string;
      reporter?: string;
      photoUrl?: string;
      photos?: string[];
    },
  ) => void;
  setWorkOrderStatus: (id: string, status: WorkOrderStatus) => void;
  bumpFavorite: (courtId: string) => void;
}

function hashCount(id: string, min: number, max: number) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const n = Math.abs(h);
  return min + (n % (max - min + 1));
}

export function baseFavoriteCount(courtId: string) {
  return hashCount(courtId, 4, 48);
}

const SEED_REVIEWS: CourtReview[] = [
  {
    id: "r1",
    courtId: "cat-zilker",
    author: "Marcus H.",
    rating: 5,
    text: "Best outdoor run in central Austin. Bring water on weekends.",
    at: "2026-07-12T18:00:00.000Z",
  },
  {
    id: "r2",
    courtId: "cat-battle-bend",
    author: "Cam O.",
    rating: 4,
    text: "Solid surface, gets busy Friday nights. Nets are good.",
    at: "2026-07-20T19:30:00.000Z",
  },
  {
    id: "r3",
    courtId: "cat-givens",
    author: "Sean R.",
    rating: 5,
    text: "East side staple. Lights until late. Competitive but fair.",
    at: "2026-07-28T21:00:00.000Z",
  },
  {
    id: "r4",
    courtId: "cat-pease",
    author: "Jia N.",
    rating: 4,
    text: "Shady in the afternoon. Great for kids earlier, then adult runs.",
    at: "2026-08-01T16:00:00.000Z",
  },
  {
    id: "r5",
    courtId: "cat-bartholomew",
    author: "Riley C.",
    rating: 3,
    text: "Courts are fine — one rim is a little soft. Still playable.",
    at: "2026-07-15T17:00:00.000Z",
  },
];

const SEED_ORDERS: WorkOrder[] = [
  {
    id: "wo-seed-1",
    courtId: "cat-bartholomew",
    courtName: "Bartholomew District Park",
    kind: "broken_rim",
    at: "2026-08-03T15:20:00.000Z",
    status: "submitted",
    reporter: "Riley C.",
  },
  {
    id: "wo-seed-2",
    courtId: "cat-rosewood",
    courtName: "Rosewood Park",
    kind: "replace_net",
    at: "2026-08-04T19:05:00.000Z",
    status: "received",
    reporter: "Marcus H.",
  },
];

export const useCourtSocial = create<CourtSocialState>()(
  persist(
    (set) => ({
      reviews: SEED_REVIEWS,
      favoriteBonus: {},
      workOrders: SEED_ORDERS,
      addReview: (courtId, rating, text, author = "You") => {
        const t = text.trim();
        if (!t) return;
        set((s) => ({
          reviews: [
            {
              id: `r-${Date.now().toString(36)}`,
              courtId,
              author,
              rating: Math.min(5, Math.max(1, rating)),
              text: t,
              at: new Date().toISOString(),
            },
            ...s.reviews,
          ],
        }));
      },
      addWorkOrder: (courtId, kind, detail, meta) => {
        set((s) => ({
          workOrders: [
            {
              id: `wo-${Date.now().toString(36)}`,
              courtId,
              courtName: meta?.courtName,
              kind,
              detail: detail?.trim() || undefined,
              at: new Date().toISOString(),
              status: "submitted",
              reporter: meta?.reporter ?? "Player",
              photoUrl: meta?.photos?.[0] ?? meta?.photoUrl,
              photos:
                meta?.photos && meta.photos.length
                  ? meta.photos
                  : meta?.photoUrl
                    ? [meta.photoUrl]
                    : undefined,
            },
            ...s.workOrders,
          ],
        }));
      },
      setWorkOrderStatus: (id, status) => {
        set((s) => ({
          workOrders: s.workOrders.map((w) =>
            w.id === id ? { ...w, status } : w,
          ),
        }));
      },
      bumpFavorite: (courtId) => {
        set((s) => ({
          favoriteBonus: {
            ...s.favoriteBonus,
            [courtId]: (s.favoriteBonus[courtId] ?? 0) + 1,
          },
        }));
      },
    }),
    { name: "court-social-v3" },
  ),
);

export function favoriteCountFor(
  courtId: string,
  userFavorited: boolean,
  bonus: Record<string, number>,
) {
  return baseFavoriteCount(courtId) + (bonus[courtId] ?? 0) + (userFavorited ? 0 : 0);
}

export function reviewsFor(reviews: CourtReview[], courtId: string) {
  return reviews.filter((r) => r.courtId === courtId);
}

export const WORK_ORDER_LABELS: Record<WorkOrderKind, string> = {
  broken_rim: "Broken rim",
  replace_net: "Replace net",
  other: "Something else",
};

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  submitted: "New",
  received: "Received",
  in_progress: "In progress",
  resolved: "Resolved",
};

// Admin is email-gated — see `@/lib/auth/admin` (seanvoss23@gmail.com)
```

## FILE: `src/lib/courts/types.ts`

```ts
export type CourtSurface = "asphalt" | "concrete" | "rubber" | "unknown";

export type CourtAmenity =
  | "lights"
  | "full_court"
  | "half_court"
  | "multiple"
  | "water"
  | "parking"
  | "fence"
  | "shade";

export interface Court {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceMeters: number;
  address?: string;
  surface: CourtSurface;
  amenities: CourtAmenity[];
  imageIndex: number;
  source: "osm" | "catalog";
  hoops?: number;
  notes?: string;
  /** Map zone label e.g. East Austin */
  neighborhood?: string;
  /** Lights hours if known */
  lightsHours?: string;
  /** Park hours */
  hours?: string;
}

export interface UserLocation {
  lat: number;
  lon: number;
  label?: string;
  accuracy?: number;
}

export interface CourtsResult {
  courts: Court[];
  location: UserLocation;
  source: "osm" | "catalog" | "mixed";
  queryRadiusMeters: number;
}
```

## FILE: `src/lib/db.ts`

```ts
/** Which database backend is active. */
export type DbSource = "neon" | "pglite";

// An empty/whitespace DATABASE_URL (an easy misconfig in deploy UIs) must mean
// "unset" — otherwise production would silently run on the PGLite fallback.
const rawDatabaseUrl =
  typeof process !== "undefined" ? process.env.DATABASE_URL : undefined;
const databaseUrl =
  rawDatabaseUrl && rawDatabaseUrl.trim() ? rawDatabaseUrl : undefined;

/**
 * Active backend: real **Neon** when `DATABASE_URL` is set (deployed / configured
 * sandbox), otherwise a local embedded **PGLite** (Postgres compiled to WASM) so
 * the app has a working database even with nothing configured — the live preview
 * included. Swap in Neon later by just setting `DATABASE_URL`; no code changes.
 */
export const dbSource: DbSource = databaseUrl ? "neon" : "pglite";

/**
 * Minimal shared SQL surface, satisfied by both Neon and PGLite. Both the
 * tagged-template and `.query()` forms resolve to an array of row objects:
 *
 *   const sql = await getSql();
 *   const rows = await sql`select * from todos where id = ${id}`; // parameterized
 *   const rows2 = await sql.query("select * from todos where id = $1", [id]);
 */
export interface Sql {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
}

/**
 * Init state lives on globalThis as promises: dev HMR creates new instances of
 * this module, and two instances racing module-level state would open a second
 * pool or run two concurrent PGLite migration passes (whose duplicate
 * `_migrations` insert rejects — and would get memoized, poisoning every later
 * `getSql()`). A failed init clears its slot so the next call retries.
 */
const globalRef = globalThis as typeof globalThis & {
  __pgSqlPromise__?: Promise<Sql>;
  __pgliteInstance__?: Promise<import("@electric-sql/pglite").PGlite>;
  __pgliteMigrateChain__?: Promise<void>;
};

/**
 * Result-type parity: Postgres sends every value as text plus a type OID — the
 * JS value is the DRIVER's parsing choice, and pg and PGLite disagree (pg:
 * int8 -> string, date -> local-midnight Date; PGLite: int8 -> BigInt, which
 * JSON.stringify rejects, date -> UTC Date). Normalize both so preview and
 * production return identical, JSON-safe shapes:
 *   int8/bigint (incl. count(*)) -> number (past 2^53 loses precision — cast
 *                                   `::text` if you ever need huge integers)
 *   date                         -> 'YYYY-MM-DD' string
 *   interval                     -> Postgres interval text
 * numeric already comes back as a string on both (arbitrary precision).
 */
const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_INTERVAL = 1186;
const identity = (v: string) => v;

type Run = <T>(text: string, params: unknown[]) => Promise<T[]>;

/** Wrap a query runner in the tagged-template + `.query()` `Sql` surface. */
function toSql(run: Run): Sql {
  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]> => {
    // Rebuild with $1, $2, … placeholders so values stay parameterized.
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as unknown as Sql;
  sql.query = <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
    run<T>(text, params);
  return sql;
}

function createNeonSql(): Promise<Sql> {
  globalRef.__pgSqlPromise__ ??= (async () => {
    // Regular Postgres driver: node-postgres (`pg`) — works directly with Neon's
    // pooled endpoint. One pool per process; warm serverless instances reuse it.
    const { Pool, types } = await import("pg");
    types.setTypeParser(OID_INT8, Number);
    types.setTypeParser(OID_DATE, identity);
    types.setTypeParser(OID_INTERVAL, identity);
    const pool = new Pool({ connectionString: databaseUrl });
    return toSql(async <T>(text: string, params: unknown[]) => {
      const res = await pool.query(text, params);
      return res.rows as T[];
    });
  })().catch((err) => {
    globalRef.__pgSqlPromise__ = undefined;
    throw err;
  });
  return globalRef.__pgSqlPromise__;
}

async function createPgliteSql(): Promise<Sql> {
  // Embedded Postgres, imported on demand so it never loads on the Neon path.
  // One in-memory instance per process, shared across HMR module instances, so
  // data survives source edits (it resets on dev-server restart).
  globalRef.__pgliteInstance__ ??= (async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite({
      parsers: {
        [OID_INT8]: Number,
        [OID_DATE]: identity,
        [OID_INTERVAL]: identity,
      },
    });
    await pg.waitReady;
    await pg.exec(
      "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    return pg;
  })().catch((err) => {
    globalRef.__pgliteInstance__ = undefined;
    throw err;
  });
  const pg = await globalRef.__pgliteInstance__;

  // Apply migrations/ (the single schema source) so preview matches production.
  // SQL is inlined by the bundler via import.meta.glob (no runtime fs); applied
  // files are tracked in _migrations. Runs once per module instance — so an HMR
  // reload after adding a migration file applies it live — with passes
  // serialized on a global chain so concurrent callers never double-apply.
  const migrate = async (): Promise<void> => {
    const migrations = import.meta.glob("/migrations/*.sql", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const doneRows = await pg.query<{ name: string }>(
      "select name from _migrations",
    );
    const done = new Set(doneRows.rows.map((r) => r.name));
    for (const [path, text] of Object.entries(migrations).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const name = path.split("/").pop() as string;
      if (done.has(name)) continue;
      // Apply + record atomically (parity with scripts/migrate.mjs) so a failed
      // statement can't leave a file half-applied but untracked.
      await pg.transaction(async (tx) => {
        await tx.exec(text);
        await tx.query("insert into _migrations (name) values ($1)", [name]);
      });
    }
  };
  const pass = (globalRef.__pgliteMigrateChain__ ?? Promise.resolve())
    .catch(() => undefined) // an earlier failed pass must not wedge the chain
    .then(migrate);
  globalRef.__pgliteMigrateChain__ = pass;
  await pass;

  return toSql(async <T>(text: string, params: unknown[]) => {
    const result = await pg.query<T>(text, params);
    return result.rows;
  });
}

let sqlPromise: Promise<Sql> | null = null;

async function createSql(): Promise<Sql> {
  if (typeof window !== "undefined") {
    throw new Error(
      "@/lib/db is server-only — call getSql() from a createServerFn handler " +
        "or a server route loader, never from client code.",
    );
  }
  return dbSource === "neon" ? createNeonSql() : createPgliteSql();
}

/**
 * Get the shared, **server-only** SQL client. Neon when `DATABASE_URL` is set,
 * otherwise the local PGLite fallback. Memoized — safe to call per request.
 *
 * Schema comes from `migrations/*.sql`, auto-applied before the first query on
 * both backends — define tables there, never inline in server functions.
 */
export function getSql(): Promise<Sql> {
  sqlPromise ??= createSql().catch((err) => {
    sqlPromise = null; // don't memoize failures — let the next call retry
    throw err;
  });
  return sqlPromise;
}

/**
 * The shared PGLite instance (preview only), with `migrations/*.sql` applied.
 * Lets Better Auth persist to the SAME embedded DB as app data in preview (via a
 * Kysely dialect). Throws when `DATABASE_URL` is set (that path uses Neon).
 */
export async function getPglite(): Promise<import("@electric-sql/pglite").PGlite> {
  if (dbSource !== "pglite") {
    throw new Error("getPglite() is only available on the PGLite fallback (no DATABASE_URL)");
  }
  await getSql();
  const pg = await globalRef.__pgliteInstance__;
  if (!pg) throw new Error("PGLite instance failed to initialize");
  return pg;
}

/**
 * Finish DB bootstrap before the server handles traffic.
 *
 * - **PGLite** (preview / no `DATABASE_URL`): open the in-memory DB and apply
 *   `migrations/*.sql`. Idempotent — concurrent callers share one promise.
 * - **Neon**: no-op (pool is created lazily on first query).
 *
 * Vite `configureServer` awaits this at dev startup; production imports of this
 * module kick it off immediately (see bottom of file).
 */
export function ensureDbReady(): Promise<void> {
  if (dbSource !== "pglite") return Promise.resolve();
  return getSql().then(() => undefined);
}

// Server-only eager start: kick PGLite bootstrap as soon as this module loads in
// Node. Client bundles never hit this path (`getSql` throws in the browser).
const globalBoot = globalThis as typeof globalThis & {
  __pgBootstrapPromise__?: Promise<void>;
};
if (typeof window === "undefined" && dbSource === "pglite") {
  globalBoot.__pgBootstrapPromise__ ??= ensureDbReady().catch((err) => {
    globalBoot.__pgBootstrapPromise__ = undefined;
    console.error("[db] PGLite bootstrap failed:", err);
    throw err;
  });
}
```

## FILE: `src/lib/error-component.tsx`

```tsx
import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main
      className={
        "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center " +
        "bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
      }
    >
      <span className="text-red-500" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400">
        {error.message || "An unexpected error occurred. Try reloading the page."}
      </p>
    </main>
  );
}
```

## FILE: `src/lib/maps/directions.ts`

```ts
/** Open native maps for turn-by-turn routing to a court. */
export function directionsUrl(
  lat: number,
  lon: number,
  label?: string,
): string {
  const q = label?.trim()
    ? encodeURIComponent(label)
    : `${lat},${lon}`;

  // iPhone / iPad → Apple Maps directions
  if (
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod/.test(navigator.userAgent)
  ) {
    return `https://maps.apple.com/?daddr=${lat},${lon}&q=${q}&dirflg=d`;
  }

  // Android, desktop, Mac → Google Maps directions
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
}

export function openDirections(lat: number, lon: number, label?: string) {
  window.open(directionsUrl(lat, lon, label), "_blank", "noopener,noreferrer");
}
```

## FILE: `src/lib/maps/geocode.ts`

```ts
/** Austin-area address geocoding + autocomplete (Nominatim / OpenStreetMap). */

export type GeoHit = {
  lat: number;
  lon: number;
  label: string;
  detail?: string;
};

const AUSTIN_VIEWBOX = "-98.05,30.55,-97.45,30.05";

function formatLabel(displayName: string) {
  return displayName
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
}

/** Single best match (legacy courts search). */
export async function geocodeAustinAddress(
  q: string,
): Promise<GeoHit | null> {
  const hits = await suggestAustinAddresses(q, 1);
  return hits[0] ?? null;
}

/**
 * Autocomplete-style suggestions for typing an address in Austin.
 * Uses OpenStreetMap Nominatim (no API key). Google-like dropdown UX.
 */
export async function suggestAustinAddresses(
  q: string,
  limit = 6,
): Promise<GeoHit[]> {
  const query = q.trim();
  if (query.length < 3) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${query}, Austin, Texas`);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("viewbox", AUSTIN_VIEWBOX);
  url.searchParams.set("bounded", "1");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        // Nominatim usage policy — identify the app
        "User-Agent": "UpsetCity/1.0 (court finder)",
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      type?: string;
      class?: string;
    }>;
    const seen = new Set<string>();
    const out: GeoHit[] = [];
    for (const hit of data) {
      const lat = Number(hit.lat);
      const lon = Number(hit.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const label = formatLabel(hit.display_name);
      const key = `${lat.toFixed(4)},${lon.toFixed(4)},${label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        lat,
        lon,
        label,
        detail: hit.display_name,
      });
    }
    return out;
  } catch {
    return [];
  }
}
```

## FILE: `src/lib/match-reminders.ts`

```ts
/**
 * Phone-friendly game reminders.
 *
 * Browsers cannot silently schedule true native alarms. The reliable path is a
 * calendar event with VALARM alerts (24h + 3h) — Apple Calendar / Google Calendar
 * on the phone then fire those notifications even when the app is closed.
 *
 * Optional: browser Notification API for same-device pings while the app can run.
 */

export type ReminderMatch = {
  id: string;
  courtName: string;
  lat: number;
  lon: number;
  whenIso: string;
  hostName: string;
  oppName: string;
  notes?: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** UTC ICS timestamp */
function icsUtc(d: Date): string {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** ~90 min game block */
function endDate(start: Date): Date {
  return new Date(start.getTime() + 90 * 60e3);
}

export function buildMatchIcs(m: ReminderMatch): string {
  const start = new Date(m.whenIso);
  const end = endDate(start);
  const title = `Upset City 1v1 · ${m.hostName} vs ${m.oppName}`;
  const desc = [
    `Rated 1v1 at ${m.courtName}`,
    `${m.hostName} vs ${m.oppName}`,
    m.notes ?? "Best of 3 · games to 11 · make it take it",
    "Reminders: 24 hours before · 3 hours before",
  ].join("\\n");
  const uid = `${m.id}@upsetcity.app`;
  const now = icsUtc(new Date());

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Upset City//Match Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(end)}`,
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(desc.replace(/\\n/g, "\n")).replace(/\n/g, "\\n")}`,
    `LOCATION:${escapeIcs(m.courtName)}`,
    `GEO:${m.lat};${m.lon}`,
    // 24 hours before tip-off
    "BEGIN:VALARM",
    "TRIGGER:-PT24H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Upset City — game tomorrow",
    "END:VALARM",
    // 3 hours before tip-off
    "BEGIN:VALARM",
    "TRIGGER:-PT3H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Upset City — game in 3 hours",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadMatchIcs(m: ReminderMatch): void {
  const ics = buildMatchIcs(m);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `upset-city-${m.id}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Google Calendar template with text notes about reminders (GCal UI sets alerts on import differently) */
export function googleCalendarUrl(m: ReminderMatch): string {
  const start = new Date(m.whenIso);
  const end = endDate(start);
  const fmt = (d: Date) =>
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Upset City 1v1 · ${m.hostName} vs ${m.oppName}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: [
      `Rated 1v1 at ${m.courtName}`,
      `${m.hostName} vs ${m.oppName}`,
      m.notes ?? "Best of 3 · games to 11",
      "Add alerts: 1 day before + 3 hours before",
    ].join("\n"),
    location: m.courtName,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const LS_KEY = "uc-match-reminders-v1";

type Stored = Record<
  string,
  { calendar?: boolean; notifs?: boolean; dismissed?: boolean }
>;

function loadStored(): Stored {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as Stored;
  } catch {
    return {};
  }
}

export function reminderState(matchId: string) {
  return loadStored()[matchId] ?? {};
}

/** True once the user added calendar / dismissed the card — don't show again */
export function remindersCompleted(matchId: string): boolean {
  const s = reminderState(matchId);
  return Boolean(s.calendar || s.dismissed);
}

export function markReminder(
  matchId: string,
  kind: "calendar" | "notifs" | "dismissed",
) {
  const all = loadStored();
  const cur = all[matchId] ?? {};
  all[matchId] = {
    ...cur,
    ...(kind === "calendar"
      ? { calendar: true }
      : kind === "notifs"
        ? { notifs: true }
        : { dismissed: true }),
  };
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

/**
 * Best-effort in-browser notifications (only while the browser can fire them).
 * Calendar is still the real phone reminder path.
 */
export async function scheduleBrowserReminders(
  m: ReminderMatch,
): Promise<{ ok: boolean; reason?: string }> {
  if (typeof Notification === "undefined") {
    return { ok: false, reason: "Notifications not supported on this device." };
  }
  let perm = Notification.permission;
  if (perm === "default") {
    perm = await Notification.requestPermission();
  }
  if (perm !== "granted") {
    return { ok: false, reason: "Notification permission denied." };
  }

  const tip = new Date(m.whenIso).getTime();
  const now = Date.now();
  const targets = [
    { at: tip - 24 * 3600e3, label: "24 hours" },
    { at: tip - 3 * 3600e3, label: "3 hours" },
  ];

  let scheduled = 0;
  for (const t of targets) {
    const delay = t.at - now;
    if (delay <= 0) continue;
    // Cap: browsers throttle long timers; still useful for same-day games.
    if (delay > 7 * 24 * 3600e3) continue;
    window.setTimeout(() => {
      try {
        new Notification(`Upset City · tip-off in ${t.label}`, {
          body: `${m.hostName} vs ${m.oppName} · ${m.courtName}`,
          tag: `uc-${m.id}-${t.label}`,
        });
      } catch {
        /* ignore */
      }
    }, delay);
    scheduled += 1;
  }

  if (scheduled === 0) {
    return {
      ok: false,
      reason: "Game is too soon (or too far) for in-app alerts — use Calendar.",
    };
  }
  markReminder(m.id, "notifs");
  return { ok: true };
}
```

## FILE: `src/lib/multiplayer/index.ts`

```ts
export { P2PRoom, defaultIceServers } from "./p2p";
export type {
  PeerInfo,
  P2PRoomOptions,
  SignalKind,
  PeerRow,
  SignalRow,
  RtcPollResponse,
} from "./p2p";
```

## FILE: `src/lib/multiplayer/p2p.ts`

```ts
/**
 * Full-mesh WebRTC rooms: one RTCPeerConnection per remote peer, signaled
 * through /api/rtc (see signaling.server.ts), game data flowing directly
 * browser-to-browser afterwards. Client-authoritative by construction — see
 * the multiplayer-p2p skill for when NOT to use this.
 *
 * Negotiation follows the "perfect negotiation" pattern: on a glare (both
 * sides offering at once) the polite peer — the lexicographically smaller id —
 * rolls back and accepts, so pairs converge without wedging.
 */

export type SignalKind = "offer" | "answer" | "ice";

/**
 * Wire contract between this client and the signaling relay the app provides
 * at /api/rtc (see the multiplayer-p2p skill for a reference implementation).
 * The client only needs these shapes — the relay's storage is the app's choice.
 */
export interface PeerRow {
  id: string;
  name: string;
}
export interface SignalRow {
  id: number;
  from: string;
  kind: SignalKind;
  payload: unknown;
}
export interface RtcPollResponse {
  peers: PeerRow[];
  signals: SignalRow[];
}

export interface PeerInfo {
  id: string;
  name: string;
  connectionState: RTCPeerConnectionState;
  /** Selected local ICE candidate type: host | srflx | prflx | relay. */
  candidateType: string | null;
  /** Data-channel ping RTT (ms), measured every 2s once connected. */
  rttMs: number | null;
}

export interface P2PRoomOptions {
  room: string;
  selfId: string;
  name?: string;
  /** Defaults to VITE_STUN_URLS (comma-separated) or Google public STUN. */
  iceServers?: RTCIceServer[];
  onPeersChanged?: (peers: PeerInfo[]) => void;
  /** Fires for both the unreliable "state" and reliable "reliable" channels. */
  onMessage?: (from: string, data: unknown, channel: "state" | "reliable") => void;
  /** Fires once, on the first successful signaling poll (registration). */
  onConnected?: () => void;
}

interface PeerSlot {
  pc: RTCPeerConnection;
  state?: RTCDataChannel;
  reliable?: RTCDataChannel;
  makingOffer: boolean;
  ignoreOffer: boolean;
  /** ICE candidates that arrived before the remote description (buffered). */
  pendingCandidates: RTCIceCandidateInit[];
  /** Last time this pair made observable progress toward connected. */
  lastProgressAt: number;
  /** Watchdog recreations (dialer) / stall windows (receiver) so far. */
  recoveryAttempts: number;
  /** Gave up after MAX_RECOVERY_ATTEMPTS — excluded from fast-poll pressure. */
  terminal?: boolean;
  /** One-shot: pc was already recreated to absorb a failing remote offer. */
  recreatedForOffer?: boolean;
  info: PeerInfo;
  pingSentAt?: number;
}

const FAST_POLL_MS = 400;
const IDLE_POLL_MS = 2000;
const PING_INTERVAL_MS = 2000;
const STALL_MS = 10_000;
const MAX_RECOVERY_ATTEMPTS = 3;
const SIGNAL_RETRY_DELAYS_MS = [250, 750];

export function defaultIceServers(): RTCIceServer[] {
  const urls = (import.meta.env.VITE_STUN_URLS as string | undefined)
    ?.split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  // Two independent providers: ICE queries all of them in parallel during
  // gathering, so either one being unreachable costs nothing.
  return [
    {
      urls: urls?.length ? urls : ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"],
    },
  ];
}

export class P2PRoom {
  private readonly opts: P2PRoomOptions;
  private readonly peers = new Map<string, PeerSlot>();
  /** Per-remote-peer signal delivery chains (order-preserving). */
  private readonly signalQueues = new Map<string, Promise<void>>();
  private cursor = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  private everPolled = false;
  private lastPeersFingerprint = "";

  constructor(opts: P2PRoomOptions) {
    this.opts = opts;
  }

  /**
   * The first poll IS the join: it registers this peer and returns the
   * roster. A failed first poll (cold DB, offline tab) must not strand the
   * room: the loop and timers start regardless and the next poll retries.
   */
  async join(): Promise<void> {
    try {
      await this.pollOnce();
    } catch {
      // First poll can fail transiently; the scheduled loop below retries.
    }
    if (this.closed) return;
    this.schedulePoll(this.anyPairConnecting() ? FAST_POLL_MS : IDLE_POLL_MS);
    this.pingTimer = setInterval(() => {
      this.pingAll();
      this.watchdog();
    }, PING_INTERVAL_MS);
  }

  close(): void {
    this.closed = true;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    for (const slot of this.peers.values()) slot.pc.close();
    this.peers.clear();
    // Leaving the roster is the teardown broadcast: everyone's next poll
    // drops this peer and closes their side of the pair.
    void fetch("/api/rtc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "leave", room: this.opts.room, peer: this.opts.selfId }),
      keepalive: true,
    }).catch(() => {});
  }

  /** Send on the unreliable game-state channel (drops stale packets). */
  broadcast(data: unknown): void {
    const wire = JSON.stringify({ t: "d", d: data });
    for (const slot of this.peers.values()) {
      if (slot.state?.readyState === "open") slot.state.send(wire);
    }
  }

  /** Send reliably (ordered) to one peer, or to all when peerId is omitted. */
  send(data: unknown, peerId?: string): void {
    const wire = JSON.stringify({ t: "d", d: data });
    const targets = peerId ? [this.peers.get(peerId)] : [...this.peers.values()];
    for (const slot of targets) {
      if (slot?.reliable?.readyState === "open") slot.reliable.send(wire);
    }
  }

  peerList(): PeerInfo[] {
    return [...this.peers.values()].map((s) => ({ ...s.info }));
  }

  // ── signaling loop ─────────────────────────────────────────────────────────

  private schedulePoll(delay: number): void {
    if (this.closed) return;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => void this.poll(), delay);
  }

  private anyPairConnecting(): boolean {
    for (const s of this.peers.values()) {
      // Terminal pairs (NAT-blocked after all recovery attempts) must not pin
      // the session at the 400ms fast-poll rate.
      if (s.terminal) continue;
      if (s.info.connectionState !== "connected") return true;
    }
    return false;
  }

  private async pollOnce(): Promise<void> {
    const params = new URLSearchParams({
      room: this.opts.room,
      peer: this.opts.selfId,
      name: this.opts.name ?? "",
      since: String(this.cursor),
    });
    const res = await fetch(`/api/rtc?${params}`);
    if (this.closed) return;
    if (!res.ok) throw new Error(`signaling poll failed: ${res.status}`);
    const body = (await res.json()) as RtcPollResponse;
    if (this.closed) return;
    if (!this.everPolled) {
      this.everPolled = true;
      this.opts.onConnected?.();
    }
    this.reconcileRoster(body.peers);
    const roster = new Set(body.peers.map((p) => p.id));
    for (const sig of body.signals) {
      this.cursor = Math.max(this.cursor, sig.id);
      await this.onSignal(sig.from, sig.kind, sig.payload, roster);
      if (this.closed) return;
    }
  }

  private async poll(): Promise<void> {
    if (this.closed) return;
    try {
      await this.pollOnce();
    } catch {
      // Transient poll failures are expected (tab sleep, deploy roll); retry.
    }
    this.schedulePoll(this.anyPairConnecting() ? FAST_POLL_MS : IDLE_POLL_MS);
  }

  private reconcileRoster(peers: { id: string; name: string }[]): void {
    const alive = new Set(peers.map((p) => p.id));
    for (const p of peers) {
      if (p.id === this.opts.selfId) continue;
      const existing = this.peers.get(p.id);
      if (existing) {
        existing.info.name = p.name;
      } else {
        // Exactly one side dials each pair; the other waits for the offer.
        this.connectTo(p.id, p.name, this.opts.selfId > p.id);
      }
    }
    for (const [id, slot] of this.peers) {
      if (!alive.has(id)) {
        slot.pc.close();
        this.peers.delete(id);
      }
    }
    this.emitPeers();
  }

  // ── per-pair connection ────────────────────────────────────────────────────

  private connectTo(peerId: string, name: string, initiator: boolean): PeerSlot | null {
    if (this.closed) return null;
    const pc = new RTCPeerConnection({
      iceServers: this.opts.iceServers ?? defaultIceServers(),
    });
    const slot: PeerSlot = {
      pc,
      makingOffer: false,
      ignoreOffer: false,
      pendingCandidates: [],
      lastProgressAt: Date.now(),
      recoveryAttempts: 0,
      info: {
        id: peerId,
        name,
        connectionState: pc.connectionState,
        candidateType: null,
        rttMs: null,
      },
    };
    this.peers.set(peerId, slot);

    pc.onicecandidate = (e) => {
      if (e.candidate) void this.sendSignal(peerId, "ice", e.candidate.toJSON());
    };
    pc.onconnectionstatechange = () => {
      slot.info.connectionState = pc.connectionState;
      if (pc.connectionState === "connecting" || pc.connectionState === "connected") {
        slot.lastProgressAt = Date.now();
      }
      if (pc.connectionState === "connected") {
        slot.recoveryAttempts = 0;
        slot.terminal = false;
        void this.readCandidateType(slot);
      }
      this.emitPeers();
      if (pc.connectionState === "failed") {
        // Refires negotiationneeded → a fresh offer through signaling, so a
        // lost offer or dead path cannot wedge the pair (glare-safe).
        pc.restartIce();
      }
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        this.schedulePoll(FAST_POLL_MS);
      }
    };
    pc.onnegotiationneeded = async () => {
      try {
        slot.makingOffer = true;
        await pc.setLocalDescription();
        await this.sendSignal(peerId, "offer", pc.localDescription!.toJSON());
      } catch {
        // A failed offer is retried on the next negotiationneeded.
      } finally {
        slot.makingOffer = false;
      }
    };
    pc.ondatachannel = (e) => this.attachChannel(slot, e.channel);

    if (initiator) {
      // Creating the channels triggers negotiationneeded → the offer.
      this.attachChannel(
        slot,
        pc.createDataChannel("state", { ordered: false, maxRetransmits: 0 }),
      );
      this.attachChannel(slot, pc.createDataChannel("reliable", { ordered: true }));
    }
    return slot;
  }

  private attachChannel(slot: PeerSlot, channel: RTCDataChannel): void {
    if (channel.label === "state") slot.state = channel;
    else slot.reliable = channel;
    channel.onopen = () => {
      slot.lastProgressAt = Date.now();
    };
    channel.onmessage = (e) => {
      let msg: { t: string; d?: unknown };
      try {
        msg = JSON.parse(e.data as string) as { t: string; d?: unknown };
      } catch {
        return;
      }
      if (msg.t === "ping") {
        if (slot.state?.readyState === "open") {
          slot.state.send(JSON.stringify({ t: "pong" }));
        }
      } else if (msg.t === "pong") {
        if (slot.pingSentAt) {
          slot.info.rttMs = Math.round(performance.now() - slot.pingSentAt);
          slot.pingSentAt = undefined;
          this.emitPeers();
        }
      } else {
        this.opts.onMessage?.(
          slot.info.id,
          msg.d,
          channel.label === "state" ? "state" : "reliable",
        );
      }
    };
  }

  /** Apply buffered ICE candidates once a remote description is in place. */
  private async flushPendingCandidates(slot: PeerSlot): Promise<void> {
    while (slot.pendingCandidates.length > 0) {
      const candidate = slot.pendingCandidates.shift()!;
      try {
        await slot.pc.addIceCandidate(candidate);
      } catch (err) {
        if (!slot.ignoreOffer) console.warn("[p2p] addIceCandidate failed:", err);
      }
      if (this.closed) return;
    }
  }

  private async onSignal(
    from: string,
    kind: SignalKind,
    payload: unknown,
    roster: Set<string>,
  ): Promise<void> {
    if (this.closed) return;
    let slot = this.peers.get(from);
    if (!slot) {
      // New peers dial us in the same poll that adds them to the roster.
      // Signals outlive membership, so drop senders the roster doesn't vouch for.
      if (!roster.has(from)) return;
      const created = this.connectTo(from, "", false);
      if (!created) return;
      slot = created;
    }
    const polite = this.opts.selfId < from;

    try {
      if (kind === "offer" || kind === "answer") {
        const description = payload as RTCSessionDescriptionInit;
        const collision =
          kind === "offer" && (slot.makingOffer || slot.pc.signalingState !== "stable");
        slot.ignoreOffer = !polite && collision;
        if (slot.ignoreOffer) return;
        try {
          await slot.pc.setRemoteDescription(description); // implicit rollback when polite
        } catch (err) {
          // A pc resumed from suspend can be unable to take any new remote
          // offer (stale DTLS fingerprint). Rebuild the pair once and apply
          // the same offer to the fresh pc before giving up.
          if (kind !== "offer" || slot.recreatedForOffer) throw err;
          const attempts = slot.recoveryAttempts;
          const name = slot.info.name;
          slot.pc.close();
          this.peers.delete(from);
          const fresh = this.connectTo(from, name, false);
          if (!fresh) return;
          fresh.recoveryAttempts = attempts;
          fresh.recreatedForOffer = true;
          slot = fresh;
          await slot.pc.setRemoteDescription(description);
        }
        if (this.closed) return;
        await this.flushPendingCandidates(slot);
        if (this.closed) return;
        if (kind === "offer") {
          await slot.pc.setLocalDescription();
          if (this.closed) return;
          await this.sendSignal(from, "answer", slot.pc.localDescription!.toJSON());
        }
      } else if (kind === "ice") {
        const candidate = payload as RTCIceCandidateInit;
        if (!slot.pc.remoteDescription) {
          // Candidate raced ahead of its SDP — hold it until the description
          // lands (flushed after every successful setRemoteDescription).
          slot.pendingCandidates.push(candidate);
          return;
        }
        try {
          await slot.pc.addIceCandidate(candidate);
        } catch (err) {
          // The enclosing catch would swallow a rethrow; log the real signal.
          if (!slot.ignoreOffer) console.warn("[p2p] addIceCandidate failed:", err);
        }
      }
    } catch {
      // Negotiation errors resolve on the next offer cycle; state is visible
      // to the app via connectionState.
    }
  }

  /**
   * Signals are serialized per remote peer (a candidate must never overtake
   * its SDP into the DB) and retried on failure with short backoff.
   */
  private sendSignal(to: string, kind: SignalKind, payload: unknown): Promise<void> {
    const prev = this.signalQueues.get(to) ?? Promise.resolve();
    const next = prev.then(() => this.postSignal(to, kind, payload));
    this.signalQueues.set(
      to,
      next.catch(() => {}),
    );
    return next;
  }

  private async postSignal(to: string, kind: SignalKind, payload: unknown): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      if (this.closed) return;
      try {
        const res = await fetch("/api/rtc", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            op: "signal",
            room: this.opts.room,
            from: this.opts.selfId,
            to,
            kind,
            payload,
          }),
        });
        if (res.ok) return;
        throw new Error(`signal POST failed: ${res.status}`);
      } catch (err) {
        if (attempt >= SIGNAL_RETRY_DELAYS_MS.length) {
          // Delivery gave up; the pair converges on the next offer cycle (or
          // the watchdog rebuilds it). Logged once so failures are visible.
          console.warn(`[p2p] signal ${kind} to ${to} failed after retries`, err);
          return;
        }
        await new Promise((r) => setTimeout(r, SIGNAL_RETRY_DELAYS_MS[attempt]));
      }
    }
  }

  // ── diagnostics + recovery ─────────────────────────────────────────────────

  private pingAll(): void {
    const wire = JSON.stringify({ t: "ping" });
    for (const slot of this.peers.values()) {
      if (slot.state?.readyState !== "open") continue;
      const stale =
        slot.pingSentAt !== undefined && performance.now() - slot.pingSentAt > 2 * PING_INTERVAL_MS;
      if (slot.pingSentAt === undefined || stale) {
        // A lost pong must not freeze rttMs forever: expire and re-ping.
        slot.pingSentAt = performance.now();
        slot.state.send(wire);
      }
    }
  }

  /**
   * Stuck-pair recovery, piggybacked on the ping interval. A pair that has
   * made no progress for STALL_MS gets rebuilt by the dialer with a FRESH
   * RTCPeerConnection (new DTLS identity — fixes the suspend/resume
   * fingerprint wedge). After MAX_RECOVERY_ATTEMPTS the pair is terminal:
   * visible to the app as its last connectionState, ignored by fast-poll.
   */
  private watchdog(): void {
    if (this.closed) return;
    const now = Date.now();
    for (const [peerId, slot] of this.peers) {
      // pc.close() and some suspend/resume wedges never fire
      // connectionstatechange — read the LIVE state so a silently-dead pc
      // still trips the stall timer instead of hiding behind a cached
      // "connected". Only live progress states refresh the stall clock.
      const live = slot.pc.connectionState;
      if (live !== slot.info.connectionState) {
        slot.info.connectionState = live;
        if (live === "connecting" || live === "connected") slot.lastProgressAt = now;
        this.emitPeers();
      }
      if (slot.terminal || live === "connected") continue;
      if (now - slot.lastProgressAt <= STALL_MS) continue;
      if (slot.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
        slot.terminal = true;
        this.emitPeers();
        continue;
      }
      slot.recoveryAttempts += 1;
      slot.lastProgressAt = now; // re-arm the stall window
      if (this.opts.selfId > peerId) {
        // We are the dialer: rebuild the pair from scratch.
        const { name } = slot.info;
        const attempts = slot.recoveryAttempts;
        slot.pc.close();
        this.peers.delete(peerId);
        const fresh = this.connectTo(peerId, name, true);
        if (fresh) fresh.recoveryAttempts = attempts;
        this.schedulePoll(FAST_POLL_MS);
      }
      // Receiver side: count the stall window and wait for the dialer's
      // fresh offer (onSignal absorbs it, recreating our pc if needed).
    }
  }

  private async readCandidateType(slot: PeerSlot): Promise<void> {
    // relay = TURN (none configured by default); srflx/host = direct path.
    try {
      const stats = await slot.pc.getStats();
      let selected: RTCIceCandidatePairStats | undefined;
      stats.forEach((s) => {
        if (s.type === "candidate-pair" && (s as RTCIceCandidatePairStats).nominated) {
          selected = s as RTCIceCandidatePairStats;
        }
      });
      const localId = selected?.localCandidateId;
      if (localId) {
        const local = stats.get(localId) as { candidateType?: string } | undefined;
        slot.info.candidateType = local?.candidateType ?? null;
        this.emitPeers();
      }
    } catch {
      // getStats is best-effort diagnostics only.
    }
  }

  private emitPeers(): void {
    // Only notify when something observable actually changed — React state
    // setters otherwise re-render consumers on every poll/ping.
    const list = this.peerList();
    const fingerprint = JSON.stringify(
      list.map((p) => [p.id, p.name, p.connectionState, p.candidateType, p.rttMs]),
    );
    if (fingerprint === this.lastPeersFingerprint) return;
    this.lastPeersFingerprint = fingerprint;
    this.opts.onPeersChanged?.(list);
  }
}
```

## FILE: `src/lib/rating/engine.test.ts`

```ts
/**
 * Lightweight runtime checks for the rating engine (no test runner required).
 * Run: npx tsx src/lib/rating/engine.test.ts  OR import and call runRatingSelfTest()
 */
import {
  expectedWinProbability,
  handicapLine,
  kFactor,
  rateSeries,
  RATING_CONSTANTS,
} from "./engine";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

export function runRatingSelfTest(): string[] {
  const logs: string[] = [];
  const log = (s: string) => logs.push(s);

  // K decays with games played
  assert(kFactor(0) === RATING_CONSTANTS.k0, "k at 0 games");
  assert(kFactor(RATING_CONSTANTS.halfLife) < RATING_CONSTANTS.k0, "k decays");
  assert(kFactor(1000) > RATING_CONSTANTS.kMin - 0.01, "k floors near k_min");
  log("k-factor ok");

  // Equal ratings → ~50% win
  const p = expectedWinProbability(1500, 1500);
  assert(Math.abs(p - 0.5) < 1e-9, "equal winprob");
  log("equal winprob ok");

  // Big favorite wins cleanly → gains
  const clean = rateSeries(
    { rating: 1800, gamesPlayed: 30 },
    { rating: 1400, gamesPlayed: 30 },
    [
      { a: 11, b: 4 },
      { a: 11, b: 5 },
    ],
  );
  assert(clean.aDelta > 0, "favorite clean win gains");
  assert(clean.bDelta < 0, "underdog blowout loses");
  log(`clean favorite +${clean.aDelta.toFixed(2)}`);

  // Win but ugly (favorite barely scrapes) — win never costs
  const ugly = rateSeries(
    { rating: 1800, gamesPlayed: 40 },
    { rating: 1400, gamesPlayed: 40 },
    [
      { a: 11, b: 10 },
      { a: 10, b: 12 },
      { a: 12, b: 10 },
    ],
  );
  assert(ugly.aDelta >= 0, "win never costs rating");
  log(`ugly win delta ${ugly.aDelta.toFixed(2)}`);

  // Underdog loses close → may gain
  const closeLoss = rateSeries(
    { rating: 1400, gamesPlayed: 15 },
    { rating: 1800, gamesPlayed: 40 },
    [
      { a: 11, b: 13 },
      { a: 10, b: 12 },
    ],
  );
  assert(closeLoss.aDelta > 0, "close underdog loss gains");
  log(`close underdog loss +${closeLoss.aDelta.toFixed(2)}`);

  const line = handicapLine(1400, 1800);
  assert(!line.isFavorite, "underdog flag");
  assert(line.display.includes("Score"), "handicap copy");
  log(line.display);

  log("ALL RATING TESTS PASSED");
  return logs;
}

// Allow direct execution
if (typeof process !== "undefined" && process.argv[1]?.includes("engine.test")) {
  for (const line of runRatingSelfTest()) console.log(line);
}
```

## FILE: `src/lib/rating/engine.ts`

```ts
/**
 * Upset City rating engine — port of the measured formula from the product spec.
 * Pure TS, no deps. Keep full float precision in storage; display rounded ints.
 *
 * Two curves must both exist (spread_win + spread_share). Do not collapse them.
 * If you change `w`, spread_win must be refitted.
 */

export const RATING_CONSTANTS = {
  w: 0.8,
  spreadWin: 400,
  spreadShare: 1910,
  k0: 97,
  kMin: 8,
  halfLife: 20,
} as const;

export interface RatingPlayer {
  rating: number;
  gamesPlayed: number;
}

export interface SeriesGameScore {
  /** Points scored by player A in this game */
  a: number;
  /** Points scored by player B in this game */
  b: number;
}

export interface RatingResult {
  aDelta: number;
  bDelta: number;
  aNew: number;
  bNew: number;
  /** Actual blended score for A (0–1) */
  actualA: number;
  expectedA: number;
}

export function kFactor(gamesPlayed: number): number {
  const { k0, kMin, halfLife } = RATING_CONSTANTS;
  return kMin + (k0 - kMin) / (1 + gamesPlayed / halfLife);
}

export function expectedWinProbability(myRating: number, oppRating: number): number {
  const { spreadWin } = RATING_CONSTANTS;
  return 1 / (1 + 10 ** ((oppRating - myRating) / spreadWin));
}

export function expectedPointShare(myRating: number, oppRating: number): number {
  const { spreadShare } = RATING_CONSTANTS;
  return 1 / (1 + 10 ** ((oppRating - myRating) / spreadShare));
}

export function expectedBlended(myRating: number, oppRating: number): number {
  const { w } = RATING_CONSTANTS;
  return (
    w * expectedPointShare(myRating, oppRating) +
    (1 - w) * expectedWinProbability(myRating, oppRating)
  );
}

/**
 * Best-of-three series score totals → actual blended value for A.
 * Winner never loses rating (delta floored at 0 on a win).
 */
export function rateSeries(
  a: RatingPlayer,
  b: RatingPlayer,
  games: SeriesGameScore[],
): RatingResult {
  const { w } = RATING_CONSTANTS;
  let aPts = 0;
  let bPts = 0;
  for (const g of games) {
    aPts += g.a;
    bPts += g.b;
  }
  const total = aPts + bPts;
  const pointShareA = total > 0 ? aPts / total : 0.5;
  // series winner: more games won, or more points if tied games
  let aWins = 0;
  let bWins = 0;
  for (const g of games) {
    if (g.a > g.b) aWins++;
    else if (g.b > g.a) bWins++;
  }
  const aWonSeries = aWins > bWins || (aWins === bWins && aPts >= bPts);

  const actualA = w * pointShareA + (1 - w) * (aWonSeries ? 1 : 0);
  const expectedA = expectedBlended(a.rating, b.rating);

  let aDelta = kFactor(a.gamesPlayed) * (actualA - expectedA);
  let bDelta = kFactor(b.gamesPlayed) * ((1 - actualA) - (1 - expectedA));

  // A win never costs rating
  if (aWonSeries && aDelta < 0) aDelta = 0;
  if (!aWonSeries && bDelta < 0) bDelta = 0;

  return {
    aDelta,
    bDelta,
    aNew: a.rating + aDelta,
    bNew: b.rating + bDelta,
    actualA,
    expectedA,
  };
}

/**
 * Handicap line for display before a game.
 * Returns underdog target-ish guidance based on expected point share.
 */
export function handicapLine(myRating: number, oppRating: number): {
  winProb: number;
  isFavorite: boolean;
  /** Suggested points-per-game target to gain rating even on a loss (underdog) */
  targetPoints: number;
  display: string;
} {
  const winProb = expectedWinProbability(myRating, oppRating);
  const share = expectedPointShare(myRating, oppRating);
  const isFavorite = myRating >= oppRating;

  // Games to 11: translate expected share into a soft target score
  // Underdog: score enough that point_share stays near expected → still gain on close loss
  // Favorite: win by ~4+ (roughly 11-7) to gain meaningfully
  if (!isFavorite) {
    // Need slightly better than expected share to gain — aim for ceil(11 * share + 1) style
    const target = Math.max(4, Math.min(10, Math.round(11 * share + 1)));
    return {
      winProb,
      isFavorite,
      targetPoints: target,
      display: `Score ${target}+ a game and your rating goes up even if you lose.`,
    };
  }
  const margin = Math.max(2, Math.min(6, Math.round(11 * (2 * share - 1) + 2)));
  return {
    winProb,
    isFavorite,
    targetPoints: 11,
    display: `Win by ${margin}+ to gain rating.`,
  };
}

export function displayRating(r: number): number {
  return Math.round(r);
}
```

## FILE: `src/lib/upset/atx-cup.ts`

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Player } from "./types";

export type EventTier = "regular" | "major";
export type EventStatus = "upcoming" | "open" | "live" | "complete";

export interface CupEvent {
  id: string;
  name: string;
  tier: EventTier;
  /** Major number 1–4 if major */
  majorNumber?: 1 | 2 | 3 | 4;
  startsAt: string;
  /** Pool-play window end (inclusive) */
  windowEnd: string;
  /** Finals week start — top 8 lock here */
  playoffStart: string;
  location: string;
  fieldSize: number;
  status: EventStatus;
  /** Min rated games in window to qualify for top-8 consideration */
  gamesRequired: number;
  /** Anyone can register — matched by skill band */
  openToAllSkillLevels: true;
  /** Points awarded [1st, 2nd, 3rd, 4th, 5th...] */
  pointsTable: number[];
  winnerId?: string;
  /** playerId → finish place (1 = win) for completed */
  finishes?: Record<string, number>;
  blurb: string;
}

export type TournamentPhase = "registration" | "pool" | "playoffs" | "complete";

/** Pool-play line for a registered player in an event */
export interface PoolLine {
  playerId: string;
  wins: number;
  losses: number;
  /** total point differential (scored - allowed) */
  margin: number;
  gamesPlayed: number;
}

export interface EventRegistration {
  eventId: string;
  playerIds: string[];
  /** Live pool stats keyed by player */
  pool: Record<string, PoolLine>;
}

export interface CupStandingRow {
  playerId: string;
  points: number;
  wins: number;
  majorsWon: number;
  eventsPlayed: number;
  rank: number;
  prevRank: number;
}

export type MediaKind =
  | "win"
  | "upset"
  | "major"
  | "season"
  | "scheduled"
  | "streak"
  | "top10"
  | "user";

export interface MediaComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  at: string;
}

export interface MediaPost {
  id: string;
  kind: MediaKind;
  headline: string;
  body: string;
  playerId: string;
  playerName: string;
  opponentId?: string;
  opponentName?: string;
  eventId?: string;
  eventName?: string;
  matchId?: string;
  /** Optional image or video URL (blob: or https) */
  mediaUrl?: string;
  mediaType?: "image" | "video";
  at: string;
  likes: string[]; // player ids
  comments: MediaComment[];
}

/** FedEx-style points: regular vs major (majors ~2×) */
const REGULAR_PTS = [500, 300, 200, 150, 100, 80, 60, 40];
const MAJOR_PTS = [1000, 600, 400, 300, 200, 160, 120, 80];

export const ATX_CUP_SEASON = {
  year: 2026,
  name: "2026 ATX Cup",
  championLabel: "ATX Cup Champion",
  endsAt: "2026-11-15T18:00:00-06:00",
};

export const ATX_EVENTS: CupEvent[] = [
  {
    id: "ev-east-opener",
    name: "East Side Opener",
    tier: "regular",
    startsAt: "2026-03-14T00:00:00-05:00",
    windowEnd: "2026-04-03T23:59:00-05:00",
    playoffStart: "2026-04-04T00:00:00-05:00",
    location: "Givens District Park · citywide pool",
    fieldSize: 64,
    status: "complete",
    gamesRequired: 5,
    openToAllSkillLevels: true,
    pointsTable: REGULAR_PTS,
    winnerId: "p-sean",
    finishes: {
      "p-sean": 1,
      "p-marcus": 2,
      "p-jia": 3,
      "p-kai": 4,
      "p-you": 8,
    },
    blurb: "Season kickoff. Open field, skill-matched pool play.",
  },
  {
    id: "ev-zilker-classic",
    name: "Zilker Classic",
    tier: "regular",
    startsAt: "2026-04-05T00:00:00-05:00",
    windowEnd: "2026-04-25T23:59:00-05:00",
    playoffStart: "2026-04-26T00:00:00-05:00",
    location: "Zilker Park · citywide pool",
    fieldSize: 64,
    status: "complete",
    gamesRequired: 5,
    openToAllSkillLevels: true,
    pointsTable: REGULAR_PTS,
    winnerId: "p-kai",
    finishes: {
      "p-kai": 1,
      "p-andre": 2,
      "p-sean": 3,
      "p-devon": 4,
      "p-you": 6,
    },
    blurb: "Central Austin regular stop.",
  },
  {
    id: "ev-major-1",
    name: "East Side Major",
    tier: "major",
    majorNumber: 1,
    startsAt: "2026-05-02T00:00:00-05:00",
    windowEnd: "2026-05-29T23:59:00-05:00",
    playoffStart: "2026-05-30T00:00:00-05:00",
    location: "Givens · citywide",
    fieldSize: 128,
    status: "complete",
    gamesRequired: 6,
    openToAllSkillLevels: true,
    pointsTable: MAJOR_PTS,
    winnerId: "p-andre",
    finishes: {
      "p-andre": 1,
      "p-devon": 2,
      "p-kai": 3,
      "p-sean": 4,
      "p-marcus": 5,
      "p-you": 12,
    },
    blurb: "Major #1 — double Cup points. First jewel of the season.",
  },
  {
    id: "ev-south-run",
    name: "South Austin Run",
    tier: "regular",
    startsAt: "2026-06-07T00:00:00-05:00",
    windowEnd: "2026-06-27T23:59:00-05:00",
    playoffStart: "2026-06-28T00:00:00-05:00",
    location: "Battle Bend · citywide pool",
    fieldSize: 64,
    status: "complete",
    gamesRequired: 5,
    openToAllSkillLevels: true,
    pointsTable: REGULAR_PTS,
    winnerId: "p-riley",
    finishes: {
      "p-riley": 1,
      "p-you": 2,
      "p-tess": 3,
      "p-cam": 4,
    },
    blurb: "South-side regular. Open to every skill level.",
  },
  {
    id: "ev-major-2",
    name: "Zilker Major",
    tier: "major",
    majorNumber: 2,
    startsAt: "2026-07-11T00:00:00-05:00",
    windowEnd: "2026-08-07T23:59:00-05:00",
    playoffStart: "2026-08-08T00:00:00-05:00",
    location: "Zilker Park · citywide",
    fieldSize: 128,
    status: "complete",
    gamesRequired: 6,
    openToAllSkillLevels: true,
    pointsTable: MAJOR_PTS,
    winnerId: "p-kai",
    finishes: {
      "p-kai": 1,
      "p-andre": 2,
      "p-sean": 3,
      "p-you": 5,
    },
    blurb: "Major #2 — midsummer showcase.",
  },
  {
    id: "ev-pease-night",
    name: "Pease Night Series",
    tier: "regular",
    startsAt: "2026-08-01T00:00:00-05:00",
    windowEnd: "2026-08-21T23:59:00-05:00",
    playoffStart: "2026-08-22T00:00:00-05:00",
    location: "Pease Park · citywide pool",
    fieldSize: 64,
    status: "complete",
    gamesRequired: 5,
    openToAllSkillLevels: true,
    pointsTable: REGULAR_PTS,
    winnerId: "p-jia",
    finishes: {
      "p-jia": 1,
      "p-noah": 2,
      "p-you": 3,
      "p-marcus": 4,
    },
    blurb: "Lights-on regular stop.",
  },
  {
    id: "ev-major-3",
    name: "South Austin Major",
    tier: "major",
    majorNumber: 3,
    startsAt: "2026-08-22T00:00:00-05:00",
    windowEnd: "2026-09-18T23:59:00-05:00",
    playoffStart: "2026-09-19T00:00:00-05:00",
    location: "Battle Bend · citywide",
    fieldSize: 128,
    status: "open",
    gamesRequired: 6,
    openToAllSkillLevels: true,
    pointsTable: MAJOR_PTS,
    blurb: "Major #3 is live for registration. Skill-matched pool play, then top-8 knockout.",
  },
  {
    id: "ev-bartholomew",
    name: "Bartholomew Bounce",
    tier: "regular",
    startsAt: "2026-09-26T00:00:00-05:00",
    windowEnd: "2026-10-16T23:59:00-05:00",
    playoffStart: "2026-10-17T00:00:00-05:00",
    location: "Bartholomew · citywide pool",
    fieldSize: 64,
    status: "upcoming",
    gamesRequired: 5,
    openToAllSkillLevels: true,
    pointsTable: REGULAR_PTS,
    blurb: "Late-season points grab.",
  },
  {
    id: "ev-major-4",
    name: "Capitol Classic",
    tier: "major",
    majorNumber: 4,
    startsAt: "2026-10-17T00:00:00-05:00",
    windowEnd: "2026-11-13T23:59:00-05:00",
    playoffStart: "2026-11-14T00:00:00-05:00",
    location: "Downtown · citywide",
    fieldSize: 128,
    status: "upcoming",
    gamesRequired: 6,
    openToAllSkillLevels: true,
    pointsTable: MAJOR_PTS,
    blurb: "Major #4 — final major before the Cup chase.",
  },
  {
    id: "ev-cup-finale",
    name: "ATX Cup Finale",
    tier: "regular",
    startsAt: "2026-11-15T00:00:00-06:00",
    windowEnd: "2026-11-28T23:59:00-06:00",
    playoffStart: "2026-11-29T00:00:00-06:00",
    location: "Zilker Park · citywide",
    fieldSize: 64,
    status: "upcoming",
    gamesRequired: 5,
    openToAllSkillLevels: true,
    pointsTable: [800, 500, 350, 250, 180, 120, 80, 50],
    blurb: "Season finale. Top of the Cup standings crowned champion.",
  },
];


/** Next event players can care about (open / live / soonest upcoming) */
export function getNextEvent(events: CupEvent[] = ATX_EVENTS): CupEvent | null {
  const actionable = events.filter((e) => e.status === "open" || e.status === "live");
  if (actionable.length) {
    return [...actionable].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )[0];
  }
  const upcoming = events
    .filter((e) => e.status === "upcoming")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  return upcoming[0] ?? null;
}

export function eventPhase(event: CupEvent, now = new Date()): TournamentPhase {
  if (event.status === "complete") return "complete";
  const t = now.getTime();
  const start = new Date(event.startsAt).getTime();
  const poolEnd = new Date(event.windowEnd).getTime();
  const playoff = new Date(event.playoffStart).getTime();
  if (t < start) return "registration";
  if (t <= poolEnd) return "pool";
  if (t >= playoff || event.status === "live") return "playoffs";
  return "registration";
}

export function winPct(line: PoolLine) {
  const g = line.wins + line.losses;
  return g === 0 ? 0 : line.wins / g;
}

export function avgMargin(line: PoolLine) {
  const g = line.wins + line.losses;
  return g === 0 ? 0 : line.margin / g;
}

/** Rank pool: win% desc, then avg margin of victory, then rating if provided */
export function rankPool(
  lines: PoolLine[],
  ratingById?: Map<string, number>,
): PoolLine[] {
  return [...lines].sort((a, b) => {
    const w = winPct(b) - winPct(a);
    if (Math.abs(w) > 1e-9) return w;
    const m = avgMargin(b) - avgMargin(a);
    if (Math.abs(m) > 1e-9) return m;
    const ra = ratingById?.get(a.playerId) ?? 0;
    const rb = ratingById?.get(b.playerId) ?? 0;
    return rb - ra;
  });
}

/** Top 8 seeds for finals week */
export function top8Seeds(
  lines: PoolLine[],
  gamesRequired: number,
  ratingById?: Map<string, number>,
): PoolLine[] {
  const qualified = lines.filter((l) => l.gamesPlayed >= gamesRequired);
  return rankPool(qualified, ratingById).slice(0, 8);
}

/** Skill band label from rating */
export function skillBand(rating: number): string {
  if (rating >= 1900) return "Elite (1900+)";
  if (rating >= 1700) return "Advanced (1700–1899)";
  if (rating >= 1500) return "Intermediate (1500–1699)";
  if (rating >= 1300) return "Developing (1300–1499)";
  return "Open (under 1300)";
}

export function computeStandings(events: CupEvent[] = ATX_EVENTS): CupStandingRow[] {
  const map = new Map<
    string,
    { points: number; wins: number; majorsWon: number; eventsPlayed: number }
  >();

  for (const ev of events) {
    if (!ev.finishes) continue;
    for (const [pid, place] of Object.entries(ev.finishes)) {
      const row = map.get(pid) ?? {
        points: 0,
        wins: 0,
        majorsWon: 0,
        eventsPlayed: 0,
      };
      const pts = ev.pointsTable[place - 1] ?? 0;
      row.points += pts;
      row.eventsPlayed += 1;
      if (place === 1) {
        row.wins += 1;
        if (ev.tier === "major") row.majorsWon += 1;
      }
      map.set(pid, row);
    }
  }

  const sorted = [...map.entries()]
    .map(([playerId, s]) => ({ playerId, ...s, rank: 0, prevRank: 0 }))
    .sort((a, b) => b.points - a.points || b.majorsWon - a.majorsWon || b.wins - a.wins);

  sorted.forEach((r, i) => {
    r.rank = i + 1;
    // mock previous rank: slight shuffle for movement arrows
    r.prevRank = r.rank + ((i % 3) - 1);
    if (r.prevRank < 1) r.prevRank = 1;
  });

  return sorted;
}

const SEED_MEDIA: MediaPost[] = [
  {
    id: "mp1",
    kind: "win",
    headline: "Andre Kline takes Battle Bend under the lights",
    body: "Rated 1v1 · closed out Devon 2–1 (11–7, 9–11, 11–8). Clean series, city board stays stacked.",
    playerId: "p-andre",
    playerName: "Andre Kline",
    opponentId: "p-devon",
    opponentName: "Devon Brooks",
    at: "2026-08-02T18:00:00-05:00",
    likes: ["p-sean", "p-kai", "p-jia", "p-marcus"],
    comments: [
      {
        id: "c1",
        authorId: "p-sean",
        authorName: "Sean Rivera",
        text: "Deserved. That second half was locked in.",
        at: "2026-08-02T19:00:00-05:00",
      },
    ],
  },
  {
    id: "mp2",
    kind: "upset",
    headline: "Upset: Riley Cho drops a big dog at Zilker",
    body: "Riley walks into Zilker and takes a higher-rated matchup 2–0. Pure Upset City.",
    playerId: "p-riley",
    playerName: "Riley Cho",
    opponentId: "p-marcus",
    opponentName: "Marcus Webb",
    at: "2026-08-03T21:00:00-05:00",
    likes: ["p-you", "p-cam", "p-tess"],
    comments: [],
  },
  {
    id: "mp3",
    kind: "win",
    headline: "Kai Thompson wins a war at Pease",
    body: "Kai over Andre in a physical three-game set. Two of the best in Austin going full speed.",
    playerId: "p-kai",
    playerName: "Kai Thompson",
    opponentId: "p-andre",
    opponentName: "Andre Kline",
    at: "2026-08-04T17:30:00-05:00",
    likes: ["p-andre", "p-sean", "p-devon", "p-noah", "p-you"],
    comments: [
      {
        id: "c2",
        authorId: "p-andre",
        authorName: "Andre Kline",
        text: "Rematch soon. Lock it in.",
        at: "2026-08-04T18:00:00-05:00",
      },
    ],
  },
  {
    id: "mp4",
    kind: "win",
    headline: "Jia Nguyen lights up Rosewood",
    body: "Night run at Rosewood. Jia takes a clean 2–0 and keeps climbing the city board.",
    playerId: "p-jia",
    playerName: "Jia Nguyen",
    at: "2026-08-04T22:00:00-05:00",
    likes: ["p-marcus", "p-you"],
    comments: [],
  },
  {
    id: "mp5",
    kind: "season",
    headline: "Weekend runs stacking up across ATX",
    body: "Open 1v1s are live citywide — Zilker, Battle Bend, Circle C. Post a game and get on the board.",
    playerId: "p-you",
    playerName: "Upset City",
    at: "2026-08-05T12:00:00-05:00",
    likes: ["p-you", "p-sean"],
    comments: [],
  },
  {
    id: "mp6",
    kind: "streak",
    headline: "Sean Rivera is on a heater — 6 in a row",
    body: "City board heat check. Sean’s win streak hits 6 straight rated 1v1s. Who slows him down?",
    playerId: "p-sean",
    playerName: "Sean Rivera",
    at: "2026-08-03T16:00:00-05:00",
    likes: ["p-you", "p-kai", "p-jia"],
    comments: [
      {
        id: "c3",
        authorId: "p-you",
        authorName: "You",
        text: "Somebody take that streak.",
        at: "2026-08-03T16:30:00-05:00",
      },
    ],
  },
  {
    id: "mp7",
    kind: "top10",
    headline: "Top 10 game of the week: Kai vs Andre",
    body: "Two of the city’s best went the full three. Final 11–9, 9–11, 11–8. Pure cinema under the lights.",
    playerId: "p-kai",
    playerName: "Kai Thompson",
    opponentId: "p-andre",
    opponentName: "Andre Kline",
    at: "2026-08-04T21:00:00-05:00",
    likes: ["p-andre", "p-sean", "p-you", "p-devon", "p-marcus"],
    comments: [],
  },
];

interface AtxCupState {
  /** eventId → registration payload */
  registrations: Record<string, EventRegistration>;
  posts: MediaPost[];
  register: (eventId: string, playerId: string) => void;
  isRegistered: (eventId: string, playerId: string) => boolean;
  /** Demo / log a pool game result for skill-matched play */
  logPoolGame: (
    eventId: string,
    playerId: string,
    won: boolean,
    margin: number,
  ) => void;
  toggleLike: (postId: string, playerId: string) => void;
  addComment: (
    postId: string,
    authorId: string,
    authorName: string,
    text: string,
  ) => void;
  createUserPost: (input: {
    authorId: string;
    authorName: string;
    text: string;
    mediaUrl?: string;
    mediaType?: "image" | "video";
  }) => void;
}

export const useAtxCup = create<AtxCupState>()(
  persist(
    (set, get) => ({
      registrations: {},
      posts: SEED_MEDIA,
      register: (eventId, playerId) =>
        set((s) => {
          const cur = s.registrations[eventId] ?? {
            eventId,
            playerIds: [],
            pool: {},
          };
          if (cur.playerIds.includes(playerId)) return s;
          return {
            registrations: {
              ...s.registrations,
              [eventId]: {
                ...cur,
                playerIds: [...cur.playerIds, playerId],
                pool: {
                  ...cur.pool,
                  [playerId]: cur.pool[playerId] ?? {
                    playerId,
                    wins: 0,
                    losses: 0,
                    margin: 0,
                    gamesPlayed: 0,
                  },
                },
              },
            },
          };
        }),
      isRegistered: (eventId, playerId) =>
        !!get().registrations[eventId]?.playerIds.includes(playerId),
      logPoolGame: (eventId, playerId, won, margin) =>
        set((s) => {
          const cur = s.registrations[eventId];
          if (!cur || !cur.playerIds.includes(playerId)) return s;
          const line = cur.pool[playerId] ?? {
            playerId,
            wins: 0,
            losses: 0,
            margin: 0,
            gamesPlayed: 0,
          };
          const next: PoolLine = {
            ...line,
            wins: line.wins + (won ? 1 : 0),
            losses: line.losses + (won ? 0 : 1),
            margin: line.margin + (won ? Math.abs(margin) : -Math.abs(margin)),
            gamesPlayed: line.gamesPlayed + 1,
          };
          return {
            registrations: {
              ...s.registrations,
              [eventId]: {
                ...cur,
                pool: { ...cur.pool, [playerId]: next },
              },
            },
          };
        }),
      toggleLike: (postId, playerId) =>
        set((s) => ({
          posts: s.posts.map((p) => {
            if (p.id !== postId) return p;
            const has = p.likes.includes(playerId);
            return {
              ...p,
              likes: has
                ? p.likes.filter((id) => id !== playerId)
                : [...p.likes, playerId],
            };
          }),
        })),
      addComment: (postId, authorId, authorName, text) => {
        const body = text.trim();
        if (!body) return;
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id !== postId
              ? p
              : {
                  ...p,
                  comments: [
                    ...p.comments,
                    {
                      id: `c-${Date.now().toString(36)}`,
                      authorId,
                      authorName,
                      text: body,
                      at: new Date().toISOString(),
                    },
                  ],
                },
          ),
        }));
      },
      createUserPost: ({ authorId, authorName, text, mediaUrl, mediaType }) => {
        const body = text.trim();
        if (!body && !mediaUrl) return;
        const headline =
          body.length > 72 ? `${body.slice(0, 69).trim()}…` : body || "Shared media";
        set((s) => ({
          posts: [
            {
              id: `mp-user-${Date.now().toString(36)}`,
              kind: "user" as const,
              headline,
              body: body || (mediaType === "video" ? "Posted a video" : "Posted a photo"),
              playerId: authorId,
              playerName: authorName,
              mediaUrl,
              mediaType,
              at: new Date().toISOString(),
              likes: [],
              comments: [],
            },
            ...s.posts,
          ],
        }));
      },
    }),
    { name: "upset-media-v1" },
  ),
);

export function majors(events: CupEvent[] = ATX_EVENTS) {
  return events.filter((e) => e.tier === "major").sort((a, b) => (a.majorNumber ?? 0) - (b.majorNumber ?? 0));
}

export function pointsForPlace(event: CupEvent, place: number) {
  return event.pointsTable[place - 1] ?? 0;
}

/** Attach display names for standings */
export function standingsWithPlayers(players: Player[]) {
  const rows = computeStandings();
  const byId = new Map(players.map((p) => [p.id, p]));
  return rows
    .map((r) => ({
      ...r,
      player: byId.get(r.playerId),
    }))
    .filter((r) => r.player);
}
```

## FILE: `src/lib/upset/campaign.ts`

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ALZHEIMERS_CHARITY } from "@/lib/upset/stakes";

/** City-wide cause — every charity game moves this bar */
export const CAMPAIGN_GOAL_DOLLARS = 50_000;
export const CAMPAIGN_YEAR = 2026;
export const CAMPAIGN_TITLE = "Austin for Alzheimer's";
export const CAMPAIGN_CHARITY = ALZHEIMERS_CHARITY;

export interface CampaignDonation {
  id: string;
  matchId?: string;
  playerId: string;
  playerName: string;
  amount: number;
  at: string;
  note?: string;
}

interface CampaignState {
  raisedDollars: number;
  goalDollars: number;
  donations: CampaignDonation[];
  addDonation: (input: {
    amount: number;
    playerId: string;
    playerName: string;
    matchId?: string;
    note?: string;
  }) => void;
}

/** Seed so the bar doesn't start at $0 empty — feels alive */
const SEED_RAISED = 12_480;

export const useCampaign = create<CampaignState>()(
  persist(
    (set, get) => ({
      raisedDollars: SEED_RAISED,
      goalDollars: CAMPAIGN_GOAL_DOLLARS,
      donations: [
        {
          id: "don-seed-1",
          playerId: "p-sean",
          playerName: "Sean",
          amount: 13,
          at: new Date(Date.now() - 86400e3).toISOString(),
          note: "Margin gift · Givens",
        },
        {
          id: "don-seed-2",
          playerId: "p-kai",
          playerName: "Kai",
          amount: 8,
          at: new Date(Date.now() - 3600e3 * 5).toISOString(),
          note: "Charity 1v1",
        },
      ],
      addDonation: ({ amount, playerId, playerName, matchId, note }) => {
        const n = Math.round(Math.max(0, amount) * 100) / 100;
        if (n <= 0) return;
        const id = `don-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        set({
          raisedDollars: Math.round((get().raisedDollars + n) * 100) / 100,
          donations: [
            {
              id,
              matchId,
              playerId,
              playerName,
              amount: n,
              at: new Date().toISOString(),
              note,
            },
            ...get().donations,
          ].slice(0, 200),
        });
      },
    }),
    { name: "upset-city-campaign-v1" },
  ),
);

export function campaignProgress(raised: number, goal = CAMPAIGN_GOAL_DOLLARS) {
  const pct = Math.min(100, Math.round((raised / goal) * 1000) / 10);
  const remaining = Math.max(0, goal - raised);
  return { pct, remaining };
}

export function formatCampaignMoney(n: number) {
  return n >= 1000
    ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : n % 1 === 0
      ? `$${n}`
      : `$${n.toFixed(2)}`;
}
```

## FILE: `src/lib/upset/media-feed.ts`

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FeedKind =
  | "win"
  | "upset"
  | "season"
  | "scheduled"
  | "open"
  | "streak"
  | "top10"
  | "user";

export interface FeedComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  at: string;
  mentionedIds?: string[];
}

export interface FeedPost {
  id: string;
  kind: FeedKind;
  headline: string;
  body: string;
  playerId: string;
  playerName: string;
  opponentId?: string;
  opponentName?: string;
  matchId?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  at: string;
  likes: string[];
  comments: FeedComment[];
  /** Players @mentioned in the post body */
  mentionedIds?: string[];
}

export interface MentionNotice {
  id: string;
  toPlayerId: string;
  fromPlayerId: string;
  fromPlayerName: string;
  postId: string;
  snippet: string;
  at: string;
  read: boolean;
}

const SEED: FeedPost[] = [
  {
    id: "mp1",
    kind: "win",
    headline: "Andre Kline takes Battle Bend under the lights",
    body: "Rated 1v1 · closed out Devon 2–1 (11–7, 9–11, 11–8). Clean series, city board stays stacked.",
    playerId: "p-andre",
    playerName: "Andre Kline",
    opponentId: "p-devon",
    opponentName: "Devon Brooks",
    at: "2026-08-02T18:00:00-05:00",
    likes: ["p-sean", "p-kai", "p-jia", "p-marcus"],
    comments: [
      {
        id: "c1",
        authorId: "p-sean",
        authorName: "Sean Rivera",
        text: "Deserved. That second half was locked in.",
        at: "2026-08-02T19:00:00-05:00",
      },
    ],
  },
  {
    id: "mp2",
    kind: "upset",
    headline: "Upset: Riley Cho drops a big dog at Zilker",
    body: "Riley walks into Zilker and takes a higher-rated matchup 2–0. Pure Upset City.",
    playerId: "p-riley",
    playerName: "Riley Cho",
    opponentId: "p-marcus",
    opponentName: "Marcus Webb",
    at: "2026-08-03T21:00:00-05:00",
    likes: ["p-you", "p-cam", "p-tess"],
    comments: [],
  },
  {
    id: "mp3",
    kind: "win",
    headline: "Kai Thompson wins a war at Pease",
    body: "Kai over Andre in a physical three-game set. Two of the best in Austin going full speed.",
    playerId: "p-kai",
    playerName: "Kai Thompson",
    opponentId: "p-andre",
    opponentName: "Andre Kline",
    at: "2026-08-04T17:30:00-05:00",
    likes: ["p-andre", "p-sean", "p-devon", "p-noah", "p-you"],
    comments: [],
  },
  {
    id: "mp4",
    kind: "streak",
    headline: "Sean Rivera is on a heater — 6 in a row",
    body: "City board heat check. Sean’s win streak hits 6 straight rated 1v1s. Who slows him down?",
    playerId: "p-sean",
    playerName: "Sean Rivera",
    at: "2026-08-03T16:00:00-05:00",
    likes: ["p-you", "p-kai", "p-jia"],
    comments: [],
  },
  {
    id: "mp5",
    kind: "top10",
    headline: "Top 10 game of the week: Kai vs Andre",
    body: "Two of the city’s best went the full three. Final 11–9, 9–11, 11–8. Pure cinema under the lights.",
    playerId: "p-kai",
    playerName: "Kai Thompson",
    opponentId: "p-andre",
    opponentName: "Andre Kline",
    at: "2026-08-04T21:00:00-05:00",
    likes: ["p-andre", "p-sean", "p-you", "p-devon", "p-marcus"],
    comments: [],
  },
  {
    id: "mp6",
    kind: "season",
    headline: "Weekend runs stacking up across ATX",
    body: "Open 1v1s are live citywide — Zilker, Battle Bend, Circle C. Post a game and get on the board.",
    playerId: "p-you",
    playerName: "Upset City",
    at: "2026-08-05T12:00:00-05:00",
    likes: ["p-you", "p-sean"],
    comments: [],
  },
];

export type Mentionable = {
  id: string;
  name: string;
  handle: string;
};

/** Detect active @query at caret in text. */
export function getMentionQuery(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  const left = text.slice(0, caret);
  const at = left.lastIndexOf("@");
  if (at < 0) return null;
  // @ must be start or after whitespace / punctuation
  if (at > 0 && /[A-Za-z0-9_]/.test(left[at - 1]!)) return null;
  const query = left.slice(at + 1);
  // stop if space after @ without more typing of multi-word - allow spaces for full names until 3 words
  if (query.includes("\n")) return null;
  if (query.length > 40) return null;
  // if user typed two spaces, not a mention
  if (/\s{2,}/.test(query)) return null;
  return { start: at, query };
}

export function filterMentionCandidates(
  players: Mentionable[],
  query: string,
  meId: string,
  limit = 6,
): Mentionable[] {
  const q = query.trim().toLowerCase();
  const list = players.filter((p) => p.id !== meId);
  if (!q) return list.slice(0, limit);
  return list
    .filter((p) => {
      const name = p.name.toLowerCase();
      const handle = p.handle.toLowerCase();
      const first = name.split(" ")[0] ?? "";
      return (
        name.includes(q) ||
        handle.includes(q) ||
        first.startsWith(q) ||
        name.replace(/\s+/g, "").includes(q.replace(/\s+/g, ""))
      );
    })
    .slice(0, limit);
}

/** Insert @Name into text replacing the active query. */
export function applyMention(
  text: string,
  caret: number,
  start: number,
  player: Mentionable,
): { text: string; caret: number } {
  const mention = `@${player.name}`;
  const before = text.slice(0, start);
  const after = text.slice(caret);
  // ensure trailing space after mention
  const next = `${before}${mention} ${after.replace(/^\s*/, "")}`;
  const nextCaret = before.length + mention.length + 1;
  return { text: next, caret: nextCaret };
}

/** Resolve mentioned player ids from free text using longest name/handle match. */
export function resolveMentionIds(
  text: string,
  players: Mentionable[],
): string[] {
  const ids = new Set<string>();
  // Sort longer names first so "Sean Rivera" beats "Sean"
  const ranked = [...players].sort(
    (a, b) => b.name.length - a.name.length || b.handle.length - a.handle.length,
  );
  const lower = text.toLowerCase();
  for (const p of ranked) {
    const tokens = [
      `@${p.name}`.toLowerCase(),
      `@${p.handle}`.toLowerCase(),
      `@${p.name.split(" ")[0]}`.toLowerCase(),
    ];
    for (const tok of tokens) {
      if (tok.length < 2) continue;
      if (lower.includes(tok)) {
        ids.add(p.id);
        break;
      }
    }
  }
  return [...ids];
}

interface MediaFeedState {
  posts: FeedPost[];
  notices: MentionNotice[];
  createPost: (input: {
    authorId: string;
    authorName: string;
    text: string;
    mediaUrl?: string;
    mediaType?: "image" | "video";
    mentionedIds?: string[];
  }) => string | null;
  toggleLike: (postId: string, playerId: string) => void;
  addComment: (
    postId: string,
    authorId: string,
    authorName: string,
    text: string,
    mentionedIds?: string[],
  ) => void;
  markNoticesRead: (playerId: string) => void;
}

export const useMediaFeed = create<MediaFeedState>()(
  persist(
    (set, get) => ({
      posts: SEED,
      notices: [],
      createPost: ({
        authorId,
        authorName,
        text,
        mediaUrl,
        mediaType,
        mentionedIds,
      }) => {
        const body = text.trim();
        if (!body && !mediaUrl) return null;
        const id = `mp-user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const headline =
          body.length > 72
            ? `${body.slice(0, 69).trim()}…`
            : body ||
              (mediaType === "video" ? "Shared a video" : "Shared a photo");
        const mentions = (mentionedIds ?? []).filter((x) => x !== authorId);
        const post: FeedPost = {
          id,
          kind: "user",
          headline,
          body:
            body ||
            (mediaType === "video" ? "Posted a video" : "Posted a photo"),
          playerId: authorId,
          playerName: authorName,
          mediaUrl,
          mediaType,
          at: new Date().toISOString(),
          likes: [],
          comments: [],
          mentionedIds: mentions,
        };
        const notices: MentionNotice[] = mentions.map((toId) => ({
          id: `mn-${Date.now().toString(36)}-${toId}`,
          toPlayerId: toId,
          fromPlayerId: authorId,
          fromPlayerName: authorName,
          postId: id,
          snippet: body.slice(0, 120),
          at: new Date().toISOString(),
          read: false,
        }));
        set((s) => ({
          posts: [post, ...s.posts],
          notices: [...notices, ...s.notices],
        }));
        return id;
      },
      toggleLike: (postId, playerId) =>
        set((s) => ({
          posts: s.posts.map((p) => {
            if (p.id !== postId) return p;
            const has = p.likes.includes(playerId);
            return {
              ...p,
              likes: has
                ? p.likes.filter((id) => id !== playerId)
                : [...p.likes, playerId],
            };
          }),
        })),
      addComment: (postId, authorId, authorName, text, mentionedIds) => {
        const body = text.trim();
        if (!body) return;
        const mentions = (mentionedIds ?? []).filter((x) => x !== authorId);
        const notices: MentionNotice[] = mentions.map((toId) => ({
          id: `mn-${Date.now().toString(36)}-${toId}`,
          toPlayerId: toId,
          fromPlayerId: authorId,
          fromPlayerName: authorName,
          postId,
          snippet: body.slice(0, 120),
          at: new Date().toISOString(),
          read: false,
        }));
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id !== postId
              ? p
              : {
                  ...p,
                  comments: [
                    ...p.comments,
                    {
                      id: `c-${Date.now().toString(36)}`,
                      authorId,
                      authorName,
                      text: body,
                      at: new Date().toISOString(),
                      mentionedIds: mentions,
                    },
                  ],
                },
          ),
          notices: [...notices, ...s.notices],
        }));
      },
      markNoticesRead: (playerId) =>
        set((s) => ({
          notices: s.notices.map((n) =>
            n.toPlayerId === playerId ? { ...n, read: true } : n,
          ),
        })),
    }),
    {
      name: "upset-city-media-v3",
      partialize: (s) => ({
        posts: s.posts.map((p) => {
          if (
            p.mediaUrl &&
            (p.mediaUrl.startsWith("blob:") || p.mediaUrl.length > 200_000)
          ) {
            const { mediaUrl: _m, mediaType: _t, ...rest } = p;
            return {
              ...rest,
              body:
                p.body ||
                (p.mediaType === "video"
                  ? "Posted a video"
                  : "Posted a photo"),
            };
          }
          return p;
        }),
        notices: s.notices.slice(0, 100),
      }),
    },
  ),
);

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
```

## FILE: `src/lib/upset/seed-players.ts`

```ts
import type { Player } from "./types";

export const SEED_PLAYERS: Player[] = [
  {
    id: "p-you",
    payCashApp: "upsetyou",
    payVenmo: "upset-you",
    payZelle: "you@example.com",

    photoUrl: "/players/p-you.jpg",
    name: "You",
    handle: "you",
    city: "Austin",
    heightIn: 72,
    weightLb: 175,
    experienceYears: 4,
    rating: 1520,
    gamesPlayed: 20,
    sportsmanship: 4.6,
    reliability: 4.7,
    wins: 12,
    losses: 8,
    streak: 2,
    homeCourtId: "cat-battle-bend",
    neighborhood: "South Austin",
    availability: "available",
    bio: "Looking for clean 1v1 runs after work.",
    hue: 22,
    quietStart: 22,
    quietEnd: 7,
    pingsToday: 0,
    pingsDate: "",
    ignoreStreak: 0,
    preferredHour: 19,
    lastPlayedAt: new Date(Date.now() - 0 * 864e5).toISOString(),
    openToChallenges: true,
    dmPrivacy: "everyone",
    hideFromCatalog: false,
    challengesToday: 0,
    challengesDate: "",
    dmFirstToday: 0,
    dmFirstDate: "",
    rankLastWeek: 9,
    pointsScored: 420,
    pointsAllowed: 390,
    weeklyWins: 2,
    weeklyLosses: 1,
    ratingLastWeek: 1490,
  },
  {
    id: "p-sean",
    payCashApp: "seanruns",
    payVenmo: "sean-runs",

    photoUrl: "/players/p-sean.jpg",
    name: "Sean Rivera",
    handle: "seanruns",
    city: "Austin",
    heightIn: 74,
    weightLb: 185,
    experienceYears: 8,
    rating: 1885,
    gamesPlayed: 64,
    sportsmanship: 4.7,
    reliability: 4.9,
    wins: 48,
    losses: 16,
    streak: 5,
    homeCourtId: "cat-givens",
    neighborhood: "East Austin",
    availability: "available",
    bio: "East side. Bring defense.",
    hue: 18,
    quietStart: 23,
    quietEnd: 8,
    pingsToday: 0,
    pingsDate: "",
    ignoreStreak: 0,
    preferredHour: 18,
    lastPlayedAt: new Date(Date.now() - 0 * 864e5).toISOString(),
    openToChallenges: true,
    dmPrivacy: "everyone",
    hideFromCatalog: false,
    challengesToday: 0,
    challengesDate: "",
    dmFirstToday: 0,
    dmFirstDate: "",
    rankLastWeek: 3,
    pointsScored: 1680,
    pointsAllowed: 1320,
    weeklyWins: 4,
    weeklyLosses: 0,
    ratingLastWeek: 1840,
  },
  {
    id: "p-marcus",
    payCashApp: "marcusatx",
    payVenmo: "marcus-atx",

    photoUrl: "/players/p-marcus.jpg",
    name: "Marcus Hale",
    handle: "mhale",
    city: "Austin",
    heightIn: 76,
    weightLb: 200,
    experienceYears: 10,
    rating: 1840,
    gamesPlayed: 55,
    sportsmanship: 4.8,
    reliability: 4.5,
    wins: 41,
    losses: 14,
    streak: 3,
    homeCourtId: "cat-zilker",
    availability: "available",
    bio: "Post-ups & midrange. Fair fouls only.",
    hue: 198,
    quietStart: 22,
    quietEnd: 7,
    pingsToday: 0,
    pingsDate: "",
    ignoreStreak: 0,
    preferredHour: 19,
    lastPlayedAt: new Date(Date.now() - 1 * 864e5).toISOString(),
    openToChallenges: true,
    dmPrivacy: "everyone",
    hideFromCatalog: false,
    challengesToday: 0,
    challengesDate: "",
    dmFirstToday: 0,
    dmFirstDate: "",
    rankLastWeek: 1,
    pointsScored: 1510,
    pointsAllowed: 1180,
    weeklyWins: 3,
    weeklyLosses: 1,
    ratingLastWeek: 1890,
  },
  {
    id: "p-jia",
    photoUrl: "/players/p-jia.jpg",
    name: "Jia Nguyen",
    handle: "jia_n",
    city: "Austin",
    heightIn: 68,
    weightLb: 145,
    experienceYears: 6,
    rating: 1710,
    gamesPlayed: 42,
    sportsmanship: 5.0,
    reliability: 4.8,
    wins: 33,
    losses: 19,
    streak: 1,
    homeCourtId: "cat-pease",
    availability: "available",
    bio: "Handles & threes. Quiet competitor.",
    hue: 280,
    quietStart: 21,
    quietEnd: 8,
    pingsToday: 0,
    pingsDate: "",
    ignoreStreak: 0,
    preferredHour: 17,
    lastPlayedAt: new Date(Date.now() - 2 * 864e5).toISOString(),
    openToChallenges: true,
    dmPrivacy: "everyone",
    hideFromCatalog: false,
    challengesToday: 0,
    challengesDate: "",
    dmFirstToday: 0,
    dmFirstDate: "",
    rankLastWeek: 6,
    pointsScored: 1100,
    pointsAllowed: 980,
    weeklyWins: 3,
    weeklyLosses: 1,
    ratingLastWeek: 1660,
  },
  {
    id: "p-devon",
    photoUrl: "/players/p-devon.jpg",
    name: "Devon Brooks",
    handle: "dbrooks",
    city: "Austin",
    heightIn: 79,
    weightLb: 220,
    experienceYears: 12,
    rating: 1960,
    gamesPlayed: 80,
    sportsmanship: 4.2,
    reliability: 4.0,
    wins: 58,
    losses: 22,
    streak: -1,
    homeCourtId: "cat-bartholomew",
    availability: "busy",
    bio: "Big wing. Prefer 6'3\"+.",
    hue: 12,
    quietStart: 22,
    quietEnd: 9,
    pingsToday: 0,
    pingsDate: "",
    ignoreStreak: 2,
    preferredHour: 20,
    lastPlayedAt: new Date(Date.now() - 3 * 864e5).toISOString(),
    openToChallenges: true,
    dmPrivacy: "everyone",
    hideFromCatalog: false,
    challengesToday: 0,
    challengesDate: "",
    dmFirstToday: 0,
    dmFirstDate: "",
    rankLastWeek: 2,
    pointsScored: 1720,
    pointsAllowed: 1400,
    weeklyWins: 1,
    weeklyLosses: 2,
    ratingLastWeek: 1980,
  },
  {
    id: "p-cam",
    photoUrl: "/players/p-cam.jpg",
    name: "Cam Ortiz",
    handle: "camo",
    city: "Austin",
    heightIn: 71,
    weightLb: 168,
    experienceYears: 3,
    rating: 1490,
    gamesPlayed: 18,
    sportsmanship: 4.5,
    reliability: 4.2,
    wins: 18,
    losses: 17,
    streak: 0,
    homeCourtId: "cat-battle-bend",
    availability: "available",
    bio: "Weekend warrior. Bring a ball.",
    hue: 145,
    quietStart: 23,
    quietEnd: 8,
    pingsToday: 0,
    pingsDate: "",
    ignoreStreak: 0,
    preferredHour: 10,
    lastPlayedAt: new Date(Date.now() - 5 * 864e5).toISOString(),
    openToChallenges: true,
    dmPrivacy: "everyone",
    hideFromCatalog: false,
    challengesToday: 0,
    challengesDate: "",
    dmFirstToday: 0,
    dmFirstDate: "",
    rankLastWeek: 10,
    pointsScored: 380,
    pointsAllowed: 410,
    weeklyWins: 1,
    weeklyLosses: 2,
    ratingLastWeek: 1510,
  },
  {
    id: "p-riley",
    photoUrl: "/players/p-riley.jpg",
    name: "Riley Cho",
    handle: "rcho",
    city: "Austin",
    heightIn: 74,
    weightLb: 178,
    experienceYears: 5,
    rating: 1625,
    gamesPlayed: 35,
    sportsmanship: 4.9,
    reliability: 4.6,
    wins: 27,
    losses: 15,
    streak: 4,
    homeCourtId: "cat-reed",
    availability: "available",
    bio: "Lockdown defense, team-first 1v1.",
    hue: 210,
    quietStart: 22,
    quietEnd: 7,
    pingsToday: 0,
    pingsDate: "",
    ignoreStreak: 0,
    preferredHour: 19,
    lastPlayedAt: new Date(Date.now() - 7 * 864e5).toISOString(),
    openToChallenges: true,
    dmPrivacy: "everyone",
    hideFromCatalog: false,
    challengesToday: 0,
    challengesDate: "",
    dmFirstToday: 0,
    dmFirstDate: "",
    rankLastWeek: 8,
    pointsScored: 900,
    pointsAllowed: 820,
    weeklyWins: 4,
    weeklyLosses: 0,
    ratingLastWeek: 1580,
  },
  {
    id: "p-andre",
    photoUrl: "/players/p-andre.jpg",
    name: "Andre Kline",
    handle: "akline",
    city: "Austin",
    heightIn: 81,
    weightLb: 235,
    experienceYears: 11,
    rating: 2010,
    gamesPlayed: 92,
    sportsmanship: 3.9,
    reliability: 4.3,
    wins: 64,
    losses: 28,
    streak: 2,
    homeCourtId: "cat-zaragoza",
    availability: "available",
    bio: "Paint monster. Don’t soft-call.",
    hue: 35,
    quietStart: 0,
    quietEnd: 6,
    pingsToday: 0,
    pingsDate: "",
    ignoreStreak: 0,
    preferredHour: 21,
    lastPlayedAt: new Date(Date.now() - 10 * 864e5).toISOString(),
    openToChallenges: true,
    dmPrivacy: "everyone",
    hideFromCatalog: false,
    challengesToday: 0,
    challengesDate: "",
    dmFirstToday: 0,
    dmFirstDate: "",
    rankLastWeek: 4,
    pointsScored: 1900,
    pointsAllowed: 1550,
    weeklyWins: 2,
    weeklyLosses: 1,
    ratingLastWeek: 1990,
  },
  {
    id: "p-sam",
    photoUrl: "/players/p-sam.jpg",
    name: "Sam Patel",
    handle: "spatel",
    city: "Austin",
    heightIn: 70,
    weightLb: 160,
    experienceYears: 2,
    rating: 1380,
    gamesPlayed: 12,
    sportsmanship: 4.7,
    reliability: 4.4,
    wins: 9,
    losses: 11,
    streak: -2,
    availability: "available",
    bio: "Learning the ladder. Fun first.",
    hue: 310,
    quietStart: 22,
    quietEnd: 8,
    pingsToday: 0,
    pingsDate: "",
    ignoreStreak: 0,
    preferredHour: 16,
    lastPlayedAt: new Date(Date.now() - 12 * 864e5).toISOString(),
    openToChallenges: true,
    dmPrivacy: "everyone",
    hideFromCatalog: false,
    challengesToday: 0,
    challengesDate: "",
    dmFirstToday: 0,
    dmFirstDate: "",
    rankLastWeek: 11,
    pointsScored: 250,
    pointsAllowed: 310,
    weeklyWins: 0,
    weeklyLosses: 2,
    ratingLastWeek: 1410,
  },
  {
    id: "p-tess",
    photoUrl: "/players/p-tess.jpg",
    name: "Tess Rivera",
    handle: "tessr",
    city: "Austin",
    heightIn: 67,
    weightLb: 140,
    experienceYears: 4,
    rating: 1580,
    gamesPlayed: 28,
    sportsmanship: 4.8,
    reliability: 4.9,
    wins: 22,
    losses: 16,
    streak: 1,
    homeCourtId: "cat-little-stacy",
    availability: "busy",
    bio: "Floater game. South Austin parks.",
    hue: 340,
    quietStart: 21,
    quietEnd: 7,
    pingsToday: 0,
    pingsDate: "",
    ignoreStreak: 0,
    preferredHour: 18,
    lastPlayedAt: new Date(Date.now() - 14 * 864e5).toISOString(),
    openToChallenges: true,
    dmPrivacy: "everyone",
    hideFromCatalog: false,
    challengesToday: 0,
    challengesDate: "",
    dmFirstToday: 0,
    dmFirstDate: "",
    rankLastWeek: 7,
    pointsScored: 720,
    pointsAllowed: 680,
    weeklyWins: 2,
    weeklyLosses: 1,
    ratingLastWeek: 1550,
  },
  {
    id: "p-noah",
    payCashApp: "noahhoops",

    photoUrl: "/players/p-noah.jpg",
    name: "Noah Bennett",
    handle: "nben",
    city: "Austin",
    heightIn: 75,
    weightLb: 190,
    experienceYears: 7,
    rating: 1755,
    gamesPlayed: 48,
    sportsmanship: 4.4,
    reliability: 4.6,
    wins: 36,
    losses: 20,
    streak: 0,
    homeCourtId: "cat-battle-bend",
    availability: "available",
    bio: "Evenings at Zilker / Battle Bend.",
    hue: 170,
    quietStart: 23,
    quietEnd: 8,
    pingsToday: 0,
    pingsDate: "",
    ignoreStreak: 0,
    preferredHour: 19,
    lastPlayedAt: new Date(Date.now() - 1 * 864e5).toISOString(),
    openToChallenges: true,
    dmPrivacy: "everyone",
    hideFromCatalog: false,
    challengesToday: 0,
    challengesDate: "",
    dmFirstToday: 0,
    dmFirstDate: "",
    rankLastWeek: 5,
    pointsScored: 1200,
    pointsAllowed: 1050,
    weeklyWins: 3,
    weeklyLosses: 0,
    ratingLastWeek: 1720,
  },
  {
    id: "p-kai",
    photoUrl: "/players/p-kai.jpg",
    name: "Kai Thompson",
    handle: "kait",
    city: "Austin",
    heightIn: 78,
    weightLb: 210,
    experienceYears: 9,
    rating: 1895,
    gamesPlayed: 70,
    sportsmanship: 4.6,
    reliability: 4.7,
    wins: 47,
    losses: 18,
    streak: 6,
    homeCourtId: "cat-northwest",
    availability: "available",
    bio: "Stretch four in a 1v1 suit.",
    hue: 240,
    quietStart: 22,
    quietEnd: 7,
    pingsToday: 0,
    pingsDate: "",
    ignoreStreak: 0,
    preferredHour: 20,
    lastPlayedAt: new Date(Date.now() - 4 * 864e5).toISOString(),
    openToChallenges: true,
    dmPrivacy: "everyone",
    hideFromCatalog: false,
    challengesToday: 0,
    challengesDate: "",
    dmFirstToday: 0,
    dmFirstDate: "",
    rankLastWeek: 4,
    pointsScored: 1650,
    pointsAllowed: 1280,
    weeklyWins: 5,
    weeklyLosses: 0,
    ratingLastWeek: 1850,
  },
];
```

## FILE: `src/lib/upset/squads.ts`

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SquadSize = 3 | 5;

export interface SquadMember {
  playerId: string;
  role: "captain" | "member";
  status: "active" | "invited";
}

export interface Squad {
  id: string;
  name: string;
  logo: string; // emoji or short code
  size: SquadSize;
  homeCourtId: string;
  homeCourtName: string;
  captainId: string;
  members: SquadMember[];
  record: { wins: number; losses: number; pointsFor: number; pointsAgainst: number };
  /** City squad rank last week (1 = best) */
  rankLastWeek: number;
  /** Current win streak (positive only for hottest) */
  streak: number;
  createdAt: string;
}

export interface SquadChallenge {
  id: string;
  fromSquadId: string;
  toSquadId: string;
  status: "pending" | "accepted" | "declined" | "played";
  at: string;
  courtName?: string;
}

interface SquadsState {
  mySquadId: string | null;
  squads: Squad[];
  challenges: SquadChallenge[];
  createSquad: (input: {
    name: string;
    logo: string;
    size: SquadSize;
    homeCourtId: string;
    homeCourtName: string;
    captainId: string;
  }) => Squad;
  inviteMember: (squadId: string, playerId: string) => void;
  acceptInvite: (squadId: string, playerId: string) => void;
  challengeSquad: (fromSquadId: string, toSquadId: string, courtName?: string) => void;
  respondChallenge: (
    challengeId: string,
    status: "accepted" | "declined",
  ) => void;
}

const SEED_SQUADS: Squad[] = [
  {
    id: "sq-east",
    name: "East Side Run",
    logo: "🔥",
    size: 5,
    homeCourtId: "cat-givens",
    homeCourtName: "Givens District Park",
    captainId: "p-sean",
    members: [
      { playerId: "p-sean", role: "captain", status: "active" },
      { playerId: "p-marcus", role: "member", status: "active" },
      { playerId: "p-jia", role: "member", status: "active" },
      { playerId: "p-kai", role: "member", status: "active" },
      { playerId: "p-devon", role: "member", status: "active" },
    ],
    record: { wins: 12, losses: 4, pointsFor: 148, pointsAgainst: 102 },
    rankLastWeek: 2,
    streak: 4,
    createdAt: "2026-06-01T12:00:00.000Z",
  },
  {
    id: "sq-south",
    name: "Battle Bend",
    logo: "⚡",
    size: 3,
    homeCourtId: "cat-battle-bend",
    homeCourtName: "Battle Bend Springs",
    captainId: "p-riley",
    members: [
      { playerId: "p-riley", role: "captain", status: "active" },
      { playerId: "p-cam", role: "member", status: "active" },
      { playerId: "p-tess", role: "member", status: "active" },
    ],
    record: { wins: 8, losses: 3, pointsFor: 96, pointsAgainst: 78 },
    rankLastWeek: 1,
    streak: 2,
    createdAt: "2026-07-01T12:00:00.000Z",
  },
  {
    id: "sq-zilker",
    name: "Zilker 5",
    logo: "🏀",
    size: 5,
    homeCourtId: "cat-zilker",
    homeCourtName: "Zilker Park",
    captainId: "p-andre",
    members: [
      { playerId: "p-andre", role: "captain", status: "active" },
      { playerId: "p-noah", role: "member", status: "active" },
      { playerId: "p-sam", role: "member", status: "active" },
    ],
    record: { wins: 5, losses: 6, pointsFor: 88, pointsAgainst: 94 },
    rankLastWeek: 4,
    streak: 0,
    createdAt: "2026-07-15T12:00:00.000Z",
  },
  {
    id: "sq-riverside",
    name: "Riverside Trios",
    logo: "🌊",
    size: 3,
    homeCourtId: "cat-zilker",
    homeCourtName: "Zilker Park",
    captainId: "p-jia",
    members: [
      { playerId: "p-jia", role: "captain", status: "active" },
      { playerId: "p-noah", role: "member", status: "active" },
      { playerId: "p-sam", role: "member", status: "active" },
    ],
    record: { wins: 9, losses: 5, pointsFor: 110, pointsAgainst: 98 },
    rankLastWeek: 2,
    streak: 3,
    createdAt: "2026-07-20T12:00:00.000Z",
  },
];

function uid(p: string) {
  return `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export const useSquads = create<SquadsState>()(
  persist(
    (set, get) => ({
      mySquadId: null,
      squads: SEED_SQUADS,
      challenges: [],
      createSquad: (input) => {
        const squad: Squad = {
          id: uid("sq"),
          name: input.name.trim(),
          logo: input.logo,
          size: input.size,
          homeCourtId: input.homeCourtId,
          homeCourtName: input.homeCourtName,
          captainId: input.captainId,
          members: [
            {
              playerId: input.captainId,
              role: "captain",
              status: "active",
            },
          ],
          record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 },
          rankLastWeek: 99,
          streak: 0,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          squads: [squad, ...s.squads.filter((x) => x.captainId !== input.captainId)],
          mySquadId: squad.id,
        }));
        return squad;
      },
      inviteMember: (squadId, playerId) => {
        set((s) => ({
          squads: s.squads.map((sq) => {
            if (sq.id !== squadId) return sq;
            if (sq.members.some((m) => m.playerId === playerId)) return sq;
            if (sq.members.filter((m) => m.status === "active" || m.status === "invited").length >= sq.size)
              return sq;
            return {
              ...sq,
              members: [
                ...sq.members,
                { playerId, role: "member", status: "invited" },
              ],
            };
          }),
        }));
      },
      acceptInvite: (squadId, playerId) => {
        set((s) => ({
          squads: s.squads.map((sq) =>
            sq.id !== squadId
              ? sq
              : {
                  ...sq,
                  members: sq.members.map((m) =>
                    m.playerId === playerId
                      ? { ...m, status: "active" as const }
                      : m,
                  ),
                },
          ),
          mySquadId: get().mySquadId ?? squadId,
        }));
      },
      challengeSquad: (fromSquadId, toSquadId, courtName) => {
        const ch: SquadChallenge = {
          id: uid("sc"),
          fromSquadId,
          toSquadId,
          status: "pending",
          at: new Date().toISOString(),
          courtName,
        };
        set((s) => ({ challenges: [ch, ...s.challenges] }));
      },
      respondChallenge: (challengeId, status) => {
        set((s) => ({
          challenges: s.challenges.map((c) =>
            c.id === challengeId ? { ...c, status } : c,
          ),
        }));
      },
    }),
    { name: "upset-squads-v3" },
  ),
);
```

## FILE: `src/lib/upset/stakes.ts`

```ts
import type { MatchGame, MatchStakes, Player, StakeMode } from "./types";

export const ALZHEIMERS_CHARITY = {
  name: "Alzheimer's Association",
  short: "Alzheimer's research",
  url: "https://www.alz.org/donate",
} as const;

/** Max named stakes price (USD) */
export const MAX_STAKE_DOLLARS = 5000;
export const MIN_STAKE_DOLLARS = 1;

export const STAKE_MODE_LABEL: Record<StakeMode, string> = {
  fun: "Just for fun",
  stakes: "Money on the line",
  charity: "Play for charity",
};

export type SettleMethodId =
  | "cashapp"
  | "venmo"
  | "zelle"
  | "cash"
  | "charity";

/** Sum of point margins across every game. 10–2 + 10–5 → 13 */
export function seriesMarginPoints(scores: MatchGame[]): number {
  return scores.reduce((n, g) => n + Math.abs(g.a - g.b), 0);
}

export function hostWonSeries(scores: MatchGame[]): boolean {
  const hostGames = scores.reduce((n, g) => n + (g.a > g.b ? 1 : 0), 0);
  const oppGames = scores.reduce((n, g) => n + (g.b > g.a ? 1 : 0), 0);
  return hostGames > oppGames;
}

export function computeStakePayout(
  stakes: MatchStakes,
  scores: MatchGame[],
  hostId: string,
  opponentId: string,
): MatchStakes {
  if (stakes.mode === "fun") return { ...stakes };
  const hostWon = hostWonSeries(scores);
  const winnerId = hostWon ? hostId : opponentId;
  const loserId = hostWon ? opponentId : hostId;

  // Stakes = name your price (fixed)
  if (stakes.mode === "stakes") {
    const raw = Number(stakes.fixedPriceDollars ?? stakes.amountDollars ?? 0);
    const amountDollars =
      Math.round(
        Math.min(MAX_STAKE_DOLLARS, Math.max(MIN_STAKE_DOLLARS, raw)) * 100,
      ) / 100;
    return {
      ...stakes,
      fixedPriceDollars: amountDollars,
      amountDollars,
      totalMarginPoints: seriesMarginPoints(scores),
      winnerId,
      loserId,
      settled: false,
    };
  }

  // Charity = margin-based
  const totalMarginPoints = seriesMarginPoints(scores);
  let amountDollars = totalMarginPoints * (stakes.dollarsPerPoint || 1);
  if (stakes.capDollars != null) {
    amountDollars = Math.min(amountDollars, stakes.capDollars);
  }
  amountDollars = Math.round(amountDollars * 100) / 100;
  return {
    ...stakes,
    totalMarginPoints,
    amountDollars,
    winnerId,
    loserId,
    settled: false,
  };
}

export function stakesChipLabel(stakes?: MatchStakes | null): string | null {
  const parts = stakesChipParts(stakes);
  if (!parts) return null;
  return parts.money ? `${parts.kind} · ${parts.money}` : parts.kind;
}

/** Split kind + money for green money styling in UI */
export function stakesChipParts(
  stakes?: MatchStakes | null,
): { kind: string; money: string | null } | null {
  if (!stakes || stakes.mode === "fun") return null;
  if (stakes.mode === "charity") {
    const unit =
      stakes.dollarsPerPoint === 1 ? "$1/pt" : `$${stakes.dollarsPerPoint}/pt`;
    return { kind: "Charity", money: unit };
  }
  const price = stakes.fixedPriceDollars ?? stakes.amountDollars;
  if (price != null && price > 0) {
    return { kind: "Stakes", money: formatMoney(price) };
  }
  return { kind: "Stakes", money: null };
}

export function stakesExplain(stakes?: MatchStakes | null): string {
  if (!stakes || stakes.mode === "fun") {
    return "Just for fun — rating only, no money.";
  }
  if (stakes.mode === "charity") {
    const unit = stakes.dollarsPerPoint;
    const cap =
      stakes.capDollars != null ? ` Cap ${formatMoney(stakes.capDollars)}.` : "";
    return `Loser donates ${formatMoney(unit)} per point of total series margin to ${stakes.charityName ?? "charity"} (e.g. 10–2 + 10–5 = $13).${cap}`;
  }
  const price = stakes.fixedPriceDollars ?? stakes.amountDollars ?? 0;
  return `Name your price: loser pays winner ${formatMoney(price)} after scores confirm. Peer settle privately — Upset City never holds money.`;
}

export function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`;
}

export function moneyAmountString(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function cleanHandle(raw?: string | null): string {
  if (!raw) return "";
  return raw.trim().replace(/^\$/, "").replace(/^@/, "");
}

/** Build best-effort deep links / copy payloads for private peer settle */
export function settleTargets(
  method: SettleMethodId,
  amount: number,
  payee: Player | null | undefined,
  stakes: MatchStakes,
  note: string,
): {
  openUrl?: string;
  copyPrimary: string;
  copyLabel: string;
  hint: string;
} {
  const amt = moneyAmountString(amount);
  const cash = cleanHandle(payee?.payCashApp);
  const venmo = cleanHandle(payee?.payVenmo);
  const zelle = (payee?.payZelle ?? "").trim();

  if (method === "charity") {
    return {
      openUrl: stakes.charityUrl ?? ALZHEIMERS_CHARITY.url,
      copyPrimary: amt,
      copyLabel: "Copy amount",
      hint: "Donate on the charity site, then mark complete. Upset City never holds your money.",
    };
  }
  if (method === "cashapp") {
    const url = cash
      ? `https://cash.app/$${encodeURIComponent(cash)}/${amt}`
      : undefined;
    return {
      openUrl: url,
      copyPrimary: cash ? `$${cash}` : amt,
      copyLabel: cash ? "Copy $cashtag" : "Copy amount",
      hint: cash
        ? `Send ${formatMoney(amount)} to $${cash} on Cash App.`
        : "Copy the amount, open Cash App, send to the winner. Ask them for their $cashtag if needed.",
    };
  }
  if (method === "venmo") {
    const params = new URLSearchParams({
      txn: "pay",
      amount: amt,
      note: note.slice(0, 50),
    });
    const url = venmo
      ? `https://venmo.com/${encodeURIComponent(venmo)}?${params}`
      : undefined;
    return {
      openUrl: url,
      copyPrimary: venmo ? `@${venmo}` : amt,
      copyLabel: venmo ? "Copy Venmo" : "Copy amount",
      hint: venmo
        ? `Send ${formatMoney(amount)} to @${venmo}. Set the payment to Private.`
        : "Copy amount → Venmo → pay the winner → set to Private.",
    };
  }
  if (method === "zelle") {
    return {
      copyPrimary: zelle || amt,
      copyLabel: zelle ? "Copy Zelle contact" : "Copy amount",
      hint: zelle
        ? `Zelle ${formatMoney(amount)} to ${zelle} from your bank app.`
        : "Copy amount, open your bank’s Zelle, send to the winner.",
    };
  }
  // cash
  return {
    copyPrimary: amt,
    copyLabel: "Copy amount",
    hint: `Pay ${formatMoney(amount)} in cash at the court. Tap settled when done.`,
  };
}
```

## FILE: `src/lib/upset/store.ts`

```ts
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { namedAustinCourts } from "@/lib/courts/catalog";
import { displayRating, rateSeries } from "@/lib/rating/engine";
import { SEED_PLAYERS } from "@/lib/upset/seed-players";
import {
  ALZHEIMERS_CHARITY,
  computeStakePayout,
  formatMoney,
} from "@/lib/upset/stakes";
import { useMediaFeed } from "@/lib/upset/media-feed";
import { useCampaign } from "@/lib/upset/campaign";
import type {
  CancelLogEntry,
  ChatMessage,
  CourtMeta,
  DirectThread,
  Match,
  MatchGame,
  Player,
  PlayerReview,
  UpsetState,
} from "@/lib/upset/types";

const STORAGE_KEY = "upset-city-v21";
const SEED_VERSION = 21;

function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function isKingActive(meta: CourtMeta, now = Date.now()) {
  if (!meta.kingId || !meta.kingLastPlayedAt) return false;
  const ttl = (meta.crownTtlDays ?? 14) * 86400e3;
  return now - new Date(meta.kingLastPlayedAt).getTime() < ttl;
}

export { isKingActive };

function seedMatches(players: Player[]): Match[] {
  const now = Date.now();
  const fri = new Date(now);
  fri.setDate(fri.getDate() + ((5 - fri.getDay() + 7) % 7 || 7));
  fri.setHours(19, 0, 0, 0);

  const host = (id: string) => players.find((p) => p.id === id)!;

  return [
    {
      id: "m-seed-1",
      kind: "broadcast",
      format: "1v1",
      allowGuestInvites: false,
      hostId: "p-sean",
      courtId: "cat-givens",
      courtName: "Givens District Park",
      lat: 30.258,
      lon: -97.71,
      preferredAt: new Date(now + 2 * 3600e3).toISOString(),
      status: "open",
      notes: "Charity 1v1 for Alzheimer's · best of 3 to 11. Looking for someone around 6'0–6'3 — clean ball.",
      stakes: {
        mode: "charity",
        dollarsPerPoint: 1,
        charityName: ALZHEIMERS_CHARITY.name,
        charityUrl: ALZHEIMERS_CHARITY.url,
      },
      filters: {
        heightMinIn: 60,
        heightMaxIn: 84,
        ratingMin: 1400,
        ratingMax: 2100,
        sportsmanshipMin: 3.5,
        radiusMiles: 12,
      },
      predictions: {},
      comments: [],
      chat: [],
      createdAt: new Date(now - 3600e3).toISOString(),
    },
    {
      id: "m-seed-2",
      kind: "broadcast",
      format: "horse",
      allowGuestInvites: true,
      hostId: "p-noah",
      courtId: "cat-battle-bend",
      courtName: "Battle Bend Park Courts",
      lat: 30.215,
      lon: -97.77,
      preferredAt: fri.toISOString(),
      status: "open",
      notes: "HORSE for Alzheimer's research · outdoor · clean calls. All skill levels.",
      stakes: {
        mode: "charity",
        dollarsPerPoint: 1,
        charityName: ALZHEIMERS_CHARITY.name,
        charityUrl: ALZHEIMERS_CHARITY.url,
      },
      filters: {
        heightMinIn: 60,
        heightMaxIn: 84,
        ratingMin: 1500,
        ratingMax: 2000,
        sportsmanshipMin: 3.5,
        radiusMiles: 15,
      },
      predictions: {},
      comments: [],
      chat: [],
      createdAt: new Date(now - 7200e3).toISOString(),
    },
    {
      id: "m-seed-3",
      kind: "broadcast",
      format: "1v1",
      allowGuestInvites: true,
      hostId: "p-kai",
      courtId: "cat-zilker",
      courtName: "Zilker Park Courts",
      lat: 30.2669,
      lon: -97.7729,
      preferredAt: new Date(fri.getTime() + 86400e3).toISOString(),
      status: "open",
      notes: "Best of 3 · games to 11 · make it take it.",
      stakes: { mode: "fun", dollarsPerPoint: 1 },
      filters: {
        heightMinIn: 60,
        heightMaxIn: 90,
        ratingMin: 1300,
        ratingMax: 2200,
        sportsmanshipMin: 3,
        radiusMiles: 20,
      },
      predictions: {},
      comments: [],
      chat: [],
      createdAt: new Date(now - 1800e3).toISOString(),
    },
    {
      id: "m-seed-upcoming",
      kind: "broadcast",
      format: "1v1",
      allowGuestInvites: false,
      hostId: "p-marcus",
      opponentId: "p-you",
      courtId: "cat-rosewood",
      courtName: "Rosewood Park Courts",
      lat: 30.2705,
      lon: -97.7195,
      preferredAt: new Date(now + 26 * 3600e3).toISOString(),
      scheduledAt: new Date(now + 26 * 3600e3).toISOString(),
      acceptedAt: new Date(now - 900e3).toISOString(),
      status: "scheduled",
      notes: "Best of 3 · games to 11 · make it take it.",
      stakes: {
        mode: "charity",
        dollarsPerPoint: 1,
        charityName: ALZHEIMERS_CHARITY.name,
        charityUrl: ALZHEIMERS_CHARITY.url,
      },
      filters: {
        heightMinIn: 60,
        heightMaxIn: 84,
        ratingMin: 1400,
        ratingMax: 2000,
        sportsmanshipMin: 3.5,
        radiusMiles: 12,
      },
      predictions: {},
      comments: [],
      chat: [
        {
          id: "c-seed-u1",
          authorName: "Marcus",
          text: "See you at Rosewood.",
          at: new Date(now - 800e3).toISOString(),
        },
      ],
      createdAt: new Date(now - 3 * 3600e3).toISOString(),
    },
    // Past confirmed results — scouting / mutual opponents
    {
      id: "m-hist-1",
      kind: "broadcast",
      format: "1v1",
      hostId: "p-sean",
      opponentId: "p-kai",
      courtId: "cat-givens",
      courtName: "Givens District Park",
      lat: 30.258,
      lon: -97.71,
      preferredAt: new Date(now - 12 * 86400e3).toISOString(),
      scheduledAt: new Date(now - 12 * 86400e3).toISOString(),
      status: "confirmed",
      notes: "Best of 3 · games to 11 · make it take it.",
      scores: [
        { a: 11, b: 7 },
        { a: 11, b: 9 },
      ],
      filters: {
        heightMinIn: 60,
        heightMaxIn: 84,
        ratingMin: 1400,
        ratingMax: 2100,
        sportsmanshipMin: 3.5,
        radiusMiles: 12,
      },
      predictions: {},
      comments: [],
      chat: [],
      createdAt: new Date(now - 13 * 86400e3).toISOString(),
    },
    {
      id: "m-hist-2",
      kind: "broadcast",
      format: "1v1",
      hostId: "p-you",
      opponentId: "p-kai",
      courtId: "cat-battle-bend",
      courtName: "Battle Bend Park Courts",
      lat: 30.215,
      lon: -97.77,
      preferredAt: new Date(now - 8 * 86400e3).toISOString(),
      scheduledAt: new Date(now - 8 * 86400e3).toISOString(),
      status: "confirmed",
      notes: "Best of 3 · games to 11 · make it take it.",
      scores: [
        { a: 11, b: 8 },
        { a: 9, b: 11 },
        { a: 11, b: 6 },
      ],
      filters: {
        heightMinIn: 60,
        heightMaxIn: 84,
        ratingMin: 1400,
        ratingMax: 2100,
        sportsmanshipMin: 3.5,
        radiusMiles: 12,
      },
      predictions: {},
      comments: [],
      chat: [],
      createdAt: new Date(now - 9 * 86400e3).toISOString(),
    },
    {
      id: "m-hist-3",
      kind: "broadcast",
      format: "1v1",
      hostId: "p-noah",
      opponentId: "p-you",
      courtId: "cat-zilker",
      courtName: "Zilker Park Courts",
      lat: 30.2669,
      lon: -97.7729,
      preferredAt: new Date(now - 5 * 86400e3).toISOString(),
      scheduledAt: new Date(now - 5 * 86400e3).toISOString(),
      status: "confirmed",
      notes: "Best of 3 · games to 11 · make it take it.",
      scores: [
        { a: 11, b: 5 },
        { a: 11, b: 9 },
      ],
      filters: {
        heightMinIn: 60,
        heightMaxIn: 84,
        ratingMin: 1400,
        ratingMax: 2100,
        sportsmanshipMin: 3.5,
        radiusMiles: 12,
      },
      predictions: {},
      comments: [],
      chat: [],
      createdAt: new Date(now - 6 * 86400e3).toISOString(),
    },
    {
      id: "m-hist-4",
      kind: "broadcast",
      format: "1v1",
      hostId: "p-sean",
      opponentId: "p-noah",
      courtId: "cat-givens",
      courtName: "Givens District Park",
      lat: 30.258,
      lon: -97.71,
      preferredAt: new Date(now - 4 * 86400e3).toISOString(),
      scheduledAt: new Date(now - 4 * 86400e3).toISOString(),
      status: "confirmed",
      notes: "Best of 3 · games to 11 · make it take it.",
      scores: [
        { a: 11, b: 10 },
        { a: 8, b: 11 },
        { a: 11, b: 7 },
      ],
      filters: {
        heightMinIn: 60,
        heightMaxIn: 84,
        ratingMin: 1400,
        ratingMax: 2100,
        sportsmanshipMin: 3.5,
        radiusMiles: 12,
      },
      predictions: {},
      comments: [],
      chat: [],
      createdAt: new Date(now - 4.5 * 86400e3).toISOString(),
    },
    {
      id: "m-hist-5",
      kind: "broadcast",
      format: "1v1",
      hostId: "p-marcus",
      opponentId: "p-sean",
      courtId: "cat-rosewood",
      courtName: "Rosewood Park Courts",
      lat: 30.2705,
      lon: -97.7195,
      preferredAt: new Date(now - 10 * 86400e3).toISOString(),
      scheduledAt: new Date(now - 10 * 86400e3).toISOString(),
      status: "confirmed",
      notes: "Best of 3 · games to 11 · make it take it.",
      scores: [
        { a: 11, b: 6 },
        { a: 11, b: 9 },
      ],
      filters: {
        heightMinIn: 60,
        heightMaxIn: 84,
        ratingMin: 1400,
        ratingMax: 2100,
        sportsmanshipMin: 3.5,
        radiusMiles: 12,
      },
      predictions: {},
      comments: [],
      chat: [],
      createdAt: new Date(now - 11 * 86400e3).toISOString(),
    },
    {
      id: "m-hist-6",
      kind: "broadcast",
      format: "1v1",
      hostId: "p-you",
      opponentId: "p-marcus",
      courtId: "cat-battle-bend",
      courtName: "Battle Bend Park Courts",
      lat: 30.215,
      lon: -97.77,
      preferredAt: new Date(now - 15 * 86400e3).toISOString(),
      scheduledAt: new Date(now - 15 * 86400e3).toISOString(),
      status: "confirmed",
      notes: "Best of 3 · games to 11 · make it take it.",
      scores: [
        { a: 7, b: 11 },
        { a: 11, b: 9 },
        { a: 8, b: 11 },
      ],
      filters: {
        heightMinIn: 60,
        heightMaxIn: 84,
        ratingMin: 1400,
        ratingMax: 2100,
        sportsmanshipMin: 3.5,
        radiusMiles: 12,
      },
      predictions: {},
      comments: [],
      chat: [],
      createdAt: new Date(now - 16 * 86400e3).toISOString(),
    },
    {
      id: "m-hist-7",
      kind: "broadcast",
      format: "1v1",
      hostId: "p-kai",
      opponentId: "p-noah",
      courtId: "cat-zilker",
      courtName: "Zilker Park Courts",
      lat: 30.2669,
      lon: -97.7729,
      preferredAt: new Date(now - 3 * 86400e3).toISOString(),
      scheduledAt: new Date(now - 3 * 86400e3).toISOString(),
      status: "confirmed",
      notes: "Best of 3 · games to 11 · make it take it.",
      scores: [
        { a: 11, b: 4 },
        { a: 11, b: 8 },
      ],
      filters: {
        heightMinIn: 60,
        heightMaxIn: 84,
        ratingMin: 1400,
        ratingMax: 2100,
        sportsmanshipMin: 3.5,
        radiusMiles: 12,
      },
      predictions: {},
      comments: [],
      chat: [],
      createdAt: new Date(now - 3.2 * 86400e3).toISOString(),
    },
  ].map((m) => {
    void host(m.hostId);
    return m as Match;
  });
}

function seedReviews(): PlayerReview[] {
  const now = Date.now();
  return [
    {
      id: "rv-1",
      targetId: "p-sean",
      authorId: "p-kai",
      authorName: "Kai",
      stars: 5,
      text: "Clean game, calls his own fouls. Tough from midrange.",
      at: new Date(now - 11 * 86400e3).toISOString(),
    },
    {
      id: "rv-2",
      targetId: "p-sean",
      authorId: "p-noah",
      authorName: "Noah",
      stars: 4,
      text: "Strong, physical. Respectful after the run. Want a rematch.",
      at: new Date(now - 3 * 86400e3).toISOString(),
    },
    {
      id: "rv-3",
      targetId: "p-noah",
      authorId: "p-you",
      authorName: "You",
      stars: 5,
      text: "Quick first step. Really good IQ — hard to stop once he gets going.",
      at: new Date(now - 4 * 86400e3).toISOString(),
    },
    {
      id: "rv-4",
      targetId: "p-noah",
      authorId: "p-sean",
      authorName: "Sean Rivera",
      stars: 4,
      text: "Smooth handle. Competes hard without being dirty.",
      at: new Date(now - 4 * 86400e3).toISOString(),
    },
    {
      id: "rv-5",
      targetId: "p-kai",
      authorId: "p-sean",
      authorName: "Sean Rivera",
      stars: 5,
      text: "Long and athletic. Gets to every loose ball.",
      at: new Date(now - 12 * 86400e3).toISOString(),
    },
    {
      id: "rv-6",
      targetId: "p-kai",
      authorId: "p-you",
      authorName: "You",
      stars: 4,
      text: "Can score in bunches. Good sport after a close series.",
      at: new Date(now - 7 * 86400e3).toISOString(),
    },
    {
      id: "rv-7",
      targetId: "p-marcus",
      authorId: "p-you",
      authorName: "You",
      stars: 5,
      text: "Dog. Hits big shots. Shows up on time every run.",
      at: new Date(now - 14 * 86400e3).toISOString(),
    },
    {
      id: "rv-8",
      targetId: "p-marcus",
      authorId: "p-sean",
      authorName: "Sean Rivera",
      stars: 4,
      text: "Aggressive finisher. Talks a little but backs it up.",
      at: new Date(now - 9 * 86400e3).toISOString(),
    },
  ];
}

function seedCourtMeta(players: Player[]): Record<string, CourtMeta> {
  const now = new Date().toISOString();
  const meta: Record<string, CourtMeta> = {};
  for (const p of players) {
    if (!p.homeCourtId) continue;
    if (!meta[p.homeCourtId]) {
      meta[p.homeCourtId] = {
        courtId: p.homeCourtId,
        kingId: p.id,
        kingLastPlayedAt: now,
        chat: [
          {
            id: uid("chat"),
            authorName: "Upset City",
            text: "Court chat is live. Keep it clean.",
            at: now,
            system: true,
          },
        ],
        crownTtlDays: 14,
      };
    }
  }
  // strong kings
  for (const [courtId, kingId] of [
    ["cat-givens", "p-sean"],
    ["cat-zilker", "p-kai"],
    ["cat-battle-bend", "p-andre"],
  ] as const) {
    meta[courtId] = {
      courtId,
      kingId,
      kingLastPlayedAt: now,
      chat: meta[courtId]?.chat ?? [],
      crownTtlDays: 14,
    };
  }
  return meta;
}

function defaultState(): UpsetState {
  const players = SEED_PLAYERS.map((p) => ({ ...p }));
  return {
    players,
    matches: seedMatches(players),
    courtMeta: seedCourtMeta(players),
    meId: "p-you",
    leagueChat: [],
    dmThreads: [],
    blockedIds: [],
    friendIds: ["p-sean", "p-riley", "p-jia", "p-marcus"],
    reports: [],
    playerReviews: seedReviews(),
    cancelLog: [],
    crownTtlDays: 14,
    seedVersion: SEED_VERSION,
  };
}

function load(): UpsetState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as UpsetState;
    if (!parsed.seedVersion || parsed.seedVersion < SEED_VERSION) {
      return defaultState();
    }
    // merge seed players
    const byId = new Map(parsed.players.map((p) => [p.id, p]));
    for (const p of SEED_PLAYERS) {
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
    return {
      ...defaultState(),
      ...parsed,
      players: Array.from(byId.values()),
      matches: Array.isArray(parsed.matches) ? parsed.matches : defaultState().matches,
      courtMeta: parsed.courtMeta ?? defaultState().courtMeta,
      dmThreads: Array.isArray(parsed.dmThreads) ? parsed.dmThreads : [],
      blockedIds: Array.isArray(parsed.blockedIds) ? parsed.blockedIds : [],
      friendIds: Array.isArray(parsed.friendIds) ? parsed.friendIds : ["p-sean", "p-riley", "p-jia", "p-marcus"],
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      playerReviews: Array.isArray(parsed.playerReviews)
        ? parsed.playerReviews
        : defaultState().playerReviews,
      cancelLog: Array.isArray(parsed.cancelLog)
        ? parsed.cancelLog
        : [],
      meId: parsed.meId || "p-you",
      seedVersion: SEED_VERSION,
    };
  } catch {
    return defaultState();
  }
}

let state: UpsetState = defaultState();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

function setState(updater: (s: UpsetState) => UpsetState) {
  state = updater(state);
  persist();
  emit();
}

function getSnap() {
  return state;
}

export function formatLocalWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function useUpsetStore() {
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getSnap,
    getSnap,
  );

  // hydrate once on client
  useEffect(() => {
    if (hydrated) return;
    hydrated = true;
    const loaded = load();
    state = loaded;
    emit();
  }, []);

  const me = snap.players.find((p) => p.id === snap.meId) ?? snap.players[0]!;

  const leaderboard = [...snap.players]
    .filter((p) => p.city === "Austin")
    .sort((a, b) => b.rating - a.rating);

  const openMatches = snap.matches
    .filter((m) => m.status === "open")
    .sort((a, b) => a.preferredAt.localeCompare(b.preferredAt));

  const scheduledMatches = snap.matches
    .filter((m) => m.status === "scheduled" || m.status === "matched")
    .sort((a, b) =>
      (a.scheduledAt ?? a.preferredAt).localeCompare(
        b.scheduledAt ?? b.preferredAt,
      ),
    );

  const catalogPlayers = snap.players.filter(
    (p) => !p.hideFromCatalog && p.id !== snap.meId && !snap.blockedIds.includes(p.id),
  );

  const playerById = useCallback(
    (id: string) => snap.players.find((p) => p.id === id),
    [snap.players],
  );

  const courtKing = useCallback(
    (courtId: string) => {
      const m = snap.courtMeta[courtId];
      if (!m?.kingId || !isKingActive(m)) return null;
      return snap.players.find((p) => p.id === m.kingId) ?? null;
    },
    [snap.courtMeta, snap.players],
  );

  const ratedAtCourt = useCallback(
    (courtId: string) => {
      return snap.players.filter(
        (p) =>
          p.homeCourtId === courtId || snap.courtMeta[courtId]?.kingId === p.id,
      ).length;
    },
    [snap.players, snap.courtMeta],
  );

  const openAtCourt = useCallback(
    (courtId: string) =>
      snap.matches.filter((m) => m.courtId === courtId && m.status === "open")
        .length,
    [snap.matches],
  );

  const nextGameAtCourt = useCallback(
    (courtId: string) => {
      const list = snap.matches
        .filter(
          (m) =>
            m.courtId === courtId &&
            (m.status === "open" ||
              m.status === "scheduled" ||
              m.status === "matched"),
        )
        .sort((a, b) =>
          (a.scheduledAt ?? a.preferredAt).localeCompare(
            b.scheduledAt ?? b.preferredAt,
          ),
        );
      return list[0] ?? null;
    },
    [snap.matches],
  );

  const createQuickMatch = useCallback(
    (input: {
      courtId: string;
      courtName: string;
      lat: number;
      lon: number;
      preferredAt: string;
      filters: Match["filters"];
      format?: Match["format"];
      notes?: string;
      allowGuestInvites?: boolean;
      stakes?: Match["stakes"];
    }) => {
      const stakes = input.stakes ?? { mode: "fun" as const, dollarsPerPoint: 1 };
      const stakeLine =
        stakes.mode === "charity"
          ? `Feeds Austin's $50k Alzheimer's goal · $${stakes.dollarsPerPoint}/pt margin donation`
          : stakes.mode === "stakes"
            ? `Peer stakes · $${stakes.fixedPriceDollars ?? "?"} (not the default path)`
            : "Just for fun · rating only";
      const match: Match = {
        id: uid("m"),
        kind: "broadcast",
        hostId: state.meId,
        courtId: input.courtId,
        courtName: input.courtName,
        lat: input.lat,
        lon: input.lon,
        preferredAt: input.preferredAt,
        status: "open",
        format: input.format ?? "1v1",
        allowGuestInvites: input.allowGuestInvites ?? false,
        rosterIds: [],
        guestInviteIds: [],
        notes: input.notes ?? "Best of 3 · games to 11 · make it take it",
        stakes,
        filters: input.filters,
        predictions: {},
        comments: [],
        chat: [
          {
            id: uid("sys"),
            authorName: "Upset City",
            text: `Quick Match posted. ${stakeLine}`,
            at: new Date().toISOString(),
            system: true,
          },
        ],
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({ ...s, matches: [match, ...s.matches] }));
      return match;
    },
    [],
  );

  const updateMatchNotes = useCallback((matchId: string, notes: string) => {
    setState((s) => ({
      ...s,
      matches: s.matches.map((m) =>
        m.id === matchId && m.hostId === s.meId
          ? { ...m, notes: notes.trim() }
          : m,
      ),
    }));
  }, []);

  const acceptMatch = useCallback((matchId: string) => {
    setState((s) => {
      const m = s.matches.find((x) => x.id === matchId);
      if (!m || m.status !== "open" || m.hostId === s.meId) return s;
      return {
        ...s,
        matches: s.matches.map((x) =>
          x.id === matchId
            ? {
                ...x,
                status: "scheduled" as const,
                opponentId: s.meId,
                rosterIds: [...new Set([...(x.rosterIds ?? []), s.meId])],
                scheduledAt: x.preferredAt,
                acceptedAt: new Date().toISOString(),
              }
            : x,
        ),
      };
    });
  }, []);

  const tryAcceptRace = useCallback(
    (matchId: string): "ok" | "filled" => {
      const m = state.matches.find((x) => x.id === matchId);
      if (!m || m.status !== "open") return "filled";
      acceptMatch(matchId);
      return "ok";
    },
    [acceptMatch],
  );

  /**
   * Cancel rules:
   * - Host + no one joined (open, no opponent): free cancel, no reason, no penalty.
   * - Host + someone joined: reason required → sent to opponent; >3 such host
   *   cancels in 30 days → sportsmanship hit.
   * - Non-host: reason required; ≤24h before tip = late; >3 late in 30 days → hit.
   */
  const cancelMatch = useCallback(
    (
      matchId: string,
      reason: string = "",
    ): {
      ok: true;
      late: boolean;
      sportsmanshipHit: number;
      lateCancelsThisMonth: number;
      kind: "host_empty" | "host_after_join" | "player";
    } | { ok: false; reason: string } => {
      let result:
        | {
            ok: true;
            late: boolean;
            sportsmanshipHit: number;
            lateCancelsThisMonth: number;
            kind: "host_empty" | "host_after_join" | "player";
          }
        | { ok: false; reason: string } = {
        ok: false,
        reason: "Can't cancel this game.",
      };

      setState((s) => {
        const m = s.matches.find((x) => x.id === matchId);
        if (!m) {
          result = { ok: false, reason: "Game not found." };
          return s;
        }
        const isHost = m.hostId === s.meId;
        const party =
          isHost ||
          m.opponentId === s.meId ||
          (m.rosterIds ?? []).includes(s.meId);
        if (!party) {
          result = { ok: false, reason: "You're not on this game." };
          return s;
        }
        if (
          m.status === "cancelled" ||
          m.status === "confirmed" ||
          m.status === "disputed"
        ) {
          result = { ok: false, reason: "This game can't be cancelled." };
          return s;
        }

        const someoneJoined =
          !!m.opponentId ||
          (m.rosterIds ?? []).some((id) => id !== m.hostId) ||
          m.status === "matched" ||
          m.status === "scheduled";

        if (isHost && !someoneJoined) {
          const meP = s.players.find((p) => p.id === s.meId);
          result = {
            ok: true,
            late: false,
            sportsmanshipHit: 0,
            lateCancelsThisMonth: 0,
            kind: "host_empty",
          };
          return {
            ...s,
            matches: s.matches.map((x) =>
              x.id !== matchId
                ? x
                : {
                    ...x,
                    status: "cancelled" as const,
                    cancelledBy: s.meId,
                    cancelReason: "Listing closed by host (no one had joined).",
                    cancelledAt: new Date().toISOString(),
                    cancelWasLate: false,
                    chat: [
                      ...x.chat,
                      {
                        id: uid("sys"),
                        authorName: "Upset City",
                        authorId: s.meId,
                        text: `${meP?.name ?? "Host"} closed this open game. No one had joined — no penalty.`,
                        at: new Date().toISOString(),
                        system: true,
                      },
                    ],
                  },
            ),
          };
        }

        const body = reason.trim();
        if (body.length < 3) {
          result = {
            ok: false,
            reason: isHost
              ? "Someone already joined — write a reason so they know why."
              : "Write a short reason so the host knows why.",
          };
          return s;
        }

        const tip = new Date(m.scheduledAt ?? m.preferredAt).getTime();
        const hoursUntil = (tip - Date.now()) / 3600e3;
        const late = !isHost && hoursUntil <= 24;
        const monthAgo = Date.now() - 30 * 86400e3;

        const kind: "host_after_join" | "player" = isHost
          ? "host_after_join"
          : "player";

        const priorCounted = (s.cancelLog ?? []).filter((c) => {
          if (c.playerId !== s.meId) return false;
          if (new Date(c.at).getTime() < monthAgo) return false;
          if (isHost) return c.kind === "host_after_join";
          return c.kind === "player" && c.late;
        }).length;

        let hit = 0;
        if (isHost) {
          if (priorCounted >= 3) hit = 0.15;
        } else if (late && priorCounted >= 3) {
          hit = 0.15;
        }

        const meP = s.players.find((p) => p.id === s.meId);
        const otherId = isHost ? m.opponentId : m.hostId;
        const otherName =
          s.players.find((p) => p.id === otherId)?.name ?? "them";

        const entry: CancelLogEntry = {
          id: uid("cx"),
          playerId: s.meId,
          matchId,
          at: new Date().toISOString(),
          late: isHost ? false : late,
          reason: body,
          sportsmanshipHit: hit,
          kind,
        };

        const countedThisMonth = priorCounted + 1;

        result = {
          ok: true,
          late: isHost ? false : late,
          sportsmanshipHit: hit,
          lateCancelsThisMonth: countedThisMonth,
          kind,
        };

        const notifyLine = isHost
          ? `Host cancelled after you joined: ${body}`
          : `${meP?.name ?? "Someone"} cancelled${late ? " (within 24h)" : ""}: ${body}`;

        const policyLine = isHost
          ? hit > 0
            ? `Host cancel #${countedThisMonth} this month (after someone joined) — sportsmanship −${hit.toFixed(1)}. ${otherName} was notified.`
            : `Host cancel after join logged (${countedThisMonth}/3 free this month before sportsmanship is hit). ${otherName} was notified.`
          : late
            ? hit > 0
              ? `Late cancel #${countedThisMonth} this month — sportsmanship −${hit.toFixed(1)}.`
              : `Late cancel logged (${countedThisMonth}/3 free this month before sportsmanship is hit).`
            : "Cancelled with 24h+ notice — no penalty.";

        return {
          ...s,
          cancelLog: [...(s.cancelLog ?? []), entry],
          players: s.players.map((p) =>
            p.id === s.meId && hit > 0
              ? {
                  ...p,
                  sportsmanship: Math.max(
                    1,
                    Math.round((p.sportsmanship - hit) * 10) / 10,
                  ),
                }
              : p,
          ),
          matches: s.matches.map((x) =>
            x.id !== matchId
              ? x
              : {
                  ...x,
                  status: "cancelled" as const,
                  cancelledBy: s.meId,
                  cancelReason: body,
                  cancelledAt: new Date().toISOString(),
                  cancelWasLate: isHost ? false : late,
                  chat: [
                    ...x.chat,
                    {
                      id: uid("sys"),
                      authorName: "Upset City",
                      authorId: s.meId,
                      text: notifyLine,
                      at: new Date().toISOString(),
                      system: true,
                    },
                    {
                      id: uid("sys"),
                      authorName: "Upset City",
                      text: policyLine,
                      at: new Date().toISOString(),
                      system: true,
                    },
                  ],
                },
          ),
        };
      });

      return result;
    },
    [],
  );

  const enterScore = useCallback((matchId: string, scores: MatchGame[]) => {
    setState((s) => ({
      ...s,
      matches: s.matches.map((m) =>
        m.id === matchId
          ? {
              ...m,
              scores,
              scoreEnteredBy: s.meId,
              status: "played_pending" as const,
            }
          : m,
      ),
    }));
  }, []);

  const confirmScore = useCallback((matchId: string) => {
    setState((s) => {
      const m = s.matches.find((x) => x.id === matchId);
      if (!m || !m.scores || !m.opponentId) return s;
      const host = s.players.find((p) => p.id === m.hostId);
      const opp = s.players.find((p) => p.id === m.opponentId);
      if (!host || !opp) return s;

      // scores are host=a, opp=b from host perspective in seed UI
      const result = rateSeries(
        { rating: host.rating, gamesPlayed: host.gamesPlayed },
        { rating: opp.rating, gamesPlayed: opp.gamesPlayed },
        m.scores,
      );

      const hostWon =
        m.scores.reduce((n, g) => n + (g.a > g.b ? 1 : 0), 0) >
        m.scores.reduce((n, g) => n + (g.b > g.a ? 1 : 0), 0);

      const players = s.players.map((p) => {
        if (p.id === host.id) {
          return {
            ...p,
            rating: result.aNew,
            gamesPlayed: p.gamesPlayed + 1,
            wins: p.wins + (hostWon ? 1 : 0),
            losses: p.losses + (hostWon ? 0 : 1),
            streak: hostWon ? Math.max(0, p.streak) + 1 : 0,
            pointsScored:
              p.pointsScored + m.scores!.reduce((n, g) => n + g.a, 0),
            pointsAllowed:
              p.pointsAllowed + m.scores!.reduce((n, g) => n + g.b, 0),
          };
        }
        if (p.id === opp.id) {
          return {
            ...p,
            rating: result.bNew,
            gamesPlayed: p.gamesPlayed + 1,
            wins: p.wins + (hostWon ? 0 : 1),
            losses: p.losses + (hostWon ? 1 : 0),
            streak: hostWon ? 0 : Math.max(0, p.streak) + 1,
            pointsScored:
              p.pointsScored + m.scores!.reduce((n, g) => n + g.b, 0),
            pointsAllowed:
              p.pointsAllowed + m.scores!.reduce((n, g) => n + g.a, 0),
          };
        }
        return p;
      });

      // crown: winner becomes king
      const winnerId = hostWon ? host.id : opp.id;
      const settledStakes =
        m.stakes && m.stakes.mode !== "fun"
          ? {
              ...computeStakePayout(
                m.stakes,
                m.scores,
                m.hostId,
                m.opponentId!,
              ),
              paymentStatus: "pending" as const,
              payDeadlineAt: new Date(
                Date.now() + 48 * 3600e3,
              ).toISOString(),
            }
          : m.stakes;
      const stakeNote =
        settledStakes &&
        settledStakes.mode !== "fun" &&
        settledStakes.amountDollars != null
          ? settledStakes.mode === "charity"
            ? ` · Loser donates ${formatMoney(settledStakes.amountDollars)} to ${settledStakes.charityName ?? "charity"} (${settledStakes.totalMarginPoints} pt margin)`
            : ` · Loser owes winner ${formatMoney(settledStakes.amountDollars)} (${settledStakes.totalMarginPoints} pt margin)`
          : "";
      const courtMeta = { ...s.courtMeta };
      const prev = courtMeta[m.courtId] ?? {
        courtId: m.courtId,
        chat: [],
        crownTtlDays: s.crownTtlDays,
      };
      courtMeta[m.courtId] = {
        ...prev,
        kingId: winnerId,
        kingLastPlayedAt: new Date().toISOString(),
        chat: [
          ...prev.chat,
          {
            id: uid("sys"),
            authorName: "Upset City",
            text: `Result locked. ${hostWon ? host.name : opp.name} takes the crown.${stakeNote}`,
            at: new Date().toISOString(),
            system: true,
          },
        ],
      };

      return {
        ...s,
        players,
        courtMeta,
        matches: s.matches.map((x) =>
          x.id === matchId
            ? {
                ...x,
                status: "confirmed" as const,
                confirmedBy: s.meId,
                ratingDeltaHost: result.aDelta,
                ratingDeltaOpp: result.bDelta,
                stakes: settledStakes,
              }
            : x,
        ),
      };
    });
  }, []);

  const markStakeSettled = useCallback(
    (matchId: string, method?: NonNullable<Match["stakes"]>["settleMethod"]) => {
      setState((s) => {
        const m = s.matches.find((x) => x.id === matchId);
        if (m?.stakes?.mode === "charity" && !m.stakes.settled) {
          const amount = m.stakes.amountDollars ?? 0;
          const loser = s.players.find((p) => p.id === m.stakes?.loserId);
          if (amount > 0 && loser) {
            try {
              useCampaign.getState().addDonation({
                amount,
                playerId: loser.id,
                playerName: loser.name,
                matchId: m.id,
                note: `${m.format === "horse" ? "HORSE" : "1v1"} · ${m.courtName}`,
              });
              useMediaFeed.getState().createPost({
                authorId: "system",
                authorName: "Upset City",
                text: `💜 +$${amount} for Alzheimer's — ${loser.name} completed a charity gift from ${m.courtName}. Every game moves Austin toward $50,000 for research.`,
                mentionedIds: [loser.id],
              });
            } catch {
              /* ignore */
            }
          }
        }
        return {
          ...s,
          matches: s.matches.map((x) =>
            x.id === matchId && x.stakes
              ? {
                  ...x,
                  stakes: {
                    ...x.stakes,
                    settled: true,
                    settledAt: new Date().toISOString(),
                    settleMethod: method ?? x.stakes.settleMethod,
                    paymentStatus: "settled",
                  },
                  chat: [
                    ...(x.chat ?? []),
                    {
                      id: uid("sys"),
                      authorName: "Upset City",
                      text:
                        x.stakes.mode === "charity"
                          ? "Charity donation marked complete — added to the Austin $50k goal. Thank you."
                          : `Stake marked settled${method ? ` via ${method}` : ""}.`,
                      at: new Date().toISOString(),
                      system: true,
                    },
                  ],
                }
              : x,
          ),
        };
      });
    },
    [],
  );

  const updateMyPayHandles = useCallback(
    (handles: {
      payCashApp?: string;
      payVenmo?: string;
      payZelle?: string;
    }) => {
      setState((s) => ({
        ...s,
        players: s.players.map((p) =>
          p.id === s.meId
            ? {
                ...p,
                payCashApp: handles.payCashApp?.trim() || undefined,
                payVenmo: handles.payVenmo?.trim() || undefined,
                payZelle: handles.payZelle?.trim() || undefined,
              }
            : p,
        ),
      }));
    },
    [],
  );

  /** Loser asks for more time — community + winner see the note */
  const requestStakeExtension = useCallback(
    (matchId: string, note: string) => {
      const text = note.trim();
      if (text.length < 8) {
        return { ok: false as const, reason: "Tell us what’s going on (a short note)." };
      }
      let posted = false;
      setState((s) => {
        const m = s.matches.find((x) => x.id === matchId);
        if (!m?.stakes || m.stakes.mode === "fun" || m.stakes.settled) {
          return s;
        }
        if (m.stakes.loserId !== s.meId) {
          return s;
        }
        const loser = s.players.find((p) => p.id === s.meId);
        const amount = m.stakes.amountDollars ?? m.stakes.fixedPriceDollars;
        const newDeadline = new Date(
          Math.max(
            Date.now() + 48 * 3600e3,
            m.stakes.payDeadlineAt
              ? new Date(m.stakes.payDeadlineAt).getTime() + 48 * 3600e3
              : Date.now() + 48 * 3600e3,
          ),
        ).toISOString();
        posted = true;
        // community notice
        try {
          useMediaFeed.getState().createPost({
            authorId: "system",
            authorName: "Upset City",
            text: `⏳ More time requested — ${loser?.name ?? "A player"} needs extra time to settle ${amount != null ? `$${amount}` : "stakes"} from ${m.courtName}. Note: “${text.slice(0, 160)}” · We work with people who communicate.`,
          });
        } catch {
          /* ignore */
        }
        return {
          ...s,
          matches: s.matches.map((x) =>
            x.id === matchId && x.stakes
              ? {
                  ...x,
                  stakes: {
                    ...x.stakes,
                    paymentStatus: "extension_requested",
                    extensionNote: text,
                    extensionRequestedAt: new Date().toISOString(),
                    payDeadlineAt: newDeadline,
                  },
                  chat: [
                    ...(x.chat ?? []),
                    {
                      id: uid("sys"),
                      authorName: "Upset City",
                      text: `Extension requested: ${text}`,
                      at: new Date().toISOString(),
                      system: true,
                    },
                  ],
                }
              : x,
          ),
        };
      });
      if (!posted) {
        return { ok: false as const, reason: "Couldn’t request extension on this game." };
      }
      return { ok: true as const };
    },
    [],
  );

  /**
   * Winner reports non-payment → permanent exile + public league notice.
   */
  const reportStakeUnpaid = useCallback((matchId: string) => {
    let result: { ok: true } | { ok: false; reason: string } = {
      ok: false,
      reason: "Couldn’t file report.",
    };
    setState((s) => {
      const m = s.matches.find((x) => x.id === matchId);
      if (!m?.stakes || m.stakes.mode === "fun") {
        result = { ok: false, reason: "Not a stakes/charity game." };
        return s;
      }
      if (m.stakes.settled || m.stakes.paymentStatus === "exiled") {
        result = { ok: false, reason: "Already settled or already exiled." };
        return s;
      }
      if (m.stakes.winnerId !== s.meId && m.stakes.mode === "stakes") {
        result = { ok: false, reason: "Only the winner can report non-payment." };
        return s;
      }
      // charity: either party can report if loser is the other - actually winner of series
      if (m.stakes.winnerId !== s.meId) {
        result = { ok: false, reason: "Only the winner can report non-payment." };
        return s;
      }
      const loserId = m.stakes.loserId;
      if (!loserId) {
        result = { ok: false, reason: "No loser on file." };
        return s;
      }
      const loser = s.players.find((p) => p.id === loserId);
      const winner = s.players.find((p) => p.id === m.stakes!.winnerId);
      const amount = m.stakes.amountDollars ?? m.stakes.fixedPriceDollars;
      const reason =
        m.stakes.mode === "charity"
          ? `Did not complete charity donation (${amount != null ? `$${amount}` : "owed"}) after ${m.courtName}`
          : `Did not pay stakes (${amount != null ? `$${amount}` : "owed"}) to ${winner?.name ?? "winner"} after ${m.courtName}`;

      try {
        useMediaFeed.getState().createPost({
          authorId: "system",
          authorName: "Upset City",
          text: `🚫 EXILED FROM THE LEAGUE — ${loser?.name ?? "A player"} (@${loser?.handle ?? "player"}) failed to settle ${amount != null ? `$${amount}` : "an amount"} from a confirmed game at ${m.courtName}. Unpaid stakes/charity = permanent exile. The community has been notified. Pay what you owe. Communicate if you need time — silence is exile.`,
          mentionedIds: loserId ? [loserId] : [],
        });
      } catch {
        /* ignore */
      }

      result = { ok: true };
      return {
        ...s,
        players: s.players.map((p) =>
          p.id === loserId
            ? {
                ...p,
                exiled: true,
                exiledAt: new Date().toISOString(),
                exiledReason: reason,
                openToChallenges: false,
                hideFromCatalog: true,
                availability: "offline" as const,
              }
            : p,
        ),
        matches: s.matches.map((x) => {
          if (x.id === matchId && x.stakes) {
            return {
              ...x,
              stakes: {
                ...x.stakes,
                paymentStatus: "exiled",
                reportedUnpaidAt: new Date().toISOString(),
                reportedById: s.meId,
              },
              chat: [
                ...(x.chat ?? []),
                {
                  id: uid("sys"),
                  authorName: "Upset City",
                  text: "Non-payment reported. Loser is permanently exiled from the league.",
                  at: new Date().toISOString(),
                  system: true,
                },
              ],
            };
          }
          // cancel open listings by exiled player
          if (
            x.hostId === loserId &&
            (x.status === "open" || x.status === "matched")
          ) {
            return {
              ...x,
              status: "cancelled" as const,
              cancelReason: "Host exiled for unpaid stakes",
              cancelledAt: new Date().toISOString(),
              cancelledBy: "system",
            };
          }
          return x;
        }),
      };
    });
    return result;
  }, []);

  const predict = useCallback((matchId: string, winnerId: string) => {
    setState((s) => ({
      ...s,
      matches: s.matches.map((m) =>
        m.id === matchId
          ? {
              ...m,
              predictions: { ...m.predictions, [s.meId]: winnerId },
            }
          : m,
      ),
    }));
  }, []);

  const commentOnMatch = useCallback((matchId: string, text: string) => {
    const t = text.trim();
    if (!t) return;
    setState((s) => {
      const me = s.players.find((p) => p.id === s.meId);
      return {
        ...s,
        matches: s.matches.map((m) =>
          m.id === matchId
            ? {
                ...m,
                comments: [
                  ...m.comments,
                  {
                    id: uid("c"),
                    authorId: s.meId,
                    authorName: me?.name ?? "You",
                    text: t,
                    at: new Date().toISOString(),
                  },
                ],
              }
            : m,
        ),
      };
    });
  }, []);

  const postCourtChat = useCallback((courtId: string, text: string) => {
    const t = text.trim();
    if (!t) return;
    setState((s) => {
      const me = s.players.find((p) => p.id === s.meId);
      const prev = s.courtMeta[courtId] ?? {
        courtId,
        chat: [],
        crownTtlDays: s.crownTtlDays,
      };
      const msg: ChatMessage = {
        id: uid("chat"),
        authorId: s.meId,
        authorName: me?.name ?? "You",
        text: t,
        at: new Date().toISOString(),
      };
      return {
        ...s,
        courtMeta: {
          ...s.courtMeta,
          [courtId]: { ...prev, chat: [...prev.chat, msg] },
        },
      };
    });
  }, []);

  const challengePlayer = useCallback(
    (
      targetId: string,
      input: {
        courtId: string;
        courtName: string;
        lat: number;
        lon: number;
        preferredAt: string;
        notes?: string;
      },
    ): { ok: true; match: Match } | { ok: false; reason: string } => {
      const target = state.players.find((p) => p.id === targetId);
      const me = state.players.find((p) => p.id === state.meId);
      if (!target || !me) return { ok: false, reason: "Player not found." };
      if (!target.openToChallenges)
        return { ok: false, reason: "They aren’t open to challenges." };
      if (state.blockedIds.includes(targetId))
        return { ok: false, reason: "You’ve blocked this player." };

      const alreadyBooked = state.matches.some((m) => {
        if (
          m.status !== "scheduled" &&
          m.status !== "matched" &&
          m.status !== "open"
        )
          return false;
        return (
          (m.hostId === state.meId && m.opponentId === targetId) ||
          (m.hostId === targetId && m.opponentId === state.meId)
        );
      });
      if (alreadyBooked) {
        return {
          ok: false,
          reason: "You already have a game scheduled with them.",
        };
      }

      // Prefer an existing open listing from them — challenger still has to Join.
      const theirOpen = state.matches.find(
        (m) => m.hostId === targetId && m.status === "open",
      );
      if (theirOpen) {
        return { ok: true, match: theirOpen };
      }

      // Open challenge listing hosted by the target so YOU are not auto-booked.
      // You open the detail screen and tap Join if it looks like a fit.
      const match: Match = {
        id: uid("m"),
        kind: "challenge",
        format: "1v1",
        hostId: targetId,
        courtId: input.courtId,
        courtName: input.courtName,
        lat: input.lat,
        lon: input.lon,
        preferredAt: input.preferredAt,
        status: "open",
        notes:
          input.notes ??
          `Open for a rated 1v1 · Best of 3 · games to 11 · make it take it`,
        filters: {
          heightMinIn: 60,
          heightMaxIn: 90,
          ratingMin: Math.min(me.rating, target.rating) - 500,
          ratingMax: Math.max(me.rating, target.rating) + 500,
          sportsmanshipMin: 3,
          radiusMiles: 25,
        },
        predictions: {},
        comments: [],
        chat: [
          {
            id: uid("sys"),
            authorName: "Upset City",
            text: `${me.name} pulled this up from Media — Join only if you want the run.`,
            at: new Date().toISOString(),
            system: true,
          },
        ],
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({ ...s, matches: [match, ...s.matches] }));
      return { ok: true, match };
    },
    [],
  );

  const sendDm = useCallback(
    (
      toId: string,
      text: string,
    ): { ok: true } | { ok: false; reason: string } => {
      const t = text.trim();
      if (!t) return { ok: false, reason: "Empty message." };
      const to = state.players.find((p) => p.id === toId);
      const me = state.players.find((p) => p.id === state.meId);
      if (!to || !me) return { ok: false, reason: "Player not found." };
      if (state.blockedIds.includes(toId))
        return { ok: false, reason: "Blocked." };

      setState((s) => {
        const existing = s.dmThreads.find(
          (th) =>
            th.participantIds.includes(s.meId) &&
            th.participantIds.includes(toId),
        );
        const msg: ChatMessage = {
          id: uid("dm"),
          authorId: s.meId,
          authorName: me.name,
          text: t,
          at: new Date().toISOString(),
        };
        if (existing) {
          return {
            ...s,
            dmThreads: s.dmThreads.map((th) =>
              th.id === existing.id
                ? {
                    ...th,
                    messages: [...th.messages, msg],
                    updatedAt: msg.at,
                  }
                : th,
            ),
          };
        }
        const thread: DirectThread = {
          id: uid("th"),
          participantIds: [s.meId, toId],
          isRequest: true,
          messages: [msg],
          updatedAt: msg.at,
        };
        return { ...s, dmThreads: [thread, ...s.dmThreads] };
      });
      return { ok: true };
    },
    [],
  );

  const acceptDmRequest = useCallback((threadId: string) => {
    setState((s) => ({
      ...s,
      dmThreads: s.dmThreads.map((th) =>
        th.id === threadId ? { ...th, isRequest: false } : th,
      ),
    }));
  }, []);

  const blockPlayer = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      blockedIds: s.blockedIds.includes(id)
        ? s.blockedIds
        : [...s.blockedIds, id],
    }));
  }, []);

  const addFriend = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      friendIds: (s.friendIds ?? []).includes(id)
        ? (s.friendIds ?? [])
        : [...(s.friendIds ?? []), id],
    }));
  }, []);

  const removeFriend = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      friendIds: (s.friendIds ?? []).filter((x) => x !== id),
    }));
  }, []);

  const reportPlayer = useCallback((id: string, reason: string) => {
    setState((s) => ({
      ...s,
      reports: [
        ...s.reports,
        {
          id: uid("rep"),
          targetId: id,
          reason,
          at: new Date().toISOString(),
        },
      ],
    }));
  }, []);


  const postMatchChat = useCallback((matchId: string, text: string) => {
    const body = text.trim();
    if (!body) return;
    setState((s) => {
      const meP = s.players.find((p) => p.id === s.meId);
      return {
        ...s,
        matches: s.matches.map((m) =>
          m.id !== matchId
            ? m
            : {
                ...m,
                chat: [
                  ...m.chat,
                  {
                    id: uid("mc"),
                    authorId: s.meId,
                    authorName: meP?.name ?? "You",
                    text: body,
                    at: new Date().toISOString(),
                  },
                ],
              },
        ),
      };
    });
  }, []);

  const inviteToMatch = useCallback(
    (matchId: string, playerId: string): { ok: true } | { ok: false; reason: string } => {
      const m = state.matches.find((x) => x.id === matchId);
      if (!m) return { ok: false, reason: "Game not found." };
      if (m.status !== "open" && m.status !== "matched" && m.status !== "scheduled")
        return { ok: false, reason: "Game is closed." };
      const isHost = m.hostId === state.meId;
      const onRoster = m.rosterIds?.includes(state.meId) || m.opponentId === state.meId;
      if (!isHost && !m.allowGuestInvites)
        return { ok: false, reason: "Host isn’t allowing guest invites." };
      if (!isHost && !onRoster && m.hostId !== state.meId)
        return { ok: false, reason: "Join the game before inviting friends." };
      // for open games, joiner can invite only after accept OR host allows and they're viewing - user said invite to hosts game if allowed. So if allowGuestInvites anyone who accepted OR anyone can propose invite?
      // Spec: "invite people to the game ... if they allow for it" - guests who can see the game can invite when allowGuestInvites
      if (!isHost && !m.allowGuestInvites)
        return { ok: false, reason: "Host isn’t allowing guest invites." };

      if (
        playerId === m.hostId ||
        m.rosterIds?.includes(playerId) ||
        m.guestInviteIds?.includes(playerId) ||
        m.opponentId === playerId
      )
        return { ok: false, reason: "Already in this game." };

      setState((s) => ({
        ...s,
        matches: s.matches.map((x) =>
          x.id !== matchId
            ? x
            : {
                ...x,
                guestInviteIds: [...(x.guestInviteIds ?? []), playerId],
                chat: [
                  ...x.chat,
                  {
                    id: uid("sys"),
                    authorName: "Upset City",
                    text: `${s.players.find((p) => p.id === s.meId)?.name ?? "Someone"} invited a player.`,
                    at: new Date().toISOString(),
                    system: true,
                  },
                ],
              },
        ),
      }));
      return { ok: true };
    },
    [],
  );

  const respondGuestInvite = useCallback(
    (matchId: string, accept: boolean) => {
      setState((s) => ({
        ...s,
        matches: s.matches.map((m) => {
          if (m.id !== matchId) return m;
          const pending = (m.guestInviteIds ?? []).filter((id) => id !== s.meId);
          if (!accept) return { ...m, guestInviteIds: pending };
          return {
            ...m,
            guestInviteIds: pending,
            rosterIds: [...(m.rosterIds ?? []), s.meId],
          };
        }),
      }));
    },
    [],
  );

  return {
    ...snap,
    me,
    leaderboard,
    openMatches,
    scheduledMatches,
    catalogPlayers,
    // aliases used by older panels
    openGames: openMatches,
    playerById,
    courtKing,
    ratedAtCourt,
    openAtCourt,
    nextGameAtCourt,
    createQuickMatch,
    updateMatchNotes,
    acceptMatch,
    tryAcceptRace,
    cancelMatch,
    cancelGame: cancelMatch,
    joinGame: tryAcceptRace,
    createGame: createQuickMatch,
    enterScore,
    confirmScore,
    markStakeSettled,
    updateMyPayHandles,
    requestStakeExtension,
    reportStakeUnpaid,
    predict,
    commentOnMatch,
    postCourtChat,
    challengePlayer,
    sendDm,
    acceptDmRequest,
    blockPlayer,
    addFriend,
    removeFriend,
    reportPlayer,
    postMatchChat,
    inviteToMatch,
    respondGuestInvite,
  };
}

let hydrated = false;

// silence unused
void displayRating;
void namedAustinCourts;
```

## FILE: `src/lib/upset/tournament-bracket.ts`

```ts
import type { Player } from "./types";

export type GameMode = "1v1" | "2v2" | "3v3" | "5v5" | "horse";

export type BracketMatchStatus = "upcoming" | "live" | "final" | "bye";

export interface BracketSlot {
  playerId: string | null;
  name: string;
  seed: number | null;
  score?: number;
  isWinner?: boolean;
  isYou?: boolean;
}

export interface BracketMatch {
  id: string;
  round: number; // 0 = first round
  index: number; // position in round
  status: BracketMatchStatus;
  top: BracketSlot;
  bottom: BracketSlot;
  court?: string;
  tipOff?: string;
}

export interface TournamentBracket {
  tournamentId: string;
  name: string;
  mode: GameMode;
  size: number; // power of 2
  rounds: BracketMatch[][];
  championId: string | null;
  championName: string | null;
}

function nextPow2(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Classic 1–N seed pairing for a round of size. */
function seedOrder(size: number): number[] {
  // returns seed numbers 1..size in bracket positions
  let arr = [1, 2];
  while (arr.length < size) {
    const next: number = arr.length * 2 + 1;
    const out: number[] = [];
    for (const s of arr) {
      out.push(s);
      out.push(next - s);
    }
    arr = out;
  }
  return arr;
}

const ROUND_NAMES: Record<number, string> = {};

export function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Quarterfinals";
  const slots = 2 ** (totalRounds - round);
  return `Round of ${slots}`;
}

/**
 * Build a single-elim bracket from Austin players.
 * size forced to power of 2 (8 or 16 typically).
 * Progresses early rounds with mock scores for demo.
 */
export function buildBracket(opts: {
  tournamentId: string;
  name: string;
  mode: GameMode;
  players: Player[];
  meId: string;
  size?: number;
  /** 0 = nothing played, higher = more rounds complete */
  progressRounds?: number;
}): TournamentBracket {
  const size = nextPow2(opts.size ?? 8);
  const totalRounds = Math.log2(size);
  const ranked = [...opts.players]
    .filter((p) => p.city === "Austin")
    .sort((a, b) => b.rating - a.rating);

  // ensure "you" is in the field
  const me = opts.players.find((p) => p.id === opts.meId);
  let field = ranked.slice(0, size);
  if (me && !field.some((p) => p.id === me.id)) {
    field = [...field.slice(0, size - 1), me];
  }
  // pad with TBD bye placeholders if short
  while (field.length < size) {
    field.push({
      id: `bye-${field.length}`,
      name: "BYE",
      handle: "bye",
      city: "Austin",
      heightIn: 0,
      weightLb: 0,
      experienceYears: 0,
      rating: 0,
      gamesPlayed: 0,
      sportsmanship: 0,
      reliability: 0,
      wins: 0,
      losses: 0,
      streak: 0,
      availability: "offline",
      hue: 0,
      quietStart: 0,
      quietEnd: 0,
      pingsToday: 0,
      pingsDate: "",
      ignoreStreak: 0,
      preferredHour: 0,
      openToChallenges: false,
      dmPrivacy: "nobody",
      hideFromCatalog: true,
      challengesToday: 0,
      challengesDate: "",
      dmFirstToday: 0,
      dmFirstDate: "",
      rankLastWeek: 99,
      pointsScored: 0,
      pointsAllowed: 0,
      weeklyWins: 0,
      weeklyLosses: 0,
      ratingLastWeek: 0,
    } as Player);
  }

  // map seed number -> player (seed 1 = highest rating)
  const bySeed = new Map<number, Player>();
  field.forEach((p, i) => bySeed.set(i + 1, p));

  const order = seedOrder(size);
  const progress = opts.progressRounds ?? Math.min(2, totalRounds - 1);

  const rounds: BracketMatch[][] = [];

  // Round 0 from seeds
  const r0: BracketMatch[] = [];
  for (let i = 0; i < size / 2; i++) {
    const seedTop = order[i * 2];
    const seedBot = order[i * 2 + 1];
    const topP = bySeed.get(seedTop)!;
    const botP = bySeed.get(seedBot)!;
    const topBye = topP.id.startsWith("bye");
    const botBye = botP.id.startsWith("bye");
    let status: BracketMatchStatus = progress > 0 ? "final" : "upcoming";
    if (topBye || botBye) status = "bye";

    const topScore =
      status === "final" || status === "bye"
        ? botBye
          ? 11
          : topBye
            ? 0
            : 11 + (i % 3)
        : undefined;
    const botScore =
      status === "final" || status === "bye"
        ? topBye
          ? 11
          : botBye
            ? 0
            : 7 + (i % 4)
        : undefined;

    let topWin = false;
    let botWin = false;
    if (status === "final" || status === "bye") {
      if (topBye) botWin = true;
      else if (botBye) topWin = true;
      else if ((topScore ?? 0) >= (botScore ?? 0)) topWin = true;
      else botWin = true;
    }

    r0.push({
      id: `${opts.tournamentId}-r0-m${i}`,
      round: 0,
      index: i,
      status: status === "final" && i === 0 && progress === 0 ? "live" : status,
      top: {
        playerId: topBye ? null : topP.id,
        name: topBye ? "BYE" : topP.name,
        seed: seedTop,
        score: topScore,
        isWinner: topWin,
        isYou: topP.id === opts.meId,
      },
      bottom: {
        playerId: botBye ? null : botP.id,
        name: botBye ? "BYE" : botP.name,
        seed: seedBot,
        score: botScore,
        isWinner: botWin,
        isYou: botP.id === opts.meId,
      },
      court: i % 2 === 0 ? "Court A" : "Court B",
      tipOff: progress > 0 ? undefined : `Game ${i + 1}`,
    });
  }
  // first match live if no progress
  if (progress === 0 && r0[0]) {
    r0[0].status = "live";
    r0[0].top.score = 6;
    r0[0].bottom.score = 4;
  }
  rounds.push(r0);

  // Subsequent rounds
  for (let r = 1; r < totalRounds; r++) {
    const prev = rounds[r - 1];
    const matches: BracketMatch[] = [];
    const done = r < progress;
    const liveRound = r === progress;

    for (let i = 0; i < prev.length / 2; i++) {
      const m1 = prev[i * 2];
      const m2 = prev[i * 2 + 1];
      const w1 = winnerSlot(m1);
      const w2 = winnerSlot(m2);

      let status: BracketMatchStatus = "upcoming";
      if (done) status = "final";
      else if (liveRound && i === 0 && w1.name !== "TBD" && w2.name !== "TBD")
        status = "live";

      const topScore = status === "final" ? 11 + (i % 2) : status === "live" ? 3 : undefined;
      const botScore = status === "final" ? 8 + (i % 3) : status === "live" ? 2 : undefined;
      let topWin = false;
      let botWin = false;
      if (status === "final") {
        if ((topScore ?? 0) >= (botScore ?? 0)) topWin = true;
        else botWin = true;
      }

      matches.push({
        id: `${opts.tournamentId}-r${r}-m${i}`,
        round: r,
        index: i,
        status,
        top: {
          ...w1,
          score: topScore,
          isWinner: topWin,
        },
        bottom: {
          ...w2,
          score: botScore,
          isWinner: botWin,
        },
        court: "Main",
        tipOff: status === "upcoming" ? "TBD" : undefined,
      });
    }
    rounds.push(matches);
  }

  const last = rounds[rounds.length - 1][0];
  const champ =
    last?.status === "final"
      ? last.top.isWinner
        ? last.top
        : last.bottom.isWinner
          ? last.bottom
          : null
      : null;

  void ROUND_NAMES;

  return {
    tournamentId: opts.tournamentId,
    name: opts.name,
    mode: opts.mode,
    size,
    rounds,
    championId: champ?.playerId ?? null,
    championName: champ?.name ?? null,
  };
}

function winnerSlot(m: BracketMatch): BracketSlot {
  if (m.status === "final" || m.status === "bye") {
    if (m.top.isWinner)
      return {
        playerId: m.top.playerId,
        name: m.top.name,
        seed: m.top.seed,
        isYou: m.top.isYou,
      };
    if (m.bottom.isWinner)
      return {
        playerId: m.bottom.playerId,
        name: m.bottom.name,
        seed: m.bottom.seed,
        isYou: m.bottom.isYou,
      };
  }
  // if only one side known
  if (m.top.playerId && !m.bottom.playerId)
    return {
      playerId: m.top.playerId,
      name: m.top.name,
      seed: m.top.seed,
      isYou: m.top.isYou,
    };
  if (m.bottom.playerId && !m.top.playerId)
    return {
      playerId: m.bottom.playerId,
      name: m.bottom.name,
      seed: m.bottom.seed,
      isYou: m.bottom.isYou,
    };
  return { playerId: null, name: "TBD", seed: null };
}
```

## FILE: `src/lib/upset/types.ts`

```ts
export type Availability = "available" | "busy" | "offline";
export type MatchStatus =
  | "open"
  | "matched"
  | "scheduled"
  | "played_pending"
  | "confirmed"
  | "disputed"
  | "cancelled"
  | "no_show";

export type DmPrivacy = "everyone" | "played" | "nobody";

/** 1v1 live; team formats reserved for coming-soon UI */
export type MatchFormat = "1v1" | "horse" | "3v3" | "5v5";
export type MatchKind = "broadcast" | "challenge" | "invite";

export interface Player {
  id: string;
  name: string;
  handle: string;
  city: string;
  heightIn: number;
  weightLb: number;
  experienceYears: number;
  rating: number;
  gamesPlayed: number;
  sportsmanship: number;
  reliability: number;
  wins: number;
  losses: number;
  streak: number;
  homeCourtId?: string;
  availability: Availability;
  bio?: string;
  hue: number;
  /** High-quality face photo URL (public path) */
  photoUrl?: string;
  quietStart: number;
  quietEnd: number;
  pingsToday: number;
  pingsDate: string;
  ignoreStreak: number;
  lastPlayedAt?: string;
  preferredHour: number;
  openToChallenges: boolean;
  challengeRatingMin?: number;
  challengeRatingMax?: number;
  dmPrivacy: DmPrivacy;
  hideFromCatalog: boolean;
  neighborhood?: string;
  age?: number;
  challengesToday: number;
  challengesDate: string;
  dmFirstToday: number;
  dmFirstDate: string;
  rankLastWeek: number;
  pointsScored: number;
  pointsAllowed: number;
  weeklyWins: number;
  weeklyLosses: number;
  ratingLastWeek: number;
  /** Peer settle handles (never shown on court map) */
  payCashApp?: string;
  payVenmo?: string;
  payZelle?: string;
  /** Permanent ban from league (e.g. unpaid stakes) */
  exiled?: boolean;
  exiledAt?: string;
  exiledReason?: string;
}

export interface CourtMeta {
  courtId: string;
  kingId?: string;
  kingLastPlayedAt?: string;
  chat: ChatMessage[];
  crownTtlDays: number;
}

export interface ChatMessage {
  id: string;
  authorId?: string;
  authorName: string;
  text: string;
  at: string;
  system?: boolean;
}

export interface MatchGame {
  a: number;
  b: number;
}

/** How the match is “playing for something” */
export type StakeMode = "fun" | "stakes" | "charity";

/**
 * Playing-for model (charity-first product):
 * - fun: rating only
 * - charity: every game feeds Austin $50k Alzheimer's goal (margin → donation)
 * - stakes: legacy / buried — not the happy path
 */
export interface MatchStakes {
  mode: StakeMode;
  /**
   * Charity (margin model): $ per point of total series margin.
   * Stakes (fixed price): unused for payout — see fixedPriceDollars.
   */
  dollarsPerPoint: number;
  /**
   * Stakes only — the named price. Loser pays winner this amount.
   * Also shown on open listings so people know what’s on the line.
   */
  fixedPriceDollars?: number;
  /** Optional ceiling (charity margin model) */
  capDollars?: number;
  charityName?: string;
  charityUrl?: string;
  /** Filled after series is scored + confirmed */
  totalMarginPoints?: number;
  amountDollars?: number;
  loserId?: string;
  winnerId?: string;
  /** Loser marked donation/paid complete */
  settled?: boolean;
  settledAt?: string;
  settleMethod?: "cashapp" | "venmo" | "zelle" | "cash" | "charity" | "other";
  /**
   * Settlement health after scores lock.
   * unpaid report → exile. extension = working with them.
   */
  paymentStatus?:
    | "pending"
    | "extension_requested"
    | "reported_unpaid"
    | "exiled"
    | "settled";
  payDeadlineAt?: string;
  extensionNote?: string;
  extensionRequestedAt?: string;
  reportedUnpaidAt?: string;
  reportedById?: string;
}

export interface MatchFilters {
  heightMinIn: number;
  heightMaxIn: number;
  ratingMin: number;
  ratingMax: number;
  sportsmanshipMin: number;
  radiusMiles: number;
}

export interface MatchComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  at: string;
}

/** Peer review of a player’s game (from people who’ve run with them). */
export interface PlayerReview {
  id: string;
  targetId: string;
  authorId: string;
  authorName: string;
  /** 1–5 stars for how their game feels */
  stars: number;
  text: string;
  at: string;
}

export interface Match {
  id: string;
  kind: MatchKind;
  format?: MatchFormat;
  hostId: string;
  opponentId?: string;
  courtId: string;
  courtName: string;
  lat: number;
  lon: number;
  preferredAt: string;
  scheduledAt?: string;
  acceptedAt?: string;
  status: MatchStatus;
  /** Host notes: size, skill, vibe they’re looking for */
  notes?: string;
  /** Playing for fun / stakes / charity */
  stakes?: MatchStakes;
  allowGuestInvites?: boolean;
  rosterIds?: string[];
  guestInviteIds?: string[];
  filters: MatchFilters;
  scores?: MatchGame[];
  scoreEnteredBy?: string;
  ratingDeltaHost?: number;
  ratingDeltaOpp?: number;
  predictions: Record<string, string>;
  comments: MatchComment[];
  chat: ChatMessage[];
  createdAt: string;
  /** Cancellation metadata so host/opponent can see why */
  cancelledBy?: string;
  cancelReason?: string;
  cancelledAt?: string;
  /** True if cancelled within 24h of tip-off */
  cancelWasLate?: boolean;
}

export interface DirectThread {
  id: string;
  participantIds: string[];
  isRequest: boolean;
  messages: ChatMessage[];
  updatedAt: string;
}

export interface Report {
  id: string;
  targetId: string;
  reason: string;
  at: string;
}

/** Track cancellations for monthly sportsmanship rules */
export interface CancelLogEntry {
  id: string;
  playerId: string;
  matchId: string;
  at: string;
  late: boolean;
  reason: string;
  sportsmanshipHit: number;
  /**
   * host_empty — host pulled listing before anyone joined (never penalized)
   * host_after_join — host cancelled after opponent locked in
   * player — non-host cancelled
   */
  kind: "host_empty" | "host_after_join" | "player";
}

export interface UpsetState {
  players: Player[];
  matches: Match[];
  courtMeta: Record<string, CourtMeta>;
  meId: string;
  leagueChat: ChatMessage[];
  dmThreads: DirectThread[];
  blockedIds: string[];
  friendIds: string[];
  reports: Report[];
  playerReviews: PlayerReview[];
  cancelLog: CancelLogEntry[];
  crownTtlDays: number;
  seedVersion: number;
}
```

## FILE: `src/lib/utils.ts`

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Meters → short imperial distance (app is US-focused). */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "—";
  const miles = meters / 1609.344;
  if (miles < 0.1) return `${Math.round(meters * 3.28084)} ft`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function milesToMeters(miles: number): number {
  return miles * 1609.344;
}

export function metersToMiles(meters: number): number {
  return meters / 1609.344;
}

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatHeightInches(totalInches: number): string {
  const ft = Math.floor(totalInches / 12);
  const inch = totalInches % 12;
  return `${ft}'${inch}"`;
}

export function parseHeightInches(feet: number, inches: number): number {
  return feet * 12 + inches;
}
```

## FILE: `src/router.tsx`

```tsx
import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultPreload: "intent",
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
```

## FILE: `src/routes/__root.tsx`

```tsx
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { CreatedWithGrokBanner } from "@/components/created-with-grok-banner";
import appCss from "../styles.css?url";

const APP_NAME = "Upset City — Austin Courts & 1v1";
const host = import.meta.env.VITE_PUBLIC_HOSTNAME;
const ogImage = host
  ? `https://og.grok.me/v1/card.png?host=${encodeURIComponent(host)}&title=${encodeURIComponent("Upset City")}`
  : undefined;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      {
        name: "description",
        content:
          "Find public outdoor basketball courts in Austin — and step into the rated 1v1 scene. Crowns on courts. Quick Match. No queue.",
      },
      { name: "theme-color", content: "#0c0c0d" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { title: APP_NAME },
      ...(ogImage
        ? [
            { property: "og:image", content: ogImage },
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
          ]
        : []),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Instrument+Sans:wght@500;600;700&display=swap",
      },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg antialiased">
        <CreatedWithGrokBanner />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
```

## FILE: `src/routes/api/auth/$.ts`

```ts
import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
});
```

## FILE: `src/routes/index.tsx`

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { User } from "lucide-react";
import { SceneShell } from "@/components/compete/scene-shell";
import { DEFAULT_CITY } from "@/lib/courts/catalog";
import { fetchCourtsNear } from "@/lib/courts/fetch-courts";
import type { Court, UserLocation } from "@/lib/courts/types";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { milesToMeters } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

const AUSTIN: UserLocation = {
  lat: DEFAULT_CITY.lat,
  lon: DEFAULT_CITY.lon,
  label: "Austin, TX",
};

function Home() {
  const [location, setLocation] = useState<UserLocation | null>(AUSTIN);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [radiusMi, setRadiusMi] = useState(8);
  const [dataSource, setDataSource] = useState<string>("");
  const { isPending: authPending } = useCurrentUserState();
  const locationRef = useRef<UserLocation | null>(AUSTIN);
  const skipRadiusEffect = useRef(true);
  const bootstrapped = useRef(false);

  const loadCourts = useCallback(async (loc: UserLocation, miles: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCourtsNear({
        data: {
          lat: loc.lat,
          lon: loc.lon,
          radiusMeters: Math.round(milesToMeters(miles)),
          label: loc.label,
        },
      });
      setCourts(result.courts);
      setDataSource(result.source);
      setLocation(result.location);
      locationRef.current = result.location;
    } catch (e) {
      console.error(e);
      setError("Couldn’t load courts. Try again or pick another city.");
      setCourts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void loadCourts(AUSTIN, 8);
  }, [loadCourts]);

  const requestLocation = useCallback(() => {
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError("Location isn’t available. Showing Austin courts instead.");
      void loadCourts(AUSTIN, radiusMi);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: UserLocation = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: "Near you",
        };
        locationRef.current = loc;
        setLocation(loc);
        setLocating(false);
        void loadCourts(loc, radiusMi);
      },
      () => {
        setLocating(false);
        setLocError("Couldn’t get your location. Showing Austin.");
        void loadCourts(AUSTIN, radiusMi);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, [loadCourts, radiusMi]);

  useEffect(() => {
    if (skipRadiusEffect.current) {
      skipRadiusEffect.current = false;
      return;
    }
    const loc = locationRef.current;
    if (loc) void loadCourts(loc, radiusMi);
  }, [radiusMi, loadCourts]);

  return (
    <div className="app-shell mx-auto flex w-full max-w-lg flex-col bg-bg">
      <header className="sticky top-[var(--grok-banner-h,0px)] z-30 border-b border-border/80 bg-bg/90 px-4 pt-2.5 pb-2.5 backdrop-blur-md safe-pt">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display truncate text-base font-semibold tracking-tight text-fg">
              <span className="text-court">Upset City</span>
              <span className="mx-1.5 text-fg-subtle font-normal">·</span>
              <span>{location?.label ?? "Austin, TX"}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {authPending ? (
              <div className="size-9 animate-pulse rounded-full bg-bg-subtle" />
            ) : (
              <>
                <SignedIn>
                  <UserButton />
                </SignedIn>
                <SignedOut>
                  <Link
                    to="/login"
                    className="flex size-9 items-center justify-center rounded-full border border-border bg-bg-elevated text-fg-muted"
                    aria-label="Sign in"
                  >
                    <User className="size-4" strokeWidth={1.75} />
                  </Link>
                </SignedOut>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col px-4 pt-4 pb-4">
        {location ? (
          <SceneShell
            courts={courts}
            location={location}
            courtsLoading={loading}
            courtsLocating={locating}
            courtsError={error}
            courtsLocError={locError}
            radiusMi={radiusMi}
            dataSource={dataSource}
            onRadiusChange={setRadiusMi}
            onRefreshCourts={() =>
              location && void loadCourts(location, radiusMi)
            }
            onNearMe={requestLocation}
          />
        ) : (
          <p className="text-center text-sm text-fg-muted">Loading…</p>
        )}
      </main>
    </div>
  );
}
```

## FILE: `src/routes/login.tsx`

```tsx
import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import {
  GROK_PROVIDERS,
  authClient,
  authEnabled,
  signIn,
} from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: Login });

type Mode = "signin" | "signup";

function Login() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<string | null>(null);

  // Already signed in
  if (!isPending && user) {
    void navigate({ to: "/" });
  }

  const onEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error: err } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.split("@")[0] || "Player",
        });
        if (err) throw new Error(err.message ?? "Sign-up failed");
      } else {
        const { error: err } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (err) throw new Error(err.message ?? "Sign-in failed");
      }
      await authClient.getSession();
      void navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const onOAuth = async (providerId: string) => {
    setError(null);
    setOauthBusy(providerId);
    try {
      await signIn(providerId, { callbackURL: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setOauthBusy(null);
    }
  };

  return (
    <main className="app-shell mx-auto flex min-h-0 w-full max-w-md flex-col px-5 pb-10 pt-4">
      <Link
        to="/"
        className="mb-8 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-bg-elevated text-fg transition-colors hover:bg-bg-subtle"
        aria-label="Back"
      >
        <ArrowLeft className="size-5" strokeWidth={1.75} />
      </Link>

      <div className="flex flex-1 flex-col">
        <p className="mb-2 text-sm font-medium tracking-wide text-fg-subtle uppercase">
          Upset City
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">
          Google, X, or email + password. Your account saves favorites and
          unlocks the competition scene.
        </p>

        <div className="mt-8 space-y-3">
          {authEnabled ? (
            GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                disabled={!!oauthBusy}
                onClick={() => void onOAuth(p.providerId)}
                className="flex h-12 w-full items-center justify-center rounded-xl border border-border-strong bg-bg-elevated text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle active:scale-[0.98] disabled:opacity-60"
              >
                {oauthBusy === p.providerId
                  ? "Opening…"
                  : `Continue with ${p.label}`}
              </button>
            ))
          ) : (
            <p className="text-sm text-fg-muted">Sign-in is disabled.</p>
          )}
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-medium text-fg-subtle uppercase">
            or email
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={(e) => void onEmailSubmit(e)} className="space-y-3">
          {mode === "signup" ? (
            <label className="block text-[11px] font-medium text-fg-muted">
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="mt-1 h-11 w-full rounded-xl border border-border bg-bg-elevated px-3 text-sm text-fg outline-none focus:border-court"
                placeholder="What should we call you?"
              />
            </label>
          ) : null}
          <label className="block text-[11px] font-medium text-fg-muted">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="mt-1 h-11 w-full rounded-xl border border-border bg-bg-elevated px-3 text-sm text-fg outline-none focus:border-court"
              placeholder="you@email.com"
            />
          </label>
          <label className="block text-[11px] font-medium text-fg-muted">
            Password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              className="mt-1 h-11 w-full rounded-xl border border-border bg-bg-elevated px-3 text-sm text-fg outline-none focus:border-court"
              placeholder="At least 8 characters"
            />
          </label>

          {error ? (
            <p className="text-xs font-medium text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || !authEnabled}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-court text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-60"
          >
            {busy
              ? "Working…"
              : mode === "signin"
                ? "Sign in with email"
                : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-fg-muted">
          {mode === "signin" ? (
            <>
              New here?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
                className="font-semibold text-court"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have one?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                }}
                className="font-semibold text-court"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
```

## FILE: `src/routeTree.gen.ts`

```ts
/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file was automatically generated by TanStack Router.
// You should NOT make any changes in this file as it will be overwritten.
// Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.

import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as LoginRouteImport } from './routes/login'
import { Route as ApiAuthSplatRouteImport } from './routes/api/auth/$'

const IndexRoute = IndexRouteImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRouteImport,
} as any)
const LoginRoute = LoginRouteImport.update({
  id: '/login',
  path: '/login',
  getParentRoute: () => rootRouteImport,
} as any)
const ApiAuthSplatRoute = ApiAuthSplatRouteImport.update({
  id: '/api/auth/$',
  path: '/api/auth/$',
  getParentRoute: () => rootRouteImport,
} as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/login': typeof LoginRoute
  '/api/auth/$': typeof ApiAuthSplatRoute
}
export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/login': typeof LoginRoute
  '/api/auth/$': typeof ApiAuthSplatRoute
}
export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/': typeof IndexRoute
  '/login': typeof LoginRoute
  '/api/auth/$': typeof ApiAuthSplatRoute
}
export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/login' | '/api/auth/$'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/login' | '/api/auth/$'
  id: '__root__' | '/' | '/login' | '/api/auth/$'
  fileRoutesById: FileRoutesById
}
export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  LoginRoute: typeof LoginRoute
  ApiAuthSplatRoute: typeof ApiAuthSplatRoute
}

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/login': {
      id: '/login'
      path: '/login'
      fullPath: '/login'
      preLoaderRoute: typeof LoginRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/api/auth/$': {
      id: '/api/auth/$'
      path: '/api/auth/$'
      fullPath: '/api/auth/$'
      preLoaderRoute: typeof ApiAuthSplatRouteImport
      parentRoute: typeof rootRouteImport
    }
  }
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  LoginRoute: LoginRoute,
  ApiAuthSplatRoute: ApiAuthSplatRoute,
}
export const routeTree = rootRouteImport
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

import type { getRouter } from './router.tsx'
import type { createStart } from '@tanstack/react-start'
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
  }
}
```

## FILE: `src/styles.css`

```css
@import "tailwindcss";
@import "tw-animate-css";

@theme {
  --color-bg: #0c0c0d;
  --color-bg-elevated: #141416;
  --color-bg-subtle: #1c1c1f;
  --color-bg-soft: #242428;
  --color-fg: #f4f4f5;
  --color-fg-muted: #a1a1aa;
  --color-fg-subtle: #71717a;
  --color-border: color-mix(in oklab, var(--color-fg) 10%, transparent);
  --color-border-strong: color-mix(in oklab, var(--color-fg) 18%, transparent);
  --color-accent: #e8e4df;
  --color-accent-fg: #0c0c0d;
  --color-court: #c45c26;
  --color-court-soft: color-mix(in oklab, #c45c26 18%, transparent);
  --color-success: #6b9b7a;
  --color-danger: #c46b6b;
  --color-gold: #c9a227;
  --color-gold-soft: color-mix(in oklab, #c9a227 22%, transparent);

  --radius-xs: 0.25rem;
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
  --radius-2xl: 1.75rem;
  --radius-full: 9999px;

  --font-sans: "DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-display: "Instrument Sans", "DM Sans", ui-sans-serif, system-ui, sans-serif;

  --shadow-soft: 0 8px 30px color-mix(in oklab, #000 35%, transparent);
  --shadow-card: 0 2px 12px color-mix(in oklab, #000 28%, transparent);

  --ease-out-smooth: cubic-bezier(0.22, 1, 0.36, 1);
  --motion-quick: 150ms;
  --motion-fast: 250ms;
  --motion-slow: 400ms;
}

@layer base {
  * {
    border-color: var(--color-border);
  }

  html {
    color-scheme: dark;
    -webkit-tap-highlight-color: transparent;
    text-size-adjust: 100%;
  }

  body {
    margin: 0;
    min-height: 100dvh;
    background: var(--color-bg);
    color: var(--color-fg);
    font-family: var(--font-sans);
    font-feature-settings: "ss01" on, "cv11" on;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  button:not(:disabled),
  [role="button"]:not(:disabled) {
    cursor: pointer;
  }

  ::selection {
    background: color-mix(in oklab, var(--color-court) 40%, transparent);
    color: var(--color-fg);
  }

  img {
    max-width: 100%;
    display: block;
  }

  /* MapLibre / gamified pins */
  .uc-map .maplibregl-ctrl-attrib {
    font-size: 9px;
    background: color-mix(in oklab, var(--color-bg) 80%, transparent) !important;
    color: var(--color-fg-muted) !important;
  }

  .uc-map .maplibregl-ctrl-group {
    background: var(--color-bg-elevated) !important;
    border: 1px solid color-mix(in oklab, var(--color-fg) 14%, transparent) !important;
    box-shadow: var(--shadow-soft) !important;
  }

  .uc-map .maplibregl-ctrl-group button {
    background: transparent !important;
  }

  .uc-map .maplibregl-ctrl-group button + button {
    border-top-color: color-mix(in oklab, var(--color-fg) 12%, transparent) !important;
  }

  .uc-you {
    width: 14px;
    height: 14px;
    border-radius: 999px;
    background: var(--color-court);
    border: 2px solid var(--color-bg);
    box-shadow: 0 0 0 4px color-mix(in oklab, var(--color-court) 35%, transparent);
  }

  .uc-pin {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.45));
  }

  .uc-pin-face {
    width: 44px;
    height: 44px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font: 700 13px/1 var(--font-sans);
    color: var(--color-fg);
    background: var(--color-bg-elevated);
    border: 2px solid color-mix(in oklab, var(--color-fg) 22%, transparent);
  }

  .uc-pin-open .uc-pin-face {
    border-style: dashed;
    border-color: color-mix(in oklab, var(--color-fg) 40%, transparent);
    color: var(--color-fg-muted);
    background: color-mix(in oklab, var(--color-bg) 70%, transparent);
  }

  .uc-pin-selected .uc-pin-face {
    width: 54px;
    height: 54px;
    border-color: var(--color-gold);
    box-shadow: 0 0 0 3px var(--color-gold-soft);
    font-size: 15px;
  }

  .uc-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: #b91c1c;
    color: #fff;
    font: 700 10px/18px var(--font-sans);
    text-align: center;
    border: 2px solid var(--color-bg);
  }

  .uc-pin-label {
    margin-top: 4px;
    max-width: 160px;
    padding: 3px 8px;
    border-radius: 8px;
    background: var(--color-bg-elevated);
    border: 1px solid color-mix(in oklab, var(--color-gold) 50%, transparent);
    color: var(--color-fg);
    font: 600 10px/1.3 var(--font-sans);
    text-align: center;
    white-space: normal;
  }

  .uc-pin-sub {
    margin-top: 3px;
    padding: 1px 6px;
    border-radius: 6px;
    background: color-mix(in oklab, var(--color-bg) 80%, transparent);
    color: var(--color-fg-muted);
    font: 600 9px/1.3 var(--font-sans);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .uc-cluster {
    width: 40px;
    height: 40px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-elevated);
    border: 2px solid var(--color-court);
    color: var(--color-fg);
    font: 700 13px/1 var(--font-sans);
    cursor: pointer;
    box-shadow: var(--shadow-soft);
  }

  .uc-pin-hover {
    display: none;
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    max-width: 160px;
    padding: 4px 8px;
    border-radius: 8px;
    background: var(--color-bg-elevated);
    border: 1px solid color-mix(in oklab, var(--color-fg) 16%, transparent);
    color: var(--color-fg);
    font: 600 11px/1.3 var(--font-sans);
    white-space: nowrap;
    pointer-events: none;
    box-shadow: var(--shadow-soft);
    z-index: 5;
  }

  .uc-pin-hovering .uc-pin-hover,
  .uc-pin:focus-within .uc-pin-hover {
    display: block;
  }

  .uc-pin-finder-wrap .uc-pin-face,
  .uc-pin-face.uc-pin-finder {
    width: 36px;
    height: 36px;
    background: var(--color-court);
    border: 2px solid var(--color-bg);
    color: #fff;
  }

  .uc-pin-finder-wrap.uc-pin-selected .uc-pin-face {
    width: 44px;
    height: 44px;
    box-shadow: 0 0 0 3px var(--color-court-soft);
  }

  .uc-zone {
    padding: 4px 10px;
    border-radius: 6px;
    background: color-mix(in oklab, var(--color-bg) 72%, transparent);
    border: 1px solid color-mix(in oklab, var(--color-fg) 14%, transparent);
    color: var(--color-fg-muted);
    font: 600 10px/1 var(--font-sans);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    pointer-events: none;
    white-space: nowrap;
  }
}

@layer utilities {
  .safe-pb {
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
  }

  .safe-pt {
    padding-top: max(0.5rem, env(safe-area-inset-top));
  }

  .app-shell {
    min-height: calc(100dvh - var(--grok-banner-h, 0px));
  }

  .text-balance {
    text-wrap: balance;
  }

  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }

  .fade-in {
    animation: fade-in var(--motion-fast) var(--ease-out-smooth) both;
  }

  .slide-up {
    animation: slide-up var(--motion-fast) var(--ease-out-smooth) both;
  }

  .stagger-1 { animation-delay: 40ms; }
  .stagger-2 { animation-delay: 80ms; }
  .stagger-3 { animation-delay: 120ms; }
  .stagger-4 { animation-delay: 160ms; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .fade-in,
  .slide-up {
    animation: none;
  }
}
```

## FILE: `startup.sh`

```sh
#!/bin/sh
set -eu
cd /workspace
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
```

## FILE: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client", "node"],
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

## FILE: `vite.config.ts`

```ts
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

/**
 * Finish PGLite bootstrap during dev-server setup (before traffic). Vite awaits
 * async `configureServer` hooks. Production: `src/lib/db` kicks `ensureDbReady`
 * on import.
 */
function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "app-builder:pglite-bootstrap",
    apply: "serve",
    async configureServer(server) {
      try {
        const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
          ensureDbReady?: () => Promise<void>;
        };
        if (typeof mod.ensureDbReady === "function") {
          await mod.ensureDbReady();
        }
      } catch (err) {
        console.error("[app-builder] DB bootstrap failed:", err);
        throw err;
      }
    },
  };
}

/**
 * Live-preview OAuth popup — handled HERE so the agent never has to create a
 * `/auth/popup` route (and cannot break it by scaffolding a React page that
 * paints the full app shell in the popup).
 *
 * `signIn` (client.ts) opens `/auth/popup?providerId=…` in a top-level window.
 * This middleware runs before TanStack Start, calls `handleAuthPopupRequest`,
 * and returns the 302 / completion HTML. Deployed apps do not use the popup
 * (full-page OAuth redirect), so `apply: "serve"` is enough.
 */
function authPopupPlugin(): Plugin {
  return {
    name: "app-builder:auth-popup",
    apply: "serve",
    configureServer(server) {
      // Register immediately (not in a returned post-hook) so we run BEFORE
      // TanStack Start / the SPA HTML fallback. A model-authored
      // `src/routes/auth/popup.tsx` React page must never win this path.
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url ?? "";
          const pathOnly = rawUrl.split("?", 1)[0] ?? "";
          if (pathOnly !== "/auth/popup") {
            next();
            return;
          }
          if ((req.method ?? "GET").toUpperCase() !== "GET") {
            res.statusCode = 405;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("Method Not Allowed");
            return;
          }

          const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:8080");
          const proto = String(
            req.headers["x-forwarded-proto"] ??
              ((req.socket as { encrypted?: boolean } | undefined)?.encrypted ? "https" : "http"),
          );
          const requestHeaders = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) {
              for (const v of value) requestHeaders.append(key, v);
            } else {
              requestHeaders.set(key, value);
            }
          }
          // Ensure Host is the public preview host so Better Auth's dynamic
          // baseURL / redirect_uri match the popup origin.
          if (!requestHeaders.has("host")) requestHeaders.set("host", host);

          const request = new Request(`${proto}://${host}${rawUrl}`, {
            method: "GET",
            headers: requestHeaders,
          });

          const mod = (await server.ssrLoadModule("/src/lib/auth/popup.server.ts")) as {
            handleAuthPopupRequest: (req: Request) => Promise<Response>;
          };
          const response = await mod.handleAuthPopupRequest(request);

          res.statusCode = response.status;
          // Preserve multiple Set-Cookie headers (OAuth state + session).
          const setCookies =
            typeof response.headers.getSetCookie === "function"
              ? response.headers.getSetCookie()
              : [];
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() === "set-cookie") return;
            res.setHeader(key, value);
          });
          for (const cookie of setCookies) {
            res.appendHeader("set-cookie", cookie);
          }
          const body = Buffer.from(await response.arrayBuffer());
          res.end(body);
        } catch (err) {
          console.error("[app-builder] /auth/popup handler failed:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("auth popup failed");
          }
        }
      });
    },
  };
}

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// Keep `nitro` gated to `build` (the Vercel deploy target): enabled in dev it
// opens a second dev-server port, which breaks the single-port preview.
// The dev server starts once `src/router.tsx` and `src/routes/` exist — see
// AGENTS.md § "First scaffold".
export default defineConfig(({ command }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    pgliteBootstrapPlugin(),
    // Before tanstackStart so /auth/popup never falls through to the SPA.
    authPopupPlugin(),
    tailwindcss(),
    tanstackStart(),
    ...(command === "build" ? [nitro({ preset: "vercel" })] : []),
    viteReact(),
  ],
}));
```

