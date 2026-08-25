import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { optionalAuthMiddleware } from "@/lib/auth/optional-middleware";
import { STARTING_RATING } from "@/lib/config";
import { getSql, withTransaction, type Sql } from "@/lib/db";
import { applyConfirmedResult, canConfirmScore, canDisputeScore, canEnterScore, canJoinGame, validateScores } from "@/lib/game/rules";
import {
  handleFromName,
  newId,
  rowToMatch,
  rowToMessage,
  rowToPlayer,
  type GameRow,
  type MessageRow,
  type PlayerRow,
} from "@/lib/game/map";
import type { Match, MatchGame, Player } from "@/lib/upset/types";

const scoreSchema = z.object({ a: z.number().int().min(0).max(99), b: z.number().int().min(0).max(99) });

type Snapshot = { players: Player[]; matches: Match[]; meId: string };

async function loadPlayer(sql: Sql, id: string): Promise<PlayerRow | null> {
  const rows = await sql.query<PlayerRow>("select * from player where id = $1", [id]);
  return rows[0] ?? null;
}

async function loadPlayerByUser(sql: Sql, userId: string): Promise<PlayerRow | null> {
  const rows = await sql.query<PlayerRow>("select * from player where user_id = $1", [userId]);
  return rows[0] ?? null;
}

async function requirePlayer(sql: Sql, userId: string): Promise<PlayerRow> {
  const existing = await loadPlayerByUser(sql, userId);
  if (existing) return existing;
  const users = await sql.query<{ name: string; email: string | null; image: string | null }>(
    `select name, email, image from "user" where id = $1`,
    [userId],
  );
  const u = users[0];
  const name = (u?.name && u.name.trim()) || u?.email?.split("@")[0] || "Player";
  const handle = handleFromName(name);
  const rows = await sql.query<PlayerRow>(
    `insert into player (id, user_id, name, handle, photo_url, rating, rating_last_week)
     values ($1, $1, $2, $3, $4, $5, $5)
     on conflict (user_id) do update set
       name = excluded.name,
       photo_url = coalesce(excluded.photo_url, player.photo_url),
       updated_at = now()
     returning *`,
    [userId, name, handle, u?.image ?? null, STARTING_RATING],
  );
  if (!rows[0]) throw new Error("Could not create player profile.");
  return rows[0];
}

async function loadInvites(sql: Sql, gameIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (gameIds.length === 0) return map;
  const ph = gameIds.map((_, i) => `$${i + 1}`).join(",");
  const rows = await sql.query<{ game_id: string; player_id: string }>(
    `select game_id, player_id from game_invite where game_id in (${ph})`,
    gameIds,
  );
  for (const r of rows) {
    const list = map.get(r.game_id) ?? [];
    list.push(r.player_id);
    map.set(r.game_id, list);
  }
  return map;
}

async function loadMessages(sql: Sql, gameIds: string[]): Promise<Map<string, ReturnType<typeof rowToMessage>[]>> {
  const map = new Map<string, ReturnType<typeof rowToMessage>[]>();
  if (gameIds.length === 0) return map;
  const ph = gameIds.map((_, i) => `$${i + 1}`).join(",");
  const rows = await sql.query<MessageRow>(
    `select * from game_message where game_id in (${ph}) order by created_at asc`,
    gameIds,
  );
  for (const r of rows) {
    const list = map.get(r.game_id) ?? [];
    list.push(rowToMessage(r));
    map.set(r.game_id, list);
  }
  return map;
}

async function hydrateMatches(sql: Sql, games: GameRow[]): Promise<Match[]> {
  const ids = games.map((g) => g.id);
  const [invites, chat] = await Promise.all([loadInvites(sql, ids), loadMessages(sql, ids)]);
  return games.map((g) =>
    rowToMatch(g, { invites: invites.get(g.id) ?? [], chat: chat.get(g.id) ?? [] }),
  );
}

async function addSystemMessage(sql: Sql, gameId: string, text: string) {
  await sql.query(
    `insert into game_message (id, game_id, author_name, body, system) values ($1, $2, $3, $4, true)`,
    [newId("msg"), gameId, "Upset City", text],
  );
}

