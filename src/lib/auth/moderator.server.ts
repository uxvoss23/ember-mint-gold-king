import type { Sql } from "@/lib/db";
import { assertModeratorEmail, isAdminEmail } from "@/lib/auth/admin";
import { appLog } from "@/lib/log";

/**
 * Server gate for court edits / work orders / moderation.
 * Prefers `player.role = moderator`. Bootstrap emails get the role on first use.
 */
export async function requireModerator(sql: Sql, userId: string): Promise<void> {
  await sql.query(
    `alter table player add column if not exists role text not null default 'player'`,
  );
  const rows = await sql.query<{ role: string | null; email: string | null }>(
    `select p.role, u.email
       from "user" u
       left join player p on p.user_id = u.id
      where u.id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) {
    const err = new Error("Forbidden");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  if (row.role === "moderator") return;

  try {
    assertModeratorEmail(row.email);
  } catch (err) {
    appLog("admin.forbidden", { ok: false });
    throw err;
  }

  if (row.email && isAdminEmail(row.email)) {
    await sql.query(
      `update player set role = 'moderator', updated_at = now() where user_id = $1 and role is distinct from 'moderator'`,
      [userId],
    );
    appLog("admin.role.granted", { ok: true });
  }
}
