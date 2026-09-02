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
 * - VITE_MATCH_MODE=true → show Match Mode (must be server-backed)
 * - VITE_MATCH_MODE unset/false → Match Mode hidden
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
 * Person-first swipe matcher. Off until explicitly enabled.
 * Server functions exist; keep the tile hidden until two real accounts work.
 */
export function isMatchModeEnabled(): boolean {
  return viteFlag("VITE_MATCH_MODE") === "true";
}

/** Starting rating for a new real account. */
export const STARTING_RATING = 1500;
