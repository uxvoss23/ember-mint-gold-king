/** Only this Google / email identity gets admin (work orders, court editor). */
export const ADMIN_EMAIL = "seanvoss23@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

/** Server-side gate. Never trust a client-supplied identity. */
export function assertModeratorEmail(email: string | null | undefined): string {
  const normalized = email?.trim() ?? "";
  if (!isAdminEmail(normalized)) {
    const err = new Error("Forbidden");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  return normalized.toLowerCase();
}
