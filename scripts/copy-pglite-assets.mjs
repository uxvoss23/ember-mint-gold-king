#!/usr/bin/env node
/**
 * Nitro bundles @electric-sql/pglite JS but not pglite.wasm / pglite.data /
 * initdb.wasm. Those are loaded via `new URL("./pglite.data", import.meta.url)`.
 * Copy them next to the bundled pglite module so local/CI `npm run preview`
 * can boot PGLite. No-op when the bundle or source files are missing.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = process.cwd();
const srcDir = resolve(root, "node_modules/@electric-sql/pglite/dist");
const files = ["pglite.data", "pglite.wasm", "initdb.wasm"];

function walk(dir, depth, out) {
  if (depth < 0 || !existsSync(dir)) return;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) walk(p, depth - 1, out);
    else if (name.isFile() && /pglite/i.test(name.name) && name.name.endsWith(".mjs")) {
      out.push(p);
    }
  }
}

const destDirs = new Set();
for (const base of [
  resolve(root, ".output/server"),
  resolve(root, ".vercel/output/functions/__server.func"),
]) {
  const found = [];
  walk(base, 4, found);
  for (const f of found) destDirs.add(dirname(f));
  // Known nitro layout even if the filename pattern changes.
  destDirs.add(join(base, "_libs"));
}

let copied = 0;
for (const dest of destDirs) {
  if (!existsSync(dest)) continue;
  for (const name of files) {
    const from = join(srcDir, name);
    const to = join(dest, name);
    if (!existsSync(from)) {
      console.warn(`[pglite-assets] missing source ${from}`);
      continue;
    }
    mkdirSync(dest, { recursive: true });
    copyFileSync(from, to);
    copied += 1;
  }
}

if (copied === 0) {
  console.warn(
    "[pglite-assets] nothing copied (run after `vite build`, with @electric-sql/pglite installed)",
  );
} else {
  console.log(`[pglite-assets] copied ${copied} files into ${destDirs.size} dir(s)`);
}
