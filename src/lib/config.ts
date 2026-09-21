/**
 * Runtime feature flags.
 *
 * Client-visible flags MUST use the `VITE_` prefix (Vite inlines them).
 * Missing values default to the safest production behavior.
 *
 * Canonical list: `.env.example` (keep `env.example` identical).
 *
 * - VITE_DEMO_MODE=true  → labeled seed/demo data is allowed
 * - VITE_DEMO_MODE unset/false → production: no seeded competitive data
 * - VITE_MATCH_MODE=false → hide Match Mode
 * - VITE_MATCH_MODE unset/true → Match Mode on (server-backed likes)
 */

function viteFlag(name: string): string | undefined {
  const env = import.meta.env as Record<string, string | boolean | undefined>;
  const raw = env[name];
  if (raw == null) return undefined;
  return String(raw);
}

/** True only when explicitly enabled. Unset → production (no seeds). */
export function isDemoMode(): boolean {
  return viteFlag("VITE_DEMO_MODE") === "true";
}

/**
 * Person-first swipe matcher. On unless explicitly disabled.
 * Likes, passes, and availability persist on the server.
 */
export function isMatchModeEnabled(): boolean {
  return viteFlag("VITE_MATCH_MODE") !== "false";
}

/** Starting rating for a new real account. */
export const STARTING_RATING = 1500;

/** Fixed practice player for solo 1v1 testing (no second account). */
export const TEST_OPPONENT_ID = "p-test-opponent";
