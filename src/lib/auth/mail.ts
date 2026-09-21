import { appLog, appLogError } from "../log.ts";
import { rememberAuthMail } from "./mail-outbox.ts";

export type MailKind = "reset" | "verify" | "alert";

type MailEnv = {
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
};

export function mailConfigured(env: MailEnv = process.env): boolean {
  return Boolean(env.RESEND_API_KEY?.trim());
}

export function mailFrom(env: MailEnv = process.env): string {
  const from = env.MAIL_FROM?.trim();
  return from || "Upset City <noreply@upsetcity.app>";
}

function copy(
  kind: MailKind,
  url: string,
  alert?: { subject: string; text: string },
): { subject: string; text: string; html: string } {
  if (kind === "alert" && alert) {
    return {
      subject: alert.subject,
      text: `${alert.text}\n\n${url}`,
      html: `<p>${alert.text}</p><p><a href="${url}">Open in Upset City</a></p>`,
    };
  }
  if (kind === "reset") {
    return {
      subject: "Reset your Upset City password",
      text: `Reset your Upset City password:\n${url}\n\nThis link expires in 1 hour. If you didn’t ask for this, ignore the email.`,
      html: `<p>Reset your Upset City password:</p><p><a href="${url}">Choose a new password</a></p><p>This link expires in 1 hour. If you didn’t ask for this, ignore the email.</p>`,
    };
  }
  return {
    subject: "Verify your Upset City email",
    text: `Verify your Upset City email:\n${url}\n\nIf you didn’t create an account, ignore this email.`,
    html: `<p>Verify your Upset City email:</p><p><a href="${url}">Confirm this email</a></p><p>If you didn’t create an account, ignore this email.</p>`,
  };
}

/** Rewrite Better Auth’s API-ish URL into an in-app page URL. */
export function appMailUrl(authUrl: string, token: string, kind: MailKind): string {
  try {
    const origin = new URL(authUrl).origin;
    if (kind === "reset") {
      return `${origin}/reset-password?token=${encodeURIComponent(token)}`;
    }
    return `${origin}/api/auth/verify-email?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent("/login?verified=1")}`;
  } catch {
    return authUrl;
  }
}

export async function sendAppEmail(opts: {
  to: string;
  kind: MailKind;
  url: string;
  env?: MailEnv;
  fetchImpl?: typeof fetch;
  alert?: { subject: string; text: string };
}): Promise<{ sent: boolean }> {
  const env = opts.env ?? process.env;
  const key = env.RESEND_API_KEY?.trim();
  rememberAuthMail(opts.to, opts.kind, opts.url);
  if (opts.to.trim().toLowerCase().endsWith("@upsetcity.test")) {
    appLog("auth.mail.skipped", { kind: opts.kind, reason: "test-user" });
    return { sent: false };
  }
  if (!key) {
    appLog("auth.mail.skipped", { kind: opts.kind, reason: "unconfigured" });
    return { sent: false };
  }

  const { subject, text, html } = copy(opts.kind, opts.url, opts.alert);
  try {
    const fetchImpl = opts.fetchImpl ?? fetch;
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mailFrom(env),
        to: [opts.to],
        subject,
        text,
        html,
      }),
    });
    if (!res.ok) {
      appLog("auth.mail.failed", { kind: opts.kind, status: res.status });
      return { sent: false };
    }
    appLog("auth.mail.sent", { kind: opts.kind });
    return { sent: true };
  } catch (err) {
    appLogError("auth.mail.failed", err, { kind: opts.kind });
    return { sent: false };
  }
}
