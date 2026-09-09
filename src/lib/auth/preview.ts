/**
 * Shared LIVE-PREVIEW OAuth client (server-only — NEVER import from the client).
 *
 * The client ID is public. The client secret is NEVER committed: read
 * GROK_AUTH_CLIENT_SECRET or GROK_PREVIEW_CLIENT_SECRET on the server.
 * If OAuth is enabled and the secret is missing, federation is disabled
 * (fail closed). Email/password still works when that flag is on.
 */
export const PREVIEW_CLIENT_ID = "grok_preview";

/** Server-only. Empty string if unset — callers must fail closed. */
export function previewClientSecret(): string | undefined {
  const a = process.env.GROK_AUTH_CLIENT_SECRET?.trim();
  const b = process.env.GROK_PREVIEW_CLIENT_SECRET?.trim();
  return a || b || undefined;
}

/** The shared auth broker issuer (OIDC discovery lives under it). */
export const GROK_ISSUER_DEFAULT = "https://auth.grok.me";

/**
 * Host patterns whose callbacks the preview client accepts. Better Auth derives
 * the live preview's real origin from the request host and validates it against
 * this list (wildcard-matched), so the OAuth `redirect_uri` becomes the concrete
 * `https://<preview-host>/api/auth/oauth2/callback/...` the broker allows.
 */
export const PREVIEW_ALLOWED_HOSTS = ["*.grok-sandbox.com"] as const;
