import { sendAppEmail } from "@/lib/auth/mail";
import type { Sql } from "@/lib/db";
import { newId } from "@/lib/game/map";
import type { NoticeKind, PlayerNotice } from "@/lib/upset/types";

export type { NoticeKind, PlayerNotice };

export async function ensureNoticeSchema(sql: Sql) {
  await sql.query(`
    create table if not exists player_notice (
      id text primary key,
      player_id text not null,
      kind text not null,
      title text not null,
      body text not null,
      match_id text,
      from_player_id text,
      read_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);
}

function appOrigin(): string {
  const explicit = process.env.BETTER_AUTH_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const host = process.env.VITE_PUBLIC_HOSTNAME?.trim();
  if (host) return `https://${host.replace(/^https?:\/\//, "")}`;
  return "https://upsetcity.app";
}

async function recipientEmail(sql: Sql, playerId: string): Promise<string | null> {
  const rows = await sql.query<{ email: string | null }>(
    `select u.email from player p
       join "user" u on u.id = p.user_id
      where p.id = $1`,
    [playerId],
  );
  const email = rows[0]?.email?.trim();
  return email || null;
}

const EMAIL_KINDS = new Set<NoticeKind>(["invite", "opponent_locked", "score_pending"]);

export async function insertNotice(
  sql: Sql,
  opts: {
    playerId: string;
    kind: NoticeKind;
    title: string;
    body: string;
    matchId?: string | null;
    fromPlayerId?: string | null;
  },
): Promise<void> {
  if (!opts.playerId || opts.playerId === opts.fromPlayerId) return;
  await ensureNoticeSchema(sql);
  const id = newId("nt");
  await sql.query(
    `insert into player_notice
       (id, player_id, kind, title, body, match_id, from_player_id)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [
      id,
      opts.playerId,
      opts.kind,
      opts.title,
      opts.body,
      opts.matchId ?? null,
      opts.fromPlayerId ?? null,
    ],
  );
  if (!EMAIL_KINDS.has(opts.kind)) {
    /* still push */
  } else {
    const email = await recipientEmail(sql, opts.playerId);
    if (email) {
      const url = opts.matchId ? `${appOrigin()}/?g=${encodeURIComponent(opts.matchId)}` : appOrigin();
      await sendAppEmail({
        to: email,
        kind: "alert",
        url,
        alert: { subject: opts.title, text: opts.body },
      });
    }
  }
  try {
    const { sendPushToPlayer } = await import("@/lib/push/server");
    const path = opts.matchId
      ? `/?g=${encodeURIComponent(opts.matchId)}`
      : opts.kind === "dm"
        ? "/?inbox=1"
        : "/";
    await sendPushToPlayer(sql, opts.playerId, {
      title: opts.title,
      body: opts.body,
      url: path,
      tag: opts.kind,
    });
  } catch {
    /* push is optional */
  }
}

export function notifySoon(
  sql: Sql,
  opts: Parameters<typeof insertNotice>[1],
) {
  void insertNotice(sql, opts).catch(() => {
    /* next snapshot still works without the alert */
  });
}

export async function loadNotices(sql: Sql, playerId: string): Promise<PlayerNotice[]> {
  await ensureNoticeSchema(sql);
  const rows = await sql.query<{
    id: string;
    kind: NoticeKind;
    title: string;
    body: string;
    match_id: string | null;
    from_player_id: string | null;
    read_at: string | Date | null;
    created_at: string | Date;
  }>(
    `select id, kind, title, body, match_id, from_player_id, read_at, created_at
       from player_notice
      where player_id = $1
      order by created_at desc
      limit 40`,
    [playerId],
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    matchId: r.match_id ?? undefined,
    fromPlayerId: r.from_player_id ?? undefined,
    readAt: r.read_at ? new Date(r.read_at).toISOString() : undefined,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function markNoticesRead(sql: Sql, playerId: string, ids?: string[]) {
  await ensureNoticeSchema(sql);
  if (ids?.length) {
    const ph = ids.map((_, i) => `$${i + 2}`).join(",");
    await sql.query(
      `update player_notice set read_at = now()
        where player_id = $1 and read_at is null and id in (${ph})`,
      [playerId, ...ids],
    );
    return;
  }
  await sql.query(
    `update player_notice set read_at = now() where player_id = $1 and read_at is null`,
    [playerId],
  );
}
