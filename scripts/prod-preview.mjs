#!/usr/bin/env node
/**
 * Start the production artifact from `npm run build`.
 * Never falls back to `vite dev`.
 *
 * Local/CI (node-server): .output/server/index.mjs
 * Vercel preset:          .vercel/output + srvx
 */
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const host = process.env.HOST || process.env.NITRO_HOST || "0.0.0.0";
const port = process.env.PORT || process.env.NITRO_PORT || "8080";

const nodeServer = [
  resolve(root, ".output/server/index.mjs"),
  resolve(root, "dist/server/index.mjs"),
  resolve(root, "dist/server/server.js"),
].find((p) => existsSync(p));

const vercelEntry = resolve(
  root,
  ".vercel/output/functions/__server.func/index.mjs",
);
const vercelStatic = resolve(root, ".vercel/output/static");
const srvxBin = resolve(root, "node_modules/srvx/bin/srvx.mjs");

const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || "production",
  HOST: host,
  PORT: String(port),
  NITRO_HOST: host,
  NITRO_PORT: String(port),
};

// WASM/data files are not part of the JS bundle — copy them next to it.
spawnSync(process.execPath, [resolve(root, "scripts/copy-pglite-assets.mjs")], {
  stdio: "inherit",
  cwd: root,
});

function attach(child) {
  const shutdown = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGHUP", () => shutdown("SIGHUP"));
  child.on("exit", (code, signal) => {
    if (signal) process.exit(1);
    process.exit(code ?? 1);
  });
}

if (nodeServer) {
  console.log(`[prod-preview] node ${nodeServer} (${host}:${port})`);
  attach(
    spawn(process.execPath, [nodeServer], {
      stdio: "inherit",
      env,
      cwd: root,
    }),
  );
} else if (existsSync(vercelEntry) && existsSync(srvxBin)) {
  console.log(`[prod-preview] srvx ${vercelEntry} (${host}:${port})`);
  attach(
    spawn(
      process.execPath,
      [
        srvxBin,
        "--prod",
        `--port=${port}`,
        `--host=${host}`,
        `--static=${vercelStatic}`,
        "--entry",
        vercelEntry,
      ],
      {
        stdio: "inherit",
        env: { ...env, ALLOW_PGLITE: process.env.ALLOW_PGLITE || "true" },
        cwd: resolve(root, ".vercel/output/functions/__server.func"),
      },
    ),
  );
} else {
  console.error(
    "[prod-preview] No production server found. Run `npm run build` first.",
  );
  console.error("Looked for .output/server/index.mjs and .vercel/output.");
  process.exit(1);
}
