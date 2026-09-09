import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { newId } from "@/lib/game/map";
import type { DirectThread } from "@/lib/upset/types";
import { canMessagePlayer, type DmPrivacy } from "@/lib/game/privacy";
import { consumeRateLimit } from "@/lib/game/rate-limit";

async function requireNamedPlayer(sql: Sql, userId: string) {
  const rows = await sql.query<{ id: string; name: string }>(
    `select id, name from player where user_id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) throw new Error("Sign in to continue.");
  return row;
}

function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

async function ensureSchema(sql: Sql) {
  await sql.query(`
    create table if not exists player_friend (
      player_a_id text not null,
      player_b_id text not null,
      created_at timestamptz not null default now(),
      primary key (player_a_id, player_b_id)
    )
  `);
  await sql.query(`
    create table if not exists dm_thread (
      id text primary key,
      player_a_id text not null,
      player_b_id text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await sql.query(`
    create table if not exists dm_message (
      id text primary key,
      thread_id text not null,
      author_id text not null,
      author_name text not null,
      body text not null,
      created_at timestamptz not null default now()
    )
  `);
}

async function isBlocked(sql: Sql, a: string, b: string) {
  const rows = await sql.query(
    `select 1 from player_block
     where (actor_id = $1 and target_id = $2) or (actor_id = $2 and target_id = $1)
     limit 1`,
    [a, b],
  );
  return rows.length > 0;
}

export async function loadFriendsAndDms(
  sql: Sql,
  meId: string,
): Promise<{ friendIds: string[]; dmThreads: DirectThread[] }> {
  await ensureSchema(sql);
  const [friends, threads, messages] = await Promise.all([
    sql.query<{ player_a_id: string; player_b_id: string }>(
      `select player_a_id, player_b_id from player_friend
       where player_a_id = $1 or player_b_id = $1`,
      [meId],
    ),
    sql.query<{
      id: string;
      player_a_id: string;
      player_b_id: string;
      updated_at: string;
    }>(
      `select id, player_a_id, player_b_id, updated_at from dm_thread
       where player_a_id = $1 or player_b_id = $1
       order by updated_at desc
       limit 40`,
      [meId],
    ),
    sql.query<{
      id: string;
      thread_id: string;
      author_id: string;
      author_name: string;
      body: string;
      created_at: string;
    }>(
      `select m.id, m.thread_id, m.author_id, m.author_name, m.body, m.created_at
         from dm_message m
         join dm_thread t on t.id = m.thread_id
        where t.player_a_id = $1 or t.player_b_id = $1
        order by m.created_at asc`,
      [meId],
    ),
  ]);

  const msgsBy = new Map<string, DirectThread["messages"]>();
  for (const m of messages) {
    const list = msgsBy.get(m.thread_id) ?? [];
    list.push({
      id: m.id,
      authorId: m.author_id,
      authorName: m.author_name,
      text: m.body,
      at: new Date(m.created_at).toISOString(),
    });
    msgsBy.set(m.thread_id, list);
  }

  return {
    friendIds: friends.map((f) =>
      f.player_a_id === meId ? f.player_b_id : f.player_a_id,
    ),
    dmThreads: threads.map((t) => ({
      id: t.id,
      participantIds: [t.player_a_id, t.player_b_id],
      isRequest: false,
      messages: msgsBy.get(t.id) ?? [],
      updatedAt: new Date(t.updated_at).toISOString(),
    })),
  };
}

export const addFriendFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => z.object({ targetId: z.string().min(1) }).parse(raw))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureSchema(sql);
    const me = await requireNamedPlayer(sql, context.userId);
    if (data.targetId === me.id) throw new Error("You can’t add yourself.");
    if (await isBlocked(sql, me.id, data.targetId)) throw new Error("You can’t add that player.");
    const exists = await sql.query(`select 1 from player where id = $1`, [data.targetId]);
    if (!exists[0]) throw new Error("Player not found.");
    const [a, b] = pair(me.id, data.targetId);
    await sql.query(
      `insert into player_friend (player_a_id, player_b_id) values ($1,$2) on conflict do nothing`,
      [a, b],
    );
    return loadFriendsAndDms(sql, me.id);
  });

export const removeFriendFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => z.object({ targetId: z.string().min(1) }).parse(raw))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureSchema(sql);
    const me = await requireNamedPlayer(sql, context.userId);
    const [a, b] = pair(me.id, data.targetId);
    await sql.query(
      `delete from player_friend where player_a_id = $1 and player_b_id = $2`,
      [a, b],
    );
    return loadFriendsAndDms(sql, me.id);
  });

async function playedTogether(sql: Sql, a: string, b: string): Promise<boolean> {
  const rows = await sql.query(
    `select 1 from game
      where status = 'confirmed'
        and ((host_id = $1 and opponent_id = $2) or (host_id = $2 and opponent_id = $1))
      limit 1`,
    [a, b],
  );
  return rows.length > 0;
}

export const sendDmFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        targetId: z.string().min(1),
        text: z.string().trim().min(1).max(400),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureSchema(sql);
    const me = await requireNamedPlayer(sql, context.userId);
    await consumeRateLimit(sql, "dm", me.id);
    if (data.targetId === me.id) throw new Error("You can’t message yourself.");
    if (await isBlocked(sql, me.id, data.targetId)) throw new Error("You can’t message that player.");
    const target = await sql.query<{ id: string; dm_privacy: string }>(
      `select id, dm_privacy from player where id = $1`,
      [data.targetId],
    );
    if (!target[0]) throw new Error("Player not found.");
    const gate = canMessagePlayer({
      senderId: me.id,
      recipientId: data.targetId,
      recipientPrivacy: (target[0].dm_privacy || "everyone") as DmPrivacy,
      blocked: false,
      playedTogether: await playedTogether(sql, me.id, data.targetId),
    });
    if (!gate.ok) throw new Error(gate.reason);
    const [a, b] = pair(me.id, data.targetId);
    const existing = await sql.query<{ id: string }>(
      `select id from dm_thread where player_a_id = $1 and player_b_id = $2`,
      [a, b],
    );
    const threadId = existing[0]?.id ?? newId("th");
    if (!existing[0]) {
      await sql.query(
        `insert into dm_thread (id, player_a_id, player_b_id) values ($1,$2,$3)`,
        [threadId, a, b],
      );
    }
    await sql.query(
      `insert into dm_message (id, thread_id, author_id, author_name, body)
       values ($1,$2,$3,$4,$5)`,
      [newId("dm"), threadId, me.id, me.name, data.text],
    );
    await sql.query(`update dm_thread set updated_at = now() where id = $1`, [threadId]);
    return loadFriendsAndDms(sql, me.id);
  });