async function loadVisibleGames(sql: Sql, meId: string | null): Promise<GameRow[]> {
  if (meId) {
    return sql.query<GameRow>(
      `select * from game
       where status <> 'cancelled'
          or cancelled_at > now() - interval '7 days'
       order by created_at desc
       limit 200`,
    );
  }
  return sql.query<GameRow>(
    `select * from game
     where invite_only = false
       and status not in ('cancelled')
     order by created_at desc
     limit 200`,
  );
}

function filterVisible(games: Match[], meId: string | null): Match[] {
  if (!meId) {
    return games.filter((m) => !m.inviteOnly && m.status !== "cancelled");
  }
  return games.filter((m) => {
    const mine =
      m.hostId === meId ||
      m.opponentId === meId ||
      (m.guestInviteIds ?? []).includes(meId);
    if (m.status === "cancelled") return mine;
    if (!m.inviteOnly) return true;
    return mine;
  });
}

async function buildSnapshot(sql: Sql, meId: string | null): Promise<Snapshot> {
  const [playerRows, gameRows] = await Promise.all([
    sql.query<PlayerRow>(
      `select * from player where hide_from_catalog = false or id = $1 order by rating desc, games_played desc, wins desc, id`,
      [meId],
    ),
    loadVisibleGames(sql, meId),
  ]);
  const matches = filterVisible(await hydrateMatches(sql, gameRows), meId);
  return {
    players: playerRows.map(rowToPlayer),
    matches,
    meId: meId ?? "",
  };
}

export const loadCompetitiveSnapshot = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }): Promise<Snapshot> => {
    const sql = await getSql();
    const me = context.userId ? await loadPlayerByUser(sql, context.userId) : null;
    return buildSnapshot(sql, me?.id ?? null);
  });

export const ensureMyPlayer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        name: z.string().max(80).optional(),
        image: z.string().max(500).optional(),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ context, data }): Promise<Player> => {
    const sql = await getSql();
    const row = await requirePlayer(sql, context.userId);
    if (data.name || data.image) {
      const updated = await sql.query<PlayerRow>(
        `update player set
           name = coalesce($2, name),
           photo_url = coalesce($3, photo_url),
           updated_at = now()
         where id = $1
         returning *`,
        [row.id, data.name?.trim() || null, data.image || null],
      );
      return rowToPlayer(updated[0] ?? row);
    }
    return rowToPlayer(row);
  });

export const createGameFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        courtId: z.string().min(1).max(80),
        courtName: z.string().min(1).max(120),
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180),
        preferredAt: z.string().min(10),
        format: z.enum(["1v1", "horse"]).default("1v1"),
        notes: z.string().max(500).optional(),
        hostBringingBall: z.boolean(),
        inviteOnly: z.boolean().default(false),
        guestInviteIds: z.array(z.string()).max(20).default([]),
        kind: z.enum(["broadcast", "challenge", "invite"]).default("broadcast"),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }): Promise<Match> => {
    const when = new Date(data.preferredAt);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
      throw new Error("Pick a time in the future.");
    }
    if (data.inviteOnly && data.guestInviteIds.length === 0) {
      throw new Error("Private matches need at least one invite.");
    }
    const sql = await getSql();
    const me = await requirePlayer(sql, context.userId);
    const id = newId("g");
    const invites = data.guestInviteIds.filter((x) => x && x !== me.id);
    await sql.query(
      `insert into game (
         id, kind, format, host_id, court_id, court_name, lat, lon,
         preferred_at, status, notes, host_bringing_ball, invite_only
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open',$10,$11,$12)`,
      [
        id,
        data.kind,
        data.format,
        me.id,
        data.courtId,
        data.courtName,
        data.lat,
        data.lon,
        when.toISOString(),
        data.notes ?? "",
        data.hostBringingBall,
        data.inviteOnly,
      ],
    );
    for (const pid of invites) {
      await sql.query(
        `insert into game_invite (game_id, player_id) values ($1, $2) on conflict do nothing`,
        [id, pid],
      );
    }
    const ballLine = data.hostBringingBall
      ? "Host is bringing a ball."
      : "Host is not bringing a ball.";
    await addSystemMessage(
      sql,
      id,
      `Match posted. ${data.inviteOnly ? "Private — invite only." : "Public — anyone can join."} Ranked 1v1 · best of 3 to 11 win by 2. ${ballLine}`,
    );
    const rows = await sql.query<GameRow>("select * from game where id = $1", [id]);
    const [match] = await hydrateMatches(sql, rows);
    if (!match) throw new Error("Game was created but could not be loaded.");
    return match;
  });

