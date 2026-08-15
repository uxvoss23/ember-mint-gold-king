/** Only this Google / email identity gets admin (work orders, court editor). */
export const ADMIN_EMAIL = "seanvoss23@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
