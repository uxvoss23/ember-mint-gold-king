#!/usr/bin/env node
/**
 * Apply migrations on a clean DB and on a Phase-2-only DB.
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

async function files() {
  return (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
}

async function apply(pg, names) {
  await pg.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  );
  for (const name of names) {
    const already = await pg.query("SELECT 1 FROM _migrations WHERE name = $1", [name]);
    if (already.rows.length) continue;
    const text = await readFile(join(dir, name), "utf8");
    await pg.exec("BEGIN");
    try {
      await pg.exec(text);
      await pg.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
      await pg.exec("COMMIT");
    } catch (err) {
      await pg.exec("ROLLBACK");
      throw new Error(`${name}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

async function main() {
  const all = await files();
  const phase2 = all.filter((n) => n <= "0002_core_loop.sql");
  const rest = all.filter((n) => n > "0002_core_loop.sql");

  const clean = new PGlite();
  await apply(clean, all);
  const cleanCount = await clean.query("SELECT count(*)::int AS n FROM _migrations");
  console.log(`clean db: ${cleanCount.rows[0].n} migrations`);

  const existing = new PGlite();
  await apply(existing, phase2);
  const before = await existing.query("SELECT count(*)::int AS n FROM _migrations");
  await apply(existing, rest);
  const after = await existing.query("SELECT count(*)::int AS n FROM _migrations");
  console.log(`existing Phase 2 db: ${before.rows[0].n} → ${after.rows[0].n} migrations`);

  if (Number(cleanCount.rows[0].n) !== all.length) {
    throw new Error("clean migrate missed files");
  }
  if (Number(after.rows[0].n) !== all.length) {
    throw new Error("existing migrate missed files");
  }
  console.log("ALL MIGRATION TESTS PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