export const joinGameFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z.object({ gameId: z.string(), bringingBall: z.boolean() }).parse(raw),
  )
  .handler(async ({ context, data }): Promise<{ ok: true } | { ok: false; reason: "filled" | "invite_only" }> => {
    return withTransaction(async (sql) => {
      const me = await requirePlayer(sql, context.userId);
      const games = await sql.query<GameRow>("select * from game where id = $1", [data.gameId]);
      const game = games[0];
      if (!game) return { ok: false as const, reason: "filled" as const };
      const invites = await sql.query<{ player_id: string }>(
        `select player_id from game_invite where game_id = $1`,
        [data.gameId],
      );
      const check = canJoinGame({
        status: game.status,
        hostId: game.host_id,
        opponentId: game.opponent_id,
        inviteOnly: game.invite_only,
        inviteeIds: invites.map((i) => i.player_id),
        actorId: me.id,
      });
      if (!check.ok) {
        if (check.reason === "invite_only") return { ok: false as const, reason: "invite_only" };
        return { ok: false as const, reason: "filled" as const };
      }
      if (game.opponent_id === me.id) return { ok: true as const };
      const updated = await sql.query<GameRow>(
        `update game set
           opponent_id = $2,
           status = 'scheduled',
           scheduled_at = preferred_at,
           accepted_at = now(),
           opponent_bringing_ball = $3,
           updated_at = now()
         where id = $1 and status = 'open' and opponent_id is null and host_id <> $2
         returning *`,
        [data.gameId, me.id, data.bringingBall],
      );
      if (!updated[0]) return { ok: false as const, reason: "filled" as const };
      const neither = updated[0].host_bringing_ball === false && data.bringingBall === false;
      await addSystemMessage(
        sql,
        data.gameId,
        data.bringingBall ? "Challenger is bringing a ball." : "Challenger is not bringing a ball.",
      );
      if (neither) {
        await addSystemMessage(
          sql,
          data.gameId,
          "Neither of you is bringing a basketball — figure it out in chat so tip-off isn’t empty-handed.",
        );
      } else {
        await addSystemMessage(sql, data.gameId, "Game locked in.");
      }
      return { ok: true as const };
    });
  });

export const cancelGameFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        gameId: z.string(),
        reason: z.string().max(200).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requirePlayer(sql, context.userId);
    const games = await sql.query<GameRow>("select * from game where id = $1", [data.gameId]);
    const game = games[0];
    if (!game) throw new Error("Game not found.");
    const isHost = game.host_id === me.id;
    const isOpp = game.opponent_id === me.id;
    if (!isHost && !isOpp) throw new Error("Only participants can leave this game.");
    if (game.status === "confirmed") throw new Error("A confirmed result cannot be cancelled.");
    if (isOpp && game.status === "scheduled") {
      await sql.query(
        `update game set opponent_id = null, status = 'open', accepted_at = null,
           opponent_bringing_ball = null, updated_at = now()
         where id = $1 and opponent_id = $2 and status = 'scheduled'`,
        [data.gameId, me.id],
      );
      await addSystemMessage(sql, data.gameId, `${me.name} left the game. It’s open again.`);
      return { ok: true as const, action: "left" as const };
    }
    await sql.query(
      `update game set status = 'cancelled', cancelled_by = $2, cancel_reason = $3,
         cancelled_at = now(), updated_at = now()
       where id = $1 and status not in ('confirmed','cancelled')`,
      [data.gameId, me.id, data.reason ?? ""],
    );
    await addSystemMessage(sql, data.gameId, `${me.name} cancelled the game.`);
    return { ok: true as const, action: "cancelled" as const };
  });

