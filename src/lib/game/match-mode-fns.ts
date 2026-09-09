import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { appLog } from "@/lib/log";
import type { SoftAvailability } from "@/lib/upset/hoop-now";

export type MatchModeSnapshot = {
  joinedIds: string[];
  likedIds: string[];
  passedIds: string[];
  inboundLikeIds: string[];
  availability: Record<string, SoftAvailability>;
  mutual: { playerId: string; matchedAt: string }[];
};

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function rowToAvailability(row: {
  player_id: string;
  blocked_dates: unknown;
  time_bands: unknown;
  travel_radius_miles: number | string | null;
  note: string | null;
  updated_at: string;
}): SoftAvailability {
  const radius = Number(row.travel_radius_miles);
  return {
    blockedDates: parseJsonArray(row.blocked_dates),
    timeBands: parseJsonArray(row.time_bands) as SoftAvailability["timeBands"],
    travelRadiusMiles:
      Number.isFinite(radius) && radius > 0 ? radius : 10,
    note: row.note?.trim() || undefined,
    updatedAt: row.updated_at,
  };
}

async function requireNamedPlayer(sql: Sql, userId: string) {
  const rows = await sql.query<{ id: string; name: string }>(
    `select id, name from player where user_id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) throw new Error("Sign in to continue.");
  return row;
}

async function ensureSchema(sql: Sql) {
  await sql.query(`
    create table if not exists match_availability (
      player_id text primary key,
      blocked_dates jsonb not null default '[]'::jsonb,
      time_bands jsonb not null default '[]'::jsonb,
      travel_radius_miles int not null default 10,
      note text,
      updated_at timestamptz not null default now()
    )
  `);
  await sql.query(`
    create table if not exists match_swipe (
      actor_id text not null,
      target_id text not null,
      direction text not null,
      created_at timestamptz not null default now(),
      primary key (actor_id, target_id)
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

async function readSnapshot(sql: Sql, meId: string): Promise<MatchModeSnapshot> {
  await ensureSchema(sql);
  const [joined, mine, inbound, mutual] = await Promise.all([
    sql.query<{
      player_id: string;
      blocked_dates: unknown;
      time_bands: unknown;
      travel_radius_miles: number | string | null;
      note: string | null;
      updated_at: string;
    }>(`select * from match_availability`),
    sql.query<{ target_id: string; direction: string }>(
      `select target_id, direction from match_swipe where actor_id = $1`,
      [meId],
    ),
    sql.query<{ actor_id: string }>(
      `select actor_id from match_swipe where target_id = $1 and direction = 'like'`,
      [meId],
    ),
    sql.query<{ player_id: string; matched_at: string }>(
      `select b.actor_id as player_id, greatest(a.created_at, b.created_at) as matched_at
       from match_swipe a
       join match_swipe b
         on b.actor_id = a.target_id
        and b.target_id = a.actor_id
        and b.direction = 'like'
       where a.actor_id = $1 and a.direction = 'like'`,
      [meId],
    ),
  ]);

  const availability: Record<string, SoftAvailability> = {};
  for (const row of joined) availability[row.player_id] = rowToAvailability(row);

  return {
    joinedIds: joined.map((r) => r.player_id),
    likedIds: mine.filter((s) => s.direction === "like").map((s) => s.target_id),
    passedIds: mine.filter((s) => s.direction === "pass").map((s) => s.target_id),
    inboundLikeIds: inbound.map((r) => r.actor_id),
    availability,
    mutual: mutual.map((m) => ({
      playerId: m.player_id,
      matchedAt: m.matched_at,
    })),
  };
}

const availabilitySchema = z.object({
  blockedDates: z.array(z.string()).max(31),
  timeBands: z.array(z.enum(["morning", "afternoon", "evening", "late"])).max(4),
  travelRadiusMiles: z.number().min(1).max(50),
  note: z.string().max(280).optional(),
});

export const loadMatchModeSnapshot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<MatchModeSnapshot> => {
    const sql = await getSql();
    const me = await requireNamedPlayer(sql, context.userId);
    return readSnapshot(sql, me.id);
  });

export const saveMatchAvailabilityFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => availabilitySchema.parse(raw))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requireNamedPlayer(sql, context.userId);
    await ensureSchema(sql);
    await sql.query(
      `insert into match_availability (
         player_id, blocked_dates, time_bands, travel_radius_miles, note, updated_at
       ) values ($1, $2::jsonb, $3::jsonb, $4, $5, now())
       on conflict (player_id) do update set
         blocked_dates = excluded.blocked_dates,
         time_bands = excluded.time_bands,
         travel_radius_miles = excluded.travel_radius_miles,
         note = excluded.note,
         updated_at = now()`,
      [
        me.id,
        JSON.stringify([...new Set(data.blockedDates)].sort()),
        JSON.stringify([...new Set(data.timeBands)]),
        data.travelRadiusMiles,
        data.note?.trim() || null,
      ],
    );
    appLog("match.availability", { playerId: me.id });
    return readSnapshot(sql, me.id);
  });

export const swipeMatchFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        targetId: z.string().min(1),
        direction: z.enum(["like", "pass"]),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requireNamedPlayer(sql, context.userId);
    await ensureSchema(sql);
    if (data.targetId === me.id) throw new Error("You can’t swipe on yourself.");
    const target = await sql.query(
      `select id from player where id = $1 and hide_from_catalog = false`,
      [data.targetId],
    );
    if (!target[0]) throw new Error("Player not found.");
    if (await isBlocked(sql, me.id, data.targetId)) {
      throw new Error("You can’t match with that player.");
    }
    await sql.query(
      `insert into match_swipe (actor_id, target_id, direction)
       values ($1, $2, $3)
       on conflict (actor_id, target_id) do update set
         direction = excluded.direction,
         created_at = now()`,
      [me.id, data.targetId, data.direction],
    );
    let theyLikedYou = false;
    if (data.direction === "like") {
      const reverse = await sql.query(
        `select 1 from match_swipe
         where actor_id = $1 and target_id = $2 and direction = 'like'`,
        [data.targetId, me.id],
      );
      theyLikedYou = reverse.length > 0;
    }
    appLog("match.swipe", {
      playerId: me.id,
      direction: data.direction,
      matched: theyLikedYou,
    });
    return {
      matched: theyLikedYou,
      theyLikedYou,
      snapshot: await readSnapshot(sql, me.id),
    };
  });

export const rewindMatchSwipeFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => z.object({ targetId: z.string().min(1) }).parse(raw))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requireNamedPlayer(sql, context.userId);
    await ensureSchema(sql);
    await sql.query(
      `delete from match_swipe where actor_id = $1 and target_id = $2`,
      [me.id, data.targetId],
    );
    return readSnapshot(sql, me.id);
  });
