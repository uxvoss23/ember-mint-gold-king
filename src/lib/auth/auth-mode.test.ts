/**
 * OAuth-off / email-on vs production fail-closed for federated providers.
 * Run: node --experimental-strip-types --no-warnings src/lib/auth/auth-mode.test.ts
 */
import { resolveAuthProviders } from "./auth-mode.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(
    resolveAuthProviders({}).sessions === true,
    "default: sessions on (email/password)",
  );
  assert(
    resolveAuthProviders({}).oauth === false,
    "default: OAuth off when secret missing",
  );
  assert(
    resolveAuthProviders({ VITE_AUTH_ENABLED: "false" }).sessions === false,
    "explicit off disables sessions",
  );
  assert(
    resolveAuthProviders({ VITE_AUTH_ENABLED: "false" }).oauth === false,
    "explicit off disables OAuth",
  );
  assert(
    resolveAuthProviders({ GROK_AUTH_CLIENT_SECRET: "rotated" }).oauth === true,
    "secret enables OAuth",
  );
  assert(
    resolveAuthProviders({ GROK_PREVIEW_CLIENT_SECRET: "preview" }).oauth ===
      true,
    "preview secret enables OAuth",
  );
  assert(
    resolveAuthProviders({ GROK_AUTH_CLIENT_SECRET: "   " }).oauth === false,
    "whitespace secret is unset",
  );
  assert(
    resolveAuthProviders({
      VITE_AUTH_ENABLED: "false",
      GROK_AUTH_CLIENT_SECRET: "x",
    }).oauth === false,
    "auth-off wins over a present secret",
  );
  console.log("ALL AUTH MODE TESTS PASSED");
}

run();