export const sendGameMessageFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z.object({ gameId: z.string(), text: z.string().min(1).max(1000) }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requirePlayer(sql, context.userId);
    const games = await sql.query<GameRow>("select * from game where id = $1", [data.gameId]);
    const game = games[0];
    if (!game) throw new Error("Game not found.");
    const invited = await sql.query<{ player_id: string }>(
      `select player_id from game_invite where game_id = $1 and player_id = $2`,
      [data.gameId, me.id],
    );
    const allowed =
      game.host_id === me.id ||
      game.opponent_id === me.id ||
      invited.length > 0;
    if (!allowed) throw new Error("You can’t message this game.");
    const id = newId("msg");
    await sql.query(
      `insert into game_message (id, game_id, author_id, author_name, body, system)
       values ($1,$2,$3,$4,$5,false)`,
      [id, data.gameId, me.id, me.name, data.text.trim()],
    );
    return { ok: true as const, id };
  });

export const submitScoreFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z.object({ gameId: z.string(), scores: z.array(scoreSchema).min(1).max(3) }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const invalid = validateScores(data.scores);
    if (invalid) throw new Error(invalid);
    const sql = await getSql();
    const me = await requirePlayer(sql, context.userId);
    const games = await sql.query<GameRow>("select * from game where id = $1", [data.gameId]);
    const game = games[0];
    if (!game) throw new Error("Game not found.");
    const check = canEnterScore({
      status: game.status,
      hostId: game.host_id,
      opponentId: game.opponent_id,
      actorId: me.id,
    });
    if (!check.ok) throw new Error(check.reason);
    await sql.query(
      `update game set scores_json = $2, score_entered_by = $3, score_confirmed_by = null,
         status = 'played_pending', updated_at = now()
       where id = $1`,
      [data.gameId, JSON.stringify(data.scores), me.id],
    );
    await addSystemMessage(
      sql,
      data.gameId,
      `${me.name} submitted scores (${data.scores.map((g) => `${g.a}–${g.b}`).join(", ")}). Opponent must confirm before ratings lock.`,
    );
    return { ok: true as const };
  });

