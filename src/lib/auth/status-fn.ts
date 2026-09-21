import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isProductionRuntime } from "@/lib/db-mode";

/** Public: which sign-in methods are live. No secrets. */
export const getAuthProvidersFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    oauth: boolean;
    emailPassword: boolean;
    resetEmail: boolean;
  }> => {
    const { oauthConfigured, authConfigured } = await import("./server");
    const { emailAndPasswordEnabled } = await import("./email-password");
    const { mailConfigured } = await import("./mail");
    return {
      oauth: oauthConfigured,
      emailPassword: authConfigured && emailAndPasswordEnabled,
      resetEmail: mailConfigured(),
    };
  },
);

/**
 * Preview-only: latest reset/verify URL when Resend is off.
 * Never returns a token when a real DATABASE_URL is set (production).
 */
export const peekAuthMailFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        email: z.string().email(),
        kind: z.enum(["reset", "verify"]),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<{ url: string | null }> => {
    const { mailConfigured } = await import("./mail");
    if (mailConfigured()) return { url: null };
    if (process.env.DATABASE_URL?.trim()) return { url: null };
    if (isProductionRuntime(process.env)) return { url: null };
    const { peekAuthMail } = await import("./mail-outbox");
    return { url: peekAuthMail(data.email, data.kind) };
  });

/** Public launch diagnostics. Never includes secrets. */
export const getLaunchStatusFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    production: boolean;
    database: boolean;
    mail: boolean;
    oauth: boolean;
    authUrlSet: boolean;
    publicHostSet: boolean;
  }> => {
    const { oauthConfigured } = await import("./server");
    const { mailConfigured } = await import("./mail");
    return {
      production: isProductionRuntime(process.env),
      database: Boolean(process.env.DATABASE_URL?.trim()),
      mail: mailConfigured(),
      oauth: oauthConfigured,
      authUrlSet: Boolean(process.env.BETTER_AUTH_URL?.trim()),
      publicHostSet: Boolean(process.env.VITE_PUBLIC_HOSTNAME?.trim()),
    };
  },
);
