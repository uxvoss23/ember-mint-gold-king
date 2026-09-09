/**
 * Decide which database backend to use. Pure so tests can cover fail-closed
 * production without spinning up PGLite or Neon.
 *
 * - DATABASE_URL set → Neon
 * - production (NODE_ENV=production or VERCEL) without DATABASE_URL → refuse
 *   unless ALLOW_PGLITE=true (local/CI production preview only)
 * - otherwise → PGLite (vite dev / auth-off sandbox)
 */
export type DbDecision = "neon" | "pglite" | "refuse";

export type DbModeEnv = {
  DATABASE_URL?: string;
  NODE_ENV?: string;
  VERCEL?: string;
  ALLOW_PGLITE?: string;
};

export const PRODUCTION_DB_REQUIRED_MESSAGE =
  "DATABASE_URL is required in production. Refusing to start with an ephemeral in-memory database. Isolated CI/preview may set ALLOW_PGLITE=true.";

export function isProductionRuntime(env: DbModeEnv): boolean {
  return env.NODE_ENV === "production" || Boolean(env.VERCEL && env.VERCEL !== "0");
}

export function resolveDbBackend(env: DbModeEnv): DbDecision {
  const url = env.DATABASE_URL?.trim();
  if (url) return "neon";
  if (isProductionRuntime(env) && env.ALLOW_PGLITE !== "true") return "refuse";
  return "pglite";
}
