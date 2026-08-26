import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { isAdminEmail } from "@/lib/auth/admin";
import { getSql, withTransaction, type Sql } from "@/lib/db";
import { applyConfirmedResult, validateScores } from "@/lib/game/rules";
import { newId, type GameRow, type PlayerRow } from "@/lib/game/map";
import type { MatchGame } from "@/lib/upset/types";

async function requireModerator(sql: Sql, userId: string): Promise<{ userId: string; email: string }> {
  const users = await sql.query<{ email: string | null }>(
    `select email from "user" where id = $1`,
    [userId],
  );
  const email = users[0]?.email ?? "";
  if (!isAdminEmail(email)) {
    const err = new Error("Forbidden");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  return { userId, email };
}

async function audit(
  sql: Sql,
  row: {
    actorUserId: string;
    action: string;
    targetPlayerId?: string | null;
    gameId?: string | null;
    reportId?: string | null;
    disputeId?: string | null;
    detail?: string | null;
  },
) {
  await sql.query(
    `insert into moderation_audit (id, actor_user_id, action, target_player_id, game_id, report_id, dispute_id, detail)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      newId("ma"),
      row.actorUserId,
      row.action,
      row.targetPlayerId ?? null,
      row.gameId ?? null,
      row.reportId ?? null,
      row.disputeId ?? null,
      row.detail ?? null,
    ],
  );
}

export const listModerationQueueFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await requireModerator(sql, context.userId);
    const disputes = await sql.query<{
      id: string;
      game_id: string;
      opened_by: string;
      reason: string | null;
      status: string;
      created_at: string;
      court_name: string;
      scores_json: string | null;
      host_id: string;
      opponent_id: string | null;
    }>(
      `select d.id, d.game_id, d.opened_by, d.reason, d.status, d.created_at,
              g.court_name, g.scores_json, g.host_id, g.opponent_id
       from score_dispute d
       join game g on g.id = d.game_id
       where d.status = 'open'
       order by d.created_at desc
       limit 50`,
    );
    const reports = await sql.query<{
      id: string;
      actor_id: string;
      target_id: string;
      reason: string;
      status: string;
      created_at: string;
    }>(
      `select id, actor_id, target_id, reason, coalesce(status, 'open') as status, created_at
       from player_report
       where coalesce(status, 'open') = 'open'
       order by created_at desc
       limit 50`,
    );
    return { disputes, reports };
  });

export const voidGameFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z.object({ gameId: z.string(), note: z.string().max(400).optional() }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    return withTransaction(async (sql) => {
      const mod = await requireModerator(sql, context.userId);
      const games = await sql.query<GameRow>(
        `select * from game where id = $1 for update`,
        [data.gameId],
      );
      const game = games[0];
      if (!game) throw new Error("Game not found.");
      if (game.status === "confirmed") {
        throw new Error("Void an already-rated game with a compensating correction, not this action.");
      }
      await sql.query(
        `update game set status = 'cancelled', cancelled_by = $2, cancel_reason = $3,
           cancelled_at = now(), updated_at = now()
         where id = $1 and status <> 'confirmed'`,
        [data.gameId, mod.userId, data.note ?? "Voided by moderator"],
      );
      await sql.query(
        `update score_dispute set status = 'resolved', resolved_by = $2, resolved_at = now(),
           resolution = 'void'
         where game_id = $1 and status = 'open'`,
        [data.gameId, mod.userId],
      );
      await audit(sql, {
        actorUserId: mod.userId,
        action: "void_game",
        gameId: data.gameId,
        detail: data.note ?? null,
      });
      return { ok: true as const };
    });
  });

export const resolveDisputeScoreFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        disputeId: z.string(),
        scores: z.array(z.object({ a: z.number().int().min(0).max(99), b: z.number().int().min(0).max(99) })).min(1).max(3),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const invalid = validateScores(data.scores);
    if (invalid) throw new Error(invalid);
    return withTransaction(async (sql) => {
      const mod = await requireModerator(sql, context.userId);
      const disputes = await sql.query<{
        id: string;
        game_id: string;
        status: string;
      }>(`select id, game_id, status from score_dispute where id = $1 for update`, [data.disputeId]);
      const d = disputes[0];
      if (!d) throw new Error("Dispute not found.");
      if (d.status !== "open") throw new Error("Dispute already resolved.");
      const games = await sql.query<GameRow>(
        `select * from game where id = $1 for update`,
        [d.game_id],
      );
      const game = games[0];
      if (!game) throw new Error("Game not found.");
      if (game.status === "confirmed") throw new Error("Game already rated — use a compensating event.");
      if (!game.opponent_id) throw new Error("Game has no opponent.");
      const hostRows = await sql.query<PlayerRow>(`select * from player where id = $1 for update`, [game.host_id]);
      const oppRows = await sql.query<PlayerRow>(`select * from player where id = $1 for update`, [game.opponent_id]);
      const host = hostRows[0];
      const opp = oppRows[0];
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
        scores: data.scores as MatchGame[],
      });
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
          JSON.stringify(data.scores),
        ],
      );
      await sql.query(
        `update player set rating = $2, games_played = $3, wins = $4, losses = $5, streak = $6,
           points_scored = $7, points_allowed = $8, weekly_wins = $9, weekly_losses = $10, updated_at = now()
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
        `update player set rating = $2, games_played = $3, wins = $4, losses = $5, streak = $6,
           points_scored = $7, points_allowed = $8, weekly_wins = $9, weekly_losses = $10, updated_at = now()
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
        `update game set status = 'confirmed', scores_json = $2, score_confirmed_by = $3,
           rating_delta_host = $4, rating_delta_opp = $5, updated_at = now()
         where id = $1`,
        [game.id, JSON.stringify(data.scores), mod.userId, applied.result.aDelta, applied.result.bDelta],
      );
      await sql.query(
        `update score_dispute set status = 'resolved', resolved_by = $2, resolved_at = now(),
           resolution = 'corrected_score'
         where id = $1`,
        [d.id, mod.userId],
      );
      await audit(sql, {
        actorUserId: mod.userId,
        action: "resolve_dispute_score",
        gameId: game.id,
        disputeId: d.id,
        detail: JSON.stringify(data.scores),
      });
      return { ok: true as const };
    });
  });

export const dismissReportFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => z.object({ reportId: z.string() }).parse(raw))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const mod = await requireModerator(sql, context.userId);
    await sql.query(
      `update player_report set status = 'dismissed', resolved_by = $2, resolved_at = now()
       where id = $1`,
      [data.reportId, mod.userId],
    );
    await audit(sql, {
      actorUserId: mod.userId,
      action: "dismiss_report",
      reportId: data.reportId,
    });
    return { ok: true as const };
  });

export const setPlayerDisciplineFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        playerId: z.string(),
        action: z.enum(["warn", "suspend", "ban"]),
        hours: z.number().int().min(1).max(24 * 30).optional(),
        note: z.string().max(400).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const mod = await requireModerator(sql, context.userId);
    if (data.action === "warn") {
      await sql.query(`update player set warn_count = warn_count + 1, updated_at = now() where id = $1`, [
        data.playerId,
      ]);
    } else if (data.action === "suspend") {
      const hours = data.hours ?? 24;
      const until = new Date(Date.now() + hours * 3600_000).toISOString();
      await sql.query(
        `update player set suspended_until = $2, updated_at = now() where id = $1`,
        [data.playerId, until],
      );
    } else {
      await sql.query(`update player set banned_at = now(), updated_at = now() where id = $1`, [data.playerId]);
    }
    await sql.query(
      `insert into moderation_note (id, target_player_id, author_user_id, body)
       values ($1,$2,$3,$4)`,
      [newId("mn"), data.playerId, mod.userId, data.note ?? data.action],
    );
    await audit(sql, {
      actorUserId: mod.userId,
      action: `discipline_${data.action}`,
      targetPlayerId: data.playerId,
      detail: data.note ?? null,
    });
    return { ok: true as const };
  });
