/**
 * Which sign-in surfaces are live. Pure so tests can cover “OAuth off, email on”
 * without spinning Better Auth.
 *
 * - VITE_AUTH_ENABLED=false → no sessions, no OAuth (shared dev user on PGLite)
 * - otherwise sessions (email/password) are on
 * - Google/X only when a broker client secret is present
 */
export type AuthModeEnv = {
  VITE_AUTH_ENABLED?: string;
  GROK_AUTH_CLIENT_SECRET?: string;
  GROK_PREVIEW_CLIENT_SECRET?: string;
};

export function resolveAuthProviders(env: AuthModeEnv): {
  sessions: boolean;
  oauth: boolean;
} {
  if (env.VITE_AUTH_ENABLED === "false") {
    return { sessions: false, oauth: false };
  }
  const secret = (
    env.GROK_AUTH_CLIENT_SECRET ??
    env.GROK_PREVIEW_CLIENT_SECRET ??
    ""
  ).trim();
  return { sessions: true, oauth: Boolean(secret) };
}
