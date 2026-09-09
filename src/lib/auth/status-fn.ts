import { createServerFn } from "@tanstack/react-start";

/** Public: which sign-in methods are live. No secrets. */
export const getAuthProvidersFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ oauth: boolean; emailPassword: boolean }> => {
    const { oauthConfigured, authConfigured } = await import("./server");
    const { emailAndPasswordEnabled } = await import("./email-password");
    return {
      oauth: oauthConfigured,
      emailPassword: authConfigured && emailAndPasswordEnabled,
    };
  },
);
