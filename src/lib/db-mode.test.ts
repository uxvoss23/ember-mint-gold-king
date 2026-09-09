/**
 * Production DB fail-closed vs explicit PGLite preview.
 * Run: node --experimental-strip-types --no-warnings src/lib/db-mode.test.ts
 */
import {
  PRODUCTION_DB_REQUIRED_MESSAGE,
  resolveDbBackend,
} from "./db-mode.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(resolveDbBackend({ DATABASE_URL: "postgres://x" }) === "neon", "url → neon");
  assert(
    resolveDbBackend({ DATABASE_URL: "  " }) !== "neon",
    "whitespace url is unset",
  );
  assert(
    resolveDbBackend({ NODE_ENV: "development" }) === "pglite",
    "dev without url → pglite",
  );
  assert(
    resolveDbBackend({ NODE_ENV: "production" }) === "refuse",
    "production without url refuses",
  );
  assert(
    resolveDbBackend({ VERCEL: "1" }) === "refuse",
    "VERCEL without url refuses",
  );
  assert(
    resolveDbBackend({ NODE_ENV: "production", ALLOW_PGLITE: "true" }) === "pglite",
    "ALLOW_PGLITE permits preview pglite",
  );
  assert(
    resolveDbBackend({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://x",
      ALLOW_PGLITE: "true",
    }) === "neon",
    "real url wins over pglite flag",
  );
  assert(
    resolveDbBackend({ NODE_ENV: "production", ALLOW_PGLITE: "yes" }) === "refuse",
    "only the exact true flag permits pglite",
  );
  assert(PRODUCTION_DB_REQUIRED_MESSAGE.includes("ALLOW_PGLITE"), "message mentions override");
  console.log("ALL DB MODE TESTS PASSED");
}

run();