export const confirmScoreFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => z.object({ gameId: z.string() }).parse(raw))
  .handler(async ({ context, data }) => {
    return withTransaction(async (sql) => {
      const me = await requirePlayer(sql, context.userId);
      const games = await sql.query<GameRow>(
        `select * from game where id = $1 for update`,
        [data.gameId],
      );
      const game = games[0];
      if (!game) throw new Error("Game not found.");
      if (game.status === "confirmed") return { ok: true as const, already: true };
      const check = canConfirmScore({
        status: game.status,
        hostId: game.host_id,
        opponentId: game.opponent_id,
        scoreEnteredBy: game.score_entered_by,
        actorId: me.id,
      });
      if (!check.ok) throw new Error(check.reason);
      const scores = (JSON.parse(game.scores_json || "[]") as MatchGame[]) ?? [];
      const invalid = validateScores(scores);
      if (invalid) throw new Error(invalid);
      const host = await loadPlayer(sql, game.host_id);
      const opp = game.opponent_id ? await loadPlayer(sql, game.opponent_id) : null;
      if (!host || !opp) throw new Error("Players missing.");
      const applied = applyConfirmedResult({
        host: {
          rating: host.rating,
          gamesPlayed: host.games_played,
          wins: host.wins,
          losses: host.losses,
          streak: host.streak,
          pointsScored: host.points_scored,
          pointsAllowed: host.points_allowed,
          weeklyWins: host.weekly_wins,
          weeklyLosses: host.weekly_losses,
        },
        opp: {
          rating: opp.rating,
          gamesPlayed: opp.games_played,
          wins: opp.wins,
          losses: opp.losses,
          streak: opp.streak,
          pointsScored: opp.points_scored,
          pointsAllowed: opp.points_allowed,
          weeklyWins: opp.weekly_wins,
          weeklyLosses: opp.weekly_losses,
        },
        scores,
      });
      try {
        await sql.query(
          `insert into rating_event (
             id, game_id, host_id, opponent_id,
             host_rating_before, host_rating_after,
             opponent_rating_before, opponent_rating_after,
             host_delta, opponent_delta, actual_a, expected_a, scores_json
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            newId("re"),
            game.id,
            host.id,
            opp.id,
            host.rating,
            applied.host.rating,
            opp.rating,
            applied.opp.rating,
            applied.result.aDelta,
            applied.result.bDelta,
            applied.result.actualA,
            applied.result.expectedA,
            JSON.stringify(scores),
          ],
        );
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === "23505") return { ok: true as const, already: true };
        throw err;
      }
      await sql.query(
        `update player set
           rating = $2, games_played = $3, wins = $4, losses = $5, streak = $6,
           points_scored = $7, points_allowed = $8, weekly_wins = $9, weekly_losses = $10,
           updated_at = now()
         where id = $1`,
        [
          host.id,
          applied.host.rating,
          applied.host.gamesPlayed,
          applied.host.wins,
          applied.host.losses,
          applied.host.streak,
          applied.host.pointsScored,
          applied.host.pointsAllowed,
          applied.host.weeklyWins,
          applied.host.weeklyLosses,
        ],
      );
      await sql.query(
        `update player set
           rating = $2, games_played = $3, wins = $4, losses = $5, streak = $6,
           points_scored = $7, points_allowed = $8, weekly_wins = $9, weekly_losses = $10,
           updated_at = now()
         where id = $1`,
        [
          opp.id,
          applied.opp.rating,
          applied.opp.gamesPlayed,
          applied.opp.wins,
          applied.opp.losses,
          applied.opp.streak,
          applied.opp.pointsScored,
          applied.opp.pointsAllowed,
          applied.opp.weeklyWins,
          applied.opp.weeklyLosses,
        ],
      );
      await sql.query(
        `update game set status = 'confirmed', score_confirmed_by = $2,
           rating_delta_host = $3, rating_delta_opp = $4, updated_at = now()
         where id = $1`,
        [game.id, me.id, applied.result.aDelta, applied.result.bDelta],
      );
      await addSystemMessage(
        sql,
        game.id,
        `Result dual-confirmed. ${applied.hostWon ? host.name : opp.name} wins. Ratings updated.`,
      );
      return { ok: true as const, already: false };
    });
  });

export const disputeScoreFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z.object({ gameId: z.string(), reason: z.string().max(400).optional() }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requirePlayer(sql, context.userId);
    const games = await sql.query<GameRow>("select * from game where id = $1", [data.gameId]);
    const game = games[0];
    if (!game) throw new Error("Game not found.");
    const check = canDisputeScore({
      status: game.status,
      hostId: game.host_id,
      opponentId: game.opponent_id,
      scoreEnteredBy: game.score_entered_by,
      actorId: me.id,
    });
    if (!check.ok) throw new Error(check.reason);
    await sql.query(
      `update game set status = 'disputed', score_confirmed_by = null, updated_at = now() where id = $1 and status = 'played_pending'`,
      [data.gameId],
    );
    await sql.query(
      `insert into score_dispute (id, game_id, opened_by, reason, status) values ($1,$2,$3,$4,'open')`,
      [newId("sd"), data.gameId, me.id, data.reason ?? "Score disputed by opponent"],
    );
    await addSystemMessage(
      sql,
      data.gameId,
      "Score disputed — ratings not updated. Agree on the result and re-submit. Upset City does not auto-moderate disputes.",
    );
    return { ok: true as const };
  });

export const challengePlayerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        targetId: z.string(),
        courtId: z.string(),
        courtName: z.string(),
        lat: z.number(),
        lon: z.number(),
        preferredAt: z.string(),
        notes: z.string().max(400).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }): Promise<Match> => {
    const sql = await getSql();
    const me = await requirePlayer(sql, context.userId);
    if (data.targetId === me.id) throw new Error("You can’t challenge yourself.");
    const target = await loadPlayer(sql, data.targetId);
    if (!target) throw new Error("Player not found.");
    if (!target.open_to_challenges) throw new Error("They aren’t open to challenges.");
    const blocked = await sql.query(
      `select 1 from player_block where (actor_id = $1 and target_id = $2) or (actor_id = $2 and target_id = $1)`,
      [me.id, target.id],
    );
    if (blocked.length) throw new Error("You can’t challenge this player.");
    const id = newId("g");
    await sql.query(
      `insert into game (
         id, kind, format, host_id, court_id, court_name, lat, lon,
         preferred_at, status, notes, invite_only
       ) values ($1,'challenge','1v1',$2,$3,$4,$5,$6,$7,'open',$8,true)`,
      [
        id,
        me.id,
        data.courtId,
        data.courtName,
        data.lat,
        data.lon,
        data.preferredAt,
        data.notes ?? `Challenge from ${me.name}`,
      ],
    );
    await sql.query(
      `insert into game_invite (game_id, player_id) values ($1, $2) on conflict do nothing`,
      [id, target.id],
    );
    await sql.query(
      `insert into challenge (id, from_id, to_id, game_id, status, court_id, court_name, lat, lon, preferred_at, message)
       values ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,$10)`,
      [
        newId("ch"),
        me.id,
        target.id,
        id,
        data.courtId,
        data.courtName,
        data.lat,
        data.lon,
        data.preferredAt,
        data.notes ?? "",
      ],
    );
    await addSystemMessage(sql, id, `${me.name} challenged ${target.name}. Private until they join.`);
    const rows = await sql.query<GameRow>("select * from game where id = $1", [id]);
    const [match] = await hydrateMatches(sql, rows);
    if (!match) throw new Error("Challenge created but could not be loaded.");
    return match;
  });

export const setAvailabilityFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        status: z.enum(["available", "busy", "offline"]),
        preferredHour: z.number().int().min(0).max(23).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requirePlayer(sql, context.userId);
    await sql.query(
      `update player set availability = $2, preferred_hour = coalesce($3, preferred_hour), updated_at = now() where id = $1`,
      [me.id, data.status, data.preferredHour ?? null],
    );
    await sql.query(
      `insert into player_availability (player_id, status, preferred_hour, updated_at)
       values ($1,$2,$3,now())
       on conflict (player_id) do update set status = excluded.status, preferred_hour = excluded.preferred_hour, updated_at = now()`,
      [me.id, data.status, data.preferredHour ?? null],
    );
    return { ok: true as const };
  });

export const matchDecideFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z.object({ targetId: z.string(), decision: z.enum(["like", "pass"]) }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requirePlayer(sql, context.userId);
    if (data.targetId === me.id) throw new Error("That’s you.");
    await sql.query(
      `insert into match_decision (actor_id, target_id, decision) values ($1,$2,$3)
       on conflict (actor_id, target_id) do update set decision = excluded.decision, created_at = now()`,
      [me.id, data.targetId, data.decision],
    );
    if (data.decision !== "like") return { matched: false as const };
    const reciprocal = await sql.query<{ decision: string }>(
      `select decision from match_decision where actor_id = $1 and target_id = $2`,
      [data.targetId, me.id],
    );
    if (reciprocal[0]?.decision !== "like") return { matched: false as const };
    const a = me.id < data.targetId ? me.id : data.targetId;
    const b = me.id < data.targetId ? data.targetId : me.id;
    await sql.query(
      `insert into match_connection (id, player_a_id, player_b_id) values ($1,$2,$3)
       on conflict (player_a_id, player_b_id) do nothing`,
      [newId("mc"), a, b],
    );
    return { matched: true as const };
  });

export const listMatchCandidatesFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Player[]> => {
    const sql = await getSql();
    const me = await requirePlayer(sql, context.userId);
    const rows = await sql.query<PlayerRow>(
      `select p.* from player p
       where p.id <> $1
         and p.hide_from_catalog = false
         and p.open_to_challenges = true
         and not exists (
           select 1 from match_decision d
           where d.actor_id = $1 and d.target_id = p.id
         )
         and not exists (
           select 1 from player_block b
           where (b.actor_id = $1 and b.target_id = p.id)
              or (b.actor_id = p.id and b.target_id = $1)
         )
         and not exists (
           select 1 from match_connection c
           where (c.player_a_id = least($1, p.id) and c.player_b_id = greatest($1, p.id))
         )
       order by p.rating desc
       limit 50`,
      [me.id],
    );
    return rows.map(rowToPlayer);
  });

export const blockPlayerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => z.object({ targetId: z.string() }).parse(raw))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requirePlayer(sql, context.userId);
    if (data.targetId === me.id) throw new Error("You can’t block yourself.");
    await sql.query(
      `insert into player_block (actor_id, target_id) values ($1,$2) on conflict do nothing`,
      [me.id, data.targetId],
    );
    return { ok: true as const };
  });

export const reportPlayerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z.object({ targetId: z.string(), reason: z.string().min(1).max(400) }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requirePlayer(sql, context.userId);
    await sql.query(
      `insert into player_report (id, actor_id, target_id, reason) values ($1,$2,$3,$4)`,
      [newId("rp"), me.id, data.targetId, data.reason],
    );
    return { ok: true as const };
  });
