/**
 * Runtime feature flags.
 *
 * Client-visible flags MUST use the `VITE_` prefix (Vite inlines them).
 * Missing values default to the safest production behavior.
 *
 * - VITE_DEMO_MODE=true  → labeled seed/demo data is allowed
 * - VITE_DEMO_MODE unset/false → production: no seeded competitive data
 * - VITE_MATCH_MODE=true/false → force Match Mode on/off
 * - VITE_MATCH_MODE unset → on in development, off in production builds
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
 * Match Mode uses seeded reciprocal likes in demo. Until the production
 * matcher is proven, default OFF in production builds.
 */
export function isMatchModeEnabled(): boolean {
  const explicit = viteFlag("VITE_MATCH_MODE");
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return Boolean(import.meta.env.DEV);
}

/** Starting rating for a new real account. */
export const STARTING_RATING = 1500;

/** Fixed practice player for solo 1v1 testing (no second account). */
export const TEST_OPPONENT_ID = "p-test-opponent";
