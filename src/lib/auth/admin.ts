/**
 * Moderator access.
 * Server enforcement uses DB `player.role` (see moderator.server.ts) plus a
 * bootstrap email list. The client only uses this to show admin chrome.
 */

export const ADMIN_EMAIL = "seanvoss23@gmail.com";

function extraModeratorEmails(): string[] {
  try {
    const raw =
      typeof process !== "undefined" ? process.env?.MODERATOR_EMAILS : undefined;
    if (!raw || typeof raw !== "string") return [];
    return raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function bootstrapModeratorEmails(): string[] {
  return [...new Set([ADMIN_EMAIL.toLowerCase(), ...extraModeratorEmails()])];
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return bootstrapModeratorEmails().includes(email.trim().toLowerCase());
}

/** UI helper: DB role wins; bootstrap email covers first sign-in. */
export function isModeratorMe(
  role?: string | null,
  email?: string | null,
): boolean {
  if (role === "moderator") return true;
  return isAdminEmail(email);
}

/** Server-side email gate used by bootstrap before role is written. */
export function assertModeratorEmail(email: string | null | undefined): string {
  const normalized = email?.trim() ?? "";
  if (!isAdminEmail(normalized)) {
    const err = new Error("Forbidden");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  return normalized.toLowerCase();
}
