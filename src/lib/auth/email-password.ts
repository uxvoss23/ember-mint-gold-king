/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * Flip `emailAndPasswordEnabled` only. Password reset + verification mail
 * live here so `server.ts` stays a thin wire-up.
 */
import { appMailUrl, sendAppEmail } from "./mail";

export const emailAndPasswordEnabled = true;

export function emailPasswordOptions() {
  return {
    enabled: true as const,
    minPasswordLength: 8,
    resetPasswordTokenExpiresIn: 60 * 60,
    requireEmailVerification: false,
    sendResetPassword: async ({
      user,
      url,
      token,
    }: {
      user: { email: string };
      url: string;
      token: string;
    }) => {
      await sendAppEmail({
        to: user.email,
        kind: "reset",
        url: appMailUrl(url, token, "reset"),
      });
    },
  };
}

export function emailVerificationOptions() {
  return {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({
      user,
      url,
      token,
    }: {
      user: { email: string };
      url: string;
      token: string;
    }) => {
      await sendAppEmail({
        to: user.email,
        kind: "verify",
        url: appMailUrl(url, token, "verify"),
      });
    },
  };
}
