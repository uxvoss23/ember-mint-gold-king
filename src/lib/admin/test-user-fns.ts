import { createServerFn } from "@tanstack/react-start";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { isModeratorMe } from "@/lib/auth/admin";
import { authMiddleware } from "@/lib/auth/middleware";
import { persistCourtPhoto } from "@/lib/courts/photo-store";
import { getSql, type Sql } from "@/lib/db";
import { newId } from "@/lib/game/map";
import { appLog } from "@/lib/log";
import {
  seedForPreset,
  testEmailForHandle,
  TEST_USER_PRESETS,
  type TestUserPreset,
} from "@/lib/admin/test-users";

export type TestUserRow = {
  id: string;
  userId: string;
  name: string;
  handle: string;
  email: string;
  photoUrl: string | null;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  neighborhood: string | null;
  preset: string | null;
  state: string;
  createdAt: string;
};

async function requireModerator(sql: Sql, userId: string) {
  const rows = await sql.query<{ email: string | null; role: string | null }>(
    `select u.email, p.role
       from "user" u
       left join player p on p.user_id = u.id
      where u.id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row || !isModeratorMe(row.role, row.email)) {
    const err = new Error("Forbidden");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
}

async function ensureSchema(sql: Sql) {
  await sql.query(
    `alter table player add column if not exists is_test_user boolean not null default false`,
  );
  await sql.query(`alter table player add column if not exists test_preset text`);
  await sql.query(`
    create table if not exists admin_impersonation (
      target_session_token text primary key,
      admin_user_id text not null,
      admin_session_token text not null,
      target_user_id text not null,
      created_at timestamptz not null default now()
    )
  `);
}

async function listRows(sql: Sql): Promise<TestUserRow[]> {
  await ensureSchema(sql);
  const rows = await sql.query<{
    id: string;
    user_id: string;
    name: string;
    handle: string;
    email: string | null;
    photo_url: string | null;
    rating: number;
    games_played: number;
    wins: number;
    losses: number;
    neighborhood: string | null;
    test_preset: string | null;
    created_at: string;
    open_games: number;
    profile_completed_at: string | null;
  }>(
    `select p.id, p.user_id, p.name, p.handle, u.email, p.photo_url, p.rating,
            p.games_played, p.wins, p.losses, p.neighborhood, p.test_preset,
            p.created_at, p.profile_completed_at,
            (select count(*)::int from game g
              where (g.host_id = p.id or g.opponent_id = p.id)
                and g.status in ('open','matched','scheduled','played_pending')) as open_games
       from player p
       join "user" u on u.id = p.user_id
      where p.is_test_user = true
      order by p.created_at desc`,
  );
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    handle: r.handle,
    email: r.email ?? "",
    photoUrl: r.photo_url,
    rating: Number(r.rating) || 1500,
    gamesPlayed: Number(r.games_played) || 0,
    wins: Number(r.wins) || 0,
    losses: Number(r.losses) || 0,
    neighborhood: r.neighborhood,
    preset: r.test_preset,
    state: r.open_games > 0
      ? "Active 1v1"
      : r.profile_completed_at
        ? "Ready"
        : "Needs profile",
    createdAt: typeof r.created_at === "string"
      ? r.created_at
      : new Date(r.created_at).toISOString(),
  }));
}

async function applySeed(
  sql: Sql,
  playerId: string,
  userId: string,
  seed: ReturnType<typeof seedForPreset>,
  preset: string,
  photoUrl: string | null,
) {
  const completed = seed.completeProfile ? new Date().toISOString() : null;
  await sql.query(
    `update player set
        name = $2, handle = $3, photo_url = coalesce($4, photo_url),
        rating = $5, rating_last_week = $5, games_played = $6,
        wins = $7, losses = $8, neighborhood = $9, home_court_id = $10,
        bio = $11, experience_years = $12, city = 'Austin',
        profile_completed_at = $13, is_test_user = true, test_preset = $14,
        updated_at = now()
      where id = $1`,
    [
      playerId,
      seed.name,
      seed.handle,
      photoUrl,
      seed.rating,
      seed.gamesPlayed,
      seed.wins,
      seed.losses,
      seed.neighborhood,
      seed.homeCourtId ?? null,
      seed.bio,
      seed.experienceYears,
      completed,
      preset,
    ],
  );
  await sql.query(
    `update "user" set name = $2, image = coalesce($3, image), "updatedAt" = now() where id = $1`,
    [userId, seed.name, photoUrl],
  );
  if (seed.openGame) {
    const existing = await sql.query<{ id: string }>(
      `select id from game where host_id = $1 and status in ('open','matched','scheduled') limit 1`,
      [playerId],
    );
    if (!existing[0]) {
      const when = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
      await sql.query(
        `insert into game (
           id, kind, format, host_id, court_id, court_name, lat, lon,
           preferred_at, scheduled_at, status, host_bringing_ball
         ) values ($1,'broadcast','1v1',$2,'cat-butler','Butler Park Courts',
           30.2634, -97.7525, $3, $3, 'open', true)`,
        [newId("g"), playerId, when],
      );
    }
  }
}

async function readIncomingSessionToken(): Promise<string | null> {
  const { getRequest, getCookie } = await import("@tanstack/react-start/server");
  const { SESSION_TOKEN_COOKIE } = await import("@/lib/auth/server");
  const req = getRequest();
  const authz = req?.headers.get("authorization");
  if (authz?.toLowerCase().startsWith("bearer ")) {
    const token = authz.slice(7).trim();
    if (token) return token;
  }
  return getCookie(SESSION_TOKEN_COOKIE) ?? null;
}

export const listTestUsersFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await requireModerator(sql, context.userId);
    await ensureSchema(sql);
    return listRows(sql);
  });

export const createTestUserFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        preset: z.enum(TEST_USER_PRESETS).optional(),
        name: z.string().min(1).max(80).optional(),
        handle: z.string().min(2).max(24).optional(),
        email: z.string().email().max(120).optional(),
        rating: z.number().min(800).max(2500).optional(),
        neighborhood: z.string().max(80).optional(),
        photoUrl: z.string().max(280_000).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireModerator(sql, context.userId);
    await ensureSchema(sql);
    const preset = (data.preset ?? "average") as TestUserPreset;
    const seed = seedForPreset(preset);
    if (data.name?.trim()) seed.name = data.name.trim();
    if (data.handle?.trim()) {
      seed.handle = data.handle
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "")
        .slice(0, 24);
    }
    if (data.rating) seed.rating = data.rating;
    if (data.neighborhood?.trim()) seed.neighborhood = data.neighborhood.trim();
    const email = data.email?.trim().toLowerCase() || testEmailForHandle(seed.handle);
    const taken = await sql.query(`select 1 from "user" where email = $1`, [email]);
    if (taken[0]) throw new Error("That email is already in use.");
    const userId = newId("tu");
    const passwordHash = await hashPassword(
      `test-${seed.handle}-${Math.random().toString(36).slice(2, 10)}`,
    );
    await sql.query(
      `insert into "user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
       values ($1, $2, $3, true, null, now(), now())`,
      [userId, seed.name, email],
    );
    await sql.query(
      `insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       values ($1, $2, 'credential', $2, $3, now(), now())`,
      [newId("acc"), userId, passwordHash],
    );
    await sql.query(
      `insert into player (id, user_id, name, handle, photo_url, rating, rating_last_week, is_test_user, test_preset)
       values ($1, $1, $2, $3, null, $4, $4, true, $5)`,
      [userId, seed.name, seed.handle, seed.rating, preset],
    );
    let photoUrl: string | null = null;
    if (data.photoUrl) {
      photoUrl = await persistCourtPhoto(sql, `player-${userId}`, data.photoUrl);
    }
    await applySeed(sql, userId, userId, seed, preset, photoUrl);
    appLog("admin.test-user.create", { preset, ok: true });
    return listRows(sql);
  });

export const resetTestUserFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => z.object({ userId: z.string().min(1).max(80) }).parse(raw))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireModerator(sql, context.userId);
    await ensureSchema(sql);
    const rows = await sql.query<{
      id: string;
      test_preset: string | null;
      name: string;
      handle: string;
      photo_url: string | null;
    }>(
      `select id, test_preset, name, handle, photo_url from player where user_id = $1 and is_test_user = true`,
      [data.userId],
    );
    const row = rows[0];
    if (!row) throw new Error("Test user not found.");
    const preset = (TEST_USER_PRESETS as readonly string[]).includes(row.test_preset ?? "")
      ? (row.test_preset as TestUserPreset)
      : "average";
    await sql.query(`delete from game where host_id = $1 or opponent_id = $1`, [row.id]);
    const seed = seedForPreset(preset);
    seed.name = row.name;
    seed.handle = row.handle;
    await applySeed(sql, row.id, data.userId, seed, preset, row.photo_url);
    appLog("admin.test-user.reset", { ok: true });
    return listRows(sql);
  });

export const deleteTestUserFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => z.object({ userId: z.string().min(1).max(80) }).parse(raw))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireModerator(sql, context.userId);
    await ensureSchema(sql);
    if (data.userId === context.userId) throw new Error("Can’t delete the signed-in account.");
    const rows = await sql.query<{ id: string }>(
      `select id from player where user_id = $1 and is_test_user = true`,
      [data.userId],
    );
    if (!rows[0]) throw new Error("Test user not found.");
    await sql.query(`delete from challenge where from_id = $1 or to_id = $1`, [rows[0].id]).catch(() => undefined);
    await sql.query(`delete from game where host_id = $1 or opponent_id = $1`, [rows[0].id]);
    await sql.query(`delete from admin_impersonation where target_user_id = $1`, [data.userId]);
    await sql.query(`delete from "user" where id = $1`, [data.userId]);
    appLog("admin.test-user.delete", { ok: true });
    return listRows(sql);
  });

export const updateTestUserPhotoFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        userId: z.string().min(1).max(80),
        photo: z.string().max(280_000).nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireModerator(sql, context.userId);
    await ensureSchema(sql);
    const rows = await sql.query<{ id: string; user_id: string }>(
      `select id, user_id from player where user_id = $1 and is_test_user = true`,
      [data.userId],
    );
    const row = rows[0];
    if (!row) throw new Error("Test user not found.");
    let next: string | null = null;
    if (data.photo?.trim()) {
      next = await persistCourtPhoto(sql, `player-${row.id}`, data.photo.trim());
    }
    await sql.query(
      `update player set photo_url = $2, updated_at = now() where id = $1`,
      [row.id, next],
    );
    await sql.query(
      `update "user" set image = $2, "updatedAt" = now() where id = $1`,
      [row.user_id, next],
    );
    appLog("admin.test-user.photo", { ok: true, removed: !next });
    return listRows(sql);
  });

export const impersonateTestUserFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => z.object({ userId: z.string().min(1).max(80) }).parse(raw))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireModerator(sql, context.userId);
    await ensureSchema(sql);
    if (data.userId === context.userId) throw new Error("You’re already that user.");
    const target = await sql.query<{ id: string; name: string }>(
      `select id, name from player where user_id = $1 and is_test_user = true`,
      [data.userId],
    );
    if (!target[0]) throw new Error("Test user not found.");
    const adminToken = await readIncomingSessionToken();
    if (!adminToken) throw new Error("Couldn’t keep the admin session.");
    const { auth } = await import("@/lib/auth/server");
    const authCtx = await auth.$context;
    const session = await authCtx.internalAdapter.createSession(data.userId);
    if (!session?.token) throw new Error("Couldn’t start that session.");
    await sql.query(
      `insert into admin_impersonation (
         target_session_token, admin_user_id, admin_session_token, target_user_id
       ) values ($1, $2, $3, $4)
       on conflict (target_session_token) do update set
         admin_user_id = excluded.admin_user_id,
         admin_session_token = excluded.admin_session_token,
         target_user_id = excluded.target_user_id,
         created_at = now()`,
      [session.token, context.userId, adminToken, data.userId],
    );
    appLog("admin.test-user.impersonate", { ok: true });
    return { token: session.token, adminToken, name: target[0].name };
  });

export const stopImpersonationFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureSchema(sql);
    const current = await readIncomingSessionToken();
    const rows = await sql.query<{
      admin_session_token: string;
      admin_user_id: string;
    }>(
      `select admin_session_token, admin_user_id from admin_impersonation
        where target_session_token = $1 or target_user_id = $2
        order by created_at desc limit 1`,
      [current ?? "", context.userId],
    );
    const row = rows[0];
    if (!row) throw new Error("No admin session to restore.");
    if (current) {
      await sql.query(`delete from admin_impersonation where target_session_token = $1`, [current]);
    }
    appLog("admin.test-user.stop-impersonate", { ok: true });
    return { token: row.admin_session_token };
  });

export const impersonationStatusFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureSchema(sql);
    const current = await readIncomingSessionToken();
    const rows = await sql.query<{ name: string }>(
      `select p.name
         from admin_impersonation i
         join player p on p.user_id = i.target_user_id
        where i.target_session_token = $1 or i.target_user_id = $2
        order by i.created_at desc limit 1`,
      [current ?? "", context.userId],
    );
    const name = rows[0]?.name;
    if (!name) return { viewingAs: null as { name: string } | null };
    return { viewingAs: { name } };
  });
