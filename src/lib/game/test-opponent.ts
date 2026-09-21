import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { STARTING_RATING, TEST_OPPONENT_ID } from "@/lib/config";
import { getSql, withTransaction, type Sql } from "@/lib/db";
import { newId, type GameRow, type PlayerRow } from "@/lib/game/map";

export async function ensureTestOpponent(sql: Sql): Promise<PlayerRow> {
  const existing = await sql.query<PlayerRow>("select * from player where id = $1", [TEST_OPPONENT_ID]);
  if (existing[0]) return existing[0];
  const rows = await sql.query<PlayerRow>(
    `insert into player (
       id, user_id, name, handle, bio, hide_from_catalog,
       rating, rating_last_week, hue, open_to_challenges
     ) values ($1, null, $2, $3, $4, true, $5, $5, 200, false)
     on conflict (id) do update set
       name = excluded.name,
       bio = excluded.bio,
       updated_at = now()
     returning *`,
    [
      TEST_OPPONENT_ID,
      "Test Opponent",
      "testopp",
      "Practice player for solo testing. Not a real account.",
      STARTING_RATING,
    ],
  );
  if (!rows[0]) throw new Error("Could not create test opponent.");
  return rows[0];
}

async function addSystemMessage(sql: Sql, gameId: string, text: string) {
  await sql.query(
    `insert into game_message (id, game_id, author_name, body, system) values ($1, $2, $3, $4, true)`,
    [newId("msg"), gameId, "Upset City", text],
  );
}

export const addTestOpponentFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => z.object({ gameId: z.string() }).parse(raw))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    return withTransaction(async (sql) => {
      const meRows = await sql.query<PlayerRow>(
        "select * from player where user_id = $1",
        [context.userId],
      );
      const me = meRows[0];
      if (!me) throw new Error("Create your player profile first.");
      const games = await sql.query<GameRow>(
        `select * from game where id = $1 for update`,
        [data.gameId],
      );
      const game = games[0];
      if (!game) throw new Error("Game not found.");
      if (game.host_id !== me.id) {
        throw new Error("Only the host can add a test opponent.");
      }
      if (game.status !== "open" || game.opponent_id) {
        throw new Error("This game already has an opponent.");
      }
      const opp = await ensureTestOpponent(sql);
      const updated = await sql.query<GameRow>(
        `update game set
           opponent_id = $2,
           status = 'scheduled',
           scheduled_at = preferred_at,
           accepted_at = now(),
           opponent_bringing_ball = true,
           updated_at = now()
         where id = $1 and status = 'open' and opponent_id is null and host_id <> $2
         returning *`,
        [data.gameId, opp.id],
      );
      if (!updated[0]) throw new Error("Could not lock in the test opponent.");
      await addSystemMessage(
        sql,
        data.gameId,
        "Test opponent joined for practice. Enter a score, then confirm as the test opponent to lock ratings.",
      );
      return { ok: true as const };
    });
  });
