/**
 * Preview/dev fallback when Resend is not configured.
 * Production with RESEND_API_KEY never exposes these URLs.
 */
import type { MailKind } from "./mail";

type Row = { email: string; kind: MailKind; url: string; at: number };

const g = globalThis as typeof globalThis & { __ucAuthMail?: Row[] };

function box(): Row[] {
  g.__ucAuthMail ??= [];
  return g.__ucAuthMail;
}

export function rememberAuthMail(email: string, kind: MailKind, url: string) {
  if (kind !== "reset" && kind !== "verify") return;
  const rows = box();
  rows.unshift({
    email: email.trim().toLowerCase(),
    kind,
    url,
    at: Date.now(),
  });
  rows.splice(12);
}

export function peekAuthMail(email: string, kind: MailKind): string | null {
  const key = email.trim().toLowerCase();
  const row = box().find(
    (r) => r.email === key && r.kind === kind && Date.now() - r.at < 15 * 60_000,
  );
  return row?.url ?? null;
}
